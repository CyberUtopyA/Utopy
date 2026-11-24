// src/mt/mt.ingest.ts
// Ingesta universal: cualquier frame -> DV canónico -> mismo mt.liveStore.
// Canoniza ubicación, identidad y propósito sin conocer nombres de nodos.

import { mtLiveUpsert, mtLiveUpsertMany, mtLiveUpsertIfChanged, mtLiveSnapshot, mtLiveGetAccessContext } from "./mt.liveStore";
import { verifyRuntimeEnvelope } from "../utopy/runtimeTrust";
import { projectVerifiedRuntimeEnvelope } from "../utopy/runtimeProjection.security";
import type { DatoVivoBase } from "./normalizer";
import { readPurpose } from "./utopy.symbiosis";
import { MARKET_RUNTIME_FLAGS } from "../utopy/runtimeFlags";
import { canAccessEnvelope } from "utopy/continuity";

export type IngestOpts = {
  ns?: string;
  scopes?: string[];
  source?: string;
  kind?: string;
  traits?: string[];
};

export type MtNetworkIngestOptions = {
  micelioHttp?: string;
  seedWs?: string;
  reconnectMs?: number;
  queryLimit?: number;
};

type CanonicalGeo = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  source?: string;
};

type Runtime = {
  refs: number;
  release: () => void;
};

