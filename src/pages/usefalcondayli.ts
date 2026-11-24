// src/pages/usefalcondayli.ts
// Falcon Daily es una superficie curada del catálogo universal de MS Market.
// Nunca carga un catálogo propio ni reconoce comercios por nombre.

import { useMemo } from "react";
import { useFalconFeed } from "../falcon/usefalconfeed";
import {
  classifyDailySubcategory,
  scoreForSection,
  isDayliItem,
  type FalconDailyCategory,
} from "../falcon/falconsection";
import type { CanonicalFalconItem } from "../falcon/falconcurator";
import {
  buildFalconSelectionIndex,
  selectionForItem,
  type FalconSelectionState,
} from "../falcon/falcon.selection";
import {
  capabilityNamesForSurface,
  nodeIdentityOf,
  nodeNameOf,
  normalizeSemantic,
} from "../mt/utopy.symbiosis";

export type FalconDayliFood = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  price: number | null;
  currency: string;
  cover: string;
  category: FalconDailyCategory;
  producerId?: string;
  producerName?: string;
  territoryId?: string;
  territoryName?: string;
  available?: boolean;
  tags: string[];
  ns: string;
  score: number;
  nodeId?: string;
  nodeName?: string;
  capabilities: string[];
  hasPayment: boolean;
  hasLoyalty: boolean;
  hasTrust: boolean;
  hasDelivery: boolean;
  curation: "automatic" | "explicit";
  selectionState?: FalconSelectionState;
  selectionReason?: string;
  raw: any;
};

export type FalconDayliProducer = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  territoryId?: string;
  territoryName?: string;
  categories: string[];
  tags: string[];
  ns: string;
  score: number;
  raw: any;
};

export type FalconDayliTerritory = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  location?: string;
  tags: string[];
  ns: string;
  score: number;
  raw: any;
};

const CURATED_ONLY =
  String((import.meta as any)?.env?.VITE_FALCON_DAILY_CURATED_ONLY || "true") ===
  "true";

function key(value: unknown): string {
  return normalizeSemantic(value)
    .replace(/^utopy\.node\./, "")
    .replace(/[^a-z0-9]/g, "");
}

