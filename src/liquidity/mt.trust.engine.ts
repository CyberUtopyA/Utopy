import type { DVLike } from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";

const now = () => Date.now();
const id = (p: string) => `${p}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
const num = (v: any, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export type TrustSignalType =
  | "payment.completed"
  | "payment.failed"
  | "escrow.released"
  | "escrow.refunded"
  | "work.fulfilled"
  | "work.disputed"
  | "fiscal.valid"
  | "fiscal.invalid"
  | "governance.approved"
  | "governance.rejected";

export function buildTrustSignalDV(input: {
  actorId: string;
  targetId?: string;
  signalType: TrustSignalType;
  weight?: number;
  reason?: string;
  sourceKind?: string;
  sourceId?: string;
  territoryId?: string;
  threadId?: string;
  orderId?: string;
}) {
  const weight = clamp(num(input.weight, 0.5));

  return {
    id: id("liq.trust.signal"),
    kind: "liq.trust.signal",
    ts: now(),
    traits: ["mt:liquidity", "mt:trust", "mt:trust.signal"],
    labels: ["Señal de confianza"],
    meta: {
      ns: "mt:liquidity",
      scopes: input.territoryId ? ["public", `territory:${input.territoryId}`] : ["public"],
      schema: "utopy.liq.trust.signal.v1",
      by: input.actorId,
    },
    attrs: {
      actorId: input.actorId,
      targetId: input.targetId,
      signalType: input.signalType,
      weight,
      reason: input.reason || input.signalType,
      territoryId: input.territoryId,
      threadId: input.threadId,
      orderId: input.orderId,
      source: {
        kind: input.sourceKind,
        id: input.sourceId,
      },
    },
  } satisfies DVLike;
}

export function trustDeltaFromSignal(signalType: TrustSignalType, weight = 0.5) {
  const w = clamp(weight);

  if (signalType === "payment.completed") return 0.03 * w;
  if (signalType === "escrow.released") return 0.06 * w;
  if (signalType === "work.fulfilled") return 0.08 * w;
  if (signalType === "fiscal.valid") return 0.04 * w;
  if (signalType === "governance.approved") return 0.04 * w;

  if (signalType === "payment.failed") return -0.06 * w;
  if (signalType === "escrow.refunded") return -0.05 * w;
  if (signalType === "work.disputed") return -0.08 * w;
  if (signalType === "fiscal.invalid") return -0.1 * w;
  if (signalType === "governance.rejected") return -0.06 * w;

  return 0;
}

export function buildTrustFromSignalDV(signal: DVLike) {
  const a = signal.attrs || {};
  const delta = trustDeltaFromSignal(a.signalType, a.weight);

  return {
    id: id("liq.trust"),
    kind: "liq.trust",
    ts: now(),
    traits: ["mt:liquidity", "mt:trust", "mt:reputation"],
    labels: ["Trust vivo actualizado"],
    meta: {
      ns: "mt:liquidity",
      scopes: signal.meta?.scopes || ["public"],
      schema: "utopy.liq.trust.from.signal.v1",
      by: "liq.trust.engine",
    },
    attrs: {
      actorId: a.actorId,
      trustForId: a.targetId,
      scoreDelta: delta,
      reason: a.reason || a.signalType,
      basedOn: {
        kind: signal.kind,
        id: signal.id,
      },
      territoryId: a.territoryId,
      threadId: a.threadId,
      orderId: a.orderId,
    },
  } satisfies DVLike;
}

export function emitTrustSignal(input: Parameters<typeof buildTrustSignalDV>[0]) {
  const signal = buildTrustSignalDV(input);
  const trust = buildTrustFromSignalDV(signal);
  emitUtopyDV(signal, "mt");
  emitUtopyDV(trust, "mt");
  return { signal, trust };
}