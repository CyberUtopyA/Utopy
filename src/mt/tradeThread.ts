// tradeThread.ts
import { resolveDvThreadId } from "./mt.threadProtocol";
export function makeOfferThreadId(offerId: string) {
  return `trade:thread:${String(offerId)}`;
}

export function makeOrderThreadId(orderId: string) {
  return `order:thread:${String(orderId)}`;
}

export function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

// ✅ nuevo: thread preferido desde attrs.contact.threadId
export function getDesignThreadIdFromAny(x: any): string | null {
  const t = resolveDvThreadId(x) || null;

  return typeof t === "string" && t.trim() ? t.trim() : null;
}

// ✅ para mt:offer / MtOffer adaptado
export function resolveOfferThreadId(offer: any): string {
  const designThreadId = getDesignThreadIdFromAny(offer);
  if (designThreadId) return designThreadId;

  const offerId =
    safeStr(offer?.id) ||
    safeStr(offer?.offerId) ||
    safeStr(offer?.attrs?.offerId);

  return makeOfferThreadId(offerId || "unknown");
}

// ✅ para mt.product / MtProduct adaptado
export function resolveProductThreadId(product: any): string {
  const designThreadId = getDesignThreadIdFromAny(product);
  if (designThreadId) return designThreadId;

  const productId =
    safeStr(product?.id) ||
    safeStr(product?.productId) ||
    safeStr(product?.attrs?.productId);

  return `product:thread:${productId || "unknown"}`;
}

// ✅ para order/create, checkout, mensajes, demandas
export function resolveThreadForTrade(input: {
  offer?: any;
  product?: any;
  orderId?: string;
}) {
  if (input.offer) {
    const t = resolveOfferThreadId(input.offer);
    if (t) return t;
  }

  if (input.product) {
    const t = resolveProductThreadId(input.product);
    if (t) return t;
  }

  if (input.orderId) {
    return makeOrderThreadId(input.orderId);
  }

  return "trade:thread:unknown";
}
