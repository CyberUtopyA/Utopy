import { mtLiveUpsert } from "../mt/mt.liveStore";


function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function asArray<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

type CircularActor = {
  id?: string | null;
  name?: string | null;
};

type CircularBaseArgs = {
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  title?: string | null;
  description?: string | null;
  materialKey?: string | null;
  materialName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  image?: string | null;
  lat?: number | null;
  lng?: number | null;
  threadId?: string | null;
  scopes?: string[];
};

export function publishCircularDV(dv: any) {
  mtLiveUpsert(dv);

  try {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail: {
          ns: "mt",
          say: "dv.upsert",
          dv,
        },
      })
    );
  } catch {
    // noop
  }

  return dv;
}

export function makeWasteOfferDV(args: CircularBaseArgs) {
  const ts = nowIso();

  return {
    id: makeId("waste.offer"),
    kind: "waste.offer",
    attrs: {
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || args.materialName || "Oferta de residuo/material",
      description: args.description || "",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Material",
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      image: args.image || null,
      location:
        args.lat != null && args.lng != null
          ? { lat: args.lat, lng: args.lng }
          : null,
      threadId: args.threadId || null,
    },
    traits: ["mt:circular", "mt:waste", "mt:material", "mt:supply"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
    },
  };
}

export function makeUrbanMiningLotDV(args: CircularBaseArgs & {
  recoverables?: string[];
  category?: string | null;
}) {
  const ts = nowIso();

  return {
    id: makeId("urban.mining.lot"),
    kind: "urban.mining.lot",
    attrs: {
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || args.materialName || "Lote de minería urbana",
      description: args.description || "",
      materialKey: args.materialKey || "electronics.scrap",
      materialName: args.materialName || "Lote recuperable",
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      category: args.category || "electronics",
      recoverables: asArray(args.recoverables),
      image: args.image || null,
      location:
        args.lat != null && args.lng != null
          ? { lat: args.lat, lng: args.lng }
          : null,
      threadId: args.threadId || null,
    },
    traits: [
      "mt:circular",
      "mt:urban.mining",
      "mt:electronics",
      "mt:material",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
    },
  };
}

export function makeMaterialRecoveredDV(args: CircularBaseArgs & {
  sourceLotId?: string | null;
  quality?: string | null;
}) {
  const ts = nowIso();

  return {
    id: makeId("material.recovered"),
    kind: "material.recovered",
    attrs: {
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || args.materialName || "Material recuperado",
      description: args.description || "",
      materialKey: args.materialKey || "material.recovered",
      materialName: args.materialName || "Material recuperado",
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      sourceLotId: args.sourceLotId || null,
      quality: args.quality || "standard",
      image: args.image || null,
      threadId: args.threadId || null,
    },
    traits: ["mt:circular", "mt:material", "mt:recovered", "mt:supply"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
    },
  };
}

export function makeCircularDemandMaterialDV(args: CircularBaseArgs & {
  maxUnitPrice?: number | null;
}) {
  const ts = nowIso();

  return {
    id: makeId("mt:demand.material"),
    kind: "mt:demand.material",
    attrs: {
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || args.materialName || "Demanda de material",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Material",
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      maxUnitPrice:
        args.maxUnitPrice == null ? null : Number(args.maxUnitPrice),
      threadId: args.threadId || null,
    },
    traits: ["mt:circular", "mt:demand", "mt:material"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
    },
  };
}

export function makeCircularOfferDV(args: CircularBaseArgs & {
  price?: number | null;
  side?: "sell" | "buy";
}) {
  const ts = nowIso();

  return {
    id: makeId("mt:offer"),
    kind: "mt:offer",
    attrs: {
      side: args.side || "sell",
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      sellerId: args.actorId || null,
      sellerName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || args.materialName || "Oferta circular",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Material",
      productoId: args.materialKey || "material.unknown",
      cantidad: Number(args.quantity || 0),
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      precio: args.price == null ? 0 : Number(args.price),
      price: args.price == null ? 0 : Number(args.price),
      image: args.image || null,
      threadId: args.threadId || null,
      tipo: args.side === "buy" ? "compra" : "venta",
    },
    traits: ["mt:circular", "mt:supply", "mt:material"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
    },
  };
}

export function makeCircularWorkIntentDV(args: CircularBaseArgs & {
  domain?:
    | "circular.pickup"
    | "circular.sort"
    | "circular.repair"
    | "circular.reuse"
    | "circular.fabrication"
    | "circular.transport"
    | "urban.mining";
  workId?: string | null;
  chainId?: string | null;
}) {
  const ts = nowIso();
  const domain = args.domain || "circular.pickup";
  const workId = args.workId || makeId("work");

  return {
    id: makeId("work.intent"),
    kind: "work.intent",
    attrs: {
      workId,
      chainId: args.chainId || null,
      title: args.title || `Trabajo ${domain}`,
      description: args.description || "",
      domain,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      materialKey: args.materialKey || null,
      materialName: args.materialName || null,
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      threadId: args.threadId || null,
      status: "open",
    },
    traits: ["mt:work", "mt:circular", domain],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      chainId: args.chainId || null,
    },
  };
}