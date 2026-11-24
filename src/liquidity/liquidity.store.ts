// ============================================
// FILE: src/mt/liquidity.store.ts
// ============================================

import { create } from "zustand";
import type {
  DVLike,
  LiquidityAccountSummary,
  LiquidityCounterpartyTrust,
  LiquidityThreadSummary,
  LiquidityTrustState,
} from "./mt.liquidity";
import {
  asCurrency,
  getActorIdsForDV,
  getLiquidityCurrency,
  getLiquidityThreadId,
  isLiquidityDV,
  reduceAccountSummary,
  reduceThreadSummary,
  reduceTrustByCounterparty,
  reduceTrustForActor,
  safeNum,
  toLedgerEntries,
} from "./mt.liquidity";

// Cambié el tipo de índice a `string` en lugar de `DVLike[]`
type Indices = {
  byId: Record<string, DVLike>; // `string` como clave y `DVLike` como valor
  byActor: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de actores
  byCurrency: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de monedas
  byThread: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de hilos
  byActorCurrency: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de actores y monedas
  byActorCounterparty: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de contrapartes
  byEscrowStatus: Record<string, string[]>;  // Cambié a `string[]`, solo IDs de escrow
  actorIds: string[];  // Asegúrate de que esto esté declarado correctamente como array de strings
};

type LiquidityStoreState = {
  dvs: DVLike[];
  index: Indices;

  upsertDV: (dv: DVLike) => void;
  upsertMany: (dvs: DVLike[]) => void;
  clear: () => void;

  getActorDVs: (actorId: string) => DVLike[];
  getActorCurrencyDVs: (actorId: string, currency?: string) => DVLike[];
  getEscrowDVs: (status: string) => DVLike[];
  getThreadDVs: (threadId: string) => DVLike[];
  getCounterpartyDVs: (actorId: string, counterpartyId: string) => DVLike[];

  getAccountSummary: (actorId: string, currency?: string) => any;
  getTrust: (actorId: string) => any;
  getTrustByCounterparty: (actorId: string, counterpartyId: string) => any;
  getThreadSummary: (threadId: string, currency?: string) => any;
  getActorCurrencies: (actorId: string) => string[];
  getCounterparties: (actorId: string) => string[];
  getLatestByThread: (threadId: string, limit?: number) => DVLike[];
};

export const useLiquidityStore = create<LiquidityStoreState>((set, get) => ({
  dvs: [],
  index: {
    byId: {},
    byActor: {},
    byCurrency: {},
    byThread: {},
    byActorCurrency: {},
    byActorCounterparty: {},
    byEscrowStatus: {},
    actorIds: [],
  },

  upsertDV: (dv) => {
    set((s) => {
      const map = new Map(s.dvs.map((item) => [String(item.id), item]));
      map.set(String(dv.id), dv);
      const newDvs = Array.from(map.values());
      return {
        dvs: newDvs,
        index: rebuildIndex(newDvs),
      };
    });
  },

  upsertMany: (dvs) => {
    set((s) => {
      const map = new Map(s.dvs.map((item) => [String(item.id), item]));
      for (const dv of dvs) {
        if (dv?.id) map.set(String(dv.id), dv);
      }
      const newDvs = Array.from(map.values());
      return {
        dvs: newDvs,
        index: rebuildIndex(newDvs),
      };
    });
  },

  clear: () => set({ dvs: [], index: { byId: {}, byActor: {}, byCurrency: {}, byThread: {}, byActorCurrency: {}, byActorCounterparty: {}, byEscrowStatus: {}, actorIds: [] } }),

  getEscrowDVs: (status) => {
    const { index } = get();
    const ids = index.byEscrowStatus[status] || [];
    return ids.map((id) => index.byId[id]);
  },

  getActorDVs: (actorId) => {
    const { index } = get();
    const ids = index.byActor[actorId] || [];
    return ids.map((id) => index.byId[id]);
  },

  getActorCurrencyDVs: (actorId, currency = "PYG") => {
    const { index } = get();
    const key = `${actorId}|${currency}`;
    const ids = index.byActorCurrency[key] || [];
    return ids.map((id) => index.byId[id]);
  },

  getThreadDVs: (threadId) => {
    const { index } = get();
    const ids = index.byThread[threadId] || [];
    return ids.map((id) => index.byId[id]);
  },

  getCounterpartyDVs: (actorId, counterpartyId) => {
    const { index } = get();
    const key = `${actorId}|${counterpartyId}`;
    const ids = index.byActorCounterparty[key] || [];
    return ids.map((id) => index.byId[id]);
  },

  getAccountSummary: (actorId, currency = "PYG") => {
    const { index } = get();
    const dv = index.byActor[actorId] || [];
    return reduceAccountSummary(actorId, currency, dv.map((id) => index.byId[id]));
  },

  getTrust: (actorId) => {
    const { index } = get();
    const dv = index.byActor[actorId] || [];
    return reduceTrustForActor(actorId, dv .map((id) => index.byId[id]));
  },

  getTrustByCounterparty: (actorId, counterpartyId) => {
    const { index } = get();
    const dv = index.byActorCounterparty[`${actorId}|${counterpartyId}`] || [];
    return reduceTrustByCounterparty(actorId, counterpartyId, dv .map((id) => index.byId[id]));
  },

  getThreadSummary: (threadId, currency = "PYG") => {
    const { index } = get();
    const dv = index.byThread[threadId] || [];
    return reduceThreadSummary(threadId, currency, dv .map((id) => index.byId[id]));
  },

  getActorCurrencies: (actorId) => {
    const { index } = get();
    const out = new Set<string>();
    for (const key of Object.keys(index.byActorCurrency)) {
      const [aid, cur] = key.split("|");
      if (aid === actorId && cur) out.add(cur);
    }
    return [...out].sort();
  },

  getCounterparties: (actorId) => {
    const { index } = get();
    const out = new Set<string>();
    for (const key of Object.keys(index.byActorCounterparty)) {
      const [aid, cid] = key.split("|");
      if (aid === actorId && cid) out.add(cid);
    }
    return [...out].sort();
  },

  getLatestByThread: (threadId, limit = 10) => {
    const dvs = get().getThreadDVs(threadId);
    return dvs
      .flatMap((dv) => toLedgerEntries(dv))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  },
}));

