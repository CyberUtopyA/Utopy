// src/mt/mt.escrowEngine.ts
// MT Escrow Engine (MS web o Micelio-side)
// - Escucha mtLiveStore (snapshot+SSE ya lo llenan)
// - Dedupe de delivery.confirm por (orderId|actorId|role)
// - Política 2-de-3 por roles: buyer + seller + cajero (configurable)
// - Consenso ponderado por trust (compatible con sem/votes/trust que ya manejás)
// - Emite intents: payment.lock, payment.release, payment.refund, payment.dispute
//
// ✅ NO requiere tocar el nodo MT app: solo consume/produce DVs/Intents en la red.
//

import { mtLiveSubscribe, mtLiveUpsert } from "../mt/mt.liveStore";
import type { DatoVivo } from "../mt/mt.traitAdapter";
import { spore } from "../utopy/spore.singleton";

// =========================================================
// Types
// =========================================================

export type DeliveryRole = "buyer" | "seller" | "cajero";

export type DeliveryConfirm = {
  id: string; // dv.id
  orderId: string;
  role: DeliveryRole;
  actorId: string; // "evm:0x.." | "mt:cajero:.." | nodeId
  ok: boolean; // true confirma entrega, false disputa
  note?: string;
  ts?: string;
  meta?: any;
};

export type EscrowPolicy = {
  // default: 2-of-3 (buyer/seller/cajero)
  requiredOk?: number; // 2
  requiredRoles?: DeliveryRole[]; // ["buyer","seller","cajero"]
  // si hay 1+ rechazos fuertes => disputa inmediata (opcional)
  disputeIfAnyNok?: boolean; // true
  // dedupe window (ms) si querés ignorar “spam”
  dedupeTtlMs?: number; // 12h
};

export type TrustMap = Record<string, number>; // actorId -> 0..1

export type ConsensusResult = {
  decision: "pending" | "delivered" | "rejected" | "dispute";
  okVotes: number;
  nokVotes: number;
  okWeight: number; // ponderado por trust
  nokWeight: number;
  rolesOk: Set<DeliveryRole>;
  rolesNok: Set<DeliveryRole>;
  reasons?: string[];
  top?: {
    byRole: Record<DeliveryRole, DeliveryConfirm[]>;
  };
};

// =========================================================
// Helpers
// =========================================================

function clamp01(n: any) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return undefined;
  }
}

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

// DV matcher
function isKind(d: DatoVivo | any, kind: string) {
  return safeStr(d?.kind).trim() === kind;
}

function hasTrait(d: DatoVivo | any, t: string) {
  const arr: string[] = Array.isArray(d?.traits) ? d.traits : [];
  return arr.includes(t);
}

// Extract “orderId” from DV confirm
function extractOrderId(d: any): string | null {
  const a = d?.attrs || {};
  const m = d?.meta || {};
  const id =
    a.orderId ??
    a.order_id ??
    a.order ??
    m.orderId ??
    m.order_id ??
    m.order ??
    null;
  return id ? String(id) : null;
}

// Extract actorId + role + ok
function extractConfirm(d: DatoVivo): DeliveryConfirm | null {
  const a: any = d.attrs || {};
  const m: any = d.meta || {};

  const orderId = extractOrderId(d);
  if (!orderId) return null;

  const roleRaw = safeStr(a.role ?? m.role ?? a.actorRole ?? m.actorRole).toLowerCase();
  const role: DeliveryRole =
    roleRaw === "buyer" ? "buyer" :
    roleRaw === "seller" ? "seller" :
    roleRaw === "cajero" ? "cajero" :
    // fallback: si viene "cashier"
    roleRaw === "cashier" ? "cajero" :
    // si no hay role, intentar inferir por actorKind
    (safeStr(a.actorKind ?? m.actorKind).toLowerCase() === "cajero" ? "cajero" : "buyer");

  const actorId =
    safeStr(a.actorId ?? a.actor?.id ?? m.actorId ?? m.actor?.id ?? a.by ?? m.by) ||
    // fallback: si viene buyer/seller fields
    safeStr(a.buyerId ?? m.buyerId ?? a.sellerId ?? m.sellerId) ||
    // último fallback: dv.id (no ideal)
    `dv:${safeStr(d.id)}`;

  // ok: default true si no especifica y kind = delivery.confirm
  const okRaw = a.ok ?? a.confirmed ?? a.success ?? m.ok ?? m.confirmed ?? true;
  const ok = !!okRaw;

  const note = safeStr(a.note ?? a.msg ?? m.note ?? m.msg) || undefined;
  const ts = safeStr(a.ts ?? m.ts ?? m.timestamp) || safeStr(m?.ts) || nowIso();

  return {
    id: String(d.id),
    orderId,
    role,
    actorId,
    ok,
    note,
    ts,
    meta: { ...(m || {}), ...(a?._meta || {}) },
  };
}

