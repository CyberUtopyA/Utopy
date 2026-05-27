// src/utopy/spore.ts
// Espora RN/Node — awaken/attach/interpret/call + WebRTC inyectable
// con: auth injection, dict gossip, cola offline, on/off/once, addWsCandidate,
//      namespace automático, observe.start/stop y UniversalPortal integrado.

import { AutoChannel, hintsFromManifest, type AutoHints } from "./transport";
import { defaultSymbolDict, type SymbolMap } from "./dict";
import type { UtopyManifest } from "./manifest";
import { getKV, type KVStore } from "./storage";
import { UPortal } from "./ui/UniversalPortal"; // ⬅️ UniversalPortal

// --- Compat con seed que usa {kind:...} --- //
class SeedCompatChannel {
  public kind: "ws" = "ws";
  public onMessage?: (msg: any) => void;
  public onState?: (st: { connected: boolean; kind: "ws" }) => void;
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string) { this.url = url; }
  isConnected() { return this.ws?.readyState === 1; }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => { this.onState?.({ connected: true, kind: "ws" }); resolve(); };
      ws.onmessage = (ev) => {
        try { this.onMessage?.(JSON.parse(String(ev.data))); }
        catch { this.onMessage?.({ error: "bad.json", raw: String(ev.data) }); }
      };
      ws.onclose = () => this.onState?.({ connected: false, kind: "ws" });
      ws.onerror = (e) => { this.onState?.({ connected: false, kind: "ws" }); if (!this.isConnected()) reject(e); };
    });
  }

  async disconnect() { try { this.ws?.close(); } catch {} this.ws = null; this.onState?.({ connected: false, kind: "ws" }); }
  async send(op: string, payload?: any) {
    if (!this.isConnected()) throw new Error("ws.not.connected");
    const packet = { kind: op, ...(payload || {}) };
    this.ws!.send(JSON.stringify(packet));
  }
}

const rid = () => Math.random().toString(36).slice(2);
const SEED_WS_OVERRIDE = typeof process !== "undefined"
  ? ((process as any).env?.UTOPY_SEED_WS as string | undefined)
  : undefined;

const AUTH_ALWAYS = true; // inyectar auth en todos los envíos al seed
const K_MANIFEST = "utopy:lastManifest";
const AUTH_KINDS = new Set(["bio.create", "dato.create", "node.upsert", "node.capability"]);

export type SporeState = {
  attached: boolean;
  via: "webrtc" | "ws" | "http" | "offline";
  id?: string;
  manifest?: UtopyManifest | null;
};

export type SporeEvents = {
  onState?: (s: SporeState) => void;
  onLog?: (line: any) => void;
  onMessage?: (msg: any) => void;
};

type ObserveOpts = {
  id?: string;
  ns?: string;
  kinds?: string[];
  where?: Record<string, any>;
  replayLast?: number;
};

export class UtopySpore {
  private chan: AutoChannel | null = null;
  private dict: SymbolMap = { ...defaultSymbolDict };
  private events: SporeEvents;
  private state: SporeState = { attached: false, via: "offline", manifest: null, id: "spora@mobile" };
  private preferredOrder: ("webrtc" | "ws" | "http")[] | null = null;
  private getAuth: (() => string | undefined | null) | null = null;
  private queue: Array<{ op: string; payload?: any }> = [];

  // storage universal (RN/Node)
  private kvPromise: Promise<KVStore>;

  // listeners por kind
  private listeners = new Map<string, Set<(msg: any) => void>>();

  // namespace activo (auto-inyección en payload.ns)
  private ns: string | undefined;

  // ⬅️ Portal universal (por defecto UPortal global)
  private portal = UPortal;

  constructor(events: SporeEvents = {}) {
    this.events = events;
    this.kvPromise = getKV();
  }

  // ─────────── API pública ───────────
  getState() { return this.state; }
  setId(id: string) { this.state.id = id; }
  setAuthGetter(fn: () => string | undefined | null) { this.getAuth = fn; }
  setPreferredOrder(order: ("webrtc" | "ws" | "http")[]) { this.preferredOrder = order; }
  setNamespace(ns?: string) { this.ns = ns || undefined; }
  getNamespace() { return this.ns; }

  // Portal universal
  public setPortal(p: any) { this.portal = p || UPortal; }
  public getPortal() { return this.portal; }

  teach(sym: string, op: string, note?: string) { this.dict[sym] = { op, note }; }
  unteach(sym: string) { delete this.dict[sym]; }

  /** Suscribirse a eventos por kind. Retorna unsubscribe() */
  on(kind: string, handler: (msg: any) => void): () => void {
    if (!this.listeners.has(kind)) this.listeners.set(kind, new Set());
    const set = this.listeners.get(kind)!;
    set.add(handler);
    return () => { set.delete(handler); };
  }

