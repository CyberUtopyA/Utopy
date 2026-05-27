import type { PresenceScanInput } from "../../utopy/presence/presence.types";

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

export function productToPresence(product: any): PresenceScanInput {
  const threadId =
    product?.meta?.threadId ||
    product?.attrs?.contact?.threadId ||
    "";

  return {
    id: `presence:product:${product.id}`,
    ns: product?.meta?.ns || "mt:market",
    kind: "product",
    title: product.nombre || "Producto cercano",
    subtitle: threadId ? `Thread ${safeStr(threadId).slice(-8)}` : "Producto disponible",
    description: "Puedes abrir ficha, comprar o iniciar checkout.",
    image: product.imagen || null,
    productId: String(product.id),
    threadId: threadId || null,
    strength: 0.92,
    distanceLabel: "cerca",
    actions: [
      {
        id: "open-product",
        type: "open_product",
        label: "Ver producto",
        payload: { productId: product.id },
        priority: 10,
      },
      {
        id: "open-checkout",
        type: "open_checkout",
        label: "Comprar ahora",
        payload: { productId: product.id },
        priority: 20,
      },
      ...(threadId
        ? [{
            id: "open-thread",
            type: "open_thread" as const,
            label: "Abrir hilo",
            payload: { threadId },
            priority: 6,
          }]
        : []),
    ],
  };
}

export function offerToPresence(offer: any): PresenceScanInput {
  const threadId =
    offer?.attrs?.threadId ||
    offer?.meta?.threadId ||
    "";

  return {
    id: `presence:offer:${offer.id}`,
    ns: offer?.meta?.ns || "mt:market",
    kind: "offer",
    title: offer?.title || offer?.productoId || "Oferta cercana",
    subtitle: "Oferta viva lista para responder",
    description: "Puedes abrir oferta o pasar directo al checkout.",
    image: offer?.imagen || null,
    offerId: String(offer.id),
    productId: String(offer?.productoId || ""),
    threadId: threadId || null,
    strength: 0.88,
    distanceLabel: "muy cerca",
    actions: [
      {
        id: "open-offer",
        type: "open_offer",
        label: "Ver oferta",
        payload: { offerId: offer.id },
        priority: 10,
      },
      {
        id: "open-checkout",
        type: "open_checkout",
        label: "Comprar oferta",
        payload: { offerId: offer.id, productId: offer?.productoId || null },
        priority: 20,
      },
      ...(threadId
        ? [{
            id: "open-thread",
            type: "open_thread" as const,
            label: "Abrir hilo",
            payload: { threadId },
            priority: 6,
          }]
        : []),
    ],
  };
}

export function orderToPresence(input: {
  orderId: string;
  threadId: string;
  title?: string;
}): PresenceScanInput {
  return {
    id: `presence:order:${input.orderId}`,
    ns: "mt:market",
    kind: "order",
    title: input.title || `Pedido ${safeStr(input.orderId).slice(-6)}`,
    subtitle: "Pedido cercano / activo",
    description: "Puedes abrir conversación o ver documentos.",
    orderId: input.orderId,
    threadId: input.threadId,
    strength: 0.95,
    distanceLabel: "aquí",
    actions: [
      {
        id: "open-thread",
        type: "open_thread",
        label: "Abrir hilo",
        payload: { threadId: input.threadId },
        priority: 20,
      },
      {
        id: "open-invoice",
        type: "open_invoice",
        label: "Ver documentos",
        payload: { orderId: input.orderId, threadId: input.threadId },
        priority: 18,
      },
    ],
  };
}