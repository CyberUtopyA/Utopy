import type { LivingEnvelope } from "utopy";
import { livingEnvelopeToDV } from "./livingEnvelope.adapter";

const MAX_BYTES = 256 * 1024;
const PRODUCT_KINDS = new Set(["mt:producto", "producto", "market.product"]);
const MEDIA_KEYS = new Set(["image", "imageUrl", "imagen", "thumbnail", "cover", "mediaUrl"]);
const FORBIDDEN_TEXT = /<\s*(script|iframe|object|embed)|javascript\s*:|on(?:error|load|click)\s*=/i;

function text(...values: unknown[]): string {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

function safeMedia(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function sanitize(value: unknown, key = "", depth = 0): any {
  if (depth > 12) throw new Error("projection-depth");
  if (typeof value === "string") {
    if (value.length > 20_000 || FORBIDDEN_TEXT.test(value)) throw new Error("projection-text");
    return MEDIA_KEYS.has(key) ? safeMedia(value) : value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }
  if (Array.isArray(value)) {
    if (value.length > 512) throw new Error("projection-array");
    return value.map((item) => sanitize(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value)) result[childKey] = sanitize(child, childKey, depth + 1);
    return result;
  }
  return value;
}

export function projectVerifiedRuntimeEnvelope(envelope: LivingEnvelope): { accepted: true; dv: any } | { accepted: false; reason: string } {
  try {
    if (JSON.stringify(envelope).length > MAX_BYTES) return { accepted: false, reason: "size" };
    const nestedKind = (envelope.payload as any)?.dv?.kind;
    if (["studio.entitlement", "studio.pass.catalog", "authority.trust", "utopy.node.manifest", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(nestedKind)
      && nestedKind !== envelope.kind) return { accepted: false, reason: "nested-contract-mismatch" };
    const dv = sanitize(livingEnvelopeToDV(envelope));
    const attrs = dv.attrs || {};
    const revision = Number(envelope.revision || dv?.meta?.revision || attrs.revision || 0);
    if (!Number.isInteger(revision) || revision < 1) return { accepted: false, reason: "revision" };
    if (envelope.kind === "studio.entitlement") {
      if (dv.id !== envelope.id || dv.kind !== envelope.kind || text(attrs.nodeId) !== text(envelope.targetNodeId) || text(dv?.meta?.authority) !== envelope.authority) return { accepted: false, reason: "entitlement-authority" };
      if (!text(attrs.actorId) || !envelope.participants?.includes(attrs.actorId) || !envelope.participants?.includes(attrs.nodeId) || !envelope.scopes?.includes("participants")) return { accepted: false, reason: "entitlement-participants" };
      if (Number(attrs.revision) !== envelope.revision || Number(dv?.meta?.revision) !== envelope.revision) return { accepted: false, reason: "entitlement-revision" };
    }

    if (envelope.kind === "utopy.node.manifest") {
      if (text(attrs.nodeId) !== envelope.authority) return { accepted: false, reason: "manifest-nodeId" };
      if (!Array.isArray(attrs.capabilities)) return { accepted: false, reason: "manifest-capabilities" };
      if (!text(attrs.issuedAt)) return { accepted: false, reason: "manifest-issuedAt" };
      if (!Array.isArray(envelope.scopes) || !envelope.scopes.includes("public")) return { accepted: false, reason: "manifest-scopes" };
      if (!envelope.expiresAt || Date.parse(envelope.expiresAt) <= Date.now()) return { accepted: false, reason: "expiry" };
    }

    if (PRODUCT_KINDS.has(envelope.kind)) {
      const productId = text(attrs.productId, dv.productId);
      const sellerNodeId = text(attrs.sellerNodeId, attrs.nodeId);
      if (!productId) return { accepted: false, reason: "productId" };
      if (!sellerNodeId || sellerNodeId !== envelope.authority) return { accepted: false, reason: "sellerNodeId" };
      if (attrs.storeId != null && !text(attrs.storeId)) return { accepted: false, reason: "storeId" };
    }

    // Preserve the exact signed envelope: sanitization is for presentation, never for signature material.
    dv.meta.runtimeEnvelope = envelope;
    return { accepted: true, dv };
  } catch (error: any) {
    return { accepted: false, reason: String(error?.message || "projection") };
  }
}
