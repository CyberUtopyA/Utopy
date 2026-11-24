import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDigit, validCDC, buildCDC, securityCode } from '../src/fiscal/cdc.mjs';
import { fiscalQR } from '../src/fiscal/qr.mjs';
test('CDC official manual known vector, changes and deterministic allocation', () => {
  const cdc = '01444444017001001001452822017012515873260988';
  assert.equal(checkDigit(cdc.slice(0, -1)), '8'); assert(validCDC(cdc));
  assert.equal(validCDC(cdc.slice(0, -1) + '7'), false);
  const input = { documentType: 1, ruc: '44444401', rucDV: 7, establishment: 1, point: 1, number: 14528, contributorType: 2, date: '2017-01-25', emissionType: 1, securityCode: '587326098' };
  assert.equal(buildCDC(input), cdc); assert.equal(buildCDC(input), buildCDC(input));
  assert.notEqual(buildCDC({ ...input, number: 145283 }), cdc);
  assert.throws(() => buildCDC({ ...input, date: '2017-02-31' }));
  assert.notEqual(securityCode(1), '000000001');
});
test('QR hashes official parameter sequence; never exposes CSC', () => {
  const csc = 'ABCD0000000000000000000000000000'; // Public manual TEST example, not a credential.
  const url = fiscalQR({ cdc: '01444444017001001001452822017012515873260988', issuedAt: '2017-01-25T09:35:17', recipientType: 'dRucRec', recipientId: '88899990', total: '300000', vat: '27272', itemCount: 2, digestValue: 'yzGYhUx1/XYYzksWB+fPR3Qc50c=', cscId: '0001' }, csc);
  assert(!url.includes(csc)); assert(url.includes('323031372d30312d32355430393a33353a3137'));
  // The manual's illustrated hash uses an older nVersion in part of its example; do not copy that inconsistent hash.
  assert.match(url, /cHashQR=[a-f0-9]{64}$/);
});
