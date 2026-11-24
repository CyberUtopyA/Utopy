import { commercialMissingFields, type CommercialDocument, type CommercialLine } from "./commercialDocument";

const text = (...values: any[]) => String(values.find(v => v !== undefined && v !== null && v !== "") ?? "");
const kinds = new Set(["sale.receipt", "market.invoice.draft", "market.order.create", "work.quote.accepted", "work.outcome", "commercial.document"]);
/** Preserve unknown fields as missing, never infer rates, issuer, currency or fiscal acceptance. */
export function adaptCommercialDocument(dv: any): { document: CommercialDocument; missingFields: string[] } | null {
  if (!kinds.has(dv?.kind)) return null;
  if (dv.kind === "commercial.document") {
    const document = dv.attrs?.document;
    return document ? { document, missingFields: commercialMissingFields(document) } : null;
  }
  const a = dv.attrs || {};
  const issuer = text(a.issuerNodeId, a.sellerNodeId, a.providerNodeId, a.seller?.nodeId, a.seller?.id, a.sellerId, dv.meta?.authority);
  const rawLines = a.lines || a.items || (a.productName ? [{ description: a.productName, productId: a.productId, quantity: a.quantity ?? a.qty, unitPrice: a.unitPrice ?? a.price, total: a.total, type: "product" }] : []);
  const lines: CommercialLine[] = rawLines.map((l: any, i: number) => ({
    lineId: text(l.lineId, l.id, `${dv.id}:line:${i}`),
    type: ["product", "service", "labor", "material", "transport"].includes(l.type) ? l.type : "other",
    description: text(l.description, l.name, l.label), quantity: text(l.quantity, l.qty),
    unitPrice: text(l.unitPrice, l.price), total: text(l.total),
    ...(l.productId ? { productId: String(l.productId) } : {}),
    ...(l.unitCode ? { unitCode: String(l.unitCode) } : {}),
    ...(l.tax ? { tax: l.tax } : {}),
  }));
  const document: CommercialDocument = {
    documentId: `commercial:${dv.id}`, revision: Number(dv.meta?.version || 1), issuerNodeId: issuer,
    buyerRef: text(a.buyerRef, a.buyerId, a.buyer?.id) || undefined,
    issuedAt: text(a.issuedAt, dv.meta?.ts, dv.meta?.updatedAt), currency: text(a.currency), lines,
    commercialCondition: a.commercialCondition,
    totals: { total: text(a.totals?.total, a.total, a.amount) },
    sourceRefs: [{ id: String(dv.id), kind: String(dv.kind) }],
    orderId: a.orderId, workId: a.workId,
    paymentRefs: Array.isArray(a.paymentRefs) ? a.paymentRefs : [], authority: issuer,
  };
  return { document, missingFields: commercialMissingFields(document) };
}