function sortByDailyScore(items: CanonicalFalconItem[]) {
  return [...items].sort(
    (a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"),
  );
}

function isDailyCompatible(node: CanonicalFalconItem, capabilities: string[]) {
  if (isDayliItem(node)) return true;
  const blob = [
    node.kind,
    node.title,
    node.subtitle,
    (node as any).category,
    ...(node.tags || []),
    ...capabilities,
  ]
    .join(" ")
    .toLowerCase();

  return /food|comida|cafe|coffee|bebida|panader|pasteler|daily|super|farmacia|recurrent|commerce\.sell|catalog\.offer/.test(
    blob,
  );
}

function has(capabilities: string[], pattern: RegExp): boolean {
  return capabilities.some((value) => pattern.test(value));
}

export function useFalconDayli(cat?: string) {
  const {
    loading,
    error,
    targetNamespaces,
    productos,
    territorios,
    orgs,
    liveDVs,
  } = useFalconFeed();

  const selectionIndex = useMemo(
    () => buildFalconSelectionIndex(liveDVs, "falcon.daily"),
    [liveDVs],
  );

  const capabilityIndex = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const dv of liveDVs) {
      const nodeId = nodeIdentityOf(dv);
      if (!nodeId) continue;
      const id = key(nodeId);
      const values = capabilityNamesForSurface(dv, "daily");
      const bucket = map.get(id) || new Set<string>();
      values.forEach((value) => bucket.add(value));
      map.set(id, bucket);
    }
    return map;
  }, [liveDVs]);

  const foods = useMemo(() => {
    return sortByDailyScore(productos)
      .map((node) => {
        const nodeId = nodeIdentityOf(node.raw) || (node as any).orgId || "";
        const capabilities = Array.from(capabilityIndex.get(key(nodeId)) || []);
        const selection = selectionForItem(selectionIndex, node);
        const automatic = node.ns === "mt:market" && isDailyCompatible(node, capabilities);
        return { node, nodeId, capabilities, selection, automatic };
      })
      .filter(({ node, selection, automatic }) => {
        if (selection?.state === "excluded") return false;
        if (selection?.state === "selected" || selection?.state === "pinned") {
          return node.ns === "mt:market";
        }
        return CURATED_ONLY ? false : automatic;
      })
      .map(({ node, nodeId, capabilities, selection }): FalconDayliFood => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        subtitle: node.subtitle,
        price: node.price,
        currency: node.currency,
        cover: node.cover,
        category: classifyDailySubcategory(node),
        producerId: node.orgId,
        producerName: node.orgName,
        territoryId: node.territoryId,
        territoryName: node.territoryName,
        available: node.available,
        tags: node.tags,
        ns: node.ns,
        score:
          scoreForSection(node, "daily") +
          (selection?.state === "pinned" ? 1000 : selection?.priority || 0),
        nodeId: nodeId || undefined,
        nodeName: nodeNameOf(node.raw) || node.orgName || undefined,
        capabilities,
        hasPayment: has(capabilities, /payment|checkout|pay/),
        hasLoyalty: has(capabilities, /loyalty|fidel|reward/),
        hasTrust: has(capabilities, /trust|confianza|proof/),
        hasDelivery: has(capabilities, /delivery|entrega|transport/),
        curation: selection ? "explicit" : "automatic",
        selectionState: selection?.state,
        selectionReason: selection?.reason,
        raw: node.raw,
      }))
      .sort((a, b) => b.score - a.score);
  }, [productos, capabilityIndex, selectionIndex]);

  const filteredFoods = useMemo(() => {
    if (!cat || cat === "destacados" || cat === "todo") return foods;
    const q = String(cat).toLowerCase().trim();
    if (q === "comida") return foods.filter(item => ["comida", "salados", "dulces", "bebidas-calientes", "bebidas-frias"].includes(item.category));
    return foods.filter(
      (item) =>
        String(item.category).toLowerCase() === q ||
        item.tags.some((tag) => String(tag).toLowerCase().includes(q)),
    );
  }, [foods, cat]);

  const producers = useMemo(() => {
    return orgs
      .filter((node) => {
        const nodeId = nodeIdentityOf(node.raw) || node.id;
        const caps = Array.from(capabilityIndex.get(key(nodeId)) || []);
        const blob = [node.role || "", ...node.tags, ...caps]
          .join(" ")
          .toLowerCase();
        return /producer|productor|service|almacen|feria|coop|commerce|food/.test(
          blob,
        );
      })
      .sort((a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"))
      .map((node): FalconDayliProducer => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        subtitle: node.subtitle,
        cover: node.cover,
        territoryId: node.territoryId,
        territoryName: node.territoryName,
        categories: [String(node.role || "org")],
        tags: node.tags,
        ns: node.ns,
        score: scoreForSection(node, "daily"),
        raw: node.raw,
      }));
  }, [orgs, capabilityIndex]);

  const territoryItems = useMemo(
    () =>
      [...territorios]
        .sort((a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"))
        .map((node): FalconDayliTerritory => ({
          id: node.id,
          kind: node.kind,
          title: node.title,
          subtitle: node.subtitle,
          cover: node.cover,
          location: node.worldId,
          tags: node.tags,
          ns: node.ns,
          score: scoreForSection(node, "daily"),
          raw: node.raw,
        })),
    [territorios],
  );

  return {
    loading,
    error,
    liveDVs,
    targetNamespaces,
    foods,
    filteredFoods,
    producers,
    territories: territoryItems,
    featuredFoods: filteredFoods.slice(0, 12),
    featuredProducers: producers.slice(0, 8),
    featuredTerritories: territoryItems.slice(0, 8),
    summary: {
      foods: foods.length,
      producers: producers.length,
      territories: territoryItems.length,
      visible: filteredFoods.length,
      explicit: foods.filter((item) => item.curation === "explicit").length,
      automatic: foods.filter((item) => item.curation === "automatic").length,
      targetNamespaces,
    },
  };
}
