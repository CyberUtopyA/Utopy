export type RelationAction = "physical_product" | "onsite_service" | "remote_work" | "machine" | "material" | "rental" | "generic";
export type TerritorialMode = "for_me" | "nearby" | "explore";
const num = (value: any) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const text = (...values: any[]) => values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
export function geoPoint(value: any) {
  const attrs = value?.attrs || {};
  const candidates = [attrs.approximateLocation, attrs.approximateDestination, attrs.geo, attrs.location, value?.geo, value?.location, attrs, value?.meta?.geo, value?.meta?.location, attrs.raw?.geo, attrs.raw?.location, value];
  for (const raw of candidates) {
    if (!raw) continue;
    const coordinates = raw?.coordinates;
    const lat = num(raw?.lat ?? raw?.latitude ?? (Array.isArray(raw) ? raw[0] : Array.isArray(coordinates) ? coordinates[1] : null));
    const lng = num(raw?.lng ?? raw?.lon ?? raw?.longitude ?? (Array.isArray(raw) ? raw[1] : Array.isArray(coordinates) ? coordinates[0] : null));
    if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { lat, lng };
  }
  return null;
}
/** Ubicación visible; nunca revela la coordenada precisa de una persona o señal. */
export function publicGeoPoint(value: any) {
  const attrs = value?.attrs || {};
  if (Array.isArray(attrs.privacyPolicies) && attrs.privacyPolicies.includes("noLocationDisclosure")) return null;
  const point = geoPoint(value);
  if (!point) return null;
  const kind = String(value?.kind || "").toLowerCase();
  const source = attrs.approximateLocation || attrs.geo || attrs.location || {};
  const person = /person|profile|presence|resonance|capability/.test(kind) || (value?.traits || []).includes("actor:person");
  if (person && attrs.publicLocation !== true && attrs.locationVisibility !== "public" && !attrs.approximateLocation && source.precision !== "approximate" && source.approximate !== true && !/resonance|capability/.test(kind)) return null;
  const digits = person || source.precision === "approximate" ? 2 : 5;
  const scale = 10 ** digits;
  return { lat: Math.round(point.lat * scale) / scale, lng: Math.round(point.lng * scale) / scale, precision: (digits === 2 ? "approximate" : "public") as "approximate" | "public" };
}
export function distanceKmBetween(a: any, b: any) { const one = geoPoint(a), two = geoPoint(b); if (!one || !two) return null; const rad = (v: number) => v * Math.PI / 180; const dLat = rad(two.lat - one.lat), dLng = rad(two.lng - one.lng); const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(rad(one.lat)) * Math.cos(rad(two.lat)); return 12742 * Math.asin(Math.sqrt(x)); }
export function relationActionOf(value: any): RelationAction { const blob = [value?.kind, ...(value?.traits || []), value?.attrs?.category, value?.attrs?.capability, value?.attrs?.intent?.text].filter(Boolean).join(" ").toLowerCase(); if (/rental|alquiler|property|inmueble/.test(blob)) return "rental"; if (/machine|cnc|máquina|equipment/.test(blob)) return "machine"; if (/material|madera|metal|insumo|waste/.test(blob)) return "material"; if (/service|work|install|repair|trabajo|servicio/.test(blob)) return "onsite_service"; if (/product|producto|delivery|commerce/.test(blob)) return "physical_product"; return "generic"; }
export function declaredRanges(value: any) { const attrs = value?.attrs || value || {}; const ranges = attrs.ranges || attrs.territorialRange || {}; return { workRangeKm: num(ranges.workRangeKm ?? attrs.workRangeKm ?? attrs.workRange), deliveryRangeKm: num(ranges.deliveryRangeKm ?? attrs.deliveryRangeKm ?? attrs.deliveryRange), serviceRangeKm: num(ranges.serviceRangeKm ?? attrs.serviceRangeKm ?? attrs.serviceRadiusKm), remote: ranges.remote === true || attrs.remote === true, pickup: ranges.pickup === true || attrs.pickup === true, onSite: ranges.onSite === true || attrs.onSite === true, territoryId: text(attrs.territoryId, attrs.territory?.id, attrs.territory) }; }
export function canRelate(input: { need: any; capability: any; action?: RelationAction; mode?: TerritorialMode }) { const mode = input.mode || "for_me"; const action = input.action || relationActionOf(input.need || input.capability); const ranges = declaredRanges(input.capability); const distanceKm = distanceKmBetween(input.need, input.capability); const needTerritory = text(input.need?.attrs?.territoryId, input.need?.territoryId); const sameTerritory = Boolean(needTerritory && ranges.territoryId && needTerritory === ranges.territoryId); if (mode === "explore") return { compatible: true, recommended: false, reason: "Explorando fuera de tu zona", distanceKm, action, rangeKm: null };
  if ((action === "remote_work" || action === "generic") && ranges.remote) return { compatible: true, recommended: true, reason: "Puede ayudarte a distancia", distanceKm, action, rangeKm: null };
  if (action === "rental") return { compatible: sameTerritory || distanceKm != null, recommended: sameTerritory || (distanceKm != null && distanceKm <= 50), reason: sameTerritory ? "Está en tu territorio" : distanceKm == null ? "Consultá la ubicación" : "Podés explorar esta zona", distanceKm, action, rangeKm: null };
  const rangeKm = action === "physical_product" || action === "material" ? ranges.deliveryRangeKm : action === "onsite_service" || action === "machine" ? (ranges.workRangeKm ?? ranges.serviceRangeKm) : (ranges.serviceRangeKm ?? ranges.workRangeKm ?? ranges.deliveryRangeKm);
  if (distanceKm == null) return { compatible: sameTerritory || ranges.remote, recommended: sameTerritory || ranges.remote, reason: ranges.remote ? "Puede ayudarte a distancia" : sameTerritory ? "Trabaja en tu territorio" : "Consultale si llega hasta vos", distanceKm, action, rangeKm };
  if (rangeKm == null) return { compatible: sameTerritory, recommended: sameTerritory, reason: sameTerritory ? "Trabaja en tu territorio" : "Consultale si llega hasta vos", distanceKm, action, rangeKm };
  const compatible = distanceKm <= rangeKm; return { compatible, recommended: compatible, reason: compatible ? (action === "physical_product" || action === "material" ? "Puede entregarte" : "Trabaja en tu zona") : "Fuera de su zona habitual", distanceKm, action, rangeKm };
}

// Única semántica territorial para Feed, Frecuencia, Mapa y proyectores.
export const resolveTerritorialCompatibility = canRelate;
