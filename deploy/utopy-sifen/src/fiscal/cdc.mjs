import { randomInt } from 'node:crypto';
/** DNIT modulo 11, including the documented ASCII substitution for alphanumeric RUCs. */
export function checkDigit(value) {
  if (!/^[0-9A-D]+$/.test(value)) throw new Error('CDC_CHARACTERS');
  const digits = value.replace(/[A-D]/g, c => String(c.charCodeAt(0)));
  let total = 0, weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    total += Number(digits[i]) * weight;
    weight = weight === 11 ? 2 : weight + 1;
  }
  return String(total % 11 < 2 ? 0 : 11 - total % 11);
}
function digits(value, width) {
  const v = String(value);
  if (!/^\d+$/.test(v) || v.length > width) throw new Error('CDC_FIELD');
  return v.padStart(width, '0');
}
export function buildCDC(input) {
  const ruc = String(input.ruc).padStart(8, '0');
  if (!/^\d{7}[\dA-D]$/.test(ruc) || checkDigit(String(input.ruc)) !== String(input.rucDV)) throw new Error('RUC_INVALID');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date) throw new Error('CDC_DATE');
  if (!['1', '2'].includes(String(input.contributorType)) || String(input.emissionType) !== '1') throw new Error('CDC_UNSUPPORTED_TYPE');
  if (Number(input.securityCode) < 1 || Number(input.securityCode) === Number(input.number)) throw new Error('CDC_SECURITY_CODE');
  const body = digits(input.documentType, 2) + ruc + digits(input.rucDV, 1) + digits(input.establishment, 3)
    + digits(input.point, 3) + digits(input.number, 7) + digits(input.contributorType, 1)
    + input.date.replace(/-/g, '') + digits(input.emissionType, 1) + digits(input.securityCode, 9);
  return body + checkDigit(body);
}
export function validCDC(cdc) {
  return /^\d{9}[\dA-D]\d{34}$/.test(cdc) && checkDigit(cdc.slice(0, -1)) === cdc.slice(-1);
}
export function securityCode(number) {
  let value; do { value = randomInt(1, 1000000000); } while (value === Number(number));
  return String(value).padStart(9, '0');
}
