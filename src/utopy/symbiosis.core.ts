// src/utopy/symbiosis-core.ts
// Núcleo de simbiosis UTOPY — agnóstico de dominio (market, salud, energía, educación, etc.)
// - Registro de dominios (ns) con schemas y traits
// - Normalización canónica de ítems
// - Snapshot/sync y gossip de diccionario
// - Puente con Spore (intents genéricos y meta)
// - Helpers para emitir/escuchar intents por ns

// Tipos básicos de la red
export type UId = string;
export type NS = string; // ej: "mt:market", "hl:salud", "en:energia"

export type CanonItemBase = {
  id: UId;
  _ts?: number;              // timestamp lógico
  _src?: string;             // origen (nodo/seed)
  _sig?: string;             // firma opcional
  [k: string]: any;
};

// Schemas declarativos livianos (no “validation lib”, solo contrato abierto)
export type SymSchema = {
  kind: string;             // ej: "product", "offer", "org", "territorio", "paciente", "muestra"
  required?: string[];      // campos fuertes
  index?: string[];         // campos a indexar (seeds pueden honrar esto)
  docs?: string;            // doc URL o markdown corto
};

// Traits: comportamientos transversales opcionales
export type SymTrait<T extends CanonItemBase = CanonItemBase> = {
  id: string;               // ej: "priceable", "geo", "owner", "batch"
  applies: (item: T) => boolean;
  normalize?: (item: T, ctx: SymCtx) => T | void;
  onIntent?: (i: Intent, ctx: SymCtx) => void | Promise<void>;
};

// Intent UTOPY (forma genérica)
export type Intent = {
  sym: string;              // símbolo mnemónico (opcional)
  say: string;              // verbo/acción: "product.create", "offer.update", "snapshot.ask"
  with?: any;               // payload
  ns?: NS;                  // namespace destino
  from?: string;            // emisor
  to?: string;              // receptor
  ts?: number;              // tiempo de emisión
  replyTo?: string;         // correlación
};

// Adaptador mínimo del Spore que ya tienes
export type SporeLike = {
  sayIntent: (i: Intent) => Promise<any>;
  on: (kind: string, cb: (msg: any) => void) => () => void;
  teach?: (sym: string, op: string, note?: string) => void;
  unteach?: (sym: string) => void;
};

// Contexto que reciben traits y dominios
export type SymCtx = {
  ns: NS;
  now: () => number;
  publish: (i: Intent) => Promise<void>;
  getState: () => SymStateNS;
  setState: (fn: (s: SymStateNS) => void) => void;
};

// Estado por namespace
export type SymStateNS = {
  dict: Record<string, string>; // símbolo → op
  items: Record<string, CanonItemBase>; // espejo simple (por id)
  offers?: Record<string, CanonItemBase>;
  meta?: Record<string, any>;
};

// Módulo de dominio: lo único “específico” que registras
export type DomainModule = {
  ns: NS;
  label?: string;
  schemas: SymSchema[];
  traits?: SymTrait[];
  // Called cuando llega un intent del NS
  onIntent?: (i: Intent, ctx: SymCtx) => void | Promise<void>;
  // Retorna snapshot “ligero” para {ns}.snapshot.ask
  snapshot?: (ctx: SymCtx) => Promise<{ [k: string]: any }>;
  // Normalización transversal por dominio (además de traits)
  normalize?: (item: CanonItemBase, ctx: SymCtx) => CanonItemBase | void;
  // Diccionario semántico base del dominio (se gossipea con sem.tell)
  dict?: Record<string, string>;
};

// Opciones globales
export type SymbiosisOpts = {
  clock?: () => number; // por si usas lamport/vector clock
};

// -------------------------------------------------------------------------------------
// Núcleo
// -------------------------------------------------------------------------------------
export class SymbiosisCore {
  private opts: SymbiosisOpts;
  private domains = new Map<NS, DomainModule>();
  private state = new Map<NS, SymStateNS>();
  private spore: SporeLike | null = null;
  private off: (() => void) | null = null;

  constructor(opts?: SymbiosisOpts) {
    this.opts = opts || {};
  }

  // Registro/consulta
  registerDomain(mod: DomainModule) {
    if (!mod?.ns) throw new Error("DomainModule requiere ns");
    this.domains.set(mod.ns, mod);
    if (!this.state.has(mod.ns)) {
      this.state.set(mod.ns, { dict: { ...mod.dict }, items: {}, offers: {}, meta: {} });
    } else {
      // merge dict si ya existía
      const cur = this.state.get(mod.ns)!;
      cur.dict = { ...mod.dict, ...cur.dict };
    }
    return this;
  }

