// src/utopy/storage.ts
export interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, val: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  push?(queue: string, item: any): Promise<void>;
  shift?(queue: string): Promise<any | null>;
}

type NMStore = { kv: Map<string, string>; q: Map<string, any[]> };

function ensureStore(): NMStore {
  const g: any = globalThis as any;
  if (!g.__UTOPY_NODEMIND) g.__UTOPY_NODEMIND = {};
  if (!g.__UTOPY_NODEMIND.store) {
    g.__UTOPY_NODEMIND.store = { kv: new Map<string, string>(), q: new Map<string, any[]>() };
  }
  return g.__UTOPY_NODEMIND.store as NMStore;
}

export async function getKV(): Promise<KVStore> {
  const st = ensureStore();
  return {
    async getItem(k) { return st.kv.has(k) ? st.kv.get(k)! : null; },
    async setItem(k, v) { st.kv.set(k, v); },
    async removeItem(k) { st.kv.delete(k); },
    async push(name, item) {
      const arr = st.q.get(name) ?? [];
      arr.push(item); st.q.set(name, arr);
    },
    async shift(name) {
      const arr = st.q.get(name) ?? [];
      const first = arr.length ? arr.shift()! : null;
      st.q.set(name, arr);
      return first ?? null;
    },
  };
}
