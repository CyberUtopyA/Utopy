import type { PresenceSignal } from "./presence.types";

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function sortSignalsByPriority(signals: PresenceSignal[]) {
  return [...signals].sort((a, b) => {
    const sa = Number(a?.strength || 0);
    const sb = Number(b?.strength || 0);

    const pa = Math.max(...(a?.actions || []).map((x) => Number(x.priority || 0)), 0);
    const pb = Math.max(...(b?.actions || []).map((x) => Number(x.priority || 0)), 0);

    if (sb !== sa) return sb - sa;
    return pb - pa;
  });
}

export function uniqueSignals(signals: PresenceSignal[]) {
  const map = new Map<string, PresenceSignal>();
  for (const s of signals) {
    if (!s?.id) continue;
    map.set(s.id, s);
  }
  return Array.from(map.values());
}