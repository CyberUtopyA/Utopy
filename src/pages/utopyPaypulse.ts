// ============================================
// FILE: src/mt/utopyPulsePay.actions.ts
// UTOPY Latido: pago vivo por presencia
// ============================================

import { emitUtopyDV, emitUtopyMany } from "../liquidity/liquiditypublish";
import { asCurrency, DVLike, makeId, now, safeNum } from "../liquidity/mt.liquidity";

type PulseColor = "azul" | "verde" | "violeta" | "dorado" | "rojo";
type PulseWord = "hogar" | "mesa" | "luz" | "madera" | "vida" | "nodo";

const COLORS: PulseColor[] = ["azul", "verde", "violeta", "dorado", "rojo"];
const WORDS: PulseWord[] = ["hogar", "mesa", "luz", "madera", "vida", "nodo"];

function pick<T>(xs: T[]) {
  return xs[Math.floor(Math.random() * xs.length)];
}

function code2() {
  return String(Math.floor(10 + Math.random() * 90));
}

function scopes(territoryId?: string | null) {
  return territoryId ? ["public", `territory:${territoryId}`] : ["public"];
}

export type PaymentPulseOpenInput = {
  sessionId: string;
  orderId: string;
  threadId: string;

  sellerId: string;
  sellerName?: string | null;

  buyerId?: string | null;
  buyerName?: string | null;

  productId?: string | null;
  productName?: string | null;

  amount: number;
  currency?: string | null;

  territoryId?: string | null;
  ns?: string;
  source?: string;
  ttlMs?: number;
};

export function buildPaymentPulseOpenDV(input: PaymentPulseOpenInput): DVLike {
  const ts = now();
  const ttlMs = input.ttlMs ?? 1000 * 30;

  const color = pick(COLORS);
  const word = pick(WORDS);
  const code = code2();
  const pulseId = makeId("payment.pulse");

  return {
    id: pulseId,
    kind: "payment.pulse.open",
    ts,
    traits: [
      "utopy:pulse",
      "utopy:pay",
      "presence:proximity",
      "mt:market",
      "liq:aware",
    ],
    labels: ["Latido de pago vivo"],
    meta: {
      ns: input.ns || "mt:market",
      scopes: scopes(input.territoryId),
      schema: "utopy.payment.pulse.open.v1",
      by: input.sellerId,
      source: input.source || "utopy.pulse.pay",
      ttl_ms: ttlMs,
      pinned: false,
    },
    attrs: {
      status: "open",
      pulseId,
      sessionId: input.sessionId,
      paymentSessionId: input.sessionId,
      orderId: input.orderId,
      threadId: input.threadId,
      sellerId: input.sellerId,
      sellerName: input.sellerName || input.sellerId,
      buyerId: input.buyerId || null,
      buyerName: input.buyerName || null,
      productId: input.productId || null,
      productName: input.productName || null,
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency || "PYG"),
      color,
      word,
      code,
      pulseText: `${color.toUpperCase()} · ${word.toUpperCase()} · ${code}`,
      territoryId: input.territoryId || null,
      openedAt: ts,
      expiresAt: ts + ttlMs,
      mode: "presence_pulse",
      externalSettlement: false,
      utopyFee: 0,
    },
  };
}