  getDomain(ns: NS): DomainModule | undefined { return this.domains.get(ns); }

  getState(ns: NS): SymStateNS {
    if (!this.state.has(ns)) this.state.set(ns, { dict: {}, items: {}, offers: {}, meta: {} });
    return this.state.get(ns)!;
  }

  // Hook al spore: escucha intents y maneja meta-protocolo genérico
  wireToSpore(sp: SporeLike) {
    this.spore = sp;

    // Opcional: enseñar símbolos globales (no pisa tu defaultSymbolDict)
    try {
      sp.teach?.("🌱", "dato.create", "sembrar dato vivo");
      sp.teach?.("🔎", "dato.query", "consultar");
      sp.teach?.("📦", "snapshot.ask", "solicitar snapshot");
      sp.teach?.("🧩", "schema.ask", "pedir schemas");
    } catch {}

    // Canal INTENT
    this.off?.();
    this.off = sp.on("intent", async (msg: any) => {
      const i: Intent = msg?.payload || msg?.i || msg;
      if (!i?.say) return;
      const ns = (i.ns as NS) || inferNS(i.say);
      if (!ns) return;

      // 1) Meta: schema.ask → schema.tell
      if (i.say.endsWith("schema.ask")) {
        const mod = this.domains.get(ns);
        if (mod?.schemas?.length) {
          await this.publish({
            ns, sym: "🧩", say: `${ns}.schema.tell`,
            with: { schemas: mod.schemas, ts: this.now() },
            replyTo: i.replyTo,
          });
        }
        return;
      }

      // 2) Meta: snapshot.ask → snapshot.tell (si el dominio expone snapshot())
      if (i.say.endsWith("snapshot.ask")) {
        const mod = this.domains.get(ns);
        if (mod?.snapshot) {
          const snap = await mod.snapshot(this.makeCtx(ns));
          await this.publish({
            ns, sym: "📦", say: `${ns}.snapshot.tell`,
            with: { ...snap, ts: this.now() },
            replyTo: i.replyTo,
          });
        } else {
          // fallback: compacta desde espejo local
          const st = this.getState(ns);
          const products = Object.values(st.items);
          const offers = Object.values(st.offers || {});
          await this.publish({
            ns, sym: "📦", say: `${ns}.snapshot.tell`,
            with: { products, offers, ts: this.now() },
            replyTo: i.replyTo,
          });
        }
        return;
      }

      // 3) Gossip semántico: sem.ask → sem.tell(dict)
      if (i.say === "sem.ask" || i.say.endsWith(".sem.ask")) {
        // responde con todos los dicts (o sólo del ns si querés)
        for (const [dns, st] of this.state) {
          if (Object.keys(st.dict || {}).length) {
            await this.publish({ ns: dns, sym: "🧠", say: "sem.tell", with: { dict: st.dict } });
          }
        }
        return;
      }

      // 4) sem.tell (merge dict)
      if (i.say === "sem.tell" || i.say.endsWith(".sem.tell")) {
        const d = i.with?.dict;
        if (d && typeof d === "object") {
          const st = this.getState(ns);
          st.dict = { ...st.dict, ...d };
        }
        return;
      }

      // 5) Intents de dominio
      const mod = this.domains.get(ns);
      if (!mod) return;

      // a) crear/actualizar ítems conocidos
      // Convención: *.product.* → items ; *.offer.* → offers
      if (matchesAny(i.say, ["product.create", "producto.create"])) {
        const raw = i.with?.product || i.with?.producto || i.with;
        const ok = this.acceptAndIndex(ns, raw, "items", mod);
        if (ok) await this.publish({ ns, sym: "🧠", say: `${ns}.product.created`, with: { product: ok } });
        return;
      }
      if (matchesAny(i.say, ["product.update", "producto.update"])) {
        const raw = i.with?.product || i.with?.producto || i.with;
        const ok = this.acceptAndIndex(ns, raw, "items", mod);
        if (ok) await this.publish({ ns, sym: "🧠", say: `${ns}.product.updated`, with: { product: ok } });
        return;
      }
      if (matchesAny(i.say, ["offer.create", "oferta.create"])) {
        const raw = i.with?.offer || i.with?.oferta || i.with;
        const ok = this.acceptAndIndex(ns, raw, "offers", mod);
        if (ok) await this.publish({ ns, sym: "🧠", say: `${ns}.offer.created`, with: { offer: ok } });
        return;
      }
      if (matchesAny(i.say, ["offer.update", "oferta.update"])) {
        const raw = i.with?.offer || i.with?.oferta || i.with;
        const ok = this.acceptAndIndex(ns, raw, "offers", mod);
        if (ok) await this.publish({ ns, sym: "🧠", say: `${ns}.offer.updated`, with: { offer: ok } });
        return;
      }

      // b) dejar que el dominio y/o traits procesen
      const ctx = this.makeCtx(ns);
      // traits first
      for (const t of (mod.traits || [])) {
        try { await t.onIntent?.(i, ctx); } catch {}
      }
      // dominio
      try { await mod.onIntent?.(i, ctx); } catch {}
    });

    return this;
  }

