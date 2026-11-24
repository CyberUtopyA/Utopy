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
  lat?: number | string | null;
  lng?: number | string | null;
  threadId?: string | null;
  scopes?: string[];
  chainId?: string | null;
  rootDvId?: string | null;
  parentDvId?: string | null;
  sourceDvIds?: string[];
  stage?: string | null;
  status?: string | null;
  ownerId?: string | null;
};

type CircularGeo = {
  lat: number;
  lng: number;
};

function toCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Una única forma canónica de guardar ubicación en todos los DV circulares.
 * Se conservan campos planos y objetos geo/location para que cualquier lector
 * actual o futuro pueda entender la señal sin depender de un tipo de nodo.
 */
function circularGeo(args: CircularBaseArgs): CircularGeo | null {
  const lat = toCoordinate(args.lat);
  const lng = toCoordinate(args.lng);

  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

function circularGeoAttrs(args: CircularBaseArgs) {
  const location = circularGeo(args);

  return {
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    geo: location,
    location,
  };
}

function circularChainAttrs(args: CircularBaseArgs, fallbackStage: string) {
  return {
    chainId: args.chainId || null,
    rootDvId: args.rootDvId || null,
    parentDvId: args.parentDvId || null,
    sourceDvIds: asArray<string>(args.sourceDvIds).map(String),
    stage: args.stage || fallbackStage,
    ownerId: args.ownerId || args.actorId || null,
  };
}

function circularChainMeta(args: CircularBaseArgs, fallbackStage: string) {
  return {
    chainId: args.chainId || null,
    rootDvId: args.rootDvId || null,
    parentDvId: args.parentDvId || null,
    sourceDvIds: asArray<string>(args.sourceDvIds).map(String),
    stage: args.stage || fallbackStage,
  };
}

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
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "sale"),
      threadId: args.threadId || null,
    },
    traits: ["mt:circular", "mt:waste", "mt:material", "mt:supply"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "sale"),
    },
  };
}

export function makeUrbanMiningLotDV(
  args: CircularBaseArgs & {
    recoverables?: string[];
    category?: string | null;
  }
) {
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
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "sale"),
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
      ...circularChainMeta(args, "sale"),
    },
  };
}

export function makeMaterialRecoveredDV(
  args: CircularBaseArgs & {
    sourceLotId?: string | null;
    quality?: string | null;
  }
) {
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
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "production"),
      threadId: args.threadId || null,
    },
    traits: ["mt:circular", "mt:material", "mt:recovered", "mt:supply"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "production"),
    },
  };
}

export function makeCircularDemandMaterialDV(
  args: CircularBaseArgs & {
    maxUnitPrice?: number | null;
    recurrence?: "once" | "daily" | "weekly" | "monthly" | "on_demand";
    neededBy?: string | null;
    deliveryRequired?: boolean;
    deliveryAddress?: string | null;
  }
) {
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
      description: args.description || "",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Material",
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      maxUnitPrice:
        args.maxUnitPrice == null ? null : Number(args.maxUnitPrice),
      recurrence: args.recurrence || "once",
      recurring: Boolean(args.recurrence && args.recurrence !== "once"),
      neededBy: args.neededBy || null,
      deliveryRequired: Boolean(args.deliveryRequired),
      deliveryAddress: args.deliveryAddress || null,
      image: args.image || null,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "material_demand"),
      threadId: args.threadId || null,
      status: args.status || "open",
    },
    traits: [
      "mt:circular",
      "mt:demand",
      "mt:material",
      ...(args.recurrence && args.recurrence !== "once"
        ? ["mt:recurring-demand"]
        : []),
      ...(args.deliveryRequired ? ["mt:delivery-required"] : []),
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "material_demand"),
    },
  };
}

export function makeCircularOfferDV(
  args: CircularBaseArgs & {
    price?: number | null;
    side?: "sell" | "buy";
  }
) {
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
      description: args.description || "",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Material",
      productoId: args.materialKey || "material.unknown",
      cantidad: Number(args.quantity || 0),
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      precio: args.price == null ? 0 : Number(args.price),
      price: args.price == null ? 0 : Number(args.price),
      image: args.image || null,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "sale"),
      threadId: args.threadId || null,
      tipo: args.side === "buy" ? "compra" : "venta",
      status: args.status || "open",
    },
    traits: ["mt:circular", "mt:supply", "mt:material"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "sale"),
    },
  };
}

