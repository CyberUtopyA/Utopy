// src/utopy/presence/usepresencescanner.ts
import { useEffect, useMemo, useState } from "react";
import { mtLiveSubscribe } from "../mt/mt.liveStore";

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
  entryMethod: string | null; // qr | nfc | manual | unknown
  ts: string | null;
  raw: AnyDV;
};

export type UsePresenceScannerOptions = {
  enabled?: boolean;
  ns?: string | null;
  scope?: string | null;
  targetKind?: string | null;
  targetId?: string | null;
  threadId?: string | null;
  actorId?: string | null;
  maxAgeMs?: number;
  limit?: number;
};

function safeStr(x: any): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function parseTs(d: any): number {
  const raw = d?.meta?.ts || d?.attrs?.ts || d?.ts || "";
  const n = Date.parse(String(raw || ""));
  return Number.isFinite(n) ? n : 0;
}

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function isPresenceDV(d: any): boolean {
  const kind = safeStr(d?.kind).trim().toLowerCase();
  const ns = safeStr(d?.meta?.ns).trim().toLowerCase();
  const traits = Array.isArray(d?.traits) ? d.traits.map((t: any) => safeStr(t).toLowerCase()) : [];

  if (
    kind === "presence.signal" ||
    kind === "presence.focus" ||
    kind === "presence.nearby" ||
    kind === "mt.presence"
  ) {
    return true;
  }

  if (ns.includes("presence")) return true;
  if (traits.some((t: string) => t.includes("presence"))) return true;

  const a = d?.attrs || {};
  if (a?.actor || a?.target || a?.threadId || a?.scope === "checkout") return true;

  return false;
}

function readPresence(d: AnyDV): PresenceScanItem | null {
  const attrs = d?.attrs || {};
  const actor = attrs?.actor || {};
  const target = attrs?.target || {};

  const actorId =
    safeStr(actor?.id || attrs?.actorId || attrs?.fromActorId || attrs?.buyerId || attrs?.sellerId) || null;

  const item: PresenceScanItem = {
    id:
      safeStr(d?.id) ||
      safeStr(attrs?.id) ||
      `presence:${actorId || "anon"}:${safeStr(target?.id || attrs?.targetId || "target")}:${parseTs(d)}`,
    kind: safeStr(d?.kind || "presence.signal"),
    actorId,
    actorName: safeStr(actor?.name || attrs?.actorName || attrs?.buyerName || attrs?.sellerName) || null,
    sessionId: safeStr(attrs?.sessionId) || null,
    nodeId: safeStr(actor?.nodeId || attrs?.nodeId) || null,
    ns: safeStr(d?.meta?.ns || attrs?.ns) || null,
    scope: safeStr(attrs?.scope) || null,
    stage: safeStr(attrs?.stage) || null,
    title: safeStr(attrs?.title || target?.title) || null,
    targetKind: safeStr(target?.kind || attrs?.targetKind) || null,
    targetId: safeStr(target?.id || attrs?.targetId) || null,
    threadId: safeStr(attrs?.threadId || target?.threadId) || null,
    proximity: toNum(attrs?.proximity),
    distanceHint: safeStr(attrs?.distanceHint) || null,
    entryMethod: safeStr(attrs?.entryMethod || attrs?.channel || attrs?.access || "manual") || null,
    ts: safeStr(d?.meta?.ts || attrs?.ts) || null,
    raw: d,
  };

  return item;
}

export default function usePresenceScanner(options: UsePresenceScannerOptions = {}) {
  const {
    enabled = true,
    ns = null,
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

    const unsub = mtLiveSubscribe((all: any[]) => {
      const now = Date.now();
      const map = new Map<string, PresenceScanItem>();

      for (const d of Array.isArray(all) ? all : []) {
        if (!isPresenceDV(d)) continue;

        const p = readPresence(d);
        if (!p) continue;

        const tsNum = parseTs(d);
        if (maxAgeMs > 0 && tsNum > 0 && now - tsNum > maxAgeMs) continue;

        if (actorId && p.actorId && String(p.actorId) === String(actorId)) continue;
        if (ns && p.ns && String(p.ns) !== String(ns)) continue;
        if (scope && p.scope && String(p.scope) !== String(scope)) continue;
        if (targetKind && p.targetKind && String(p.targetKind) !== String(targetKind)) continue;
        if (targetId && p.targetId && String(p.targetId) !== String(targetId)) continue;
        if (threadId && p.threadId && String(p.threadId) !== String(threadId)) continue;

        const dedupeKey =
          p.sessionId ||
          `${p.actorId || "actor"}:${p.targetKind || "kind"}:${p.targetId || "target"}:${p.threadId || "thread"}`;

        const prev = map.get(dedupeKey);
        if (!prev) {
          map.set(dedupeKey, p);
          continue;
        }

        const prevTs = Date.parse(prev.ts || "") || 0;
        const nextTs = Date.parse(p.ts || "") || 0;
        if (nextTs >= prevTs) map.set(dedupeKey, p);
      }

      const next = Array.from(map.values())
        .sort((a, b) => {
          const pa = a.proximity ?? -999999;
          const pb = b.proximity ?? -999999;
          if (pb !== pa) return pb - pa;

          const ta = Date.parse(a.ts || "") || 0;
          const tb = Date.parse(b.ts || "") || 0;
          return tb - ta;
        })
        .slice(0, Math.max(1, limit));

      setItems(next);
    });

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [enabled, ns, scope, targetKind, targetId, threadId, actorId, maxAgeMs, limit]);

  const nearby = useMemo(
    () => items.filter((x) => (x.proximity ?? 0) > 0 || !!x.distanceHint),
    [items]
  );

  const strongest = useMemo(() => nearby[0] || items[0] || null, [nearby, items]);

  const byEntryMethod = useMemo(() => {
    return {
      qr: items.filter((x) => x.entryMethod === "qr"),
      nfc: items.filter((x) => x.entryMethod === "nfc"),
      manual: items.filter((x) => x.entryMethod === "manual"),
    };
  }, [items]);

  return {
    presences: items,
    nearby,
    strongest,
    byEntryMethod,
    count: items.length,
    hasAny: items.length > 0,
  };
}