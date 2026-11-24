// src/mt/liveCatalog.sources.ts
// Descubrimiento vivo UTOPY v2.
// Falcon conoce la red. Cada nodo anuncia su manifiesto y sus endpoints.
// Las URLs fijas en .env quedan solamente como bootstrap opcional de emergencia.

import { ingestMany, extractDVsFromFrame } from "./mt.ingest";
import { mtLiveSnapshot, mtLiveSubscribe } from "./mt.liveStore";
import { MARKET_RUNTIME_FLAGS } from "../utopy/runtimeFlags";
import { isLivingEnvelope } from "../utopy/livingEnvelope.adapter";
import { verifyRuntimeEnvelope } from "../utopy/runtimeTrust";
import { projectVerifiedRuntimeEnvelope } from "../utopy/runtimeProjection.security";

export type LiveCatalogSource = {
  id: string;
  catalogUrl: string;
  manifestUrl?: string;
  profileUrl?: string;
  publicBaseUrl?: string;
  verifiedOrigin?: string;
  runtimeVerified?: boolean;
  nodeName?: string;
  storeId?: string;
  authority?: string;
  originNode?: string;
  refreshMs?: number;
  expiresAt?: number;
  discoveredFrom?: "manifest" | "bootstrap" | "legacy";
  enabled?: boolean;
  approximateLocation?: {
    lat: number;
    lng: number;
    label?: string;
    precision?: string;
    source?: string;
  };
};

export type LiveCatalogSourceStatus = {
  sourceId: string;
  state: "discovering" | "loading" | "live" | "cached" | "expired" | "error";
  count: number;
  updatedAt: string;
  message?: string;
};

