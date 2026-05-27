// src/mt/mt.delivery.ts
import type { DatoVivo } from "./mt.traitAdapter";
import { mtLiveUpsert } from "./mt.liveStore";
import { publishDatoVivo } from "./seedbus";
import { spore } from "../utopy/spore.singleton";

export type DeliveryRole = "buyer" | "cajero" | "witness";
export type DeliveryDecision = "delivered" | "not_delivered";

export type DeliveryConfirm = {
  orderId: string;
  decision: DeliveryDecision;
  byId: string;
  role: DeliveryRole;
  confidence?: number; // 0..1
  ts?: string;
  territoryId?: string;
  proofId?: string; // QR proof DV id, foto hash, etc
};

const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function clamp01(n: any) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

/** Crea DV delivery.confirm y lo publica (store + seed + intent opcional) */
export async function emitDeliveryConfirm(c: DeliveryConfirm) {
  const ts = c.ts ?? new Date().toISOString();

  const dv: DatoVivo = {
    id: createId("mt:delivery:"),
    kind: "delivery.confirm",
    traits: ["mt:delivery", "mt:escrow.confirm"],
    attrs: {
      orderId: c.orderId,
      decision: c.decision,
      role: c.role,
      confidence: clamp01(c.confidence ?? 0.85),
      by: { id: c.byId },
      territoryId: c.territoryId,
      proofId: c.proofId,
      ts,
    },
    meta: {
      ns: "mt:market",
      ts,
    },
  };

  mtLiveUpsert(dv);
  try {
    await publishDatoVivo(dv);
  } catch {}

  // intent opcional (útil para settlement node / UI)
  await spore?.sayIntent({
    sym: c.decision === "delivered" ? "📦" : "⚠️",
    say: "delivery.confirm",
    with: { ...c, ts },
  });

  return dv;
}

/** Dedup key por actor+rol (lo pedido) */
export function dedupeConfirmsByActorRole(confirms: DeliveryConfirm[]) {
  const best = new Map<string, DeliveryConfirm>();
  for (const c of confirms) {
    const key = `${c.byId}|${c.role}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, c);
      continue;
    }
    // tomar el más reciente por ts si existe
    const tPrev = Date.parse(prev.ts ?? "") || 0;
    const tCur = Date.parse(c.ts ?? "") || 0;
    if (tCur >= tPrev) best.set(key, c);
  }
  return Array.from(best.values());
}

/**
 * Política 2-de-3:
 * - roles: buyer, cajero, witness
 * - decisión gana si al menos 2 roles distintos coinciden
 * - conflicto si 2 roles distintos no coinciden o falta info
 */
export function compute2of3DeliveryDecision(confirms: DeliveryConfirm[]) {
  const deduped = dedupeConfirmsByActorRole(confirms);

  // escoger 1 confirm por rol (el más reciente, aunque haya múltiples actores por rol)
  const byRole = new Map<DeliveryRole, DeliveryConfirm>();
  for (const c of deduped) {
    const r = c.role;
    const prev = byRole.get(r);
    if (!prev) byRole.set(r, c);
    else {
      const tPrev = Date.parse(prev.ts ?? "") || 0;
      const tCur = Date.parse(c.ts ?? "") || 0;
      if (tCur >= tPrev) byRole.set(r, c);
    }
  }

  const roles: DeliveryRole[] = ["buyer", "cajero", "witness"];
  const picks = roles.map((r) => byRole.get(r)).filter(Boolean) as DeliveryConfirm[];

  // contar votos por decision, pero asegurando roles distintos
  const deliveredRoles = new Set<DeliveryRole>();
  const notDeliveredRoles = new Set<DeliveryRole>();

  for (const c of picks) {
    if (c.decision === "delivered") deliveredRoles.add(c.role);
    else notDeliveredRoles.add(c.role);
  }

  if (deliveredRoles.size >= 2) {
    return { decision: "delivered" as const, used: picks, reason: "2-of-3 delivered" };
  }
  if (notDeliveredRoles.size >= 2) {
    return { decision: "not_delivered" as const, used: picks, reason: "2-of-3 not_delivered" };
  }

  if (picks.length >= 2) {
    return { decision: "conflict" as const, used: picks, reason: "2 roles disagree or insufficient majority" };
  }
  return { decision: "pending" as const, used: picks, reason: "need more roles" };
}