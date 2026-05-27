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
  } catch {
    // silencio
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

  window.dispatchEvent(
    new CustomEvent("mt:dv", {
      detail: { dv },
    })
  );
}

export function emitUtopyMany(dvs: DVLike[], ns = "mt") {
  for (const dv of dvs) emitUtopyDV(dv, ns);
}