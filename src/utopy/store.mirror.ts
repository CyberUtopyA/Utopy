// src/utopy/store.mirror.ts
import type { MindStore } from "./mind";
import type { BioBase } from "./types.bio";
import { sporeClient } from "./utopy.spore";

// LWW simple (si hay meta.ts la usamos; si no, ganará el último set)
function lww(local?: BioBase, incoming?: BioBase): BioBase {
  if (!local) return incoming!;
  if (!incoming) return local;
  const lt = Number(local.meta?.ts ?? 0);
  const it = Number(incoming.meta?.ts ?? Date.now());
  return it >= lt ? incoming : local;
}

type RemoteAdapter = {
  push: (bio: BioBase) => Promise<void>;
  pull: () => Promise<BioBase[]>;
};

// Adaptador remoto usando sporeClient.buscar / dato.create
export function makeRemoteSporeAdapter(): RemoteAdapter {
  return {
    async push(bio: BioBase) {
      // llamada directa al verbo (sin imponer kinds)
      // tolerante a seeds mínimos: si falla, no rompe el flujo local
      try {
        const sp: any = (sporeClient as any)?.spore;
        if (sp?.call) await sp.call("dato.create", bio);
      } catch { /* best-effort */ }
    },
    async pull(): Promise<BioBase[]> {
      try {
        const res = await sporeClient.buscar({}, 500);
        // compat de payloads
        const items = (res as any)?.payload?.items ?? (Array.isArray(res) ? res : []);
        // filtramos por estructura de BioBase mínima
        return (items as any[]).filter(x => x && typeof x.id === "string" && typeof x.kind === "string");
      } catch {
        return [];
      }
    },
  };
}

// Mirror: envuelve tu MindStore local
export function makeMirrorStore(local: MindStore, remote: RemoteAdapter): MindStore {
  // pequeña cola en memoria para reintentos (opcional)
  const queue: BioBase[] = [];
  let pushing = false;

  async function flushQueue() {
    if (pushing) return;
    pushing = true;
    try {
      while (queue.length) {
        const next = queue.shift()!;
        await remote.push(next);
      }
    } finally {
      pushing = false;
    }
  }

  return {
    async get(key: string) {
      return local.get(key);
    },

    async set(key: string, value: any) {
      // guardamos local
      await local.set(key, value);

      // si es un bio: espejamos best-effort
      if (key.startsWith("bio:") && value && typeof value === "object") {
        const bio = value as BioBase;
        queue.push({ ...bio, meta: { ...(bio.meta || {}), ts: Number(bio.meta?.ts ?? Date.now()) } });
        flushQueue().catch(() => {});
      }
    },

    async all(prefix: string) {
      // devolvemos lo que ya hay local
      const pairs = await local.all(prefix);

      // en segundo plano: pull de red y cacheo
      if (!prefix || prefix.startsWith("bio:")) {
        remote.pull().then(async (list) => {
          // merge LWW por id
          for (const incoming of list) {
            const k = `bio:${incoming.id}`;
            const curr = await local.get(k);
            const merged = lww(curr, incoming);
            if (merged !== curr) await local.set(k, merged);
          }
        }).catch(() => {});
      }

      return pairs;
    },
  };
}