// Función para eliminar duplicados de un array de strings
function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// Helper function to rebuild the indices
function rebuildIndex(dvs: DVLike[]): Indices {
  const byId: Record<string, DVLike> = {};
  const byActor: Record<string, string[]> = {};  // Usamos solo los IDs de los actores
  const byCurrency: Record<string, string[]> = {};  // Usamos solo los IDs de las monedas
  const byThread: Record<string, string[]> = {};  // Usamos solo los IDs de los hilos
  const byActorCurrency: Record<string, string[]> = {};  // Usamos solo los IDs de los actores y monedas
  const byActorCounterparty: Record<string, string[]> = {};  // Usamos solo los IDs de las contrapartes
  const byEscrowStatus: Record<string, string[]> = {};  // Usamos solo los IDs de los escrow

  const actorIds = new Set<string>();

  for (const dv of dvs) {
    if (!dv?.id) continue;
    byId[dv.id] = dv;

    const actors = getActorIdsForDV(dv);
    const currency = getLiquidityCurrency(dv);
    const threadId = getLiquidityThreadId(dv);
    const escrowStatus =
      dv.kind === "liq.escrow.open"
        ? "open"
        : dv.kind === "liq.escrow.release"
          ? "released"
          : dv.kind === "liq.escrow.refund"
            ? "refunded"
            : null;

    if (escrowStatus) {
      if (!byEscrowStatus[escrowStatus]) byEscrowStatus[escrowStatus] = [];
      byEscrowStatus[escrowStatus].push(dv.id);  // Usamos solo el ID
    }

    for (const actorId of actors) {
      actorIds.add(actorId);
      if (!byActor[actorId]) byActor[actorId] = [];
      byActor[actorId].push(dv.id);  // Usamos solo el ID

      const acKey = `${actorId}|${currency}`;
      if (!byActorCurrency[acKey]) byActorCurrency[acKey] = [];
      byActorCurrency[acKey].push(dv.id);  // Usamos solo el ID
    }
    if (currency) {
  if (!byCurrency[currency]) byCurrency[currency] = [];
  byCurrency[currency].push(dv.id);
}

if (threadId) {
  if (!byThread[threadId]) byThread[threadId] = [];
  byThread[threadId].push(dv.id);
}

    if (dv.kind === "liq.transfer") {
      const fromId = dv.attrs?.from?.id;
      const toId = dv.attrs?.to?.id;
      if (fromId && toId) {
        const keyA = `${fromId}|${toId}`;
        const keyB = `${toId}|${fromId}`;
        if (!byActorCounterparty[keyA]) byActorCounterparty[keyA] = [];
        if (!byActorCounterparty[keyB]) byActorCounterparty[keyB] = [];
        byActorCounterparty[keyA].push(dv.id);  // Usamos solo el ID
        byActorCounterparty[keyB].push(dv.id);  // Usamos solo el ID
      }
    }
  }

  return {
    byId,
    actorIds: [...actorIds].sort(),
    byActor: Object.fromEntries(Object.entries(byActor).map(([k, v]) => [k, uniq(v)])),
    byCurrency: Object.fromEntries(Object.entries(byCurrency).map(([k, v]) => [k, uniq(v)])),
    byThread: Object.fromEntries(Object.entries(byThread).map(([k, v]) => [k, uniq(v)])),
    byActorCurrency: Object.fromEntries(Object.entries(byActorCurrency).map(([k, v]) => [k, uniq(v)])),
    byActorCounterparty: Object.fromEntries(Object.entries(byActorCounterparty).map(([k, v]) => [k, uniq(v)])),
    byEscrowStatus,
  };
}
