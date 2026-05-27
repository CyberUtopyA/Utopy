// src/mt/mt.ingest.ts
// Ingesta genérica de datos crudos → DatoVivoBase → mt.liveStore

import { mtLiveUpsert } from "./mt.liveStore";
import { DatoVivoBase } from "./normalizer";

/**
 * Opciones de ingesta:
 * - ns: meta.ns destino
 * - scopes: etiquetas de alcance (ej: ["mt:ms-candy"])
 * - source: texto libre para saber de dónde vino (ej: "github:candyms")
 * - kind: forzar kind (si el raw no lo trae)
 * - traits: forzar traits adicionales
 */
export type IngestOpts = {
  ns?: string;
  scopes?: string[];
  source?: string;
  kind?: string;
  traits?: string[];
};

function ensureId(raw: any, fallbackKind: string): string {
  if (raw && raw.id) return String(raw.id);
  if (raw && raw._id) return String(raw._id);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${fallbackKind || "dato"}:${Date.now().toString(36)}:${rand}`;
}

function guessKind(raw: any, opts: IngestOpts): string {
  if (opts.kind) return opts.kind;
  if (typeof raw?.kind === "string") return raw.kind;

  // heurística muy simple: si tiene precio/stock => producto
  if (
    raw &&
    (raw.precio != null ||
      raw.price != null ||
      raw.stock != null ||
      raw.unidad != null ||
      raw.unit != null)
  ) {
    return "producto";
  }

  return "dato";
}

function buildTraits(raw: any, kind: string, opts: IngestOpts): string[] {
  const base = new Set<string>();

  // traits originales si vienen
  if (Array.isArray(raw?.traits)) {
    for (const t of raw.traits) base.add(String(t));
  }

  // traits forzados por opts
  if (Array.isArray(opts.traits)) {
    for (const t of opts.traits) base.add(String(t));
  }

  // si parece producto MT, marcamos mt:producto + mt:vendible
  if (kind === "producto") {
    base.add("mt:producto");
    base.add("mt:vendible");
  }

  return Array.from(base);
}

/**
 * Convierte un objeto crudo arbitrario en DatoVivoBase
 * (sin tocar nada del normalizador, sólo empaqueta).
 */
export function toDatoVivoBase(raw: any, opts: IngestOpts = {}): DatoVivoBase {
  const kind = guessKind(raw, opts);
  const id = ensureId(raw, kind);

  const attrs =
    raw && typeof raw.attrs === "object" && !Array.isArray(raw.attrs)
      ? raw.attrs
      : raw || {};

  const metaRaw =
    raw && typeof raw.meta === "object" && !Array.isArray(raw.meta)
      ? raw.meta
      : {};

  const scopesRaw: string[] = Array.isArray((metaRaw as any).scopes)
    ? (metaRaw as any).scopes.map(String)
    : [];

  const scopes = Array.from(
    new Set<string>([...scopesRaw, ...(opts.scopes ?? [])].map(String))
  );

  const meta: Record<string, any> = {
    ...metaRaw,
  };

  if (opts.ns) {
    meta.ns = opts.ns;
  } else if (!meta.ns && typeof raw.ns === "string") {
    meta.ns = raw.ns;
  }

  if (scopes.length > 0) {
    meta.scopes = scopes;
  }

  if (opts.source) {
    meta.source = opts.source;
  }

  const traits = buildTraits(raw, kind, opts);

  const dv: DatoVivoBase = {
    id,
    kind,
    attrs,
    traits,
    meta,
  };

  return dv;
}

/**
 * Ingesta de un solo item crudo → DatoVivoBase → store vivo.
 */
export function ingestOne(raw: any, opts: IngestOpts = {}): DatoVivoBase {
  const dv = toDatoVivoBase(raw, opts);
  mtLiveUpsert(dv);
  return dv;
}

/**
 * Ingesta múltiple: lista de objetos crudos → muchos DatosVivos.
 */
export function ingestMany(rawList: any[], opts: IngestOpts = {}): DatoVivoBase[] {
  if (!Array.isArray(rawList)) {
    console.warn("[mt.ingest] ingestMany recibió algo no-array:", rawList);
    return [];
  }
  const out: DatoVivoBase[] = [];
  for (const raw of rawList) {
    try {
      const dv = ingestOne(raw, opts);
      out.push(dv);
    } catch (e) {
      console.warn("[mt.ingest] no se pudo ingerir item:", raw, e);
    }
  }
  return out;
}
