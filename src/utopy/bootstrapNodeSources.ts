// src/utopy/bootstrapNodeSources.ts
//
// Bootstrap público y editable desde cPanel.
// No descarga productos directamente: publica fuentes de catálogo en el store.
// liveCatalog.sources.ts sigue validando identidad, descargando, adaptando y
// reemplazando este bootstrap cuando llega un manifiesto vivo real del nodo.

import { ingestMany } from "../mt/mt.ingest";

type BootstrapNode = {
  id: string;
  nodeId?: string;
  nodeName?: string;
  storeId?: string;
  authority?: string;
  catalogUrl: string;
  manifestUrl?: string;
  profileUrl?: string;
  publicBaseUrl?: string;
  approximateLocation?: {
    lat: number;
    lng: number;
    label?: string;
    precision?: string;
    source?: string;
  };
  falconSurfaces?: string[];
  refreshMs?: number;
  enabled?: boolean;
};

type Runtime = {
  refs: number;
  release: () => void;
};

let activeRuntime: Runtime | null = null;

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (!match) return false;

  const [a, b] = match.slice(1).map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function safeCatalogUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const localDev = ["localhost", "127.0.0.1", "::1"].includes(host);

    if (
      parsed.protocol !== "https:" &&
      !(localDev && parsed.protocol === "http:")
    ) {
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

function normalizeEntry(raw: any): BootstrapNode | null {
  if (!raw || typeof raw !== "object" || raw.enabled === false) return null;

  const id = text(raw.id || raw.nodeId || raw.storeId || raw.authority);
  const catalogUrl = safeCatalogUrl(raw.catalogUrl);

  if (!id || !catalogUrl) return null;

  return {
    id,
    nodeId: text(raw.nodeId) || undefined,
    nodeName: text(raw.nodeName) || undefined,
    storeId: text(raw.storeId) || undefined,
    authority: text(raw.authority) || undefined,
    catalogUrl,
    manifestUrl: safeCatalogUrl(raw.manifestUrl) || undefined,
    profileUrl: safeCatalogUrl(raw.profileUrl) || undefined,
    publicBaseUrl: safeCatalogUrl(raw.publicBaseUrl) || undefined,
    approximateLocation:
      Number.isFinite(Number(raw?.approximateLocation?.lat)) &&
      Number.isFinite(Number(raw?.approximateLocation?.lng))
        ? {
            ...raw.approximateLocation,
            lat: Number(raw.approximateLocation.lat),
            lng: Number(raw.approximateLocation.lng),
          }
        : undefined,
    falconSurfaces: Array.isArray(raw.falconSurfaces)
      ? raw.falconSurfaces.map(text).filter(Boolean)
      : undefined,
    refreshMs: Math.max(20_000, Number(raw.refreshMs || 60_000)),
    enabled: true,
  };
}

function selectionDVs(entry: BootstrapNode) {
  // storeId es la identidad comercial estable que liveCatalog.sources
  // conserva incluso cuando originNode llega en una variante normalizada.
  const targetId = entry.storeId || entry.nodeId || entry.id;
  return (entry.falconSurfaces || []).map((surface) => ({
    id: `falcon.selection.bootstrap:${surface}:${targetId}`,
    kind: "falcon.selection",
    attrs: {
      surface,
      targetId,
      state: "selected",
      priority: 80,
      reason: "Selección editorial de la configuración pública",
    },
    traits: ["falcon.selection", "falcon.curation", "utopy:bootstrap"],
    meta: {
      ns: "falcon:curation",
      scopes: ["public", "falcon"],
      authority: "falcon.bootstrap",
      source: "utopy-bootstrap-nodes.json",
      updatedAt: new Date().toISOString(),
    },
  }));
}

function sourceDV(entry: BootstrapNode) {
  const now = new Date().toISOString();

  return {
    id: `catalog.source.bootstrap:${entry.id}`,
    kind: "catalog.source",
    attrs: {
      sourceId: entry.id,
      nodeId: entry.nodeId || entry.id,
      node: {
        id: entry.nodeId || entry.id,
        name: entry.nodeName || entry.id,
      },
      nodeName: entry.nodeName || entry.id,
      storeId: entry.storeId,
      authority: entry.authority || entry.id,
      catalogUrl: entry.catalogUrl,
      manifestUrl: entry.manifestUrl,
      profileUrl: entry.profileUrl,
      publicBaseUrl: entry.publicBaseUrl,
      approximateLocation: entry.approximateLocation,
      refreshMs: entry.refreshMs,
      enabled: true,
      bootstrap: true,
    },
    traits: [
      "sem.dv.read",
      "mt:catalog.source",
      "utopy:bootstrap",
    ],
    meta: {
      ns: "utopy:nodes",
      scopes: ["public", "market"],
      source: "utopy-bootstrap-nodes.json",
      updatedAt: now,
      ts: now,
    },
  };
}

export function startBootstrapNodeSources(
  configUrl = "/utopy-bootstrap-nodes.json",
): () => void {
  if (activeRuntime) {
    activeRuntime.refs += 1;
    return activeRuntime.release;
  }

  if (typeof window === "undefined") return () => {};

  let stopped = false;
  let controller: AbortController | null = null;

  const sync = async () => {
    if (stopped) return;

    controller?.abort();
    controller = new AbortController();

    try {
      const response = await fetch(configUrl, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`bootstrap HTTP ${response.status}`);
      }

      const payload = await response.json();
      const entries = (
        Array.isArray(payload) ? payload : payload?.sources
      );

      const sources = (Array.isArray(entries) ? entries : [])
        .map(normalizeEntry)
        .filter((entry): entry is BootstrapNode => Boolean(entry));

      ingestMany(
        sources.flatMap((entry) => [sourceDV(entry), ...selectionDVs(entry)]),
        {
        ns: "utopy:nodes",
        scopes: ["public", "market"],
        source: "bootstrap.config",
        },
      );

      if (import.meta.env.DEV) {
        console.info(
          `[UTOPY bootstrap] ${sources.length} fuente(s) de nodo disponibles.`,
        );
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.warn("[UTOPY bootstrap] No se pudo leer la configuración:", error);
      }
    }
  };

  void sync();

  // El archivo público puede cambiar en cPanel sin reconstruir JavaScript.
  const timer = window.setInterval(() => void sync(), 5 * 60_000);
  const onWake = () => void sync();
  const onVisible = () => {
    if (document.visibilityState === "visible") void sync();
  };

  window.addEventListener("online", onWake);
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", onVisible);

  const runtime: Runtime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;

      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisible);

      if (activeRuntime === runtime) activeRuntime = null;
    },
  };

  activeRuntime = runtime;
  return runtime.release;
}
