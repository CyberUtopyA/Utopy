import type { DVLike } from "./mt.liquidity";
import { mtLiveUpsertSafe } from "./liquidity.publish";

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
    labels: ["Borrador de documento"],
    meta: {
      ns: "mt:liquidity",
      scopes: ["private"],
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
      // Compatibility only: local callers and payment events have no fiscal authority.
      legalStatus: "draft",
      fiscalAuthority: false,
      participants: [input.actorId, input.sellerId, input.buyerId].filter(Boolean),
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
  // Legacy non-fiscal draft stays on this device; the public Seed bus is not a private fiscal transport.
  mtLiveUpsertSafe(dv);

  return dv;
}
