// ===============================
// src/mt/mt.traitAdapter.ts
// Adaptador semántico DatoVivo → MtProduct / MtOffer (lado MS web)
// + Trust por categoría
// + Consenso por interpretación (sem.dv.answer / votes)
// + Conflictos semánticos (dos lecturas válidas) con meta.sem.candidates
// + Preserva author/contact/vendor/source/sellerId/threadId para ofertas de MO
// ===============================

import { DatoVivoBase, normalizeMtProducto, matchesScopes } from "./normalizer";

export type DatoVivo = DatoVivoBase;

export type MtIdentityAuthor = {
  id?: string;
  name?: string;
  nodeId?: string;
  wallet?: string;
  [k: string]: any;
};

export type MtIdentityContact = {
  sellerId?: string;
  sellerName?: string;
  threadId?: string;
  via?: string[];
  [k: string]: any;
};

export type MtIdentityVendor = {
  id?: string;
  name?: string;
  [k: string]: any;
};

export type MtIdentitySource = {
  node?: string;
  sceneId?: string;
  quoteId?: string;
  renderId?: string;
  [k: string]: any;
};

export type MtProduct = {
  id: string;
  nombre: string;
  imagen?: string;
  precio?: number;
  unidad?: string;
  stock?: number;
  productor?: { id: string; nombre: string };
  tags?: string[];

  attrs?: Record<string, any>;

  author?: MtIdentityAuthor | null;
  contact?: MtIdentityContact | null;
  vendor?: MtIdentityVendor | null;
  source?: MtIdentitySource | null;

  sellerId?: string;
  sellerName?: string;
  threadId?: string;

  meta?: {
    ns?: string;
    token?: {
      address: `0x${string}`;
      decimals: number;
      symbol?: string;
    };
    scopes?: string[];

    cat?: string;
    categorias?: string[];

    sem?: {
      chosen?: SemInterpretation;
      candidates?: SemInterpretation[];
      conflict?: boolean;
      conflictReason?: string;
      votes?: SemVote[];
      trust?: Record<string, number>;
    };

    [k: string]: any;
  };
};

export type MtOffer = {
  id: string;
  productoId: string;

  tipo: "venta" | "compra";

  cantidad: number;
  imagen?: string;
  attrs?: Record<string, any>;
  title?: string;
  precio: number;

  productor?: { id: string; nombre: string };
  vigencia?: { desde?: string; hasta?: string };

  author?: MtIdentityAuthor | null;
  contact?: MtIdentityContact | null;
  vendor?: MtIdentityVendor | null;
  source?: MtIdentitySource | null;

  sellerId?: string;
  sellerName?: string;
  threadId?: string;

  imageUrl?: string;
  imageDataUrl?: string;

  meta?: Record<string, any>;
};

type AdaptOptions = {
  scopes?: string[];
  trustByCat?: Record<string, Record<string, number>>;
  consensus?: { topK?: number; epsilon?: number };
};

export type SemVote = {
  nodeId: string;
  confidence: number;
  ts?: string;
  interp?: Partial<SemInterpretation>;
};

export type SemInterpretation = {
  cat?: string;
  categorias?: string[];
  name?: string;
  imageUrl?: string;
  unit?: string;
  price?: number;
  source?: string;
  confidence?: number;
  score?: number;
  ts?: string;
};

function safeStr(x: any): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function slugify32(raw: string): string {
  const txt = safeStr(raw).trim().toLowerCase();
  const slug =
    txt
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "custom";
  return slug;
}

function normalizeImageSrc(x: any, mime = "image/png"): string | undefined {
  if (!x || typeof x !== "string") return undefined;

  const v = x.trim();
  if (!v) return undefined;

  if (
    v.startsWith("data:image/") ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("blob:")
  ) {
    return v;
  }

  const looksBase64 =
    /^[A-Za-z0-9+/=\s]+$/.test(v) &&
    !v.includes("{") &&
    !v.includes("}");

  if (looksBase64) {
    return `data:${mime};base64,${v.replace(/\s+/g, "")}`;
  }

  return v;
}

function clamp01(n: any): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function uniqStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.map((x) => safeStr(x).trim()).filter(Boolean)));
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return undefined;
  }
}