  /** Desuscribirse (de un handler o de todos los de un kind) */
  off(kind: string, handler?: (msg: any) => void) {
    const set = this.listeners.get(kind);
    if (!set) return;
    if (handler) set.delete(handler);
    else set.clear();
  }

  /** Escuchar una sola vez */
  once(kind: string, handler: (msg: any) => void) {
    const off = this.on(kind, (m) => { try { handler(m); } finally { off(); } });
    return off;
  }

  /** Descubrir seeds en caliente (si el transport lo soporta) */
  addWsCandidate(url: string, meta?: any) {
    const anyChan = this.chan as any;
    if (anyChan && typeof anyChan.addWsCandidate === "function") {
      anyChan.addWsCandidate(url, meta);
      this.log(`[spore] addWsCandidate → ${url}`);
    } else {
      this.log(`[spore] addWsCandidate ignorado (transport sin soporte)`);
    }
  }

  /** Inyecta un canal WebRTC (DataChannel) ya abierto: send(ABI) */
  async attachWebRTC(send: (abi: any) => Promise<void>) {
    const hints: AutoHints = { prefer: this.preferredOrder || ["webrtc", "ws", "http"], webrtc: { send }, ws: [], http: [] };
    const ch = this.buildChannel(hints);
    await ch.connect();
    await this.onConnected();
  }

  // Acepta { manifest } o manifest directo
  async awaken(opts?: { manifest?: UtopyManifest | null; fallback?: UtopyManifest[] } | UtopyManifest) {
    let man: UtopyManifest | null | undefined;
    if (opts && (opts as any).utopy) man = opts as UtopyManifest;
    else {
      const o = (opts || {}) as { manifest?: UtopyManifest | null; fallback?: UtopyManifest[] };
      man = o.manifest ?? (await this.loadLastManifest()) ?? (o.fallback?.[0] ?? null);
    }
    if (!man) { this.log("⚠️ No hay manifiesto .utopy aún."); this.update({ attached: false, via: "offline", manifest: null }); return; }
    await this.attach(man);
  }

  async attach(man: UtopyManifest) {
    const hints = hintsFromManifest(man as any);
    const ch = this.buildChannel(hints);
    await ch.connect();
    try {
      const kv = await this.kvPromise;
      await kv.setItem(K_MANIFEST, JSON.stringify(man));
    } catch (e: any) { this.log(`kv.setItem error: ${e?.message || String(e)}`); }
    await this.onConnected(man);
  }

  async detach() {
    if (this.chan) { await this.chan.disconnect(); this.chan = null; }
    this.update({ attached: false, via: "offline" });
  }

