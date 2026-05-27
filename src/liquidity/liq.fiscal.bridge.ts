import type { DVLike } from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";
import { emitTrustSignal } from "./mt.trust.engine";

const now = () => Date.now();
const id = (p: string) => `${p}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
const num = (v: any, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;

export function buildFiscalDocumentDV(input: {
  docType: "invoice" | "receipt" | "tax.record" | "credit.note";
  actorId: string;
  buyerId?: string;
  sellerId?: string;
  amount: number;
  currency?: string;
  taxAmount?: number;
  legalStatus?: "draft" | "valid" | "invalid" | "pending";
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  territoryId?: string;
  reason?: string;
}) {
  return {
    id: id("liq.fiscal.document"),
    kind: "liq.fiscal.document",
    ts: now(),
    traits: ["mt:liquidity", "mt:fiscal", "mt:legal"],
    labels: ["Documento fiscal"],
    meta: {
      ns: "mt:liquidity",
      scopes: input.territoryId ? ["public", `territory:${input.territoryId}`] : ["public"],
      schema: "utopy.liq.fiscal.document.v1",
      by: input.actorId,
    },
    attrs: {
      docType: input.docType,
      actorId: input.actorId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      amount: num(input.amount),
      currency: input.currency || "PYG",
      taxAmount: num(input.taxAmount),
      legalStatus: input.legalStatus || "draft",
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      territoryId: input.territoryId,
      reason: input.reason || "fiscal.document.created",
    },
  } satisfies DVLike;
}

export function emitFiscalDocument(input: Parameters<typeof buildFiscalDocumentDV>[0]) {
  const dv = buildFiscalDocumentDV(input);
  emitUtopyDV(dv, "mt");

  if (dv.attrs?.legalStatus === "valid") {
    emitTrustSignal({
      actorId: input.sellerId || input.actorId,
      targetId: input.buyerId,
      signalType: "fiscal.valid",
      weight: 0.8,
      reason: "Documento fiscal válido",
      sourceKind: dv.kind,
      sourceId: dv.id,
      territoryId: input.territoryId,
      threadId: input.threadId,
      orderId: input.orderId,
    });
  }

  return dv;
}