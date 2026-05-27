// ===============================
// src/mt/mt-normalizer.ts
// Normalizador de DatosVivos -> modelo de vista de producto MT
// + soporte opcional a meta.sem.chosen (Micelio) sin imponerlo
// ===============================

export interface DatoVivoBase {
  id: string;
  kind: string;
  traits?: string[];
  attrs?: any;
  meta?: {
    ns?: string;
    scopes?: string[] | string;
    sem?: {
      chosen?: {
        name?: string;
        imageUrl?: string;
        unit?: string;
        price?: number;
        cat?: string;
        categorias?: string[];
        [k: string]: any;
      };
      [k: string]: any;
    };
    [k: string]: any;
  };
  [k: string]: any;
}

export interface ExtraAttrView {
  key: string;
  label: string;
  value: string;
}

export interface MtProductoView {
  id: string;
  kind: "producto";

  name: string;
  brand?: string;

  unit?: string;
  price?: number;
  stock?: number;

  barcode?: string;

  imageUrl?: string;
  model3dUrl?: string;

  traits: string[];
  ns?: string;
  scopes: string[];

  extra: ExtraAttrView[];

  raw: DatoVivoBase;
}

function safeStr(x: any): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

/** Normaliza meta.scopes para siempre trabajar con array */
export function getScopesFromMeta(meta: DatoVivoBase["meta"]): string[] {
  if (!meta) return [];
  const scopes = meta.scopes;
  if (!scopes) return [];
  if (Array.isArray(scopes)) {
    return scopes.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(scopes)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chequea si un item coincide con alguno de los scopes de interés.
 * Opción B: el seed broadcasta todo, cada UI decide si lo escucha.
 */
export function matchesScopes(item: DatoVivoBase, myScopes: string[]): boolean {
  if (!myScopes || myScopes.length === 0) return true;
  const itemScopes = getScopesFromMeta(item.meta);
  if (itemScopes.length === 0) return false;
  const set = new Set(itemScopes);
  return myScopes.some((s) => set.has(s));
}

/**
 * Extrae attrs.extra en forma de [{key,label,value}]
 * asumiendo formato:
 * attrs.extra[slug] = { label, value } o directamente string
 */
export function extractExtraAttributes(attrs: any): ExtraAttrView[] {
  if (!attrs || typeof attrs !== "object") return [];
  const extra = attrs.extra;
  if (!extra || typeof extra !== "object") return [];

  const out: ExtraAttrView[] = [];
  for (const key of Object.keys(extra)) {
    const v = extra[key];
    if (v == null) continue;
    if (typeof v === "string") {
      out.push({ key, label: key, value: v });
    } else if (typeof v === "object") {
      const label = String(v.label || key);
      const value = v.value != null ? String(v.value) : "";
      if (!value) continue;
      out.push({ key, label, value });
    }
  }
  return out;
}

/**
 * Normaliza un DatoVivo "producto" a un MtProductoView.
 * Devuelve null si no parece un producto MT.
 *
 * ✅ Prioridad suave:
 * - meta.sem.chosen.* (si existe) aconseja
 * - attrs.* sigue funcionando igual
 */
export function normalizeMtProducto(raw: DatoVivoBase): MtProductoView | null {
  if (!raw || raw.kind !== "producto") return null;

  const attrs = raw.attrs || {};
  const meta = raw.meta || {};
  const sem = meta.sem?.chosen || {};

  // nombre
  const name =
    (sem.name && safeStr(sem.name).trim()) ||
    (attrs.nombre && safeStr(attrs.nombre).trim()) ||
    (attrs.name && safeStr(attrs.name).trim()) ||
    "Producto";

  const unit =
    (sem.unit && safeStr(sem.unit)) ||
    (attrs.unidad != null ? safeStr(attrs.unidad) : undefined);

  const price =
    sem.price != null && !Number.isNaN(Number(sem.price))
      ? Number(sem.price)
      : attrs.precio != null && !Number.isNaN(Number(attrs.precio))
      ? Number(attrs.precio)
      : undefined;

  const stock =
    attrs.stock != null && !Number.isNaN(Number(attrs.stock))
      ? Number(attrs.stock)
      : undefined;

  const brand =
    attrs.marca != null && safeStr(attrs.marca).trim().length > 0
      ? safeStr(attrs.marca).trim()
      : undefined;

  const barcode =
    attrs.codigoBarras != null && safeStr(attrs.codigoBarras).trim().length > 0
      ? safeStr(attrs.codigoBarras).trim()
      : undefined;
  // media (imagen + modelo 3D / AR)
  let imageUrl: string | undefined = undefined;
  let model3dUrl: string | undefined = undefined;

  const pickFirstUrl = (...vals: any[]) => {
    for (const v of vals) {
      const s = safeStr(v).trim();
      if (s) return s;
    }
    return "";
  };

  // 1) primero sem (Micelio aconseja)
  imageUrl = pickFirstUrl(sem.imageUrl);

  // 2) attrs directos (MUY común en tus DVs)
  if (!imageUrl) {
    imageUrl = pickFirstUrl(
      attrs.imageUrl,
      attrs.imagen,
      attrs.image,
      attrs.foto,
      attrs.thumbnail,
      attrs.thumb
    );
  }

  // 3) attrs.media.* (tu forma “estructurada”)
  if ((!imageUrl || !model3dUrl) && attrs.media && typeof attrs.media === "object") {
    if (!imageUrl) {
      imageUrl = pickFirstUrl(
        attrs.media.imageUrl,
        attrs.media.image,
        attrs.media.imagen,
        attrs.media.photo
      );
    }
    model3dUrl = pickFirstUrl(
      model3dUrl,
      attrs.media.model3dUrl,
      attrs.media.model3d,
      attrs.media.glb,
      attrs.media.usdz
    );
  }

  // 4) meta fallbacks (por si se guardó ahí)
  if (!imageUrl) {
    imageUrl = pickFirstUrl(
      meta.imageUrl,
      meta.imagen,
      meta.image,
      meta["mt:media.image"]
    );
  }

  // 5) normalizar “data:” / espacios
  if (imageUrl) imageUrl = imageUrl.trim();
  if (model3dUrl) model3dUrl = model3dUrl.trim();

  const traits = Array.isArray(raw.traits) ? raw.traits.map((t) => safeStr(t)) : [];
  const scopes = getScopesFromMeta(meta);
  const extra = extractExtraAttributes(attrs);

  return {
    id: raw.id,
    kind: "producto",
    name,
    brand,
    unit,
    price,
    stock,
    barcode,
    imageUrl,
    model3dUrl,
    traits,
    ns: meta.ns,
    scopes,
    extra,
    raw,
  };
}
