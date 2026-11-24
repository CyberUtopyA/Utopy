import { useEffect, useMemo, useState } from "react";
import type {
  ResonanceCapability,
  ResonanceEntryMethod,
  ResonanceGeo,
  ResonanceIntent,
} from "./resonance.types";
import { mtLiveSubscribe } from "../../mt/mt.liveStore";

type AnyDV = any;

export type PresenceScanItem = {
  id: string;
  kind: string;
  actorId: string | null;
  actorName: string | null;
  sessionId: string | null;
  nodeId: string | null;
  ns: string | null;
  scope: string | null;
  stage: string | null;
  title: string | null;
  targetKind: string | null;
  targetId: string | null;
  threadId: string | null;
  proximity: number | null;
  distanceHint: string | null;
  entryMethod: ResonanceEntryMethod | string | null;
  geo: ResonanceGeo | null;
  intent: ResonanceIntent | null;
  capabilities: ResonanceCapability[];
  signature: string | null;
  verified: boolean;
  expiresAt: number | null;
  ts: string | null;
  tsMs: number;
  raw: AnyDV;
};

export type UsePresenceScannerOptions = {
  enabled?: boolean;
  ns?: string | null;
  includeUniversal?: boolean;
  scope?: string | null;
  targetKind?: string | null;
  targetId?: string | null;
  threadId?: string | null;
  actorId?: string | null;
  maxAgeMs?: number;
  limit?: number;
};

function safeStr(value: any): string {
  return typeof value === "string"
    ? value
    : value == null
      ? ""
      : String(value);
}

function parseTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(safeStr(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTs(dv: AnyDV): number {
  return parseTimestamp(dv?.ts ?? dv?.meta?.ts ?? dv?.attrs?.ts);
}

function toNum(value: any): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readGeo(dv: AnyDV): ResonanceGeo | null {
  const value =
    dv?.attrs?.geo ||
    dv?.attrs?.location ||
    (dv?.attrs?.lat != null
      ? { lat: dv.attrs.lat, lng: dv.attrs.lng ?? dv.attrs.lon }
      : null);
  if (!value) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng ?? value.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return {
    ...value,
    lat,
    lng,
  };
}

function expiresAt(dv: AnyDV): number | null {
  const explicit = parseTimestamp(
    dv?.attrs?.frequency?.expiresAt || dv?.attrs?.expiresAt
  );
  if (explicit > 0) return explicit;
  const ts = parseTs(dv);
  const ttl = Number(dv?.meta?.ttl_ms || 0);
  return ts > 0 && ttl > 0 ? ts + ttl : null;
}

function isExpired(dv: AnyDV, now = Date.now()): boolean {
  const expiry = expiresAt(dv);
  return expiry != null && now >= expiry;
}

function isPresenceDV(dv: AnyDV): boolean {
  const kind = safeStr(dv?.kind).trim().toLowerCase();
  const ns = safeStr(dv?.meta?.ns).trim().toLowerCase();
  const traits = Array.isArray(dv?.traits)
    ? dv.traits.map((trait: any) => safeStr(trait).toLowerCase())
    : [];

  if (
    [
      "presence.signal",
      "utopy.presence.signal",
      "presence.focus",
      "presence.nearby",
      "mt.presence",
    ].includes(kind)
  ) {
    return true;
  }

  if (dv?.attrs?.frequency?.protocol === "utopy.resonance/1") return true;
  if (traits.includes("resonance:frequency")) return true;
  if (traits.some((trait: string) => trait.startsWith("presence:"))) return true;
  if (ns.includes("presence") && dv?.attrs?.actor) return true;

  // Compatibilidad con la presencia antigua de checkout/target.
  const attrs = dv?.attrs || {};
  return Boolean(
    attrs?.actor &&
      attrs?.target &&
      (attrs?.scope === "checkout" || attrs?.entryMethod)
  );
}

function readPresence(dv: AnyDV): PresenceScanItem | null {
  const attrs = dv?.attrs || {};
  const actor = attrs?.actor || {};
  const target = attrs?.target || {};
  const frequency = attrs?.frequency || {};
  const labels = Array.isArray(dv?.labels) ? dv.labels : [];
  const actorId =
    safeStr(
      actor?.id ||
        attrs?.actorId ||
        attrs?.fromActorId ||
        attrs?.buyerId ||
        attrs?.sellerId
    ) || null;
  const tsMs = parseTs(dv);

  return {
    id:
      safeStr(dv?.id) ||
      safeStr(attrs?.id) ||
      `presence:${actorId || "anon"}:${safeStr(
        target?.id || attrs?.targetId || "target"
      )}:${tsMs}`,
    kind: safeStr(dv?.kind || "presence.signal"),
    actorId,
    actorName:
      safeStr(
        actor?.name ||
          attrs?.actorName ||
          attrs?.buyerName ||
          attrs?.sellerName
      ) || null,
    sessionId: safeStr(attrs?.sessionId || frequency?.sessionId) || null,
    nodeId: safeStr(actor?.nodeId || attrs?.nodeId || dv?.meta?.originNode) || null,
    ns: safeStr(dv?.meta?.ns || attrs?.ns) || null,
    scope: safeStr(attrs?.scope) || null,
    stage: safeStr(attrs?.stage) || null,
    title: safeStr(labels[0] || attrs?.title || target?.title) || null,
    targetKind: safeStr(target?.kind || attrs?.targetKind) || null,
    targetId: safeStr(target?.id || attrs?.targetId || attrs?.source?.dvId) || null,
    threadId: safeStr(attrs?.threadId || target?.threadId) || null,
    proximity: toNum(attrs?.proximity),
    distanceHint: safeStr(attrs?.distanceHint) || null,
    entryMethod:
      safeStr(
        attrs?.entryMethod ||
          attrs?.channel ||
          attrs?.access ||
          (frequency?.protocol ? "resonance" : "manual")
      ) || null,
    geo: readGeo(dv),
    intent: attrs?.intent || null,
    capabilities: Array.isArray(attrs?.capabilities)
      ? attrs.capabilities
      : [],
    signature: safeStr(frequency?.signature) || null,
    verified: Boolean(dv?.meta?.signature),
    expiresAt: expiresAt(dv),
    ts: tsMs > 0 ? new Date(tsMs).toISOString() : null,
    tsMs,
    raw: dv,
  };
}

export default function usePresenceScanner(
  options: UsePresenceScannerOptions = {}
) {
  const {
    enabled = true,
    ns = null,
    includeUniversal = true,
    scope = null,
    targetKind = null,
    targetId = null,
    threadId = null,
    actorId = null,
    maxAgeMs = 1000 * 60 * 2,
    limit = 24,
  } = options;
  const [items, setItems] = useState<PresenceScanItem[]>([]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }

    const unsubscribe = mtLiveSubscribe((all: any[]) => {
      const now = Date.now();
      const map = new Map<string, PresenceScanItem>();

      for (const dv of Array.isArray(all) ? all : []) {
        if (!isPresenceDV(dv) || isExpired(dv, now)) continue;
        const presence = readPresence(dv);
        if (!presence) continue;

        if (
          maxAgeMs > 0 &&
          presence.tsMs > 0 &&
          now - presence.tsMs > maxAgeMs
        ) {
          continue;
        }
        if (actorId && presence.actorId === String(actorId)) continue;
        if (
          ns &&
          presence.ns &&
          presence.ns !== String(ns) &&
          !(includeUniversal && presence.ns === "utopy:resonance")
        ) {
          continue;
        }
        if (scope && presence.scope && presence.scope !== String(scope)) continue;
        if (
          targetKind &&
          presence.targetKind &&
          presence.targetKind !== String(targetKind)
        ) {
          continue;
        }
        if (targetId && presence.targetId && presence.targetId !== String(targetId)) {
          continue;
        }
        if (threadId && presence.threadId && presence.threadId !== String(threadId)) {
          continue;
        }

        const dedupeKey = presence.sessionId
          ? `${presence.sessionId}:${presence.targetId || "target"}`
          : `${presence.actorId || "actor"}:${
              presence.targetKind || "kind"
            }:${presence.targetId || "target"}:${
              presence.threadId || "thread"
            }`;
        const previous = map.get(dedupeKey);
        if (!previous || presence.tsMs >= previous.tsMs) {
          map.set(dedupeKey, presence);
        }
      }

      setItems(
        Array.from(map.values())
          .sort((a, b) => {
            const proximityDiff =
              (b.proximity ?? -999999) - (a.proximity ?? -999999);
            return proximityDiff || b.tsMs - a.tsMs;
          })
          .slice(0, Math.max(1, limit))
      );
    });

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // El transporte ya estaba cerrado.
      }
    };
  }, [
    actorId,
    enabled,
    includeUniversal,
    limit,
    maxAgeMs,
    ns,
    scope,
    targetId,
    targetKind,
    threadId,
  ]);

  const nearby = useMemo(
    () =>
      items.filter(
        (item) =>
          (item.proximity ?? 0) > 0 ||
          Boolean(item.distanceHint) ||
          Boolean(item.geo)
      ),
    [items]
  );
  const strongest = useMemo(
    () => nearby[0] || items[0] || null,
    [nearby, items]
  );
  const byEntryMethod = useMemo(() => {
    const grouped: Record<string, PresenceScanItem[]> = {};
    for (const item of items) {
      const key = item.entryMethod || "unknown";
      (grouped[key] ||= []).push(item);
    }
    return grouped;
  }, [items]);

  return {
    presences: items,
    nearby,
    strongest,
    byEntryMethod,
    count: items.length,
    hasAny: items.length > 0,
    resonanceCount: byEntryMethod.resonance?.length || 0,
  };
}