// =========================================================
// Trust (compatible con sem/votes/trust)
// =========================================================

// Intenta obtener trust para actor desde:
// 1) confirm.meta.sem.trust["*|actorId"] o ["*|*"]
// 2) confirm.meta.trust[actorId]
// 3) trustMap pasado por engine
// 4) default 0.55
function getActorTrust(confirm: DeliveryConfirm, trustMap?: TrustMap): number {
  const meta = confirm.meta || {};
  const semTrust = meta?.sem?.trust;
  const actorId = confirm.actorId;

  if (semTrust && typeof semTrust === "object") {
    if (typeof semTrust[`*|${actorId}`] === "number") return clamp01(semTrust[`*|${actorId}`]);
    if (typeof semTrust[`*|*`] === "number") return clamp01(semTrust[`*|*`]);
  }

  const direct = meta?.trust;
  if (direct && typeof direct === "object" && typeof direct[actorId] === "number") {
    return clamp01(direct[actorId]);
  }

  if (trustMap && typeof trustMap[actorId] === "number") return clamp01(trustMap[actorId]);

  return 0.55;
}

// =========================================================
// Consensus
// =========================================================

/**
 * computeDeliveryConsensus(orderId, confirms, trustMap)
 * - dedupe por (role|actorId) (toma el más reciente por ts)
 * - pondera por trust
 * - 2-de-3 por roles (default)
 */
