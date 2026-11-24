// src/utopy/boot.ts
//
// Puente Seed estable para MS Market.
// Regla principal:
//   utopy.emit          = salida local hacia Seed
//   utopy.seed.incoming = entrada remota desde Seed
//
// Nunca vuelve a emitir una entrada remota como "utopy.emit", evitando
// el ciclo RX → sendRaw → RX → sendRaw que bloqueaba navegador y hosting.

import { SeedClient } from "./seed";
import { mtLiveRevisionHash, mtLiveUpsertIfChanged } from "../mt/mt.liveStore";
import { isLivingEnvelope } from "./livingEnvelope.adapter";
import { ingestFrame } from "../mt/mt.ingest";

const NODE_ID = "ms:web";
const AUTH = "utopy-resonancia";
const NS = "mt";

const SEED_WS_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SEED_WS) ||
  `wss://seed.mterra.space/utopy?ns=${encodeURIComponent(
    NS,
  )}&scopes=public&client=${encodeURIComponent(NODE_ID)}`;

type BootState = {
  started: boolean;
  seed: SeedClient | null;
  outboundListener: ((event: Event) => void) | null;
  recentOutbound: Map<string, number>;
  recentInbound: Map<string, string>;
  sentInWindow: number;
  windowStartedAt: number;
};

declare global {
  interface Window {
    __UTOPY_MS_SEED_BOOT__?: BootState;
  }
}

