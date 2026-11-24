import { useCallback, useSyncExternalStore } from "react";

export type LivingSpaceNavigation = {
  query: string; mode: string; projection: "feed" | "orbit" | "map";
  selectedRef: string; feedScroll: number; exploreAll: boolean; homeFilter: string;
  personalized?: boolean; hiddenProductIds?: string[];
  explorerModule?: string; explorerCategory?: string;
  mtModule?: string; mtCategory?: string; territoryId?: string;
};
const initial: LivingSpaceNavigation = { query: "", mode: "all", projection: "feed", selectedRef: "", feedScroll: 0, exploreAll: false, homeFilter: "Todo" };
// UI navigation only. Entities remain in mt.liveStore; private intent is not persisted or replicated.
const contexts = new Map<string, LivingSpaceNavigation>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function canonicalSpaceRef(point: any): string {
  return String(point?.raw?.id || point?.sourceDvId || point?.id || "");
}
export function useLivingSpaceNavigation(actorId = "") {
  const key = actorId || "anonymous";
  const state = useSyncExternalStore(subscribe, () => contexts.get(key) || initial, () => initial);
  const update = useCallback((patch: Partial<LivingSpaceNavigation>) => {
    const prior = contexts.get(key) || initial;
    if (Object.entries(patch).every(([field, value]) => prior[field as keyof LivingSpaceNavigation] === value)) return;
    contexts.set(key, { ...prior, ...patch });
    while (contexts.size > 8) contexts.delete(contexts.keys().next().value!);
    listeners.forEach((listener) => listener());
  }, [key]);
  return [state, update] as const;
}
export function interpretSpaceCommand(value: string): { projection?: LivingSpaceNavigation["projection"]; query?: string; create?: boolean } {
  const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (/^(?:quiero )?ver donde queda/.test(text)) return { projection: "map" };
  if (/^mostrame lo que necesito[.!?]?$/.test(text)) return { query: "" };
  if (/^(?:llevame|ir|mostrame|ver|abrir).*(?:orbita|mapa circular)/.test(text)) return { projection: "orbit" };
  if (/^(?:llevame|ir|mostrame|ver|abrir).*(?:donde queda|geografico|el mapa)/.test(text)) return { projection: "map" };
  if (/^(?:llevame|ir|mostrame|ver|abrir).*(?:feed|inicio)/.test(text)) return { projection: "feed" };
  if (/^(?:quiero|necesito) (?:vender|publicar)/.test(text)) return { create: true };
  return { query: value.trim().slice(0, 500) };
}
