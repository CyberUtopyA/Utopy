import type { PresenceSignal } from "./presence.types";

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function presenceTsMs(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPresenceExpired(
  signal: PresenceSignal,
  now = Date.now()
): boolean {
  if (Number.isFinite(signal.expiresAt) && Number(signal.expiresAt) > 0) {
    return now >= Number(signal.expiresAt);
  }
  const ttl = Number(signal.meta?.ttl_ms || 0);
  const ts = presenceTsMs(signal.ts);
  return ttl > 0 && ts > 0 && now >= ts + ttl;
}

export function sortSignalsByPriority(signals: PresenceSignal[]) {
  const now = Date.now();
  return [...signals]
    .filter((signal) => !isPresenceExpired(signal, now))
    .sort((a, b) => {
      const sa = Number(a?.strength || 0);
      const sb = Number(b?.strength || 0);

      const pa = Math.max(
        ...(a?.actions || []).map((x) => Number(x.priority || 0)),
        0
      );
      const pb = Math.max(
        ...(b?.actions || []).map((x) => Number(x.priority || 0)),
        0
      );

      if (sb !== sa) return sb - sa;
      if (pb !== pa) return pb - pa;
      return presenceTsMs(b.ts) - presenceTsMs(a.ts);
    });
}

export function uniqueSignals(signals: PresenceSignal[]) {
  const map = new Map<string, PresenceSignal>();
  for (const signal of signals) {
    if (!signal?.id || isPresenceExpired(signal)) continue;
    map.set(signal.id, signal);
  }
  return Array.from(map.values());
}
