// ============================================
// FILE: src/mt/utopyPulseTotem.actions.ts
// Tótem UTOPY Latido → envía sesión viva al Market
// ============================================

import { emitUtopyDV } from "../liquidity/liquiditypublish";
import type { DVLike } from "../liquidity/mt.liquidity";
import { asCurrency, now, safeNum } from "../liquidity/mt.liquidity";
import { mtLiveUpsert } from "../mt/mt.liveStore";
import { buildPaymentPulseOpenDV } from "./utopyPaypulse";

function iso() {
  return new Date().toISOString();
}

function safeStr(x: any, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function sanitizeIdPart(x: any, fb = "unknown") {
  const s = String(x ?? "").trim();
  if (!s) return fb;
  return s.replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

function publishMarketDV(dv: DVLike) {
  try {
    mtLiveUpsert(dv as any);
  } catch {}

  try {
    emitUtopyDV(dv, "mt");
  } catch {}

  return dv;
}

export type TotemPulsePaymentInput = {
  sellerId: string;
  sellerName?: string | null;
  amount: number;
  currency?: string | null;
  productId?: string | null;
  productName?: string | null;
  reason?: string | null;
  territoryId?: string | null;
  ns?: string;
};

export function buildTotemPaymentSessionOpenDV(
  input: TotemPulsePaymentInput
): DVLike {
  const created = now();

  const sellerClean = sanitizeIdPart(input.sellerId, "seller");
  const productClean = sanitizeIdPart(input.productId || "totem", "product");

  const sessionId = `session:totem:${sellerClean}:${created}`;
  const orderId = `market.order:totem:${sellerClean}:${productClean}:${created}`;
  const threadId = `mt.thread.pay:totem:${sellerClean}:${productClean}:${created}`;

  return {
    id: sessionId,
    kind: "payment.session.open",
    ts: created,
    traits: [
      "utopy:pay",
      "utopy:pulse",
      "utopy:totem",
      "presence:proximity",
      "mt:market",
      "liq:aware",
    ],
    labels: ["Sesión de pago por Latido"],
    meta: {
      ns: input.ns || "mt:market",
      ts: iso(),
      scopes: input.territoryId
        ? ["public", `territory:${input.territoryId}`]
        : ["public"],
      schema: "utopy.payment.session.open.totem.v1",
      by: input.sellerId,
      source: "utopy.totem.pulse",
      ttl_ms: 1000 * 60 * 15,
      pinned: false,
    },
    attrs: {
      status: "open",
      sessionId,
      paymentSessionId: sessionId,
      orderId,
      threadId,
      sellerId: input.sellerId,
      sellerName: input.sellerName || input.sellerId,
      buyerId: "buyer:totem-nearby",
      buyerName: "Cliente cercano",
      productId: input.productId || null,
      productName: input.productName || "Pago en tótem",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency || "PYG"),
      reason: input.reason || "Pago vivo emitido por tótem",
      rail: "utopy_pulse",
      mode: "presence_pulse",
      territoryId: input.territoryId || null,
      suggested: {
        channel: "utopy_pulse",
        label: "UTOPY Latido",
        meta: { reason: "totem.presence.pulse" },
      },
      externalSettlement: false,
      utopyFee: 0,
    },
  };
}

export function openTotemPulsePayment(input: TotemPulsePaymentInput) {
  const session = buildTotemPaymentSessionOpenDV(input);

  publishMarketDV(session);

  const pulse = buildPaymentPulseOpenDV({
    sessionId: safeStr(session.attrs?.sessionId || session.id),
    orderId: safeStr(session.attrs?.orderId),
    threadId: safeStr(session.attrs?.threadId),
    sellerId: safeStr(session.attrs?.sellerId),
    sellerName: session.attrs?.sellerName,
    buyerId: session.attrs?.buyerId,
    buyerName: session.attrs?.buyerName,
    productId: session.attrs?.productId,
    productName: session.attrs?.productName,
    amount: safeNum(session.attrs?.amount),
    currency: session.attrs?.currency,
    territoryId: session.attrs?.territoryId,
    ns: session.meta?.ns || "mt:market",
    source: "utopy.totem.pulse.open",
    ttlMs: 1000 * 30,
  });

  publishMarketDV(pulse);

  return { session, pulse };
}

export function refreshTotemPulsePayment(session: DVLike) {
  const a = session.attrs || {};

  const pulse = buildPaymentPulseOpenDV({
    sessionId: safeStr(a.sessionId || session.id),
    orderId: safeStr(a.orderId),
    threadId: safeStr(a.threadId),
    sellerId: safeStr(a.sellerId),
    sellerName: a.sellerName,
    buyerId: a.buyerId,
    buyerName: a.buyerName,
    productId: a.productId,
    productName: a.productName,
    amount: safeNum(a.amount),
    currency: a.currency,
    territoryId: a.territoryId,
    ns: session.meta?.ns || "mt:market",
    source: "utopy.totem.pulse.refresh",
    ttlMs: 1000 * 30,
  });

  publishMarketDV(pulse);

  return pulse;
}