type ActiveRuntime = { refs: number; release: () => void };
let activeRuntime: ActiveRuntime | null = null;

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function normalizeNodeKey(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/^did:utopy:/, "")
    .replace(/^utopy[.:/_-]*node[.:/_-]*/i, "")
    .replace(/^node[.:/_-]*/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function identitiesConflict(a: unknown, b: unknown): boolean {
  const left = normalizeNodeKey(a);
  const right = normalizeNodeKey(b);
  return Boolean(left && right && left !== right);
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

export function safePublicUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const localDev = ["localhost", "127.0.0.1", "::1"].includes(host);
    if (parsed.protocol !== "https:" && !(localDev && parsed.protocol === "http:")) {
      return "";
    }
    if (
      !localDev &&
      (isPrivateIpv4(host) ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host === "0.0.0.0")
    ) {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function joinCatalogUrl(baseUrl: unknown, endpoint: unknown): string {
  const base = text(baseUrl).replace(/\/+$/, "");
  const path = text(endpoint || "/api/catalog-live.php");
  if (!base) return "";
  return safePublicUrl(`${base}${path.startsWith("/") ? path : `/${path}`}`);
}

function resolvePublicUrl(value: unknown, base: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    return safePublicUrl(new URL(raw, text(base) || undefined).toString());
  } catch {
    return "";
  }
}

function sameOrigin(left: unknown, right: unknown): boolean {
  try { return new URL(text(left)).origin === new URL(text(right)).origin; } catch { return false; }
}

function capabilitiesOf(raw: any): string[] {
  const list = raw?.attrs?.capabilities ?? raw?.capabilities ?? [];
  return (Array.isArray(list) ? list : []).map((item: any) => text(item?.id || item?.kind || item)).filter(Boolean);
}

function timestampOf(value: any): number {
  const raw = value?.meta?.updatedAt ?? value?.meta?.ts ?? value?.ts ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function manifestExpiry(dv: any): number {
  const explicit = Date.parse(String(dv?.attrs?.expiresAt || dv?.attrs?.discovery?.expiresAt || ""));
  if (Number.isFinite(explicit)) return explicit;
  const ts = timestampOf(dv);
  const ttl = Number(dv?.meta?.ttl_ms || 0);
  return ts > 0 && ttl > 0 ? ts + ttl : 0;
}

export function isActiveManifest(dv: any, now = Date.now()): boolean {
  if (!dv || dv.kind !== "utopy.node.manifest") return false;
  if (dv?.attrs?.revoked === true || dv?.attrs?.enabled === false) return false;
  const scopes = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes.map(String) : [];
  if (scopes.length && !scopes.includes("public") && !scopes.includes("market")) {
    return false;
  }
  const expiresAt = manifestExpiry(dv);
  return !expiresAt || expiresAt > now;
}

function sourceFromObject(
  raw: any,
  discoveredFrom: LiveCatalogSource["discoveredFrom"],
): LiveCatalogSource | null {
  if (!raw || typeof raw !== "object") return null;
  const attrs = raw?.kind ? raw.attrs || {} : raw;
  const meta = raw?.kind ? raw.meta || {} : raw.meta || {};
  const endpointList = Array.isArray(attrs.endpoints) ? attrs.endpoints : [];
  const endpoints = Array.isArray(attrs.endpoints) ? {} : attrs.endpoints || attrs.node?.endpoints || {};
  const catalogAnnouncement = endpointList.find((item: any) =>
    ["catalog", "catalog.live"].includes(text(item?.id || item?.kind || item?.capability)),
  );
  const catalogUrl =
    safePublicUrl(
      attrs.catalogUrl ||
        attrs.feedUrl ||
        (raw?.kind === "node.catalog.announce" ? attrs.endpoint : "") ||
        catalogAnnouncement?.url || catalogAnnouncement?.endpoint ||
        endpoints.catalog ||
        endpoints.catalogLive ||
        endpoints.feed ||
        meta.catalogUrl ||
        meta.feedUrl,
    ) || joinCatalogUrl(attrs.baseUrl || endpoints.baseUrl, attrs.endpoint);

  const nodeId = text(attrs.node?.id || attrs.nodeId || meta.originNode);
  const nodeName = text(
    attrs.node?.name || attrs.nodeName || attrs.storeName || meta.nodeName || meta.storeName,
  );
  const storeId = text(attrs.storeId || meta.storeId);
  const authority = text(attrs.authority || meta.authority || nodeId || storeId);
  const id = text(attrs.sourceId || nodeId || storeId || authority || attrs.id);
  const expiresAt = raw?.kind === "utopy.node.manifest" ? manifestExpiry(raw) : 0;
  const endpointBase = attrs.baseUrl || attrs.publicBaseUrl || endpoints.baseUrl;
  const manifestUrl = resolvePublicUrl(
    attrs.manifestUrl || endpoints.manifest || endpoints.manifestLive,
    endpointBase,
  );
  const profileUrl = resolvePublicUrl(
    attrs.profileUrl || endpoints.profile || endpoints.profileLive,
    endpointBase,
  );
  const publicBaseUrl = safePublicUrl(
    attrs.publicBaseUrl || attrs.baseUrl || endpoints.publicBaseUrl || meta.publicBaseUrl,
  );
  const verifiedOrigin = safePublicUrl(attrs.origin || attrs.publicOrigin || publicBaseUrl);
  const rawLocation = attrs.approximateLocation || attrs.geo || null;
  const lat = Number(rawLocation?.lat);
  const lng = Number(rawLocation?.lng);

  if (!id || !catalogUrl || attrs.enabled === false || attrs.revoked === true) {
    return null;
  }

  return {
    id,
    catalogUrl,
    manifestUrl: manifestUrl || undefined,
    profileUrl: profileUrl || undefined,
    publicBaseUrl: publicBaseUrl || undefined,
    verifiedOrigin: verifiedOrigin || undefined,
    runtimeVerified: meta.runtimeVerified === true,
    nodeName: nodeName || undefined,
    storeId: storeId || undefined,
    authority: authority || undefined,
    originNode: nodeId || undefined,
    refreshMs: Math.max(20_000, Number(attrs.refreshMs || attrs.discovery?.heartbeatMs || 30_000)),
    expiresAt: expiresAt || undefined,
    discoveredFrom,
    enabled: true,
    approximateLocation:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { ...rawLocation, lat, lng }
        : undefined,
  };
}

function parseBootstrapSources(): LiveCatalogSource[] {
  const preferred = text(import.meta.env.VITE_BOOTSTRAP_NODE_SOURCES);
  const legacy = text(import.meta.env.VITE_LIVE_CATALOG_SOURCES);
  const raw = preferred || legacy;
  if (!raw) return [];
  if (!preferred && legacy) {
    console.warn(
      "[UTOPY] VITE_LIVE_CATALOG_SOURCES queda como compatibilidad. Migre a VITE_BOOTSTRAP_NODE_SOURCES.",
    );
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sourceFromObject(item, preferred ? "bootstrap" : "legacy"))
      .filter((value): value is LiveCatalogSource => Boolean(value));
  } catch (error) {
    console.warn("[UTOPY] Bootstrap de nodos no es JSON válido:", error);
    return [];
  }
}

function isSourceDV(dv: any): boolean {
  const traits = Array.isArray(dv?.traits) ? dv.traits.map(String) : [];
  return (
    dv?.kind === "utopy.node.manifest" ||
    dv?.kind === "node.catalog.announce" ||
    dv?.kind === "catalog.source" ||
    traits.includes("mt:catalog.source") ||
    traits.includes("utopy:node:manifest")
  );
}

export function discoverLiveCatalogSources(
  allLive: any[] = mtLiveSnapshot(),
  now = Date.now(),
): LiveCatalogSource[] {
  const byNode = new Map<string, LiveCatalogSource>();

  // Bootstrap es solamente una puerta inicial. Un manifiesto vivo del mismo nodo lo reemplaza.
  for (const source of parseBootstrapSources()) {
    byNode.set(normalizeNodeKey(source.id) || source.id, source);
  }

  for (const dv of Array.isArray(allLive) ? allLive : []) {
    if (!isSourceDV(dv)) continue;
    if (MARKET_RUNTIME_FLAGS.discovery && dv?.meta?.runtimeVerified !== true) continue;
    if (dv.kind === "utopy.node.manifest" && !isActiveManifest(dv, now)) continue;
    if (dv.kind === "utopy.node.manifest" && !capabilitiesOf(dv).includes("catalog.live")) continue;
    const source = sourceFromObject(dv, "manifest");
    if (!source) continue;
    if (MARKET_RUNTIME_FLAGS.discovery) {
      const manifest = dv.kind === "utopy.node.manifest"
        ? dv
        : (allLive || []).find((candidate) =>
            candidate?.kind === "utopy.node.manifest" &&
            candidate?.meta?.runtimeVerified === true &&
            normalizeNodeKey(candidate?.attrs?.nodeId) === normalizeNodeKey(source.originNode),
          );
      if (!manifest || !capabilitiesOf(manifest).includes("catalog.live")) continue;
      const origin = text(manifest?.attrs?.origin || manifest?.attrs?.publicOrigin || manifest?.attrs?.publicBaseUrl);
      if (!origin || !sameOrigin(source.catalogUrl, origin)) continue;
      source.runtimeVerified = true;
      source.verifiedOrigin = origin;
    }
    byNode.set(normalizeNodeKey(source.id) || source.id, source);
  }

  return Array.from(byNode.values()).filter(
    (source) => !source.expiresAt || source.expiresAt > now,
  );
}

function emitStatus(status: LiveCatalogSourceStatus) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("utopy:catalog-source:status", { detail: status }),
    );
  } catch {}
}

