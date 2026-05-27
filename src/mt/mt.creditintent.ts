import { spore } from "../utopy/spore.singleton";
import { mtLiveUpsert } from "./mt.liveStore";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const nowIso = () => new Date().toISOString();

export type CreditInterval = "monthly" | "weekly" | "daily";
export type CreditGuaranteeMode =
  | "downpayment"
  | "retained_title"
  | "guarantor"
  | "none";

export type CreditPlanDV = {
  id: string;
  kind: "credit.plan";
  traits: string[];
  attrs: {
    sellerId: string;
    sellerName?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    orderId?: string | null;
    productId?: string | null;
    threadId?: string | null;

    currency: string;
    principal: number;
    downPaymentMin: number;
    financedAmount: number;

    installmentCount: number;
    installmentValue: number;
    interval: CreditInterval;
    every: number;
    firstDueAt?: string | null;

    lateFeeFlat?: number | null;
    lateFeePct?: number | null;
    trustRequired?: number | null;
    guaranteeMode?: CreditGuaranteeMode;
    note?: string | null;

    status: "offered" | "accepted" | "expired" | "cancelled";
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
    ttl_ms?: number;
  };
};

export type CreditAccountDV = {
  id: string;
  kind: "credit.account";
  traits: string[];
  attrs: {
    planId?: string | null;
    orderId?: string | null;
    sellerId: string;
    sellerName?: string | null;
    buyerId: string;
    buyerName?: string | null;
    cajeroId?: string | null;
    threadId?: string | null;

    currency: string;
    principal: number;
    downPayment: number;
    financedAmount: number;

    paidAmount: number;
    balance: number;

    installmentCount: number;
    installmentValue: number;
    interval: CreditInterval;
    every: number;
    firstDueAt?: string | null;
    nextDueAt?: string | null;

    trustSnapshot?: number | null;
    guaranteeMode?: CreditGuaranteeMode;

    status: "active" | "paid" | "overdue" | "cancelled" | "defaulted";
    openedAt: string;
    closedAt?: string | null;
    note?: string | null;
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
    pinned?: boolean;
  };
};

export type CreditInstallmentDV = {
  id: string;
  kind: "credit.installment";
  traits: string[];
  attrs: {
    accountId: string;
    planId?: string | null;
    orderId?: string | null;
    sellerId: string;
    buyerId: string;
    threadId?: string | null;

    number: number;
    dueAt: string;
    currency: string;

    amountDue: number;
    amountPaid: number;
    balance: number;

    status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
    paidAt?: string | null;
    lateFeeApplied?: number | null;
    note?: string | null;
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
  };
};

export type CreditPaymentDV = {
  id: string;
  kind: "credit.payment";
  traits: string[];
  attrs: {
    accountId: string;
    installmentId?: string | null;
    orderId?: string | null;
    sellerId: string;
    buyerId: string;
    threadId?: string | null;

    amount: number;
    currency: string;

    kind: "downpayment" | "installment" | "partial" | "prepayment" | "late_fee";

    method?: {
      channel?: string;
      label?: string;
      address?: string | null;
      link?: string | null;
      qr?: string | null;
      meta?: Record<string, any>;
    } | null;

    proofRefId?: string | null;
    acceptRefId?: string | null;
    note?: string | null;

    appliedAt: string;
    status: "pending" | "confirmed" | "rejected";
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
  };
};

export type CreditCloseDV = {
  id: string;
  kind: "credit.close";
  traits: string[];
  attrs: {
    accountId: string;
    sellerId: string;
    buyerId: string;
    orderId?: string | null;
    threadId?: string | null;

    reason: "paid" | "cancelled" | "defaulted" | "forgiven" | "refinanced";
    finalPaidAmount: number;
    finalBalance: number;
    closedAt: string;
    note?: string | null;
  };
  meta: {
    ns: string;
    ts: string;
    actor?: string;
    source?: string;
  };
};

