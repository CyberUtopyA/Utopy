// src/mt/utopy.nodeManifest.ts
// El nodo se presenta a la red por sí mismo.
// Falcon conoce Seed/Micelio; no necesita conocer cada comercio en .env.

import {
  buildDvUpsertEnvelope,
  type PublishableDV,
} from "./utopy.networkPublish";
import {
  publishAuthorizedDV,
  verifyAuthorizedDV,
} from "../utopy/authorizedPublish";

export type UtopyNodeEndpointMap = Record<string, string | undefined>;

export type UtopyNodeCapability = {
  id: string;
  domains?: string[];
  verbs?: string[];
  resources?: string[];
  accepts?: string[];
  produces?: string[];
  surfaces?: string[];
  reaction?: Record<string, any>;
  constraints?: Record<string, any>;
};

export type UtopyNodeManifestConfig = {
  nodeId: string;
  nodeName: string;
  storeId?: string;
  authority?: string;
  baseUrl?: string;
  endpoints: UtopyNodeEndpointMap;
  capabilities: Array<UtopyNodeCapability | string>;
  surfaces?: string[];
  traits?: string[];
  scopes?: string[];
  heartbeatMs?: number;
  ttlMs?: number;
  version?: string | number;
  extraAttrs?: Record<string, any>;
};

export type ManifestHeartbeatOptions = {
  seedWs?: string;
  directWebSocket?: boolean;
  useUtopyEvent?: boolean;
  leaderElection?: boolean;
  reconnectMs?: number;
};

type Runtime = { refs: number; release: () => void };
const activeByNode = new Map<string, Runtime>();

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function uniq(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(text)
        .filter(Boolean),
    ),
  );
}

function normalizedCapabilities(
  values: Array<UtopyNodeCapability | string>,
): UtopyNodeCapability[] {
  return values
    .map((value) =>
      typeof value === "string"
        ? { id: value, produces: [value] }
        : value,
    )
    .filter((value): value is UtopyNodeCapability => Boolean(value?.id));
}

function safePublicEndpoint(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = typeof window !== "undefined"
      ? new URL(raw, window.location.href)
      : new URL(raw);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function buildNodeManifestDV(
  config: UtopyNodeManifestConfig,
  now = Date.now(),
): PublishableDV {
  const heartbeatMs = Math.max(15_000, Number(config.heartbeatMs || 30_000));
  const ttlMs = Math.max(heartbeatMs * 2, Number(config.ttlMs || heartbeatMs * 3));
  const ts = new Date(now).toISOString();
  const endpoints = Object.fromEntries(
    Object.entries(config.endpoints || {})
      .map(([key, value]) => [key, safePublicEndpoint(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const capabilities = normalizedCapabilities(config.capabilities || []);

  return {
    id: `utopy.node.manifest:${config.nodeId}`,
    kind: "utopy.node.manifest",
    attrs: {
      node: { id: config.nodeId, name: config.nodeName },
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      storeId: config.storeId,
      authority: config.nodeId,
      baseUrl: safePublicEndpoint(config.baseUrl),
      endpoints,
      capabilities,
      surfaces: uniq([config.surfaces, capabilities.flatMap((cap) => cap.surfaces || [])]),
      discovery: {
        protocol: "utopy.node.manifest@2",
        mode: "self-announced",
        heartbeatMs,
        expiresAt: new Date(now + ttlMs).toISOString(),
      },
      ...(config.extraAttrs || {}),
    },
    traits: uniq([
      "sem.dv.read",
      "utopy:node:manifest",
      "utopy:node:self-announced",
      "mt:catalog.source",
      "resonance:capable",
      ...(config.traits || []),
    ]),
    meta: {
      ns: "utopy:nodes",
      ts,
      updatedAt: ts,
      version: config.version ?? now,
      ttl_ms: ttlMs,
      scopes: config.scopes?.length ? config.scopes : ["public"],
      originNode: config.nodeId,
      authority: config.nodeId,
      portable: true,
      schema: "utopy.node.manifest@2",
    },
    labels: [config.nodeName, "Nodo vivo"],
  };
}

export async function verifyNodeManifestDV(dv: any, allLive: any[] = []) {
  const nodeId = text(dv?.attrs?.nodeId || dv?.attrs?.node?.id);
  const authority = text(dv?.meta?.authority || dv?.attrs?.authority);
  if (!nodeId || !/node\.manifest$/i.test(text(dv?.kind))) {
    return { accepted: false, proof: "invalid" as const, reason: "No es un manifiesto de nodo." };
  }
  if (authority !== nodeId) {
    return { accepted: false, proof: "invalid" as const, reason: "La autoridad no coincide con el nodo." };
  }
  if (!dv?.meta?.ownership?.signature?.value) {
    return {
      accepted: false,
      proof: "unverified" as const,
      reason: "El manifiesto no contiene una firma verificable del nodo.",
    };
  }
  return verifyAuthorizedDV(dv, allLive);
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createLeaderLease(nodeId: string, heartbeatMs: number) {
  const key = `utopy.node.heartbeat.leader:${nodeId}`;
  const owner = randomId();
  const leaseMs = Math.max(heartbeatMs * 2, 45_000);

  const read = (): { owner?: string; expiresAt?: number } => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  };

  const claim = () => {
    if (typeof localStorage === "undefined") return true;
    const current = read();
    const now = Date.now();
    if (current.owner && current.owner !== owner && Number(current.expiresAt) > now) {
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify({ owner, expiresAt: now + leaseMs }));
    } catch {
      return true;
    }
    return read().owner === owner;
  };

  const release = () => {
    try {
      if (read().owner === owner) localStorage.removeItem(key);
    } catch {}
  };

  return { claim, release };
}

export function startNodeManifestHeartbeat(
  config: UtopyNodeManifestConfig,
  options: ManifestHeartbeatOptions = {},
): () => void {
  if (typeof window === "undefined") return () => {};
  const nodeId = text(config.nodeId);
  if (!nodeId) throw new Error("startNodeManifestHeartbeat requiere nodeId.");

  const existing = activeByNode.get(nodeId);
  if (existing) {
    existing.refs += 1;
    return existing.release;
  }

  const env = (import.meta as any)?.env || {};
  const seedWs = text(
    options.seedWs || env.VITE_SEED_WS || "wss://seed.mterra.space/utopy?ns=mt",
  );
  const heartbeatMs = Math.max(15_000, Number(config.heartbeatMs || 30_000));
  const reconnectMs = Math.max(2_000, Number(options.reconnectMs || 8_000));
  const leader = createLeaderLease(nodeId, heartbeatMs);
  const directWebSocket = options.directWebSocket !== false;
  const useUtopyEvent = options.useUtopyEvent !== false;
  const leaderElection = options.leaderElection !== false;

  let stopped = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let announcing = false;

  const connect = () => {
    if (stopped || !directWebSocket || !seedWs || ws) return;
    try {
      ws = new WebSocket(seedWs);
      ws.onopen = () => void announce(true);
      ws.onerror = () => {
        try { ws?.close(); } catch {}
      };
      ws.onclose = () => {
        ws = null;
        if (stopped || reconnectTimer != null) return;
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, reconnectMs);
      };
    } catch {
      ws = null;
    }
  };

  const announce = async (force = false) => {
    if (stopped) return;
    if (leaderElection && !leader.claim()) return;
    if (announcing) return;
    announcing = true;
    const manifest = buildNodeManifestDV(config);
    try {
      const signed = useUtopyEvent
        ? (
            await publishAuthorizedDV({
              dv: manifest,
              actingAsNodeId: nodeId,
              action: "node.manifest.publish",
              sensitivity: "relationship",
              allowNodeBootstrap: true,
            })
          ).dv
        : manifest;

      if (directWebSocket && ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify(
              buildDvUpsertEnvelope(signed, { sourceNodeId: nodeId }),
            ),
          );
        } catch {}
      } else if (force) {
        connect();
      }
    } finally {
      announcing = false;
    }
  };

  connect();
  void announce(true);
  const timer = window.setInterval(() => void announce(false), heartbeatMs);
  const onWake = () => void announce(true);
  const onVisible = () => document.visibilityState === "visible" && onWake();
  window.addEventListener("online", onWake);
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", onVisible);

  const runtime: Runtime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;
      stopped = true;
      window.clearInterval(timer);
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
      leader.release();
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisible);
      activeByNode.delete(nodeId);
    },
  };
  activeByNode.set(nodeId, runtime);
  return runtime.release;
}

