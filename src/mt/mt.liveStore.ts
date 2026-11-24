// src/mt/mt.liveStore.ts
// Store vivo MT estable:
// - ignora upserts idénticos
// - agrupa notificaciones/persistencia
// - evita guardar imágenes/base64 enormes en localStorage
// - conserva mtLiveUpsert, mtLiveSubscribe, mtLiveSnapshot y mtLiveClear

import type { DatoVivo } from "./mt.traitAdapter";
import { canAccessEnvelope } from "utopy/continuity";

const STORAGE_KEY = "mt.web.liveDatos";
const PUBLIC_STORAGE_KEY = "mt.web.liveDatos.public.v2";
let accessContext: { actorId: string; nodeId?: string } | null = null;
export function mtLiveGetAccessContext() { return accessContext ? { ...accessContext } : null; }
function privateStorageKey() {
  return accessContext ? `mt.web.liveDatos.private.v2:${encodeURIComponent(accessContext.actorId)}:${encodeURIComponent(accessContext.nodeId || "personal")}` : null;
}
function publicCacheDV(dv: any) {
  const scopes = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes : [];
  if (scopes.length) return scopes.includes("public") && !scopes.some((scope: string) => ["private", "participants", "custodians"].includes(scope));
  // Known legacy PUBLIC projections only; new protocols require explicit scopes.
  return ["mt:producto", "producto", "market.product", "live.profile", "node.profile", "catalog.source", "mt:offer"].includes(dv?.kind)
    && !["private", "sensitive"].includes(dv?.meta?.sensitivity);
}
function privateCacheDV(dv: any) {
  if (!accessContext || publicCacheDV(dv)) return false;
  const envelope = dv?.meta?.runtimeEnvelope;
  if (envelope) return canAccessEnvelope(envelope, accessContext);
  const source = envelope?.sourceActorId || dv?.attrs?.actorId || dv?.attrs?.ownerActorId;
  const participants = Array.isArray(dv?.attrs?.participants) ? dv.attrs.participants : [];
  if (dv?.meta?.scopes?.includes("private")) return source === accessContext.actorId;
  return source === accessContext.actorId || participants.includes(accessContext.actorId)
    || Boolean(accessContext.nodeId && participants.includes(accessContext.nodeId));
}
const MAX_PERSISTED_ITEMS = 3000;
const MAX_RAW_CACHE_CHARS = 4_500_000;
const MAX_STRING_CACHE_CHARS = 120_000;

type Listener = (all: DatoVivo[]) => void;

const store = new Map<string, DatoVivo>();
const listeners = new Set<Listener>();
const recentHashes = new Map<string, string>();
const MAX_RECENT_HASHES = 5000;

let hydrated = false;
let flushScheduled = false;
let persistTimer: number | null = null;

function safeText(value: unknown): string {
  return value == null ? "" : String(value);
}

function revisionOf(dv: any): { version: number | null; ts: number } {
  const rawVersion =
    dv?.meta?.revision ??
    dv?.attrs?.revision ??
    dv?.meta?.version ??
    dv?.attrs?.version;
  const parsedVersion = Number(rawVersion);
  const version = Number.isFinite(parsedVersion) ? parsedVersion : null;

  const rawTs =
    dv?.meta?.updatedAt ??
    dv?.attrs?.updatedAt ??
    dv?.meta?.ts ??
    dv?.attrs?.ts ??
    "";

  const parsedTs = Date.parse(safeText(rawTs));
  return {
    version,
    ts: Number.isFinite(parsedTs) ? parsedTs : 0,
  };
}

function isOlderRevision(incoming: any, current: any): boolean {
  const next = revisionOf(incoming);
  const prev = revisionOf(current);

  if (next.version !== null && prev.version !== null) {
    if (next.version < prev.version) return true;
    if (next.version > prev.version) return false;
  }

  return next.ts > 0 && prev.ts > 0 && next.ts < prev.ts;
}

