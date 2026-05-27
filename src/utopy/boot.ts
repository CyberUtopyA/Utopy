// ============================================
// FILE: src/utopy/boot.ts
// - Boot RAW de MS usando SeedClient propio
// - Reenvía utopy.emit -> seed.sendRaw(detail)
// ============================================

import { SeedClient } from "./seed";

const NODE_ID = "ms:web";
const AUTH = "utopy-resonancia";
const FRAME_NS = "mt";

const SEED_WS_URL =
  (import.meta as any)?.env?.VITE_UTOPY_WS ??
  "wss://seed.mterra.space/utopy?ns=mt&scopes=public&client=ms%3Aweb";

let booted = false;
let bound = false;
let seed: SeedClient | null = null;

export async function bootUtopyWithWs() {
  console.log("[MS BOOT] VERSION 2000");

  if (!booted) {
    seed = new SeedClient(SEED_WS_URL, {
      ns: FRAME_NS,
      id: NODE_ID,
      auth: AUTH,
    });

    seed.connect((raw: unknown) => {
      console.log("[MS SeedClient] rx raw parsed", raw);
    });

    booted = true;
    console.log("[MS SeedClient] boot OK", SEED_WS_URL);
  }

  if (!bound && typeof window !== "undefined") {
    const onUtopyEmit = (ev: Event) => {
      const custom = ev as CustomEvent;
      const detail = custom?.detail;

      console.log("[MS SeedClient] utopy.emit RX", detail);

      if (!detail || typeof detail !== "object" || !seed) return;

      try {
        console.log("[MS SeedClient] sendRaw", detail);
        seed.sendRaw(detail);
      } catch (e) {
        console.error("[MS SeedClient] sendRaw FAIL", e, detail);
      }
    };

    window.addEventListener("utopy.emit", onUtopyEmit as EventListener);
    bound = true;
    console.log("[MS SeedClient] listener OK");
  }
}