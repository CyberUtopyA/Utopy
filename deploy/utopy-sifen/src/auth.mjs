import { createPublicKey, verify, createHash } from 'node:crypto';
import { resolveSubject } from './config.mjs';
export const canonical = value => JSON.stringify(stable(value));
function stable(v) { return Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, stable(v[k])])) : v; }
export const hash = v => createHash('sha256').update(typeof v === 'string' ? v : canonical(v)).digest('hex');
export function authenticate(request, config, now = Date.now()) {
  const { payload, signature, keyId } = request || {};
  if (!payload || payload.protocol !== 'utopy.fiscal.request/1' || payload.scope !== 'private:fiscal'
      || !/^[\w:-]{16,160}$/.test(payload.nonce || '') || !Number.isFinite(payload.timestamp)
      || Math.abs(now - payload.timestamp) > 120000) throw new Error('AUTH_INVALID');
  const { node, subject, fiscalSubjectId } = resolveSubject(config, payload.issuerNodeId);
  const key = node.authorizedKeys?.find(k => k.keyId === keyId && !k.revoked && k.actions?.includes(payload.action)
    && (!k.expiresAt || Date.parse(k.expiresAt) > now));
  if (!key || !signature || !verify('sha256', Buffer.from(canonical(payload)),
    { key: createPublicKey({ key: key.publicKeyJwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))) throw new Error('AUTH_INVALID');
  if (payload.document && (payload.document.issuerNodeId !== payload.issuerNodeId || payload.document.authority !== payload.issuerNodeId
    || payload.document.documentId !== payload.commercialDocumentId || payload.document.revision !== payload.revision
    || hash(payload.document) !== payload.documentHash)) throw new Error('DOCUMENT_BINDING_INVALID');
  return { payload, node, subject, fiscalSubjectId, keyId };
}
