import { AuthorityRegistry, isExpired, validateEnvelopeShape, verifyEnvelopeSignature, type LivingEnvelope } from "utopy";
import { applyAuthorityTrust, verifyAuthorityTrustEnvelope, type AuthorityTrustEnvelope, type EnvelopeAccessContext, canAccessEnvelope } from "utopy/continuity";

export function isManifestEnvelope(envelope: LivingEnvelope): boolean {
  return envelope.kind === "utopy.node.manifest";
}

export const verifyRuntimeEnvelope = (envelope: LivingEnvelope, policy = marketAuthorityTrust) => policy.verify(envelope);

export type TrustAnchor = { authority: string; keyId: string; publicKeyJwk: JsonWebKey };

/** Explicit operator anchors; a self-signed manifest never bootstraps trust. */
export class MarketAuthorityTrust {
  private roots = new AuthorityRegistry();
  private projection: AuthorityTrustEnvelope | null = null;
  private registry = new AuthorityRegistry();
  private handles = new Map<string, string>();
  private trustUpdates = Promise.resolve();
  private revokedAuthorities = new Set<string>();
  private revokedKeys = new Set<string>();
  private revokedMandates = new Set<string>();
  constructor(readonly audience: string, anchors: TrustAnchor[] = []) {
    for (const anchor of anchors) {
      if (!anchor?.authority || !anchor.keyId || !anchor.publicKeyJwk) continue;
      this.roots.trust(anchor.authority, anchor.keyId, anchor.publicKeyJwk);
    }
  }
  readonly trusted = (authority: string, keyId: string, jwk: JsonWebKey) => Boolean(
    this.projection && !isExpired(this.projection) && this.registry.accepts(authority, keyId, jwk),
  );
  get snapshot() { return this.projection; }
  receiveTrust(envelope: LivingEnvelope) {
    const update = this.trustUpdates.then(() => this.applyTrustUpdate(envelope));
    this.trustUpdates = update.then(() => {}, () => {});
    return update;
  }
  private async applyTrustUpdate(envelope: LivingEnvelope) {
    if (this.projection && envelope.authority !== this.projection.authority) return { ok: false, reason: "trust-issuer-change" };
    const checked = await verifyAuthorityTrustEnvelope(envelope, {
      audience: this.audience,
      trustedIssuer: (authority, keyId, jwk) => this.roots.accepts(authority, keyId, jwk),
      prior: this.projection || undefined,
    });
    if (!checked.ok) return checked;
    const payload = (envelope as AuthorityTrustEnvelope).payload;
    // Signed tombstones survive omissions in later snapshots within this session.
    if (payload.authorities.some((authority) => authority.status === "active" && (this.revokedAuthorities.has(authority.authority)
      || authority.keys.some((key) => key.status === "active" && this.revokedKeys.has(`${authority.authority}|${key.keyId}`))))
      || payload.mandates.some((mandate) => mandate.status === "active" && this.revokedMandates.has(mandate.mandateId))) return { ok: false, reason: "trust-revocation-rollback" };
    const next = new AuthorityRegistry();
    applyAuthorityTrust(next, payload);
    for (const authority of payload.authorities) {
      if (authority.status === "revoked") this.revokedAuthorities.add(authority.authority);
      for (const key of authority.keys) if (key.status === "revoked") this.revokedKeys.add(`${authority.authority}|${key.keyId}`);
    }
    for (const mandate of payload.mandates) if (mandate.status === "revoked") this.revokedMandates.add(mandate.mandateId);
    this.registry = next;
    this.projection = envelope as AuthorityTrustEnvelope;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("utopy:trust:changed"));
    return checked;
  }
  async verify(envelope: LivingEnvelope, context?: EnvelopeAccessContext) {
    const shape = await validateEnvelopeShape(envelope);
    if (!shape.ok) return { verified: false, reason: shape.reason };
    if (isExpired(envelope)) return { verified: false, reason: "expiry" };
    if (!envelope.scopes?.length) return { verified: false, reason: "explicit-scopes-required" };
    if (context && !canAccessEnvelope(envelope, context)) return { verified: false, reason: "access-denied" };
    const verified = Boolean(envelope.ownership && await verifyEnvelopeSignature(envelope, this.trusted));
    if (verified && isManifestEnvelope(envelope)) {
      const payload: any = envelope.payload;
      const nodeId = String(payload?.nodeId || payload?.attrs?.nodeId || "");
      if (nodeId !== envelope.authority) return { verified: false, reason: "manifest-nodeId" };
      const handle = String(payload?.handle || payload?.attrs?.handle || "").trim().toLowerCase();
      if (handle && this.handles.has(handle) && this.handles.get(handle) !== nodeId) return { verified: false, reason: "handle-conflict" };
      if (handle) this.handles.set(handle, nodeId);
    }
    return { verified, reason: verified ? undefined : "authority-untrusted-or-signature" };
  }
}
function configuredAnchors(): TrustAnchor[] {
  try {
    const value = JSON.parse(import.meta.env.VITE_UTOPY_TRUST_ANCHORS || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
export const marketAuthorityTrust = new MarketAuthorityTrust(
  import.meta.env.VITE_UTOPY_MARKET_NODE_ID || "utopy.node.market.runtime", configuredAnchors(),
);

export function resetRuntimeTrustForTests() {
  // Tests use isolated MarketAuthorityTrust instances; production trust is never reset here.
}
