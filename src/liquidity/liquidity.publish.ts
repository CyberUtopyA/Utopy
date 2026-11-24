import type { DVLike } from "./mt.liquidity";
import { mtLiveUpsert } from "../mt/mt.liveStore";
import { publishDatoVivo } from "../mt/seedbus";

/**
 * Punto único de publicación de la capa de liquidez.
 * Store vivo, Micelio/Seed y runtimes reciben exactamente el mismo DV.
 */
export function mtLiveUpsertSafe(dv: DVLike) {
  try {
    mtLiveUpsert(dv as any);
  } catch {
    // El evento local sigue permitiendo que otro adaptador lo procese.
  }
}

export function emitUtopyDV(dv: DVLike, ns = "mt") {
  mtLiveUpsertSafe(dv);
  void Promise.resolve(publishDatoVivo(dv as any)).catch(() => {
    // seedbus conserva su cola; el DV ya quedó visible localmente.
  });

  if (typeof window === "undefined") return dv;
  window.dispatchEvent(
    new CustomEvent("utopy.emit", {
      detail: { ns, say: "dv.upsert", type: "dv.upsert", dv, payload: dv },
    }),
  );
  window.dispatchEvent(new CustomEvent("mt:dv", { detail: { dv } }));
  return dv;
}

export function emitUtopyMany(dvs: DVLike[], ns = "mt") {
  for (const dv of dvs) emitUtopyDV(dv, ns);
  return dvs;
}

export const publishEscrowDV = (dv: DVLike) => emitUtopyDV(dv, "mt");
export const publishCreditDV = (dv: DVLike) => emitUtopyDV(dv, "mt");
