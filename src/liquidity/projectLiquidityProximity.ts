import { matchCreditOffers } from "./creditNetwork";
import { collectRelationshipSnapshots } from "../utopy/relationshipProtocol";

export type LiquidityPossibilityKind =
  | "direct"
  | "seller_finance"
  | "credit"
  | "value"
  | "route"
  | "collect"
  | "produce"
  | "deliver"
  | "contribute";

export type LiquidityPossibility = {
  id: string;
  kind: LiquidityPossibilityKind;
  nodeId: string;
  name: string;
  title: string;
  condition: string;
  amount: number | null;
  currency: string | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  relationship: boolean;
  territory: string | null;
  lat: number | null;
  lng: number | null;
  source: any;
};

type Input = {
  allLive: any[];
  actorId?: string | null;
  sellerNodeId?: string | null;
  sellerName?: string | null;
  currency?: string | null;
  amount?: number | null;
  territory?: string | null;
  installmentPreference?: number | null;
  sellerFinance?: any | null;
  applicableRights?: any[];
  publicOnly?: boolean;
};

function text(...values: unknown[]) {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

function number(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function signed(dv: any) {
  return Boolean(dv?.meta?.ownership?.signature?.value);
}

function publicAuthorized(dv: any) {
  const scopes = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes.map(String) : [];
  const sensitivity = text(dv?.meta?.sensitivity).toLowerCase();
  return signed(dv) && scopes.some((scope) => scope === "public" || scope.startsWith("territory:")) && !["private", "sensitive"].includes(sensitivity);
}

function territoryMatches(source: any, territory: string) {
  if (!territory) return true;
  const values = Array.isArray(source) ? source.map(text) : [text(source)].filter(Boolean);
  return !values.length || values.includes(territory);
}

function locationOf(dv: any) {
  const attrs = dv?.attrs || {};
  const geo = attrs?.approximateLocation || attrs?.location || attrs?.geo || {};
  return { lat: number(geo?.lat, attrs?.lat), lng: number(geo?.lng, attrs?.lng) };
}

function capabilityKind(dv: any): LiquidityPossibilityKind | null {
  const attrs = dv?.attrs || {};
  const capabilities = Array.isArray(attrs.capabilities) ? attrs.capabilities : [attrs.capability].filter(Boolean);
  const blob = [dv?.kind, attrs?.title, attrs?.description, ...capabilities.flatMap((capability: any) => typeof capability === "string" ? [capability] : [capability?.id, capability?.kind, capability?.label, ...(capability?.verbs || [])])].map(text).join(" ").toLowerCase();
  if (/deliver|transport|logistic|entrega|repart/.test(blob)) return "deliver";
  if (/produc|manufact|fabric|transform/.test(blob)) return "produce";
  if (/collect|cobrar|payment\.receive|cashier/.test(blob)) return "collect";
  if (/contribut|aportar|material|reuse|reutil/.test(blob)) return "contribute";
  if (/credit|finance|financ/.test(blob)) return "credit";
  return null;
}

function capabilityCopy(kind: LiquidityPossibilityKind) {
  if (kind === "deliver") return "Puede entregar esta operación";
  if (kind === "produce") return "Puede producir lo necesario";
  if (kind === "collect") return "Puede cobrar esta operación";
  if (kind === "contribute") return "Puede aportar a esta operación";
  return "Puede ayudar con esta compra";
}

export function projectLiquidityProximity(input: Input) {
  const allLive = Array.isArray(input.allLive) ? input.allLive : [];
  const currency = text(input.currency).toUpperCase();
  const requestedAmount = Number(input.amount || 0);
  const territory = text(input.territory);
  const relationships = input.publicOnly ? [] : collectRelationshipSnapshots(allLive);
  const relationshipNodes = new Set(
    relationships
      .filter((relationship) => relationship.status === "active" && (!input.actorId || relationship.parties.some((party) => text(party.actorId) === text(input.actorId))))
      .flatMap((relationship) => relationship.parties.map((party) => text(party.nodeId)).filter(Boolean)),
  );
  const possibilities: LiquidityPossibility[] = [];

  if (input.sellerNodeId && requestedAmount > 0) possibilities.push({
    id: `direct:${input.sellerNodeId}`,
    kind: "direct",
    nodeId: text(input.sellerNodeId),
    name: text(input.sellerName, "El comercio"),
    title: "💸 Pago directo",
    condition: "El comercio enviará una opción válida para esta compra.",
    amount: requestedAmount,
    currency: currency || null,
    installmentCount: null,
    installmentAmount: null,
    relationship: relationshipNodes.has(text(input.sellerNodeId)),
    territory: territory || null,
    lat: null,
    lng: null,
    source: null,
  });

  if (input.sellerFinance) {
    const count = number(input.sellerFinance.installmentCount);
    const installmentAmount = number(input.sellerFinance.installmentValue, input.sellerFinance.installmentAmount, input.sellerFinance.installmentPrice);
    if (count && installmentAmount) possibilities.push({
      id: `seller-finance:${input.sellerNodeId || "seller"}:${count}`,
      kind: "seller_finance",
      nodeId: text(input.sellerNodeId),
      name: text(input.sellerName, "El comercio"),
      title: "🗓 Cuotas",
      condition: `Hasta ${count} cuotas ofrecidas por el comercio.`,
      amount: requestedAmount || null,
      currency: currency || text(input.sellerFinance.currency).toUpperCase() || null,
      installmentCount: count,
      installmentAmount,
      relationship: relationshipNodes.has(text(input.sellerNodeId)),
      territory: territory || null,
      lat: null,
      lng: null,
      source: input.sellerFinance,
    });
  }

  if (requestedAmount > 0 && currency) {
    const creditMatches = matchCreditOffers({ allLive: input.publicOnly ? allLive.filter(publicAuthorized) : allLive, amount: requestedAmount, currency, installmentPreference: Number(input.installmentPreference || 6), territory: territory || null, purpose: "market.purchase", actorId: input.actorId });
    for (const match of creditMatches) possibilities.push({
      id: `credit:${match.offerId}`,
      kind: "credit",
      nodeId: match.financeNodeId,
      name: match.financeNodeName,
      title: "🤝 Tu red encontró una posibilidad",
      condition: match.conditions[0] || "Un nodo cercano puede completar parte de esta compra.",
      amount: requestedAmount,
      currency,
      installmentCount: match.installmentCount,
      installmentAmount: null,
      relationship: match.habitualRelationship,
      territory: territory || null,
      lat: locationOf(match.source).lat,
      lng: locationOf(match.source).lng,
      source: match.source,
    });
  }

  for (const right of input.applicableRights || []) possibilities.push({
    id: `value:${text(right?.dv?.id, right?.id)}`,
    kind: "value",
    nodeId: text(input.sellerNodeId),
    name: text(input.sellerName, "El comercio"),
    title: "🌱 Mi Valor",
    condition: text(right?.dv?.attrs?.title, right?.attrs?.title, "Tenés un beneficio disponible"),
    amount: null,
    currency: currency || null,
    installmentCount: null,
    installmentAmount: null,
    relationship: true,
    territory: territory || null,
    lat: null,
    lng: null,
    source: right?.dv || right,
  });

  for (const dv of allLive) {
    if (!publicAuthorized(dv)) continue;
    const kind = text(dv?.kind);
    const attrs = dv?.attrs || {};
    if (kind === "liq.route.offer") {
      if (currency && text(attrs.currency).toUpperCase() && text(attrs.currency).toUpperCase() !== currency) continue;
      if (!territoryMatches(attrs.territory || attrs.territoryId, territory)) continue;
      const routeAmount = number(attrs.availableAmount, attrs.maxAmount, attrs.amount);
      if (requestedAmount > 0 && routeAmount != null && routeAmount <= 0) continue;
      const nodeId = text(attrs.nodeId, attrs.providerNodeId, attrs.sourceNodeId, dv?.meta?.authority);
      const geo = locationOf(dv);
      possibilities.push({ id: `route:${dv.id}`, kind: "route", nodeId, name: text(attrs.nodeName, attrs.providerName, "Nodo cercano"), title: "🤝 Tu red encontró una posibilidad", condition: text(attrs.humanCondition, attrs.description, "Un nodo cercano puede completar parte de esta compra."), amount: routeAmount, currency: text(attrs.currency).toUpperCase() || currency || null, installmentCount: null, installmentAmount: null, relationship: relationshipNodes.has(nodeId), territory: text(attrs.territory, attrs.territoryId) || null, lat: geo.lat, lng: geo.lng, source: dv });
      continue;
    }
    const capability = capabilityKind(dv);
    if (!capability) continue;
    if (!territoryMatches(attrs.territory || attrs.territoryId, territory)) continue;
    const nodeId = text(attrs.nodeId, attrs.actorId, attrs.providerNodeId, dv?.meta?.authority);
    const geo = locationOf(dv);
    possibilities.push({ id: `capability:${dv.id}`, kind: capability, nodeId, name: text(attrs.nodeName, attrs.actorName, attrs.name, attrs.title, "Nodo cercano"), title: capability === "credit" ? "💧 Puede ayudar con esta compra" : capabilityCopy(capability), condition: text(attrs.humanCondition, attrs.description, capabilityCopy(capability)), amount: null, currency: text(attrs.currency).toUpperCase() || null, installmentCount: null, installmentAmount: null, relationship: relationshipNodes.has(nodeId), territory: text(attrs.territory, attrs.territoryId) || null, lat: geo.lat, lng: geo.lng, source: dv });
  }

  const unique = new Map<string, LiquidityPossibility>();
  for (const possibility of possibilities) if (!unique.has(possibility.id)) unique.set(possibility.id, possibility);
  const all = Array.from(unique.values());
  return {
    all,
    direct: all.filter((item) => item.kind === "direct"),
    installments: all.filter((item) => item.kind === "seller_finance" || item.kind === "credit"),
    value: all.filter((item) => item.kind === "value"),
    network: all.filter((item) => item.kind === "route" || item.kind === "credit"),
    map: all.filter((item) => !["direct", "seller_finance", "value"].includes(item.kind)),
  };
}
