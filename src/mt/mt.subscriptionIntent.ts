// src/mt/mt.subscriptionIntent.ts
// Recurrencia y pago automático son contratos separados sobre los mismos DVs.
// Contratos de pago heredados compatibles:
// - payment.plan.offer
// - payment.mandate
// - payment.charge
// - payment.charge.accept

import { spore } from "../utopy/spore.singleton";
import type { PaymentMethod } from "./mt.intentpayment";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

type AnyDV = any;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function unique(values: any[]) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

export type SubscriptionEventKind =
  | "subscription.proposal"
  | "subscription.accepted"
  | "subscription.active"
  | "subscription.paused"
  | "subscription.cancelled";

export type SubscriptionRelationInput = {
  relationshipId?: string | null;
  threadId: string;
  chainId?: string | null;
  rootDvId?: string | null;
  parentDvId?: string | null;
  subscriptionId?: string | null;
  orderId?: string | null;
  actorId: string;
  actorName?: string | null;
  participants?: string[];
};

function relationAttrs(input: SubscriptionRelationInput) {
  const threadId = safeStr(input.threadId);
  const chainId = safeStr(input.chainId) || threadId;
  return {
    relationshipId: input.relationshipId || null,
    threadId,
    chainId,
    rootDvId: input.rootDvId || null,
    parentDvId: input.parentDvId || null,
    subscriptionId: input.subscriptionId || null,
    orderId: input.orderId || null,
    actorId: input.actorId,
    actorName: input.actorName || null,
    fromActorId: input.actorId,
    fromActorName: input.actorName || null,
    participants: unique([...(input.participants || []), input.actorId]),
    relation: {
      relationshipId: input.relationshipId || null,
      threadId,
      chainId,
      rootDvId: input.rootDvId || null,
      parentDvId: input.parentDvId || null,
    },
  };
}

export function buildSubscriptionEventDV(
  kind: SubscriptionEventKind,
  input: SubscriptionRelationInput & {
    title?: string | null;
    frequency?: string | null;
    every?: number | null;
    nextOccurrence?: string | null;
    attrs?: Record<string, any>;
    authority?: string | null;
  },
) {
  const status = kind.replace("subscription.", "");
  const ts = new Date().toISOString();
  const subscriptionId =
    input.subscriptionId || `subscription:${safeStr(input.threadId)}`;
  return {
    id: `${kind}:${subscriptionId}:${uid()}`,
    kind,
    attrs: {
      ...relationAttrs({ ...input, subscriptionId }),
      title: input.title || null,
      frequency: input.frequency || null,
      every: input.every || 1,
      nextOccurrence: input.nextOccurrence || null,
      status,
      ...(input.attrs || {}),
    },
    traits: ["mt:subscription", "utopy:chain", `subscription:${status}`],
    meta: {
      ns: "mt:market",
      ts,
      threadId: input.threadId,
      relationshipId: input.relationshipId || null,
      chainId: input.chainId || input.threadId,
      rootDvId: input.rootDvId || null,
      parentDvId: input.parentDvId || null,
      scopes: ["participants"],
      schema: "utopy.subscription.event@1",
      authority: input.authority || input.actorId,
      source: "ms.subscription.protocol",
    },
  };
}

function buildAutopayRequestDV(
  kind:
    | "payment.autopay.authorization.request"
    | "payment.autopay.revoke.request",
  input: SubscriptionRelationInput & {
    authorizationId?: string | null;
    sellerId?: string | null;
    buyerId?: string | null;
    amountMax?: number | null;
    currency?: string | null;
    interval?: PlanInterval | null;
    every?: number | null;
    chosen?: PaymentMethod | null;
    reason?: string | null;
  },
) {
  const ts = new Date().toISOString();
  return {
    id: `${kind}:${uid()}`,
    kind,
    attrs: {
      ...relationAttrs(input),
      authorizationId: input.authorizationId || null,
      sellerId: input.sellerId || null,
      buyerId: input.buyerId || input.actorId,
      amountMax: Math.max(0, Number(input.amountMax || 0)),
      currency: input.currency || "PYG",
      interval: input.interval || null,
      every: input.every || 1,
      chosen: input.chosen || null,
      reason: input.reason || null,
      status: "requested",
      security: {
        requiresConsent: true,
        execution: "authorized-payment-node",
        automaticConfirmation: false,
      },
    },
    traits: ["mt:payment.autopay", "utopy:action.request", "consent:required"],
    meta: {
      ns: "mt:market",
      ts,
      threadId: input.threadId,
      relationshipId: input.relationshipId || null,
      chainId: input.chainId || input.threadId,
      rootDvId: input.rootDvId || null,
      parentDvId: input.parentDvId || null,
      scopes: ["participants"],
      schema: "utopy.payment.autopay.request@1",
      actor: input.actorId,
      source: "ms.autopay.request",
    },
  };
}

