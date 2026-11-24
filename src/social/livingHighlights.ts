import { projectLivingNodes, isPublicLivingDV, type LivingNodeProjection } from "../utopy/livingNodeProjection";
import { groupLivingActivity } from "../utopy/livingNodeUX";
import { canRelate, relationActionOf } from "../utopy/territorialCompatibility";
import { projectUniversalProduct } from "../mt/universalProduct";

export type HighlightAction = { label: string; path?: string; kind: "open" | "ar" | "mo" };
export type LivingHighlight = { highlightId: string; nodeId: string; nodeName: string; avatarRef: string; kind: string; sourceRefs: string[]; title: string; summary: string; mediaRef: string; mediaType: "image" | "video"; captionsRef?: string; modelRef?: string; actionRefs: HighlightAction[]; createdAt: number; expiresAt?: number; context: string[] };
export type HighlightPreferences = { seen: Record<string, number>; mutedNodes: string[]; hidden: string[]; lessKinds: string[]; autoplay: boolean };
export const emptyHighlightPreferences = (): HighlightPreferences => ({ seen: {}, mutedNodes: [], hidden: [], lessKinds: [], autoplay: false });
const text = (...values: any[]) => values.find((v) => typeof v === "string" && v.trim())?.trim() || "";
const list = (value: any): any[] => Array.isArray(value) ? value : value == null ? [] : [value];
const stamp = (value: any) => typeof value === "number" ? value : Date.parse(value || "") || 0;
const attrs = (dv: any) => dv?.attrs || dv?.payload || {};
const version = (dv: any) => Number(dv?.revision ?? dv?.meta?.revision ?? dv?.meta?.version ?? 0);
const time = (dv: any) => stamp(attrs(dv).changedAt || attrs(dv).updatedAt || dv?.meta?.updatedAt || dv?.createdAt || dv?.meta?.ts);
const created = (dv: any) => stamp(attrs(dv).createdAt || dv?.createdAt || dv?.meta?.createdAt) || time(dv);
const nodeRef = (dv: any) => text(attrs(dv).sellerNodeId, attrs(dv).nodeId, attrs(dv).actorId, attrs(dv).storeId, dv?.sourceNodeId, dv?.meta?.originNode, dv?.authority, dv?.meta?.authority).toLowerCase();
const fingerprint = (value: unknown) => { let hash = 2166136261; for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); };
export function publicHighlightEvidence(dv: any) {
  const a = attrs(dv); const m = dv?.meta || {};
  const scopes = [...list(dv?.scopes), ...list(m.scopes ?? m.scope), ...list(a.scopes), ...list(a.visibility), ...list(dv?.visibility), ...list(m.visibility)].map(String);
  if (scopes.some((scope) => /private|participant|custodian|community/i.test(scope))) return false;
  if (list(dv?.participants ?? a.participants).length && !scopes.includes("public")) return false;
  const policies = [dv, a, m, dv?.policy, m.policy, a.policy, dv?.policy?.restrictions, m.policy?.restrictions, a.policy?.restrictions, a.privacy, m.restrictions, a.restrictions];
  if (policies.some((p) => p?.noShare === true || p?.noLocationDisclosure === true) || list(a.privacyPolicies).some((p) => p === "noShare" || p === "noLocationDisclosure")) return false;
  if (a.mediaVisibility && a.mediaVisibility !== "public") return false;
  return isPublicLivingDV(dv) || (scopes.includes("public") && !/private|sensitive/i.test(text(m.sensitivity)));
}
export function safeHighlightMedia(value: any): string {
  const raw = text(typeof value === "object" ? value?.url : value);
  return /^https:\/\//i.test(raw) || /^\/(?!\/)/.test(raw) ? raw : "";
}
function semantic(dv: any) { const a = attrs(dv); return [a.title || a.name, a.description || a.summary, a.text, a.intent?.summary, a.expression?.text, a.image || a.imagen, a.videoUrl, a.collection, a.available, a.stockQty ?? a.stock, a.status, a.price, a.finalPrice, a.capabilities, a.availability, a.ranges, a.highlight]; }
function inactive(dv: any, now: number) {
  const a = attrs(dv); const expiresAt = stamp(a.expiresAt || dv.expiresAt || dv.meta?.expiresAt);
  return a.deleted === true || dv.deleted === true || a.resolvedAt || /^(occupied|busy|unavailable|cancelled|canceled|resolved|expired|deleted|out_of_stock)$/i.test(text(a.status)) || a.available === false || a.availability?.availableNow === false || (a.stockQty != null && Number(a.stockQty) <= 0) || (expiresAt && expiresAt <= now);
}

