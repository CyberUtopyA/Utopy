// src/falcon/falcon.selection.ts
// Curaduría universal de superficies Falcon.
// El producto sigue perteneciendo al nodo/Market; Falcon publica solamente
// una decisión referenciada mediante targetId.

export type FalconSelectionState =
  | "selected"
  | "pinned"
  | "excluded"
  | "candidate";

export type FalconSelectionDecision = {
  targetId: string;
  surface: string;
  state: FalconSelectionState;
  priority: number;
  reason?: string;
  curator?: string;
  updatedAt: number;
  raw: any;
};

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s_:/-]+/g, ".");
}

function identityKey(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/^did:utopy:/, "")
    .replace(/^utopy[.:/_-]*node[.:/_-]*/i, "")
    .replace(/^store[.:/_-]*/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function timestampOf(dv: any): number {
  const raw =
    dv?.meta?.updatedAt ??
    dv?.attrs?.updatedAt ??
    dv?.meta?.ts ??
    dv?.attrs?.ts ??
    dv?.ts ??
    0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpired(dv: any, now = Date.now()): boolean {
  const expiresAt = Date.parse(
    String(dv?.attrs?.expiresAt ?? dv?.meta?.expiresAt ?? ""),
  );
  if (Number.isFinite(expiresAt) && expiresAt <= now) return true;

  const ttl = Number(dv?.meta?.ttl_ms || 0);
  const ts = timestampOf(dv);
  return ttl > 0 && ts > 0 && now > ts + ttl;
}

function selectionStateOf(dv: any): FalconSelectionState | null {
  const raw = normalized(
    dv?.attrs?.state ?? dv?.attrs?.status ?? dv?.attrs?.decision,
  );
  if (["selected", "select", "approved", "include"].includes(raw)) {
    return "selected";
  }
  if (["pinned", "pin", "featured", "destacado"].includes(raw)) {
    return "pinned";
  }
  if (["excluded", "exclude", "rejected", "hidden", "remove"].includes(raw)) {
    return "excluded";
  }
  if (["candidate", "suggested", "review"].includes(raw)) {
    return "candidate";
  }
  return null;
}

export function isFalconSelectionDV(dv: any): boolean {
  const traits = Array.isArray(dv?.traits)
    ? dv.traits.map(normalized)
    : [];
  return Boolean(
    dv?.kind === "falcon.selection" ||
      dv?.kind === "falcon:selection" ||
      traits.includes("falcon.selection") ||
      traits.includes("falcon.curation"),
  );
}

export function buildFalconSelectionIndex(
  allLive: any[],
  surface: string,
  now = Date.now(),
): Map<string, FalconSelectionDecision> {
  const targetSurface = normalized(surface);
  const index = new Map<string, FalconSelectionDecision>();

  for (const dv of Array.isArray(allLive) ? allLive : []) {
    if (!isFalconSelectionDV(dv) || isExpired(dv, now)) continue;

    const dvSurface = normalized(
      dv?.attrs?.surface ?? dv?.attrs?.section ?? dv?.meta?.surface,
    );
    if (!dvSurface || dvSurface !== targetSurface) continue;

    const targetId = text(
      dv?.attrs?.targetId ??
        dv?.attrs?.productId ??
        dv?.attrs?.dvId ??
        dv?.attrs?.target?.id,
    );
    const state = selectionStateOf(dv);
    if (!targetId || !state) continue;

    const decision: FalconSelectionDecision = {
      targetId,
      surface: targetSurface,
      state,
      priority: Number.isFinite(Number(dv?.attrs?.priority))
        ? Number(dv.attrs.priority)
        : state === "pinned"
          ? 100
          : state === "selected"
            ? 50
            : 0,
      reason: text(dv?.attrs?.reason) || undefined,
      curator:
        text(dv?.meta?.authority ?? dv?.attrs?.curatorId ?? dv?.meta?.by) ||
        undefined,
      updatedAt: timestampOf(dv),
      raw: dv,
    };

    const previous = index.get(targetId);
    if (!previous || decision.updatedAt >= previous.updatedAt) {
      index.set(targetId, decision);
    }
  }

  return index;
}

export function selectionForItem(
  index: Map<string, FalconSelectionDecision>,
  item: any,
): FalconSelectionDecision | null {
  const ids = [
    text(item?.id),
    text(item?.raw?.id),
    text(item?.raw?.attrs?.productId),
    text(item?.raw?.attrs?.productoId),
    text(item?.raw?.attrs?.nodeId),
    text(item?.raw?.attrs?.storeId),
    text(item?.raw?.attrs?.originNode),
    text(item?.raw?.attrs?.author?.nodeId),
    text(item?.raw?.attrs?.source?.node),
    text(item?.raw?.meta?.originNode),
    text(item?.raw?.meta?.authority),
    text(item?.attrs?.productId),
    text(item?.attrs?.productoId),
    text(item?.attrs?.nodeId),
    text(item?.attrs?.storeId),
    text(item?.attrs?.originNode),
    text(item?.attrs?.author?.nodeId),
    text(item?.attrs?.source?.node),
    text(item?.meta?.originNode),
    text(item?.meta?.authority),
  ].filter(Boolean);

  for (const id of ids) {
    const decision = index.get(id);
    if (decision) return decision;
  }
  const identityKeys = new Set(ids.map(identityKey).filter(Boolean));
  for (const [targetId, decision] of index) {
    if (identityKeys.has(identityKey(targetId))) return decision;
  }
  return null;
}

/**
 * Un producto descubierto desde el manifiesto/catálogo de un nodo ya pasó por
 * la validación de identidad de liveCatalog.sources. Falcon puede mostrarlo de
 * forma automática sin convertir la curaduría en una lista hardcodeada.
 */
export function isVerifiedLiveCatalogItem(item: any): boolean {
  const raw = item?.raw || item || {};
  const meta = raw?.meta || {};
  const sourceId = text(meta.sourceId);
  const catalogUrl = text(meta.sourceCatalogUrl);
  const source = normalized(meta.source);
  const discoveredFrom = normalized(meta.discoveredFrom);

  if (!sourceId || !catalogUrl) return false;
  if (!/^https:\/\//i.test(catalogUrl) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(catalogUrl)) {
    return false;
  }

  return (
    source.startsWith("node.") ||
    ["manifest", "bootstrap", "legacy"].includes(discoveredFrom)
  );
}