export function makeCircularDesignDV(
  args: CircularBaseArgs & {
    designId?: string | null;
    budget?: number | null;
    currency?: string | null;
    specifications?: Record<string, any>;
    capabilities?: string[];
  }
) {
  const ts = nowIso();
  const designId = args.designId || makeId("design");

  return {
    id: designId,
    kind: "design.spec",
    attrs: {
      designId,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title: args.title || "Diseño circular",
      description: args.description || "",
      materialKey: args.materialKey || null,
      materialName: args.materialName || null,
      quantity: Number(args.quantity || 1),
      unit: args.unit || "proyecto",
      budget: args.budget == null ? null : Number(args.budget),
      currency: args.currency || "PYG",
      specifications: args.specifications || {},
      capabilities: asArray<string>(args.capabilities).map(String),
      image: args.image || null,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "design"),
      threadId: args.threadId || null,
      status: args.status || "open",
    },
    traits: ["mt:circular", "mt:design", "mt:spec", "sem:lineage"],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "design"),
    },
  };
}

export function makeCircularProductDV(
  args: CircularBaseArgs & {
    productId?: string | null;
    price?: number | null;
    stock?: number | null;
    capabilities?: string[];
  }
) {
  const ts = nowIso();
  const productId = args.productId || makeId("mt.product");
  const quantity = Number(args.stock ?? args.quantity ?? 1);
  const price = args.price == null ? 0 : Number(args.price);
  const title = args.title || args.materialName || "Producto circular";

  return {
    id: productId,
    kind: "mt.product",
    attrs: {
      productId,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      sellerId: args.actorId || null,
      sellerName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title,
      nombre: title,
      description: args.description || "",
      materialKey: args.materialKey || "product.circular",
      materialName: args.materialName || title,
      quantity,
      stock: quantity,
      unit: args.unit || "u",
      unidad: args.unit || "u",
      price,
      precio: price,
      image: args.image || null,
      imagen: args.image || null,
      capabilities: asArray<string>(args.capabilities).map(String),
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "production"),
      threadId: args.threadId || null,
      status: args.status || "available",
    },
    traits: [
      "mt:circular",
      "mt:producto",
      "mt:vendible",
      "mt:production",
      "sem:lineage",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "production"),
    },
  };
}

export function makeCircularWorkIntentDV(
  args: CircularBaseArgs & {
    domain?: string;
    workId?: string | null;
  }
) {
  const ts = nowIso();
  const domain = args.domain || "circular.pickup";
  const workId = args.workId || makeId("work");

  return {
    id: makeId("work.intent"),
    kind: "work.intent",
    attrs: {
      workId,
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
      image: args.image || null,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(
        args,
        /design|diseñ/i.test(domain) ? "need" : "fabrication"
      ),
      threadId: args.threadId || null,
      status: args.status || "open",
    },
    traits: ["mt:work", "mt:circular", domain],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(
        args,
        /design|diseñ/i.test(domain) ? "need" : "fabrication"
      ),
    },
  };
}

