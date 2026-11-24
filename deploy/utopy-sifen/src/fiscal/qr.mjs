import { createHash } from 'node:crypto';
import { validCDC } from './cdc.mjs';
/** Manual v150 §13.8. CSC is consumed server-side and never returned. */
export function fiscalQR({ cdc, issuedAt, recipientType, recipientId, total, vat, itemCount, digestValue, cscId }, csc) {
  if (!validCDC(cdc) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(issuedAt)
    || !['dRucRec', 'dNumIDRec'].includes(recipientType) || !/^[\w.-]{1,20}$/.test(recipientId)
    || !/^\d{4}$/.test(cscId) || !/^[A-Za-z0-9]{32}$/.test(csc)
    || !/^\d+(\.\d+)?$/.test(total) || !/^\d+(\.\d+)?$/.test(vat)
    || !Number.isInteger(itemCount) || itemCount < 1 || itemCount > 999
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(digestValue)) throw new Error('QR_FIELDS_INVALID');
  const hex = v => Buffer.from(v, 'utf8').toString('hex');
  const parameters = `nVersion=150&Id=${cdc}&dFeEmiDE=${hex(issuedAt)}&${recipientType}=${recipientId}`
    + `&dTotGralOpe=${total}&dTotIVA=${vat}&cItems=${itemCount}&DigestValue=${hex(digestValue)}&IdCSC=${cscId}`;
  return `https://ekuatia.set.gov.py/consultas-test/qr?${parameters}&cHashQR=${createHash('sha256').update(parameters + csc).digest('hex')}`;
}
