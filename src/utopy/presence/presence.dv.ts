import type { PresenceScanInput, PresenceSignal } from "./presence.types";
import { makePresenceId } from "./presence.id";
import type { DVLike, ResonanceGeo } from "./resonance.types";

export type PresenceLifetime =
  | "heartbeat"
  | "nearby"
  | "urgent"
  | "signal"
  | "persistent";

const TTL_BY_LIFETIME: Record<PresenceLifetime, number> = {
  heartbeat: 30_000,
  nearby: 5 * 60_000,
  urgent: 24 * 60 * 60_000,
  signal: 7 * 24 * 60 * 60_000,
  persistent: 30 * 24 * 60 * 60_000,
};

export function presenceTtlMs(
  lifetime: PresenceLifetime = "heartbeat",
  override?: number
): number {
  if (Number.isFinite(override) && Number(override) > 0) {
    return Math.max(10_000, Number(override));
  }
  return TTL_BY_LIFETIME[lifetime];
}

export function buildPresenceSignal(input: PresenceScanInput): PresenceSignal {
  const ts = input.ts || new Date().toISOString();
  const labels = (input.labels || []).filter(Boolean);

  return {
    id: input.id || makePresenceId("presence"),
    nodeId: input.nodeId || undefined,
    ns: input.ns || "utopy:presence",
    kind: input.kind || "custom",
    title: input.title || labels[0] || "Señal viva",
    subtitle: input.subtitle || labels[1] || "",
    description: input.description || labels[2] || "",
    labels,
    strength: input.strength ?? 0.8,
    distanceLabel: input.distanceLabel || "",
    distanceKm: input.distanceKm ?? null,
    image: input.image || null,
    actorId: input.actorId || null,
    productId: input.productId || null,
    offerId: input.offerId || null,
    orderId: input.orderId || null,
    threadId: input.threadId || null,
    sceneId: input.sceneId || null,
    invoiceId: input.invoiceId || null,
    receiptId: input.receiptId || null,
    sessionId: input.sessionId || null,
    scope: input.scope || null,
    stage: input.stage || null,
    sourceDVId: input.sourceDVId || input.sourceDV?.id || null,
    entryMethod: input.entryMethod || "unknown",
    geo: input.geo || null,
    intent: input.intent || null,
    capabilities: input.capabilities || [],
    signature: input.signature || null,
    verified: input.verified || false,
    expiresAt: input.expiresAt ?? null,
    actions: input.actions || [],
    meta: input.meta || {},
    sourceDV: input.sourceDV || null,
    ts,
  };
}

export type BuildPresenceDVOptions = {
  lifetime?: PresenceLifetime;
  ttlMs?: number;
  sessionId?: string;
  sequence?: number;
  scope?: string;
  stage?: string;
  geo?: ResonanceGeo | null;
  originNode?: string;
  scopes?: string[];
  entryMethod?: string;
};

export function buildPresenceDV(
  signal: PresenceSignal,
  options: BuildPresenceDVOptions = {}
): DVLike {
  const now = Date.now();
  const ttlMs = presenceTtlMs(options.lifetime, options.ttlMs);
  const sessionId = options.sessionId || signal.sessionId || signal.id;

  return {
    id: `presence.signal:${signal.id}`,
    kind: "presence.signal",
    ts: now,
    traits: [
      "sem.dv.read",
      "presence:signal",
      "resonance:emittable",
      "interaction:passive",
      "consent:required",
    ],
    meta: {
      ...(signal.meta || {}),
      ns: signal.ns || "utopy:presence",
      ts: new Date(now).toISOString(),
      schema: "utopy.presence.signal@1",
      scopes: options.scopes || ["local"],
      by: signal.actorId || signal.nodeId || undefined,
      ttl_ms: ttlMs,
      source: "utopy.presence.core",
      originNode: options.originNode || signal.nodeId,
      authority: "ephemeral-emitter",
      portable: true,
      exportable: true,
      canMirror: true,
    },
    attrs: {
      actor: {
        id: signal.actorId || undefined,
        nodeId: signal.nodeId || undefined,
      },
      sessionId,
      scope: options.scope || signal.scope || "presence",
      stage: options.stage || signal.stage || "active",
      target: {
        kind: signal.kind,
        id:
          signal.sourceDVId ||
          signal.productId ||
          signal.offerId ||
          signal.orderId ||
          undefined,
        threadId: signal.threadId || undefined,
      },
      source: signal.sourceDVId
        ? { dvId: signal.sourceDVId, kind: signal.sourceDV?.kind }
        : undefined,
      productId: signal.productId || undefined,
      offerId: signal.offerId || undefined,
      orderId: signal.orderId || undefined,
      threadId: signal.threadId || undefined,
      entryMethod: options.entryMethod || signal.entryMethod || "resonance",
      geo: options.geo || signal.geo || undefined,
      intent: signal.intent || undefined,
      capabilities: signal.capabilities?.length
        ? signal.capabilities
        : undefined,
      frequency: {
        protocol: "utopy.resonance/1",
        signature: signal.signature || undefined,
        sessionId,
        sequence: options.sequence || 0,
        emittedAt: now,
        expiresAt: now + ttlMs,
      },
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    labels: [signal.title, signal.subtitle, signal.description].filter(
      (label): label is string => Boolean(label)
    ),
  };
}
