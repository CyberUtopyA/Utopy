// src/mt/mt.signalProtocol.ts
// Publicador universal local de MS Market.
// El contrato DV es compartido por la red; este archivo no depende de MO.

import { humanCapabilityTerms } from "./mt.threadProtocol";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

export type SignalMode = "need" | "offer";

export type SignalCategory =
  | "design"
  | "material"
  | "fabrication"
  | "repair"
  | "transport"
  | "installation"
  | "commerce"
  | "reuse"
  | "other";

export type SignalCategoryDefinition = {
  id: SignalCategory;
  emoji: string;
  label: string;
  hint: string;
  domains: string[];
  verbs: string[];
  capabilities: string[];
};

export const SIGNAL_CATEGORIES: SignalCategoryDefinition[] = [
  {
    id: "design",
    emoji: "✏️",
    label: "Crear o diseñar",
    hint: "Convertir una idea en algo realizable.",
    domains: ["design", "furniture.design", "planning"],
    verbs: ["design", "plan", "model", "quote"],
    capabilities: [
      "Diseñar objetos o muebles a medida",
      "Preparar medidas y un plan realizable",
      "Crear una propuesta y presupuesto",
    ],
  },
  {
    id: "material",
    emoji: "🪵",
    label: "Conseguir materiales",
    hint: "Madera, piezas, herramientas o insumos.",
    domains: ["materials", "material.supply", "circular.material"],
    verbs: ["supply", "sell", "recover", "deliver"],
    capabilities: [
      "Ofrecer el material solicitado",
      "Preparar, cortar o entregar materiales",
    ],
  },
  {
    id: "fabrication",
    emoji: "🏭",
    label: "Fabricar o producir",
    hint: "Construir una pieza, objeto o pequeña serie.",
    domains: ["fabrication", "production", "circular.fabrication"],
    verbs: ["fabricate", "produce", "assemble", "quote"],
    capabilities: [
      "Fabricar objetos a partir de una idea o diseño",
      "Ensamblar y terminar piezas",
      "Preparar un presupuesto de producción",
    ],
  },
  {
    id: "repair",
    emoji: "🛠️",
    label: "Reparar o adaptar",
    hint: "Recuperar, modificar o mejorar algo existente.",
    domains: ["repair", "adaptation", "circular.reuse"],
    verbs: ["repair", "adapt", "restore", "reuse"],
    capabilities: [
      "Reparar o adaptar un objeto existente",
      "Reutilizar piezas y materiales disponibles",
    ],
  },
  {
    id: "transport",
    emoji: "🚚",
    label: "Mover o entregar",
    hint: "Retiro, traslado o entrega de algo.",
    domains: ["transport", "delivery", "logistics"],
    verbs: ["pickup", "transport", "deliver"],
    capabilities: [
      "Retirar y transportar objetos o materiales",
      "Coordinar una entrega segura",
    ],
  },
  {
    id: "installation",
    emoji: "🏠",
    label: "Instalar o terminar",
    hint: "Montaje y trabajo final en el lugar.",
    domains: ["installation", "finishing", "on.site.work"],
    verbs: ["install", "mount", "finish", "measure"],
    capabilities: [
      "Medir el espacio e instalar en el lugar",
      "Montar, ajustar y terminar el trabajo",
    ],
  },
  {
    id: "commerce",
    emoji: "🛍️",
    label: "Vender u ofrecer",
    hint: "Producto, servicio, diseño o capacidad disponible.",
    domains: ["commerce", "market.offer", "services"],
    verbs: ["offer", "sell", "quote", "respond"],
    capabilities: [
      "Ofrecer un producto o servicio",
      "Responder consultas y preparar una propuesta",
    ],
  },
  {
    id: "reuse",
    emoji: "♻️",
    label: "Reutilizar o recuperar",
    hint: "Dar un nuevo uso a materiales u objetos.",
    domains: ["reuse", "recovery", "circular.reuse"],
    verbs: ["recover", "reuse", "sort", "transform"],
    capabilities: [
      "Recuperar materiales u objetos descartados",
      "Clasificar y transformar recursos disponibles",
    ],
  },
  {
    id: "other",
    emoji: "✨",
    label: "Otra necesidad",
    hint: "La red interpretará tu descripción.",
    domains: ["general", "collaboration"],
    verbs: ["respond", "collaborate", "offer"],
    capabilities: ["Comprender la necesidad y proponer una solución"],
  },
];

