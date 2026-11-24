import { mtLiveUpsert } from "./mt.liveStore";
import { createIntentDV } from "../utopy/presence/resonance.dv";
import { matchIntentWithCapabilities } from "../utopy/presence/resonance.matcher";
import {
  DEFAULT_RESONANCE_SECURITY,
  protectPublicGeo,
  sanitizeHumanText,
  sealResonanceDV,
} from "../utopy/presence/resonance.security";
import { startManagedResonanceFrequency } from "../utopy/presence/resonance.runtime";
import type {
  DVLike,
  ResonanceGeo,
  ResonanceMatch,
  ResonanceSecurityPolicy,
} from "../utopy/presence/resonance.types";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

export type SymbioticPublishOptions = {
  broadcast?: boolean;
};

export type PublishSymbioticSignalInput = {
  text: string;
  actorId: string;
  actorName?: string | null;
  nodeId?: string | null;
  geo?: ResonanceGeo | null;
  liveDVs?: DVLike[];
  scopes?: string[];
  maxDistanceKm?: number;
  policy?: ResonanceSecurityPolicy;
  broadcast?: boolean;
  activeActor?: any | null;
};

export type PublishSymbioticOfferInput = {
  signalDV: DVLike;
  text: string;
  actorId: string;
  actorName?: string | null;
  nodeId?: string | null;
  geo?: ResonanceGeo | null;
  amount?: number | null;
  currency?: string | null;
  availability?: string | null;
  evidence?: string[];
  scopes?: string[];
  policy?: ResonanceSecurityPolicy;
  broadcast?: boolean;
  allLive?: DVLike[];
  activeActor?: any | null;
};

export type AcceptSymbioticOfferInput = {
  signalDV: DVLike;
  offerDV: DVLike;
  actorId: string;
  actorName?: string | null;
  message?: string | null;
  broadcast?: boolean;
  allLive?: DVLike[];
  activeActor?: any | null;
};

const STOP_WORDS = new Set(
  [
    "a",
    "al",
    "algo",
    "con",
    "como",
    "de",
    "del",
    "el",
    "ella",
    "en",
    "es",
    "esta",
    "este",
    "hacer",
    "la",
    "las",
    "lo",
    "los",
    "me",
    "mi",
    "necesito",
    "para",
    "por",
    "que",
    "quiero",
    "se",
    "ser",
    "su",
    "un",
    "una",
    "y",
    "yo",
  ].map((word) => word.toLowerCase())
);

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * No clasifica profesiones ni negocios. Sólo conserva términos expresados por
 * la persona para que la resonancia los compare con descripciones de capacidad.
 */
export function semanticTermsFromText(text: string, max = 28): string[] {
  const clean = normalized(sanitizeHumanText(text, 1200));
  const words = clean
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  const phrases = words
    .slice(0, 18)
    .map((word, index) =>
      index < words.length - 1 ? `${word} ${words[index + 1]}` : ""
    )
    .filter(Boolean);

  return Array.from(new Set([...words, ...phrases])).slice(0, max);
}