function belongsToSource(dv: any, source: LiveCatalogSource): boolean {
  const storeId = text(dv?.attrs?.storeId || dv?.meta?.storeId || dv?.attrs?.sellerId);
  const authority = text(dv?.meta?.authority || dv?.attrs?.authority);
  const originNode = text(
    dv?.meta?.originNode || dv?.attrs?.originNode || dv?.attrs?.nodeId || dv?.attrs?.node?.id,
  );
  const sellerNodeId = text(dv?.attrs?.sellerNodeId || dv?.sellerNodeId);

  if (source.storeId && identitiesConflict(storeId, source.storeId)) return false;
  if (source.authority && identitiesConflict(authority, source.authority)) return false;
  if (source.originNode && identitiesConflict(originNode, source.originNode)) return false;
  if (source.originNode && identitiesConflict(sellerNodeId, source.originNode)) return false;
  return true;
}

function enrichFromSource(dv: any, source: LiveCatalogSource): any {
  const attrs = dv?.attrs && typeof dv.attrs === "object" ? { ...dv.attrs } : {};
  const meta = dv?.meta && typeof dv.meta === "object" ? { ...dv.meta } : {};
  const nodeId = text(
    attrs.node?.id || attrs.nodeId || meta.originNode || source.originNode || source.id,
  );
  const storeId = text(attrs.storeId || meta.storeId || source.storeId);
  return {
    ...dv,
    attrs: {
      ...attrs,
      ...(storeId ? { storeId: attrs.storeId || storeId } : {}),
      nodeId: attrs.nodeId || nodeId,
      node: {
        ...(attrs.node || {}),
        id: nodeId,
        name:
          attrs.node?.name ||
          attrs.storeName ||
          meta.storeName ||
          source.nodeName ||
          source.id,
      },
      nodeName: attrs.nodeName || source.nodeName,
      sellerNodeId: attrs.sellerNodeId || nodeId,
      sellerName: attrs.sellerName || source.nodeName,
      ...(source.approximateLocation && !attrs.geo && !attrs.location
        ? {
            approximateLocation: source.approximateLocation,
            geo: source.approximateLocation,
          }
        : {}),
    },
    meta: {
      ...meta,
      ns: meta.ns || "mt:market",
      scopes: Array.isArray(meta.scopes) ? meta.scopes : ["public"],
      originNode: meta.originNode || source.originNode || nodeId,
      authority: meta.authority || source.authority || source.id,
      sourceCatalogUrl: source.catalogUrl,
      publicBaseUrl: source.publicBaseUrl,
      sourceId: source.id,
      runtimeVerified: source.runtimeVerified === true,
      nodeName: meta.nodeName || source.nodeName,
      discoveredFrom: source.discoveredFrom,
      updatedAt: meta.updatedAt || meta.ts || new Date().toISOString(),
    },
  };
}

