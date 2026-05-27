// src/utopy/store.local.async.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MindStore } from "./mind";

// Helpers
const safeParse = (raw: string | null) => {
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
};
const safeString = (v: any) => {
  try { return JSON.stringify(v); } catch { return JSON.stringify({ _bad: true }); }
};

export function makeAsyncStore(ns = "mt"): MindStore {
  const K = (k: string) => `${ns}:${k}`;

  // multiGet en lotes para evitar picos de memoria/tiempo
  async function multiGetBatched(keys: string[], batch = 64) {
    const out: Array<[string, string | null]> = [];
    for (let i = 0; i < keys.length; i += batch) {
      const slice = keys.slice(i, i + batch);
      const part = await AsyncStorage.multiGet(slice);
      out.push(...part);
    }
    return out;
  }

  return {
    async get(key: string) {
      try {
        const raw = await AsyncStorage.getItem(K(key));
        return safeParse(raw);
      } catch {
        return undefined;
      }
    },

    async set(key: string, value: any) {
      try {
        await AsyncStorage.setItem(K(key), safeString(value));
      } catch {
        // en RN a veces hay cuotas; si falla, simplemente noop
      }
    },

    async all(prefix: string) {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const mine = (prefix ? keys.filter(k => k.startsWith(`${ns}:${prefix}`))
                             : keys.filter(k => k.startsWith(`${ns}:`)));
        if (mine.length === 0) return [];

        const pairsRaw = await multiGetBatched(mine, 64);
        const pairs: Array<[string, any]> = [];
        for (const [fullK, raw] of pairsRaw) {
          const k = fullK.replace(`${ns}:`, "");
          const v = safeParse(raw);
          if (v !== undefined) pairs.push([k, v]);
        }
        return pairs;
      } catch {
        return [];
      }
    },
  };
}
