// src/mt/mt.resonator.ts
// Resonador continuo UTOPY v2.
// Une intención -> capacidad y resultado -> reacción sin conocer comercios.

import { mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";
import { createLatestTask } from "../utils/latestTask.mjs";
import { matchIntentWithCapabilities } from "../utopy/presence/resonance.matcher";
import { sealResonanceDV } from "../utopy/presence/resonance.security";
import type {
  DVLike,
  ResonancePublisher,
} from "../utopy/presence/resonance.types";
import {
  buildOutcomeReactionProposals,
  isOutcomeDV,
  nodeIdentityOf,
  projectDVToCapabilityDV,
  readPurpose,
} from "./utopy.symbiosis";

export type ResonatorResult = {
  projectedCapabilities: DVLike[];
  proposals: DVLike[];
  reactions: DVLike[];
  intentsScanned: number;
  capabilitiesScanned: number;
  outcomesScanned: number;
};

export type ContinuousResonatorOptions = {
  publishDV?: ResonancePublisher;
  maxIntents?: number;
  maxCapabilities?: number;
  maxMatchesPerIntent?: number;
  maxOutcomes?: number;
};

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function timestampOf(dv: DVLike): number {
  const raw = dv?.meta?.updatedAt ?? dv?.meta?.ts ?? dv?.ts ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpired(dv: DVLike, now = Date.now()): boolean {
  const ts = timestampOf(dv);
  const ttl = Number(dv?.meta?.ttl_ms || 0);
  return ts > 0 && ttl > 0 && now > ts + ttl;
}

function isCapabilityDV(dv: DVLike): boolean {
  return Boolean(
    dv?.id &&
      (dv.kind === "capability.offer" ||
        Array.isArray(dv.attrs?.capabilities) ||
        dv.traits?.some((trait) =>
          ["resonance:capable", "resonance.capable", "capability.offer"].includes(
            String(trait),
          ),
        )),
  );
}

function isIntentDV(dv: DVLike): boolean {
  if (!dv?.id || isExpired(dv)) return false;
  return readPurpose(dv)?.state === "requested";
}

function asMatcherIntent(dv: DVLike): DVLike {
  const current = dv.attrs?.intent;
  if (current?.mode && Array.isArray(current?.domains)) return dv;
  const purpose = readPurpose(dv);
  if (!purpose) return dv;
  return {
    ...dv,
    attrs: {
      ...(dv.attrs || {}),
      intent: {
        mode: "need",
        domains: purpose.domains.length ? purpose.domains : [purpose.name],
        verbs: purpose.verbs,
        resources: purpose.resources,
        quantity: dv.attrs?.quantity ?? dv.attrs?.cantidad,
        unit: dv.attrs?.unit ?? dv.attrs?.unidad,
        maxDistanceKm: dv.attrs?.maxDistanceKm,
      },
    },
  };
}

/** Compatibilidad con imports anteriores. */
export const projectOfferToCapabilityDV = projectDVToCapabilityDV;

function proposalAlreadyAnswered(proposalId: string, all: DVLike[]): boolean {
  return all.some(
    (dv) =>
      ["resonance.response", "utopy.reaction.outcome"].includes(dv.kind) &&
      text(dv.meta?.respondsTo || dv.attrs?.proposalRef?.id) === proposalId,
  );
}

async function sealAndPublish(
  dv: DVLike,
  publishDV: ResonancePublisher,
): Promise<DVLike> {
  const sealed = await sealResonanceDV(dv);
  await publishDV(sealed);
  return sealed;
}

export async function reconcileResonanceSnapshot(
  snapshot: DVLike[],
  publishDV: ResonancePublisher,
  options: ContinuousResonatorOptions = {},
): Promise<ResonatorResult> {
  const all = (Array.isArray(snapshot) ? snapshot : []).filter(
    (dv): dv is DVLike => Boolean(dv?.id && dv?.kind),
  );
  const byId = new Map(all.map((dv) => [String(dv.id), dv]));
  const projectedCapabilities: DVLike[] = [];

  // Toda oferta puede expresar capacidades. No se pregunta quién es el comercio.
  for (const offer of all.slice(0, 1500)) {
    const projected = projectDVToCapabilityDV(offer);
    if (!projected) continue;

    const existing = byId.get(projected.id);
    const sourceVersion = projected.attrs?.source?.version;
    const sameVersion =
      existing && existing.attrs?.source?.version === sourceVersion;
    const canonical = sameVersion
      ? existing
      : await sealAndPublish(projected, publishDV);

    projectedCapabilities.push(canonical);
    byId.set(canonical.id, canonical);
  }

  const universe = Array.from(byId.values());
  const capabilities = universe
    .filter((dv) => isCapabilityDV(dv) && !isExpired(dv))
    .slice(0, Math.max(1, options.maxCapabilities || 500));
  const intents = universe
    .filter(isIntentDV)
    .slice(0, Math.max(1, options.maxIntents || 250));
  const proposals: DVLike[] = [];

  for (const intent of intents) {
    const intentNode = nodeIdentityOf(intent);
    const candidates = capabilities.filter((capability) => {
      const capabilityNode = nodeIdentityOf(capability);
      return !intentNode || !capabilityNode || intentNode !== capabilityNode;
    });

    const matcherIntent = asMatcherIntent(intent);
    const matches = matchIntentWithCapabilities(matcherIntent, candidates).slice(
      0,
      Math.max(1, options.maxMatchesPerIntent || 8),
    );

    for (const match of matches) {
      if (byId.has(match.proposalDV.id)) continue;
      if (proposalAlreadyAnswered(match.proposalDV.id, universe)) continue;

      const enriched: DVLike = {
        ...match.proposalDV,
        attrs: {
          ...(match.proposalDV.attrs || {}),
          provider: match.capabilityDV.attrs?.node,
          source: match.capabilityDV.attrs?.source,
          offerRef: match.capabilityDV.attrs?.offerRef,
          action: match.capabilityDV.attrs?.action,
        },
      };
      const sealed = await sealAndPublish(enriched, publishDV);
      proposals.push(sealed);
      byId.set(sealed.id, sealed);
    }
  }

  // Un resultado concreto despierta fidelidad, confianza, inventario, pago,
  // entrega u otra capacidad que haya declarado aceptar ese propósito.
  const outcomes = Array.from(byId.values())
    .filter((dv) => isOutcomeDV(dv) && !isExpired(dv))
    .sort((a, b) => timestampOf(b) - timestampOf(a))
    .slice(0, Math.max(1, options.maxOutcomes || 500));
  const reactions: DVLike[] = [];

  for (const outcome of outcomes) {
    const proposalsForOutcome = buildOutcomeReactionProposals(
      outcome,
      Array.from(byId.values()),
    );
    for (const proposal of proposalsForOutcome) {
      if (byId.has(proposal.id)) continue;
      const sealed = await sealAndPublish(proposal, publishDV);
      reactions.push(sealed);
      byId.set(sealed.id, sealed);
    }
  }

  return {
    projectedCapabilities,
    proposals,
    reactions,
    intentsScanned: intents.length,
    capabilitiesScanned: capabilities.length,
    outcomesScanned: outcomes.length,
  };
}

function defaultPublish(dv: DVLike) {
  mtLiveUpsert(dv as any);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail: { ns: "mt", say: "dv.upsert", dv },
      }),
    );
  }
}

type ActiveRuntime = {
  refs: number;
  release: () => void;
};

let activeRuntime: ActiveRuntime | null = null;

export function startContinuousResonator(
  options: ContinuousResonatorOptions = {},
): () => void {
  if (activeRuntime) {
    activeRuntime.refs += 1;
    return activeRuntime.release;
  }

  const publisher = options.publishDV || defaultPublish;
  // Yield between snapshots instead of chaining reconciliation microtasks indefinitely.
  const work = createLatestTask((snapshot: DVLike[]) => reconcileResonanceSnapshot(snapshot, publisher, options), {
    delay: 80,
    onError: (error: unknown) => console.warn("[UTOPY Resonador] No se pudo reconciliar el pulso.", error),
  });
  const unsubscribe = mtLiveSubscribe((next) => {
    work.push(Array.isArray(next) ? (next as DVLike[]) : []);
  });

  const runtime: ActiveRuntime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;
      work.stop();
      unsubscribe?.();
      if (activeRuntime === runtime) activeRuntime = null;
    },
  };
  activeRuntime = runtime;
  return runtime.release;
}
