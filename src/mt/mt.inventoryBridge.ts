import type { DatoVivo } from "./mt.traitAdapter";
import { mtLiveSnapshot } from "./mt.liveStore";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { verifyMarketOrderNodeAction } from "./mt.orderAcknowledgement";

const APPLIED_SALES_KEY = "mt.inventory.applied-sales.v1";
const MAX_APPLIED_SALES = 2_000;

export type MarketInventoryCommitInput = {
  orderId: string;
  orderLineId: string;
  threadId: string;
  order: any;
  sellerConfirmation: any;
  allLive: any[];
  activeActor?: any;
  product: any;
  quantity: number;
  buyerId?: string | null;
  sellerId?: string | null;
  source?: string;
};

export type MarketInventoryCommitResult = {
  applied: boolean;
  eventId: string;
  productId: string;
  stockBefore: number;
  stockAfter: number;
};

function safeText(value: any): string {
  return value == null ? "" : String(value).trim();
}

function finiteStock(value: any): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function readAppliedSales(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(APPLIED_SALES_KEY) || "[]",
    );
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rememberAppliedSale(eventId: string) {
  if (typeof window === "undefined") return;
  try {
    const next = Array.from(new Set([...readAppliedSales(), eventId])).slice(
      -MAX_APPLIED_SALES,
    );
    window.localStorage.setItem(APPLIED_SALES_KEY, JSON.stringify(next));
  } catch {}
}

function storeIdFor(product: any): string {
  return (
    safeText(product?.attrs?.storeId) ||
    safeText(product?.meta?.storeId) ||
    safeText(product?.meta?.authority) ||
    safeText(product?.meta?.originNode) ||
    safeText(product?.attrs?.sellerId) ||
    safeText(product?.meta?.seller?.id) ||
    "market"
  );
}

function currentProductDV(product: any): any {
  const id = safeText(product?.id);
  return (
    mtLiveSnapshot().find((item: any) => safeText(item?.id) === id) ||
    product ||
    {}
  );
}

