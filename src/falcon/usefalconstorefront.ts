// Falcon Store is a curated projection of the shared live stream.
// It never opens its own socket, EventSource, catalog loader or store.
import { useMemo } from "react";
import type { FalconStoreCollection, FalconStoreItem } from "../types/falcon.store";
import { resolveLiveImage, resolveLiveSeller } from "../mt/livePresentation";
import {
  buildFalconSelectionIndex,
  selectionForItem,
} from "./falcon.selection";
import { scoreForSection } from "./falconsection";
import { useFalconFeed } from "./usefalconfeed";

function byScore(items: FalconStoreItem[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function filterByCat(items: FalconStoreItem[], cat: string) {
  if (!cat || cat === "destacados") return byScore(items);
  const query = cat.toLowerCase();
  return byScore(items.filter((item) => item.category.includes(query) || item.tags.some((tag) => tag.includes(query))));
}

function collectionsOf(items: FalconStoreItem[]): FalconStoreCollection[] {
  const groups = new Map<string, FalconStoreItem[]>();
  for (const item of byScore(items)) {
    const key = item.category || "seleccion";
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return Array.from(groups.entries()).slice(0, 4).map(([key, group]) => ({
    key,
    title: key === "seleccion" ? "Selección Falcon" : key.charAt(0).toUpperCase() + key.slice(1),
    subtitle: "Oferta viva verificada",
    items: group.slice(0, 10),
  }));
}

export function useFalconStorefront(cat: string) {
  const { productos, liveDVs, loading, error } = useFalconFeed();
  const selectionIndex = useMemo(() => buildFalconSelectionIndex(liveDVs, "falcon.store"), [liveDVs]);

  const items = useMemo(() => productos.flatMap((item): FalconStoreItem[] => {
    const selection = selectionForItem(selectionIndex, item);
    if (selection?.state === "excluded") return [];
    const selected = selection?.state === "selected" || selection?.state === "pinned";
    if (!selected || item.ns !== "mt:market") return [];
    const raw = item.raw || item;
    return [{
      id: item.id,
      title: item.title,
      description: item.subtitle,
      price: item.price,
      currency: item.currency || "PYG",
      image: resolveLiveImage(raw, liveDVs) || item.cover || "",
      images: [],
      category: String(item.category || "seleccion").toLowerCase(),
      tags: item.tags || [],
      sellerId: item.orgId,
      sellerName: resolveLiveSeller(raw, liveDVs),
      sourceNode: item.orgId || item.raw?.meta?.originNode,
      featured: selection?.state === "pinned" || item.featured,
      inStock: item.available,
      score:
        scoreForSection(item, "store") +
        (selection?.state === "pinned" ? 1000 : selection?.priority || 0),
      raw,
    }];
  }), [productos, liveDVs, selectionIndex]);

  const filtered = useMemo(() => filterByCat(items, cat), [items, cat]);
  const collections = useMemo(() => collectionsOf(items), [items]);
  return { items, filtered, collections, loading, error, liveDVs };
}
