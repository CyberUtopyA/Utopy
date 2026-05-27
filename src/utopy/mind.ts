// Núcleo triádico del Nodo: Intención (Espíritu), Interpretación (Mente), Acción (Cuerpo)

export type Datum = {
  kind: string;      // "emoji" | "adn" | "medicion" | "bio" | ...
  payload: any;      // contenido vivo
  meta?: any;        // origen, firma, ns, tiempo, confianza, etc.
};

export type Intent = { goal: string; args?: any; confidence: number };
export type ActOutcome = { ok: boolean; info?: any };

export interface Interpreter {
  id: string;
  score(d: Datum): number;                           // 0..1: ¿cuánto entiendo este dato?
  interpret(d: Datum, ctx: MindContext): Intent[];   // genera intenciones
}

export interface Skill {
  id: string;
  affordance(intent: Intent, ctx: MindContext): number; // 0..1: ¿qué tan apto soy?
  act(intent: Intent, ctx: MindContext): Promise<ActOutcome>;
}

// ── Store opcional para el contexto ───────────────────────────────────────────
export type MindStore = {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  all(prefix: string): Promise<Array<[string, any]>>;
};

export type Belief = { key: string; value: any; weight: number; ttl?: number };

// ✅ MindContext incluye `store` (inyectado por defecto con un Map en memoria)
export type MindContext = {
  beliefs: Map<string, Belief>;
  symbols: Map<string, any>;
  publish: (evt: any) => void;          // resonancia (pub/sub local o red)
  store?: MindStore;                    // KV
};

// ── Memoria nodal global (en RAM) ────────────────────────────────────────────
type NMStore = {
  beliefs: Map<string, Belief>;
  symbols: Map<string, any>;
  kv: Map<string, any>;                 // KV para el store
};

function ensureNodalStore(): NMStore {
  const g: any = globalThis as any;
  if (!g.__UTOPY_NODEMIND) g.__UTOPY_NODEMIND = {};
  if (!g.__UTOPY_NODEMIND.mem) {
    g.__UTOPY_NODEMIND.mem = {
      beliefs: new Map<string, Belief>(),
      symbols: new Map<string, any>(),
      kv: new Map<string, any>(),
    } as NMStore;
  }
  return g.__UTOPY_NODEMIND.mem as NMStore;
}

export class MindCore {
  private interpreters: Interpreter[] = [];
  private skills: Skill[] = [];
  public ctx: MindContext;

  constructor(publish: (evt: any) => void) {
    const mem = ensureNodalStore();

    // ✅ Store por defecto (en memoria)
    const mapStore: MindStore = {
      async get(key: string) { return mem.kv.get(key); },
      async set(key: string, value: any) { mem.kv.set(key, value); },
      async all(prefix: string) {
        const out: Array<[string, any]> = [];
        for (const [k, v] of mem.kv.entries()) {
          if (!prefix || k.startsWith(prefix)) out.push([k, v]);
        }
        return out;
      },
    };

    this.ctx = {
      beliefs: mem.beliefs,
      symbols: mem.symbols,
      publish,
      store: mapStore,
    };
  }

  useInterpreter(i: Interpreter) { this.interpreters.push(i); return this; }
  useSkill(s: Skill) { this.skills.push(s); return this; }

  observe(d: Datum) {
    const ranked = this.interpreters
      .map(it => ({ it, s: safe(() => it.score(d), 0) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s);

    const intents: Intent[] = [];
    for (const { it } of ranked) {
      const out = safe(() => it.interpret(d, this.ctx), []);
      if (Array.isArray(out)) intents.push(...out);
    }
    if (!intents.length) return;

    const choices = intents
      .flatMap(intent =>
        this.skills.map(sk => {
          const aff = clamp01(safe(() => sk.affordance(intent, this.ctx), 0));
          return { intent, sk, score: clamp01(intent.confidence) * aff };
        }),
      )
      .sort((a, b) => b.score - a.score);

    if (!choices.length) return;

    const best = choices[0];
    this.ctx.publish?.({ type: "mind:decide", intent: best.intent, skill: best.sk.id, score: best.score });
    best.sk
      .act(best.intent, this.ctx)
      .then(out => this.ctx.publish?.({ type: "mind:act:done", intent: best.intent, skill: best.sk.id, out }))
      .catch(err => this.ctx.publish?.({ type: "mind:act:error", intent: best.intent, skill: best.sk.id, err: String(err) }));
  }

  learnSymbol(ns: string, symbol: string, meaning: any, weight = 1) {
    const key = `${ns}:${symbol}`;
    const old = this.ctx.symbols.get(key);
    const merged = old
      ? { ...old, ...meaning, weight: (old.weight ?? 1) + weight }
      : { ...meaning, weight };
    this.ctx.symbols.set(key, merged);
    this.ctx.publish?.({ type: "mind:symbol:update", ns, symbol, meaning: merged });
  }

  remember(key: string, value: any, weight = 1, ttl?: number) {
    this.ctx.beliefs.set(key, { key, value, weight, ttl });
    this.ctx.publish?.({ type: "mind:belief:set", key, weight, ttl });
  }

  recall<T = any>(key: string): T | undefined {
    return this.ctx.beliefs.get(key)?.value as T | undefined;
  }

  /** Ejecuta un intent directo (sin pasar por intérpretes) y elige el mejor skill */
  async act(goal: string, args: any = {}, confidence = 1): Promise<ActOutcome> {
    const intent = { goal, args, confidence };

    const choices = this.skills
      .map(sk => {
        const aff = clamp01(safe(() => sk.affordance(intent, this.ctx), 0));
        return { sk, score: clamp01(confidence) * aff };
      })
      .sort((a, b) => b.score - a.score);

    if (!choices.length || choices[0].score <= 0) {
      return { ok: false, info: { error: "no_skill_apto", goal } };
    }

    const best = choices[0];
    this.ctx.publish?.({ type: "mind:decide", intent, skill: best.sk.id, score: best.score });

    try {
      const out = await best.sk.act(intent, this.ctx);
      this.ctx.publish?.({ type: "mind:act:done", intent, skill: best.sk.id, out });
      return out;
    } catch (err: any) {
      this.ctx.publish?.({ type: "mind:act:error", intent, skill: best.sk.id, err: String(err) });
      return { ok: false, info: { error: String(err) } };
    }
  }
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function safe<T>(fn: () => T, fallback: T): T { try { return fn(); } catch { return fallback; } }
