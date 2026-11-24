/** Commercial evidence, never a tax approval or proof of payment. Decimal values are strings. */
export type CommercialLine = {
  lineId: string;
  type: "product" | "service" | "labor" | "material" | "transport" | "other";
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  productId?: string;
  unitCode?: string;
  tax?: { affectation: string; proportion: string; rate: string };
};
export type CommercialDocument = {
  documentId: string;
  revision: number;
  issuerNodeId: string;
  buyerRef?: string;
  issuedAt: string;
  currency: string;
  lines: CommercialLine[];
  commercialCondition?: { type: "cash" | "credit"; paymentMethod?: string; terms?: string };
  totals: { total: string; discount?: string };
  sourceRefs: { id: string; kind: string }[];
  orderId?: string;
  workId?: string;
  paymentRefs: string[];
  authority: string;
};

export function canonicalCommercial(value: unknown): string {
  const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, stable(v[k])])) : v;
  return JSON.stringify(stable(value));
}
export async function commercialDocumentHash(document: CommercialDocument) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalCommercial(document)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function commercialMissingFields(d: CommercialDocument): string[] {
  const missing: string[] = [];
  for (const field of ["documentId", "issuerNodeId", "issuedAt", "currency", "authority"] as const) if (!d[field]) missing.push(field);
  if (!Number.isSafeInteger(d.revision) || d.revision < 1) missing.push("revision");
  if (!d.issuedAt || !Number.isFinite(Date.parse(d.issuedAt))) missing.push("issuedAt");
  if (!d.lines.length) missing.push("lines");
  d.lines.forEach((line, i) => {
    if (!line.description) missing.push(`lines.${i}.description`);
    for (const f of ["quantity", "unitPrice", "total"] as const) if (!/^\d+(\.\d+)?$/.test(line[f])) missing.push(`lines.${i}.${f}`);
  });
  if (!/^\d+(\.\d+)?$/.test(d.totals.total)) missing.push("totals.total");
  return [...new Set(missing)];
}
