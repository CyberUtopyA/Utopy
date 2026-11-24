import { projectUniversalProduct } from "../mt/universalProduct";
import { profileHandleForIdentity } from "../mt/productRoute";
import { publicGeoPoint } from "./territorialCompatibility";

export type LivingCapability = {
  id: string;
  label: string;
  verbs: string[];
  resources: string[];
  source: any;
};

export type LivingNodeProjection = {
  id: string;
  nodeId: string;
  actorId: string;
  storeId: string;
  handle: string;
  aliases: string[];
  name: string;
  avatarRef: string;
  bio: string;
  territory: string;
  verified: boolean;
  capabilities: LivingCapability[];
  products: any[];
  offers: any[];
  needs: any[];
  materials: any[];
  activity: any[];
  ranges: Record<string, unknown>;
  availability: Record<string, unknown> | null;
  presence: { territory: string; lat: number | null; lng: number | null } | null;
  source: any;
};

const PRIVATE_KEYS = /ownerDid|\bci\b|document|phone|telefono|bank|account|proof|debt|linkId|relationship/i;

function text(...values: unknown[]) {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

function norm(value: unknown) {
  return text(value).replace(/^@/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._:-]+/g, "");
}

function publicRouteKey(value: unknown) {
  return text(value).replace(/^@/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function list(value: unknown): any[] { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function unique(values: unknown[]) { return Array.from(new Set(values.map((value) => text(value)).filter(Boolean))); }
function scopes(dv: any) { return list(dv?.meta?.scopes ?? dv?.meta?.scope).map((value) => text(value).toLowerCase()); }

export function isPublicLivingDV(dv: any) {
  if (dv?.attrs?.setupOnly === true) return false;
  const sensitivity = text(dv?.meta?.sensitivity).toLowerCase();
  if (sensitivity === "private" || sensitivity === "sensitive") return false;
  const declared = scopes(dv);
  if (declared.some((scope) => /private|participant|relationship/.test(scope))) return false;
  if (declared.some((scope) => scope === "public" || scope.startsWith("territory:"))) return true;
  return /product|producto|offer|profile|manifest|catalog\.source|capability|organization|mt:nodo|node\.public|presence\.public|work\.outcome|material/.test(text(dv?.kind).toLowerCase());
}

function identity(dv: any) {
  const a = dv?.attrs || {};
  const nodeId = text(a.nodeId, a.sellerNodeId, a.producerNodeId, a.vendor?.id, a.sellerId, a.node?.id, dv?.sellerNodeId, dv?.meta?.originNode);
  const actorId = text(a.actorId, a.ownerActorId, a.author?.id, a.actor?.id);
  const storeId = text(a.storeId, a.store?.id, a.slug);
  const handle = text(a.handle, a.username, a.profile?.handle);
  const authority = text(dv?.meta?.authority);
  return { nodeId, actorId, storeId, handle, authority };
}

function aliasesOf(dv: any) {
  const a = dv?.attrs || {};
  const i = identity(dv);
  return unique([i.nodeId, i.actorId, i.storeId, i.handle, i.authority, a.node?.handle, a.seller?.handle, a.vendor?.handle, ...list(a.aliases), ...list(a.identity?.aliases)]).map(norm).filter(Boolean);
}

function canonicalKey(dv: any) {
  const i = identity(dv);
  return norm(i.nodeId || i.actorId || i.authority || i.storeId || i.handle);
}

function nameOf(dv: any) {
  const a = dv?.attrs || {};
  const candidate = text(a.displayName, a.actorName, a.nodeName, a.sellerName, a.vendor?.name, a.producerName, a.node?.name, a.name, a.title, dv?.sellerName, dv?.name, dv?.title);
  return /^(?:actor:|did:|utopy\.node\.|node:|mt:|urn:)/i.test(candidate) ? "" : candidate;
}

function safeGeo(dv: any) {
  const a = dv?.attrs || {};
  const geo = a.approximateLocation || a.geo || a.location || {};
  const publicPoint = publicGeoPoint(dv);
  return { territory: text(a.territoryName, a.territory?.label, a.territory, a.territoryId, geo.label, geo.zone), lat: publicPoint?.lat ?? null, lng: publicPoint?.lng ?? null };
}

function capabilityEntries(dv: any): LivingCapability[] {
  if (text(dv?.kind).toLowerCase() === "composition.publish") return [];
  const a = dv?.attrs || {};
  const raw = [...list(a.capabilities), ...(/capability/.test(text(dv?.kind).toLowerCase()) ? [a] : [])];
  return raw.map((cap: any, index) => {
    const label = text(cap?.label, cap?.name, cap?.title, a.title, a.text, dv?.labels?.[0]);
    return { id: text(cap?.id, `${dv?.id || "cap"}:${index}`), label, verbs: unique(list(cap?.verbs)), resources: unique(list(cap?.resources)), source: dv };
  });
}

function newer(a: any, b: any) {
  const time = (dv: any) => Date.parse(text(dv?.meta?.updatedAt, dv?.meta?.ts, dv?.attrs?.updatedAt)) || Number(dv?.meta?.version || 0);
  return time(b) - time(a);
}

export function projectLivingNodes(allLive: any[]): LivingNodeProjection[] {
  const publicLive = (allLive || []).filter(isPublicLivingDV);
  const groups = new Map<string, any[]>();
  for (const dv of publicLive) {
    const key = canonicalKey(dv);
    if (!key) continue;
    const bucket = groups.get(key) || [];
    bucket.push(dv); groups.set(key, bucket);
  }

  // A profile/manifest is authoritative for its declared aliases. Merge only
  // when that evidence explicitly connects two identities.
  for (const [key] of Array.from(groups.entries())) {
    if (!groups.has(key)) continue;
    let merged = groups.get(key) || [];
    for (const anchor of [...merged].filter((dv) => /profile|manifest|catalog\.source|organization|mt:nodo|node\.public/.test(text(dv?.kind).toLowerCase()))) {
      for (const alias of aliasesOf(anchor)) {
        if (alias === key || !groups.has(alias)) continue;
        const other = groups.get(alias)!;
        merged = [...merged, ...other]; groups.set(key, merged); groups.delete(alias);
      }
    }
  }

  const nodes: LivingNodeProjection[] = [];
  for (const [, relatedRaw] of groups) {
    const related = Array.from(new Map(relatedRaw.map((dv) => [text(dv?.id) || `${dv?.kind}:${Math.random()}`, dv])).values()).sort(newer);
    const source = related.find((dv) => /node\.profile|profile-live|profile/.test(text(dv?.kind).toLowerCase())) || related.find((dv) => /manifest|catalog\.source|organization|mt:nodo|node\.public/.test(text(dv?.kind).toLowerCase())) || related[0];
    const ids = related.map(identity);
    const nodeId = text(...ids.map((item) => item.nodeId));
    const actorId = text(...ids.map((item) => item.actorId));
    const storeId = text(...ids.map((item) => item.storeId));
    const name = text(nameOf(source), ...related.map(nameOf));
    if (!name) continue;
    const sourceAttrs = source?.attrs || {};
    const handle = text(...ids.map((item) => item.handle), storeId, profileHandleForIdentity(source, name));
    const aliases = unique(related.flatMap(aliasesOf));
    const products = related.filter((dv) => /product|producto|asset|pack/.test(text(dv?.kind).toLowerCase()) && !/material/.test(text(dv?.kind).toLowerCase())).map((dv) => projectUniversalProduct(dv));
    const materials = related.filter((dv) => /material|input|insumo/.test(text(dv?.kind).toLowerCase()));
    const offers = related.filter((dv) => /offer/.test(text(dv?.kind).toLowerCase()) && !/credit|payment/.test(text(dv?.kind).toLowerCase()));
    const needs = related.filter((dv) => /intent|need|demand|composition\.publish/.test(text(dv?.kind).toLowerCase()) && text(dv?.attrs?.interactionRole, dv?.attrs?.intent?.mode).toLowerCase() !== "offer");
    const capabilities = Array.from(new Map(related.flatMap(capabilityEntries).map((cap) => [norm(cap.id || cap.label), cap])).values());
    const presenceSource = related.find((dv) => /presence/.test(text(dv?.kind).toLowerCase())) || source;
    const geo = safeGeo(presenceSource);
    const identitySource = /profile|manifest|catalog\.source|organization|mt:nodo|node\.public/.test(text(source?.kind).toLowerCase());
    const avatarRef = text(sourceAttrs.avatarRef, sourceAttrs.avatar, sourceAttrs.sellerAvatar, sourceAttrs.storeLogo, sourceAttrs.logo, identitySource ? sourceAttrs.photo : "", identitySource ? sourceAttrs.image : "");
    const bioCandidate = identitySource ? text(sourceAttrs.bio, sourceAttrs.shortBio, sourceAttrs.philosophy, sourceAttrs.motto, sourceAttrs.description) : "";
    const verified = sourceAttrs.verified === true || sourceAttrs.profileVerified === true || source?.meta?.verification?.proof === "verified" || source?.meta?.ownership?.signature?.verified === true;
    nodes.push({ id: nodeId || actorId || storeId || handle, nodeId, actorId, storeId, handle, aliases, name, avatarRef, bio: PRIVATE_KEYS.test(bioCandidate) ? "" : bioCandidate, territory: geo.territory, verified, capabilities, products, offers, needs, materials, activity: related.filter((dv) => /product|producto|offer|intent|capability|work\.outcome|material|composition\.publish/.test(text(dv?.kind).toLowerCase())).slice(0, 12), ranges: sourceAttrs.ranges || {}, availability: sourceAttrs.availability || null, presence: geo.territory || geo.lat != null ? geo : null, source });
  }
  return nodes;
}

export function resolveLivingNode(ref: unknown, allLive: any[]): LivingNodeProjection | null {
  const rawRef = typeof ref === "object" && ref ? text((ref as any).nodeId, (ref as any).sellerNodeId, (ref as any).storeId, (ref as any).handle, (ref as any).id) : ref;
  const wanted = norm(rawRef);
  if (!wanted) return null;
  const nodes = projectLivingNodes(allLive);
  const exact = nodes.find((node) => [node.id, node.nodeId, node.actorId, node.storeId, node.handle, ...node.aliases].map(norm).includes(wanted));
  if (exact) return exact;
  const wantedRoute = publicRouteKey(rawRef);
  if (!wantedRoute) return null;
  return nodes.find((node) => [node.handle, node.storeId, node.name].map(publicRouteKey).includes(wantedRoute)) || null;
}
