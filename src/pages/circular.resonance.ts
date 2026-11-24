import {
  createIntentDV,
  createResonanceBeacon,
} from "../utopy/presence/resonance.dv";
import { matchIntentWithCapabilities } from "../utopy/presence/resonance.matcher";
import {
  DEFAULT_RESONANCE_SECURITY,
  sealResonanceDV,
} from "../utopy/presence/resonance.security";
import type {
  DVLike,
  ResonanceCapability,
  ResonanceGeo,
  ResonancePublisher,
  ResonanceSecurityPolicy,
} from "../utopy/presence/resonance.types";

function value(input: unknown): string {
  return typeof input === "string"
    ? input.trim()
    : input == null
      ? ""
      : String(input).trim();
}

function unique(values: unknown[]): string[] {
  return Array.from(
    new Set(values.map(value).map((item) => item.toLowerCase()).filter(Boolean))
  );
}

function traitsOf(dv: DVLike): string[] {
  return Array.isArray(dv.traits) ? dv.traits.map(value) : [];
}

function circularGeo(dv: DVLike): ResonanceGeo | null {
  const attrs = dv.attrs || {};
  const root = dv as any;
  const raw =
    attrs.geo ||
    attrs.location ||
    (attrs.lat != null ? { lat: attrs.lat, lng: attrs.lng ?? attrs.lon } : null) ||
    root.geo ||
    root.location ||
    (root.lat != null ? { lat: root.lat, lng: root.lng ?? root.lon } : null) ||
    dv.meta?.geo ||
    dv.meta?.location;
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng ?? raw?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { ...raw, lat, lng, source: raw?.source || "node" }
    : null;
}

function isOfferLike(dv: DVLike): boolean {
  const kind = value(dv.kind).toLowerCase();
  const traits = traitsOf(dv).map((trait) => trait.toLowerCase());
  const side = value(dv.attrs?.side || dv.meta?.side).toLowerCase();
  return (
    kind.includes("offer") ||
    kind === "material.recovered" ||
    kind === "urban.mining.lot" ||
    side === "sell" ||
    traits.includes("mt:supply")
  );
}

function circularResources(dv: DVLike): string[] {
  const attrs = dv.attrs || {};
  return unique([
    attrs.materialKey,
    attrs.materialName,
    attrs.productoId,
    attrs.productoNombre,
    attrs.category,
    ...(Array.isArray(attrs.recoverables) ? attrs.recoverables : []),
  ]);
}

function circularDomains(dv: DVLike): string[] {
  const attrs = dv.attrs || {};
  return unique([
    "circular",
    attrs.domain,
    attrs.category,
    value(dv.kind).replace(/[.:_-]+/g, " "),
    ...traitsOf(dv).filter((trait) => /circular|material|work|supply|demand/.test(trait)),
  ]);
}

function capabilityFromCircularDV(dv: DVLike): ResonanceCapability {
  const attrs = dv.attrs || {};
  const offer = isOfferLike(dv);
  return {
    id: `cap:${dv.id}`,
    domains: circularDomains(dv),
    verbs: offer
      ? ["offer", "supply", "recover", "reuse", "transport"]
      : ["request", "receive", "process", "produce"],
    resources: circularResources(dv),
    quantities: [
      {
        resource: circularResources(dv)[0] || value(dv.kind),
        max: Number(attrs.quantity ?? attrs.cantidad ?? attrs.stock ?? 0) || undefined,
        unit: value(attrs.unit || attrs.unidad || "u"),
      },
    ],
    serviceRadiusKm: Number(attrs.serviceRadiusKm || 50),
  };
}

export type ResonateCircularInput = {
  dv: DVLike;
  actorId: string;
  nodeId?: string | null;
  publishDV: ResonancePublisher;
  liveDVs?: DVLike[];
  policy?: ResonanceSecurityPolicy;
  publishProposals?: boolean;
};