export function normalizeCategoryToken(raw: string): string | undefined {
  const txt = safeStr(raw).trim().toLowerCase();
  if (!txt) return undefined;

  if (txt.startsWith("mt:cat.")) return txt;
  if (txt.startsWith("cat.")) return `mt:cat.${txt.slice(4)}`;

  if (txt === "muebles" || txt === "mueble") return "mt:cat.muebles";
  if (txt === "dulces" || txt === "dulce") return "mt:cat.dulces";
  if (txt === "bebidas" || txt === "bebida") return "mt:cat.bebidas";
  if (txt === "frutas" || txt === "fruta") return "mt:cat.frutas";
  if (txt === "verduras" || txt === "verdura") return "mt:cat.verduras";
  if (txt === "servicios" || txt === "servicio") return "mt:cat.servicios";
  if (txt === "energia" || txt === "energía") return "mt:cat.energia";

  const t = txt;

  if (
    /mueble|sof[aá]|sill[oó]n|silla|mesa|rack|closet|armario|estante|ropero|furniture|wardrobe|cabinet/.test(
      t
    )
  )
    return "mt:cat.muebles";

  if (
    /dulce|golosina|gomita|gominola|caramelo|chicle|candy|sweet|dulcer[ií]a/.test(
      t
    )
  )
    return "mt:cat.dulces";

  if (/bebida|jugo|suco|gaseosa|refresco|agua|mineral|drink|juice|soda/.test(t))
    return "mt:cat.bebidas";

  if (/fruta|banana|banano|manzana|pera|mango|naranja|uva|fruit/.test(t))
    return "mt:cat.frutas";

  if (
    /verdura|tomate|lechuga|zanahoria|br[oó]coli|brocoli|cebolla|papa|vegetable|legume/.test(
      t
    )
  )
    return "mt:cat.verduras";

  if (
    /solar|energ[ií]a|panel|inversor|bater[ií]a|kwh?|fotovoltaic|photovoltaic/.test(
      t
    )
  )
    return "mt:cat.energia";

  if (
    /servicio|service|instalaci[oó]n|instala[cç][aã]o|mantenimiento|manuten[cç][aã]o|consultor[ií]a|reparaci[oó]n|repair/.test(
      t
    )
  )
    return "mt:cat.servicios";

  return `mt:cat.${slugify32(t)}`;
}

function extractCatsFromTraits(traits: string[]): string[] {
  const out: string[] = [];
  for (const t of traits) {
    if (typeof t !== "string") continue;
    if (t.startsWith("mt:cat.")) out.push(t);
    else if (t.startsWith("mt:categoria."))
      out.push(`mt:cat.${t.slice("mt:categoria.".length)}`);
  }
  return out;
}

function getTrustFor(
  cat: string | undefined,
  nodeId: string,
  meta: any,
  opts: AdaptOptions
): number {
  const c = cat ? normalizeCategoryToken(cat) : undefined;

  const semTrust = meta?.sem?.trust;
  if (semTrust && typeof semTrust === "object") {
    if (c && typeof semTrust[`${c}|${nodeId}`] === "number")
      return clamp01(semTrust[`${c}|${nodeId}`]);
    if (c && typeof semTrust[`${c}|*`] === "number")
      return clamp01(semTrust[`${c}|*`]);
    if (typeof semTrust[`*|${nodeId}`] === "number")
      return clamp01(semTrust[`*|${nodeId}`]);
    if (typeof semTrust[`*|*`] === "number") return clamp01(semTrust[`*|*`]);
  }

  const local = opts.trustByCat || {};
  if (c && local[c]) {
    const map = local[c];
    if (typeof map[nodeId] === "number") return clamp01(map[nodeId]);
    if (typeof map["*"] === "number") return clamp01(map["*"]);
  }

  return 0.55;
}

