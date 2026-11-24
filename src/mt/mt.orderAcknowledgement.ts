import { publishAuthorizedDV, verifyAuthorizedDV } from "../utopy/authorizedPublish";

type OrderNodeAction = "market.order.received" | "market.order.accept" | "market.order.reject";

function text(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function uid(prefix: string) {
  return `${prefix}:${typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`}`;
}

function buildNodeOrderAction(input: {
  kind: OrderNodeAction;
  order: any;
  sellerNodeId: string;
  reason?: string | null;
  acceptedLineIds?: string[];
}) {
  const attrs = input.order?.attrs || {};
  const orderId = text(attrs.orderId, input.order?.id);
  const buyerId = text(attrs.buyerId, attrs.buyer?.id);
  const sellerNodeId = text(input.sellerNodeId);
  if (!orderId || !buyerId || !sellerNodeId) {
    throw new Error("La respuesta del nodo necesita orden, comprador y nodo vendedor.");
  }
  const ts = new Date().toISOString();
  const state = input.kind === "market.order.received"
    ? "received"
    : input.kind === "market.order.accept"
      ? "accepted"
      : "rejected";
  return {
    id: uid(`${input.kind}:${orderId}`),
    kind: input.kind,
    attrs: {
      orderId,
      threadId: text(attrs.threadId, input.order?.meta?.threadId) || null,
      chainId: text(attrs.chainId, orderId),
      relationshipId: text(attrs.relationshipId) || null,
      buyerId,
      sellerNodeId,
      targetNodeId: buyerId,
      state,
      reason: text(input.reason) || null,
      acceptedLineIds: Array.from(new Set((input.acceptedLineIds || []).map(text).filter(Boolean))),
      respondsTo: orderId,
      occurredAt: ts,
    },
    traits: ["utopy:market", "market:order:ack", `market:order:${state}`],
    meta: {
      ns: input.order?.meta?.ns || "mt:market",
      ts,
      updatedAt: ts,
      version: 1,
      scopes: ["participants"],
      authority: sellerNodeId,
      originNode: sellerNodeId,
      targetNodeId: buyerId,
      respondsTo: orderId,
      schema: "utopy.market.order.ack@1",
    },
  };
}

export function buildMarketOrderReceivedDV(input: {
  order: any;
  sellerNodeId: string;
}) {
  return buildNodeOrderAction({ ...input, kind: "market.order.received" });
}

export function buildMarketOrderDecisionDV(input: {
  order: any;
  sellerNodeId: string;
  decision: "accepted" | "rejected";
  reason?: string | null;
  acceptedLineIds?: string[];
}) {
  return buildNodeOrderAction({
    ...input,
    kind: input.decision === "accepted" ? "market.order.accept" : "market.order.reject",
  });
}

export async function publishMarketOrderNodeAction(input: {
  dv: any;
  sellerNodeId: string;
  buyerActorId: string;
  allLive: any[];
  activeActor?: any;
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.sellerNodeId,
    targetNodeId: input.buyerActorId,
    requiredAuthority: input.sellerNodeId,
    action: input.dv.kind,
    sensitivity: "sensitive",
  });
}

export async function verifyMarketOrderNodeAction(input: {
  dv: any;
  order: any;
  allLive: any[];
  sellerNodeId?: string | null;
}) {
  const attrs = input.dv?.attrs || {};
  const orderAttrs = input.order?.attrs || {};
  const expectedOrderId = text(orderAttrs.orderId, input.order?.id);
  const expectedSeller = text(
    input.sellerNodeId,
    orderAttrs.targetNodeId,
    orderAttrs.sellerNodeId,
    orderAttrs.sellerId,
  );
  const structural =
    ["market.order.received", "market.order.accept", "market.order.reject"].includes(
      text(input.dv?.kind),
    ) &&
    text(attrs.orderId, input.dv?.meta?.respondsTo) === expectedOrderId &&
    text(attrs.sellerNodeId, attrs.actingAsNodeId, input.dv?.meta?.authority) === expectedSeller &&
    text(attrs.actingAsNodeId) === expectedSeller &&
    text(input.dv?.meta?.authority) === expectedSeller;
  const verification = structural
    ? await verifyAuthorizedDV(input.dv, input.allLive)
    : null;
  return {
    accepted: Boolean(structural && verification?.accepted && verification.proof === "verified"),
    verification,
  };
}

export function projectMarketOrderState(
  order: any,
  allLive: any[],
  verifiedAcknowledgementIds: Set<string> = new Set(),
) {
  const orderId = text(order?.attrs?.orderId, order?.id);
  const acknowledgements = allLive
    .filter((dv) =>
      ["market.order.received", "market.order.accept", "market.order.reject"].includes(text(dv?.kind)) &&
      text(dv?.attrs?.orderId, dv?.meta?.respondsTo) === orderId &&
      verifiedAcknowledgementIds.has(text(dv?.id)),
    )
    .sort((a, b) => Date.parse(text(b?.meta?.ts)) - Date.parse(text(a?.meta?.ts)));
  const latest = acknowledgements[0] || null;
  const state = latest?.kind === "market.order.accept"
    ? "accepted"
    : latest?.kind === "market.order.reject"
      ? "rejected"
      : latest?.kind === "market.order.received"
        ? "received"
        : "sent";
  return { order, orderId, state, latest, acknowledgements };
}
