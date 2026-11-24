// ============================================
// FILE: src/utopy/seed.ts
// - SeedClient RAW para MS
// - Envía mensajes RAW (sin wrapper extra)
// - Cola + reconexión
// ============================================

export type SeedHello = { ns: string; id: string; auth?: string };

type PendingSeedTx = {
  txId: string;
  kind: string;
  dvId: string | null;
  sentAt: number;
};

const DEV =
  typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);

function parseMessage(value: unknown): any | null {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function describeMessage(message: any) {
  const dv = message?.dv || message?.payload?.dv || message?.with?.dv || null;
  return {
    kind: String(dv?.kind || message?.kind || message?.say || "unknown"),
    dvId: dv?.id ? String(dv.id) : message?.id ? String(message.id) : null,
  };
}

export class SeedClient {
  private ws: WebSocket | null = null;
  private queue: any[] = [];
  private onMsg: ((msg: unknown) => void) | null = null;
  private txSequence = 0;
  private pending = new Map<string, PendingSeedTx>();

  private reconnectTimer: any = null;
  private wsUrl: string;
  private hello: SeedHello;

  constructor(wsUrl: string, hello: SeedHello) {
    this.wsUrl = wsUrl;
    this.hello = hello;
  }

  connect(onMsg: (msg: unknown) => void) {
    this.onMsg = onMsg;
    if (DEV) console.debug("[MS SeedClient] connecting");

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      if (DEV) console.debug("[MS SeedClient] open");

      const helloMsg = { kind: "hello", ...this.hello };
      this.sendRaw(helloMsg);

      const q = [...this.queue];
      this.queue = [];
      if (DEV) console.debug("[MS SeedClient] flush queue", q.length);
      for (const m of q) this.sendRaw(m);
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      const raw = String(ev.data);

      try {
        const msg: any = JSON.parse(raw);
        this.traceIncoming(msg);
        this.onMsg?.(msg);
      } catch (e) {
        console.warn("[MS SeedClient] rx parse fail", e);
      }
    };

    this.ws.onclose = (e) => {
      console.warn("[MS SeedClient] close", e.code, e.reason);
      this.ws = null;
      this.pending.clear();

      if (this.reconnectTimer) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect(onMsg);
      }, 1200);
    };

    this.ws.onerror = (e) => {
      console.warn("[MS SeedClient] error", e);
    };
  }

  sendRaw(msg: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      return;
    }
    const txId = String(msg?.txId || this.nextTxId());
    const wire = msg && typeof msg === "object" ? { ...msg, txId } : msg;
    const descriptor = describeMessage(wire);
    this.pending.set(txId, {
      txId,
      kind: descriptor.kind,
      dvId: descriptor.dvId,
      sentAt: Date.now(),
    });
    this.prunePending();
    if (DEV) {
      console.debug("[SEED TX]", {
        txId,
        kind: descriptor.kind,
        dvId: descriptor.dvId,
        direction: "market->seed",
      });
    }
    this.ws.send(JSON.stringify(wire));
  }

  private nextTxId() {
    this.txSequence += 1;
    return `seed:${Date.now().toString(36)}:${this.txSequence.toString(36)}`;
  }

  private prunePending() {
    const cutoff = Date.now() - 60_000;
    for (const [txId, pending] of this.pending) {
      if (pending.sentAt < cutoff) this.pending.delete(txId);
    }
  }

  private traceIncoming(msg: any) {
    if (!DEV) return;
    const echo = parseMessage(msg?.echo);
    const exactTxId = String(msg?.txId || echo?.txId || "");
    const isResponse = msg?.ack === true || msg?.ok === true || Boolean(msg?.error);
    const fallback = !exactTxId && isResponse
      ? [...this.pending.values()].sort((a, b) => a.sentAt - b.sentAt)[0] || null
      : null;
    const pending = (exactTxId && this.pending.get(exactTxId)) || fallback;
    const descriptor = describeMessage(msg?.dv ? msg : echo || msg);
    const txId = exactTxId || pending?.txId || null;
    console.debug("[SEED RX]", {
      txId,
      kind: pending?.kind || descriptor.kind,
      dvId: pending?.dvId || descriptor.dvId,
      ack: msg?.ack === true,
      ok: msg?.ok === true,
      error: msg?.error ? String(msg.error) : null,
      direction: "seed->market",
      correlation: exactTxId ? "exact" : pending ? "oldest-pending" : "none",
    });
    if (txId && (msg?.ack === true || msg?.ok === true || msg?.error)) {
      this.pending.delete(txId);
    }
  }
}
