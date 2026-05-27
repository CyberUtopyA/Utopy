// src/mt/mt.paymentIntent.ts
import { spore } from "../utopy/spore.singleton";
import { mtLiveUpsert } from "./mt.liveStore";

export type PaymentChannel =
  | "transfer"
  | "qr"
  | "cash"
  | "crypto"
  | "card"
  | "link"
  | "credit"
  | "debit"
  | "installments"
  | "any"
  | string;

export type PaymentMethod = {
  channel: PaymentChannel;
  label?: string;
  address?: string | null;
  link?: string | null;
  qr?: string | null;
  meta?: Record<string, any>;
};

export type PaymentOfferDV = {
  id: string;
  kind: "payment.offer";
  traits: string[];
  attrs: {
    orderId?: string | null;
    ns?: string | null;
    sellerId: string;
    sellerName?: string | null;

    scope: "seller" | "order";
    threadId?: string | null;

    accepted: PaymentMethod[];
    text?: string | null;
    currency?: string | null;
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
  };
};

export type PaymentProofDV = {
  id: string;
  kind: "payment.proof";
  traits: string[];
  attrs: {
    orderId: string;
    threadId?: string | null;
    buyerId: string;
    buyerName?: string | null;
    proof: { type: "text" | "link" | "image" | string; value: string };
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentAcceptDV = {
  id: string;
  kind: "payment.accept";
  traits: string[];
  attrs: {
    orderId: string;
    threadId?: string | null;
    ok: boolean;
    note?: string | null;
    chosen?: PaymentMethod | null;
    amount?: number | null;
    currency?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentDueDV = {
  id: string;
  kind: "payment.due";
  traits: string[];
  attrs: {
    mandateId: string;
    sellerId: string;
    sellerName?: string | null;
    buyerId: string;
    buyerName?: string | null;
    amount: number;
    currency?: string | null;
    dueTs: string;
    orderId?: string | null;
    threadId?: string | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentProposalDV = {
  id: string;
  kind: "payment.proposal";
  traits: string[];
  attrs: {
    sellerId: string;
    sellerName?: string | null;
    buyerId: string;
    buyerName?: string | null;
    orderId?: string | null;
    mandateId?: string | null;
    threadId?: string | null;

    recommended?: PaymentMethod | null;
    alternatives: PaymentMethod[];

    amount?: number | null;
    currency?: string | null;

    reason?: string | null;
    expiresAt?: string | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentProximityDV = {
  id: string;
  kind: "payment.proximity";
  traits: string[];
  attrs: {
    sellerId: string;
    sellerName?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    cajeroId?: string | null;
    cajeroName?: string | null;

    orderId?: string | null;
    mandateId?: string | null;
    threadId?: string | null;

    near: boolean;
    confidence?: number | null;
    distanceHint?: string | null;
    sourceHint?: string | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentOutcomeDV = {
  id: string;
  kind: "payment.outcome";
  traits: string[];
  attrs: {
    orderId: string;
    threadId?: string | null;
    status: "paid" | "rejected" | "pending_review" | "scheduled" | "cancelled";
    acceptedBy?: string | null;
    acceptedByName?: string | null;

    chosen?: PaymentMethod | null;
    amount?: number | null;
    currency?: string | null;

    note?: string | null;
    proofId?: string | null;
    acceptId?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

function safeArr<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function safeNum(x: any, fb = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fb;
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

function normalizeMethods(xs: any): PaymentMethod[] {
  return safeArr<any>(xs).map(normalizeMethod).filter(Boolean) as PaymentMethod[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

async function publishDV(args: {
  dv: any;
  say?: string;
  sym?: string;
  extra?: Record<string, any>;
}) {
  const { dv, say = dv?.kind || "dato.upsert", sym = "🧬", extra } = args;

  try {
    mtLiveUpsert(dv as any);
  } catch {}

  try {
    await spore?.sayIntent({
      sym: "🧬",
      say: "dato.upsert",
      with: { dv },
    });
  } catch {}

  try {
    await spore?.sayIntent({
      sym,
      say,
      with: { dv, ...(extra || {}) },
    });
  } catch {}

  return dv;
}

/**
 * Oferta de pago viva del vendedor/cajero.
 * - scope "seller": lo que acepta en general el vendedor
 * - scope "order": oferta específica para un pedido
 */
export async function emitPaymentOffer(args: {
  sellerId: string;
  sellerName?: string | null;
  accepted: PaymentMethod[];
  text?: string | null;
  currency?: string | null;

  scope?: "seller" | "order";
  orderId?: string | null;
  threadId?: string | null;

  ns?: string;
  source?: string;
}) {
  const ns = args.ns || "mt:market";

  const dv: PaymentOfferDV = {
    id: `payment.offer:${args.sellerId}:${Date.now()}`,
    kind: "payment.offer",
    traits: ["mt:payment.offer", "mt:market"],
    attrs: {
      sellerId: args.sellerId,
      sellerName: args.sellerName ?? null,
      currency: args.currency || "PYG",
      text: args.text || "",
      accepted: normalizeMethods(args.accepted),
      scope: args.scope || "seller",
      orderId: args.orderId ?? null,
      threadId: args.threadId ?? null,
      ns,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: args.sellerId,
      source: args.source || "ms.payment.offer",
    },
  };

  return publishDV({
    dv,
    say: "payment.offer",
    sym: "💳",
    extra: { offer: dv },
  });
}

/**
 * El comprador manda comprobante.
 */
export async function emitPaymentProof(params: {
  orderId: string;
  buyerId: string;
  buyerName?: string;
  proof: { type?: string; value: string };
  note?: string;
  threadId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentProofDV = {
    id: `payment.proof:${params.orderId}:${uid()}`,
    kind: "payment.proof",
    traits: ["mt:payment.proof", "mt:market"],
    attrs: {
      orderId: params.orderId,
      threadId: params.threadId ?? null,
      buyerId: params.buyerId,
      buyerName: params.buyerName ?? null,
      proof: {
        type: params.proof?.type || "text",
        value: safeStr(params.proof?.value),
      },
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.buyerId,
      source: params.source ?? "ms.web.buyer",
    },
  };

  return publishDV({
    dv,
    say: "payment.proof",
    sym: "🧾",
  });
}

/**
 * Vendedor/cajero acepta o rechaza.
 */
export async function emitPaymentAccept(params: {
  orderId: string;
  actorId: string;
  actorName?: string;
  ok: boolean;
  note?: string;

  chosen?: PaymentMethod | null;
  amount?: number | null;
  currency?: string | null;
  threadId?: string;

  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentAcceptDV = {
    id: `payment.accept:${params.orderId}:${uid()}`,
    kind: "payment.accept",
    traits: ["mt:payment.accept", "mt:market", params.ok ? "mt:ok" : "mt:nok"],
    attrs: {
      orderId: params.orderId,
      threadId: params.threadId ?? null,
      ok: !!params.ok,
      note: params.note ?? null,
      chosen: params.chosen ? normalizeMethod(params.chosen) : null,
      amount: params.amount ?? null,
      currency: params.currency ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.actorId,
      source: params.source ?? "ms.web.cajero",
    },
  };

  return publishDV({
    dv,
    say: "payment.accept",
    sym: params.ok ? "✅" : "⚠️",
  });
}

/**
 * El scheduler / cajero detecta que ya toca intentar cobrar.
 * Esto NO es todavía el cobro final.
 */
export async function emitPaymentDue(params: {
  mandateId: string;
  sellerId: string;
  sellerName?: string | null;
  buyerId: string;
  buyerName?: string | null;
  amount: number;
  currency?: string | null;
  dueTs?: string;
  orderId?: string | null;
  threadId?: string | null;
  note?: string | null;
  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentDueDV = {
    id: `payment.due:${params.mandateId}:${uid()}`,
    kind: "payment.due",
    traits: ["mt:payment.due", "mt:market"],
    attrs: {
      mandateId: params.mandateId,
      sellerId: params.sellerId,
      sellerName: params.sellerName ?? null,
      buyerId: params.buyerId,
      buyerName: params.buyerName ?? null,
      amount: safeNum(params.amount, 0),
      currency: params.currency ?? "PYG",
      dueTs: params.dueTs ?? new Date().toISOString(),
      orderId: params.orderId ?? null,
      threadId: params.threadId ?? null,
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.sellerId,
      source: params.source ?? "ms.scheduler.paymentDue",
    },
  };

  return publishDV({
    dv,
    say: "payment.due",
    sym: "⏰",
  });
}

/**
 * El sistema/cajero propone cómo conviene cobrar:
 * QR, cash, card, crédito, link, etc.
 */
export async function emitPaymentProposal(params: {
  sellerId: string;
  sellerName?: string | null;
  buyerId: string;
  buyerName?: string | null;

  orderId?: string | null;
  mandateId?: string | null;
  threadId?: string | null;

  recommended?: PaymentMethod | null;
  alternatives?: PaymentMethod[];

  amount?: number | null;
  currency?: string | null;

  reason?: string | null;
  expiresAt?: string | null;
  note?: string | null;

  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const recommended = params.recommended
    ? normalizeMethod(params.recommended)
    : null;

  const alternatives = normalizeMethods(params.alternatives ?? []);

  const dv: PaymentProposalDV = {
    id: `payment.proposal:${params.sellerId}:${params.buyerId}:${uid()}`,
    kind: "payment.proposal",
    traits: ["mt:payment.proposal", "mt:market"],
    attrs: {
      sellerId: params.sellerId,
      sellerName: params.sellerName ?? null,
      buyerId: params.buyerId,
      buyerName: params.buyerName ?? null,
      orderId: params.orderId ?? null,
      mandateId: params.mandateId ?? null,
      threadId: params.threadId ?? null,
      recommended,
      alternatives,
      amount: params.amount ?? null,
      currency: params.currency ?? "PYG",
      reason: params.reason ?? null,
      expiresAt: params.expiresAt ?? null,
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.sellerId,
      source: params.source ?? "ms.payment.negotiator",
    },
  };

  return publishDV({
    dv,
    say: "payment.proposal",
    sym: "🤝",
  });
}

/**
 * Señal contextual desde presence/proximity.
 * Sirve para que el sistema sepa que el buyer/cajero están cerca.
 */
export async function emitPaymentProximity(params: {
  sellerId: string;
  sellerName?: string | null;
  buyerId?: string | null;
  buyerName?: string | null;
  cajeroId?: string | null;
  cajeroName?: string | null;

  orderId?: string | null;
  mandateId?: string | null;
  threadId?: string | null;

  near: boolean;
  confidence?: number | null;
  distanceHint?: string | null;
  sourceHint?: string | null;
  note?: string | null;

  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentProximityDV = {
    id: `payment.proximity:${params.sellerId}:${params.buyerId || "anon"}:${uid()}`,
    kind: "payment.proximity",
    traits: [
      "mt:payment.proximity",
      "mt:market",
      params.near ? "mt:near" : "mt:far",
    ],
    attrs: {
      sellerId: params.sellerId,
      sellerName: params.sellerName ?? null,
      buyerId: params.buyerId ?? null,
      buyerName: params.buyerName ?? null,
      cajeroId: params.cajeroId ?? null,
      cajeroName: params.cajeroName ?? null,
      orderId: params.orderId ?? null,
      mandateId: params.mandateId ?? null,
      threadId: params.threadId ?? null,
      near: !!params.near,
      confidence: params.confidence ?? null,
      distanceHint: params.distanceHint ?? null,
      sourceHint: params.sourceHint ?? null,
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.cajeroId ?? params.sellerId,
      source: params.source ?? "utopy.presence.payment",
    },
  };

  return publishDV({
    dv,
    say: "payment.proximity",
    sym: params.near ? "📍" : "🌫️",
  });
}

/**
 * Consolidado final del flujo de pago para que otros nodos no tengan
 * que reconstruir el estado leyendo muchos DVs sueltos.
 */
export async function emitPaymentOutcome(params: {
  orderId: string;
  threadId?: string | null;
  status: "paid" | "rejected" | "pending_review" | "scheduled" | "cancelled";

  actorId: string;
  actorName?: string | null;

  chosen?: PaymentMethod | null;
  amount?: number | null;
  currency?: string | null;

  note?: string | null;
  proofId?: string | null;
  acceptId?: string | null;

  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentOutcomeDV = {
    id: `payment.outcome:${params.orderId}:${uid()}`,
    kind: "payment.outcome",
    traits: [
      "mt:payment.outcome",
      "mt:market",
      `mt:${params.status}`,
    ],
    attrs: {
      orderId: params.orderId,
      threadId: params.threadId ?? null,
      status: params.status,
      acceptedBy: params.actorId,
      acceptedByName: params.actorName ?? null,
      chosen: params.chosen ? normalizeMethod(params.chosen) : null,
      amount: params.amount ?? null,
      currency: params.currency ?? null,
      note: params.note ?? null,
      proofId: params.proofId ?? null,
      acceptId: params.acceptId ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.actorId,
      source: params.source ?? "ms.payment.outcome",
    },
  };

  return publishDV({
    dv,
    say: "payment.outcome",
    sym:
      params.status === "paid"
        ? "🟢"
        : params.status === "pending_review"
        ? "🟡"
        : params.status === "scheduled"
        ? "🕒"
        : params.status === "cancelled"
        ? "⚫"
        : "🔴",
  });
}