export function makeCircularSupplyOfferDV(
  args: CircularBaseArgs & {
    demandId: string;
    unitPrice?: number | null;
    currency?: string | null;
    availability?: string | null;
    deliveryIncluded?: boolean;
    etaText?: string | null;
  }
) {
  const ts = nowIso();
  const quantity = Number(args.quantity || 0);
  const unitPrice = Number(args.unitPrice || 0);

  return {
    id: makeId("mt.offer.supply"),
    kind: "mt:offer",
    attrs: {
      side: "sell",
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      sellerId: args.actorId || null,
      sellerName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      title:
        args.title ||
        `Puedo ofrecer ${args.materialName || "el insumo solicitado"}`,
      description: args.description || "",
      materialKey: args.materialKey || "material.unknown",
      materialName: args.materialName || "Insumo",
      quantity,
      cantidad: quantity,
      unit: args.unit || "u",
      unidad: args.unit || "u",
      unitPrice,
      price: unitPrice,
      precio: unitPrice,
      total: quantity > 0 && unitPrice > 0 ? quantity * unitPrice : null,
      currency: args.currency || "PYG",
      availability: args.availability || "available",
      deliveryIncluded: Boolean(args.deliveryIncluded),
      etaText: args.etaText || null,
      respondsTo: args.demandId,
      target: { kind: "mt:demand.material", id: args.demandId },
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "supply_offer"),
      threadId: args.threadId || null,
      status: args.status || "open",
    },
    traits: [
      "mt:circular",
      "mt:supply",
      "mt:material",
      "mt:offer:response",
      ...(args.deliveryIncluded ? ["mt:delivery-included"] : []),
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      respondsTo: args.demandId,
      ...circularChainMeta(args, "supply_offer"),
    },
  };
}

export function makeCircularSupplyAgreementDV(
  args: CircularBaseArgs & {
    demandId: string;
    offerId: string;
    supplierId?: string | null;
    supplierName?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    amount?: number | null;
    currency?: string | null;
  }
) {
  const ts = nowIso();

  return {
    id: makeId("supply.agreement"),
    kind: "supply.agreement",
    attrs: {
      demandId: args.demandId,
      offerId: args.offerId,
      supplierId: args.supplierId || null,
      supplierName: args.supplierName || null,
      buyerId: args.buyerId || args.actorId || null,
      buyerName: args.buyerName || args.actorName || null,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      materialKey: args.materialKey || null,
      materialName: args.materialName || null,
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      amount: args.amount == null ? null : Number(args.amount),
      currency: args.currency || "PYG",
      confirmationRequired: true,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "supply_agreement"),
      threadId: args.threadId || null,
      status: "accepted",
    },
    traits: [
      "mt:circular",
      "mt:supply:agreement",
      "mt:consent",
      "sem:lineage",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["participants"],
      threadId: args.threadId || null,
      respondsTo: args.offerId,
      ...circularChainMeta(args, "supply_agreement"),
    },
  };
}

export function makeCircularDeliveryIntentDV(
  args: CircularBaseArgs & {
    orderId?: string | null;
    sourceDemandId?: string | null;
    pickupLabel?: string | null;
    dropoffLabel?: string | null;
    packageSummary?: string | null;
    budget?: number | null;
    currency?: string | null;
  }
) {
  const ts = nowIso();
  const workId = makeId("delivery.work");

  return {
    id: makeId("work.intent.delivery"),
    kind: "work.intent",
    attrs: {
      workId,
      orderId: args.orderId || null,
      sourceDemandId: args.sourceDemandId || null,
      title: args.title || "Necesito una entrega",
      description: args.description || "",
      domain: "logistics.delivery",
      requestedCapabilities: [
        "transport",
        "pickup",
        "deliver",
        "live-tracking",
      ],
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      nodeId: args.nodeId || null,
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      pickupLabel: args.pickupLabel || null,
      dropoffLabel: args.dropoffLabel || null,
      packageSummary:
        args.packageSummary || args.materialName || "Pedido para entregar",
      materialKey: args.materialKey || null,
      materialName: args.materialName || null,
      quantity: Number(args.quantity || 0),
      unit: args.unit || "u",
      budget: args.budget == null ? null : Number(args.budget),
      currency: args.currency || "PYG",
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "delivery_requested"),
      threadId: args.threadId || null,
      status: args.status || "open",
    },
    traits: [
      "mt:work",
      "mt:circular",
      "logistics.delivery",
      "falcon:delivery",
      "resonance:need",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      ...circularChainMeta(args, "delivery_requested"),
    },
  };
}

