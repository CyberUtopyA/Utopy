// ============================================
// FILE: src/mt/liquidity.publish.ts
// ============================================

import type { DVLike } from "./mt.liquidity";

declare global {
  interface Window {
    mtLiveUpsert?: (dv: any) => void;
  }
}

export function mtLiveUpsertSafe(dv: DVLike) {
  try {
    const fn =
      (globalThis as any)?.mtLiveUpsert ||
      (typeof window !== "undefined" ? (window as any).mtLiveUpsert : undefined);

    if (typeof fn === "function") fn(dv);
  } catch {}
}

export function publishEscrowDV(dv: DVLike) {
  if (dv.kind === "liq.escrow.open" || dv.kind === "liq.escrow.release" || dv.kind === "liq.escrow.refund") {
    emitUtopyDV(dv, "mt");
  } else {
    emitUtopyDV(dv, "mt");
  }
}

export function publishCreditDV(dv: DVLike) {
  if (dv.kind === "liq.credit.consume" || dv.kind === "liq.credit.repay") {
    emitUtopyDV(dv, "mt");
  } else {
    emitUtopyDV(dv, "mt");
  }
}
export function emitUtopyDV(dv: DVLike, ns = "mt") {
  mtLiveUpsertSafe(dv);

  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("utopy.emit", {
      detail: {
        ns,
        type: "dv.upsert",
        payload: dv,
      },
    })
  );
}

export function emitUtopyMany(dvs: DVLike[], ns = "mt") {
  for (const dv of dvs) emitUtopyDV(dv, ns);
}