export async function resonateCircularDV(input: ResonateCircularInput) {
  const source = input.dv;
  const attrs = source.attrs || {};
  const offer = isOfferLike(source);
  const capability = capabilityFromCircularDV(source);
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const labels = [
    ...(source.labels || []),
    value(attrs.title || attrs.materialName || source.kind),
    value(attrs.description || attrs.domain),
  ].filter(Boolean);

  const intentDV = createIntentDV({
    actorId: input.actorId,
    nodeId: input.nodeId,
    intent: {
      mode: offer ? "offer" : "need",
      domains: capability.domains,
      verbs: capability.verbs,
      resources: capability.resources,
      quantity: Number(attrs.quantity ?? attrs.cantidad ?? 0) || undefined,
      unit: value(attrs.unit || attrs.unidad || "u"),
      maxDistanceKm: Number(attrs.maxDistanceKm || 50),
    },
    capabilities: offer ? [capability] : [],
    labels: labels.slice(0, 3),
    geo: circularGeo(source),
    entryMethod: "resonance",
    scopes: source.meta?.scopes || ["local", "market"],
    policy,
  });
  intentDV.attrs = {
    ...(intentDV.attrs || {}),
    source: { dvId: source.id, kind: source.kind },
    chainId: attrs.chainId || source.meta?.chainId || undefined,
    rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
    parentDvId: source.id,
    sourceDvIds: [source.id],
    stage: attrs.stage || source.meta?.stage || undefined,
    threadId: attrs.threadId || source.meta?.threadId || undefined,
    orgId: attrs.orgId || source.meta?.orgId || undefined,
    territoryId: attrs.territoryId || source.meta?.territoryId || undefined,
  };
  intentDV.meta = {
    ...(intentDV.meta || {}),
    respondsTo: source.id,
    chainId: attrs.chainId || source.meta?.chainId || undefined,
    rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
    parentDvId: source.id,
    stage: attrs.stage || source.meta?.stage || undefined,
  };

  const sealedIntent = await sealResonanceDV(intentDV);
  await input.publishDV(sealedIntent);

  const beacon = await createResonanceBeacon({
    sourceDV: sealedIntent,
    actorId: input.actorId,
    nodeId: input.nodeId,
    geo: circularGeo(source),
    scope: "circular",
    policy,
  });
  beacon.attrs = {
    ...(beacon.attrs || {}),
    chainId: attrs.chainId || source.meta?.chainId || undefined,
    rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
    parentDvId: sealedIntent.id,
    sourceDvIds: [source.id, sealedIntent.id],
    stage: attrs.stage || source.meta?.stage || undefined,
  };
  beacon.meta = {
    ...(beacon.meta || {}),
    chainId: attrs.chainId || source.meta?.chainId || undefined,
    rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
    parentDvId: sealedIntent.id,
    stage: attrs.stage || source.meta?.stage || undefined,
  };
  await input.publishDV(beacon);

  const capabilityDVs = (input.liveDVs || []).filter(
    (dv) =>
      dv.kind === "capability.offer" ||
      Array.isArray(dv.attrs?.capabilities) ||
      dv.traits?.includes("resonance:capable")
  );
  const rawMatches = offer
    ? []
    : matchIntentWithCapabilities(sealedIntent, capabilityDVs);

  const matches = [];
  for (const match of rawMatches) {
    const proposalWithChain: DVLike = {
      ...match.proposalDV,
      attrs: {
        ...(match.proposalDV.attrs || {}),
        chainId: attrs.chainId || source.meta?.chainId || undefined,
        rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
        parentDvId: sealedIntent.id,
        sourceDvIds: [source.id, sealedIntent.id],
        stage: attrs.stage || source.meta?.stage || undefined,
        threadId: attrs.threadId || source.meta?.threadId || undefined,
      },
      meta: {
        ...(match.proposalDV.meta || {}),
        chainId: attrs.chainId || source.meta?.chainId || undefined,
        rootDvId: attrs.rootDvId || source.meta?.rootDvId || source.id,
        parentDvId: sealedIntent.id,
        stage: attrs.stage || source.meta?.stage || undefined,
      },
    };
    const proposalDV = await sealResonanceDV(proposalWithChain);
    const sealedMatch = { ...match, proposalDV };
    matches.push(sealedMatch);
    if (input.publishProposals !== false) {
      await input.publishDV(proposalDV);
    }
  }

  const proposals = matches.map((match) => match.proposalDV);

  return {
    sourceDV: source,
    intentDV: sealedIntent,
    beaconDV: beacon,
    matches,
    proposals,
  };
}

export function createResonanceResponse(input: {
  proposalDV: DVLike;
  by: string;
  accepted: boolean;
  message?: string;
}): DVLike {
  const now = Date.now();
  return {
    id: `resonance.response:${input.proposalDV.id}:${now}`,
    kind: "resonance.response",
    ts: now,
    traits: ["sem.dv.outcome", "resonance:response", "consent:explicit"],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.resonance.response@1",
      scopes: ["participants"],
      by: input.by,
      ttl_ms: 24 * 60 * 60_000,
      respondsTo: input.proposalDV.id,
    },
    attrs: {
      proposalRef: {
        id: input.proposalDV.id,
        kind: input.proposalDV.kind,
      },
      decision: input.accepted ? "accepted" : "declined",
      message: value(input.message) || undefined,
      security: {
        explicitConsent: true,
        automaticActions: false,
      },
    },
    labels: [input.accepted ? "Resonancia aceptada" : "Resonancia rechazada"],
  };
}
