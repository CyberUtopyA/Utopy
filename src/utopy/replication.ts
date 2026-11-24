// src/utopy/replication.ts
// RÃ©plica verificable: conserva primero una copia local y luego sincroniza con
// cada destino independiente configurado. Nunca acepta un DV con firma invÃ¡lida.

import { getWalletStatus, observeOwnershipProof, verifyOwnedDV } from "./ownership";

export type ReplicaStatus = {
  localReady: boolean;
  endpoints: string[];
  independent: boolean;
  pending: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
};

type QueueItem = {
  key: string;
  dv: any;
  pendingEndpoints: string[];
  attempts: number;
  nextAttemptAt: number;
  createdAt: string;
};

const DB_NAME = "utopy.replica.v1";
const DV_STORE = "dvs";
const QUEUE_STORE = "queue";
const CONFIG_KEY = "utopy.replica.endpoints.v1";
const CURSOR_PREFIX = "utopy.replica.cursor:";
let memoryDvs = new Map<string, any>();
let memoryQueue = new Map<string, QueueItem>();
let started = false;
let timer: number | null = null;
let flushing = false;
let lastPushAt: string | null = null;
let lastPullAt: string | null = null;
let lastError: string | null = null;
const channel = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("utopy.wallet.replica.v1")
  : null;

function signatureKey(dv: any) {
  const id = String(dv?.id || `${dv?.kind || "dv"}:${dv?.meta?.ts || Date.now()}`);
  const signature = String(dv?.meta?.ownership?.signature?.value || "unsigned").slice(0, 24);
  return `${id}::${signature}`;
}

function mayLeaveDevice(dv: any) {
  const scopes = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes.map(String) : [];
  const traits = Array.isArray(dv?.traits) ? dv.traits.map((item: any) => String(item).toLowerCase()) : [];
  const explicitlyPrivate = scopes.some((item: string) => item === "private" || item.startsWith("private:"))
    || traits.some((item: string) => item.includes("private") || item.includes("sensitive"));
  return scopes.includes("public") && !explicitlyPrivate;
}

function safeEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

function envEndpoints(): string[] {
  try {
    const raw = (import.meta as any)?.env?.VITE_UTOPY_REPLICA_URLS || "";
    return String(raw).split(",").map(safeEndpoint).filter(Boolean) as string[];
  } catch { return []; }
}

export function getReplicaEndpoints(): string[] {
  let stored: string[] = [];
  try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || "[]"); } catch { stored = []; }
  return Array.from(new Set([...stored, ...envEndpoints()].map(String).map(safeEndpoint).filter(Boolean) as string[]));
}

export function configureReplicaEndpoints(values: string[]): string[] {
  const endpoints = Array.from(new Set(values.map(String).map(safeEndpoint).filter(Boolean) as string[]));
  localStorage.setItem(CONFIG_KEY, JSON.stringify(endpoints));
  window.dispatchEvent(new CustomEvent("utopy.replica.changed", { detail: { endpoints } }));
  void flushReplication();
  return endpoints;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB no disponible"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DV_STORE)) request.result.createObjectStore(DV_STORE);
      if (!request.result.objectStoreNames.contains(QUEUE_STORE)) request.result.createObjectStore(QUEUE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putStore(store: string, key: string, value: any) {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    if (store === DV_STORE) memoryDvs.set(key, value);
    else memoryQueue.set(key, value);
  }
}

async function deleteQueue(key: string) {
  memoryQueue.delete(key);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      tx.objectStore(QUEUE_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* memoria ya actualizada */ }
}

async function readAll<T>(store: string): Promise<T[]> {
  try {
    const db = await openDB();
    const values = await new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return values;
  } catch {
    return Array.from((store === DV_STORE ? memoryDvs : memoryQueue).values()) as T[];
  }
}

async function appendVerifiedLocal(dv: any, announce = true) {
  const key = signatureKey(dv);
  await putStore(DV_STORE, key, dv);
  if (announce) channel?.postMessage({ kind: "dv", dv });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("utopy.replica.local", { detail: { dv } }));
  }
}