export function buildAutopayAuthorizationRequestDV(
  input: Parameters<typeof buildAutopayRequestDV>[1],
) {
  return buildAutopayRequestDV("payment.autopay.authorization.request", input);
}

export function buildAutopayRevokeRequestDV(
  input: Parameters<typeof buildAutopayRequestDV>[1],
) {
  return buildAutopayRequestDV("payment.autopay.revoke.request", input);
}

/** Publica el mismo DV firmado; nunca convierte requests en outcomes. */
export async function publishSubscriptionDV(
  dv: AnyDV,
  options: {
    allLive?: any[];
    activeActor?: any | null;
    actingAsNodeId?: string | null;
    targetNodeId?: string | null;
  } = {},
) {
  const result = await publishAuthorizedDV({
    dv,
    allLive: options.allLive,
    activeActor: options.activeActor,
    actingAsNodeId: options.actingAsNodeId,
    targetNodeId: options.targetNodeId,
    sensitivity: /accepted|cancelled|autopay/i.test(String(dv?.kind || ""))
      ? "sensitive"
      : "relationship",
  });
  const signed = result.dv;
  try {
    await spore?.sayIntent?.({ sym: "🧬", say: "dato.upsert", with: { dv: signed } });
  } catch {}
  try {
    await spore?.sayIntent?.({ sym: "🔐", say: dv.kind, with: signed });
  } catch {}
  return signed;
}

export type PlanInterval = "daily" | "weekly" | "monthly" | "custom";
export type PaymentPlanOfferDV = {
  id: string;
  kind: "payment.plan.offer";
  traits: string[];
  attrs: {
    sellerId: string;
    sellerName?: string | null;

    planId: string;
    label: string; // "Mensual", "Semanal", etc.
    interval: PlanInterval;
    every?: number; // ej: cada 1 mes, cada 2 semanas
    amount: number; // monto sugerido
    currency?: string | null;

    accepted?: PaymentMethod[]; // opcional: atajo (si no, se usa payment.offer)
    text?: string | null;
  };
  meta: { ns: string; ts: string; scope?: "seller"; source?: string };
};

