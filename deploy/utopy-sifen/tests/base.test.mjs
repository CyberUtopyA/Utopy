import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { FiscalRepository } from '../src/fiscal/repository.mjs';
import { authenticate, canonical, hash } from '../src/auth.mjs';
import { decimal, validateCommercial } from '../src/fiscal/decimal.mjs';
import { loadConfig } from '../src/config.mjs';
import { validateOfficialXML } from '../src/fiscal/schema.mjs';
const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const publicKeyJwk = keys.publicKey.export({ format: 'jwk' });
const config = { nodes: { a: { fiscalSubjectId: 'subject', authorizedKeys: [{ keyId: 'device', publicKeyJwk, actions: ['document.save'] }] }, b: { fiscalSubjectId: 'other' } }, subjects: { subject: {}, other: {} } };
const line = (type, total) => ({ lineId: type, type, description: type, quantity: '1', unitPrice: total, total });
const fixture = (issuer = 'a', id = 'electricista') => ({ documentId: id, revision: 1, issuerNodeId: issuer, authority: issuer, issuedAt: '2026-09-13T09:00:00-03:00', currency: 'PYG', lines: [line('labor', '180000'), line('material', '95000')], totals: { total: '275000' }, sourceRefs: [], paymentRefs: [], simulation: true, nonTradable: true });
const payloadFor = (document = fixture()) => ({ protocol: 'utopy.fiscal.request/1', scope: 'private:fiscal', action: 'document.save', issuerNodeId: document.issuerNodeId, nonce: 'nonce:0123456789abcdef', timestamp: Date.now(), document, commercialDocumentId: document.documentId, revision: document.revision, documentHash: hash(document) });
function signed(payload) { return { payload, keyId: 'device', signature: sign('sha256', Buffer.from(canonical(payload)), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url') }; }
test('three generic sources use decimal-safe commercial validation; no inferred tax', () => {
  for (const name of ['electricista', 'DecoHogar', 'unknown-node']) {
    const d = fixture('a', name); assert.deepEqual(validateCommercial(d).missingFields, []); assert.equal(d.lines[0].tax, undefined);
  }
  assert.equal(decimal('0.1').plus(decimal('0.2')).toFixed(), '0.3');
  assert.throws(() => decimal(0.1)); assert.throws(() => decimal('1.123456789'));
  const d = fixture(); d.totals.total = '275001'; assert(validateCommercial(d).missingFields.includes('totals.total'));
});
test('signed authorization rejects tenant substitution, tampering, stale timestamp and wrong hash', () => {
  const p = payloadFor(); assert.equal(authenticate(signed(p), config).fiscalSubjectId, 'subject');
  const req = signed(p); req.payload = { ...p, issuerNodeId: 'b' }; assert.throws(() => authenticate(req, config));
  assert.throws(() => authenticate(signed({ ...p, timestamp: Date.now() - 200000 }), config));
  assert.throws(() => authenticate(signed({ ...p, documentHash: '0'.repeat(64) }), config));
});
test('draft retry is idempotent; changed revision conflicts; replays rejected; tenant reads isolated', () => {
  const repo = new FiscalRepository(':memory:');
  try {
    const p = payloadFor(); const a = repo.saveDraft(p, 'subject', 'device');
    assert.equal(repo.saveDraft(p, 'subject', 'device').id, a.id);
    assert.throws(() => repo.saveDraft({ ...p, documentHash: 'other' }, 'subject', 'device'), /REVISION_CONFLICT/);
    repo.consumeNonce(p, hash(p)); assert.throws(() => repo.consumeNonce(p, hash(p)), /REPLAY/);
    assert.equal(repo.get('b', p.commercialDocumentId, 1), null);
  } finally { repo.close(); }
});
test('numbering shared by fiscal subject, not node; reservation/outbox atomic; retry stable', () => {
  const repo = new FiscalRepository(':memory:');
  try {
    const numbering = { documentType: '1', establishment: '001', point: '001', startNumber: 1 };
    const a = repo.saveDraft(payloadFor(fixture('a', 'one')), 'subject', 'device');
    const b = repo.saveDraft(payloadFor(fixture('b', 'two')), 'subject', 'device');
    const cdc = n => String(n).padStart(44, '0'); // Repository-only fixture, not a SIFEN CDC vector.
    assert.throws(() => repo.reserve(a, numbering, () => { throw new Error('FAIL'); }));
    assert.equal(repo.get('a', 'one', 1).number, null);
    assert.equal(repo.reserve(a, numbering, cdc).number, 1);
    assert.equal(repo.reserve(a, numbering, cdc).number, 1);
    assert.equal(repo.reserve(b, numbering, cdc).number, 2);
    assert.equal(repo.db.prepare('SELECT count(*) n FROM outbox').get().n, 2);
  } finally { repo.close(); }
});
test('production cannot be enabled in P0; credential-free configuration works', () => {
  assert.equal(loadConfig({}).enabled, false);
  assert.throws(() => loadConfig({ SIFEN_ENV: 'production' }), /PRODUCTION_BLOCKED/);
  assert.throws(() => loadConfig({ SIFEN_PRODUCTION_ENABLED: 'true' }), /PRODUCTION_BLOCKED/);
});
test('official schema dependencies load offline and reject malformed/incomplete DE', async () => {
  const result = await validateOfficialXML('<rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dVerFor>150</dVerFor></rDE>');
  assert.equal(result.valid, false); assert(result.errors.length);
  await assert.rejects(validateOfficialXML('<!DOCTYPE rDE [<!ENTITY x SYSTEM "file:///secret">]><rDE/>'), /XML_UNSAFE/);
});