function stableExternalId(raw: any, source: LiveCatalogSource, kind: string): string {
  const attrs = raw?.attrs || {};
  const productId = text(attrs.productId || attrs.productoId || raw?.productId || raw?.productoId);
  const sellerNodeId = text(
    attrs.sellerNodeId || attrs.nodeId || raw?.authority || source.originNode || source.id,
  );
  if (productId && sellerNodeId) return `${kind}:${sellerNodeId}:${productId}`;
  return text(raw?.id || raw?._id);
}

function absoluteMedia(value: any, baseUrl: string): any {
  if (typeof value === "string") return resolvePublicUrl(value, baseUrl);
  if (Array.isArray(value)) return value.map((item) => absoluteMedia(item, baseUrl));
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  for (const key of ["url", "src", "href", "image", "imagen", "imageUrl", "posterUrl"]) {
    if (typeof copy[key] === "string") copy[key] = resolvePublicUrl(copy[key], baseUrl) || copy[key];
  }
  return copy;
}

const PRIVATE_PUBLICATION_KEYS = new Set([
  "account",
  "accountnumber",
  "accountholder",
  "bank",
  "bankaccount",
  "banking",
  "bridgesecret",
  "ci",
  "document",
  "documentnumber",
  "iban",
  "paymentdestination",
  "paymentproof",
  "proofimage",
  "receipt",
  "swift",
]);

function withoutPrivatePublicationData(value: any): any {
  if (Array.isArray(value)) return value.map(withoutPrivatePublicationData);
  if (!value || typeof value !== "object") return value;
  const safe: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (PRIVATE_PUBLICATION_KEYS.has(normalized)) continue;
    safe[key] = withoutPrivatePublicationData(entry);
  }
  return safe;
}

