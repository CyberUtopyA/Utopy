import type { DVLike } from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";

const now = () => Date.now();
const id = (p: string) => `${p}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
const num = (v: any, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;
const cur = (v?: string) => String(v || "PYG").toUpperCase();

export type CommonsPoolType = "productive" | "health" | "energy" | "housing" | "education" | "general";

export function buildCommonsPoolDV(input: {
  territoryId: string;
  poolType?: CommonsPoolType;
  currency?: string;
  available?: number;
  reserved?: number;
  reason?: string;
  by?: string;
}) {
  return {
    id: id("liq.commons.pool"),
    kind: "liq.commons.pool",
    ts: now(),
    traits: ["mt:liquidity", "mt:commons", "mt:territory"],
    labels: ["Fondo común territorial"],
    meta: {
      ns: "mt:liquidity",
      scopes: ["public", `territory:${input.territoryId}`],
      schema: "utopy.liq.commons.pool.v1",
      by: input.by || "liq.commons",
      pinned: true,
    },
    attrs: {
      territoryId: input.territoryId,
      poolType: input.poolType || "general",
      currency: cur(input.currency),
      available: num(input.available),
      reserved: num(input.reserved),
      reason: input.reason || "commons.pool.update",
    },
  } satisfies DVLike;
}

export function buildCommonsContributionDV(input: {
  territoryId: string;
  actorId: string;
  amount: number;
  currency?: string;
  poolType?: CommonsPoolType;
  reason?: string;
  sourceKind?: string;
  sourceId?: string;
}) {
  return {
    id: id("liq.commons.contribution"),
    kind: "liq.commons.contribution",
    ts: now(),
    traits: ["mt:liquidity", "mt:commons", "mt:contribution"],
    labels: ["Aporte al commons"],
    meta: {
      ns: "mt:liquidity",
      scopes: ["public", `territory:${input.territoryId}`],
      schema: "utopy.liq.commons.contribution.v1",
      by: input.actorId,
    },
    attrs: {
      territoryId: input.territoryId,
      actorId: input.actorId,
      amount: num(input.amount),
      currency: cur(input.currency),
      poolType: input.poolType || "general",
      reason: input.reason || "territory.commons.contribution",
      source: {
        kind: input.sourceKind,
        id: input.sourceId,
      },
    },
  } satisfies DVLike;
}

export function emitCommonsContribution(input: Parameters<typeof buildCommonsContributionDV>[0]) {
  const dv = buildCommonsContributionDV(input);
  emitUtopyDV(dv, "mt");
  return dv;
}