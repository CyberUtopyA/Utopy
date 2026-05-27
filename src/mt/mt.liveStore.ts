// src/mt/mt.liveStore.ts
// Store vivo para DatoVivo MT (MS web) + persistencia en localStorage

import type { DatoVivo } from "./mt.traitAdapter";

const STORAGE_KEY = "mt.web.liveDatos";

type Listener = (all: DatoVivo[]) => void;

const store = new Map<string, DatoVivo>();
const listeners = new Set<Listener>();
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    store.clear();
    for (const anyDv of arr) {
      if (!anyDv || typeof anyDv !== "object") continue;
      if (!anyDv.id || !anyDv.kind) continue;
      const dv = anyDv as DatoVivo;
      store.set(String(dv.id), dv);
    }
  } catch (e) {
    console.warn("[MT web] mt.liveStore hydrate error:", e);
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(store.values());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("[MT web] mt.liveStore persist error:", e);
  }
}

export function mtLiveSnapshot(): DatoVivo[] {
  hydrate();
  return Array.from(store.values());
}

export function mtLiveUpsert(dv: DatoVivo) {
  hydrate();
  store.set(String(dv.id), dv);
  persist();
  const all = Array.from(store.values());
  for (const cb of listeners) {
    try {
      cb(all);
    } catch (e) {
      console.warn("[MT web] mtLive listener error:", e);
    }
  }
}

export function mtLiveSubscribe(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  // dispara inmediatamente con lo que haya (incluyendo lo de localStorage)
  listener(Array.from(store.values()));
  return () => {
    listeners.delete(listener);
  };
}

export function mtLiveClear() {
  store.clear();
  persist();
  for (const cb of listeners) {
    try {
      cb([]);
    } catch {}
  }
}