function currentRevision(product: any): number {
  const revision = Number(
    product?.meta?.stockRevision ??
      product?.meta?.revision ??
      product?.attrs?.revision ??
      0,
  );
  return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

function buildProductProjection(
  raw: any,
  product: any,
  stockAfter: number,
  eventId: string,
) {
  const now = new Date().toISOString();
  const soldOut = stockAfter <= 0;
  const revision = currentRevision(raw) + 1;

  return {
    ...raw,
    id: safeText(product?.id || raw?.id),
    kind: safeText(raw?.kind) || "producto",
    stock: stockAfter,
    attrs: {
      ...(raw?.attrs || {}),
      nombre:
        product?.nombre ||
        product?.attrs?.nombre ||
        raw?.attrs?.nombre ||
        raw?.nombre,
      unidad:
        product?.unidad ||
        product?.attrs?.unidad ||
        raw?.attrs?.unidad ||
        raw?.unidad ||
        "u",
      precio:
        product?.precio ??
        product?.attrs?.precio ??
        raw?.attrs?.precio ??
        raw?.precio,
      imagen:
        product?.imagen ||
        product?.attrs?.imagen ||
        raw?.attrs?.imagen ||
        raw?.imagen,
      stock: stockAfter,
      available: !soldOut,
      status: soldOut ? "out_of_stock" : "active",
      revision,
      stockUpdatedAt: now,
      lastInventoryEventId: eventId,
    },
    traits: Array.from(
      new Set([
        ...(Array.isArray(raw?.traits) ? raw.traits : []),
        "mt:producto",
        "mt:vendible",
        "mt:market",
        "utopy:inventory",
      ]),
    ),
    meta: {
      ...(raw?.meta || product?.meta || {}),
      ns: raw?.meta?.ns || product?.meta?.ns || "mt:market",
      status: soldOut ? "out_of_stock" : "active",
      hidden: soldOut,
      revision,
      stockRevision: revision,
      lastInventoryEventId: eventId,
      ts: now,
      source: "ms.web.checkout.inventory",
    },
  };
}

function buildClosedOffer(raw: any, eventId: string) {
  const now = new Date().toISOString();
  return {
    ...raw,
    id: safeText(raw?.id || raw?.attrs?.id),
    kind: safeText(raw?.kind) || "mt:offer",
    cantidad: 0,
    stock: 0,
    attrs: {
      ...(raw?.attrs || {}),
      cantidad: 0,
      stock: 0,
      status: "completed",
      closed: true,
      completedAt: now,
      lastInventoryEventId: eventId,
    },
    meta: {
      ...(raw?.meta || {}),
      status: "completed",
      hidden: true,
      lastInventoryEventId: eventId,
      ts: now,
    },
  };
}

async function publishInventoryDV(input: {
  dv: DatoVivo;
  allLive: any[];
  activeActor?: any;
  nodeId: string;
  sensitivity: "sensitive" | "ephemeral";
}) {
  try {
    return await publishAuthorizedDV({
      dv: input.dv,
      allLive: input.allLive,
      activeActor: input.activeActor,
      actingAsNodeId: input.nodeId,
      requiredAuthority: input.nodeId,
      action:
        input.dv.kind === "utopy.inventory.event"
          ? "inventory.stock.commit"
          : "inventory.product.update",
      sensitivity: input.sensitivity,
    });
  } catch (error) {
    console.warn(
      "[MT inventory] El DV quedó en la cola local para reintento:",
      error,
    );
    throw error;
  }
}

export async function commitMarketSaleInventory(
  input: MarketInventoryCommitInput,
): Promise<MarketInventoryCommitResult> {
  const orderId = safeText(input.orderId);
  const orderLineId = safeText(input.orderLineId);
  const threadId = safeText(input.threadId);
  const productId = safeText(input.product?.id);
  const quantity = Math.max(1, Math.round(Number(input.quantity || 1)));

  if (!orderId || !orderLineId || !productId) {
    throw new Error("La venta no tiene orderId, orderLineId o productId para descontar stock.");
  }

  const eventId = `utopy.inventory:stock.sold:${orderId}:${orderLineId}`;
  const snapshot = Array.isArray(input.allLive)
    ? input.allLive
    : (mtLiveSnapshot() as any[]);
  const rawProduct = currentProductDV(input.product);
  const stockBefore =
    finiteStock(
      rawProduct?.attrs?.stock ??
        rawProduct?.stock ??
        input.product?.stock ??
        input.product?.attrs?.stock,
    ) ?? 0;
  const stockAfter = Math.max(0, stockBefore - quantity);

  const alreadyApplied =
    readAppliedSales().includes(eventId) ||
    snapshot.some((item: any) => safeText(item?.id) === eventId) ||
    safeText(rawProduct?.meta?.lastInventoryEventId) === eventId;

  if (alreadyApplied) {
    return {
      applied: false,
      eventId,
      productId,
      stockBefore,
      stockAfter: stockBefore,
    };
  }

  if (quantity > stockBefore) {
    throw new Error(`Stock insuficiente: quedan ${stockBefore} unidades.`);
  }

  const storeId = storeIdFor({ ...rawProduct, ...input.product });
  const confirmationCheck = await verifyMarketOrderNodeAction({
    dv: input.sellerConfirmation,
    order: input.order,
    allLive: snapshot,
    sellerNodeId: storeId,
  });
  if (
    input.sellerConfirmation?.kind !== "market.order.accept" ||
    !confirmationCheck.accepted
  ) {
    throw new Error(
      "El nodo dueño del inventario todavía no aceptó esta línea con una firma válida.",
    );
  }
  const acceptedLineIds = Array.isArray(
    input.sellerConfirmation?.attrs?.acceptedLineIds,
  )
    ? input.sellerConfirmation.attrs.acceptedLineIds.map(safeText).filter(Boolean)
    : [];
  if (acceptedLineIds.length && !acceptedLineIds.includes(orderLineId)) {
    throw new Error("La aceptación del nodo no incluye esta línea de la orden.");
  }
  const now = new Date().toISOString();
  const productProjection = buildProductProjection(
    rawProduct,
    input.product,
    stockAfter,
    eventId,
  );

  const inventoryEvent: DatoVivo = {
    id: eventId,
    kind: "utopy.inventory.event",
    attrs: {
      type: "stock.sold",
      node: storeId,
      authority: storeId,
      orderId,
      orderLineId,
      threadId,
      productId,
      buyerId: safeText(input.buyerId) || null,
      sellerId: safeText(input.sellerId) || null,
      quantity: -quantity,
      soldQuantity: quantity,
      stockBefore,
      stockAfter,
      status: "committed",
      product: productProjection,
      emittedAt: now,
    },
    traits: [
      "utopy:inventory",
      "mt:stock",
      "mt:sale",
      "mt:market",
      `store:${storeId}`,
    ],
    meta: {
      ns: "mt:market",
      ts: now,
      source: input.source || "ms.web.checkout",
      authority: storeId,
      storeId,
      eventId,
      portable: true,
      idempotent: true,
    },
  } as DatoVivo;

  await publishInventoryDV({
    dv: inventoryEvent,
    allLive: snapshot,
    activeActor: input.activeActor,
    nodeId: storeId,
    sensitivity: "sensitive",
  });
  await publishInventoryDV({
    dv: productProjection as DatoVivo,
    allLive: mtLiveSnapshot(),
    activeActor: input.activeActor,
    nodeId: storeId,
    sensitivity: "ephemeral",
  });

  const offerId = safeText(
    input.product?.meta?.fromOfferId ||
      input.product?.meta?.fromOffer ||
      input.product?.attrs?.fromOfferId,
  );
  if (offerId) {
    const offer = mtLiveSnapshot().find(
      (item: any) => safeText(item?.id) === offerId,
    );
    if (offer) {
      await publishInventoryDV({
        dv: buildClosedOffer(offer, eventId) as DatoVivo,
        allLive: mtLiveSnapshot(),
        activeActor: input.activeActor,
        nodeId: storeId,
        sensitivity: "ephemeral",
      });
    }
  }

  rememberAppliedSale(eventId);

  return {
    applied: true,
    eventId,
    productId,
    stockBefore,
    stockAfter,
  };
}