export type UniversalSignalInput = {
  mode: SignalMode;
  category: SignalCategory;
  title: string;
  text?: string | null;
  actorId: string;
  actorName?: string | null;
  nodeId?: string | null;
  threadId?: string | null;
  chainId?: string | null;
  rootDvId?: string | null;
  parentDvId?: string | null;
  relatedToThreadId?: string | null;
  previousChainId?: string | null;
  designId?: string | null;
  objectType?: string | null;
  image?: string | null;
  material?: string | null;
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
  budget?: number | null;
  currency?: string | null;
  location?: { lat?: number; lng?: number; lon?: number; [key: string]: any } | null;
  extraCapabilities?: string[];
  scopes?: string[];
  sourceApp?: string;
  sourceDV?: any;
  allLive?: any[];
  activeActor?: any | null;
};

export type PublishedSignal = {
  dv: any;
  threadId: string;
  chainId: string;
};

function value(input: unknown): string {
  return typeof input === "string"
    ? input.trim()
    : input == null
      ? ""
      : String(input).trim();
}

function unique(values: unknown[]): string[] {
  return Array.from(new Set(values.map(value).filter(Boolean)));
}

function id(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}:${uuid}`
    : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function categoryOf(category: SignalCategory): SignalCategoryDefinition {
  return (
    SIGNAL_CATEGORIES.find((definition) => definition.id === category) ||
    SIGNAL_CATEGORIES[SIGNAL_CATEGORIES.length - 1]
  );
}

function approximateLocation(raw: UniversalSignalInput["location"]) {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng ?? raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    precision: "approximate",
    source: raw?.source || "browser-consent",
  };
}

function sourceRelation(input: UniversalSignalInput) {
  const source = input.sourceDV || {};
  const sourceAttrs = source?.attrs || {};
  const sourceMeta = source?.meta || {};
  const threadId =
    value(input.threadId) ||
    value(sourceAttrs.threadId || sourceMeta.threadId) ||
    id("mt.thread.signal");
  const chainId =
    value(input.chainId) ||
    value(sourceAttrs.chainId || sourceMeta.chainId) ||
    threadId;
  return {
    threadId,
    chainId,
    rootDvId: input.rootDvId || sourceAttrs.rootDvId || source?.id || null,
    parentDvId: input.parentDvId || source?.id || null,
  };
}

export function buildUniversalSignalDV(input: UniversalSignalInput): any {
  const title = value(input.title);
  const description = value(input.text) || title;
  if (title.length < 3) {
    throw new Error("La señal necesita un título claro.");
  }

  const definition = categoryOf(input.category);
  const relation = sourceRelation(input);
  const signalId = id(input.mode === "offer" ? "mt.offer" : "work.intent");
  const semanticTerms = humanCapabilityTerms(
    [title, description, input.material, input.objectType, definition.label]
      .filter(Boolean)
      .join(" ")
  );
  const capabilities = unique([
    ...definition.capabilities,
    ...(input.extraCapabilities || []),
  ]);
  const resources = unique([
    value(input.material),
    value(input.objectType),
    ...semanticTerms,
  ]).slice(0, 24);
  const quantity = Math.max(0, Number(input.quantity || 0));
  const price = Math.max(0, Number(input.price || 0));
  const budget = Math.max(0, Number(input.budget || 0));
  const unit = value(input.unit) || "u";
  const currency = value(input.currency) || "PYG";
  const location = approximateLocation(input.location);
  const ts = new Date().toISOString();

  const commonAttrs = {
    signalId,
    mode: input.mode,
    category: definition.id,
    categoryLabel: definition.label,
    domain: definition.domains[0],
    title,
    name: title,
    description,
    text: description,
    actorId: input.actorId,
    actorName: input.actorName || null,
    fromActorId: input.actorId,
    fromActorName: input.actorName || null,
    nodeId: input.nodeId || null,
    participants: [input.actorId],
    ...relation,
    designId: input.designId || null,
    objectType: input.objectType || null,
    image: input.image || null,
    materialKey: input.material || null,
    materialName: input.material || null,
    quantity,
    cantidad: quantity,
    unit,
    unidad: unit,
    price,
    precio: price,
    budget,
    currency,
    requestedCapabilities: input.mode === "need" ? capabilities : [],
    providedCapabilities: input.mode === "offer" ? capabilities : [],
    semanticTerms,
    location,
    geo: location,
    map: { visible: true, precision: "approximate" },
    status: "open",
    state: "open",
    intent: {
      mode: input.mode,
      domains: definition.domains,
      verbs: definition.verbs,
      resources,
      quantity: quantity || undefined,
      unit,
    },
    security: {
      requiresConsent: true,
      automaticActions: false,
      exactAddressPublic: false,
    },
    source: {
      app: input.sourceApp || "ms:market",
      dvId: input.sourceDV?.id || null,
      kind: input.sourceDV?.kind || null,
    },
    relatedToThreadId: input.relatedToThreadId || null,
    previousChainId: input.previousChainId || null,
  };

  if (input.mode === "offer") {
    return {
      id: signalId,
      kind: "mt.offer",
      attrs: {
        ...commonAttrs,
        side: "sell",
        tipo: "venta",
        sellerId: input.actorId,
        sellerName: input.actorName || "Nodo capaz",
        productoId: input.designId || signalId,
        productId: input.designId || signalId,
        productName: title,
        nombre: title,
        stock: quantity,
        author: {
          id: input.actorId,
          name: input.actorName || "Nodo capaz",
          nodeId: input.nodeId || null,
        },
        vendor: {
          id: input.actorId,
          name: input.actorName || "Nodo capaz",
        },
        contact: {
          sellerId: input.actorId,
          sellerName: input.actorName || "Nodo capaz",
          threadId: relation.threadId,
          via: ["utopy.thread"],
        },
      },
      traits: [
        "mt:offer",
        "mt:supply",
        "mt:market",
        "mt:circular",
        "frequency:live",
        "map:visible",
        `signal:${definition.id}`,
      ],
      meta: {
        ns: "mt:market",
        ts,
        scopes: input.scopes?.length ? input.scopes : ["public"],
        ttl_ms: 1000 * 60 * 60 * 24 * 7,
        schema: "utopy.signal.offer@1",
        ...relation,
      },
      labels: [title, `${definition.emoji} ${definition.label}`],
    };
  }

  return {
    id: signalId,
    kind: "work.intent",
    attrs: {
      ...commonAttrs,
      workId: id("work"),
      requesterId: input.actorId,
      requesterName: input.actorName || null,
    },
    traits: [
      "work:intent",
      "mt:work",
      "mt:demand",
      "mt:circular",
      "resonance:intent",
      "frequency:live",
      "map:visible",
      "utopy:chain",
      `signal:${definition.id}`,
    ],
    meta: {
      ns: "work:intent",
      ts,
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 7,
      schema: "utopy.signal.intent@1",
      ...relation,
    },
    labels: [title, `${definition.emoji} ${definition.label}`],
  };
}

export async function publishUniversalSignal(
  input: UniversalSignalInput
): Promise<PublishedSignal> {
  const draft = buildUniversalSignalDV(input);
  const dv = (
    await publishAuthorizedDV({
      dv: draft,
      allLive: input.allLive,
      activeActor: input.activeActor,
      action: draft.kind,
      actingAsNodeId: input.nodeId || null,
    })
  ).dv;
  return {
    dv,
    threadId: String(dv.attrs?.threadId || ""),
    chainId: String(dv.attrs?.chainId || ""),
  };
}

export function getSignalCategory(category: SignalCategory) {
  return categoryOf(category);
}
