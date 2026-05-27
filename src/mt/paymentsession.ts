// src/mt/mt.paymentSession.ts
import { spore } from "../utopy/spore.singleton";
import { mtLiveUpsert } from "./mt.liveStore";
import type { PaymentMethod } from "./mt.intentpayment";

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

export type PaymentSessionOpenDV = {
  id: string;
  kind: "payment.session.open";
  traits: string[];
  attrs: {
    sessionId: string;
    orderId?: string | null;
    threadId?: string | null;
    sellerId: string;
    sellerName?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    amount?: number | null;
    currency?: string | null;
    suggested?: PaymentMethod | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentSessionStatusDV = {
  id: string;
  kind: "payment.session.status";
  traits: string[];
  attrs: {
    sessionId: string;
    orderId?: string | null;
    threadId?: string | null;
    sellerId: string;
    buyerId?: string | null;
    status:
      | "open"
      | "waiting_proof"
      | "queued"
      | "assigned"
      | "pending_review"
      | "paid"
      | "rejected"
      | "expired";
    assignedCajeroId?: string | null;
    assignedCajeroName?: string | null;
    chosen?: PaymentMethod | null;
    amount?: number | null;
    currency?: string | null;
    reason?: string | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export async function emitPaymentSessionOpen(params: {
  sessionId?: string;
  orderId?: string | null;
  threadId?: string | null;
  sellerId: string;
  sellerName?: string | null;
  buyerId?: string | null;
  buyerName?: string | null;
  amount?: number | null;
  currency?: string | null;
  suggested?: PaymentMethod | null;
  note?: string | null;
  ns?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";
  const sessionId = params.sessionId ?? `payment.session:${uid()}`;

  const dv: PaymentSessionOpenDV = {
    id: `payment.session.open:${sessionId}`,
    kind: "payment.session.open",
    traits: ["mt:payment.session", "mt:market", "mt:open"],
    attrs: {
      sessionId,
      orderId: params.orderId ?? null,
      threadId: params.threadId ?? null,
      sellerId: params.sellerId,
      sellerName: params.sellerName ?? null,
      buyerId: params.buyerId ?? null,
      buyerName: params.buyerName ?? null,
      amount: params.amount ?? null,
      currency: params.currency ?? "PYG",
      suggested: params.suggested ?? null,
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.buyerId || params.sellerId,
      source: params.source ?? "ms.payment.session.open",
    },
  };

  return publishDV({
    dv,
    say: "payment.session.open",
    sym: "🪪",
  });
}

export async function emitPaymentSessionStatus(params: {
  sessionId: string;
  orderId?: string | null;
  threadId?: string | null;
  sellerId: string;
  buyerId?: string | null;
  status:
    | "open"
    | "waiting_proof"
    | "queued"
    | "assigned"
    | "pending_review"
    | "paid"
    | "rejected"
    | "expired";
  assignedCajeroId?: string | null;
  assignedCajeroName?: string | null;
  chosen?: PaymentMethod | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  note?: string | null;
  ns?: string;
  actorId?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: PaymentSessionStatusDV = {
    id: `payment.session.status:${params.sessionId}:${uid()}`,
    kind: "payment.session.status",
    traits: ["mt:payment.session", "mt:market", `mt:${params.status}`],
    attrs: {
      sessionId: params.sessionId,
      orderId: params.orderId ?? null,
      threadId: params.threadId ?? null,
      sellerId: params.sellerId,
      buyerId: params.buyerId ?? null,
      status: params.status,
      assignedCajeroId: params.assignedCajeroId ?? null,
      assignedCajeroName: params.assignedCajeroName ?? null,
      chosen: params.chosen ?? null,
      amount: params.amount ?? null,
      currency: params.currency ?? null,
      reason: params.reason ?? null,
      note: params.note ?? null,
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.actorId ?? params.sellerId,
      source: params.source ?? "ms.payment.session.status",
    },
  };

  return publishDV({
    dv,
    say: "payment.session.status",
    sym:
      params.status === "paid"
        ? "🟢"
        : params.status === "pending_review"
        ? "🟡"
        : params.status === "rejected"
        ? "🔴"
        : params.status === "assigned"
        ? "🧑‍💼"
        : params.status === "queued"
        ? "📥"
        : params.status === "expired"
        ? "⌛"
        : "🔵",
  });
}