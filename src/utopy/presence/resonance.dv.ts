import { makeResonanceVisualSignature, makeSessionId } from "./resonance.signature";
import {
  clampPublicTtl,
  DEFAULT_RESONANCE_SECURITY,
  protectPublicGeo,
  sanitizeHumanText,
  sealResonanceDV,
} from "./resonance.security";
import type {
  DVLike,
  ResonanceCapability,
  ResonanceGeo,
  ResonanceIntent,
  ResonancePublisher,
  ResonanceSecurityPolicy,
  ResonanceSigner,
} from "./resonance.types";

export const RESONANCE_TTL = {
  heartbeat: 45_000,
  nearby: 5 * 60_000,
  urgentNeed: 24 * 60 * 60_000,
  publicSignal: 7 * 24 * 60 * 60_000,
  proposal: 15 * 60_000,
} as const;

function makeDVId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}:${uuid}`
    : `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

function cleanList(values: unknown, max = 24): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeHumanText(value, 80).toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, max);
}

function cleanCapability(capability: ResonanceCapability): ResonanceCapability {
  return {
    ...capability,
    id: capability.id ? sanitizeHumanText(capability.id, 120) : undefined,
    domains: cleanList(capability.domains),
    verbs: cleanList(capability.verbs),
    resources: cleanList(capability.resources),
    accepts: cleanList(capability.accepts),
    serviceRadiusKm: Number.isFinite(capability.serviceRadiusKm)
      ? Math.max(0, Number(capability.serviceRadiusKm))
      : undefined,
  };
}

function cleanIntent(intent: ResonanceIntent): ResonanceIntent {
  return {
    ...intent,
    domains: cleanList(intent.domains),
    verbs: cleanList(intent.verbs),
    resources: cleanList(intent.resources),
    quantity: Number.isFinite(intent.quantity)
      ? Math.max(0, Number(intent.quantity))
      : undefined,
    maxDistanceKm: Number.isFinite(intent.maxDistanceKm)
      ? Math.max(0, Number(intent.maxDistanceKm))
      : undefined,
    unit: intent.unit ? sanitizeHumanText(intent.unit, 32) : undefined,
  };
}

export type CreateCapabilityDVInput = {
  nodeId: string;
  by?: string;
  capabilities: ResonanceCapability[];
  labels?: string[];
  geo?: ResonanceGeo | null;
  scopes?: string[];
  ttlMs?: number;
  policy?: ResonanceSecurityPolicy;
};

