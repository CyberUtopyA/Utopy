// ============================================
// FILE: src/mt/liquidity.runtime.ts
// ============================================

import type { DVLike } from "./mt.liquidity";
import {
  isLiquidityDV,
  issueFromPaymentStatus,
  trustFromPaymentStatus,
} from "./mt.liquidity";
import { emitUtopyDV, emitUtopyMany } from "./liquiditypublish";
import { useLiquidityStore } from "./liquidity.store";
import { publishCreditDV, publishEscrowDV } from "./liquiditypublish";

let booted = false;
const seen = new Set<string>();

export function ingestLiquidityDV(dv: DVLike | null | undefined) {
  if (!dv?.id) return;

  if (isLiquidityDV(dv)) {
    useLiquidityStore.getState().upsertDV(dv);
  }

  if (seen.has(dv.id)) return;
  seen.add(dv.id);

  if (dv.kind === "payment.session.status") {
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
  if (booted || typeof window === "undefined") return;
  booted = true;

  const listener = (ev: Event) => {
    const e = ev as CustomEvent<any>;
    const dv =
      e.detail?.dv ||
      e.detail?.payload ||
      e.detail?.detail?.payload ||
      null;
    ingestEscrowAndCreditDV(dv);
  };

  window.addEventListener("mt:dv", listener as EventListener);
  window.addEventListener("utopy:dv", listener as EventListener);
  window.addEventListener("utopy.incoming", listener as EventListener);
}
export function bootLiquidityRuntime() {
  if (booted || typeof window === "undefined") return;
  booted = true;

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
}