import { canRelate } from "./territorialCompatibility";
import type { LivingCapability, LivingNodeProjection } from "./livingNodeProjection";

function text(...values: unknown[]) { for (const value of values) if (value != null && String(value).trim()) return String(value).trim(); return ""; }
function words(value: unknown) { return new Set(text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2)); }
function overlap(left: Set<string>, right: Set<string>) { let score = 0; left.forEach((word) => { if (right.has(word)) score += 1; }); return score; }

const HUMAN_VERBS: Record<string, string> = { fabricate: "Fabrica", fabrication: "Fabrica", create: "Crea", design: "Diseña", repair: "Repara", restore: "Restaura", deliver: "Puede entregarte", delivery: "Puede entregarte", transport: "Transporta", install: "Instala", assemble: "Arma", finance: "Ofrece financiación", sell: "Ofrece", teach: "Enseña", share: "Comparte" };
export function humanCapability(capability: LivingCapability) {
  const explicit = text(capability.label);
  if (/(actor:|did:|utopy[.:]|urn:|node:|sourceRef|threadId)/i.test(explicit)) return "";
  if (/^(vos|voz|t[uú]|yo|persona|perfil vivo|mi identidad|nodo vivo|resultado vivo)$/i.test(explicit)) return "";
  const explicitTechnical = /^[a-z]+([._:-][a-z]+)+$/i.test(explicit);
  if (explicit && !explicitTechnical && !/^puede\s+colaborar$/i.test(explicit)) return explicit;
  const verb = capability.verbs.map((item) => { const key = String(item).toLowerCase(); return HUMAN_VERBS[key] || HUMAN_VERBS[key.split(/[.:-]/)[0]]; }).find(Boolean) || "";
  const resource = capability.resources.map(text).find((item) => item && !/^(other|capability|offer)$/i.test(item) && !/(actor:|did:|utopy[.:]|urn:|node:)/i.test(item)) || "";
  return [verb, resource].filter(Boolean).join(" ").trim();
}

export function activeNeedsForActor(allLive: any[], actorId: string) {
  return (allLive || []).filter((dv) => {
    const mode = text(dv?.attrs?.interactionRole, dv?.attrs?.intent?.mode).toLowerCase();
    const owner = text(dv?.attrs?.actorId, dv?.attrs?.buyerActorId, dv?.meta?.authority);
    const status = text(dv?.attrs?.status, "open").toLowerCase();
    return owner === actorId && (mode === "need" || /intent|need|demand/.test(text(dv?.kind).toLowerCase())) && !/closed|resolved|cancel/.test(status);
  });
}

export function contextualCapabilities(node: LivingNodeProjection, needs: any[]) {
  const needTokens = words(needs.map((need) => text(need?.attrs?.title, need?.attrs?.text, need?.attrs?.description, need?.labels?.[0])).join(" "));
  return node.capabilities.map((capability) => {
    const label = humanCapability(capability);
    const semantic = overlap(needTokens, words([label, ...capability.resources, ...capability.verbs].join(" ")));
    const territorial = needs.length ? Math.max(...needs.map((need) => canRelate({ need, capability: capability.source }).recommended ? 1 : 0)) : 1;
    const available = node.availability?.availableNow !== false;
    return { capability, label, contextual: needs.length > 0 && semantic > 0 && territorial > 0 && available, score: semantic * 10 + territorial + (available ? 1 : 0) };
  }).filter((item) => item.label).sort((a, b) => b.score - a.score)
    .filter((item, index, items) => items.findIndex(other => text(other.label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === text(item.label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) === index);
}

export type HumanActivityGroup = { id: string; nodeId: string; title: string; detail: string; icon: string; count: number; representative: any; items: any[]; updatedAt: number };
export function groupLivingActivity(items: any[], nodes: LivingNodeProjection[], windowMs = 5 * 60_000): HumanActivityGroup[] {
  const alias = new Map<string, LivingNodeProjection>();
  nodes.forEach((node) => [node.id, node.nodeId, node.actorId, node.storeId, node.handle, ...node.aliases].filter(Boolean).forEach((id) => alias.set(String(id).toLowerCase(), node)));
  const groups = new Map<string, HumanActivityGroup>();
  const canonicalItems = new Map<string, any>();
  for (const [index, entry] of (items || []).entries()) {
    const dv = entry?.dv || entry;
    const key = text(dv?.id) || `unidentified:${index}`;
    const prior = canonicalItems.get(key); const previous = prior?.dv || prior;
    const revision = (value: any) => Number(value?.meta?.version || value?.meta?.revision || 0);
    if (!prior || revision(dv) >= revision(previous)) canonicalItems.set(key, entry);
  }
  for (const entry of canonicalItems.values()) {
    const dv = entry?.dv || entry; const attrs = dv?.attrs || {}; const kind = text(dv?.kind).toLowerCase();
    const identity = text(attrs.nodeId, attrs.sellerNodeId, attrs.storeId, attrs.actorId, dv?.meta?.originNode, dv?.meta?.authority).toLowerCase();
    const node = alias.get(identity); const nodeId = node?.id || identity || "network";
    const eventKind = /product|producto/.test(kind) ? "catalog" : /composition\.publish/.test(kind) ? "composition" : /capability/.test(kind) ? "capability" : /presence|profile/.test(kind) ? "profile" : /order|payment|delivery|work\.outcome/.test(kind) ? "operation" : kind;
    const ts = Date.parse(text(dv?.meta?.updatedAt, dv?.meta?.ts, attrs.updatedAt)) || Number(dv?.meta?.version || 0);
    const causal = text(attrs.rootId, attrs.threadId, dv?.meta?.threadId, dv?.meta?.respondsTo);
    const bucket = Math.floor(ts / windowMs); const key = `${nodeId}|${eventKind}|${causal}|${bucket}`;
    const current = groups.get(key); const name = node?.name || text(attrs.sellerName, attrs.actorName, attrs.nodeName, "La red");
    const visibleTitle = [attrs.title, attrs.text, dv?.labels?.[0]].map(value => text(value)).find(value => value && !/^(voz|vos|resultado vivo)$/i.test(value) && !/^(actor:|did:|utopy\.|urn:|node:)/i.test(value));
    if (!visibleTitle && !["catalog", "composition", "capability", "profile", "operation"].includes(eventKind)) continue;
    const copy = eventKind === "catalog" ? { icon: "📦", title: `${name} actualizó su catálogo`, detail: "productos" } : eventKind === "composition" ? { icon: "✦", title: text(attrs.intent?.summary, `${name} compartió una composición`), detail: "ruta reutilizable" } : eventKind === "capability" ? { icon: "🛠", title: `${name} actualizó lo que puede hacer`, detail: "capacidades" } : eventKind === "profile" ? { icon: "⌁", title: `${name} actualizó su presencia`, detail: "cambio" } : eventKind === "operation" ? { icon: "✓", title: `${name} tiene una novedad operativa`, detail: "actualización" } : { icon: "✨", title: visibleTitle || `${name} compartió algo`, detail: "señal" };
    if (current) { current.count += 1; current.items.push(dv); current.updatedAt = Math.max(current.updatedAt, ts); current.detail = `${current.count} ${copy.detail}${current.count === 1 ? "" : copy.detail === "cambio" ? "s" : " nuevos"}`; }
    else groups.set(key, { id: key, nodeId, title: copy.title, detail: `1 ${copy.detail}`, icon: copy.icon, count: 1, representative: dv, items: [dv], updatedAt: ts });
  }
  return Array.from(groups.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
