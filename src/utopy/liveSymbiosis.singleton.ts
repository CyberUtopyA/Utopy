// src/utopy/liveSymbiosis.singleton.ts
//
// Una sola instancia de bootLiveSymbiosis para Market + Falcon.
// Evita abrir catálogos, timers, listeners y resonadores varias veces.

import { bootLiveSymbiosis } from "./bootLiveSymbiosis";

type StopFn = () => void;

let stopRuntime: StopFn | null = null;
let consumers = 0;
let stopTimer: number | null = null;

function startOnce() {
  if (stopRuntime) return;

  const stop = bootLiveSymbiosis();
  stopRuntime = typeof stop === "function" ? stop : () => {};
}

export function acquireLiveSymbiosis(): StopFn {
  if (typeof window === "undefined") return () => {};

  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }

  startOnce();
  consumers += 1;

  let released = false;

  return () => {
    if (released) return;
    released = true;

    consumers = Math.max(0, consumers - 1);

    // El retraso evita parar/arrancar dos veces con React StrictMode.
    if (consumers === 0 && stopTimer == null) {
      stopTimer = window.setTimeout(() => {
        stopTimer = null;

        if (consumers !== 0) return;

        try {
          stopRuntime?.();
        } catch (error) {
          console.warn("[UTOPY] error al detener simbiosis viva", error);
        } finally {
          stopRuntime = null;
        }
      }, 250);
    }
  };
}