export function startManifestEndpointHeartbeat(
  manifestUrl: string,
  options: ManifestHeartbeatOptions & { refreshMs?: number } = {},
): () => void {
  if (typeof window === "undefined") return () => {};
  let releaseHeartbeat: (() => void) | null = null;
  let stopped = false;
  const refreshMs = Math.max(30_000, Number(options.refreshMs || 5 * 60_000));

  const load = async () => {
    if (stopped) return;
    try {
      const response = await fetch(manifestUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (stopped) return;
      const manifests = [
        ...(Array.isArray(payload?.nodeManifests) ? payload.nodeManifests : []),
        ...(payload?.kind === "utopy.node.manifest" ? [payload] : []),
      ];
      const dv = manifests.find((item: any) => item?.kind === "utopy.node.manifest");
      if (!dv) throw new Error("El endpoint no emitió utopy.node.manifest.");
      const attrs = dv.attrs || {};
      const node = attrs.node || {};
      const config: UtopyNodeManifestConfig = {
        nodeId: text(node.id || attrs.nodeId || dv.meta?.originNode),
        nodeName: text(node.name || attrs.nodeName || node.id || attrs.nodeId),
        storeId: text(attrs.storeId) || undefined,
        authority: text(attrs.authority || dv.meta?.authority) || undefined,
        baseUrl: text(attrs.baseUrl) || undefined,
        endpoints: attrs.endpoints || {},
        capabilities: Array.isArray(attrs.capabilities) ? attrs.capabilities : [],
        surfaces: Array.isArray(attrs.surfaces) ? attrs.surfaces : [],
        traits: Array.isArray(dv.traits) ? dv.traits : [],
        scopes: Array.isArray(dv.meta?.scopes) ? dv.meta.scopes : ["public"],
        heartbeatMs: Number(attrs.discovery?.heartbeatMs || 30_000),
        ttlMs: Number(dv.meta?.ttl_ms || 90_000),
      };
      if (!config.nodeId) throw new Error("Manifiesto sin nodeId.");
      releaseHeartbeat?.();
      releaseHeartbeat = startNodeManifestHeartbeat(config, options);
    } catch (error) {
      console.warn("[UTOPY] No se pudo leer el manifiesto del nodo:", error);
    }
  };

  void load();
  const timer = window.setInterval(() => void load(), refreshMs);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    releaseHeartbeat?.();
    releaseHeartbeat = null;
    void stopped;
  };
}