function stableJson(value: any): string {
  try {
    const seen = new WeakSet<object>();
    const canonical = (input: any): any => {
      if (input == null || typeof input !== "object") return input;
      if (seen.has(input)) return "[circular]";
      seen.add(input);
      if (Array.isArray(input)) return input.map(canonical);
      return Object.keys(input).sort().reduce((output: Record<string, any>, key) => {
        const next = canonical(input[key]);
        if (next !== undefined) output[key] = next;
        return output;
      }, {});
    };
    return JSON.stringify(canonical(value));
  } catch {
    return "";
  }
}

export function mtLiveRevisionHash(dv: any): string {
  const revision = revisionOf(dv);
  return `${String(dv?.id || "")}|${revision.version ?? ""}|${revision.ts}|${stableJson(dv)}`;
}

function rememberHash(id: string, hash: string) {
  if (recentHashes.has(id)) recentHashes.delete(id);
  recentHashes.set(id, hash);
  while (recentHashes.size > MAX_RECENT_HASHES) recentHashes.delete(recentHashes.keys().next().value);
}

function isSameRevisionAndContent(incoming: any, current: any): boolean {
  if (incoming === current) return true;

  const next = revisionOf(incoming);
  const prev = revisionOf(current);

  const sameRevision =
    next.version === prev.version &&
    next.ts === prev.ts;

  if (!sameRevision) return false;

  return stableJson(incoming) === stableJson(current);
}

function timestampOf(dv: any): number {
  const rev = revisionOf(dv);
  return rev.ts || 0;
}

function isExpired(dv: any, now = Date.now()): boolean {
  const ttl = Number(dv?.meta?.ttl_ms ?? dv?.attrs?.ttl_ms ?? 0);
  const ts = timestampOf(dv);

  return ttl > 0 && ts > 0 && now > ts + ttl;
}

function sanitizeCacheValue(value: any, seen = new WeakSet<object>()): any {
  if (typeof value === "string") {
    if (
      value.startsWith("blob:") ||
      value.startsWith("data:image/") ||
      value.startsWith("data:model/") ||
      value.length > MAX_STRING_CACHE_CHARS
    ) {
      return undefined;
    }
    return value;
  }

  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeCacheValue(item, seen))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    if (seen.has(value)) return undefined;
    seen.add(value);

    const output: Record<string, any> = {};

    for (const [key, item] of Object.entries(value)) {
      const lower = key.toLowerCase();

      // Campos pesados regenerables desde el nodo propietario.
      if (
        lower === "dataurl" ||
        lower === "base64" ||
        lower === "binary" ||
        lower === "arraybuffer" ||
        lower === "blob"
      ) {
        continue;
      }

      const clean = sanitizeCacheValue(item, seen);
      if (clean !== undefined) output[key] = clean;
    }

    return output;
  }

  return undefined;
}

function persistedSnapshot(): DatoVivo[] {
  const now = Date.now();

  return Array.from(store.values())
    .filter((dv) => !isExpired(dv, now))
    .sort((a, b) => timestampOf(b) - timestampOf(a))
    .slice(0, MAX_PERSISTED_ITEMS)
    .map((dv) => sanitizeCacheValue(dv))
    .filter(Boolean) as DatoVivo[];
}

function persistNow() {
  if (typeof window === "undefined") return false;

  try {
    const snapshot = persistedSnapshot();
    window.localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(snapshot.filter(publicCacheDV)));
    const key = privateStorageKey();
    if (key) window.localStorage.setItem(key, JSON.stringify(snapshot.filter(privateCacheDV)));
    return true;
  } catch (error) {
    console.warn("[MT web] mt.liveStore persist error:", error);
    return false;
  }
}

/** Explicit user save: report storage failure instead of claiming durable private data. */
export function mtLivePersistCurrent(): boolean {
  hydrate();
  if (!accessContext) return false;
  if (persistTimer != null && typeof window !== "undefined") window.clearTimeout(persistTimer);
  persistTimer = null;
  return persistNow();
}

function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer != null) return;

  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, 180);
}

