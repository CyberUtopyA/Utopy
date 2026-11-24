import test from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import { createPrivateKey } from 'node:crypto';
import { signDE, verifyDE } from '../src/fiscal/signature.mjs';
test('RSA XMLDSig round-trip, tampering and wrapping rejected (synthetic, NOT a qualified SIFEN cert)', () => {
  const pair = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate(); cert.publicKey = pair.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 10000); cert.validity.notAfter = new Date(Date.now() + 86400000);
  cert.setSubject([{ name: 'commonName', value: 'SIMULATION NONTRADABLE' }]); cert.setIssuer(cert.subject.attributes);
  cert.sign(pair.privateKey, forge.md.sha256.create());
  const pem = forge.pki.certificateToPem(cert);
  const key = createPrivateKey(forge.pki.privateKeyToPem(pair.privateKey));
  const xml = '<rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dVerFor>150</dVerFor><DE Id="0144444401700100100145282201170125158732260988"><dDVId>8</dDVId></DE></rDE>';
  const signed = signDE(xml, { cert: pem, privateKey: key });
  assert(verifyDE(signed, pem));
  assert.equal(verifyDE(signed.replace('<dDVId>8', '<dDVId>7'), pem), false);
  assert.equal(verifyDE(signed.replace('</rDE>', '<DE Id="other"/></rDE>'), pem), false);
});