function makeId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}:${uuid}`
    : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

function chainIdOf(dv: DVLike): string {
  return String(dv?.attrs?.chainId || dv?.meta?.chainId || dv?.id || "");
}

function geoOf(dv: DVLike): ResonanceGeo | null {
  const raw = dv?.attrs?.geo || dv?.attrs?.location;
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng ?? raw?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { ...raw, lat, lng }
    : null;
}

function publish(dv: DVLike, broadcast = true): DVLike {
  mtLiveUpsert(dv);

  if (broadcast) {
    try {
      window.dispatchEvent(
        new CustomEvent("utopy.emit", {
          detail: { ns: "mt", say: "dv.upsert", dv },
        })
      );
    } catch {
      // La publicación local continúa disponible fuera del navegador.
    }
  }

  return dv;
}

function capabilityDVs(all: DVLike[]): DVLike[] {
  return (Array.isArray(all) ? all : []).filter(
    (dv) =>
      dv?.kind === "capability.offer" ||
      Array.isArray(dv?.attrs?.capabilities) ||
      dv?.traits?.includes("resonance:capable")
  );
}

function attachSignalRelation(dv: DVLike, signal: DVLike): DVLike {
  const chainId = chainIdOf(signal);
  return {
    ...dv,
    attrs: {
      ...(dv.attrs || {}),
      chainId,
      rootDvId: signal.id,
      parentDvId: signal.id,
      respondsTo: signal.id,
      signalRef: { id: signal.id, kind: signal.kind },
    },
    meta: {
      ...(dv.meta || {}),
      chainId,
      rootDvId: signal.id,
      parentDvId: signal.id,
      respondsTo: signal.id,
    },
  };
}

export async function publishSymbioticSignal(
  input: PublishSymbioticSignalInput
): Promise<{
  signalDV: DVLike;
  matches: ResonanceMatch[];
  proposals: DVLike[];
  frequencyKey: string;
}> {
  const text = sanitizeHumanText(input.text, 1200);
  if (text.length < 3) throw new Error("Escribí qué necesitás, ofrecés o querés crear.");

  const terms = semanticTermsFromText(text);
  if (!terms.length) throw new Error("La señal necesita un poco más de contexto.");

  const chainId = makeId("utopy.chain");
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const draft = createIntentDV({
    actorId: input.actorId,
    nodeId: input.nodeId,
    intent: {
      mode: "discover",
      domains: terms,
      verbs: ["respond", "propose", "offer", "collaborate"],
      resources: terms,
      maxDistanceKm: Number(input.maxDistanceKm || 80),
    },
    labels: [text.slice(0, 160), "Señal Viva abierta"],
    geo: input.geo || null,
    entryMethod: "resonance",
    scopes: input.scopes?.length ? input.scopes : ["local", "market"],
    policy,
  });

  const relational: DVLike = {
    ...draft,
    kind: "resonance.signal",
    traits: Array.from(
      new Set([
        ...(draft.traits || []),
        "utopy:symbiotic",
        "signal:open",
        "offer:requested",
      ])
    ),
    attrs: {
      ...(draft.attrs || {}),
      chainId,
      rootDvId: draft.id,
      text,
      title: text.slice(0, 160),
      semanticTerms: terms,
      interactionRole: "signal",
      state: "open",
      actorId: input.actorId,
      actorName: input.actorName || null,
      nodeId: input.nodeId || null,
      location: draft.attrs?.geo || null,
      security: {
        ...(draft.attrs?.security || {}),
        requiresConsent: true,
        automaticActions: false,
        exactAddressPublic: false,
      },
    },
    meta: {
      ...(draft.meta || {}),
      chainId,
      rootDvId: draft.id,
      schema: "utopy.symbiotic.signal@1",
    },
  };
  const signalDV = await sealResonanceDV(relational);
  const authorizedSignal = (
    await publishAuthorizedDV({
      dv: signalDV,
      allLive: input.liveDVs,
      activeActor: input.activeActor,
      action: signalDV.kind,
      actingAsNodeId: input.nodeId || null,
    })
  ).dv;

  const matches = matchIntentWithCapabilities(
    authorizedSignal,
    capabilityDVs(input.liveDVs || [])
  );
  const proposals: DVLike[] = [];

  for (const match of matches) {
    const proposal = await sealResonanceDV(
      attachSignalRelation(match.proposalDV, authorizedSignal)
    );
    proposals.push(proposal);
    publish(proposal, input.broadcast !== false);
  }

  const frequency = startManagedResonanceFrequency({
    sourceDV: authorizedSignal,
    actorId: input.actorId,
    nodeId: input.nodeId,
    geo: input.geo || null,
    scope: "symbiotic",
    periodMs: 20_000,
    maxDurationMs: 4 * 60 * 60_000,
    policy,
    publishDV: async (beacon) => {
      publish(beacon, input.broadcast !== false);
    },
  });

  return {
    signalDV: authorizedSignal,
    matches,
    proposals,
    frequencyKey: frequency.key,
  };
}

export async function publishSymbioticOffer(
  input: PublishSymbioticOfferInput
): Promise<DVLike> {
  const text = sanitizeHumanText(input.text, 1000);
  if (text.length < 3) throw new Error("La oferta necesita una explicación.");

  const now = Date.now();
  const chainId = chainIdOf(input.signalDV);
  const terms = semanticTermsFromText(text);
  const policy = input.policy || DEFAULT_RESONANCE_SECURITY;
  const rawGeo = protectPublicGeo(
    input.geo || geoOf(input.signalDV),
    policy.geoPrecision
  );

  const offer: DVLike = {
    id: makeId("resonance.offer"),
    kind: "resonance.offer",
    ts: now,
    traits: [
      "utopy:symbiotic",
      "sem.dv.answer",
      "offer:human",
      "consent:required",
      "execution:forbidden",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.symbiotic.offer@1",
      scopes: input.scopes?.length ? input.scopes : ["participants"],
      by: input.actorId,
      originNode: input.nodeId || undefined,
      chainId,
      rootDvId: input.signalDV.id,
      parentDvId: input.signalDV.id,
      respondsTo: input.signalDV.id,
      ttl_ms: 24 * 60 * 60_000,
    },
    attrs: {
      chainId,
      rootDvId: input.signalDV.id,
      parentDvId: input.signalDV.id,
      respondsTo: input.signalDV.id,
      signalRef: { id: input.signalDV.id, kind: input.signalDV.kind },
      interactionRole: "offer",
      state: "proposed",
      text,
      title: text.slice(0, 160),
      semanticTerms: terms,
      actorId: input.actorId,
      actorName: input.actorName || null,
      nodeId: input.nodeId || null,
      amount:
        input.amount == null || !Number.isFinite(Number(input.amount))
          ? null
          : Number(input.amount),
      currency: input.currency || null,
      availability: sanitizeHumanText(input.availability || "", 160) || null,
      evidence: (input.evidence || [])
        .map((item) => sanitizeHumanText(item, 180))
        .filter(Boolean)
        .slice(0, 12),
      geo: rawGeo,
      location: rawGeo,
      security: {
        requiresConsent: true,
        automaticActions: false,
        executable: false,
        exactAddressPublic: false,
      },
    },
    labels: ["Oferta para Señal Viva", text.slice(0, 160)],
  };

  const sealed = await sealResonanceDV(offer);
  return (
    await publishAuthorizedDV({
      dv: sealed,
      allLive: input.allLive,
      activeActor: input.activeActor,
      action: sealed.kind,
      actingAsNodeId: input.nodeId || null,
      targetNodeId:
        input.signalDV?.attrs?.nodeId || input.signalDV?.meta?.originNode || null,
    })
  ).dv;
}

export async function acceptSymbioticOffer(
  input: AcceptSymbioticOfferInput
): Promise<DVLike> {
  const now = Date.now();
  const chainId = chainIdOf(input.signalDV);
  const response: DVLike = {
    id: makeId("resonance.response"),
    kind: "resonance.response",
    ts: now,
    traits: [
      "utopy:symbiotic",
      "sem.dv.outcome",
      "resonance:response",
      "consent:explicit",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.symbiotic.response@1",
      scopes: ["participants"],
      by: input.actorId,
      chainId,
      rootDvId: input.signalDV.id,
      parentDvId: input.offerDV.id,
      respondsTo: input.offerDV.id,
    },
    attrs: {
      chainId,
      rootDvId: input.signalDV.id,
      parentDvId: input.offerDV.id,
      respondsTo: input.offerDV.id,
      signalRef: { id: input.signalDV.id, kind: input.signalDV.kind },
      offerRef: { id: input.offerDV.id, kind: input.offerDV.kind },
      interactionRole: "acceptance",
      state: "accepted",
      decision: "accepted",
      actorId: input.actorId,
      actorName: input.actorName || null,
      message: sanitizeHumanText(input.message || "Oferta elegida", 400),
      threadId: makeId("mt.thread.symbiotic"),
      security: {
        explicitConsent: true,
        automaticActions: false,
        preciseLocationShared: false,
      },
    },
    labels: ["Oferta elegida", "Conexión pendiente de coordinación"],
  };

  const sealed = await sealResonanceDV(response);
  return (
    await publishAuthorizedDV({
      dv: sealed,
      allLive: input.allLive,
      activeActor: input.activeActor,
      action: sealed.kind,
      targetNodeId:
        input.offerDV?.attrs?.nodeId || input.offerDV?.meta?.originNode || null,
    })
  ).dv;
}

export function offersForSignal(signalDV: DVLike, all: DVLike[]): DVLike[] {
  return (Array.isArray(all) ? all : [])
    .filter((dv) => {
      if (dv?.kind !== "resonance.offer") return false;
      return String(
        dv?.attrs?.signalRef?.id ||
          dv?.attrs?.respondsTo ||
          dv?.meta?.respondsTo ||
          ""
      ) === String(signalDV.id);
    })
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

export function proposalsForSignal(signalDV: DVLike, all: DVLike[]): DVLike[] {
  return (Array.isArray(all) ? all : [])
    .filter((dv) => {
      if (dv?.kind !== "match.proposal") return false;
      return String(
        dv?.attrs?.signalRef?.id || dv?.attrs?.intentRef?.id || ""
      ) === String(signalDV.id);
    })
    .sort((a, b) => Number(b?.attrs?.score || 0) - Number(a?.attrs?.score || 0));
}
