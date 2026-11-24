import { mtLiveUpsert } from "./mt.liveStore";
import { publishDatoVivo } from "./seedbus";

export type CatalogSourceInput = {
  nodeId: string;
  storeId: string;
  storeName?: string;
  authority: string;
  catalogUrl: string;
  refreshMs?: number;
  scopes?: string[];
};

export function buildCatalogSourceDV(input: CatalogSourceInput) {
  const now = new Date().toISOString();

  return {
    id: `catalog.source:${input.nodeId}`,
    kind: "catalog.source",
    attrs: {
      sourceId: input.nodeId,
      nodeId: input.nodeId,
      originNode: input.nodeId,
      storeId: input.storeId,
      storeName: input.storeName || input.storeId,
      authority: input.authority,
      catalogUrl: input.catalogUrl,
      refreshMs: Math.max(20_000, Number(input.refreshMs || 30_000)),
      enabled: true,
      protocol: "utopy.catalog.source/1",
    },
    traits: [
      "mt:catalog.source",
      "mt:catalog.live",
      `store:${input.storeId}`,
      `node:${input.nodeId}`,
    ],
    meta: {
      ns: "mt:market",
      scopes:
        Array.isArray(input.scopes) && input.scopes.length
          ? input.scopes
          : ["public"],
      authority: input.authority,
      originNode: input.nodeId,
      version: 1,
      updatedAt: now,
      ts: now,
    },
  };
}

export async function publishCatalogSource(input: CatalogSourceInput) {
  const dv = buildCatalogSourceDV(input);
  mtLiveUpsert(dv as any);
  await publishDatoVivo(dv as any);
  return dv;
}
