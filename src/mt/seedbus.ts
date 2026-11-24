// src/mt/seedbus.ts
// Bus directo al seed para publicar DatoVivo desde el MS web.
// Production-grade: handshake + retry/backoff + heartbeat + queue.
// ✅ Micelio-friendly: publica como envelope `dv.upsert`
// ✅ Incluye auth/id arriba (compat con seed actual)
// ✅ Asegura dv.meta.ts/emitter/source/scopes para index/consenso/trust

import type { DatoVivo } from "./mt.traitAdapter";
import { mtLiveRevisionHash } from "./mt.liveStore";

const RAW_WS =
  (import.meta as any).env?.VITE_UTOPY_WS ?? "wss://seed.mterra.space/utopy";

const AUTH = (import.meta as any).env?.VITE_UTOPY_AUTH ?? "utopy-resonancia";
const NODE_ID = (import.meta as any).env?.VITE_UTOPY_NODE_ID ?? "mt:web:seedbus";

/** Scopes que declara ESTE bus */
const BUS_SCOPES: string[] =
  ((import.meta as any).env?.VITE_UTOPY_BUS_SCOPES &&
    String((import.meta as any).env?.VITE_UTOPY_BUS_SCOPES)
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)) || ["mt:web", "mt:ms"];

/** Source default si un DV no trae meta.source */
const DEFAULT_SOURCE =
  (import.meta as any).env?.VITE_UTOPY_SOURCE ?? "ms:web";

function withNs(url: string, ns: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ns")) u.searchParams.set("ns", ns);
    return u.toString();
  } catch {
    if (url.includes("?")) {
      const hasNs = /[?&]ns=/.test(url);
      return hasNs ? url : url + "&ns=" + ns;
    }
    return url + "?ns=" + ns;
  }
}

// mismo ns que usa useMtClient / MercadoLocal
const WS_URL = withNs(RAW_WS, "mt");

// --------------------------
// Tipos envelope (Micelio)
// --------------------------
type DvUpsertEnvelope = {
  // compat con el “estilo spore/seed”
  auth: string;
  id: string;
  kind: "dv.upsert";
  dv: DatoVivo;
  meta?: {
    nodeId?: string;
    ts?: string; // ISO
    ns?: string;
    scopes?: string[];
    source?: string;
  };
};

// --------------------------
// Estado del bus
// --------------------------
let ws: WebSocket | null = null;
let openPromise: Promise<WebSocket> | null = null;

let heartbeatTimer: any = null;
let reconnectTimer: any = null;

let reconnectAttempts = 0;
const MAX_QUEUE = 1000;

// Cola en memoria (envelopes)
const queue: DvUpsertEnvelope[] = [];
const recentSent = new Map<string, string>();
const MAX_RECENT_SENT = 5000;

// Persist opcional de cola
const QUEUE_KEY = "mt.web.seedbus.queue.v3";
const PERSIST_QUEUE = true;

// --------------------------
// Helpers
// --------------------------
function log(...args: any[]) {
  if (import.meta.env.DEV) console.debug("[MT web] seedbus:", ...args);
}
function warn(...args: any[]) {
  console.warn("[MT web] seedbus:", ...args);
}
function err(...args: any[]) {
  console.error("[MT web] seedbus:", ...args);
}

function safeParseJSON(s: any) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function scopesFromDvMeta(dv: DatoVivo): string[] | undefined {
  const meta: any = (dv as any)?.meta || {};
  const scopes = meta.scopes;
  if (!scopes) return undefined;

  if (Array.isArray(scopes)) {
    const a = scopes.map((x: any) => String(x).trim()).filter(Boolean);
    return a.length ? a : undefined;
  }
  if (typeof scopes === "string") {
    const a = scopes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return a.length ? a : undefined;
  }
  return undefined;
}

/** Asegura meta dentro del DV (para Micelio index/consenso/trust) */
function ensureDvMeta(dv: DatoVivo): DatoVivo {
  const nowIso = new Date().toISOString();
  const m: any = (dv as any).meta || {};
  const scopes = scopesFromDvMeta(dv);

  const merged = {
    ...m,
    ns: m.ns ?? "mt:market",
    scopes: m.scopes ?? (scopes && scopes.length ? scopes : undefined) ?? m.scopes,
    ts: m.ts ?? nowIso,
    source: m.source ?? DEFAULT_SOURCE,
    emitter: m.emitter ?? NODE_ID,
  };

  return { ...(dv as any), meta: merged } as DatoVivo;
}

function wrapUpsert(dvRaw: DatoVivo): DvUpsertEnvelope {
  const dv = ensureDvMeta(dvRaw);
  const meta: any = (dv as any)?.meta || {};
  const nowIso = new Date().toISOString();

  return {
    auth: AUTH,
    id: NODE_ID,
    kind: "dv.upsert",
    dv,
    meta: {
      nodeId: NODE_ID,
      ts: nowIso,
      ns: meta.ns ?? "mt:market",
      scopes: scopesFromDvMeta(dv),
      source: meta.source ?? DEFAULT_SOURCE,
    },
  };
}