export function makeCircularDeliveryOfferDV(
  args: CircularBaseArgs & {
    deliveryIntentId: string;
    fee?: number | null;
    currency?: string | null;
    etaMinutes?: number | null;
    serviceRadiusKm?: number | null;
  }
) {
  const ts = nowIso();
  const providerId = args.nodeId || args.actorId;
  if (!providerId) {
    throw new Error("La oferta de entrega necesita una identidad verificable.");
  }

  return {
    id: makeId("capability.offer.delivery"),
    kind: "capability.offer",
    attrs: {
      node: {
        id: providerId,
        name: args.actorName || "Nodo disponible",
      },
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      title: args.title || "Puedo realizar esta entrega",
      description: args.description || "",
      capabilities: [
        {
          id: `cap:delivery:${providerId}`,
          domains: ["logistics.delivery"],
          verbs: ["pickup", "transport", "deliver", "track"],
          resources: ["pedido", "paquete", "insumo"],
          serviceRadiusKm: Number(args.serviceRadiusKm || 15),
        },
      ],
      delivery: {
        intentId: args.deliveryIntentId,
        fee: Number(args.fee || 0),
        currency: args.currency || "PYG",
        etaMinutes:
          args.etaMinutes == null ? null : Number(args.etaMinutes),
      },
      respondsTo: args.deliveryIntentId,
      target: { kind: "work.intent", id: args.deliveryIntentId },
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "delivery_offer"),
      threadId: args.threadId || null,
      status: "open",
    },
    traits: [
      "capability:offer",
      "mt:circular",
      "logistics.delivery",
      "falcon:available",
      "resonance:capability",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["public"],
      threadId: args.threadId || null,
      respondsTo: args.deliveryIntentId,
      ttl_ms: 30 * 60_000,
      ...circularChainMeta(args, "delivery_offer"),
    },
  };
}

export function makeCircularDeliveryAssignmentDV(
  args: CircularBaseArgs & {
    deliveryIntentId: string;
    deliveryOfferId: string;
    providerId: string;
    providerName?: string | null;
    customerId?: string | null;
    fee?: number | null;
    currency?: string | null;
  }
) {
  const ts = nowIso();

  return {
    id: makeId("delivery.assignment"),
    kind: "delivery.assignment",
    attrs: {
      deliveryIntentId: args.deliveryIntentId,
      deliveryOfferId: args.deliveryOfferId,
      providerId: args.providerId,
      providerName: args.providerName || null,
      customerId: args.customerId || args.actorId || null,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      fee: Number(args.fee || 0),
      currency: args.currency || "PYG",
      confirmationRequired: true,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, "delivery_assigned"),
      threadId: args.threadId || null,
      state: "assigned",
      progress: 20,
    },
    traits: [
      "mt:circular",
      "falcon:delivery",
      "delivery:assignment",
      "mt:consent",
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["participants"],
      threadId: args.threadId || null,
      respondsTo: args.deliveryOfferId,
      ...circularChainMeta(args, "delivery_assigned"),
    },
  };
}

export type CircularDeliveryState =
  | "assigned"
  | "heading_to_pickup"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "received"
  | "cancelled";

const DELIVERY_PROGRESS: Record<CircularDeliveryState, number> = {
  assigned: 20,
  heading_to_pickup: 35,
  picked_up: 50,
  in_transit: 72,
  delivered: 90,
  received: 100,
  cancelled: 0,
};

export function makeCircularDeliveryStatusDV(
  args: CircularBaseArgs & {
    assignmentId: string;
    deliveryIntentId: string;
    state: CircularDeliveryState;
    evidenceRef?: string | null;
  }
) {
  const ts = nowIso();

  return {
    id: makeId("delivery.status"),
    kind: "delivery.status",
    attrs: {
      assignmentId: args.assignmentId,
      deliveryIntentId: args.deliveryIntentId,
      actorId: args.actorId || null,
      actorName: args.actorName || null,
      state: args.state,
      progress: DELIVERY_PROGRESS[args.state],
      evidenceRef: args.evidenceRef || null,
      ...circularGeoAttrs(args),
      ...circularChainAttrs(args, `delivery_${args.state}`),
      threadId: args.threadId || null,
    },
    traits: [
      "mt:circular",
      "falcon:delivery",
      "delivery:status",
      `delivery:${args.state}`,
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: asArray(args.scopes).length ? args.scopes : ["participants"],
      threadId: args.threadId || null,
      respondsTo: args.assignmentId,
      ...circularChainMeta(args, `delivery_${args.state}`),
    },
  };
}