function canonicalExternalDV(raw: any, source: LiveCatalogSource, payload: any): any | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = text(raw.kind || raw.type);
  if (!kind) return null;
  const id = stableExternalId(raw, source, kind);
  if (!id) return null;
  const attrs = withoutPrivatePublicationData({ ...(raw.attrs || {}) });
  const serializedSize = JSON.stringify(raw).length;
  if (serializedSize > 256_000) return null;
  const baseUrl = source.publicBaseUrl || source.catalogUrl;
  for (const key of ["image", "imagen", "imageUrl", "cover", "logo", "gallery", "images", "media"]) {
    if (attrs[key] != null) attrs[key] = absoluteMedia(attrs[key], baseUrl);
  }
  return {
    ...raw,
    id,
    kind,
    attrs,
    meta: {
      ...(raw.meta || {}),
      ns: text(raw?.meta?.ns || raw?.namespace || payload?.namespace || "mt:market"),
      authority: text(raw?.meta?.authority || raw?.authority || source.authority || source.originNode),
      updatedAt: text(
        raw?.meta?.updatedAt || raw?.updatedAt || payload?.updatedAt || payload?.generatedAt,
      ) || new Date().toISOString(),
      runtimeVerified: source.runtimeVerified === true,
    },
  };
}

function payloadDVs(payload: any, source: LiveCatalogSource): any[] {
  const candidates = extractDVsFromFrame(payload);
  for (const key of ["dvs", "items", "products"]) {
    if (Array.isArray(payload?.[key])) candidates.push(...payload[key]);
  }
  const unique = new Map<string, any>();
  for (const candidate of candidates) {
    const canonical = canonicalExternalDV(candidate, source, payload);
    if (canonical) unique.set(canonical.id, canonical);
  }
  return Array.from(unique.values());
}

export function ingestLiveCatalog(payload: any, source: LiveCatalogSource): number {
  const accepted = payloadDVs(payload, source)
    .filter((dv) => belongsToSource(dv, source))
    .map((dv) => enrichFromSource(dv, source));
  ingestMany(accepted, { source: `node:${source.id}` });
  return accepted.length;
}

async function ingestVerifiedLiveCatalog(payload: any, source: LiveCatalogSource): Promise<number> {
  const rawItems = [
    ...(Array.isArray(payload) ? payload : []),
    ...(Array.isArray(payload?.dvs) ? payload.dvs : []),
    ...(Array.isArray(payload?.items) ? payload.items : []),
    ...(Array.isArray(payload?.products) ? payload.products : []),
  ];
  const accepted: any[] = [];
  for (const envelope of rawItems) {
    if (!isLivingEnvelope(envelope)) continue;
    const verification = await verifyRuntimeEnvelope(envelope);
    if (!verification.verified) continue;
    if (identitiesConflict(envelope.authority, source.originNode)) continue;
    const projection = projectVerifiedRuntimeEnvelope(envelope);
    if (!projection.accepted) continue;
    const dv = projection.dv;
    if (!belongsToSource(dv, source)) continue;
    accepted.push(enrichFromSource(dv, source));
  }
  ingestMany(accepted, { source: `node:${source.id}` });
  return accepted.length;
}

function manifestDV(payload: any, source: LiveCatalogSource): any | null {
  const manifest = payload?.manifest;
  if (!manifest || typeof manifest !== "object") return null;
  const nodeId = text(manifest.nodeId || source.originNode || source.id);
  if (!nodeId) return null;
  const publicIdentity = manifest.publicIdentity || {};
  const logo = resolvePublicUrl(publicIdentity.logo, source.publicBaseUrl || source.manifestUrl);
  return {
    id: `utopy.node.manifest:${nodeId}`,
    kind: "utopy.node.manifest",
    attrs: {
      nodeId,
      node: { id: nodeId, name: text(manifest.displayName || source.nodeName || nodeId) },
      nodeName: text(manifest.displayName || source.nodeName || nodeId),
      storeId: text(manifest.storeId || source.storeId),
      handle: text(manifest.handle),
      namespace: text(manifest.namespace || "mt:market"),
      capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
      endpoints: {
        catalog: source.catalogUrl,
        manifest: source.manifestUrl,
        profile: source.profileUrl,
      },
      announcedEndpoints: manifest.endpoints || {},
      publicBaseUrl: source.publicBaseUrl,
      publicIdentity: { ...publicIdentity, ...(logo ? { logo } : {}) },
      approximateLocation: source.approximateLocation,
      geo: source.approximateLocation,
      version: manifest.version,
      generatedAt: manifest.generatedAt,
    },
    traits: ["utopy:node:manifest", "mt:catalog.source", "sem.dv.read"],
    meta: {
      ns: "utopy:nodes",
      scopes: ["public", "market"],
      authority: nodeId,
      originNode: nodeId,
      updatedAt: text(manifest.generatedAt) || new Date().toISOString(),
      proof: payload?.proof || undefined,
      sourceUrl: source.manifestUrl,
    },
  };
}

