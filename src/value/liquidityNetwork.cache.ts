import { projectLiquidityNetwork } from "./liquidityNetwork";

const MAX_CACHE_ENTRIES = 8;
const cache = new Map<string, ReturnType<typeof projectLiquidityNetwork>>();

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function relevantKind(kind: string): boolean {
  return /^(benefit\.|value\.|identity\.link\.|relationship\.|credit\.|liq\.|pay\.|payment\.|market\.order\.|work\.|delivery\.|refund\.)/.test(kind);
}

function mix(hash: number, value: string): number {
  let next = hash;
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

function projectionRevision(allLive: any[], verifiedIds?: Set<string>): string {
  let hash = 2166136261;
  let count = 0;
  for (const dv of Array.isArray(allLive) ? allLive : []) {
    const kind = text(dv?.kind).toLowerCase();
    if (!relevantKind(kind)) continue;
    count += 1;
    hash = mix(
      hash,
      `${text(dv?.id)}|${kind}|${text(dv?.meta?.version)}|${text(dv?.meta?.updatedAt || dv?.meta?.ts)}|${verifiedIds?.has(text(dv?.id)) ? 1 : 0}`,
    );
  }
  return `${count}:${hash.toString(36)}`;
}

export function projectLiquidityNetworkCached(
  allLive: any[],
  actorId: string,
  verifiedIds?: Set<string>,
) {
  const key = `${actorId}|${projectionRevision(allLive, verifiedIds)}`;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }

  const projected = projectLiquidityNetwork(allLive, actorId, verifiedIds);
  cache.set(key, projected);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return projected;
}
