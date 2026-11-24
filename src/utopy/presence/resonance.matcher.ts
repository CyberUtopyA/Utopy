import { sanitizeHumanText } from "./resonance.security";
import type {
  DVLike,
  ResonanceAvailability,
  ResonanceCapability,
  ResonanceGeo,
  ResonanceIntent,
  ResonanceMatch,
  ResonanceMatchReason,
} from "./resonance.types";

export type ResonanceMatchContext = {
  now?: number;
  minScore?: number;
  semanticAliases?: Record<string, string[]>;
  trustScoreByNode?: Record<string, number>;
  isVerified?: (dv: DVLike) => boolean;
  isRevoked?: (dv: DVLike) => boolean;
};

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function tokens(
  values: unknown,
  aliases: Record<string, string[]> = {}
): Set<string> {
  const source = Array.isArray(values) ? values : [values];
  const result = new Set<string>();

  for (const value of source) {
    const phrase = normalized(value);
    if (!phrase) continue;
    result.add(phrase);

    for (const token of phrase.split(/[^a-z0-9]+/i).filter(Boolean)) {
      result.add(token);
      for (const alias of aliases[token] || []) result.add(normalized(alias));
    }
  }

  return result;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const value of a) if (b.has(value)) matches += 1;
  return matches / Math.max(1, Math.min(a.size, b.size));
}

function readGeo(value: unknown): ResonanceGeo | null {
  const geo = value as ResonanceGeo;
  if (
    !geo ||
    !Number.isFinite(geo.lat) ||
    !Number.isFinite(geo.lng) ||
    geo.lat < -90 ||
    geo.lat > 90 ||
    geo.lng < -180 ||
    geo.lng > 180
  ) {
    return null;
  }
  return geo;
}

