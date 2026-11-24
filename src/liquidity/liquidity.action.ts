// ============================================
// FILE: src/mt/liquidity.actions.ts
// ============================================

import {
  buildLiquidityCreditLineDV,
  buildLiquidityLockDV,
  buildLiquidityRedeemDV,
  buildLiquidityTransferDV,
  buildLiquidityTrustDV,
  buildLiquidityUnlockDV,
} from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";
import { useLiquidityStore } from "./liquidity.store";

export function liqTransfer(input: Parameters<typeof buildLiquidityTransferDV>[0]) {
  const dv = buildLiquidityTransferDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function liqLock(input: Parameters<typeof buildLiquidityLockDV>[0]) {
  const dv = buildLiquidityLockDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function liqUnlock(input: Parameters<typeof buildLiquidityUnlockDV>[0]) {
  const dv = buildLiquidityUnlockDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function liqRedeem(input: Parameters<typeof buildLiquidityRedeemDV>[0]) {
  const dv = buildLiquidityRedeemDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function liqCreditLine(input: Parameters<typeof buildLiquidityCreditLineDV>[0]) {
  const dv = buildLiquidityCreditLineDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function liqTrust(input: Parameters<typeof buildLiquidityTrustDV>[0]) {
  const dv = buildLiquidityTrustDV(input);
  useLiquidityStore.getState().upsertDV(dv);
  emitUtopyDV(dv, "mt");
  return dv;
}