/** Recomputed from existing facts; stores neither publications nor an Activity copy. */
export function projectLivingHighlights(allLive: any[], options: { nodes?: LivingNodeProjection[]; actor?: any; preferences?: HighlightPreferences; now?: number; editorialTtlMs?: number } = {}): LivingHighlight[] {
  const now = options.now ?? Date.now(); const nodes = options.nodes || projectLivingNodes(allLive); const prefs = options.preferences || emptyHighlightPreferences();
  const aliases = new Map<string, LivingNodeProjection>();
  nodes.forEach((node) => [node.id, node.nodeId, node.actorId, node.handle, node.storeId, ...node.aliases].filter(Boolean).forEach((id) => aliases.set(id.toLowerCase(), node)));
  const revisions = new Map<string, any[]>();
  for (const dv of allLive) {
    if (!dv?.id) continue;
    const node = aliases.get(nodeRef(dv)); if (!node) continue;
    const a = attrs(dv); const product = /^(mt:producto|mt.product|product)$/.test(dv.kind);
    const key = `${node.id}|${product ? "product" : dv.kind}|${product ? text(a.productId, dv.productId, dv.id) : dv.id}`;
    const items = revisions.get(key) || []; items.push(dv); revisions.set(key, items);
  }
  const candidates: any[] = [];
  for (const history of revisions.values()) {
    history.sort((a, b) => version(b) - version(a) || time(b) - time(a));
    const dv = history[0]; const a = attrs(dv); const kind = text(dv.kind);
    if (!publicHighlightEvidence(dv) || inactive(dv, now)) continue;
    if (/heartbeat|sync|cache|frequency\.|presence\./i.test(kind)) continue;
    const previous = history.find((other) => version(other) < version(dv));
    if (previous && fingerprint(semantic(previous)) === fingerprint(semantic(dv))) continue;
    const declaredChange = a.highlight?.confirmed === true || list(a.changedFields).some((key) => /availability|range|stock|capability/.test(String(key)));
    if (/profile|manifest/.test(kind) && !declaredChange && !(previous && fingerprint([attrs(previous).availability, attrs(previous).ranges, attrs(previous).capabilities]) !== fingerprint([a.availability, a.ranges, a.capabilities]))) continue;
    if (/outcome/.test(kind) && !(a.highlight?.consent === true && a.highlight?.confirmed === true && a.highlight?.visibility === "public")) continue;
    if (!/product|producto|capability|availability|material|rental|unit|machine|offer|outcome|profile|manifest|need|demand|signal|intention/.test(kind)) continue;
    const baseTime = created(dv); if (!baseTime || baseTime > now) continue;
    const temporal = /availability|rental|unit|machine/.test(kind) || a.highlight?.kind === "availability";
    const explicitExpiry = stamp(a.expiresAt || dv.expiresAt || dv.meta?.expiresAt);
    if (!temporal && !explicitExpiry && baseTime + (options.editorialTtlMs ?? 14 * 86400_000) <= now) continue;
    // Semantic changes form Activity groups; technical revisions never enter the identity.
    candidates.push({ ...dv, attrs: { ...a, nodeId: aliases.get(nodeRef(dv))!.id }, meta: { ...dv.meta, updatedAt: new Date(baseTime).toISOString() } });
  }
  const groups = groupLivingActivity(candidates, nodes);
  const highlights: LivingHighlight[] = [];
  for (const group of groups) {
    const node = nodes.find((item) => item.id === group.nodeId); if (!node || prefs.mutedNodes.includes(node.id)) continue;
    // A collection is a semantic grouping, not a new story for each product.
    const collections = new Map<string, any[]>();
    group.items.forEach((dv) => { const a = attrs(dv); const collection = text(a.collection?.name, a.collection); const items = collections.get(collection) || []; items.push(dv); collections.set(collection, items); });
    for (const [collection, items] of collections) {
      const dv = items[0]; const a = attrs(dv); const product = /product|producto/.test(dv.kind); const outcome = /outcome/.test(dv.kind); const signal = /need|demand|signal|intention/.test(dv.kind); const p = product ? projectUniversalProduct(dv) : null;
      const kind = collection ? "collection" : signal ? "opportunity" : product ? "catalog" : /availability|profile|unit|rental|machine/.test(dv.kind) ? "availability" : outcome ? "outcome" : "capability";
      const highlightId = `highlight:${node.id}:${kind}:${fingerprint(items.map((item) => [item.id, semantic(item)]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))))}`;
      if (prefs.hidden.includes(highlightId)) continue;
      const path = product && items.length === 1 ? p!.publicPath : a.propertyId && /rental|unit/.test(dv.kind) ? `/falcon/skylines/propiedad/${encodeURIComponent(a.propertyId)}` : `/${encodeURIComponent(node.handle)}`;
      const modelRef = safeHighlightMedia(a.ar?.modelUrl || dv.meta?.ar?.modelUrl || a.modelUrl || a.glbUrl);
      const video = safeHighlightMedia(a.videoUrl); const mediaRef = outcome ? safeHighlightMedia(a.highlight?.mediaRef) : video || safeHighlightMedia(p?.image || a.image || a.imagen || a.cover);
      const actionRefs: HighlightAction[] = [{ kind: "open", label: collection ? "Ver colección" : product ? "Ver" : a.propertyId ? "Ver espacio" : "Ver perfil", path }];
      if (modelRef && publicHighlightEvidence(dv)) actionRefs.push({ kind: "ar", label: "Ver en AR" });
      if (!product && !outcome && node.capabilities.length) actionRefs.push({ kind: "mo", label: "Usar en MO" });
      const actorId = text(options.actor?.actorId, options.actor?.id); const related = actorId && allLive.some((fact) => { const f = attrs(fact); return /order|relationship|trade.message/.test(fact.kind) && [f.buyerActorId, f.actorId, ...list(f.participants)].includes(actorId) && [f.sellerNodeId, f.targetNodeId, f.nodeId].some((id) => aliases.get(String(id).toLowerCase())?.id === node.id); });
      const territorial = canRelate({ need: options.actor, capability: { ...dv, attrs: { ...attrs(node.source), ...a } }, action: relationActionOf(dv) });
      const context = [...(related ? ["Un nodo de tus relaciones"] : []), ...(territorial.recommended ? [territorial.reason] : [])];
      const expires = items.map((item) => stamp(attrs(item).expiresAt || item.expiresAt || item.meta?.expiresAt)).filter(Boolean);
      highlights.push({ highlightId, nodeId: node.id, nodeName: node.name, avatarRef: safeHighlightMedia(node.avatarRef), kind, sourceRefs: items.map((item) => item.id),
        title: signal ? text(a.title, a.text, a.intent?.summary, a.expression?.text, a.description, `${node.name} compartió una oportunidad`) : outcome ? text(a.highlight?.title, "Un trabajo terminado") : collection ? `Nuevo ${collection}` : items.length > 1 ? `${node.name} actualizó su catálogo` : kind === "availability" ? `${node.name} tiene disponibilidad` : product ? `Algo nuevo en ${node.name}` : `${node.name} actualizó lo que ofrece`,
        summary: signal ? text(a.text, a.description, a.intent?.summary) : outcome ? text(a.highlight?.summary) : collection ? `${items.length} piezas · ${collection}` : items.length > 1 ? `${items.length} productos` : text(p?.title, a.title, a.name, a.label),
        mediaRef, mediaType: video && !outcome ? "video" : "image", captionsRef: safeHighlightMedia(a.captionsUrl), modelRef, actionRefs: actionRefs.slice(0, 3), createdAt: Math.max(...items.map(created)), expiresAt: expires.length ? Math.min(...expires) : kind === "availability" ? undefined : Math.min(...items.map(created)) + (options.editorialTtlMs ?? 14 * 86400_000), context });
    }
  }
  return highlights.sort((a, b) => Number(prefs.lessKinds.includes(a.kind)) - Number(prefs.lessKinds.includes(b.kind)) || b.context.length - a.context.length || b.createdAt - a.createdAt);
}