function state(): BootState {
  if (!window.__UTOPY_MS_SEED_BOOT__) {
    window.__UTOPY_MS_SEED_BOOT__ = {
      started: false,
      seed: null,
      outboundListener: null,
      recentOutbound: new Map(),
      recentInbound: new Map(),
      sentInWindow: 0,
      windowStartedAt: Date.now(),
    };
  }
  return window.__UTOPY_MS_SEED_BOOT__;
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function parseMaybeJson(value: unknown): any {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function unwrapIncoming(raw: any): any | null {
  const msg = parseMaybeJson(raw);
  if (!msg || typeof msg !== "object") return null;

  // El Seed devuelve ack + echo para confirmar nuestras propias salidas.
  // No deben reingresarse ni reenviarse.
  if (msg.ack === true) return null;
  if (msg.hello) return null;

  if (msg.kind === "dv.upsert") {
    return msg.dv || msg.payload?.dv || null;
  }

  if (msg.kind === "dato.create") {
    return msg.payload || null;
  }

  if (msg.kind === "intent") {
    const payload = msg.payload || {};
    const say = text(payload.say || payload.verb).replace(/\s+/g, "");
    if (
      say === "dv.upsert" ||
      say === "dato.create" ||
      say === "dato.upsert"
    ) {
      return (
        payload?.with?.dv ||
        payload?.dv ||
        payload?.payload?.dv ||
        null
      );
    }
  }

  if (
    text(msg.say).replace(/\s+/g, "") === "dv.upsert" &&
    msg.dv
  ) {
    return msg.dv;
  }

  // Algunos peers envían el DV directamente.
  if (msg.id && msg.kind && msg.kind !== "hello") {
    return msg;
  }

  return null;
}

function outboundSignature(detail: any): string {
  const dv = detail?.dv || detail?.payload?.dv || detail?.with?.dv || null;

  if (dv?.id && dv?.kind) return mtLiveRevisionHash(dv);

  const id = text(dv?.id || detail?.id);
  const kind = text(dv?.kind || detail?.kind || detail?.say);
  const version = text(
    dv?.meta?.updatedAt ||
      dv?.meta?.ts ||
      dv?.attrs?.updatedAt ||
      dv?.attrs?.ts ||
      detail?.meta?.ts,
  );

  if (id || kind) return `${kind}|${id}|${version}`;

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function allowOutbound(detail: any): boolean {
  const s = state();

  if (!detail || typeof detail !== "object") return false;
  if (detail.__fromSeed === true || detail.meta?.__fromSeed === true) {
    return false;
  }

  const now = Date.now();

  const signature = outboundSignature(detail);
  const previous = s.recentOutbound.get(signature) || 0;

  // El mismo DV/revisión no se envía repetidamente.
  if (previous && now - previous < 5000) return false;

  // El límite protege hechos distintos; los duplicados ya fueron descartados.
  if (now - s.windowStartedAt >= 1000) {
    s.windowStartedAt = now;
    s.sentInWindow = 0;
  }
  s.sentInWindow += 1;
  if (s.sentInWindow > 80) {
    if (s.sentInWindow === 81) console.error("[MS SeedClient] salida detenida: más de 80 eventos por segundo.");
    return false;
  }

  s.recentOutbound.set(signature, now);

  if (s.recentOutbound.size > 2000) {
    for (const [key, ts] of s.recentOutbound) {
      if (now - ts > 60_000) s.recentOutbound.delete(key);
    }
  }

  return true;
}

function normalizeOutgoing(detail: any): any | null {
  if (!detail || typeof detail !== "object") return null;

  // Conserva frames ya construidos.
  if (detail.kind) return detail;

  const dv = detail.dv || detail.payload?.dv || detail.with?.dv;
  const say = text(detail.say || "dv.upsert");

  if (!dv || say !== "dv.upsert") return detail;

  // Forma compatible con el Seed actual.
  return {
    ns: detail.ns || NS,
    say: "dv.upsert",
    dv,
  };
}

export async function bootUtopyWithWs(): Promise<void> {
  if (typeof window === "undefined") return;

  const s = state();

  // Idempotencia real para React StrictMode, HMR y llamadas desde varios shells.
  if (s.started) return;
  s.started = true;

  const seed = new SeedClient(SEED_WS_URL, {
    ns: NS,
    id: NODE_ID,
    auth: AUTH,
  });

  s.seed = seed;

  seed.connect((raw: unknown) => {
    const dv = unwrapIncoming(raw);
    if (!dv?.id || !dv?.kind) return;
    if (isLivingEnvelope(dv)) {
      ingestFrame(dv, { source: "seed.ws" });
      return;
    }
    if (["authority.trust", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(dv.kind)) return;
    const emitter = text(dv?.meta?.emitter);
    if (emitter === NODE_ID || emitter === "mt:web:seedbus") return;
    const inboundHash = mtLiveRevisionHash(dv);
    if (s.recentInbound.get(String(dv.id)) === inboundHash) return;
    s.recentInbound.set(String(dv.id), inboundHash);
    while (s.recentInbound.size > 5000) s.recentInbound.delete(s.recentInbound.keys().next().value);

    try {
      if (!mtLiveUpsertIfChanged(dv)) return;
    } catch (error) {
      console.warn("[MS SeedClient] no se pudo ingresar DV remoto", error);
    }

    // Canal exclusivo de entrada. Nunca usar "utopy.emit" aquí.
    window.dispatchEvent(
      new CustomEvent("utopy.seed.incoming", {
        detail: {
          dv,
          raw,
          __fromSeed: true,
        },
      }),
    );
  });

  const onOutbound = (event: Event) => {
    const custom = event as CustomEvent<any>;
    const detail = custom.detail;

    if (!allowOutbound(detail)) return;

    const frame = normalizeOutgoing(detail);
    if (!frame) return;

    seed.sendRaw(frame);
  };

  s.outboundListener = onOutbound;
  window.addEventListener("utopy.emit", onOutbound);

  console.info("[MS SeedClient] boot estable activo");
}

export function stopUtopyWithWs(): void {
  if (typeof window === "undefined") return;

  const s = state();

  if (s.outboundListener) {
    window.removeEventListener("utopy.emit", s.outboundListener);
  }

  s.outboundListener = null;
  s.seed = null;
  s.started = false;
  s.recentOutbound.clear();
  s.recentInbound.clear();
  s.sentInWindow = 0;
  s.windowStartedAt = Date.now();
}
