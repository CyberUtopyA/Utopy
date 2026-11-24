import { createEnvelope, type LivingEnvelope, type VisibilityScope } from "utopy/protocol";

const CAUSAL_FIELDS = [
  "orderId", "productId", "sellerNodeId", "storeId", "relationshipId",
  "buyerActorId", "designId", "versionId", "workId", "workUnitId",
  "financeRequestId", "decisionId", "paymentId",
] as const;

function text(...values: unknown[]): string {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function iso(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function expirationOf(dv: any, createdAt: string): string | undefined {
  const explicit = dv?.attrs?.expiresAt ?? dv?.meta?.expiresAt;
  if (explicit) return iso(explicit);
  const ttl = Number(dv?.meta?.ttl_ms ?? dv?.attrs?.ttl_ms ?? 0);
  return ttl > 0 ? new Date(Date.parse(createdAt) + ttl).toISOString() : undefined;
}

function scopesOf(dv: any): VisibilityScope[] {
  const allowed = new Set(["public", "participants", "community", "custodians", "private"]);
  const values = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes : ["private"];
  const scopes = values.map(String).filter((value) => allowed.has(value)) as VisibilityScope[];
  return scopes.length ? scopes : ["private"];
}

export function isLivingEnvelope(value: any): value is LivingEnvelope {
  return Boolean(
    value && typeof value === "object" && value.id && value.kind && value.contentHash &&
    Number.isFinite(Number(value.revision)) && value.payload !== undefined && value.authority,
  );
}

export async function dvToLivingEnvelope(dv: any): Promise<LivingEnvelope<Record<string, any>>> {
  if (isLivingEnvelope(dv)) return dv;
  const attrs = dv?.attrs || {};
  const meta = dv?.meta || {};
  const createdAt = iso(meta.createdAt ?? meta.updatedAt ?? meta.ts ?? dv?.ts);
  const authority = text(meta.authority, attrs.authority, meta.originNode, attrs.nodeId, attrs.actorId, "utopy.market.legacy");
  const causal: Record<string, unknown> = {};
  for (const field of CAUSAL_FIELDS) {
    const value = attrs[field] ?? meta[field] ?? dv?.[field];
    if (value != null && value !== "") causal[field] = value;
  }
  return createEnvelope({
    id: text(dv?.id),
    kind: text(dv?.kind),
    revision: number(meta.revision ?? meta.version ?? attrs.revision ?? attrs.version, 1),
    threadId: text(attrs.threadId, meta.threadId, dv?.threadId) || undefined,
    chainId: text(attrs.chainId, meta.chainId, dv?.chainId) || undefined,
    rootId: text(attrs.rootId, attrs.rootDvId, meta.rootId) || undefined,
    parentId: text(attrs.parentId, attrs.parentDvId, meta.parentId) || undefined,
    respondsTo: text(meta.respondsTo, attrs.respondsTo, attrs.proposalRef?.id) || undefined,
    sourceActorId: text(attrs.actorId, attrs.issuerActorId, meta.issuer, authority),
    sourceNodeId: text(attrs.nodeId, attrs.sellerNodeId, meta.originNode) || undefined,
    targetNodeId: text(attrs.targetNodeId) || undefined,
    participants: Array.isArray(attrs.participants) ? attrs.participants.map(String) : undefined,
    traits: Array.isArray(dv?.traits) ? dv.traits.map(String) : undefined,
    scopes: scopesOf(dv),
    createdAt,
    expiresAt: expirationOf(dv, createdAt),
    authority,
    payload: {
      dv,
      causal,
      legacyHash: meta.contentHash || meta.hash || dv?.contentHash || dv?.hash || null,
      legacyAuthority: authority,
      legacyOwnership: meta.ownership || dv?.ownership || null,
    },
  });
}

export function livingEnvelopeToDV(envelope: LivingEnvelope<any>): any {
  const legacy = envelope?.payload?.dv;
  if (legacy?.id && legacy?.kind) {
    return {
      ...legacy,
      attrs: { ...(legacy.attrs || {}), participants: envelope.participants, expiresAt: envelope.expiresAt },
      meta: {
        ...(legacy.meta || {}),
        scopes: envelope.scopes || ["private"],
        authority: envelope.authority,
        ownership: envelope.ownership,
        runtimeEnvelope: envelope,
        runtimeVerified: true,
        runtimeEnvelopeId: envelope.id,
        runtimeContentHash: envelope.contentHash,
        runtimeAuthority: envelope.authority,
        runtimeRevision: envelope.revision,
      },
    };
  }
  return {
    id: envelope.id,
    kind: envelope.kind,
    attrs: {
      ...(envelope.payload && typeof envelope.payload === "object" ? envelope.payload : { value: envelope.payload }),
      threadId: envelope.threadId,
      chainId: envelope.chainId,
      rootId: envelope.rootId,
      parentId: envelope.parentId,
      respondsTo: envelope.respondsTo,
      actorId: envelope.sourceActorId,
      nodeId: envelope.sourceNodeId,
      targetNodeId: envelope.targetNodeId,
      participants: envelope.participants,
      expiresAt: envelope.expiresAt,
    },
    traits: envelope.traits || [],
    meta: {
      scopes: envelope.scopes || ["private"],
      authority: envelope.authority,
      originNode: envelope.sourceNodeId,
      revision: envelope.revision,
      updatedAt: envelope.createdAt,
      ownership: envelope.ownership,
      policy: envelope.policy,
      runtimeVerified: true,
      runtimeContentHash: envelope.contentHash,
      runtimeEnvelope: envelope,
    },
  };
}