/** Private interaction metadata only; never a DV or public outcome. */
export function readHighlightPreferences(actorId: string): HighlightPreferences {
  try { const stored = JSON.parse(localStorage.getItem(`utopy.highlights.ux:${actorId || "device"}`) || "{}"); return { seen: stored.seen && typeof stored.seen === "object" ? stored.seen : {}, mutedNodes: list(stored.mutedNodes), hidden: list(stored.hidden), lessKinds: list(stored.lessKinds), autoplay: stored.autoplay === true }; } catch { return emptyHighlightPreferences(); }
}
export function writeHighlightPreferences(actorId: string, preferences: HighlightPreferences) {
  try { localStorage.setItem(`utopy.highlights.ux:${actorId || "device"}`, JSON.stringify({ ...preferences, seen: Object.fromEntries(Object.entries(preferences.seen).sort((a, b) => b[1] - a[1]).slice(0, 1500)) })); } catch { /* Local-only UX still works when storage is unavailable. */ }
}
export function highlightSession(highlights: LivingHighlight[], preferences: HighlightPreferences, nodeId?: string) {
  const selected = nodeId ? [...highlights.filter((h) => h.nodeId === nodeId), ...highlights.filter((h) => h.nodeId !== nodeId)] : highlights;
  const unseen = selected.findIndex((h) => (!nodeId || h.nodeId === nodeId) && !preferences.seen[h.highlightId]);
  return selected.slice(Math.max(0, unseen), Math.max(0, unseen) + 15).map((h) => h.highlightId);
}