  async loadLastManifest(): Promise<UtopyManifest | null> {
    try {
      const kv = await this.kvPromise;
      const raw = await kv.getItem(K_MANIFEST);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { this.log(`kv.getItem error: ${String(e)}`); return null; }
  }

  async interpret(symOrOp: string, payload?: any) {
    const map = this.dict[symOrOp];
    if (map?.op) return this.send(map.op, payload);
    return this.send("interpretar", { simbolo: symOrOp, payload });
  }

  /** Enviar una intención simbólica (op="intent", siempre con payload) */
  async sayIntent(i: { sym: string; say: string; with?: any; ns?: string; to?: string; replyTo?: string; ts?: number }) {
    const ns = i.ns ?? this.ns;
    const intent = { ...i, ns, ts: i.ts || Date.now() };
    return this.send("intent", { payload: intent });
  }

  async call(op: string, input?: any) { return this.send(op, input); }

  /** Inicia una suscripción por filtros, devuelve subscriptionId */
  async observeStart(opts: ObserveOpts = {}): Promise<string> {
    const id = opts.id || `obs_${rid()}`;
    const payload: any = {
      id,
      ...(opts.kinds ? { kinds: opts.kinds } : {}),
      ...(opts.where ? { where: opts.where } : {}),
      ...(typeof opts.replayLast === "number" ? { replayLast: opts.replayLast } : {}),
    };
    const ns = opts.ns ?? this.ns;
    if (ns) payload.ns = ns;
    await this.send("observe.start", payload);
    return id;
  }

  /** Detiene una suscripción por id (o todas si omites id) */
  async observeStop(id?: string) {
    const payload: any = {};
    if (id) payload.id = id;
    const ns = this.ns;
    if (ns) payload.ns = ns;
    await this.send("observe.stop", payload);
  }

  // ─────────── internos ───────────
  private buildChannel(hints: AutoHints) {
    // Compat directa via env/hints.ws[0]
    const wsUrl = SEED_WS_OVERRIDE || ((hints as any).ws?.length ? (hints as any).ws[0] : undefined);

    if (wsUrl) {
      const ch = new SeedCompatChannel(wsUrl);
      ch.onMessage = (msg: any) => {
        // INTENT → listeners + portal universal
        if (msg?.kind === "intent" && msg?.payload) {
          this.notify("intent", msg);
          this.manifestIntent(msg.payload);
          return;
        }
        // echo/debug
        if (msg?.ack && msg?.echo) { try { this.events.onMessage?.(JSON.parse(msg.echo)); } catch {} this.events.onLog?.(msg); }
        // hello/ok
        else if (msg?.hello || msg?.ok) { this.events.onMessage?.(msg); this.events.onLog?.(msg); }
        // passthrough
        else {
          this.events.onMessage?.(msg); this.events.onLog?.(msg);
          if (msg?.kind) this.notify(msg.kind, msg);
        }
      };
      ch.onState = (st) => { this.update({ attached: st.connected, via: st.connected ? st.kind : "offline" }); if (st.connected) this.flushQueue(); };
      this.chan = ch as any;
      return ch as any;
    }

    // AutoChannel normal
    if (this.preferredOrder && !hints.prefer) hints.prefer = this.preferredOrder;
    const ch = new AutoChannel(hints);
    ch.onMessage = (msg: any) => {
      // INTENT → listeners + portal universal
      if (msg?.kind === "intent" && msg?.payload) {
        this.notify("intent", msg);
        this.manifestIntent(msg.payload);
        return;
      }
      // Semántica
      if (msg?.kind === "sem.tell" && msg?.payload?.dict) this.mergeDict(msg.payload.dict);
      if (msg?.kind === "sem.ask" && msg?.payload?.simbolo) {
        const s = msg.payload.simbolo; const known = this.dict[s];
        if (known?.op) this.send("sem.tell", { dict: { [s]: known.op } });
      }
      this.events.onMessage?.(msg); this.events.onLog?.(msg);
      if (msg?.kind) this.notify(msg.kind, msg);
    };
    ch.onState = (st) => { this.update({ attached: st.connected, via: st.connected ? st.kind : "offline" }); if (st.connected) this.flushQueue(); };
    this.chan = ch;
    return ch;
  }

  private manifestIntent(i: any) {
    try {
      if (i?.say === "render" && i?.with?.blocks) {
        const target = i?.ns || "default";
        this.portal?.mount?.(i.with.blocks, target);
      }
    } catch {}
  }

  private notify(kind: string, msg: any) {
    if (this.listeners.has(kind)) for (const fn of this.listeners.get(kind)!) { try { fn(msg); } catch {} }
    if (this.listeners.has("*")) for (const fn of this.listeners.get("*")!) { try { fn(msg); } catch {} }
  }

  private async onConnected(manifest?: UtopyManifest) {
    const via = (this.chan?.kind ?? "offline") as SporeState["via"];
    const id = this.state.id || "spora@mobile";
    this.update({ attached: true, via, id, manifest: manifest ?? this.state.manifest ?? null });
    await this.send("node.alive", { id });
    await this.send("sem.ask");
    await this.flushQueue();
  }

  private async send(op: string, payload?: any) {
    if (!this.chan || !(this.chan as any).isConnected?.()) { this.queue.push({ op, payload }); return { queued: true } as any; }

    const auth = this.getAuth?.();
    // SeedCompatChannel: {kind:op, ...payload, auth}
    if (this.chan instanceof (SeedCompatChannel as any)) {
      const body = { ...(payload || {}) };
      if (AUTH_ALWAYS && auth) (body as any).auth = auth;
      return (this.chan as any).send(op, body);
    }

    // AutoChannel clásico
    const withAuth = AUTH_KINDS.has(op) ? { ...(payload || {}), auth } : (payload || {});
    const finalPayload = (withAuth && typeof withAuth === "object" && !Array.isArray(withAuth))
      ? (this.ns && (withAuth as any).ns == null ? { ...withAuth, ns: this.ns } : withAuth)
      : withAuth;
    await (this.chan as any).send(op, finalPayload);
  }

  private async flushQueue() {
    if (!this.chan || !this.chan.isConnected() || this.queue.length === 0) return;
    const q = [...this.queue]; this.queue.length = 0;
    for (const it of q) { await this.send(it.op, it.payload); }
  }

  private mergeDict(remote: Record<string, string>) {
    let changed = false;
    for (const [k, v] of Object.entries(remote)) {
      const cur = this.dict[k];
      if (!cur || cur.op !== v) { this.dict[k] = { op: v, note: cur?.note }; changed = true; }
    }
    if (changed) this.log(`🧠 sem.dict merged (${Object.keys(remote).length} símbolos)`);
  }

  private update(p: Partial<SporeState>) { this.state = { ...this.state, ...p }; this.events.onState?.(this.state); }
  private log(x: any) { this.events.onLog?.(x); }
}
