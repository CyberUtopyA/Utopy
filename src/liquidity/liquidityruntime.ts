// ============================================
// FILE: src/mt/liquidity.runtime.ts
// ============================================

import type { DVLike } from "./mt.liquidity";
import {
  isLiquidityDV,
  issueFromPaymentStatus,
  trustFromPaymentStatus,
} from "./mt.liquidity";
import { emitUtopyDV, emitUtopyMany } from "./liquidity.publish";
import { useLiquidityStore } from "./liquidity.store";
import { publishCreditDV, publishEscrowDV } from "./liquidity.publish";
import { mtLiveSubscribe } from "../mt/mt.liveStore";
import { ingestEconomicDV } from "./liq.ai.runtime";

let stopStore: (() => void) | null = null;
const seen = new Set<string>();

export function ingestLiquidityDV(dv: DVLike | null | undefined) {
  if (!dv?.id) return;

  if (isLiquidityDV(dv)) {
    useLiquidityStore.getState().upsertDV(dv);
  }

  if (seen.has(dv.id)) return;
  seen.add(dv.id);

  if (
    dv.kind === "payment.session.status" &&
    dv.attrs?.liquidityAlreadyRecorded !== true
  ) {
    const issue = issueFromPaymentStatus(dv);
    if (issue) {
      useLiquidityStore.getState().upsertDV(issue);
      emitUtopyDV(issue, "mt");
    }

    const trust = trustFromPaymentStatus(dv);
    if (trust.length) {
      useLiquidityStore.getState().upsertMany(trust);
      emitUtopyMany(trust, "mt");
    }
  }

  // Un solo punto de entrada para liquidez, confianza y puente fiscal.
  // El runtime IA conserva su propio dedupe y respeta
  // attrs.liquidityAlreadyRecorded para no repetir movimientos.
  ingestEconomicDV(dv);
}

// Extensión para las nuevas operaciones

export function ingestEscrowAndCreditDV(dv: DVLike | null | undefined) {
  if (!dv?.id) return;

  if (dv.kind === "liq.escrow.open" || dv.kind === "liq.escrow.release" || dv.kind === "liq.escrow.refund") {
    publishEscrowDV(dv);
  } else if (dv.kind === "liq.credit.consume" || dv.kind === "liq.credit.repay") {
    publishCreditDV(dv);
  } else {
    ingestLiquidityDV(dv);
  }
}

export function bootLiquidityEscrowRuntime() {
  return bootLiquidityRuntime();
}
export function bootLiquidityRuntime() {
  if (stopStore) return stopStore;
  if (typeof window === "undefined") return () => {};

  const listener = (ev: Event) => {
    const e = ev as CustomEvent<any>;
    const dv =
      e.detail?.dv ||
      e.detail?.payload ||
      e.detail?.detail?.payload ||
      null;
    ingestLiquidityDV(dv);
  };

  window.addEventListener("mt:dv", listener as EventListener);
  window.addEventListener("utopy:dv", listener as EventListener);
  window.addEventListener("utopy.incoming", listener as EventListener);
  stopStore = mtLiveSubscribe((all: any[]) => {
    for (const dv of Array.isArray(all) ? all : []) ingestLiquidityDV(dv);
  });

  return () => {
    window.removeEventListener("mt:dv", listener as EventListener);
    window.removeEventListener("utopy:dv", listener as EventListener);
    window.removeEventListener("utopy.incoming", listener as EventListener);
    stopStore?.();
    stopStore = null;
  };
}