export function distanceKm(
  from: ResonanceGeo | null,
  to: ResonanceGeo | null
): number | null {
  if (!from || !to) return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) *
      Math.cos(rad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function availableNow(
  availability: ResonanceAvailability | undefined,
  now: number
): boolean {
  if (!availability) return true;
  if (availability.from && now < availability.from) return false;
  if (availability.until && now > availability.until) return false;
  return true;
}

function readIntent(dv: DVLike): ResonanceIntent | null {
  const value = dv?.attrs?.intent as ResonanceIntent | undefined;
  if (value?.mode && Array.isArray(value.domains)) return value;
  return null;
}

function readCapabilities(dv: DVLike): ResonanceCapability[] {
  const values = dv?.attrs?.capabilities;
  if (Array.isArray(values)) {
    return values.filter(
      (value: any) => value && Array.isArray(value.domains)
    );
  }

  const one = dv?.attrs?.capability;
  return one && Array.isArray(one.domains) ? [one] : [];
}

function isExpired(dv: DVLike, now: number): boolean {
  const ts = Number(dv.ts || 0);
  const ttl = Number(dv.meta?.ttl_ms || 0);
  return ts > 0 && ttl > 0 && now > ts + ttl;
}

function nodeIdOf(dv: DVLike): string {
  return String(
    dv.attrs?.node?.id ||
      dv.attrs?.actor?.nodeId ||
      dv.meta?.originNode ||
      dv.meta?.by ||
      ""
  );
}

function createProposalDV(
  intentDV: DVLike,
  capabilityDV: DVLike,
  capability: ResonanceCapability,
  score: number,
  computedDistanceKm: number | null,
  reasons: ResonanceMatchReason[],
  now: number
): DVLike {
  return {
    id: `match.proposal:${intentDV.id}:${capabilityDV.id}:${capability.id || "cap"}`,
    kind: "match.proposal",
    ts: now,
    traits: [
      "sem.dv.answer",
      "resonance:match",
      "consent:required",
      "execution:forbidden",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      schema: "utopy.resonance.match@1",
      scopes: ["participants"],
      ttl_ms: 15 * 60_000,
      by: "utopy.resonator",
      portable: true,
    },
    attrs: {
      status: "proposed",
      intentRef: { id: intentDV.id, kind: intentDV.kind },
      capabilityRef: {
        id: capabilityDV.id,
        kind: capabilityDV.kind,
        capabilityId: capability.id,
      },
      score,
      distanceKm: computedDistanceKm,
      reasons,
      security: {
        requiresConsent: true,
        automaticActions: false,
        executable: false,
      },
    },
    labels: [
      "Resonancia compatible encontrada",
      `${Math.round(score * 100)}% de compatibilidad`,
    ],
  };
}

export function matchIntentWithCapabilities(
  intentDV: DVLike,
  capabilityDVs: DVLike[],
  context: ResonanceMatchContext = {}
): ResonanceMatch[] {
  const now = context.now ?? Date.now();
  const minScore = Math.max(0, Math.min(1, context.minScore ?? 0.36));
  const intent = readIntent(intentDV);
  if (!intent || isExpired(intentDV, now)) return [];

  const intentGeo = readGeo(intentDV.attrs?.geo);
  const aliases = context.semanticAliases || {};
  const intentDomains = tokens(intent.domains, aliases);
  const intentVerbs = tokens(intent.verbs, aliases);
  const intentResources = tokens(intent.resources, aliases);
  const matches: ResonanceMatch[] = [];

  for (const capabilityDV of capabilityDVs) {
    if (isExpired(capabilityDV, now)) continue;
    if (context.isRevoked?.(capabilityDV)) continue;

    const capabilityGeo = readGeo(capabilityDV.attrs?.geo);
    const computedDistanceKm = distanceKm(intentGeo, capabilityGeo);
    const nodeId = nodeIdOf(capabilityDV);
    const verified = context.isVerified?.(capabilityDV) || false;
    const externalTrust = context.trustScoreByNode?.[nodeId];
    const trust = Number.isFinite(externalTrust)
      ? Math.max(0, Math.min(1, Number(externalTrust)))
      : 0.5;

    for (const capability of readCapabilities(capabilityDV)) {
      if (intent.quantity && capability.quantities?.length) {
        const requestedResources = tokens(intent.resources, aliases);
        const compatibleQuantity = capability.quantities.find((quantity) => {
          const resourceMatches = overlap(
            requestedResources,
            tokens(quantity.resource, aliases)
          );
          const unitMatches =
            !intent.unit ||
            !quantity.unit ||
            normalized(intent.unit) === normalized(quantity.unit);
          const enough =
            quantity.max == null || Number(quantity.max) >= Number(intent.quantity);
          return resourceMatches > 0 && unitMatches && enough;
        });
        if (!compatibleQuantity) continue;
      }

      const maxDistance = Math.min(
        intent.maxDistanceKm ?? Number.POSITIVE_INFINITY,
        capability.serviceRadiusKm ?? Number.POSITIVE_INFINITY
      );
      if (
        computedDistanceKm != null &&
        Number.isFinite(maxDistance) &&
        computedDistanceKm > maxDistance
      ) {
        continue;
      }

      if (!availableNow(intent.availability, now)) continue;
      if (!availableNow(capability.availability, now)) continue;

      const domainScore = overlap(
        intentDomains,
        tokens(capability.domains, aliases)
      );
      const verbScore = overlap(
        intentVerbs,
        tokens(capability.verbs, aliases)
      );
      const resourceScore = overlap(
        intentResources,
        tokens(
          [...(capability.resources || []), ...(capability.accepts || [])],
          aliases
        )
      );

      if (domainScore === 0 && verbScore === 0 && resourceScore === 0) continue;

      const geoScore =
        computedDistanceKm == null
          ? 0.45
          : Math.max(0, 1 - computedDistanceKm / Math.max(1, maxDistance || 25));
      const availabilityScore = 1;
      const verificationScore = verified ? 1 : 0.35;
      const score = Math.max(
        0,
        Math.min(
          1,
          domainScore * 0.32 +
            resourceScore * 0.24 +
            verbScore * 0.16 +
            geoScore * 0.1 +
            availabilityScore * 0.08 +
            trust * 0.07 +
            verificationScore * 0.03
        )
      );

      if (score < minScore) continue;

      const reasons: ResonanceMatchReason[] = [];
      if (domainScore > 0) {
        reasons.push({ code: "domain", score: domainScore, label: "Ámbito compatible" });
      }
      if (resourceScore > 0) {
        reasons.push({ code: "resource", score: resourceScore, label: "Recurso compatible" });
      }
      if (verbScore > 0) {
        reasons.push({ code: "verb", score: verbScore, label: "Capacidad compatible" });
      }
      if (computedDistanceKm != null) {
        reasons.push({
          code: "distance",
          score: geoScore,
          label: `${computedDistanceKm.toFixed(1)} km`,
        });
      }
      reasons.push({
        code: "trust",
        score: trust,
        label: "Confianza calculada por el nodo lector",
      });
      reasons.push({
        code: "verification",
        score: verificationScore,
        label: verified ? "Origen verificado" : "Origen todavía no verificado",
      });

      matches.push({
        intentDV,
        capabilityDV,
        capability,
        score,
        distanceKm: computedDistanceKm,
        reasons,
        proposalDV: createProposalDV(
          intentDV,
          capabilityDV,
          capability,
          score,
          computedDistanceKm,
          reasons,
          now
        ),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function explainResonance(match: ResonanceMatch): string {
  const reason = match.reasons
    .filter((item) => item.code !== "trust")
    .slice(0, 3)
    .map((item) => item.label)
    .join(" · ");
  return sanitizeHumanText(
    `${Math.round(match.score * 100)}% compatible${reason ? `: ${reason}` : ""}`,
    220
  );
}