function notifyNow() {
  const all = Array.from(store.values());

  for (const listener of listeners) {
    try {
      listener(all);
    } catch (error) {
      console.warn("[MT web] mtLive listener error:", error);
    }
  }
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;

  const flush = () => {
    flushScheduled = false;
    schedulePersist();
    notifyNow();
  };

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(flush);
  } else {
    queueMicrotask(flush);
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;

  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(PUBLIC_STORAGE_KEY) || window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    // Una caché enorme es recuperable desde los nodos; no debe bloquear la app.
    if (raw.length > MAX_RAW_CACHE_CHARS) {
      console.warn(
        "[MT web] caché viva demasiado grande; se descartó para recuperar la interfaz.",
      );
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const now = Date.now();

    for (const candidate of parsed) {
      if (!candidate || typeof candidate !== "object") continue;
      if (!candidate.id || !candidate.kind) continue;
      if (isExpired(candidate, now)) continue;
      if (!publicCacheDV(candidate)) continue;

      store.set(String(candidate.id), candidate as DatoVivo);
      rememberHash(String(candidate.id), mtLiveRevisionHash(candidate));
    }
  } catch (error) {
    console.warn("[MT web] mt.liveStore hydrate error:", error);
  }
}

/** Change only the cache partition, retaining a single live store. Legacy cache remains recoverable. */
export function mtLiveSetAccessContext(context: { actorId: string; nodeId?: string } | null) {
  hydrate();
  if (context?.actorId === accessContext?.actorId && context?.nodeId === accessContext?.nodeId) return;
  persistNow();
  accessContext = context;
  for (const [id, dv] of store) if (!publicCacheDV(dv) && !privateCacheDV(dv)) { store.delete(id); recentHashes.delete(id); }
  const key = privateStorageKey();
  if (key && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(key) || "[]";
      if (raw.length <= MAX_RAW_CACHE_CHARS) for (const dv of JSON.parse(raw)) {
        if (dv?.id && dv?.kind && privateCacheDV(dv) && !isExpired(dv)) store.set(String(dv.id), dv);
      }
    } catch { /* Broken private cache cannot become public data. */ }
  }
  notifyNow();
}

export function mtLiveSnapshot(): DatoVivo[] {
  hydrate();
  return Array.from(store.values());
}

export function mtLiveUpsertIfChanged(dv: DatoVivo): boolean {
  hydrate();

  if (!dv || !dv.id || !dv.kind) return false;

  const id = String(dv.id);
  const current = store.get(id);
  const hash = mtLiveRevisionHash(dv);

  if (recentHashes.get(id) === hash) return false;
  if (current && isOlderRevision(dv, current)) return false;
  if (current && isSameRevisionAndContent(dv, current)) { rememberHash(id, hash); return false; }

  store.set(id, dv);
  rememberHash(id, hash);
  scheduleFlush();

  return true;
}

export function mtLiveUpsert(dv: DatoVivo) {
  const changed = mtLiveUpsertIfChanged(dv);
  if (changed) return dv;
  return dv?.id ? store.get(String(dv.id)) || dv : dv;
}

export function mtLiveUpsertMany(items: DatoVivo[]) {
  hydrate();

  let changed = 0;

  for (const dv of Array.isArray(items) ? items : []) {
    if (!dv || !dv.id || !dv.kind) continue;

    const id = String(dv.id);
    const current = store.get(id);
    const hash = mtLiveRevisionHash(dv);

    if (recentHashes.get(id) === hash) continue;
    if (current && isOlderRevision(dv, current)) continue;
    if (current && isSameRevisionAndContent(dv, current)) { rememberHash(id, hash); continue; }

    store.set(id, dv);
    rememberHash(id, hash);
    changed += 1;
  }

  if (changed > 0) scheduleFlush();
  return changed;
}

export function mtLiveSubscribe(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);

  listener(Array.from(store.values()));

  return () => {
    listeners.delete(listener);
  };
}

export function mtLiveClear() {
  hydrate();
  store.clear();
  recentHashes.clear();

  if (persistTimer != null && typeof window !== "undefined") {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(PUBLIC_STORAGE_KEY);
      const key = privateStorageKey();
      if (key) window.localStorage.removeItem(key);
    } catch {}
  }

  notifyNow();
}
