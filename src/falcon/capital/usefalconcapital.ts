import { useMemo } from "react";
import { useFalconFeed } from "../usefalconfeed";
import {
  isCapitalAssetItem,
  isCapitalPackItem,
  isCapitalProjectItem,
  isStrategicOrg,
  isTerritoryNode,
  isUsedVehicleCreditLike,
  scoreForSection,
} from "../falconsection";
import {
  asCapitalAsset,
  asCapitalPack,
  asCapitalProducer,
  asCapitalProject,
} from "../../pages/mtcapitalbridge";
import { asCapitalTerritory } from "../../pages/mtcapitalbridge";
import { buildFalconSelectionIndex, selectionForItem } from "../falcon.selection";

function sortByCapitalScore<T extends { score?: number }>(items: T[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function useFalconCapital(cat?: string) {
  cat = ({ yield: "renta", inversion: "activos", partners: "extranjero", premium: "destacados" } as Record<string, string>)[cat || ""] || cat;
  const { loading, error, targetNamespaces, productos, territorios, orgs, liveDVs } = useFalconFeed();
  const migratedSelections = useMemo(() => {
    const previouslyVisible = [
      ...productos.filter((item) => isCapitalAssetItem(item) || isCapitalPackItem(item)),
      ...orgs.filter((item) => isCapitalProjectItem(item) || isStrategicOrg(item)),
      ...territorios.filter(isTerritoryNode),
    ];
    return previouslyVisible.map((item: any) => ({
      id: `falcon.selection:migrated:capital:${String(item?.id || item?.raw?.id || "item")}`,
      kind: "falcon.selection",
      attrs: { surface: "falcon.capital", targetId: String(item?.id || item?.raw?.id || ""), state: "selected", priority: 40, reason: "Curaduría semántica migrada de Falcon Capital" },
      traits: ["falcon.selection", "falcon.curation", "migration:legacy-visibility"],
      meta: { ns: "falcon:curation", scopes: ["public", "falcon"], authority: "falcon.curator.migration", updatedAt: item?.raw?.meta?.updatedAt || item?.raw?.meta?.ts || "2026-01-01T00:00:00.000Z" },
    }));
  }, [productos, orgs, territorios]);
  const selectionIndex = useMemo(() => {
    const migrated = buildFalconSelectionIndex(migratedSelections, "falcon.capital");
    const explicit = buildFalconSelectionIndex(liveDVs, "falcon.capital");
    explicit.forEach((decision, id) => migrated.set(id, decision));
    return migrated;
  }, [liveDVs, migratedSelections]);
  const selected = (item: any) => {
    const decision = selectionForItem(selectionIndex, item);
    return decision?.state === "selected" || decision?.state === "pinned";
  };
  const curatedProducts = useMemo(() => productos.filter(selected), [productos, selectionIndex]);
  const curatedOrgs = useMemo(() => orgs.filter(selected), [orgs, selectionIndex]);
  const curatedTerritories = useMemo(() => territorios.filter(selected), [territorios, selectionIndex]);

  const packs = useMemo(() => {
    return sortByCapitalScore(
      curatedProducts
        .filter(isCapitalPackItem)
        .map((x) => asCapitalPack(x, scoreForSection(x, "capital")))
    );
  }, [curatedProducts]);

  const assets = useMemo(() => {
    return sortByCapitalScore(
      curatedProducts
        .filter(isCapitalAssetItem)
        .map((x) => asCapitalAsset(x, scoreForSection(x, "capital")))
    );
  }, [curatedProducts]);

  const projects = useMemo(() => {
    return sortByCapitalScore(
      curatedOrgs
        .filter(isCapitalProjectItem)
        .map((x) => asCapitalProject(x, scoreForSection(x, "capital")))
    );
  }, [curatedOrgs]);

  const producers = useMemo(() => {
    return sortByCapitalScore(
      curatedOrgs
        .filter(isStrategicOrg)
        .map((x) => asCapitalProducer(x, scoreForSection(x, "capital")))
    );
  }, [curatedOrgs]);

  const territoryItems = useMemo(() => {
    return sortByCapitalScore(
      curatedTerritories
        .filter(isTerritoryNode)
        .map((x) => asCapitalTerritory(x, scoreForSection(x, "capital")))
    );
  }, [curatedTerritories]);

  const filteredAssets = useMemo(() => {
    if (!cat || cat === "destacados") return assets;
    const q = String(cat).toLowerCase().trim();
    return sortByCapitalScore(
      assets.filter(
        (x) =>
          String(x.category).toLowerCase() === q ||
          x.tags.some((t) => String(t).toLowerCase().includes(q))
      )
    );
  }, [assets, cat]);

  const filteredProjects = useMemo(() => {
    if (!cat || cat === "destacados") return projects;
    const q = String(cat).toLowerCase().trim();
    return sortByCapitalScore(
      projects.filter(
        (x) =>
          String(x.category).toLowerCase() === q ||
          x.tags.some((t) => String(t).toLowerCase().includes(q))
      )
    );
  }, [projects, cat]);

  const filteredPacks = useMemo(() => {
    if (!cat || cat === "destacados") return packs;
    const q = String(cat).toLowerCase().trim();
    return sortByCapitalScore(
      packs.filter(
        (x) =>
          String(x.category).toLowerCase() === q ||
          x.tags.some((t) => String(t).toLowerCase().includes(q))
      )
    );
  }, [packs, cat]);

  const featuredAssets = useMemo(() => assets.slice(0, 12), [assets]);
  const featuredProjects = useMemo(() => projects.slice(0, 8), [projects]);
  const featuredProducers = useMemo(() => producers.slice(0, 8), [producers]);
  const featuredTerritories = useMemo(() => territoryItems.slice(0, 8), [territoryItems]);
  const featuredPacks = useMemo(() => packs.slice(0, 8), [packs]);

  const usedVehicleCreditAssets = useMemo(() => {
    return sortByCapitalScore(assets.filter(isUsedVehicleCreditLike)).slice(0, 8);
  }, [assets]);

  const usedVehicleCreditPacks = useMemo(() => {
    return sortByCapitalScore(packs.filter(isUsedVehicleCreditLike)).slice(0, 8);
  }, [packs]);

  const creditEligiblePacks = useMemo(() => {
    return sortByCapitalScore(packs.filter((x) => x.creditEligible)).slice(0, 8);
  }, [packs]);

  const summary = useMemo(
    () => ({
      assets: assets.length,
      projects: projects.length,
      producers: producers.length,
      territories: territoryItems.length,
      packs: packs.length,
      visibleAssets: filteredAssets.length,
      visibleProjects: filteredProjects.length,
      visiblePacks: filteredPacks.length,
      targetNamespaces,
    }),
    [
      assets.length,
      projects.length,
      producers.length,
      territoryItems.length,
      packs.length,
      filteredAssets.length,
      filteredProjects.length,
      filteredPacks.length,
      targetNamespaces,
    ]
  );

  return {
    loading,
    error,
    summary,
    targetNamespaces,
    liveDVs,
    assets,
    projects,
    producers,
    territories: territoryItems,
    packs,
    filteredAssets,
    filteredProjects,
    filteredPacks,
    featuredAssets,
    featuredProjects,
    featuredProducers,
    featuredTerritories,
    featuredPacks,
    usedVehicleCreditAssets,
    usedVehicleCreditPacks,
    creditEligiblePacks,
  };
}
