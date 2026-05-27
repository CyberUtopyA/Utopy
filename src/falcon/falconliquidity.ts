import type { FalconStoreItem } from "../types/falcon.store";
import {
  buildLiquidityIssueDV,
  buildLiquidityRedeemDV,
  buildLiquidityTrustDV,
  reduceAccountSummary,
  reduceThreadSummary,
  reduceTrustForActor,
  type DVLike,
  type LiquidityAccountSummary,
  type LiquidityThreadSummary,
  type LiquidityTrustState,
} from "./liquidity/mt.liquidity";

export type FalconCheckoutLiquidityInput = {
  product: FalconStoreItem | any;
  buyerId: string;
  buyerName?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  qty: number;
  unitPrice: number;
  total: number;
  currency?: string | null;
  threadId?: string | null;
  orderId?: string | null;
  useBuyerLiquidity?: boolean;
  scopeId?: string;
};

export type FalconLiquidityCheckoutPayload = {
  summary: LiquidityAccountSummary;
  trust: LiquidityTrustState;
  thread?: LiquidityThreadSummary | null;
};

export function num(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function safeText(x: any, fb = "") {
  const s = String(x ?? "").trim();
  return s || fb;
}

export function sanitizeIdPart(x: any, fb = "unknown") {
  const s = String(x ?? "").trim();
  if (!s) return fb;
  return s.replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

export function resolveFalconBuyerId(rawBuyerId: any, rawBuyerName?: any) {
  const cleanId = sanitizeIdPart(rawBuyerId, "");
  if (cleanId && cleanId !== "buyer:anon") return cleanId;

  const cleanName = sanitizeIdPart(rawBuyerName, "");
  if (cleanName) return `buyer:${cleanName.toLowerCase()}`;

  return "buyer:guest";
}

export function resolveFalconSellerId(product: any) {
  return String(
    product?.sellerId ||
      product?.attrs?.sellerId ||
      product?.vendor?.id ||
      product?.attrs?.vendor?.id ||
      product?.contact?.sellerId ||
      product?.attrs?.contact?.sellerId ||
      product?.targetAuthor?.id ||
      product?.attrs?.targetAuthor?.id ||
      "seller:unknown"
  );
}

export function resolveFalconSellerName(product: any) {
  return String(
    product?.sellerName ||
      product?.attrs?.sellerName ||
      product?.vendor?.name ||
      product?.attrs?.vendor?.name ||
      product?.contact?.sellerName ||
      product?.attrs?.contact?.sellerName ||
      product?.targetAuthor?.name ||
      product?.attrs?.targetAuthor?.name ||
      "Vendedor"
  );
}

export function resolveFalconThreadId(product: any, buyerId: string) {
  return String(
    product?.threadId ||
      product?.meta?.threadId ||
      product?.attrs?.threadId ||
      product?.contact?.threadId ||
      product?.attrs?.contact?.threadId ||
      `trade:thread:${String(product?.id || "product")}:${String(buyerId || "buyer")}`
  );
}

export function compactProductLabel(product: any) {
  return String(
    product?.title ||
      product?.nombre ||
      product?.name ||
      product?.attrs?.title ||
      product?.attrs?.nombre ||
      product?.attrs?.name ||
      product?.id ||
      "Producto"
  ).trim();
}

export function pickFalconCurrency(product: any, fallback = "PYG") {
  return String(
    product?.currency ||
      product?.attrs?.currency ||
      product?.meta?.pay?.currency ||
      product?.meta?.currency ||
      fallback
  ).toUpperCase();
}

export function makeFalconOrderId(product: any, buyerId: string, sellerId: string) {
  return `falcon.order:${sanitizeIdPart(buyerId)}:${sanitizeIdPart(sellerId)}:${sanitizeIdPart(
    product?.id,
    "product"
  )}:${Date.now()}`;
}

export function buildFalconBuyOrderDV(input: FalconCheckoutLiquidityInput): DVLike {
  const sellerId = safeText(input.sellerId, resolveFalconSellerId(input.product));
  const sellerName = safeText(input.sellerName, resolveFalconSellerName(input.product));
  const currency = pickFalconCurrency(input.product, input.currency || "PYG");
  const threadId =
    input.threadId || resolveFalconThreadId(input.product, input.buyerId);
  const orderId =
    input.orderId || makeFalconOrderId(input.product, input.buyerId, sellerId);

  return {
    id: orderId,
    kind: "trade.intent.buy",
    attrs: {
      orderId,
      threadId,
      buyerId: input.buyerId,
      buyerName: input.buyerName || null,
      sellerId,
      sellerName,
      productId: input.product?.id || null,
      productName: compactProductLabel(input.product),
      qty: Math.max(1, num(input.qty, 1)),
      unitPrice: num(input.unitPrice, 0),
      total: num(input.total, 0),
      currency,
      note: "Compra creada desde Falcon checkout",
      sourceNode: "falcon",
      image: input.product?.image || null,
    },
    traits: ["trade:buy", "falcon:checkout", "mt:market"],
    meta: {
      ns: input.product?.meta?.ns ?? "mt:market",
      scopes: ["public"],
      ts: new Date().toISOString(),
      source: "falcon.checkout.buy",
    },
  };
}

export function buildFalconCheckoutLiquidityDVs(
  input: FalconCheckoutLiquidityInput
) {
  const sellerId = safeText(input.sellerId, resolveFalconSellerId(input.product));
  const sellerName = safeText(input.sellerName, resolveFalconSellerName(input.product));
  const currency = pickFalconCurrency(input.product, input.currency || "PYG");
  const threadId =
    input.threadId || resolveFalconThreadId(input.product, input.buyerId);
  const orderId =
    input.orderId || makeFalconOrderId(input.product, input.buyerId, sellerId);

  const issueDV = buildLiquidityIssueDV({
    amount: num(input.total, 0),
    currency,
    issuerId: "falcon.liquidity.bot",
    issuerName: "Falcon Liquidity",
    beneficiaryId: sellerId,
    beneficiaryName: sellerName,
    buyerId: input.buyerId,
    buyerName: input.buyerName || undefined,
    sellerId,
    sellerName,
    orderId,
    threadId,
    reason: "falcon.checkout.confirmed",
    scopeId: input.scopeId,
    sourceKind: "trade.intent.buy",
    sourceId: orderId,
    trustScore: 0.72,
  });

  const redeemDV =
    input.useBuyerLiquidity
      ? buildLiquidityRedeemDV({
          amount: num(input.total, 0),
          currency,
          actorId: input.buyerId,
          actorName: input.buyerName || input.buyerId,
          buyerId: input.buyerId,
          buyerName: input.buyerName || undefined,
          sellerId,
          sellerName,
          orderId,
          threadId,
          reason: "falcon.checkout.consume",
          redeemTarget: "order",
          scopeId: input.scopeId,
          sourceKind: "trade.intent.buy",
          sourceId: orderId,
          trustScore: 0.7,
        })
      : null;

  const trustSellerDV = buildLiquidityTrustDV({
    actorId: sellerId,
    actorName: sellerName,
    trustForId: input.buyerId,
    trustForName: input.buyerName || undefined,
    scoreDelta: 0.05,
    reason: "falcon.purchase.confirmed",
    basedOnKind: "trade.intent.buy",
    basedOnId: orderId,
    orderId,
    threadId,
    scopeId: input.scopeId,
  });

  const trustBuyerDV = buildLiquidityTrustDV({
    actorId: input.buyerId,
    actorName: input.buyerName || input.buyerId,
    trustForId: sellerId,
    trustForName: sellerName,
    scoreDelta: 0.03,
    reason: "falcon.purchase.created",
    basedOnKind: "trade.intent.buy",
    basedOnId: orderId,
    orderId,
    threadId,
    scopeId: input.scopeId,
  });

  return {
    orderId,
    threadId,
    currency,
    issueDV,
    redeemDV,
    trustSellerDV,
    trustBuyerDV,
    allDvs: [issueDV, redeemDV, trustSellerDV, trustBuyerDV].filter(Boolean) as DVLike[],
  };
}

export function summarizeFalconLiquidity(args: {
  actorId: string;
  currency?: string;
  dvs: DVLike[];
}): FalconLiquidityCheckoutPayload {
  const currency = pickFalconCurrency({}, args.currency || "PYG");
  const summary = reduceAccountSummary(args.actorId, currency, args.dvs);
  const trust = reduceTrustForActor(args.actorId, args.dvs);

  return {
    summary,
    trust,
    thread: null,
  };
}

export function summarizeFalconThreadLiquidity(args: {
  actorId: string;
  currency?: string;
  threadId?: string | null;
  dvs: DVLike[];
}): FalconLiquidityCheckoutPayload {
  const currency = pickFalconCurrency({}, args.currency || "PYG");
  const summary = reduceAccountSummary(args.actorId, currency, args.dvs);
  const trust = reduceTrustForActor(args.actorId, args.dvs);
  const thread =
    args.threadId ? reduceThreadSummary(args.threadId, currency, args.dvs) : null;

  return {
    summary,
    trust,
    thread,
  };
}