// ============================================
// FILE: src/utopy/seed.ts
// - SeedClient RAW para MS
// - Envía mensajes RAW (sin wrapper extra)
// - Cola + reconexión
// ============================================

export type SeedHello = { ns: string; id: string; auth?: string };

export class SeedClient {
  private ws: WebSocket | null = null;
  private queue: any[] = [];
  private onMsg: ((msg: unknown) => void) | null = null;

  private reconnectTimer: any = null;
  private wsUrl: string;
  private hello: SeedHello;

  constructor(wsUrl: string, hello: SeedHello) {
    this.wsUrl = wsUrl;
    this.hello = hello;
  }

  connect(onMsg: (msg: unknown) => void) {
    this.onMsg = onMsg;
    console.log("[MS SeedClient] connecting", this.wsUrl, this.hello);

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log("[MS SeedClient] open");

      const helloMsg = { kind: "hello", ...this.hello };
      this.sendRaw(helloMsg);
      console.log("[MS SeedClient] sent hello", helloMsg);

      const q = [...this.queue];
      this.queue = [];
      console.log("[MS SeedClient] flush queue", q.length);
      for (const m of q) this.sendRaw(m);
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      const raw = String(ev.data);
      console.log("[MS SeedClient] rx raw", raw.slice(0, 240));

      try {
        const msg: any = JSON.parse(raw);
        this.onMsg?.(msg);
      } catch (e) {
        console.warn("[MS SeedClient] rx parse fail", e);
      }
    };

    this.ws.onclose = (e) => {
      console.warn("[MS SeedClient] close", e.code, e.reason);
      this.ws = null;

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
    this.ws.send(JSON.stringify(msg));
  }
}