  // Emitir intent
  async publish(i: Intent) {
    i.ts = i.ts || this.now();
    if (!this.spore) throw new Error("spore no cableado: llama a wireToSpore(spore)");
    await this.spore.sayIntent(i);
  }

  // Helpers de alto nivel para clientes
  async askSchemas(ns: NS) {
    return this.publish({ ns, sym: "🧩", say: `${ns}.schema.ask`, with: {} });
  }
  async askSnapshot(ns: NS) {
    return this.publish({ ns, sym: "📦", say: `${ns}.snapshot.ask`, with: {} });
  }
  async create(ns: NS, kind: "product"|"offer"|string, item: any) {
    const say = kind === "offer" ? `${ns}.offer.create` : `${ns}.product.create`;
    return this.publish({ ns, sym: "🌱", say, with: { [kind]: item } });
  }
  async update(ns: NS, kind: "product"|"offer"|string, item: any) {
    const say = kind === "offer" ? `${ns}.offer.update` : `${ns}.product.update`;
    return this.publish({ ns, sym: "🌱", say, with: { [kind]: item } });
  }

  // -----------------------------------------------------------------------------------
  // Internos
  // -----------------------------------------------------------------------------------
  private now() { return (this.opts.clock || Date.now)(); }

  private makeCtx(ns: NS): SymCtx {
    return {
      ns,
      now: () => this.now(),
      publish: (i) => this.publish(i),
      getState: () => this.getState(ns),
      setState: (fn) => { const st = this.getState(ns); fn(st); },
    };
  }

  private acceptAndIndex(
    ns: NS,
    raw: any,
    bucket: "items" | "offers",
    mod: DomainModule
  ): CanonItemBase | null {
    if (!raw) return null;
    // Normalización canónica
    let item = normalizeBase(raw, ns, this.now());
    // Dominio
    try { item = (mod.normalize?.(item, this.makeCtx(ns)) || item); } catch {}
    // Traits
    for (const t of (mod.traits || [])) {
      if (t.applies(item)) {
        try { item = (t.normalize?.(item, this.makeCtx(ns)) || item); } catch {}
      }
    }
    // Indexar
    const st = this.getState(ns);
    if (bucket === "items") st.items[item.id] = item;
    else st.offers![item.id] = item;
    return item;
  }
}

// -------------------------------------------------------------------------------------
// Utilidades
// -------------------------------------------------------------------------------------
function inferNS(say: string): NS | null {
  const ix = say.indexOf(".");
  if (ix < 1) return null;
  // si ya viene "mt:market.product.create"
  const pre = say.slice(0, ix);
  return pre.includes(":") ? (pre as NS) : null;
}

function matchesAny(say: string, suffixes: string[]) {
  return suffixes.some(sfx => say.endsWith(sfx));
}

function ensurePrefixId(id: string, ns: NS): string {
  // Estandar: utopi:{ns}:{id} si no tiene prefijo
  if (id.startsWith("utopi:")) return id;
  return `utopi:${ns}:${id}`;
}

function normalizeBase<T extends CanonItemBase>(raw: any, ns: NS, now: number): T {
  const id = ensurePrefixId(String(raw?.id || randId()), ns);
  const item: T = {
    ...raw,
    id,
    _ts: Number(raw?._ts || now),
  };
  return item;
}

function randId() { return Math.random().toString(36).slice(2, 10); }

