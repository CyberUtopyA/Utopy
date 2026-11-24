// src/falcon/usefalconfeed.ts
// Falcon ya no abre otra red paralela: interpreta el mismo mt.liveStore universal.

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FALCON_MT_NAMESPACES,
  parseNsList,
  toCanonicalFalconItem,
  upsertById,
  type CanonicalFalconItem,
} from "./falconcurator";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { ingestFrame } from "../mt/mt.ingest";
import { bootLiveSymbiosis } from "../utopy/bootLiveSymbiosis";

const FALCON_MT_NS_RAW =
  (import.meta as any)?.env?.VITE_FALCON_MT_NS ||
  DEFAULT_FALCON_MT_NAMESPACES.join(",");
const SNAPSHOT_KEY = "falcon.feed.snapshot.v3";

function readSnapshot(): CanonicalFalconItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSnapshot(items: CanonicalFalconItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(items));
  } catch {}
}

function curate(
  all: any[],
  targetNamespaces: string[],
): CanonicalFalconItem[] {
  let result: CanonicalFalconItem[] = [];
  for (const raw of all) {
    const item = toCanonicalFalconItem(raw, targetNamespaces);
    if (item) result = upsertById(result, item);
  }
  return result;
}

function readLegacyBootstrap(): any[] {
  if (typeof window === "undefined") return [];
  const out: any[] = [];
  const win = window as any;
  const candidates = [
    win.__MS_MARKET_PRODUCTS__,
    win.__MT_PRODUCTS__,
    win.__FALCON_BOOTSTRAP__,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) out.push(...value);
    else if (Array.isArray(value?.items)) out.push(...value.items);
    else if (Array.isArray(value?.products)) out.push(...value.products);
  }
  for (const key of [
    "ms.market.snapshot",
    "ms.market.products",
    "mt.market.snapshot",
    "mt.products",
    "falcon.bootstrap",
  ]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (Array.isArray(parsed?.items)) out.push(...parsed.items);
      else if (Array.isArray(parsed?.products)) out.push(...parsed.products);
    } catch {}
  }
  return out;
}

export function useFalconFeed() {
  const targetNamespaces = useMemo(() => parseNsList(FALCON_MT_NS_RAW), []);
  const [items, setItems] = useState<CanonicalFalconItem[]>(() => {
    const live = curate(mtLiveSnapshot() as any[], targetNamespaces);
    return live.length ? live : readSnapshot();
  });
  const [liveDVs, setLiveDVs] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [loading, setLoading] = useState(() => items.length === 0);
  const [error, setError] = useState("");

  useEffect(() => {
    const stopRuntime = bootLiveSymbiosis();

    const legacy = readLegacyBootstrap();
    if (legacy.length) ingestFrame(legacy, { source: "falcon.legacy.bootstrap" });

    const unsubscribe = mtLiveSubscribe((all) => {
      const nextDVs = Array.isArray(all) ? (all as any[]) : [];
      const next = curate(nextDVs, targetNamespaces);
      setLiveDVs(nextDVs);
      setItems(next);
      persistSnapshot(next);
      setLoading(false);
      setError("");
    });

    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.state === "error" && items.length === 0) {
        setError(detail.message || "Un nodo vivo todavía no respondió.");
      }
    };
    window.addEventListener("utopy:catalog-source:status", onStatus);

    return () => {
      unsubscribe();
      stopRuntime();
      window.removeEventListener("utopy:catalog-source:status", onStatus);
    };
  }, [targetNamespaces]);

  const productos = useMemo(
    () => items.filter((item: any) => item.rootKind === "producto"),
    [items],
  );
  const territorios = useMemo(
    () => items.filter((item: any) => item.rootKind === "territorio"),
    [items],
  );
  const orgs = useMemo(
    () => items.filter((item: any) => item.rootKind === "org"),
    [items],
  );

  return {
    loading,
    error,
    items,
    liveDVs,
    productos,
    territorios,
    orgs,
    targetNamespaces,
    summary: {
      items: items.length,
      productos: productos.length,
      territorios: territorios.length,
      orgs: orgs.length,
      targetNamespaces,
    },
  };
}
