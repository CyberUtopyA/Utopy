// src/mt/payments/resolveOffer.ts
// Resolver universal de PaymentOffer/PlanOffer desde mtLiveStore.
// - No impone UI fields
// - Sólo selecciona el "mejor" DV por seller/order y por ts

import { useEffect, useMemo, useState } from "react";
import type { PaymentOfferDV, PaymentMethod } from "./mt.intentpayment";
import { mtLiveSubscribe } from "./mt.liveStore";

type AnyDV = any;

export function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function isPaymentOffer(d: AnyDV): d is PaymentOfferDV {
  return safeStr(d?.kind) === "payment.offer";
}

export type PaymentOfferResolved = {
  sellerId: string;
  sellerName?: string | null;
  currency?: string | null;
  text?: string | null;
  accepted: PaymentMethod[];
  raw?: PaymentOfferDV | null;
};

/**
 * Busca el payment.offer MÁS RECIENTE para un seller/cajero.
 * Regla:
 * - debe ser kind="payment.offer"
 * - attrs.scope="seller"
 * - attrs.sellerId == sellerId
 */
export function findLatestPaymentOffer(allDvs: any[], sellerId: string) {
  const sid = safeStr(sellerId);
  if (!sid) return null;

  return (Array.isArray(allDvs) ? allDvs : [])
    .filter((d) => safeStr(d?.kind) === "payment.offer")
    .filter((d) => safeStr(d?.attrs?.scope) === "seller")
    .filter((d) => safeStr(d?.attrs?.sellerId) === sid)
    .sort((a, b) => parseTs(b) - parseTs(a))[0] || null;
}
export function resolvePaymentOfferFromAll(params: {
  all: AnyDV[];
  sellerId: string;
  orderId?: string | null;
}): PaymentOfferResolved | null {
  const { all, sellerId, orderId } = params;
  if (!sellerId) return null;

  const offers = (Array.isArray(all) ? all : [])
    .filter(isPaymentOffer)
    .filter((o: any) => safeStr(o?.attrs?.sellerId) === safeStr(sellerId));

  // Preferir order-specific si existe (scope "order" y orderId match)
  const orderOffers = orderId
    ? offers.filter((o: any) => safeStr(o?.attrs?.orderId) === safeStr(orderId) || safeStr(o?.meta?.scope) === "order")
    : [];

  const pool = orderOffers.length ? orderOffers : offers;

  if (!pool.length) return null;

  // último por ts
  const best = pool.sort((a: any, b: any) => parseTs(b) - parseTs(a))[0];

  return {
    sellerId: safeStr(best?.attrs?.sellerId),
    sellerName: best?.attrs?.sellerName ?? null,
    currency: best?.attrs?.currency ?? "PYG",
    text: best?.attrs?.text ?? "",
    accepted: Array.isArray(best?.attrs?.accepted) ? best.attrs.accepted : [],
    raw: best,
  };
}

// Hook: suscribe al liveStore y resuelve offer
export function usePaymentOffer(params: { sellerId: string; orderId?: string | null }) {
  const { sellerId, orderId } = params;

  const [all, setAll] = useState<AnyDV[]>([]);
  useEffect(() => {
    const unsub = mtLiveSubscribe((xs: AnyDV[]) => setAll(Array.isArray(xs) ? xs : []));
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  const resolved = useMemo(() => {
    return resolvePaymentOfferFromAll({ all, sellerId, orderId });
  }, [all, sellerId, orderId]);

  return { all, offer: resolved };
}

/**
 * EXTRA: agrupar “qué sellers hay en el carrito” (para split automático).
 * Devuelve sellerId por item usando meta.caja/productor/sellerId.
 */
export function resolveSellerKeyFromItem(p: any, fallbackCajero?: any) {
  const cajaId = p?.meta?.caja?.id ?? p?.attrs?.caja?.id ?? null;

  const prodId = p?.productor?.id ?? p?.attrs?.productor?.id ?? p?.meta?.productor?.id ?? null;
  const prodName = p?.productor?.nombre ?? p?.attrs?.productor?.nombre ?? p?.meta?.productor?.nombre ?? null;

  // El cajero es una superficie autorizada, no el vendedor ni el nodo.
  const sellerId = safeStr(
    p?.sellerId ||
      p?.attrs?.sellerId ||
      p?.vendor?.id ||
      p?.attrs?.vendor?.id ||
      prodId ||
      p?.attrs?.nodeId ||
      p?.meta?.originNode ||
      "",
  );
  const sellerName =
    p?.sellerName ||
    p?.attrs?.sellerName ||
    p?.vendor?.name ||
    p?.attrs?.vendor?.name ||
    prodName ||
    null;

  return { sellerId, sellerName, cajaId: cajaId ? safeStr(cajaId) : null };
}