export function computeDeliveryConsensus(
  orderId: string,
  confirms: DeliveryConfirm[],
  trustMap?: TrustMap,
  policy: EscrowPolicy = {}
): ConsensusResult {
  const requiredRoles = policy.requiredRoles ?? ["buyer", "seller", "cajero"];
  const requiredOk = policy.requiredOk ?? 2;
  const disputeIfAnyNok = policy.disputeIfAnyNok ?? true;

  const reasons: string[] = [];

  // 1) filtrar por order
  const rel = confirms.filter((c) => c.orderId === orderId);

  // 2) dedupe: por role+actorId conservar más reciente
  const byKey = new Map<string, DeliveryConfirm>();
  for (const c of rel) {
    const key = `${c.role}|${c.actorId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, c);
      continue;
    }
    // comparar timestamps: si no parsea, conservar el nuevo
    const tPrev = Date.parse(prev.ts || "");
    const tCur = Date.parse(c.ts || "");
    if (!Number.isFinite(tPrev) || !Number.isFinite(tCur) || tCur >= tPrev) byKey.set(key, c);
  }
  const deduped = Array.from(byKey.values());

  // 3) agrupar por role
  const byRole: Record<DeliveryRole, DeliveryConfirm[]> = {
    buyer: [],
    seller: [],
    cajero: [],
  };
  for (const c of deduped) {
    if (c.role in byRole) (byRole as any)[c.role].push(c);
  }

  // 4) elegir 1 confirm “principal” por role:
  //    - si hay varios actores en un rol, tomamos el de mayor trust*recencia (simple)
  const pickBestPerRole = (role: DeliveryRole): DeliveryConfirm | null => {
    const arr = byRole[role] || [];
    if (!arr.length) return null;
    const scored = arr
      .map((c) => {
        const trust = getActorTrust(c, trustMap);
        const t = Date.parse(c.ts || "");
        const rec = Number.isFinite(t) ? t : 0;
        // score suave: trust + micro-bono por recencia
        const score = trust + rec * 1e-16;
        return { c, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0].c;
  };

  const chosen: DeliveryConfirm[] = [];
  for (const r of requiredRoles) {
    const best = pickBestPerRole(r);
    if (best) chosen.push(best);
  }

  // 5) contar votos OK/NOK + pesos
  let okVotes = 0;
  let nokVotes = 0;
  let okWeight = 0;
  let nokWeight = 0;
  const rolesOk = new Set<DeliveryRole>();
  const rolesNok = new Set<DeliveryRole>();

  for (const c of chosen) {
    const w = getActorTrust(c, trustMap);
    if (c.ok) {
      okVotes += 1;
      okWeight += w;
      rolesOk.add(c.role);
    } else {
      nokVotes += 1;
      nokWeight += w;
      rolesNok.add(c.role);
    }
  }

  // 6) política 2-of-3 por roles:
  // - delivered: okVotes >= requiredOk y cubre roles distintos
  // - dispute: si hay NOK y disputeIfAnyNok
  // - rejected: nokVotes >= requiredOk (opcional)
  // - pending: caso restante

  // Falta de roles
  const missing = requiredRoles.filter((r) => !rolesOk.has(r) && !rolesNok.has(r));
  if (missing.length) reasons.push(`Faltan confirmaciones: ${missing.join(", ")}`);

  if (disputeIfAnyNok && nokVotes >= 1) {
    return {
      decision: "dispute",
      okVotes,
      nokVotes,
      okWeight,
      nokWeight,
      rolesOk,
      rolesNok,
      reasons: reasons.length ? reasons : ["Hay al menos 1 rechazo."],
      top: { byRole },
    };
  }

  // delivered
  if (okVotes >= requiredOk && rolesOk.size >= requiredOk) {
    return {
      decision: "delivered",
      okVotes,
      nokVotes,
      okWeight,
      nokWeight,
      rolesOk,
      rolesNok,
      reasons: reasons.length ? reasons : [`OK ${okVotes}/${requiredRoles.length}`],
      top: { byRole },
    };
  }

  // rejected (si querés usar)
  if (nokVotes >= requiredOk && rolesNok.size >= requiredOk) {
    return {
      decision: "rejected",
      okVotes,
      nokVotes,
      okWeight,
      nokWeight,
      rolesOk,
      rolesNok,
      reasons: reasons.length ? reasons : [`NOK ${nokVotes}/${requiredRoles.length}`],
      top: { byRole },
    };
  }

  return {
    decision: "pending",
    okVotes,
    nokVotes,
    okWeight,
    nokWeight,
    rolesOk,
    rolesNok,
    reasons: reasons.length ? reasons : ["Esperando más confirmaciones."],
    top: { byRole },
  };
}

// =========================================================
// Engine runtime
// =========================================================

type EngineOptions = {
  // Escrow policy
  policy?: EscrowPolicy;

  // Trust map (si querés inyectar localmente; si no, usa meta.sem.trust / defaults)
  trustMap?: TrustMap;

  // Auto: cuando ve market.order.create, emite payment.lock
  autoLock?: boolean;

  // Auto: si delivered => release; si dispute => dispute; si rejected => refund
  autoSettle?: boolean;

  // Namespace para intents/acciones (meta.ns)
  ns?: string;

  // Logging
  debug?: boolean;
};

type OrderState = {
  orderId: string;
  status: "new" | "locked" | "pending_delivery" | "delivered" | "released" | "refunded" | "dispute";
  // ids vistos
  lockId?: string;
  releaseId?: string;
  refundId?: string;
  disputeId?: string;
  // confirms dedupe cache
  confirms: DeliveryConfirm[];
  // last decision snapshot
  lastDecision?: ConsensusResult;
  updatedAt?: number;
};

function dvIsOrder(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "market.order" || k === "market.order.create" || k === "mt:order" || hasTrait(d, "mt:order");
}

function dvIsDeliveryConfirm(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "delivery.confirm" || k === "mt:delivery.confirm" || hasTrait(d, "mt:delivery.confirm");
}

function dvIsLock(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "payment.lock" || k === "mt:payment.lock" || hasTrait(d, "mt:payment.lock");
}
function dvIsRelease(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "payment.release" || k === "mt:payment.release" || hasTrait(d, "mt:payment.release");
}
function dvIsRefund(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "payment.refund" || k === "mt:payment.refund" || hasTrait(d, "mt:payment.refund");
}
function dvIsDispute(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  return k === "payment.dispute" || k === "mt:payment.dispute" || hasTrait(d, "mt:payment.dispute");
}

function extractOrderFromDv(d: DatoVivo): { orderId: string; attrs: any; meta: any } | null {
  const a: any = d.attrs || {};
  const m: any = d.meta || {};
  const orderId =
    safeStr(a.orderId ?? a.id ?? m.orderId ?? d.id) ||
    null;
  if (!orderId) return null;
  return { orderId: String(orderId), attrs: a, meta: m };
}

function createEngineId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Emit intent to network (best-effort)
async function emitIntent(say: string, withPayload: any) {
  if (!spore) return;
  await spore.sayIntent({
    sym: "🧬",
    say,
    with: withPayload,
  });
}

// Create DV locally so UI can react immediately
function upsertLocal(dv: DatoVivo) {
  try {
    mtLiveUpsert(dv as any);
  } catch {}
}

export function createMtEscrowEngine(opts: EngineOptions = {}) {
  const policy: EscrowPolicy = {
    requiredOk: 2,
    requiredRoles: ["buyer", "seller", "cajero"],
    disputeIfAnyNok: true,
    dedupeTtlMs: 12 * 60 * 60 * 1000,
    ...(opts.policy || {}),
  };

  const ns = opts.ns ?? "mt:escrow";
  const debug = !!opts.debug;

  const stateByOrder = new Map<string, OrderState>();
  const seenConfirmKeys = new Map<string, number>(); // key -> ts(ms) for TTL

  const log = (...a: any[]) => debug && console.log("[mt.escrowEngine]", ...a);

  function gcDedupe(now = Date.now()) {
    const ttl = policy.dedupeTtlMs ?? 0;
    if (!ttl) return;
    for (const [k, t] of seenConfirmKeys.entries()) {
      if (now - t > ttl) seenConfirmKeys.delete(k);
    }
  }

  function getOrInit(orderId: string): OrderState {
    const prev = stateByOrder.get(orderId);
    if (prev) return prev;
    const st: OrderState = {
      orderId,
      status: "new",
      confirms: [],
      updatedAt: Date.now(),
    };
    stateByOrder.set(orderId, st);
    return st;
  }

  async function handleOrderDv(d: DatoVivo) {
    const o = extractOrderFromDv(d);
    if (!o) return;
    const st = getOrInit(o.orderId);

    // Si ya está settled, ignorar
    if (st.status === "released" || st.status === "refunded") return;

    st.updatedAt = Date.now();
    log("order seen", o.orderId, d.kind);

    // auto lock
    if (opts.autoLock ?? true) {
      if (!st.lockId) {
        const lockId = createEngineId("mt:lock:");
        st.lockId = lockId;
        st.status = "locked";

        const dvLock: DatoVivo = {
          id: lockId,
          kind: "payment.lock",
          attrs: {
            orderId: o.orderId,
            // lock “conceptual”: no transacción obligatoria aquí
            mode: "escrow",
            amount: o.attrs?.total ?? o.attrs?.amount ?? null,
            currency: o.attrs?.currency ?? "fiat/crypto",
          },
          traits: ["mt:payment.lock", "mt:escrow"],
          meta: { ns, ts: nowIso(), engine: "mt.escrowEngine" },
        };

        upsertLocal(dvLock);

        try {
          await emitIntent("payment.lock", { dv: dvLock });
          log("emit intent payment.lock", o.orderId);
        } catch (e) {
          log("emit lock failed", e);
        }
      }
    }
  }

  function handleLockReleaseRefundMarkers(d: DatoVivo) {
    const orderId = extractOrderId(d);
    if (!orderId) return;
    const st = getOrInit(orderId);
    st.updatedAt = Date.now();

    if (dvIsLock(d)) {
      st.lockId = String(d.id);
      if (st.status === "new") st.status = "locked";
    }
    if (dvIsRelease(d)) {
      st.releaseId = String(d.id);
      st.status = "released";
    }
    if (dvIsRefund(d)) {
      st.refundId = String(d.id);
      st.status = "refunded";
    }
    if (dvIsDispute(d)) {
      st.disputeId = String(d.id);
      st.status = "dispute";
    }
  }

  async function handleDeliveryConfirmDv(d: DatoVivo) {
    const c = extractConfirm(d);
    if (!c) return;

    const key = `${c.orderId}|${c.role}|${c.actorId}`;
    gcDedupe();

    // DEDUPE fuerte por key (role+actor)
    if (seenConfirmKeys.has(key)) {
      log("dedupe confirm", key);
      return;
    }
    seenConfirmKeys.set(key, Date.now());

    const st = getOrInit(c.orderId);

    // si ya settled, ignorar
    if (st.status === "released" || st.status === "refunded") return;

    st.confirms.push(c);
    st.status = st.status === "new" ? "pending_delivery" : st.status;

    // recalcular consenso
    const result = computeDeliveryConsensus(c.orderId, st.confirms, opts.trustMap, policy);
    st.lastDecision = result;
    st.updatedAt = Date.now();

    log("consensus", c.orderId, result.decision, {
      okVotes: result.okVotes,
      nokVotes: result.nokVotes,
      okW: result.okWeight.toFixed(3),
      nokW: result.nokWeight.toFixed(3),
    });

    if (!(opts.autoSettle ?? true)) return;

    // settle
    if (result.decision === "delivered") {
      if (!st.releaseId) {
        const releaseId = createEngineId("mt:release:");
        st.releaseId = releaseId;
        st.status = "released";

        const dvRelease: DatoVivo = {
          id: releaseId,
          kind: "payment.release",
          attrs: {
            orderId: c.orderId,
            method: "escrow",
            // info útil:
            okVotes: result.okVotes,
            okWeight: result.okWeight,
            rolesOk: Array.from(result.rolesOk),
          },
          traits: ["mt:payment.release", "mt:escrow"],
          meta: {
            ns,
            ts: nowIso(),
            engine: "mt.escrowEngine",
            consensus: {
              decision: result.decision,
              okVotes: result.okVotes,
              nokVotes: result.nokVotes,
              okWeight: result.okWeight,
              nokWeight: result.nokWeight,
              rolesOk: Array.from(result.rolesOk),
              rolesNok: Array.from(result.rolesNok),
              reasons: result.reasons,
            },
          },
        };

        upsertLocal(dvRelease);
        try {
          await emitIntent("payment.release", { dv: dvRelease });
        } catch {}
      }
      return;
    }

    if (result.decision === "rejected") {
      if (!st.refundId) {
        const refundId = createEngineId("mt:refund:");
        st.refundId = refundId;
        st.status = "refunded";

        const dvRefund: DatoVivo = {
          id: refundId,
          kind: "payment.refund",
          attrs: {
            orderId: c.orderId,
            method: "escrow",
            nokVotes: result.nokVotes,
            nokWeight: result.nokWeight,
            rolesNok: Array.from(result.rolesNok),
          },
          traits: ["mt:payment.refund", "mt:escrow"],
          meta: { ns, ts: nowIso(), engine: "mt.escrowEngine", reasons: result.reasons },
        };

        upsertLocal(dvRefund);
        try {
          await emitIntent("payment.refund", { dv: dvRefund });
        } catch {}
      }
      return;
    }

    if (result.decision === "dispute") {
      if (!st.disputeId) {
        const disputeId = createEngineId("mt:dispute:");
        st.disputeId = disputeId;
        st.status = "dispute";

        const dvDispute: DatoVivo = {
          id: disputeId,
          kind: "payment.dispute",
          attrs: {
            orderId: c.orderId,
            method: "escrow",
            okVotes: result.okVotes,
            nokVotes: result.nokVotes,
            rolesOk: Array.from(result.rolesOk),
            rolesNok: Array.from(result.rolesNok),
          },
          traits: ["mt:payment.dispute", "mt:escrow"],
          meta: { ns, ts: nowIso(), engine: "mt.escrowEngine", reasons: result.reasons },
        };

        upsertLocal(dvDispute);
        try {
          await emitIntent("payment.dispute", { dv: dvDispute });
        } catch {}
      }
      return;
    }
  }

  // Main handler for any DV
  async function onDv(d: DatoVivo) {
    const k = safeStr(d.kind);

    // markers first (lock/release/refund/dispute)
    if (dvIsLock(d) || dvIsRelease(d) || dvIsRefund(d) || dvIsDispute(d)) {
      handleLockReleaseRefundMarkers(d);
      return;
    }

    // order
    if (dvIsOrder(d)) {
      await handleOrderDv(d);
      return;
    }

    // confirm
    if (dvIsDeliveryConfirm(d)) {
      await handleDeliveryConfirmDv(d);
      return;
    }

    // ignore else
    if (debug) {
      // log("ignore dv", k);
    }
  }

  // Start/stop
  let unsubscribe: null | (() => void) = null;

  function start() {
    if (unsubscribe) return;
    log("start");

    unsubscribe = mtLiveSubscribe((all: DatoVivo[]) => {
      // procesar “nuevos” sin re-hacer todo:
      // como mtLiveStore no da delta, hacemos un scan liviano:
      // 1) solo kinds relevantes
      const rel = all.filter((d) => {
        const k = safeStr(d.kind);
        return (
          k === "market.order" ||
          k === "market.order.create" ||
          k === "mt:order" ||
          k === "delivery.confirm" ||
          k === "mt:delivery.confirm" ||
          k === "payment.lock" ||
          k === "payment.release" ||
          k === "payment.refund" ||
          k === "payment.dispute"
        );
      });

      // 2) ordenar por “ts” si existe para estabilidad
      rel.sort((a: any, b: any) => {
        const ta = Date.parse(a?.meta?.ts || a?.attrs?.ts || "");
        const tb = Date.parse(b?.meta?.ts || b?.attrs?.ts || "");
        if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
        if (!Number.isFinite(ta)) return -1;
        if (!Number.isFinite(tb)) return 1;
        return ta - tb;
      });

      // 3) procesar (best-effort, async fire-and-forget)
      for (const d of rel) {
        void onDv(d);
      }
    });

    return () => stop();
  }

  function stop() {
    if (!unsubscribe) return;
    log("stop");
    try {
      unsubscribe();
    } catch {}
    unsubscribe = null;
  }

  function getState(orderId: string) {
    return stateByOrder.get(orderId) || null;
  }

  return { start, stop, getState, computeDeliveryConsensus };
}

// =========================================================
// Wiring helpers (MS web)
// =========================================================

/**
 * startMtEscrowEngineForMsWeb()
 * Llamalo 1 vez (ej: en MercadoLocal.tsx dentro de useEffect)
 */
let _engineStarted = false;
export function startMtEscrowEngineForMsWeb(opts: EngineOptions = {}) {
  if (_engineStarted) return;
  _engineStarted = true;

  const engine = createMtEscrowEngine({
    autoLock: true,
    autoSettle: true,
    debug: false,
    ...opts,
  });

  engine.start();
  return engine;
}