function profileDV(payload: any, source: LiveCatalogSource): any | null {
  const profile = payload?.profile;
  if (!profile || typeof profile !== "object") return null;
  const attrs = withoutPrivatePublicationData({ ...(profile.attrs || {}) });
  const nodeId = text(attrs.nodeId || profile.authority || source.originNode || source.id);
  if (!nodeId) return null;
  const baseUrl = source.publicBaseUrl || source.profileUrl || source.catalogUrl;
  const logo = resolvePublicUrl(attrs.logo, baseUrl);
  const territory = attrs.territory && typeof attrs.territory === "object" ? attrs.territory : {};
  return {
    id: `live.profile:${nodeId}`,
    kind: "live.profile",
    attrs: {
      ...attrs,
      nodeId,
      nodeName: text(attrs.name || source.nodeName),
      displayName: text(attrs.name || source.nodeName),
      logo: logo || attrs.logo,
      bio: text(attrs.philosophy || attrs.motto),
      territoryName: text(territory.label),
      approximateLocation: source.approximateLocation || territory,
      geo: source.approximateLocation,
    },
    traits: ["utopy:live-profile", "mt:nodo", "sem.dv.read"],
    meta: {
      ...(profile.meta || {}),
      ns: text(profile.namespace || "mt:market"),
      scopes: ["public", "market"],
      authority: nodeId,
      originNode: nodeId,
      sourceUrl: source.profileUrl,
      publicBaseUrl: source.publicBaseUrl,
      updatedAt: text(payload?.updatedAt || payload?.generatedAt) || new Date().toISOString(),
    },
  };
}

async function fetchJson(url: string, sourceId: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`${sourceId} HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 2_000_000) throw new Error(`${sourceId} excede el tamaño permitido`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${sourceId} no devolvió JSON`);
  }
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error(`${sourceId} excede el tamaño permitido`);
  return JSON.parse(body);
}

function cachedCount(source: LiveCatalogSource): number {
  return mtLiveSnapshot().filter((dv) => {
    const sourceId = text((dv as any)?.meta?.sourceId);
    if (sourceId) return !identitiesConflict(sourceId, source.id);
    return belongsToSource(dv, source);
  }).length;
}

export async function refreshLiveCatalogSource(
  source: LiveCatalogSource,
  signal?: AbortSignal,
): Promise<number> {
  if (source.expiresAt && source.expiresAt <= Date.now()) {
    emitStatus({
      sourceId: source.id,
      state: "expired",
      count: cachedCount(source),
      updatedAt: new Date().toISOString(),
      message: "El nodo dejó de renovar su manifiesto.",
    });
    return 0;
  }

  emitStatus({
    sourceId: source.id,
    state: "loading",
    count: cachedCount(source),
    updatedAt: new Date().toISOString(),
  });

  if (source.manifestUrl) {
    const payload = await fetchJson(source.manifestUrl, `${source.id} manifest`, signal);
    const dv = manifestDV(payload, source);
    if (dv) ingestMany([dv], { source: `node:${source.id}` });
  }
  if (source.profileUrl) {
    const payload = await fetchJson(source.profileUrl, `${source.id} profile`, signal);
    const dv = profileDV(payload, source);
    if (dv) ingestMany([dv], { source: `node:${source.id}` });
  }
  const payload = await fetchJson(source.catalogUrl, source.id, signal);
  const count = source.runtimeVerified
    ? await ingestVerifiedLiveCatalog(payload, source)
    : ingestLiveCatalog(payload, source);
  emitStatus({
    sourceId: source.id,
    state: "live",
    count,
    updatedAt: new Date().toISOString(),
  });
  return count;
}