export function buildPaymentPulseOutcomeDV(input: {
  pulse: DVLike;
  status: "paid" | "rejected" | "expired" | "cancelled";
  actorId: string;
  actorName?: string | null;
  note?: string | null;
}): DVLike {
  const a = input.pulse.attrs || {};

  return {
    id: makeId("payment.pulse.outcome"),
    kind: "payment.pulse.outcome",
    ts: now(),
    traits: [
      "utopy:pulse",
      "utopy:pay",
      "mt:payment.outcome",
      `mt:${input.status}`,
    ],
    labels: ["Resultado de latido"],
    meta: {
      ns: input.pulse.meta?.ns || "mt:market",
      scopes: input.pulse.meta?.scopes || ["public"],
      schema: "utopy.payment.pulse.outcome.v1",
      by: input.actorId,
      source: "utopy.pulse.outcome",
      ttl_ms: 1000 * 60 * 60 * 24 * 30,
      pinned: false,
    },
    attrs: {
      status: input.status,
      pulseId: a.pulseId || input.pulse.id,
      sessionId: a.sessionId,
      paymentSessionId: a.sessionId,
      orderId: a.orderId,
      threadId: a.threadId,
      sellerId: a.sellerId,
      sellerName: a.sellerName,
      buyerId: a.buyerId,
      buyerName: a.buyerName,
      amount: safeNum(a.amount),
      currency: asCurrency(a.currency || "PYG"),
      acceptedBy: input.actorId,
      acceptedByName: input.actorName || input.actorId,
      note: input.note || null,
      source: {
        kind: input.pulse.kind,
        id: input.pulse.id,
      },
    },
  };
}

export function buildPaymentStatusFromPulseDV(input: {
  pulse: DVLike;
  status?: "paid" | "accepted" | "rejected";
  actorId: string;
  actorName?: string | null;
  note?: string | null;
}): DVLike {
  const a = input.pulse.attrs || {};
  const status = input.status || "paid";

  return {
    id: makeId("payment.session.status"),
    kind: "payment.session.status",
    ts: now(),
    traits: [
      "utopy:pay",
      "utopy:pulse",
      "payment:status",
      "liq:source",
      "mt:market",
    ],
    labels: ["Estado de pago desde Latido"],
    meta: {
      ns: input.pulse.meta?.ns || "mt:market",
      scopes: input.pulse.meta?.scopes || ["public"],
      schema: "utopy.payment.session.status.from.pulse.v1",
      by: input.actorId,
      source: "utopy.pulse.pay.confirm",
      ttl_ms: 1000 * 60 * 60 * 24 * 30,
      pinned: false,
    },
    attrs: {
      status,
      amount: safeNum(a.amount),
      currency: asCurrency(a.currency || "PYG"),
      sessionId: a.sessionId,
      paymentSessionId: a.sessionId,
      orderId: a.orderId,
      threadId: a.threadId,
      sellerId: a.sellerId,
      sellerName: a.sellerName,
      buyerId: a.buyerId,
      buyerName: a.buyerName,
      rail: "utopy_pulse",
      mode: "presence_pulse",
      pulseId: a.pulseId || input.pulse.id,
      pulseText: a.pulseText,
      confirmedBy: input.actorId,
      confirmedByName: input.actorName || input.actorId,
      note: input.note || "Pago confirmado por Latido UTOPY",
      source: {
        kind: input.pulse.kind,
        id: input.pulse.id,
      },
    },
  };
}

export function emitPaymentPulseOpen(input: PaymentPulseOpenInput) {
  const pulse = buildPaymentPulseOpenDV(input);
  emitUtopyDV(pulse, "mt");
  return pulse;
}

export function emitPaymentPulsePaid(input: {
  pulse: DVLike;
  actorId: string;
  actorName?: string | null;
  note?: string | null;
}) {
  const status = buildPaymentStatusFromPulseDV({
    pulse: input.pulse,
    status: "paid",
    actorId: input.actorId,
    actorName: input.actorName,
    note: input.note,
  });

  const outcome = buildPaymentPulseOutcomeDV({
    pulse: input.pulse,
    status: "paid",
    actorId: input.actorId,
    actorName: input.actorName,
    note: input.note,
  });

  emitUtopyMany([status, outcome], "mt");

  return { status, outcome, dvs: [status, outcome] };
}

export function emitPaymentPulseRejected(input: {
  pulse: DVLike;
  actorId: string;
  actorName?: string | null;
  note?: string | null;
}) {
  const outcome = buildPaymentPulseOutcomeDV({
    pulse: input.pulse,
    status: "rejected",
    actorId: input.actorId,
    actorName: input.actorName,
    note: input.note || "Latido rechazado desde Pay Center",
  });

  emitUtopyDV(outcome, "mt");

  return { outcome, dvs: [outcome] };
}