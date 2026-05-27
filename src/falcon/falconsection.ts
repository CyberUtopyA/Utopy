import type { CanonicalFalconItem } from "./falconcurator";

export type FalconSectionKey = "store" | "daily" | "capital" | "skylines";

export type FalconDailyCategory =
  | "comida"
  | "super"
  | "farmacia"
  | "combos"
  | "recurrente";

export type FalconCapitalCategory =
  | "renta"
  | "negocios"
  | "activos"
  | "extranjero"
  | "territorios";

export function signalText(item: Pick<
  CanonicalFalconItem,
  "rootKind" | "kind" | "title" | "subtitle" | "category" | "tags"
>) {
  return [
    item.rootKind || "",
    item.kind || "",
    item.title || "",
    item.subtitle || "",
    item.category || "",
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .join(" ")
    .toLowerCase();
}

export function classifyDailyCategory(
  item: Pick<
    CanonicalFalconItem,
    "rootKind" | "kind" | "title" | "subtitle" | "category" | "tags" | "recurrente"
  >
): FalconDailyCategory {
  const blob = signalText(item);

  if (
    blob.includes("farmacia") ||
    blob.includes("pharma") ||
    blob.includes("salud") ||
    blob.includes("wellness") ||
    blob.includes("botiquin") ||
    blob.includes("higiene")
  ) {
    return "farmacia";
  }

  if (
    item.recurrente ||
    blob.includes("recurrente") ||
    blob.includes("reposicion") ||
    blob.includes("reposición") ||
    blob.includes("suscripcion") ||
    blob.includes("suscripción") ||
    blob.includes("subscription") ||
    blob.includes("rutina")
  ) {
    return "recurrente";
  }

  if (
    blob.includes("combo") ||
    blob.includes("kit") ||
    blob.includes("estudiante") ||
    blob.includes("extranjero") ||
    blob.includes("landing") ||
    blob.includes("inicio")
  ) {
    return "combos";
  }

  if (
    blob.includes("super") ||
    blob.includes("mercado") ||
    blob.includes("canasta") ||
    blob.includes("despensa") ||
    blob.includes("hogar")
  ) {
    return "super";
  }

  return "comida";
}

export function classifyCapitalCategory(
  item: Pick<
    CanonicalFalconItem,
    "rootKind" | "kind" | "title" | "subtitle" | "category" | "tags" | "creditEligible"
  >
): FalconCapitalCategory {
  const blob = signalText(item);

  if (
    item.rootKind === "territorio" ||
    blob.includes("territorio") ||
    blob.includes("territory") ||
    blob.includes("gobernanza") ||
    blob.includes("governance") ||
    blob.includes("commons") ||
    blob.includes("community")
  ) {
    return "territorios";
  }

  if (
    blob.includes("extranjero") ||
    blob.includes("foreign") ||
    blob.includes("landing") ||
    blob.includes("internacional")
  ) {
    return "extranjero";
  }

  if (
    item.kind === "mo.fabrication.pack" ||
    item.creditEligible ||
    blob.includes("vehiculo") ||
    blob.includes("vehicle") ||
    blob.includes("fabrication") ||
    blob.includes("used") ||
    blob.includes("usado") ||
    blob.includes("asset") ||
    blob.includes("activo") ||
    blob.includes("lote") ||
    blob.includes("propiedad") ||
    blob.includes("renta")
  ) {
    return "activos";
  }

  if (
    item.rootKind === "org" ||
    blob.includes("negocio") ||
    blob.includes("business") ||
    blob.includes("alianza") ||
    blob.includes("producer") ||
    blob.includes("productor") ||
    blob.includes("coop") ||
    blob.includes("consejo") ||
    blob.includes("council")
  ) {
    return "negocios";
  }

  return "renta";
}

export function isDayliItem(item: CanonicalFalconItem) {
  if (item.rootKind !== "producto") return false;

  const blob = signalText(item);

  if (
    blob.includes("vehiculo") ||
    blob.includes("vehicle") ||
    blob.includes("fabrication") ||
    blob.includes("used") ||
    blob.includes("usado") ||
    blob.includes("lote") ||
    blob.includes("propiedad") ||
    blob.includes("renta")
  ) {
    return false;
  }

  return true;
}

export function isCapitalPackItem(item: CanonicalFalconItem) {
  return item.kind === "mo.fabrication.pack";
}

export function isCapitalAssetItem(item: CanonicalFalconItem) {
  if (item.rootKind !== "producto") return false;
  if (isCapitalPackItem(item)) return false;

  const blob = signalText(item);

  return (
    item.creditEligible ||
    blob.includes("vehiculo") ||
    blob.includes("vehicle") ||
    blob.includes("used") ||
    blob.includes("usado") ||
    blob.includes("asset") ||
    blob.includes("activo") ||
    blob.includes("lote") ||
    blob.includes("propiedad") ||
    blob.includes("renta") ||
    blob.includes("credito") ||
    blob.includes("crédito") ||
    blob.includes("liquidity") ||
    blob.includes("finance")
  );
}

export function isCapitalProjectItem(item: CanonicalFalconItem) {
  if (item.rootKind !== "org") return false;
  const blob = signalText(item);

  return (
    blob.includes("project") ||
    blob.includes("proyecto") ||
    blob.includes("mission") ||
    blob.includes("mision") ||
    blob.includes("alianza") ||
    blob.includes("council") ||
    blob.includes("consejo") ||
    blob.includes("coop")
  );
}

export function isStrategicOrg(item: CanonicalFalconItem) {
  if (item.rootKind !== "org") return false;
  const blob = signalText(item);

  return (
    blob.includes("producer") ||
    blob.includes("productor") ||
    blob.includes("guardian") ||
    blob.includes("service") ||
    blob.includes("almacen") ||
    blob.includes("feria") ||
    blob.includes("coop") ||
    blob.includes("council") ||
    blob.includes("consejo")
  );
}

export function isTerritoryNode(item: CanonicalFalconItem) {
  return item.rootKind === "territorio";
}

export function isUsedVehicleCreditLike(item: Pick<
  CanonicalFalconItem,
  "title" | "subtitle" | "tags" | "kind" | "creditEligible"
>) {
  const blob = [
    item.title || "",
    item.subtitle || "",
    item.kind || "",
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  const vehicle =
    blob.includes("vehiculo") ||
    blob.includes("vehicle") ||
    blob.includes("auto") ||
    blob.includes("moto") ||
    blob.includes("camioneta") ||
    blob.includes("movilidad");

  const used =
    blob.includes("usado") ||
    blob.includes("used") ||
    blob.includes("segunda mano") ||
    blob.includes("seminuevo");

  const credit =
    item.creditEligible ||
    blob.includes("credito") ||
    blob.includes("crédito") ||
    blob.includes("cuota") ||
    blob.includes("liquidity") ||
    blob.includes("finance") ||
    blob.includes("payment:credit.eligible");

  return vehicle && (used || credit);
}

export function scoreForSection(
  item: CanonicalFalconItem,
  section: FalconSectionKey
) {
  let score = Number(item.score || 0);

  if (item.cover) score += 25;
  if (typeof item.price === "number") score += 20;
  if (item.available) score += 15;
  if (item.orgName || item.orgId) score += 15;
  if (item.territoryName || item.territoryId) score += 15;
  if (item.featured) score += 20;

  if (section === "daily") {
    const daily = classifyDailyCategory(item);
    if (daily === "recurrente") score += 20;
    if (daily === "farmacia") score += 12;
    if (item.recurrente) score += 20;
  }

  if (section === "capital") {
    if (item.creditEligible) score += 25;
    if (item.kind === "mo.fabrication.pack") score += 25;
    if (isUsedVehicleCreditLike(item)) score += 22;
    if (item.rootKind === "territorio") score += 15;
  }

  if (section === "store") {
    if (item.rootKind === "producto") score += 12;
    if (item.cover) score += 10;
  }

  if (section === "skylines") {
    const blob = signalText(item);
    if (
      blob.includes("propiedad") ||
      blob.includes("alquiler") ||
      blob.includes("renta") ||
      blob.includes("vivienda") ||
      blob.includes("lote")
    ) {
      score += 25;
    }
  }

  return score;
}