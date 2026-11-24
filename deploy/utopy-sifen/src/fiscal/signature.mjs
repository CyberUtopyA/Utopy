import { readFileSync } from 'node:fs';
import { X509Certificate, createPrivateKey, createPublicKey } from 'node:crypto';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
const NS = 'http://ekuatia.set.gov.py/sifen/xsd';
const DS = 'http://www.w3.org/2000/09/xmldsig#';
export function loadCertificate(subject) {
  if (!subject.certificateRef || !subject.privateKeyRef || !subject.ruc) throw new Error('CERT_NOT_CONFIGURED');
  const cert = readFileSync(subject.certificateRef, 'utf8');
  const passphrase = subject.passwordRef ? readFileSync(subject.passwordRef, 'utf8').trimEnd() : undefined;
  const privateKey = createPrivateKey({ key: readFileSync(subject.privateKeyRef), passphrase });
  const x509 = new X509Certificate(cert);
  const at = Date.now();
  if (Date.parse(x509.validFrom) > at || Date.parse(x509.validTo) <= at) throw new Error('CERT_EXPIRED');
  if (x509.publicKey.asymmetricKeyType !== 'rsa' || (x509.publicKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw new Error('CERT_ALGORITHM');
  if (!x509.publicKey.export({ type: 'spki', format: 'der' }).equals(createPublicKey(privateKey).export({ type: 'spki', format: 'der' }))) throw new Error('CERT_KEY_MISMATCH');
  // Exact subject attribute configured by issuer provisioning, not substring matching a RUC.
  const serial = x509.subject.split('\n').find(line => line.startsWith('serialNumber='))?.slice(13);
  if (!subject.certificateSubjectSerial || serial !== subject.certificateSubjectSerial || !serial?.split(/[^0-9]+/).includes(subject.ruc)) throw new Error('CERT_SUBJECT_MISMATCH');
  // Trust chain / qualified PSC policy must still be checked during conformance provisioning.
  return { cert, privateKey, x509 };
}
function document(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML_UNSAFE');
  let invalid = false;
  const doc = new DOMParser({ errorHandler: { warning() {}, error() { invalid = true; }, fatalError() { invalid = true; } } }).parseFromString(xml, 'text/xml');
  if (invalid || doc.getElementsByTagNameNS(NS, 'DE').length !== 1) throw new Error('XML_INVALID');
  return doc;
}
export function signDE(xml, { cert, privateKey }) {
  const doc = document(xml);
  if (doc.getElementsByTagNameNS(DS, 'Signature').length) throw new Error('XML_ALREADY_SIGNED');
  const signer = new SignedXml({ privateKey, publicCert: cert,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#' });
  signer.addReference({ xpath: `//*[local-name()='DE' and namespace-uri()='${NS}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
  signer.computeSignature(xml, { location: { reference: `//*[local-name()='DE' and namespace-uri()='${NS}']`, action: 'after' } });
  const signed = signer.getSignedXml();
  if (!verifyDE(signed, cert)) throw new Error('SIGNATURE_LOCAL_INVALID');
  return signed;
}
export function verifyDE(xml, pinnedCert) {
  try {
    const doc = document(xml), signatures = doc.getElementsByTagNameNS(DS, 'Signature');
    if (signatures.length !== 1) return false;
    const de = doc.getElementsByTagNameNS(NS, 'DE')[0];
    const refs = signatures[0].getElementsByTagNameNS(DS, 'Reference');
    if (refs.length !== 1 || refs[0].getAttribute('URI') !== `#${de.getAttribute('Id')}`) return false;
    const verifier = new SignedXml({ publicCert: pinnedCert, getCertFromKeyInfo: () => null });
    verifier.loadSignature(signatures[0]);
    return verifier.checkSignature(xml);
  } catch { return false; }
}