export async function replicateOwnedDV(dv: any): Promise<boolean> {
  if (!(await verifyOwnedDV(dv))) {
    lastError = "Se rechazÃ³ una rÃ©plica con firma invÃ¡lida.";
    return false;
  }
  await observeOwnershipProof(dv);
  await appendVerifiedLocal(dv);
  if (!mayLeaveDevice(dv)) return true;
  const endpoints = getReplicaEndpoints();
  if (endpoints.length) {
    const key = signatureKey(dv);
    await putStore(QUEUE_STORE, key, {
      key,
      dv,
      pendingEndpoints: endpoints,
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: new Date().toISOString(),
    } satisfies QueueItem);
    void flushReplication();
  }
  return true;
}

async function pushEndpoint(endpoint: string, items: QueueItem[]) {
  const response = await fetch(`${endpoint}/v1/dv/batch`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json", "x-utopy-protocol": "replica/1" },
    body: JSON.stringify({ protocol: "utopy.replica.batch/1", items: items.map((item) => item.dv) }),
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
}

export async function flushReplication() {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const now = Date.now();
    const queue = (await readAll<QueueItem>(QUEUE_STORE)).filter((item) => item.nextAttemptAt <= now);
    const byEndpoint = new Map<string, QueueItem[]>();
    for (const item of queue) {
      for (const endpoint of item.pendingEndpoints) byEndpoint.set(endpoint, [...(byEndpoint.get(endpoint) || []), item]);
    }
    for (const [endpoint, items] of byEndpoint) {
      try {
        await pushEndpoint(endpoint, items.slice(0, 50));
        lastPushAt = new Date().toISOString();
        for (const item of items.slice(0, 50)) {
          const pendingEndpoints = item.pendingEndpoints.filter((value) => value !== endpoint);
          if (!pendingEndpoints.length) await deleteQueue(item.key);
          else await putStore(QUEUE_STORE, item.key, { ...item, pendingEndpoints, attempts: item.attempts + 1 });
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        for (const item of items.slice(0, 50)) {
          const attempts = item.attempts + 1;
          await putStore(QUEUE_STORE, item.key, {
            ...item,
            attempts,
            nextAttemptAt: Date.now() + Math.min(300_000, 2 ** Math.min(attempts, 8) * 1000),
          });
        }
      }
    }
  } finally {
    flushing = false;
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("utopy.replica.status"));
  }
}

export async function pullReplicas() {
  const wallet = await getWalletStatus();
  for (const endpoint of getReplicaEndpoints()) {
    const cursorKey = `${CURSOR_PREFIX}${endpoint}:${wallet.ownerDid}`;
    const cursor = localStorage.getItem(cursorKey) || "";
    try {
      const url = new URL(`${endpoint}/v1/dv`);
      url.searchParams.set("ownerDid", wallet.ownerDid);
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
      const payload = await response.json();
      for (const dv of Array.isArray(payload?.items) ? payload.items : []) {
        if (await verifyOwnedDV(dv)) {
          await observeOwnershipProof(dv);
          await appendVerifiedLocal(dv);
          window.dispatchEvent(new CustomEvent("utopy.replica.incoming", { detail: { dv, endpoint } }));
        }
      }
      if (payload?.cursor) localStorage.setItem(cursorKey, String(payload.cursor));
      lastPullAt = new Date().toISOString();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
}

export async function getReplicationStatus(): Promise<ReplicaStatus> {
  const endpoints = getReplicaEndpoints();
  const pending = (await readAll<QueueItem>(QUEUE_STORE)).length;
  return {
    localReady: typeof indexedDB !== "undefined",
    endpoints,
    independent: endpoints.length >= 2,
    pending,
    lastPushAt,
    lastPullAt,
    lastError,
  };
}

export async function listLocalReplicas(): Promise<any[]> {
  return readAll<any>(DV_STORE);
}

export function startIndependentReplication() {
  if (started || typeof window === "undefined") return () => undefined;
  started = true;
  const run = () => { void flushReplication(); void pullReplicas(); };
  window.addEventListener("online", run);
  timer = window.setInterval(run, 20_000);
  channel?.addEventListener("message", (event) => {
    if (event.data?.kind === "dv") void verifyOwnedDV(event.data.dv).then((ok) => {
      if (ok) return appendVerifiedLocal(event.data.dv, false);
    });
  });
  run();
  return () => {
    window.removeEventListener("online", run);
    if (timer != null) window.clearInterval(timer);
    timer = null;
    started = false;
  };
}

if (typeof window !== "undefined") startIndependentReplication();