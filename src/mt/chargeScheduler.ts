// src/mt/payments/chargeScheduler.ts
// Scheduler UTOPY negociador:
// - observa payment.mandate activos donde mandate.sellerId === sellerId
// - calcula si toca intentar cobrar según interval/every
// - evita duplicados por ciclo contra payment.due / payment.charge / payment.outcome
// - lee contexto vivo:
//    - payment.proximity
//    - presence.signal
//    - payment.offer
//    - cajero activo / estado runtime
// - emite payment.due
// - emite payment.proposal contextual
//
// IDEA:
// el scheduler NO cobra directo.
// activa intención + propuesta contextual.
// luego el cajero / buyer / runtime decide cómo cerrar.

import { mtLiveSubscribe } from "./mt.liveStore";
import {
  emitPaymentDue,
  emitPaymentProposal,
  type PaymentMethod,
} from "./mt.intentpayment";

type AnyDV = any;

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function safeNum(x: any, fb = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fb;
}

function safeBool(x: any, fb = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  const s = safeStr(x).trim().toLowerCase();
  if (!s) return fb;
  if (["true", "1", "yes", "si", "sí", "on", "online", "active", "activo"].includes(s)) return true;
  if (["false", "0", "no", "off", "offline", "inactive", "inactivo"].includes(s)) return false;
  return fb;
}

function parseTs(x: any): number {
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : 0;
}

function safeArr<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function normalizeMethod(m: any): PaymentMethod | null {
  if (!m || typeof m !== "object") return null;
  const channel = safeStr(m.channel).trim();
  if (!channel) return null;
  return {
    channel,
    label: m.label != null ? safeStr(m.label) : undefined,
    address: m.address != null ? safeStr(m.address) : null,
    link: m.link != null ? safeStr(m.link) : null,
    qr: m.qr != null ? safeStr(m.qr) : null,
    meta: m.meta && typeof m.meta === "object" ? m.meta : undefined,
  };
}