function buildInterpretationCandidates(
  d: DatoVivo,
  norm: any,
  opts: AdaptOptions
): SemInterpretation[] {
  const meta = (d.meta || {}) as any;
  const traits: string[] = Array.isArray(d.traits) ? d.traits : [];

  const out: SemInterpretation[] = [];

  const sem = meta.sem || {};
  if (sem && typeof sem === "object") {
    if (sem.chosen && typeof sem.chosen === "object") {
      out.push({
        ...sem.chosen,
        source: sem.chosen.source || "micelio",
        confidence: clamp01(sem.chosen.confidence ?? 0.85),
        ts: sem.chosen.ts || nowIso(),
      });
    }
    if (Array.isArray(sem.candidates)) {
      for (const c of sem.candidates) {
        if (!c || typeof c !== "object") continue;
        out.push({
          ...c,
          source: c.source || "micelio",
          confidence: clamp01(c.confidence ?? 0.7),
          ts: c.ts || nowIso(),
        });
      }
    }
  }

  const votesRaw: any[] = Array.isArray(meta.votes)
    ? meta.votes
    : Array.isArray(meta.sem?.votes)
    ? meta.sem.votes
    : [];

  for (const v of votesRaw) {
    if (!v || typeof v !== "object") continue;
    const nodeId = safeStr(v.nodeId || v.by || v.node || v.from);
    const conf = clamp01(v.confidence ?? v.conf ?? 0.6);
    const interp = v.interp && typeof v.interp === "object" ? v.interp : {};

    const cat = interp.cat ?? v.cat ?? v.categoria ?? v.category;
    const categorias = interp.categorias ?? v.categorias ?? v.categories;

    if (!cat && !categorias) continue;

    out.push({
      cat: cat ? normalizeCategoryToken(cat) : undefined,
      categorias: Array.isArray(categorias)
        ? uniqStrings(categorias)
            .map((c) => normalizeCategoryToken(c)!)
            .filter(Boolean)
        : cat
        ? [normalizeCategoryToken(cat)!].filter(Boolean)
        : undefined,
      source: nodeId || "vote",
      confidence: conf,
      ts: safeStr(v.ts) || nowIso(),
    });
  }

  const h = inferCategoriasForDato(d, norm);
  if (h.cat || (h.categorias && h.categorias.length > 0)) {
    out.push({
      cat: h.cat,
      categorias: h.categorias,
      source: "heuristic",
      confidence: 0.55,
      ts: nowIso(),
    });
  }

  const explicitRaw: string[] = [];
  if (typeof meta.cat === "string") explicitRaw.push(meta.cat);
  if (typeof meta.categoria === "string") explicitRaw.push(meta.categoria);
  if (typeof meta.category === "string") explicitRaw.push(meta.category);
  if (Array.isArray(meta.categorias)) explicitRaw.push(...meta.categorias.map(safeStr));
  if (Array.isArray(meta.categories)) explicitRaw.push(...meta.categories.map(safeStr));
  explicitRaw.push(...extractCatsFromTraits(traits));
  if (norm && typeof norm.cat === "string") explicitRaw.push(norm.cat);
  if (norm && Array.isArray(norm.categorias)) explicitRaw.push(...norm.categorias.map(safeStr));

  const explicitCats = uniqStrings(explicitRaw)
    .map((c) => normalizeCategoryToken(c))
    .filter((c): c is string => !!c);

  if (explicitCats.length > 0) {
    out.push({
      cat: explicitCats[0],
      categorias: uniqStrings(explicitCats),
      source: "explicit",
      confidence: 0.9,
      ts: nowIso(),
    });
  }

  const seen = new Set<string>();
  const cleaned: SemInterpretation[] = [];
  for (const c of out) {
    const key = `${safeStr(c.cat)}|${safeStr(c.source)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(c);
  }

  return cleaned;
}

function scoreCandidate(
  cand: SemInterpretation,
  meta: any,
  opts: AdaptOptions
): number {
  const source = safeStr(cand.source || "");
  const nodeId =
    source && source !== "heuristic" && source !== "explicit" ? source : "*";
  const cat = cand.cat ? normalizeCategoryToken(cand.cat) : undefined;

  const trust = getTrustFor(cat, nodeId, meta, opts);
  const conf = clamp01(cand.confidence ?? 0.5);
  return conf * trust;
}

function pickConsensus(
  candidates: SemInterpretation[],
  meta: any,
  opts: AdaptOptions
): {
  chosen?: SemInterpretation;
  top: SemInterpretation[];
  conflict: boolean;
  reason?: string;
} {
  const topK = opts.consensus?.topK ?? 2;
  const epsilon = opts.consensus?.epsilon ?? 0.08;

  const scored = candidates
    .map((c) => {
      const score = scoreCandidate(c, meta, opts);
      return { ...c, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const top = scored.slice(0, Math.max(1, topK));
  const chosen = top[0];

  const conflict =
    top.length >= 2 &&
    typeof top[0]?.score === "number" &&
    typeof top[1]?.score === "number" &&
    top[0].score - top[1].score <= epsilon;

  const reason = conflict
    ? `score cercano: ${Number(top[0].score).toFixed(3)} vs ${Number(
        top[1].score
      ).toFixed(3)}`
    : undefined;

  return { chosen, top, conflict, reason };
}

export function inferCategoriasForDato(
  d: DatoVivo,
  norm?: any
): { cat?: string; categorias?: string[] } {
  const meta = (d.meta || {}) as any;
  const attrs = (d.attrs || {}) as any;
  const traits: string[] = Array.isArray(d.traits) ? d.traits : [];

  const explicitRaw: string[] = [];

  if (meta?.sem?.chosen?.cat) explicitRaw.push(meta.sem.chosen.cat);
  if (Array.isArray(meta?.sem?.chosen?.categorias))
    explicitRaw.push(...meta.sem.chosen.categorias.map(safeStr));

  if (typeof meta.cat === "string") explicitRaw.push(meta.cat);
  if (typeof meta.categoria === "string") explicitRaw.push(meta.categoria);
  if (typeof meta.category === "string") explicitRaw.push(meta.category);

  if (Array.isArray(meta.categorias)) explicitRaw.push(...meta.categorias.map(safeStr));
  if (Array.isArray(meta.categories)) explicitRaw.push(...meta.categories.map(safeStr));

  explicitRaw.push(...extractCatsFromTraits(traits));

  if (norm && typeof norm.cat === "string") explicitRaw.push(norm.cat);
  if (norm && Array.isArray(norm.categorias)) explicitRaw.push(...norm.categorias.map(safeStr));

  const explicitCats = uniqStrings(explicitRaw)
    .map((c) => normalizeCategoryToken(c))
    .filter((c): c is string => !!c);

  if (explicitCats.length > 0) {
    const uniq = uniqStrings(explicitCats);
    return { cat: uniq[0], categorias: uniq };
  }

  const tagsAttr: string[] = Array.isArray(attrs.tags) ? attrs.tags.map(safeStr) : [];
  const tagsMeta: string[] = Array.isArray(meta.tags) ? meta.tags.map(safeStr) : [];

  const pool: string[] = [];
  if (norm?.name) pool.push(safeStr(norm.name));
  if (meta?.name) pool.push(safeStr(meta.name));
  if (attrs?.nombre) pool.push(safeStr(attrs.nombre));
  if (attrs?.name) pool.push(safeStr(attrs.name));
  if (attrs?.descripcion) pool.push(safeStr(attrs.descripcion));
  if (attrs?.description) pool.push(safeStr(attrs.description));
  pool.push(...tagsAttr, ...tagsMeta);

  pool.push(
    ...traits.filter(
      (t) =>
        typeof t === "string" &&
        !t.startsWith("mt:cat.") &&
        !t.startsWith("mt:categoria.")
    )
  );

  const text = pool.join(" ").toLowerCase();
  const guessed = normalizeCategoryToken(text);
  if (!guessed) return {};

  return { cat: guessed, categorias: [guessed] };
}

function extractSemanticIdentity(a: any, meta: any) {
  const author = (a?.author || meta?.author || null) as MtIdentityAuthor | null;
  const contact = (a?.contact || meta?.contact || null) as MtIdentityContact | null;
  const vendor = (a?.vendor || meta?.vendor || null) as MtIdentityVendor | null;
  const source = (a?.source || meta?.source || null) as MtIdentitySource | null;

  const sellerId =
    safeStr(
      contact?.sellerId ||
        author?.id ||
        vendor?.id ||
        a?.sellerId ||
        meta?.sellerId ||
        ""
    ) || undefined;

  const sellerName =
    safeStr(
      contact?.sellerName ||
        author?.name ||
        vendor?.name ||
        a?.sellerName ||
        meta?.sellerName ||
        ""
    ) || undefined;

  const threadId =
    safeStr(contact?.threadId || a?.threadId || meta?.threadId || "") || undefined;

  return {
    author,
    contact,
    vendor,
    source,
    sellerId,
    sellerName,
    threadId,
  };
}

export function adaptDatosToMtProducts(
  datos: DatoVivo[],
  opts: AdaptOptions = {}
): MtProduct[] {
  const scopes = opts.scopes ?? [];

  return datos
    .filter((d) => {
      const k = safeStr(d.kind);
      if (
        !(
          k === "producto" ||
          k === "mt:product" ||
          k === "mt:producto" ||
          k.startsWith("mt:producto")
        )
      )
        return false;

      if (!Array.isArray(d.traits)) return false;

      const hasProductoTrait =
        d.traits.includes("mt:producto") ||
        d.traits.includes("mt:product") ||
        d.traits.includes("mt:market.product") ||
        d.traits.includes("mo:product");

      const hasVendibleTrait =
        d.traits.includes("mt:vendible") ||
        d.traits.includes("mt:market.product") ||
        d.traits.includes("mo:product");

      if (!hasProductoTrait) return false;
      if (!hasVendibleTrait) return false;

      return matchesScopes(d, scopes);
    })
    .map((d) => {
      const norm = normalizeMtProducto(d) as any;
      if (!norm) return null;

      const a = (d.attrs || {}) as any;
      const meta = (d.meta || {}) as any;
      const tokenMeta = meta.token || meta.tokenMeta || undefined;

      let productor: MtProduct["productor"] | undefined;
      const prodRaw = a.productor ?? meta.productor ?? meta.producer;
      if (prodRaw) {
        if (typeof prodRaw === "object") {
          productor = {
            id: safeStr(prodRaw.id ?? prodRaw._id ?? prodRaw),
            nombre: safeStr(prodRaw.nombre ?? prodRaw.name ?? "Productor"),
          };
        } else {
          productor = { id: safeStr(prodRaw), nombre: "Productor" };
        }
      }

      const tags: string[] = Array.isArray(a.tags)
        ? a.tags.map(safeStr)
        : Array.isArray(meta.tags)
        ? meta.tags.map(safeStr)
        : [];

      const candidates = buildInterpretationCandidates(d, norm, opts);
      const consensus = pickConsensus(candidates, meta, opts);

      const chosenCat = consensus.chosen?.cat
        ? normalizeCategoryToken(consensus.chosen.cat)
        : undefined;

      const chosenCats = consensus.chosen?.categorias
        ? uniqStrings(consensus.chosen.categorias)
            .map((c) => normalizeCategoryToken(c)!)
            .filter(Boolean)
        : chosenCat
        ? [chosenCat]
        : undefined;

      const rawFinalCat = (meta.cat ?? norm.cat ?? chosenCat) as string | undefined;
      const rawFinalCategorias = (meta.categorias ??
        norm.categorias ??
        chosenCats) as string[] | undefined;

      const categoriasNorm = rawFinalCategorias
        ? uniqStrings(rawFinalCategorias)
            .map((c) => normalizeCategoryToken(c)!)
            .filter(Boolean)
        : rawFinalCat
        ? [normalizeCategoryToken(rawFinalCat)!].filter(Boolean)
        : undefined;

      const catNorm = rawFinalCat
        ? normalizeCategoryToken(rawFinalCat)
        : categoriasNorm?.[0];

      const semOut = {
        ...(meta.sem || {}),
        chosen: consensus.chosen,
        candidates: consensus.top,
        conflict: consensus.conflict,
        conflictReason: consensus.reason,
      };

      const identity = extractSemanticIdentity(a, meta);

      return {
        id: norm.id,
        nombre: norm.name,
        imagen: norm.imageUrl,
        precio: norm.price,
        unidad: norm.unit,
        stock: norm.stock,
        productor,
        tags,
        attrs: {
          ...a,
          author: identity.author,
          contact: identity.contact,
          vendor: identity.vendor,
          source: identity.source,
          sellerId: identity.sellerId,
          sellerName: identity.sellerName,
          threadId: identity.threadId,
        },
        author: identity.author,
        contact: identity.contact,
        vendor: identity.vendor,
        source: identity.source,
        sellerId: identity.sellerId,
        sellerName: identity.sellerName,
        threadId: identity.threadId,
        meta: {
          ...meta,
          ns: norm.ns ?? meta.ns ?? "mt:market",
          scopes: norm.scopes,
          token: tokenMeta,
          cat: catNorm,
          categorias: categoriasNorm,
          sem: semOut,
          author: identity.author,
          contact: identity.contact,
          vendor: identity.vendor,
          source: identity.source,
          sellerId: identity.sellerId,
          sellerName: identity.sellerName,
          threadId: identity.threadId,
        },
      } as MtProduct;
    })
    .filter((x): x is MtProduct => x !== null);
}

export function adaptDatosToMtOffers(
  datos: DatoVivo[],
  opts: AdaptOptions = {}
): MtOffer[] {
  return datos
    .filter((d) => {
      const traits: string[] = Array.isArray(d.traits) ? d.traits : [];
      const kind = safeStr(d.kind);

      return (
        kind === "energy.offer" ||
        kind === "energy.market_signal" ||
        kind === "mt:offer" ||
        kind === "oferta" ||
        traits.includes("mt:offer") ||
        traits.includes("mt:market.offer") ||
        traits.includes("mt:energy.offer") ||
        traits.includes("ge:market.signal")
      );
    })
    .map((d) => {
      const traits: string[] = Array.isArray(d.traits) ? d.traits : [];
      const kind = safeStr(d.kind);

      const a = (d.attrs || {}) as any;
      const meta = (d.meta || {}) as Record<string, any>;

      const productoIdHint = safeStr(
        a.productoId ?? a.productId ?? meta.productoId ?? meta.productId ?? ""
      );
      const unitHint = safeStr(
        a.unit ?? meta.unit ?? a.unidad ?? meta.unidad
      ).toLowerCase();

      const hasKwh =
        a.amount_kwh != null ||
        a.kwh != null ||
        a.amount?.kwh != null ||
        meta.amount_kwh != null ||
        meta.kwh != null ||
        meta.amount?.kwh != null;

      const hasPricePerKwh =
        a.price_per_kwh != null ||
        meta.price_per_kwh != null ||
        a.price_hint != null ||
        meta.price_hint != null;

      const isEnergy =
        kind === "energy.offer" ||
        traits.includes("mt:energy.offer") ||
        productoIdHint === "energy:kwh" ||
        unitHint === "kwh" ||
        (hasKwh && hasPricePerKwh);

      if (isEnergy) {
        const cantidad = Number(
          a.amount_kwh ??
            a.kwh ??
            a.amount?.kwh ??
            meta.amount_kwh ??
            meta.kwh ??
            meta.amount?.kwh ??
            0
        );

        const precio = Number(
          a.price_per_kwh ??
            meta.price_per_kwh ??
            a.price ??
            meta.price ??
            a.price_hint ??
            meta.price_hint ??
            0
        );

        const side = safeStr(a.kind ?? a.side ?? meta.kind ?? meta.side).toLowerCase();
        const tipo: "venta" | "compra" = side === "buy" ? "compra" : "venta";

        const actor =
          a.seller ??
          meta.seller ??
          a.productor ??
          meta.productor ??
          a.buyer ??
          meta.buyer;

        const productor =
          actor == null
            ? undefined
            : typeof actor === "object"
            ? {
                id: safeStr(actor.id ?? actor._id ?? actor),
                nombre: safeStr(actor.nombre ?? actor.name ?? actor.id ?? "Actor"),
              }
            : { id: safeStr(actor), nombre: safeStr(actor) };

        const productoId = "energy:kwh";
        const identity = extractSemanticIdentity(a, meta);

        return {
          id: safeStr(d.id),
          productoId,
          tipo,
          cantidad: Number.isFinite(cantidad) ? cantidad : 0,
          precio: Number.isFinite(precio) ? precio : 0,
          productor,
          vigencia: undefined,
          title: safeStr(a.title ?? a.nombre ?? "Energía"),
          imageUrl: undefined,
          imageDataUrl: undefined,
          attrs: {
            ...a,
            author: identity.author,
            contact: identity.contact,
            vendor: identity.vendor,
            source: identity.source,
            sellerId: identity.sellerId,
            sellerName: identity.sellerName,
            threadId: identity.threadId,
          },
          author: identity.author,
          contact: identity.contact,
          vendor: identity.vendor,
          source: identity.source,
          sellerId: identity.sellerId,
          sellerName: identity.sellerName,
          threadId: identity.threadId,
          meta: {
            ...meta,
            _kind: kind,
            _energy: true,
            unit: "kwh",
            author: identity.author,
            contact: identity.contact,
            vendor: identity.vendor,
            source: identity.source,
            sellerId: identity.sellerId,
            sellerName: identity.sellerName,
            threadId: identity.threadId,
          },
        } as MtOffer;
      }

      const productoId =
        a.productoId ??
        a.productId ??
        a.sku ??
        meta.productoId ??
        meta.productId ??
        meta.sku ??
        a.id ??
        d.id;

      const tipoRaw = safeStr(a.tipo ?? meta.tipo ?? "").toLowerCase();
      const sideRaw = safeStr(a.side ?? meta.side ?? "").toLowerCase();
      const intentRaw = safeStr(a.intent ?? meta.intent ?? "").toLowerCase();

      let tipo: "venta" | "compra" = "venta";
      if (tipoRaw === "compra" || tipoRaw === "buy") tipo = "compra";
      else if (tipoRaw === "venta" || tipoRaw === "sell") tipo = "venta";
      else if (sideRaw === "buy") tipo = "compra";
      else if (sideRaw === "sell") tipo = "venta";
      else if (
        intentRaw === "want" ||
        intentRaw === "need" ||
        intentRaw === "pedido"
      )
        tipo = "compra";

      const cantRaw =
        a.cantidad ??
        meta.cantidad ??
        a.qty ??
        meta.qty ??
        a.amount_kwh ??
        a.kwh ??
        a.amount?.kwh ??
        meta.amount_kwh ??
        meta.kwh ??
        meta.amount?.kwh ??
        0;

      const precioRaw =
        a.precio ??
        meta.precio ??
        a.price ??
        meta.price ??
        a.price_per_kwh ??
        meta.price_per_kwh ??
        a.price_hint ??
        meta.price_hint ??
        0;

      const cantidad = typeof cantRaw === "number" ? cantRaw : Number(cantRaw);
      const precio = typeof precioRaw === "number" ? precioRaw : Number(precioRaw);

      let productor: MtOffer["productor"] | undefined;
      const prodRaw =
        a.productor ?? meta.productor ?? meta.producer ?? a.buyer ?? meta.buyer;

      if (prodRaw) {
        if (typeof prodRaw === "object") {
          productor = {
            id: safeStr(prodRaw.id ?? prodRaw._id ?? prodRaw),
            nombre: safeStr(prodRaw.nombre ?? prodRaw.name ?? "Actor"),
          };
        } else {
          productor = { id: safeStr(prodRaw), nombre: "Actor" };
        }
      }

      const vigencia = a.vigencia || (meta as any).vigencia || undefined;

      const imageMime =
        a?.media?.image?.mime || a?.image?.mime || meta?.imageMime || "image/png";

      const imageUrl = normalizeImageSrc(
        a?.media?.image?.url || a?.imageUrl || meta?.imageUrl,
        imageMime
      );

      const imageDataUrl = normalizeImageSrc(
        a?.media?.image?.dataUrl || a?.imageDataUrl || meta?.imageDataUrl,
        imageMime
      );

      const title = safeStr(a?.title ?? a?.nombre ?? meta?.title ?? productoId);
      const identity = extractSemanticIdentity(a, meta);

      return {
        id: safeStr(d.id),
        productoId: safeStr(productoId),
        tipo,
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
        precio: Number.isFinite(precio) ? precio : 0,
        productor,
        vigencia,
        title,
        imageUrl,
        imageDataUrl,
        attrs: {
          ...a,
          author: identity.author,
          contact: identity.contact,
          vendor: identity.vendor,
          source: identity.source,
          sellerId: identity.sellerId,
          sellerName: identity.sellerName,
          threadId: identity.threadId,
        },
        author: identity.author,
        contact: identity.contact,
        vendor: identity.vendor,
        source: identity.source,
        sellerId: identity.sellerId,
        sellerName: identity.sellerName,
        threadId: identity.threadId,
        meta: {
          ...meta,
          author: identity.author,
          contact: identity.contact,
          vendor: identity.vendor,
          source: identity.source,
          sellerId: identity.sellerId,
          sellerName: identity.sellerName,
          threadId: identity.threadId,
        },
      } as MtOffer;
    })
    .filter((o) => Number.isFinite(o.cantidad) && o.cantidad > 0);
}

export function listCategoriasFromProducts(products: MtProduct[]): string[] {
  const cats: string[] = [];
  for (const p of products) {
    const meta = p.meta || {};
    if (meta.cat) cats.push(meta.cat);
    if (Array.isArray(meta.categorias)) cats.push(...meta.categorias);
  }
  return uniqStrings(cats)
    .map((c) => normalizeCategoryToken(c)!)
    .filter(Boolean);
}