function sourceSignature(source: LiveCatalogSource): string {
  return JSON.stringify([
    normalizeNodeKey(source.id),
    source.catalogUrl,
    source.manifestUrl || "",
    source.profileUrl || "",
    source.publicBaseUrl || "",
    source.verifiedOrigin || "",
    source.runtimeVerified === true,
    source.nodeName || "",
    source.storeId || "",
    source.authority || "",
    source.originNode || "",
    source.refreshMs || 30_000,
    source.expiresAt || 0,
    source.approximateLocation?.lat || "",
    source.approximateLocation?.lng || "",
  ]);
}

export function startLiveCatalogSources(options: { pollMs?: number } = {}): () => void {
  if (activeRuntime) {
    activeRuntime.refs += 1;
    return activeRuntime.release;
  }
  if (typeof window === "undefined") return () => {};

  const heartbeatMs = Math.max(5_000, Number(options.pollMs || 15_000));
  const controllers = new Map<string, AbortController>();
  const knownSignatures = new Map<string, string>();
  const nextRefreshAt = new Map<string, number>();
  let currentLive = mtLiveSnapshot();
  let stopped = false;

  const syncSource = async (source: LiveCatalogSource, force = false) => {
    if (stopped) return;
    const key = normalizeNodeKey(source.id) || source.id;
    const now = Date.now();
    if (!force && now < Number(nextRefreshAt.get(key) || 0)) return;
    nextRefreshAt.set(key, now + Number(source.refreshMs || 30_000));
    controllers.get(key)?.abort();
    const controller = new AbortController();
    controllers.set(key, controller);
    try {
      await refreshLiveCatalogSource(source, controller.signal);
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      const count = cachedCount(source);
      emitStatus({
        sourceId: source.id,
        state: count ? "cached" : "error",
        count,
        updatedAt: new Date().toISOString(),
        message: String(error?.message || error || "Sin conexión"),
      });
      console.warn(`[UTOPY] Nodo ${source.id} no disponible:`, error);
    }
  };

  const discoverAndSync = (force = false) => {
    const sources = discoverLiveCatalogSources(currentLive);
    if (!sources.length) {
      emitStatus({
        sourceId: "utopy:nodes",
        state: "discovering",
        count: 0,
        updatedAt: new Date().toISOString(),
        message: "Escuchando manifiestos vivos en Seed/Micelio.",
      });
    }

    const activeKeys = new Set<string>();
    for (const source of sources) {
      const key = normalizeNodeKey(source.id) || source.id;
      activeKeys.add(key);
      const signature = sourceSignature(source);
      const changed = knownSignatures.get(key) !== signature;
      knownSignatures.set(key, signature);
      void syncSource(source, force || changed);
    }

    for (const key of Array.from(knownSignatures.keys())) {
      if (activeKeys.has(key)) continue;
      knownSignatures.delete(key);
      nextRefreshAt.delete(key);
      controllers.get(key)?.abort();
      controllers.delete(key);
    }
  };

  const unsubscribe = mtLiveSubscribe((all) => {
    currentLive = Array.isArray(all) ? all : [];
    discoverAndSync(false);
  });
  discoverAndSync(true);

  const timer = window.setInterval(() => discoverAndSync(false), heartbeatMs);
  const onWake = () => discoverAndSync(true);
  const onManualRefresh = () => discoverAndSync(true);
  const onVisible = () => document.visibilityState === "visible" && onWake();
  window.addEventListener("online", onWake);
  window.addEventListener("focus", onWake);
  window.addEventListener("utopy:catalog-sources:refresh", onManualRefresh);
  document.addEventListener("visibilitychange", onVisible);

  const runtime: ActiveRuntime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;
      stopped = true;
      unsubscribe();
      controllers.forEach((controller) => controller.abort());
      window.clearInterval(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("utopy:catalog-sources:refresh", onManualRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      if (activeRuntime === runtime) activeRuntime = null;
    },
  };
  activeRuntime = runtime;
  return runtime.release;
}