let activeNetworkRuntime: Runtime | null = null;
let signedProjectionQueue = Promise.resolve();

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function ensureId(raw: any, fallbackKind: string): string {
  if (raw?.id) return String(raw.id);
  if (raw?._id) return String(raw._id);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${fallbackKind || "dato"}:${Date.now().toString(36)}:${rand}`;
}

function guessKind(raw: any, opts: IngestOpts): string {
  if (opts.kind) return opts.kind;
  if (typeof raw?.kind === "string") return raw.kind;
  if (
    raw &&
    (raw.precio != null ||
      raw.price != null ||
      raw.stock != null ||
      raw.unidad != null ||
      raw.unit != null)
  ) {
    return "producto";
  }
  return "dato";
}

function buildTraits(raw: any, kind: string, opts: IngestOpts): string[] {
  const base = new Set<string>(["sem.dv.read"]);
  if (Array.isArray(raw?.traits)) {
    for (const trait of raw.traits) base.add(String(trait));
  }
  if (Array.isArray(opts.traits)) {
    for (const trait of opts.traits) base.add(String(trait));
  }
  if (["producto", "mt:producto", "market.product"].includes(kind)) {
    base.add("mt:producto");
    base.add("mt:vendible");
  }
  return Array.from(base);
}

function objectOrNull(value: any): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function readGeoCandidate(candidate: any): CanonicalGeo | null {
  if (!candidate || typeof candidate !== "object") return null;
  const coordinates = Array.isArray(candidate.coordinates)
    ? candidate.coordinates
    : null;
  const lat = Number(candidate.lat ?? candidate.latitude ?? coordinates?.[1]);
  const lng = Number(
    candidate.lng ?? candidate.lon ?? candidate.longitude ?? coordinates?.[0],
  );
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  const accuracy = Number(candidate.accuracy_m ?? candidate.accuracy);
  return {
    lat,
    lng,
    accuracy_m: Number.isFinite(accuracy) ? accuracy : undefined,
    source: text(candidate.source) || undefined,
  };
}

function extractCanonicalGeo(
  raw: any,
  attrs: Record<string, any>,
  meta: Record<string, any>,
): CanonicalGeo | null {
  const candidates = [
    attrs.geo,
    attrs.location,
    attrs,
    raw?.geo,
    raw?.location,
    raw,
    meta.geo,
    meta.location,
    meta,
    attrs.raw?.geo,
    attrs.raw?.location,
    attrs.raw,
  ];
  for (const candidate of candidates) {
    const geo = readGeoCandidate(candidate);
    if (geo) return geo;
  }
  return null;
}

function attachCanonicalGeo(
  attrs: Record<string, any>,
  geo: CanonicalGeo | null,
): Record<string, any> {
  if (!geo) return attrs;
  const previousGeo = objectOrNull(attrs.geo) || {};
  const previousLocation = objectOrNull(attrs.location) || {};
  return {
    ...attrs,
    lat: geo.lat,
    lng: geo.lng,
    geo: { ...previousGeo, ...geo },
    location: { ...previousLocation, ...geo },
  };
}

function attachNodeIdentity(
  attrs: Record<string, any>,
  meta: Record<string, any>,
): Record<string, any> {
  const nodeId = text(
    attrs.node?.id ||
      attrs.nodeId ||
      attrs.originNode ||
      attrs.sellerId ||
      attrs.storeId ||
      attrs.orgId ||
      attrs.productor?.id ||
      meta.originNode ||
      meta.by ||
      meta.authority,
  );
  if (!nodeId) return attrs;

  const nodeName = text(
    attrs.node?.name ||
      attrs.nodeName ||
      attrs.sellerName ||
      attrs.storeName ||
      attrs.orgName ||
      attrs.productor?.nombre ||
      nodeId,
  );
  return {
    ...attrs,
    nodeId: attrs.nodeId || nodeId,
    node: {
      ...(objectOrNull(attrs.node) || {}),
      id: nodeId,
      name: nodeName,
    },
  };
}

export function toDatoVivoBase(raw: any, opts: IngestOpts = {}): DatoVivoBase {
  const kind = guessKind(raw, opts);
  const id = ensureId(raw, kind);

  const attrsInput =
    raw && typeof raw.attrs === "object" && !Array.isArray(raw.attrs)
      ? { ...raw.attrs }
      : { ...(raw || {}) };

  const metaRaw: Record<string, any> =
    raw && typeof raw.meta === "object" && !Array.isArray(raw.meta)
      ? { ...raw.meta }
      : {};

  const canonicalGeo = extractCanonicalGeo(raw, attrsInput, metaRaw);
  let attrs = attachCanonicalGeo(attrsInput, canonicalGeo);
  attrs = attachNodeIdentity(attrs, metaRaw);

  const scopesRaw: string[] = Array.isArray(metaRaw.scopes)
    ? metaRaw.scopes.map(String)
    : [];
  const scopes = Array.from(
    new Set<string>([...scopesRaw, ...(opts.scopes ?? [])].map(String)),
  );

  const meta: Record<string, any> = { ...metaRaw };
  if (opts.ns) meta.ns = opts.ns;
  else if (!meta.ns && typeof raw?.ns === "string") meta.ns = raw.ns;
  if (scopes.length > 0) meta.scopes = scopes;
  if (opts.source) meta.source = opts.source;
  if (!meta.ts) meta.ts = new Date().toISOString();
  if (!meta.updatedAt) meta.updatedAt = attrs.updatedAt || meta.ts;

  const traits = buildTraits(raw, kind, opts);
  const dv: DatoVivoBase = { id, kind, attrs, traits, meta };
  const purpose = readPurpose(dv as any);
  if (purpose) {
    if (!attrs.purpose) attrs.purpose = purpose;
    if (!traits.includes(`purpose:${purpose.state}`)) {
      traits.push(`purpose:${purpose.state}`);
    }
  }
  return dv;
}

export function ingestOne(raw: any, opts: IngestOpts = {}): DatoVivoBase {
  const dv = toDatoVivoBase(raw, opts);
  mtLiveUpsert(dv as any);
  return dv;
}

export function ingestMany(
  rawList: any[],
  opts: IngestOpts = {},
): DatoVivoBase[] {
  if (!Array.isArray(rawList)) return [];
  const out: DatoVivoBase[] = [];
  for (const raw of rawList) {
    try {
      out.push(toDatoVivoBase(raw, opts));
    } catch (error) {
      console.warn("[mt.ingest] no se pudo ingerir item:", raw, error);
    }
  }
  mtLiveUpsertMany(out as any[]);
  return out;
}

export function safeJsonParse(value: unknown): any | null {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function extractDVsFromFrame(frame: any): any[] {
  const parsed = safeJsonParse(frame);
  if (!parsed) return [];

  const out: any[] = [];
  const seen = new Set<any>();

  const visit = (value: any) => {
    const current = safeJsonParse(value);
    if (!current) return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== "object") return;
    if (seen.has(current)) return;
    seen.add(current);

    // Signed payloads are opaque until verification. Never ingest their nested
    // legacy DVs separately: that would bypass signature/access rejection.
    if (current.contentHash && current.authority && current.payload !== undefined) {
      out.push(current);
      return;
    }

    // Un DV concreto se conserva y además puede contener colecciones relacionadas.
    if (current.id && current.kind) out.push(current);

    for (const key of ["dv", "dato", "payload", "item"]) {
      if (current[key] && current[key] !== current) visit(current[key]);
    }

    // `data` puede ser un DV o un contenedor de DVs.
    if (current.data && current.data !== current) visit(current.data);

    for (const key of [
      "items",
      "dvs",
      "products",
      "signals",
      "paymentOffers",
      "loyaltyPrograms",
      "trustPolicies",
      "nodeManifests",
      "capabilities",
      "outcomes",
      "reactions",
    ]) {
      if (Array.isArray(current[key])) current[key].forEach(visit);
    }
  };

  visit(parsed);
  return out;
}

export function ingestFrame(frame: any, opts: IngestOpts = {}): DatoVivoBase[] {
  const parsed = safeJsonParse(frame);
  if (
    MARKET_RUNTIME_FLAGS.runtime && typeof window !== "undefined" &&
    parsed && typeof parsed === "object" &&
    parsed.contentHash && parsed.payload !== undefined && parsed.authority
  ) {
    window.dispatchEvent(new CustomEvent("utopy:runtime:incoming", { detail: parsed }));
    return [];
  }
  const candidates = extractDVsFromFrame(frame);
  const envelopes = candidates.filter((item) => item?.contentHash && item?.payload !== undefined && item?.authority);
  if (envelopes.length) {
    signedProjectionQueue = signedProjectionQueue.then(async () => {
      for (const envelope of envelopes) {
        if (["authority.trust", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(envelope.kind)) {
          const { livingSpaceContinuity } = await import("../utopy/livingSpaceContinuity");
          const { resolveCurrentIdentityContext } = await import("../utopy/identityContext");
          const context = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
          await livingSpaceContinuity.receive(envelope, mtLiveGetAccessContext() || { actorId: context.actorId, nodeId: context.actingAsNodeId || undefined });
          continue;
        }
        const { resolveCurrentIdentityContext } = await import("../utopy/identityContext");
        const context = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
        if (!canAccessEnvelope(envelope, mtLiveGetAccessContext() || { actorId: context.actorId, nodeId: context.actingAsNodeId || undefined })) continue;
        const verified = await verifyRuntimeEnvelope(envelope);
        if (!verified.verified) continue;
        const projection = projectVerifiedRuntimeEnvelope(envelope);
        if (projection.accepted) mtLiveUpsertIfChanged(projection.dv);
      }
    }).catch(() => {});
  }
  // Subscription grants and catalogue links only enter through the signed projection above.
  return ingestMany(candidates.filter((item) => !envelopes.includes(item) && !/^studio\.(?:entitlement|pass\.catalog)$/.test(item?.kind || "")
    && !["authority.trust", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(item?.kind)), opts);
}

export function startMtNetworkIngest(
  options: MtNetworkIngestOptions = {},
): () => void {
  if (activeNetworkRuntime) {
    activeNetworkRuntime.refs += 1;
    return activeNetworkRuntime.release;
  }
  if (typeof window === "undefined") return () => {};

  const env = (import.meta as any)?.env || {};
  const micelioHttp = String(
    options.micelioHttp ||
      env.VITE_MICELIO_HTTP ||
      "https://seed.mterra.space/micelio",
  ).replace(/\/+$/, "");
  const seedWs = String(
    options.seedWs ||
      env.VITE_SEED_WS ||
      "wss://seed.mterra.space/utopy?ns=mt",
  );
  const reconnectMs = Math.max(2_000, Number(options.reconnectMs || 8_000));
  const queryLimit = Math.max(100, Number(options.queryLimit || 5_000));

  let stopped = false;
  let ws: WebSocket | null = null;
  let es: EventSource | null = null;
  let retryTimer: number | null = null;

  const openWs = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(seedWs);
      ws.onopen = () => {
        try {
          ws?.send(
            JSON.stringify({
              kind: "query",
              id: "utopy:universal:snapshot",
              where: {},
              limit: queryLimit,
              auth: "utopy-resonancia",
            }),
          );
        } catch {}
      };
      ws.onmessage = (event) => {
        ingestFrame(event.data, { source: "seed.ws" });
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {}
      };
      ws.onclose = () => {
        if (stopped || retryTimer != null) return;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          openWs();
        }, reconnectMs);
      };
    } catch (error) {
      console.warn("[mt.ingest] WebSocket no disponible:", error);
    }
  };

  const openSse = () => {
    if (stopped) return;
    try {
      es = new EventSource(`${micelioHttp}/events`);
      const onAny = (event: MessageEvent) => {
        ingestFrame(event.data, { source: "micelio.sse" });
      };
      for (const eventName of ["message", "intent", "dv", "dato"]) {
        es.addEventListener(eventName, onAny as EventListener);
      }
    } catch (error) {
      console.warn("[mt.ingest] SSE no disponible:", error);
    }
  };

  openWs();
  openSse();

  const runtime: Runtime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;
      stopped = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {}
      try {
        es?.close();
      } catch {}
      if (activeNetworkRuntime === runtime) activeNetworkRuntime = null;
    },
  };
  activeNetworkRuntime = runtime;
  return runtime.release;
}