function persistQueue() {
  if (!PERSIST_QUEUE) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(queue.slice(-MAX_QUEUE))
    );
  } catch {}
}

function hydrateQueue() {
  if (!PERSIST_QUEUE) return;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    queue.splice(0, queue.length);
    for (const it of arr) {
      // formato nuevo
      if (
        it &&
        typeof it === "object" &&
        it.kind === "dv.upsert" &&
        it.dv &&
        it.dv.id &&
        it.dv.kind
      ) {
        queue.push(it as DvUpsertEnvelope);
        continue;
      }

      // compat: DV plano viejo
      if (it && typeof it === "object" && it.id && it.kind) {
        queue.push(wrapUpsert(it as DatoVivo));
      }
    }

    queue.splice(0, Math.max(0, queue.length - MAX_QUEUE));
  } catch {}
}

function enqueue(env: DvUpsertEnvelope) {
  const id = String(env?.dv?.id ?? "");
  if (!id) return;

  const idx = queue.findIndex((x) => String(x?.dv?.id) === id);
  if (idx >= 0) queue[idx] = env;
  else queue.push(env);

  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  persistQueue();
}

function clearTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  const base = Math.min(10000, 400 * Math.pow(2, Math.min(6, reconnectAttempts)));
  const jitter = Math.floor(Math.random() * 250);
  const delay = base + jitter;

  reconnectAttempts += 1;
  if (reconnectTimer) return;

  warn("reconnect en", delay, "ms (attempt", reconnectAttempts, ")");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureWs().catch(() => {});
  }, delay);
}

// --------------------------
// Handshake + heartbeat
// --------------------------
function sendHandshake(sock: WebSocket) {
  const alive = {
    auth: AUTH,
    kind: "node.alive",
    id: NODE_ID,
    meta: {
      role: "ms:web:seedbus",
      ns: "mt",
      scopes: BUS_SCOPES,
      caps: ["dv.upsert"],
    },
  };
  sock.send(JSON.stringify(alive));
}

function startHeartbeat(sock: WebSocket) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    try {
      sock.send(JSON.stringify({ auth: AUTH, kind: "node.alive", id: NODE_ID }));
    } catch {}
  }, 30000);
}

// --------------------------
// Conexión WS
// --------------------------
function ensureWs(): Promise<WebSocket> {
  hydrateQueue();

  if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve(ws);
  if (openPromise) return openPromise;

  openPromise = new Promise<WebSocket>((resolve, reject) => {
    try {
      clearTimers();

      log("conectando a", WS_URL);
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        log("WS abierto ✅");
        reconnectAttempts = 0;

        try {
          sendHandshake(ws!);
        } catch (e) {
          warn("handshake falló (continuo igual)", e);
        }

        startHeartbeat(ws!);

        // drenar cola
        while (queue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
          const env = queue.shift()!;
          try {
            ws.send(JSON.stringify(env));
            log("enviado de cola", env.dv.id);
          } catch (e) {
            enqueue(env);
            warn("falló enviar cola, reintentará", env.dv.id, e);
            break;
          }
        }
        persistQueue();

        resolve(ws!);
      };

      ws.onmessage = (ev) => {
        const msg = safeParseJSON(ev.data);
        if (!msg) return;

        if (msg.hello) log("hello:", msg);
        if (msg.ack) return;
        if (msg.ok) return;
        if (msg.error) warn("seed error:", msg.error);

        // Si en el futuro querés consumir sem.dv.answer, acá es el lugar.
      };

      ws.onerror = (e) => err("WS error", e);

      ws.onclose = () => {
        warn("WS cerrado");
        clearTimers();
        ws = null;
        openPromise = null;
        scheduleReconnect();
      };
    } catch (e) {
      err("fallo al crear WS", e);
      ws = null;
      openPromise = null;
      clearTimers();
      scheduleReconnect();
      reject(e);
    }
  });

  return openPromise;
}

// --------------------------
// API pública
// --------------------------
export async function publishDatoVivo(d: DatoVivo): Promise<void> {
  if (!d || typeof d !== "object") return;
  if (!(d as any).id || !(d as any).kind) return;

  const id = String((d as any).id);
  const hash = mtLiveRevisionHash(d);
  if (recentSent.get(id) === hash) return;
  recentSent.set(id, hash);
  while (recentSent.size > MAX_RECENT_SENT) recentSent.delete(recentSent.keys().next().value);

  const env = wrapUpsert(d);

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(env));
      return;
    } catch (e) {
      enqueue(env);
      try {
        ws.close();
      } catch {}
      ws = null;
      openPromise = null;
      scheduleReconnect();
      throw e;
    }
  }

  enqueue(env);

  try {
    await ensureWs();
  } catch (e) {
    throw e;
  }
}

export async function seedbusConnect(): Promise<void> {
  await ensureWs();
}

export function seedbusClearQueue() {
  queue.splice(0, queue.length);
  persistQueue();
}
