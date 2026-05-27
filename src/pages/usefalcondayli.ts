import { useMemo } from "react";
import { useFalconFeed } from "../falcon/usefalconfeed";
import {
  classifyDailyCategory,
  scoreForSection,
  isDayliItem,
  type FalconDailyCategory,
} from "../falcon/falconsection";
import type { CanonicalFalconItem } from "../falcon/falconcurator";

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

function sortByDailyScore(items: CanonicalFalconItem[]) {
  return [...items].sort((a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"));
}

function asFood(node: CanonicalFalconItem): FalconDayliFood {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    subtitle: node.subtitle,
    price: node.price,
    currency: node.currency,
    cover: node.cover,
    category: classifyDailyCategory(node),
    producerId: node.orgId,
    producerName: node.orgName,
    territoryId: node.territoryId,
    territoryName: node.territoryName,
    available: node.available,
    tags: node.tags,
    ns: node.ns,
    score: scoreForSection(node, "daily"),
    raw: node.raw,
  };
}

function asProducer(node: CanonicalFalconItem): FalconDayliProducer {
  return {
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
  };
}

function asTerritory(node: CanonicalFalconItem): FalconDayliTerritory {
  return {
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
  };
}

export function useFalconDayli(cat?: string) {
  const { loading, error, targetNamespaces, productos, territorios, orgs } = useFalconFeed();

  const foods = useMemo(() => {
    return sortByDailyScore(productos.filter(isDayliItem)).map(asFood);
  }, [productos]);

  const filteredFoods = useMemo(() => {
    if (!cat || cat === "destacados") return foods;
    const q = String(cat).toLowerCase().trim();

    return foods
      .filter(
        (x) =>
          String(x.category).toLowerCase() === q ||
          x.tags.some((t) => String(t).toLowerCase().includes(q))
      )
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [foods, cat]);

  const producers = useMemo(() => {
    return orgs
      .filter((x) => {
        const blob = [x.role || "", ...x.tags].join(" ").toLowerCase();
        return (
          blob.includes("producer") ||
          blob.includes("productor") ||
          blob.includes("service") ||
          blob.includes("almacen") ||
          blob.includes("feria") ||
          blob.includes("coop")
        );
      })
      .sort((a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"))
      .map(asProducer);
  }, [orgs]);

  const territoryItems = useMemo(() => {
    return [...territorios]
      .sort((a, b) => scoreForSection(b, "daily") - scoreForSection(a, "daily"))
      .map(asTerritory);
  }, [territorios]);

  const featuredFoods = useMemo(() => filteredFoods.slice(0, 12), [filteredFoods]);
  const featuredProducers = useMemo(() => producers.slice(0, 8), [producers]);
  const featuredTerritories = useMemo(() => territoryItems.slice(0, 8), [territoryItems]);

  const summary = useMemo(
    () => ({
      foods: foods.length,
      producers: producers.length,
      territories: territoryItems.length,
      visible: filteredFoods.length,
      targetNamespaces,
    }),
    [foods.length, producers.length, territoryItems.length, filteredFoods.length, targetNamespaces]
  );

  return {
    loading,
    error,
    summary,
    targetNamespaces,
    foods,
    filteredFoods,
    producers,
    territories: territoryItems,
    featuredFoods,
    featuredProducers,
    featuredTerritories,
  };
}