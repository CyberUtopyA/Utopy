// ──────────────────────────────────────────────────────────────────────────────
// AUTO transport (webrtc/ws/http/offline) + helpers (UEvent plano UTOPÝ)
// ──────────────────────────────────────────────────────────────────────────────

// Evento de salida UTOPÝ (lo que entiende tu seed)
const nowISO = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2);

export type UEventOut = {
  version?: "1.0";
  id?: string;
  ts?: string;
  kind: string;
  payload?: any;
  simbolo?: string; // por si usás interpretar con símbolo
};

function toUEvent(kind: string, payload?: any): UEventOut {
  return { version: "1.0", id: rid(), ts: nowISO(), kind, payload };
}

// Canal genérico
export interface Channel {
  kind: "webrtc" | "ws" | "http" | "offline";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  send(op: string, input?: any): Promise<void>;
  onMessage?: (m: any) => void;
  onState?: (st: { connected: boolean; kind: Channel["kind"] }) => void;
}

// ── WS ────────────────────────────────────────────────────────────────────────
export class WSChannel implements Channel {
  kind: "ws" = "ws";
  private url: string;
  private ws: WebSocket | null = null;
  private want = false;
  private backoff = 1000;
  private maxBackoff = 8000;
  onMessage?: (m: any) => void;
  onState?: Channel["onState"];

  constructor(url: string) {
    this.url = url;
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async connect() {
    this.want = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) return;
    await this.open();
  }

  private open(): Promise<void> {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.backoff = 1000;
        this.onState?.({ connected: true, kind: this.kind });
        resolve();
      };

      ws.onmessage = (ev: any) => {
        const data = typeof ev.data === "string" ? ev.data : "";
        if (!data) return;
        for (const p of data.split("\n").filter(Boolean)) {
          try { this.onMessage?.(JSON.parse(p)); }
          catch { this.onMessage?.(p); }
        }
      };

      ws.onclose = () => {
        this.ws = null;
        this.onState?.({ connected: false, kind: this.kind });
        if (!this.want) return;
        setTimeout(() => this.open(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
    });
  }

  async disconnect() {
    this.want = false;
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.onState?.({ connected: false, kind: this.kind });
  }

  async send(op: string, input?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const ev = toUEvent(op, input);
    const line = JSON.stringify(ev);
    this.ws.send(line.endsWith("\n") ? line : line + "\n");
  }
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
export class HTTPChannel implements Channel {
  kind: "http" = "http";
  private base: string;
  private auth?: string;
  private connected = false;
  onMessage?: (m: any) => void;
  onState?: Channel["onState"];

  constructor(base: string, auth?: string) {
    this.base = base.replace(/\/$/, "");
    this.auth = auth;
  }

  isConnected() { return this.connected; }

  async connect() {
    // HTTP es stateless; lo tratamos como "disponible" si hay base
    this.connected = true;
    this.onState?.({ connected: true, kind: this.kind });
  }

  async disconnect() {
    this.connected = false;
    this.onState?.({ connected: false, kind: this.kind });
  }

