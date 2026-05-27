import type { CanonicalFalconItem } from "../falcon/falconcurator";
import {
  classifyCapitalCategory,
  isCapitalPackItem,
  isUsedVehicleCreditLike,
} from "../falcon/falconsection";

export type FalconCapitalAsset = {
  id: string;
  kind: string;
  title: string;
  creditEligible: boolean;
  subtitle: string;
  price: number | null;
  currency: string;
  cover: string;
  category: "renta" | "negocios" | "activos" | "extranjero" | "territorios";
  territoryId?: string;
  territoryName?: string;
  producerId?: string;
  producerName?: string;
  available?: boolean;
  tags: string[];
  ns: string;
  score: number;
  raw: any;
};

export type FalconCapitalProject = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  category: "renta" | "negocios" | "activos" | "extranjero" | "territorios";
  territoryId?: string;
  territoryName?: string;
  tags: string[];
  ns: string;
  score: number;
  raw: any;
};

export type FalconCapitalProducer = {
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

export type FalconCapitalTerritory = {
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

export type FalconCapitalFabricationPack = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  category: "renta" | "negocios" | "activos" | "extranjero" | "territorios";
  domain: string;
  marketCategory: string;
  inputKind: string;
  publishAs: "work.intent" | "mt.product" | "both" | "unknown";
  creditEligible: boolean;
  estimatedCost: number | null;
  estimatedCurrency: string;
  pieceCount: number;
  materialCount: number;
  processCount: number;
  providerCount: number;
  territoryId?: string;
  territoryName?: string;
  tags: string[];
  ns: string;
  score: number;
  raw: any;
};

export function asCapitalAsset(node: CanonicalFalconItem, score: number): FalconCapitalAsset {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    creditEligible: !!node.creditEligible,
    subtitle: node.subtitle,
    price: node.price,
    currency: node.currency,
    cover: node.cover,
    category: classifyCapitalCategory(node),
    territoryId: node.territoryId,
    territoryName: node.territoryName,
    producerId: node.orgId,
    producerName: node.orgName,
    available: node.available,
    tags: node.tags,
    ns: node.ns,
    score,
    raw: node.raw,
  };
}

export function asCapitalProject(node: CanonicalFalconItem, score: number): FalconCapitalProject {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    subtitle: node.subtitle,
    cover: node.cover,
    category: classifyCapitalCategory(node),
    territoryId: node.territoryId,
    territoryName: node.territoryName,
    tags: node.tags,
    ns: node.ns,
    score,
    raw: node.raw,
  };
}

export function asCapitalProducer(node: CanonicalFalconItem, score: number): FalconCapitalProducer {
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
    score,
    raw: node.raw,
  };
}

export function asCapitalTerritory(node: CanonicalFalconItem, score: number): FalconCapitalTerritory {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    subtitle: node.subtitle,
    cover: node.cover,
    location: node.worldId,
    tags: node.tags,
    ns: node.ns,
    score,
    raw: node.raw,
  };
}

export function asCapitalPack(node: CanonicalFalconItem, score: number): FalconCapitalFabricationPack {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    subtitle: node.subtitle,
    cover: node.cover,
    category: classifyCapitalCategory(node),
    domain: String(node.domain || "general"),
    marketCategory: String(node.marketCategory || node.category || "custom.production"),
    inputKind: String(node.inputKind || "scene"),
    publishAs: node.publishAs || "unknown",
    creditEligible: !!node.creditEligible,
    estimatedCost: node.price,
    estimatedCurrency: node.currency,
    pieceCount: node.pieceCount,
    materialCount: node.materialCount,
    processCount: node.processCount,
    providerCount: node.providerCount,
    territoryId: node.territoryId,
    territoryName: node.territoryName,
    tags: node.tags,
    ns: node.ns,
    score,
    raw: node.raw,
  };
}

export { isCapitalPackItem, isUsedVehicleCreditLike };