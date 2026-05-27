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

function sortByCapitalScore<T extends { score?: number }>(items: T[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function useFalconCapital(cat?: string) {
  const { loading, error, targetNamespaces, productos, territorios, orgs } = useFalconFeed();

  const packs = useMemo(() => {
    return sortByCapitalScore(
      productos
        .filter(isCapitalPackItem)
        .map((x) => asCapitalPack(x, scoreForSection(x, "capital")))
    );
  }, [productos]);

  const assets = useMemo(() => {
    return sortByCapitalScore(
      productos
        .filter(isCapitalAssetItem)
        .map((x) => asCapitalAsset(x, scoreForSection(x, "capital")))
    );
  }, [productos]);

  const projects = useMemo(() => {
    return sortByCapitalScore(
      orgs
        .filter(isCapitalProjectItem)
        .map((x) => asCapitalProject(x, scoreForSection(x, "capital")))
    );
  }, [orgs]);

  const producers = useMemo(() => {
    return sortByCapitalScore(
      orgs
        .filter(isStrategicOrg)
        .map((x) => asCapitalProducer(x, scoreForSection(x, "capital")))
    );
  }, [orgs]);

  const territoryItems = useMemo(() => {
    return sortByCapitalScore(
      territorios
        .filter(isTerritoryNode)
        .map((x) => asCapitalTerritory(x, scoreForSection(x, "capital")))
    );
  }, [territorios]);

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