export async function emitCreditPlan(args: {
  sellerId: string;
  sellerName?: string | null;
  buyerId?: string | null;
  buyerName?: string | null;
  orderId?: string | null;
  productId?: string | null;
  threadId?: string | null;

  principal: number;
  downPaymentMin: number;
  installmentCount: number;
  installmentValue: number;
  interval?: CreditInterval;
  every?: number;
  currency?: string;
  firstDueAt?: string | null;

  lateFeeFlat?: number | null;
  lateFeePct?: number | null;
  trustRequired?: number | null;
  guaranteeMode?: CreditGuaranteeMode;
  note?: string | null;

  actorId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";
  const principal = Math.max(0, Number(args.principal || 0));
  const downPaymentMin = Math.max(0, Number(args.downPaymentMin || 0));
  const financedAmount = Math.max(0, principal - downPaymentMin);

  const dv: CreditPlanDV = {
    id: `credit.plan:${args.sellerId}:${uid()}`,
    kind: "credit.plan",
    traits: ["mt:credit.plan", "mt:market", "mt:finance"],
    attrs: {
      sellerId: args.sellerId,
      sellerName: args.sellerName ?? null,
      buyerId: args.buyerId ?? null,
      buyerName: args.buyerName ?? null,
      orderId: args.orderId ?? null,
      productId: args.productId ?? null,
      threadId: args.threadId ?? null,

      currency: args.currency ?? "PYG",
      principal,
      downPaymentMin,
      financedAmount,

      installmentCount: Math.max(1, Number(args.installmentCount || 1)),
      installmentValue: Math.max(0, Number(args.installmentValue || 0)),
      interval: args.interval ?? "monthly",
      every: Math.max(1, Number(args.every || 1)),
      firstDueAt: args.firstDueAt ?? null,

      lateFeeFlat: args.lateFeeFlat ?? null,
      lateFeePct: args.lateFeePct ?? null,
      trustRequired: args.trustRequired ?? null,
      guaranteeMode: args.guaranteeMode ?? "downpayment",
      note: args.note ?? null,

      status: "offered",
    },
    meta: {
      ns,
      ts: nowIso(),
      actor: args.actorId ?? args.sellerId,
      source: args.source ?? "ms.credit.plan",
      ttl_ms: 1000 * 60 * 60 * 24 * 30,
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({ sym: "💳", say: "dato.upsert", with: { dv } });
  } catch {}

  try {
    await spore?.sayIntent({ sym: "🪙", say: "credit.plan", with: { dv } });
  } catch {}

  return dv;
}

export async function emitCreditAccount(args: {
  planId?: string | null;
  orderId?: string | null;
  sellerId: string;
  sellerName?: string | null;
  buyerId: string;
  buyerName?: string | null;
  cajeroId?: string | null;
  threadId?: string | null;

  principal: number;
  downPayment: number;
  financedAmount: number;
  installmentCount: number;
  installmentValue: number;
  interval?: CreditInterval;
  every?: number;
  firstDueAt?: string | null;
  nextDueAt?: string | null;
  trustSnapshot?: number | null;
  guaranteeMode?: CreditGuaranteeMode;
  currency?: string;
  note?: string | null;

  actorId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: CreditAccountDV = {
    id: `credit.account:${args.buyerId}:${uid()}`,
    kind: "credit.account",
    traits: ["mt:credit.account", "mt:market", "mt:finance", "mt:open"],
    attrs: {
      planId: args.planId ?? null,
      orderId: args.orderId ?? null,
      sellerId: args.sellerId,
      sellerName: args.sellerName ?? null,
      buyerId: args.buyerId,
      buyerName: args.buyerName ?? null,
      cajeroId: args.cajeroId ?? null,
      threadId: args.threadId ?? null,

      currency: args.currency ?? "PYG",
      principal: Math.max(0, Number(args.principal || 0)),
      downPayment: Math.max(0, Number(args.downPayment || 0)),
      financedAmount: Math.max(0, Number(args.financedAmount || 0)),

      paidAmount: Math.max(0, Number(args.downPayment || 0)),
      balance: Math.max(0, Number(args.financedAmount || 0)),

      installmentCount: Math.max(1, Number(args.installmentCount || 1)),
      installmentValue: Math.max(0, Number(args.installmentValue || 0)),
      interval: args.interval ?? "monthly",
      every: Math.max(1, Number(args.every || 1)),
      firstDueAt: args.firstDueAt ?? null,
      nextDueAt: args.nextDueAt ?? args.firstDueAt ?? null,

      trustSnapshot: args.trustSnapshot ?? null,
      guaranteeMode: args.guaranteeMode ?? "downpayment",

      status: "active",
      openedAt: nowIso(),
      closedAt: null,
      note: args.note ?? null,
    },
    meta: {
      ns,
      ts: nowIso(),
      actor: args.actorId ?? args.sellerId,
      source: args.source ?? "ms.credit.account",
      pinned: true,
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({ sym: "💳", say: "dato.upsert", with: { dv } });
  } catch {}

  try {
    await spore?.sayIntent({ sym: "📒", say: "credit.account.open", with: { dv } });
  } catch {}

  return dv;
}

export async function emitCreditInstallment(args: {
  accountId: string;
  planId?: string | null;
  orderId?: string | null;
  sellerId: string;
  buyerId: string;
  threadId?: string | null;

  number: number;
  dueAt: string;
  amountDue: number;
  currency?: string;
  note?: string | null;

  actorId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: CreditInstallmentDV = {
    id: `credit.installment:${args.accountId}:${args.number}`,
    kind: "credit.installment",
    traits: ["mt:credit.installment", "mt:market", "mt:finance", "mt:pending"],
    attrs: {
      accountId: args.accountId,
      planId: args.planId ?? null,
      orderId: args.orderId ?? null,
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      threadId: args.threadId ?? null,

      number: Math.max(1, Number(args.number || 1)),
      dueAt: args.dueAt,
      currency: args.currency ?? "PYG",

      amountDue: Math.max(0, Number(args.amountDue || 0)),
      amountPaid: 0,
      balance: Math.max(0, Number(args.amountDue || 0)),

      status: "pending",
      paidAt: null,
      lateFeeApplied: null,
      note: args.note ?? null,
    },
    meta: {
      ns,
      ts: nowIso(),
      actor: args.actorId ?? args.sellerId,
      source: args.source ?? "ms.credit.installment",
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({ sym: "💳", say: "dato.upsert", with: { dv } });
  } catch {}

  return dv;
}

export async function emitCreditPayment(args: {
  accountId: string;
  installmentId?: string | null;
  orderId?: string | null;
  sellerId: string;
  buyerId: string;
  threadId?: string | null;

  amount: number;
  currency?: string;
  kind?: "downpayment" | "installment" | "partial" | "prepayment" | "late_fee";
  method?: {
    channel?: string;
    label?: string;
    address?: string | null;
    link?: string | null;
    qr?: string | null;
    meta?: Record<string, any>;
  } | null;

  proofRefId?: string | null;
  acceptRefId?: string | null;
  note?: string | null;

  actorId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: CreditPaymentDV = {
    id: `credit.payment:${args.accountId}:${uid()}`,
    kind: "credit.payment",
    traits: ["mt:credit.payment", "mt:market", "mt:finance"],
    attrs: {
      accountId: args.accountId,
      installmentId: args.installmentId ?? null,
      orderId: args.orderId ?? null,
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      threadId: args.threadId ?? null,

      amount: Math.max(0, Number(args.amount || 0)),
      currency: args.currency ?? "PYG",
      kind: args.kind ?? "installment",

      method: args.method ?? null,
      proofRefId: args.proofRefId ?? null,
      acceptRefId: args.acceptRefId ?? null,
      note: args.note ?? null,

      appliedAt: nowIso(),
      status: "pending",
    },
    meta: {
      ns,
      ts: nowIso(),
      actor: args.actorId ?? args.buyerId,
      source: args.source ?? "ms.credit.payment",
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({ sym: "💳", say: "dato.upsert", with: { dv } });
  } catch {}

  return dv;
}

export async function emitCreditClose(args: {
  accountId: string;
  sellerId: string;
  buyerId: string;
  orderId?: string | null;
  threadId?: string | null;
  reason: "paid" | "cancelled" | "defaulted" | "forgiven" | "refinanced";
  finalPaidAmount: number;
  finalBalance: number;
  note?: string | null;

  actorId?: string;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: CreditCloseDV = {
    id: `credit.close:${args.accountId}:${uid()}`,
    kind: "credit.close",
    traits: ["mt:credit.close", "mt:market", "mt:finance"],
    attrs: {
      accountId: args.accountId,
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      orderId: args.orderId ?? null,
      threadId: args.threadId ?? null,
      reason: args.reason,
      finalPaidAmount: Math.max(0, Number(args.finalPaidAmount || 0)),
      finalBalance: Math.max(0, Number(args.finalBalance || 0)),
      closedAt: nowIso(),
      note: args.note ?? null,
    },
    meta: {
      ns,
      ts: nowIso(),
      actor: args.actorId ?? args.sellerId,
      source: args.source ?? "ms.credit.close",
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({ sym: "💳", say: "dato.upsert", with: { dv } });
  } catch {}

  try {
    await spore?.sayIntent({ sym: "✅", say: "credit.close", with: { dv } });
  } catch {}

  return dv;
}