  async send(op: string, input?: any) {
    // Enviamos evento UTOPÝ plano a un endpoint genérico (si lo tuvieras)
    const ev = toUEvent(op, input);
    const res = await fetch(`${this.base}/universal-intake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.auth ? { authorization: this.auth } : {}),
      },
      body: JSON.stringify(ev),
    });
    const text = await res.text();
    try { this.onMessage?.(JSON.parse(text)); }
    catch { this.onMessage?.(text); }
  }
}

// ── WebRTC (inyectado) ───────────────────────────────────────────────────────
export class WebRTCChannel implements Channel {
  kind: "webrtc" = "webrtc";
  private sendFn: ((ev: UEventOut) => Promise<void>) | null = null;
  onMessage?: (m: any) => void;
  onState?: Channel["onState"];

  constructor(opts?: { send?: (ev: UEventOut) => Promise<void> }) {
    this.sendFn = opts?.send || null;
  }

  isConnected() { return !!this.sendFn; }
  async connect() { this.onState?.({ connected: this.isConnected(), kind: this.kind }); }
  async disconnect() { this.onState?.({ connected: false, kind: this.kind }); }

  async send(op: string, input?: any) {
    if (!this.sendFn) throw new Error("No WebRTC channel");
    await this.sendFn(toUEvent(op, input));
  }
}

// ── Offline (cola) ───────────────────────────────────────────────────────────
export class OfflineChannel implements Channel {
  kind: "offline" = "offline";
  private queue: Array<{ op: string; input?: any }> = [];
  onMessage?: (m: any) => void;
  onState?: Channel["onState"];

  isConnected() { return false; }
  async connect() { this.onState?.({ connected: false, kind: this.kind }); }
  async disconnect() { this.onState?.({ connected: false, kind: this.kind }); }

  async send(op: string, input?: any) {
    this.queue.push({ op, input });
    this.onMessage?.({ kind: "event.queue.offline", size: this.queue.length });
  }
  drain() {
    const copy = [...this.queue];
    this.queue.length = 0;
    return copy;
  }
  size() { return this.queue.length; }
}

// ── AUTO ──────────────────────────────────────────────────────────────────────
export type AutoHints = {
  prefer?: ("webrtc" | "ws" | "http")[];
  ws?: string[];
  http?: { base: string; auth?: string }[];
  webrtc?: { send: (ev: UEventOut) => Promise<void> } | null;
};

type StateEvt = {
  connected: boolean;
  kind: "webrtc" | "ws" | "http" | "offline";
};

export class AutoChannel implements Channel {
  kind: "webrtc" | "ws" | "http" | "offline" = "offline";
  private chan: Channel = new OfflineChannel();
  private hints: AutoHints;

  // ← NUEVO: candidatos WS agregados dinámicamente (micro-semillas)
  private wsCandidates: string[] = [];

  onMessage?: (m: any) => void;
  onState?: (st: StateEvt) => void;

  constructor(hints: AutoHints) {
    this.hints = hints;
  }

  isConnected() { return this.chan.isConnected(); }

  private notifyState(connected: boolean, kind: StateEvt["kind"]) {
    this.kind = kind;
    this.onState?.({ connected, kind });
  }

  // ← NUEVO: API pública para inyectar un WS candidato en caliente
  addWsCandidate(url: string, _meta?: any) {
    if (!url) return;
    if (!this.wsCandidates.includes(url)) this.wsCandidates.push(url);

    // Si estamos offline o sin canal usable, intentamos conectar YA.
    if (!this.chan || !this.chan.isConnected() || this.kind === "offline") {
      this.tryCandidate(url).catch(() => {});
    }
  }

  // ← NUEVO: intenta conectar a un WS puntual y si conecta y seguimos offline, lo adoptamos
  private async tryCandidate(url: string) {
    const c = new WSChannel(url);
    c.onMessage = (m) => this.onMessage?.(m);
    c.onState = (st) => this.notifyState(st.connected, st.kind);
    await c.connect();

    if (c.isConnected()) {
      // Adoptar solo si no tenemos algo mejor activo
      if (!this.chan || !this.chan.isConnected() || this.kind === "offline") {
        const prev = this.chan;
        this.chan = c;
        this.kind = this.chan.kind;

        // drenar cola si venimos de offline
        if (prev && (prev as any).drain) {
          const queued = (prev as any).drain();
          for (const it of queued) {
            await this.chan.send(it.op, it.input);
          }
        }
      } else {
        // Ya estamos conectados a algo → cerramos este candidato
        await c.disconnect().catch(() => {});
      }
    }
  }

  async connect() {
    const prefer = this.hints.prefer || ["webrtc", "ws", "http"];

    const fams: Record<"webrtc" | "ws" | "http", (() => Promise<Channel>)[]> = {
      webrtc: [],
      ws: [],
      http: [],
    };

    if (this.hints.webrtc) {
      fams.webrtc.push(async () => {
        const c = new WebRTCChannel({ send: this.hints.webrtc!.send });
        c.onMessage = (m) => this.onMessage?.(m);
        c.onState = (st) => this.notifyState(st.connected, st.kind);
        await c.connect();
        return c;
      });
    }

    // WS de manifest
    for (const u of this.hints.ws || []) {
      fams.ws.push(async () => {
        const c = new WSChannel(u);
        c.onMessage = (m) => this.onMessage?.(m);
        c.onState = (st) => this.notifyState(st.connected, st.kind);
        await c.connect();
        return c;
      });
    }
    // WS candidatos agregados dinámicamente
    for (const u of this.wsCandidates) {
      fams.ws.push(async () => {
        const c = new WSChannel(u);
        c.onMessage = (m) => this.onMessage?.(m);
        c.onState = (st) => this.notifyState(st.connected, st.kind);
        await c.connect();
        return c;
      });
    }

    for (const h of this.hints.http || []) {
      fams.http.push(async () => {
        const c = new HTTPChannel(h.base, h.auth);
        c.onMessage = (m) => this.onMessage?.(m);
        c.onState = (st) => this.notifyState(st.connected, st.kind);
        await c.connect();
        return c;
      });
    }

    // Probar por familia en orden preferido y adoptar el primer éxito
    for (const family of prefer) {
      const group = fams[family as "webrtc" | "ws" | "http"] || [];
      if (!group.length) continue;

      const results = await Promise.allSettled(group.map((fn) => fn()));
      const ok = results.find(
        (r): r is PromiseFulfilledResult<Channel> => r.status === "fulfilled"
      );
      if (ok) {
        const prev = this.chan;
        const next = ok.value;

        this.chan = next;
        this.notifyState(this.chan.isConnected(), this.chan.kind);

        if (
          prev instanceof OfflineChannel &&
          prev.size() > 0 &&
          this.chan.isConnected()
        ) {
          const queued = prev.drain();
          for (const it of queued) {
            await this.chan.send(it.op, it.input);
          }
        }
        return;
      }
    }

    // Nada conectó → offline
    await this.chan.disconnect().catch(() => {});
    this.chan = new OfflineChannel();
    this.notifyState(false, "offline");
  }

  async disconnect() {
    await this.chan.disconnect().catch(() => {});
    this.chan = new OfflineChannel();
    this.notifyState(false, "offline");
  }

  async send(op: string, input?: any) {
    return this.chan.send(op, input);
  }
}

// ── Hints desde manifiesto .utopy / utopy://attach ───────────────────────────
export type ManifestHints = {
  id?: string;
  ws?: string;
  http?: string;
  auth?: string;
  prefer?: "webrtc" | "ws" | "http";
};

// Acepta manifest compacto o UTOPÝ completo
export function hintsFromManifest(m: any): AutoHints {
  // UTOPÝ completo
  if (m && m.utopy && m.utopy.transports) {
    const wsSeeds: string[] = m.utopy?.transports?.gossip?.wsSeeds || [];
    // Por defecto preferimos WS/HTTP (si inyectás WebRTC, ponelo primero desde Spore)
    const prefer: ("webrtc" | "ws" | "http")[] = ["ws", "http"];
    return { prefer, ws: wsSeeds, http: [], webrtc: null };
  }
  // Compacto
  const h = m as ManifestHints;
  const prefer = h.prefer
    ? ([h.prefer, "ws", "http"] as any)
    : ["webrtc", "ws", "http"];
  const ws = h.ws ? [h.ws] : [];
  const http = h.http ? [{ base: h.http, auth: h.auth }] : [];
  return { prefer, ws, http, webrtc: null };
}
