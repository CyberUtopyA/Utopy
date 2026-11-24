import Decimal from 'decimal.js';
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function decimal(value, scale = 8) {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || value.length > 32) throw new Error('DECIMAL_INVALID');
  const d = new Money(value);
  if (d.decimalPlaces() > scale) throw new Error('DECIMAL_SCALE');
  return d;
}
export function validateCommercial(document) {
  const missingFields = [];
  for (const f of ['documentId', 'issuerNodeId', 'authority', 'issuedAt', 'currency']) if (typeof document?.[f] !== 'string' || !document[f]) missingFields.push(f);
  if (!Number.isSafeInteger(document?.revision) || document.revision < 1) missingFields.push('revision');
  if (!Array.isArray(document?.lines) || !document.lines.length || document.lines.length > 999) missingFields.push('lines');
  if (document?.issuedAt && !Number.isFinite(Date.parse(document.issuedAt))) missingFields.push('issuedAt');
  if (missingFields.length) return { missingFields };
  let total = new Money(0);
  document.lines.forEach((l, i) => {
    if (!l.description || !l.lineId) missingFields.push(`lines.${i}.description`);
    try {
      const quantity = decimal(l.quantity), price = decimal(l.unitPrice), lineTotal = decimal(l.total);
      if (quantity.lte(0) || !quantity.mul(price).eq(lineTotal)) missingFields.push(`lines.${i}.total`);
      total = total.plus(lineTotal);
    } catch { missingFields.push(`lines.${i}.decimal`); }
  });
  try { if (!total.eq(decimal(document.totals?.total))) missingFields.push('totals.total'); }
  catch { missingFields.push('totals.total'); }
  return { missingFields, total: total.toFixed() };
}
