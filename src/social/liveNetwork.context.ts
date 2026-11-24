import type {
  ApproximateGeo,
  ContextReason,
  ContextualDV,
  LiveContext,
} from "./liveNetwork.types";
import { canRelate } from "../utopy/territorialCompatibility";
import { isPublicLivingComposition, matchLivingCompositionCandidates } from "../utopy/livingCompositionDiscovery";

const STOP_WORDS = new Set([
  "algo",
  "ante",
  "ahora",
  "available",
  "buy",
  "capable",
  "capability",
  "category",
  "como",
  "con",
  "consent",
  "del",
  "desde",
  "disponible",
  "el",
  "ella",
  "ellos",
  "en",
  "esta",
  "este",
  "feed",
  "find",
  "hacer",
  "human",
  "intent",
  "la",
  "las",
  "live",
  "lo",
  "los",
  "market",
  "me",
  "mi",
  "node",
  "necesito",
  "offer",
  "para",
  "por",
  "presence",
  "profile",
  "public",
  "puedo",
  "que",
  "quiero",
  "request",
  "required",
  "resonance",
  "respond",
  "response",
  "schema",
  "schedule",
  "signal",
  "social",
  "ser",
  "soy",
  "una",
  "uno",
  "unos",
  "utopy",
  "work",
  "y",
]);

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function normalized(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stem(token: string): string {
  const clean = token.replace(/[^a-z0-9]/g, "");
  if (clean.length <= 5) return clean;
  return clean
    .replace(/(aciones|adores|adoras|acion|mente|idades|idad)$/g, "")
    .replace(/s$/g, "")
    .replace(/(ando|iendo|ados|adas|idos|idas|os|as)$/g, "")
    .slice(0, 14);
}

export function tokensFromDV(dv: any): string[] {
  if (!dv) return [];
  const attrs = dv.attrs || {};
  const capabilities = Array.isArray(attrs.capabilities)
    ? attrs.capabilities
    : [];
  const requested = Array.isArray(attrs.requestedCapabilities)
    ? attrs.requestedCapabilities
    : [];
  const profileLabels = Array.isArray(attrs.capabilityLabels)
    ? attrs.capabilityLabels
    : [];
  const corpus = [
    dv.kind,
    ...(Array.isArray(dv.labels) ? dv.labels : []),
    ...(Array.isArray(dv.traits) ? dv.traits : []),
    attrs.title,
    attrs.text,
    attrs.description,
    attrs.bio,
    attrs.intent?.summary,
    attrs.intent?.inputs ? JSON.stringify(attrs.intent.inputs) : "",
    attrs.category,
    attrs.domain,
    attrs.materialKey,
    attrs.materialName,
    attrs.productName,
    attrs.nombre,
    attrs.intent?.domains,
    attrs.intent?.verbs,
    attrs.intent?.resources,
    ...requested,
    ...profileLabels.flatMap((item: any) => [
      item?.key,
      item?.label,
      item?.category,
    ]),
    ...capabilities.flatMap((capability: any) => [
      typeof capability === "string" ? capability : capability?.code,
      capability?.id,
      capability?.key,
      capability?.label,
      capability?.traits,
      capability?.domains,
      capability?.verbs,
      capability?.resources,
    ]),
    ...(Array.isArray(attrs.steps) ? attrs.steps.flatMap((step: any) => [step?.capability?.code, step?.capability?.traits]) : []),
  ]
    .flat(4)
    .map(text)
    .filter(Boolean)
    .join(" ");

  return Array.from(
    new Set(
      normalized(corpus)
        .split(/[^a-z0-9]+/)
        .map(stem)
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  ).slice(0, 80);
}

function actorIds(dv: any): string[] {
  const attrs = dv?.attrs || {};
  const node = attrs.node || {};
  const actor = attrs.actor || {};
  return Array.from(
    new Set(
      [
        attrs.actorId,
        attrs.nodeId,
        attrs.sellerId,
        attrs.buyerId,
        attrs.customerActorId,
        actor.id,
        actor.nodeId,
        node.id,
        dv?.meta?.originNode,
        dv?.meta?.by,
      ]
        .map(text)
        .filter(Boolean),
    ),
  );
}

export function belongsToActor(dv: any, actorId: string) {
  const id = text(actorId);
  return Boolean(id && actorIds(dv).includes(id));
}

export function targetsActor(dv: any, actorId: string) {
  const id = text(actorId);
  if (!id) return false;
  const attrs = dv?.attrs || {};
  const targets = [
    attrs.targetActorId,
    attrs.toActorId,
    attrs.recipientId,
    ...(Array.isArray(attrs.unreadBy) ? attrs.unreadBy : []),
  ]
    .map(text)
    .filter(Boolean);
  return targets.includes(id);
}

function threadIdOf(dv: any) {
  return text(dv?.attrs?.threadId || dv?.meta?.threadId);
}

function responseRefs(dv: any): string[] {
  const attrs = dv?.attrs || {};
  return [
    attrs.respondsTo,
    attrs.target?.id,
    attrs.intentRef?.id,
    attrs.proposalRef?.id,
    attrs.offerRef?.id,
    attrs.source?.dvId,
    dv?.meta?.respondsTo,
  ]
    .map(text)
    .filter(Boolean);
}

function geoOf(dv: any): ApproximateGeo | null {
  const attrs = dv?.attrs || {};
  const raw =
    attrs.geo ||
    attrs.location ||
    (attrs.lat != null
      ? { lat: attrs.lat, lng: attrs.lng ?? attrs.lon }
      : null);
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng ?? raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    precision: "approximate",
    radiusM: Math.max(500, Number(raw?.radiusM || 1200)),
    source: text(raw?.source) || "dv",
  };
}

function timestampOf(dv: any) {
  const raw =
    dv?.meta?.updatedAt ||
    dv?.attrs?.updatedAt ||
    dv?.meta?.ts ||
    dv?.attrs?.ts ||
    dv?.ts;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isClosed(dv: any) {
  return [
    "cancelled",
    "canceled",
    "closed",
    "completed",
    "deleted",
    "expired",
  ].includes(normalized(dv?.attrs?.status));
}

function roleOf(dv: any): "need" | "offer" | "neutral" {
  const kind = normalized(dv?.kind);
  const mode = normalized(dv?.attrs?.intent?.mode);
  const side = normalized(dv?.attrs?.side);
  if (
    mode === "need" ||
    mode === "discover" ||
    kind.includes("demand") ||
    kind === "work.intent" ||
    kind === "composition.publish" ||
    dv?.traits?.includes?.("resonance:need")
  ) {
    return "need";
  }
  if (
    mode === "offer" ||
    kind.includes("offer") ||
    kind.includes("producto") ||
    kind.includes("product") ||
    kind === "capability.offer" ||
    side === "sell" ||
    Array.isArray(dv?.attrs?.capabilities)
  ) {
    return "offer";
  }
  return "neutral";
}

function distanceKm(a: ApproximateGeo, b: ApproximateGeo) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthKm * Math.asin(Math.sqrt(value));
}

function latestOwnNeed(all: any[], actorId: string) {
  return [...all]
    .filter(
      (dv) =>
        belongsToActor(dv, actorId) && roleOf(dv) === "need" && !isClosed(dv),
    )
    .sort((a, b) => timestampOf(b) - timestampOf(a))[0] || null;
}

export function buildLiveContext(
  allLive: any[],
  actorId: string,
  focusId?: string | null,
): LiveContext {
  const all = Array.isArray(allLive) ? allLive : [];
  const safeActorId = text(actorId);
  const profile =
    all.find(
      (dv) =>
        dv?.kind === "node.profile" && belongsToActor(dv, safeActorId),
    ) || null;
  const explicitFocus =
    (focusId && all.find((dv) => text(dv?.id) === text(focusId))) || null;
  const focus = explicitFocus || latestOwnNeed(all, safeActorId);
  const tokenSource = focus || profile;

  return {
    actorId: safeActorId,
    profile,
    focus,
    focusId: text(focus?.id) || null,
    threadId: threadIdOf(focus) || null,
    tokens: tokensFromDV(tokenSource),
    geo: geoOf(focus) || geoOf(profile),
  };
}

function semanticOverlap(contextTokens: string[], candidateTokens: string[]) {
  if (!contextTokens.length || !candidateTokens.length) return 0;
  const candidates = new Set(candidateTokens);
  return contextTokens.filter((token) => candidates.has(token)).length;
}

export function scoreDVForContext(
  dv: any,
  context: LiveContext,
): ContextualDV {
  let score = 0;
  const reasons: ContextReason[] = [];
  const own = belongsToActor(dv, context.actorId);
  const focusId = text(context.focusId);
  const dvId = text(dv?.id);
  const refs = responseRefs(dv);
  const threadId = threadIdOf(dv);

  if (own) {
    score += 100;
    reasons.push("Es tuyo");
  }

  if (!own && targetsActor(dv, context.actorId)) {
    score += 120;
    reasons.push("Responde a tu señal");
  }

  if (focusId && dvId === focusId) {
    score += 130;
  }

  if (focusId && refs.includes(focusId)) {
    score += 110;
    reasons.push("Responde a tu señal");
  }

  if (
    context.threadId &&
    threadId &&
    threadId === context.threadId &&
    dvId !== focusId
  ) {
    score += 80;
    reasons.push("Está en el mismo hilo");
  }

  const candidateTokens = tokensFromDV(dv);
  const overlap = semanticOverlap(context.tokens, candidateTokens);
  if (overlap > 0) {
    score += Math.min(60, overlap * 14);
    reasons.push(
      roleOf(dv) === "offer"
        ? "Tiene capacidades compatibles"
        : "Coincide con lo que buscás",
    );
  }

  const focusRole = roleOf(context.focus || context.profile);
  const candidateRole = roleOf(dv);
  if (
    overlap > 0 &&
    ((focusRole === "need" && candidateRole === "offer") ||
      (focusRole === "offer" && candidateRole === "need"))
  ) {
    score += 24;
  }

  const relation = canRelate({ need: context.focus || context.profile || { attrs: { geo: context.geo } }, capability: dv });
  const compositionMatch = context.focus && isPublicLivingComposition(context.focus)
    ? matchLivingCompositionCandidates(context.focus, [dv])[0]
    : null;
  const explicitlyOutOfRange = !relation.recommended && relation.distanceKm != null && relation.rangeKm != null;
  if (compositionMatch && !explicitlyOutOfRange) {
    score += 88;
    reasons.push("Tiene capacidades compatibles");
  }
  if (relation.recommended) { score += 22; reasons.push(relation.reason as ContextReason); }
  else if (relation.distanceKm != null && relation.rangeKm != null) score -= 45;

  if (
    dv?.attrs?.availability?.availableNow === true ||
    dv?.traits?.includes?.("presence:available")
  ) {
    score += 8;
    reasons.push("Está disponible");
  }

  const ageMs = Date.now() - timestampOf(dv);
  if (ageMs >= 0 && ageMs <= 24 * 60 * 60_000) {
    score += 5;
    reasons.push("Es reciente");
  }

  if (isClosed(dv) && !own) score -= 80;

  return {
    dv,
    score,
    reasons: Array.from(new Set(reasons)).slice(0, 3),
    matchLabel: compositionMatch?.label,
  };
}

export function selectContextualDVs(
  allLive: any[],
  context: LiveContext,
  options: { surface?: "feed" | "map"; limit?: number } = {},
): ContextualDV[] {
  const surface = options.surface || "feed";
  const threshold = surface === "map" ? 28 : 18;
  const all = Array.isArray(allLive) ? allLive : [];

  // Sin una señal, perfil o identidad propia el sistema no revela un mapa
  // global. El usuario primero expresa contexto y luego la red responde.
  if (!context.tokens.length && !context.focus && !context.profile) {
    return all
      .filter(
        (dv) =>
          belongsToActor(dv, context.actorId) ||
          targetsActor(dv, context.actorId),
      )
      .map((dv) => scoreDVForContext(dv, context))
      .sort((a, b) => b.score - a.score);
  }

  return all
    .map((dv) => scoreDVForContext(dv, context))
    .filter((item) => {
      if (belongsToActor(item.dv, context.actorId)) return true;
      const coherent = item.reasons.some((reason) =>
        [
          "Responde a tu señal",
          "Está en el mismo hilo",
          "Tiene capacidades compatibles",
          "Coincide con lo que buscás",
        ].includes(reason),
      );
      return coherent && item.score >= threshold;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return timestampOf(b.dv) - timestampOf(a.dv);
    })
    .slice(0, Math.max(1, options.limit || (surface === "map" ? 80 : 60)));
}

export function liveContextLabel(context: LiveContext) {
  if (context.focus) {
    return text(
      context.focus?.labels?.[0] ||
        context.focus?.attrs?.title ||
        context.focus?.attrs?.text,
    );
  }
  if (context.profile) return "Según tu Perfil Vivo";
  return "Emití una señal para despertar el mapa";
}