function uniqMethods(xs: PaymentMethod[]): PaymentMethod[] {
  const seen = new Set<string>();
  const out: PaymentMethod[] = [];

  for (const m of xs) {
    const key = `${safeStr(m?.channel).toLowerCase()}|${safeStr(m?.label).toLowerCase()}`;
    if (!safeStr(m?.channel)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
}

function isMandate(d: AnyDV) {
  return safeStr(d?.kind) === "payment.mandate";
}

function isDue(d: AnyDV) {
  return safeStr(d?.kind) === "payment.due";
}

function isCharge(d: AnyDV) {
  return safeStr(d?.kind) === "payment.charge";
}

function isOutcome(d: AnyDV) {
  return safeStr(d?.kind) === "payment.outcome" &&
    Boolean(d?.meta?.ownership?.signature?.value) &&
    safeStr(d?.meta?.authority) === safeStr(d?.attrs?.actingAsNodeId);
}

function isProposal(d: AnyDV) {
  return safeStr(d?.kind) === "payment.proposal";
}

function isPaymentOffer(d: AnyDV) {
  return safeStr(d?.kind) === "payment.offer";
}

function isPaymentProximity(d: AnyDV) {
  return safeStr(d?.kind) === "payment.proximity";
}

function isPresenceSignal(d: AnyDV) {
  return safeStr(d?.kind) === "presence.signal";
}

function isCreditPlan(d: AnyDV) {
  return safeStr(d?.kind) === "credit.plan";
}

function addInterval(baseMs: number, interval: string, every: number) {
  const e = Math.max(1, safeNum(every, 1));
  const d = new Date(baseMs);

  if (interval === "daily") d.setDate(d.getDate() + e);
  else if (interval === "weekly") d.setDate(d.getDate() + 7 * e);
  else if (interval === "monthly") d.setMonth(d.getMonth() + e);
  else d.setMonth(d.getMonth() + e);

  return d.getTime();
}

function cycleWindowStart(nowMs: number, interval: string, every: number) {
  const e = Math.max(1, safeNum(every, 1));
  const approx =
    interval === "daily"
      ? 86400000 * e
      : interval === "weekly"
      ? 86400000 * 7 * e
      : interval === "monthly"
      ? 86400000 * 30 * e
      : 86400000 * 30 * e;

  return nowMs - approx;
}

function resolveMandateThreadId(m: AnyDV) {
  return safeStr(m?.attrs?.threadId || m?.meta?.threadId || "") || null;
}

function resolveMandateOrderId(m: AnyDV) {
  return safeStr(m?.attrs?.orderId || m?.meta?.orderId || "") || null;
}

function resolveBuyerName(m: AnyDV) {
  return safeStr(m?.attrs?.buyerName || m?.meta?.buyerName || "") || null;
}

function resolveSellerName(m: AnyDV, fallback?: string | null) {
  return (
    safeStr(m?.attrs?.sellerName || m?.meta?.sellerName || "") ||
    safeStr(fallback || "") ||
    null
  );
}

function findLatestPaymentOffer(all: AnyDV[], sellerId: string, orderId?: string | null) {
  const offers = all
    .filter(isPaymentOffer)
    .filter((d) => safeStr(d?.attrs?.sellerId) === safeStr(sellerId))
    .filter((d) => {
      const scope = safeStr(d?.attrs?.scope || "seller");
      if (scope === "seller") return true;
      if (scope === "order" && orderId) {
        return safeStr(d?.attrs?.orderId) === safeStr(orderId);
      }
      return false;
    })
    .sort((a, b) => {
      const ta = parseTs(a?.meta?.ts || a?.attrs?.ts);
      const tb = parseTs(b?.meta?.ts || b?.attrs?.ts);
      return tb - ta;
    });

  return offers[0] || null;
}

function resolveAcceptedMethodsFromOffer(offer: AnyDV): PaymentMethod[] {
  return uniqMethods(
    safeArr<any>(offer?.attrs?.accepted)
      .map(normalizeMethod)
      .filter(Boolean) as PaymentMethod[]
  );
}

function resolveAcceptedMethodsFromMandate(m: AnyDV): PaymentMethod[] {
  const accepted = safeArr<any>(
    m?.attrs?.accepted ??
      m?.attrs?.paymentMethods ??
      m?.attrs?.methods ??
      m?.meta?.accepted ??
      []
  );

  return uniqMethods(
    accepted.map((it) => {
      if (!it) return null;
      if (typeof it === "string") {
        return { channel: it, label: it } satisfies PaymentMethod;
      }
      return normalizeMethod(it);
    }).filter(Boolean) as PaymentMethod[]
  );
}

function resolveThreadPresence(all: AnyDV[], args: {
  sellerId: string;
  buyerId: string;
  threadId?: string | null;
  orderId?: string | null;
  maxAgeMs: number;
}) {
  const now = Date.now();
  const relevant = all
    .filter(isPresenceSignal)
    .filter((d) => {
      const actorId = safeStr(d?.actorId || d?.attrs?.actorId || d?.meta?.actor);
      const meta = d?.meta || {};
      const sigThreadId = safeStr(d?.threadId || d?.attrs?.threadId || meta?.threadId);
      const sigOrderId = safeStr(d?.attrs?.orderId || meta?.orderId);
      const sigSellerId = safeStr(meta?.sellerId || d?.attrs?.sellerId);
      const targetId = safeStr(meta?.targetId || d?.attrs?.targetId || d?.productId);

      const ts = parseTs(meta?.ts || d?.attrs?.ts);
      if (!ts || now - ts > args.maxAgeMs) return false;

      const buyerMatch = actorId && actorId === safeStr(args.buyerId);
      const threadMatch = !!args.threadId && sigThreadId === safeStr(args.threadId);
      const orderMatch = !!args.orderId && sigOrderId === safeStr(args.orderId);
      const sellerMatch = sigSellerId && sigSellerId === safeStr(args.sellerId);

      return buyerMatch || threadMatch || orderMatch || sellerMatch || !!targetId;
    })
    .sort((a, b) => {
      const ta = parseTs(a?.meta?.ts || a?.attrs?.ts);
      const tb = parseTs(b?.meta?.ts || b?.attrs?.ts);
      return tb - ta;
    });

  return relevant;
}

function resolveLatestProximity(all: AnyDV[], args: {
  sellerId: string;
  buyerId: string;
  mandateId?: string | null;
  threadId?: string | null;
  orderId?: string | null;
  maxAgeMs: number;
}) {
  const now = Date.now();

  return (
    all
      .filter(isPaymentProximity)
      .filter((d) => {
        const ts = parseTs(d?.meta?.ts || d?.attrs?.ts);
        if (!ts || now - ts > args.maxAgeMs) return false;

        const sellerMatch = safeStr(d?.attrs?.sellerId) === safeStr(args.sellerId);
        if (!sellerMatch) return false;

        const buyerMatch = safeStr(d?.attrs?.buyerId) === safeStr(args.buyerId);
        const mandateMatch =
          !!args.mandateId && safeStr(d?.attrs?.mandateId) === safeStr(args.mandateId);
        const threadMatch =
          !!args.threadId && safeStr(d?.attrs?.threadId) === safeStr(args.threadId);
        const orderMatch =
          !!args.orderId && safeStr(d?.attrs?.orderId) === safeStr(args.orderId);

        return buyerMatch || mandateMatch || threadMatch || orderMatch;
      })
      .sort((a, b) => {
        const ta = parseTs(a?.meta?.ts || a?.attrs?.ts);
        const tb = parseTs(b?.meta?.ts || b?.attrs?.ts);
        return tb - ta;
      })[0] || null
  );
}

function findCreditPlanForMandate(all: AnyDV[], mandate: AnyDV) {
  const productCandidates = [
    mandate?.attrs?.productId,
    mandate?.attrs?.productName,
    mandate?.meta?.productId,
  ]
    .map((x) => safeStr(x).trim())
    .filter(Boolean);

  if (!productCandidates.length) return null;

  return (
    all
      .filter(isCreditPlan)
      .filter((d) => {
        const planProductId = safeStr(d?.attrs?.productId).trim();
        if (!planProductId) return false;
        return productCandidates.some(
          (p) => p.toLowerCase() === planProductId.toLowerCase()
        );
      })
      .sort((a, b) => {
        const ta = parseTs(a?.meta?.ts || a?.attrs?.ts);
        const tb = parseTs(b?.meta?.ts || b?.attrs?.ts);
        return tb - ta;
      })[0] || null
  );
}

function hasRecentForMandate(args: {
  events: AnyDV[];
  mandateId: string;
  windowStart: number;
}) {
  const { events, mandateId, windowStart } = args;

  return events.some((d) => {
    const kind = safeStr(d?.kind);
    const linkedMandateId = safeStr(
      d?.attrs?.mandateId || d?.meta?.mandateId || ""
    );
    if (linkedMandateId !== mandateId) return false;

    const ts =
      parseTs(d?.attrs?.dueTs) ||
      parseTs(d?.attrs?.scheduledAt) ||
      parseTs(d?.attrs?.expiresAt) ||
      parseTs(d?.attrs?.ts) ||
      parseTs(d?.meta?.ts);

    if (ts < windowStart) return false;

    if (kind === "payment.outcome") {
      const status = safeStr(d?.attrs?.status).toLowerCase();
      return ["scheduled", "paid", "pending_review"].includes(status);
    }

    return kind === "payment.due" || kind === "payment.charge" || kind === "payment.proposal";
  });
}

function chooseRecommendedMethod(args: {
  offerMethods: PaymentMethod[];
  mandateMethods: PaymentMethod[];
  presenceSignals: AnyDV[];
  proximity: AnyDV | null;
  hasCreditPlan: boolean;
  trustScore: number | null;
  creditEnabled: boolean;
  activeCajeroOnline: boolean;
}) {
  const allMethods = uniqMethods([...args.offerMethods, ...args.mandateMethods]);

  const hasMethod = (channel: string) =>
    allMethods.find((m) => safeStr(m?.channel).toLowerCase() === channel) || null;

  const qrDetected = args.presenceSignals.some((d) => {
    const meta = d?.meta || {};
    const entryMethod = safeStr(meta?.entryMethod || d?.attrs?.entryMethod).toLowerCase();
    return entryMethod === "qr";
  });

  const nfcDetected = args.presenceSignals.some((d) => {
    const meta = d?.meta || {};
    const entryMethod = safeStr(meta?.entryMethod || d?.attrs?.entryMethod).toLowerCase();
    return entryMethod === "nfc";
  });

  const buyerNear = safeBool(args.proximity?.attrs?.near, false);
  const distanceHint = safeStr(args.proximity?.attrs?.distanceHint).toLowerCase();
  const remoteLike = distanceHint.includes("remote") || distanceHint.includes("far");

  if (args.creditEnabled && args.hasCreditPlan && (args.trustScore == null || args.trustScore >= 0.5)) {
    return {
      recommended:
        hasMethod("credit") ||
        ({
          channel: "credit",
          label: "Crédito sugerido",
          meta: { reason: "credit.plan.and.trust" },
        } satisfies PaymentMethod),
      reason: "credit.plan.and.trust",
    };
  }

  if (qrDetected) {
    return {
      recommended:
        hasMethod("qr") ||
        ({
          channel: "qr",
          label: "QR recomendado",
          meta: { reason: "presence.qr.detected" },
        } satisfies PaymentMethod),
      reason: "presence.qr.detected",
    };
  }

  if (nfcDetected) {
    return {
      recommended:
        hasMethod("card") ||
        ({
          channel: "card",
          label: "Tarjeta / tap",
          meta: { reason: "presence.nfc.detected" },
        } satisfies PaymentMethod),
      reason: "presence.nfc.detected",
    };
  }

  if (buyerNear && args.activeCajeroOnline) {
    return {
      recommended:
        hasMethod("cash") ||
        ({
          channel: "cash",
          label: "Pagar en caja",
          meta: { reason: "buyer.near.cajero.online" },
        } satisfies PaymentMethod),
      reason: "buyer.near.cajero.online",
    };
  }

  if (remoteLike) {
    return {
      recommended:
        hasMethod("transfer") ||
        hasMethod("link") ||
        ({
          channel: "transfer",
          label: "Transferencia sugerida",
          meta: { reason: "remote.payment" },
        } satisfies PaymentMethod),
      reason: "remote.payment",
    };
  }

  return {
    recommended:
      hasMethod("transfer") ||
      hasMethod("link") ||
      hasMethod("cash") ||
      hasMethod("qr") ||
      allMethods[0] ||
      ({
        channel: "transfer",
        label: "Transferencia sugerida",
        meta: { reason: "fallback.transfer" },
      } satisfies PaymentMethod),
    reason: "fallback.transfer",
  };
}

function buildAlternatives(args: {
  offerMethods: PaymentMethod[];
  mandateMethods: PaymentMethod[];
  includeCredit: boolean;
}) {
  const out = uniqMethods([...args.offerMethods, ...args.mandateMethods]);

  if (args.includeCredit) {
    out.unshift({
      channel: "credit",
      label: "Compra a crédito",
      meta: { reason: "credit.available" },
    });
  }

  if (!out.length) {
    out.push({ channel: "transfer", label: "Transferencia" });
    out.push({ channel: "cash", label: "Efectivo" });
  }

  return uniqMethods(out);
}

export type ChargeScheduler = {
  stop: () => void;
  tick: () => Promise<void>;
};

export function startChargeScheduler(opts: {
  sellerId: string;
  sellerName?: string | null;
  ns?: string;
  everyMs?: number;
  autoPropose?: boolean;
  proposalExpiresMs?: number;
  presenceMaxAgeMs?: number;
  proximityMaxAgeMs?: number;
  activeCajero?: {
    id?: string | null;
    nombre?: string | null;
    online?: boolean | null;
    negotiator?: boolean | null;
    creditEnabled?: boolean | null;
    trustScore?: number | null;
  } | null;
}) : ChargeScheduler {
  const ns = opts.ns ?? "mt:market";
  const everyMs = opts.everyMs ?? 60_000;
  const autoPropose = opts.autoPropose ?? true;
  const proposalExpiresMs = opts.proposalExpiresMs ?? 1000 * 60 * 10;
  const presenceMaxAgeMs = opts.presenceMaxAgeMs ?? 1000 * 60 * 3;
  const proximityMaxAgeMs = opts.proximityMaxAgeMs ?? 1000 * 60 * 5;

  let latest: AnyDV[] = [];
  const unsub = mtLiveSubscribe((xs: AnyDV[]) => {
    latest = Array.isArray(xs) ? xs : [];
  });

  let timer: any = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;

    const now = Date.now();
    const all = latest;

    const mandates = all
      .filter(isMandate)
      .filter((m: AnyDV) => safeStr(m?.attrs?.sellerId) === safeStr(opts.sellerId))
      .filter((m: AnyDV) => safeBool(m?.attrs?.active, true));

    if (!mandates.length) return;

    const dueLikeEvents = all.filter(
      (d: AnyDV) => isDue(d) || isCharge(d) || isOutcome(d) || isProposal(d)
    );

    for (const m of mandates) {
      const mandateId = safeStr(m?.id);
      const buyerId = safeStr(m?.attrs?.buyerId);
      const buyerName = resolveBuyerName(m);
      const sellerName = resolveSellerName(m, opts.sellerName ?? null);
      const amountMax = safeNum(m?.attrs?.amountMax, 0);
      const currency = safeStr(m?.attrs?.currency || "PYG");

      const interval = safeStr(m?.attrs?.interval || "monthly");
      const every = Math.max(1, safeNum(m?.attrs?.every, 1));

      const threadId = resolveMandateThreadId(m);
      const orderId = resolveMandateOrderId(m);

      if (!mandateId || !buyerId || amountMax <= 0) continue;

      const windowStart = cycleWindowStart(now, interval, every);
      const alreadyTriggered = hasRecentForMandate({
        events: dueLikeEvents,
        mandateId,
        windowStart,
      });

      if (alreadyTriggered) continue;

      const dueTs = new Date(now).toISOString();

      await emitPaymentDue({
        mandateId,
        sellerId: safeStr(opts.sellerId),
        sellerName,
        buyerId,
        buyerName: buyerName ?? undefined,
        amount: amountMax,
        currency,
        dueTs,
        orderId,
        threadId,
        note: `Cobro automático (${interval} x${every})`,
        ns,
        source: "ms.scheduler.paymentDue",
      });

      if (!autoPropose) continue;

      const paymentOffer = findLatestPaymentOffer(all, safeStr(opts.sellerId), orderId);
      const offerMethods = paymentOffer ? resolveAcceptedMethodsFromOffer(paymentOffer) : [];
      const mandateMethods = resolveAcceptedMethodsFromMandate(m);

      const presenceSignals = resolveThreadPresence(all, {
        sellerId: safeStr(opts.sellerId),
        buyerId,
        threadId,
        orderId,
        maxAgeMs: presenceMaxAgeMs,
      });

      const proximity = resolveLatestProximity(all, {
        sellerId: safeStr(opts.sellerId),
        buyerId,
        mandateId,
        threadId,
        orderId,
        maxAgeMs: proximityMaxAgeMs,
      });

      const creditPlan = findCreditPlanForMandate(all, m);

      const mandateTrustScore =
        m?.attrs?.trustRequired != null
          ? safeNum(m?.attrs?.trustRequired, 0)
          : null;

      const activeCajeroOnline = safeBool(
        opts.activeCajero?.online ??
          m?.attrs?.cajeroOnline ??
          paymentOffer?.meta?.cajeroOnline,
        !!opts.activeCajero?.id
      );

      const creditEnabled = safeBool(
        opts.activeCajero?.creditEnabled ??
          paymentOffer?.attrs?.creditEnabled ??
          m?.attrs?.creditEnabled,
        false
      );

      const trustScore =
        opts.activeCajero?.trustScore != null
          ? safeNum(opts.activeCajero?.trustScore, 0)
          : mandateTrustScore;

      const { recommended, reason } = chooseRecommendedMethod({
        offerMethods,
        mandateMethods,
        presenceSignals,
        proximity,
        hasCreditPlan: !!creditPlan,
        trustScore,
        creditEnabled,
        activeCajeroOnline,
      });

      const alternatives = buildAlternatives({
        offerMethods,
        mandateMethods,
        includeCredit: !!creditPlan && creditEnabled,
      });

      const expiresAt = new Date(now + proposalExpiresMs).toISOString();

      const noteParts = [
        `Propuesta automática de cobro (${interval} x${every})`,
        reason ? `reason=${reason}` : "",
        proximity?.attrs?.near ? "buyerNear=true" : "",
        presenceSignals.length ? `presence=${presenceSignals.length}` : "",
        opts.activeCajero?.id ? `cajero=${safeStr(opts.activeCajero.id)}` : "",
      ].filter(Boolean);

      await emitPaymentProposal({
        sellerId: safeStr(opts.sellerId),
        sellerName,
        buyerId,
        buyerName: buyerName ?? undefined,
        orderId,
        mandateId,
        threadId,
        recommended,
        alternatives,
        amount: amountMax,
        currency,
        reason,
        expiresAt,
        note: noteParts.join(" · "),
        ns,
        source: "ms.scheduler.paymentProposal.contextual",
      });
    }
  };

  timer = setInterval(() => void tick(), everyMs);
  setTimeout(() => void tick(), 1500);

  return {
    stop: () => {
      stopped = true;
      try {
        clearInterval(timer);
      } catch {}
      try {
        unsub?.();
      } catch {}
    },
    tick,
  };
}