export function createCapabilityDV(input: CreateCapabilityDVInput): DVLike {
  const now = Date.now();
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const ttlMs = clampPublicTtl(
    input.ttlMs ?? RESONANCE_TTL.publicSignal,
    policy
  );

  return {
    id: makeDVId("capability.offer"),
    kind: "capability.offer",
    ts: now,
    traits: [
      "sem.dv.read",
      "capability:offer",
      "resonance:capable",
      "consent:required",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.resonance.capability@1",
      scopes: input.scopes || ["local", "market"],
      by: input.by || input.nodeId,
      ttl_ms: ttlMs,
      originNode: input.nodeId,
      authority: "origin",
      portable: true,
      exportable: true,
      canMirror: true,
    },
    attrs: {
      node: { id: sanitizeHumanText(input.nodeId, 160) },
      capabilities: input.capabilities.map(cleanCapability),
      geo: protectPublicGeo(input.geo, policy.geoPrecision),
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    labels: (input.labels || []).map((label) => sanitizeHumanText(label, 120)),
  };
}

export type CreateIntentDVInput = {
  actorId: string;
  nodeId?: string | null;
  by?: string;
  intent: ResonanceIntent;
  capabilities?: ResonanceCapability[];
  labels?: string[];
  geo?: ResonanceGeo | null;
  entryMethod?: string;
  contact?: Record<string, unknown>;
  scopes?: string[];
  ttlMs?: number;
  policy?: ResonanceSecurityPolicy;
};

function kindForIntent(intent: ResonanceIntent): string {
  switch (intent.mode) {
    case "need":
      return "need.request";
    case "offer":
      return "capability.offer";
    case "discover":
      return "discovery.request";
    case "collaborate":
      return "collaboration.request";
    case "produce":
      return "production.request";
    default:
      return "presence.intent";
  }
}

export function createIntentDV(input: CreateIntentDVInput): DVLike {
  const now = Date.now();
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const ttlMs = clampPublicTtl(
    input.ttlMs ??
      (input.intent.mode === "need"
        ? RESONANCE_TTL.urgentNeed
        : RESONANCE_TTL.publicSignal),
    policy
  );
  const kind = kindForIntent(input.intent);

  return {
    id: makeDVId(kind),
    kind,
    ts: now,
    traits: [
      "sem.dv.read",
      `intent:${input.intent.mode}`,
      "resonance:emittable",
      "consent:required",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.resonance.intent@1",
      scopes: input.scopes || ["local", "market"],
      by: input.by || input.actorId,
      ttl_ms: ttlMs,
      originNode: input.nodeId || undefined,
      authority: "emitter",
      portable: true,
      exportable: true,
      canMirror: true,
    },
    attrs: {
      actor: {
        id: sanitizeHumanText(input.actorId, 160),
        nodeId: input.nodeId
          ? sanitizeHumanText(input.nodeId, 160)
          : undefined,
      },
      intent: cleanIntent(input.intent),
      capabilities: (input.capabilities || []).map(cleanCapability),
      geo: protectPublicGeo(input.geo, policy.geoPrecision),
      entryMethod: sanitizeHumanText(input.entryMethod || "resonance", 32),
      contact: input.contact || undefined,
      status: "emitting",
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    labels: (input.labels || []).map((label) => sanitizeHumanText(label, 160)),
  };
}

export type CreateResonanceBeaconInput = {
  sourceDV: DVLike;
  actorId: string;
  nodeId?: string | null;
  sessionId?: string;
  sequence?: number;
  periodMs?: number;
  ttlMs?: number;
  scope?: string;
  geo?: ResonanceGeo | null;
  policy?: ResonanceSecurityPolicy;
  signer?: ResonanceSigner;
};

export async function createResonanceBeacon(
  input: CreateResonanceBeaconInput
): Promise<DVLike> {
  const now = Date.now();
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const periodMs = Math.max(8_000, input.periodMs ?? 20_000);
  const ttlMs = clampPublicTtl(
    Math.max(periodMs * 2, input.ttlMs ?? RESONANCE_TTL.heartbeat),
    policy
  );
  const sessionId = input.sessionId || makeSessionId();
  const sequence = Math.max(0, input.sequence || 0);
  const visual = makeResonanceVisualSignature(
    input.sourceDV.id,
    input.sourceDV.kind,
    input.nodeId || input.actorId
  );

  const dv: DVLike = {
    id: `presence.signal:${sessionId}:${sequence}`,
    kind: "presence.signal",
    ts: now,
    traits: [
      "sem.dv.read",
      "presence:signal",
      "resonance:frequency",
      "interaction:passive",
      "consent:required",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.resonance.frequency@1",
      scopes: input.sourceDV.meta?.scopes || ["local", "market"],
      by: input.sourceDV.meta?.by || input.actorId,
      ttl_ms: ttlMs,
      originNode: input.nodeId || input.sourceDV.meta?.originNode,
      authority: "ephemeral-emitter",
      portable: true,
      exportable: true,
      canMirror: true,
    },
    attrs: {
      actor: {
        id: sanitizeHumanText(input.actorId, 160),
        nodeId: input.nodeId
          ? sanitizeHumanText(input.nodeId, 160)
          : undefined,
      },
      sessionId,
      scope: input.scope || "resonance",
      stage: "emitting",
      target: {
        kind: input.sourceDV.kind,
        id: input.sourceDV.id,
      },
      source: {
        dvId: input.sourceDV.id,
        kind: input.sourceDV.kind,
      },
      intent: input.sourceDV.attrs?.intent,
      capabilities: input.sourceDV.attrs?.capabilities,
      geo: protectPublicGeo(
        input.geo || input.sourceDV.attrs?.geo,
        policy.geoPrecision
      ),
      entryMethod: "resonance",
      frequency: {
        protocol: "utopy.resonance/1",
        signature: visual.id,
        sessionId,
        sequence,
        period_ms: periodMs,
        phase: visual.phase,
        emittedAt: now,
        expiresAt: now + ttlMs,
      },
      security: {
        requiresConsent: true,
        automaticActions: false,
        preciseLocationShared: policy.geoPrecision === "exact",
      },
    },
    labels: input.sourceDV.labels?.slice(0, 3),
  };

  return sealResonanceDV(dv, input.signer);
}

export async function publishResonanceDV(
  publisher: ResonancePublisher,
  dv: DVLike
): Promise<DVLike> {
  await publisher(dv);
  return dv;
}
