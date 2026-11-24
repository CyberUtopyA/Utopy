import { publicGeoPoint, distanceKmBetween } from "./territorialCompatibility";

export function publicLivingSignals(allLive: any[]): any[] {
  return allLive.filter((dv) => ["resonance.intent", "resonance.need", "capability.offer", "service.offer", "work.intent", "work.opportunity", "material.offer", "mt:offer"].includes(dv?.kind)
    && Array.isArray(dv.meta?.scopes) && dv.meta.scopes.includes("public")
    && !dv.meta.scopes.some((scope: string) => ["private", "participants", "custodians"].includes(scope))
    && !/closed|cancel|resolved|expired/.test(String(dv.attrs?.status || ""))
    && (!dv.attrs?.expiresAt || Date.parse(dv.attrs.expiresAt) > Date.now())
    && (!dv.meta?.ttl_ms || Date.parse(dv.meta.updatedAt || dv.meta.ts) + Number(dv.meta.ttl_ms) > Date.now()))
    .slice(-80);
}

export const intentionWords = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !["necesito", "quiero", "mostrame", "busca", "buscar", "una", "uno", "para", "con", "que", "esto", "cerca"].includes(word));

export function latestOwnedIntent(allLive: any[], actorId: string): string {
  if (!actorId) return "";
  const latest = allLive.filter((dv) => /intent|need|demand/.test(String(dv.kind)) &&
    [dv.attrs?.actorId, dv.attrs?.ownerActorId, dv.meta?.authority].includes(actorId) &&
    !/closed|cancel|resolved|expired/.test(String(dv.attrs?.status)) &&
    (!dv.attrs?.expiresAt || Date.parse(dv.attrs.expiresAt) > Date.now()))
    .sort((a, b) => Date.parse(b.meta?.updatedAt || b.meta?.ts || "") - Date.parse(a.meta?.updatedAt || a.meta?.ts || ""))[0];
  return String(latest?.attrs?.intent?.text || latest?.attrs?.title || latest?.attrs?.summary || latest?.attrs?.expression?.text || "");
}
export function rankLivingItems<T extends { id: string; title: string; available?: boolean; category?: string; sellerNodeId?: string; raw: any }>(
  items: T[], input: { intention: string; allLive: any[]; actorId: string; origin?: any; exploreAll?: boolean },
): T[] {
  if (input.exploreAll) return items;
  const words = intentionWords(input.intention);
  const relatedNodes = new Set<string>();
  const recentRefs = new Set<string>();
  for (const dv of input.allLive) {
    const a = dv.attrs || {};
    if (!input.actorId || !(Array.isArray(a.participants) && a.participants.includes(input.actorId))) continue;
    if (/relationship\.accepted/.test(String(dv.kind))) relatedNodes.add(String(a.nodeId || a.toNodeId || ""));
    if (a.personalizationConsent === true && a.actorId === input.actorId) recentRefs.add(String(a.productId || a.subjectRef || ""));
  }
  return items.map((item, index) => {
    const a = item.raw?.attrs || {};
    const text = intentionWords([item.title, item.category, a.description, a.intent?.text, ...(item.raw?.traits || [])].filter(Boolean).join(" ")).join(" ");
    const matches = words.filter((word) => text.includes(word)).length;
    const geo = publicGeoPoint(item.raw);
    const distance = input.origin && geo ? distanceKmBetween(input.origin, geo) : null;
    const score = matches * 100 + Number(item.available !== false) * 8 + Number(relatedNodes.has(item.sellerNodeId || "")) * 4
      + Number(recentRefs.has(item.id)) * 5 + (distance == null ? 0 : 3 / (1 + distance));
    return { item, index, score, matches };
  }).filter((entry) => !words.length || entry.matches > 0).sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.item);
}