export type PaymentMandateDV = {
  id: string;
  kind: "payment.mandate";
  traits: string[];
  attrs: {
    sellerId: string;
    sellerName?: string | null;

    buyerId: string;
    buyerName?: string | null;

    planId?: string | null;
    label?: string | null;

    interval: PlanInterval;
    every?: number;

    amountMax: number;         // máximo permitido por ciclo
    currency?: string | null;

    // método elegido (opcional)
    chosen?: PaymentMethod | null;

    // estado
    active: boolean;
    startTs?: string | null;
    endTs?: string | null;
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentChargeDV = {
  id: string;
  kind: "payment.charge";
  traits: string[];
  attrs: {
    mandateId: string;
    sellerId: string;
    buyerId: string;

    amount: number;
    currency?: string | null;

    dueTs: string; // fecha del ciclo
    note?: string | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

export type PaymentChargeAcceptDV = {
  id: string;
  kind: "payment.charge.accept";
  traits: string[];
  attrs: {
    chargeId: string;
    mandateId: string;

    ok: boolean;
    note?: string | null;

    // opcional:
    proof?: { type: string; value: string } | null;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

// -------------------------------
// Emit: Plan Offer (vendedor)
// -------------------------------
export async function emitPaymentPlanOffer(args: {
  sellerId: string;
  sellerName?: string | null;

  label: string;               // "Mensual"
  interval: PlanInterval;      // "monthly"
  every?: number;              // 1
  amount: number;
  currency?: string | null;
  text?: string | null;

  accepted?: PaymentMethod[];  // opcional
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: PaymentPlanOfferDV = {
    id: `payment.plan.offer:${args.sellerId}:${uid()}`,
    kind: "payment.plan.offer",
    traits: ["mt:payment.plan.offer", "mt:market"],
    attrs: {
      sellerId: safeStr(args.sellerId),
      sellerName: args.sellerName ?? null,

      planId: `plan:${safeStr(args.sellerId)}:${Date.now()}`,
      label: args.label,
      interval: args.interval,
      every: args.every ?? 1,
      amount: Number(args.amount),
      currency: args.currency ?? "PYG",

      accepted: Array.isArray(args.accepted) ? args.accepted : undefined,
      text: args.text ?? "",
    },
    meta: { ns, ts: new Date().toISOString(), scope: "seller", source: args.source ?? "ms.plan.offer" },
  };

  mtLiveUpsert(dv as AnyDV);

  try {
    await spore?.sayIntent?.({ sym: "🔁", say: "payment.plan.offer", with: { offer: dv } });
  } catch {}

  return dv;
}

// -------------------------------
// Emit: Mandate (comprador)
// -------------------------------
export async function emitPaymentMandate(args: {
  sellerId: string;
  sellerName?: string | null;

  buyerId: string;
  buyerName?: string | null;

  planId?: string | null;
  label?: string | null;

  interval: PlanInterval;
  every?: number;

  amountMax: number;
  currency?: string | null;

  chosen?: PaymentMethod | null;

  active?: boolean;
  note?: string | null;

  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: PaymentMandateDV = {
    id: `payment.mandate:${args.buyerId}:${args.sellerId}:${uid()}`,
    kind: "payment.mandate",
    traits: ["mt:payment.mandate", "mt:market"],
    attrs: {
      sellerId: safeStr(args.sellerId),
      sellerName: args.sellerName ?? null,

      buyerId: safeStr(args.buyerId),
      buyerName: args.buyerName ?? null,

      planId: args.planId ?? null,
      label: args.label ?? null,

      interval: args.interval,
      every: args.every ?? 1,

      amountMax: Number(args.amountMax),
      currency: args.currency ?? "PYG",

      chosen: args.chosen ?? null,

      active: args.active ?? true,
      startTs: new Date().toISOString(),
      endTs: null,
      note: args.note ?? null,
    },
    meta: { ns, ts: new Date().toISOString(), actor: safeStr(args.buyerId), source: args.source ?? "ms.mandate" },
  };

  mtLiveUpsert(dv as AnyDV);

  try {
    await spore?.sayIntent?.({ sym: "✅", say: "payment.mandate", with: dv });
  } catch {}

  return dv;
}

// -------------------------------
// Emit: Charge (vendedor/caja)
// -------------------------------
export async function emitPaymentCharge(args: {
  mandateId: string;
  sellerId: string;
  buyerId: string;
  amount: number;
  currency?: string | null;
  dueTs?: string;
  note?: string | null;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: PaymentChargeDV = {
    id: `payment.charge:${args.mandateId}:${uid()}`,
    kind: "payment.charge",
    traits: ["mt:payment.charge", "mt:market"],
    attrs: {
      mandateId: safeStr(args.mandateId),
      sellerId: safeStr(args.sellerId),
      buyerId: safeStr(args.buyerId),
      amount: Number(args.amount),
      currency: args.currency ?? "PYG",
      dueTs: args.dueTs ?? new Date().toISOString(),
      note: args.note ?? null,
    },
    meta: { ns, ts: new Date().toISOString(), actor: safeStr(args.sellerId), source: args.source ?? "ms.charge" },
  };

  mtLiveUpsert(dv as AnyDV);

  try {
    await spore?.sayIntent?.({ sym: "🧾", say: "payment.charge", with: dv });
  } catch {}

  return dv;
}

// -------------------------------
// Emit: Charge Accept (comprador o caja)
// -------------------------------
export async function emitPaymentChargeAccept(args: {
  chargeId: string;
  mandateId: string;
  ok: boolean;
  actorId: string;
  note?: string | null;
  proof?: { type: string; value: string } | null;
  ns?: string;
  source?: string;
}) {
  const ns = args.ns ?? "mt:market";

  const dv: PaymentChargeAcceptDV = {
    id: `payment.charge.accept:${args.chargeId}:${uid()}`,
    kind: "payment.charge.accept",
    traits: ["mt:payment.charge.accept", args.ok ? "mt:ok" : "mt:nok"],
    attrs: {
      chargeId: safeStr(args.chargeId),
      mandateId: safeStr(args.mandateId),
      ok: !!args.ok,
      note: args.note ?? null,
      proof: args.proof ?? null,
    },
    meta: { ns, ts: new Date().toISOString(), actor: safeStr(args.actorId), source: args.source ?? "ms.charge.accept" },
  };

  mtLiveUpsert(dv as AnyDV);

  try {
    await spore?.sayIntent?.({ sym: args.ok ? "✅" : "⚠️", say: "payment.charge.accept", with: dv });
  } catch {}

  return dv;
}
