// ============================================
// FILE: src/mt/useLiquidity.ts
// ============================================

import { useMemo } from "react";
import { useLiquidityStore } from "./liquidity.store";
import { asCurrency } from "./mt.liquidity";

export function useLiquidity(actorId?: string, currency = "PYG") {
  const dvs = useLiquidityStore((s) => s.dvs);
  const getAccountSummary = useLiquidityStore((s) => s.getAccountSummary);
  const getTrust = useLiquidityStore((s) => s.getTrust);
  const getActorCurrencies = useLiquidityStore((s) => s.getActorCurrencies);

  return useMemo(() => {
    if (!actorId) {
      return {
        account: null,
        trust: null,
        currencies: [asCurrency(currency)],
        available: 0,
        spendable: 0,
        reserved: 0,
        trustScore: 0.5,
      };
    }

    const account = getAccountSummary(actorId, currency);
    const trust = getTrust(actorId);
    const currencies = getActorCurrencies(actorId);

    return {
      account,
      trust,
      currencies: currencies.length ? currencies : [asCurrency(currency)],
      available: account.available,
      spendable: account.spendable,
      reserved: account.reserved,
      trustScore: trust.score,
    };
  }, [actorId, currency, dvs, getAccountSummary, getTrust, getActorCurrencies]);
}

export function useLiquidityCounterparties(actorId?: string) {
  const dvs = useLiquidityStore((s) => s.dvs);
  const getCounterparties = useLiquidityStore((s) => s.getCounterparties);
  const getTrustByCounterparty = useLiquidityStore((s) => s.getTrustByCounterparty);

  return useMemo(() => {
    if (!actorId) return [];
    return getCounterparties(actorId).map((counterpartyId) => ({
      counterpartyId,
      trust: getTrustByCounterparty(actorId, counterpartyId),
    }));
  }, [actorId, dvs, getCounterparties, getTrustByCounterparty]);
}

export function useLiquidityThread(threadId?: string, currency = "PYG") {
  const dvs = useLiquidityStore((s) => s.dvs);
  const getThreadSummary = useLiquidityStore((s) => s.getThreadSummary);
  const getLatestByThread = useLiquidityStore((s) => s.getLatestByThread);

  return useMemo(() => {
    if (!threadId) {
      return {
        summary: null,
        latest: [],
      };
    }

    return {
      summary: getThreadSummary(threadId, currency),
      latest: getLatestByThread(threadId, 12),
    };
  }, [threadId, currency, dvs, getThreadSummary, getLatestByThread]);
}