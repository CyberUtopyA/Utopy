// src/mt/CheckoutModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { mtLiveSubscribe, mtLiveUpsert } from "../mt/mt.liveStore";
import { useLocalBuyerIdentity } from "../mt/uselocalbuyerindentity";
import { spore } from "../utopy/spore.singleton";

import {
  emitPaymentProof,
  emitPaymentProximity,
  emitPaymentProposal,
} from "../mt/mt.intentpayment";
import { emitMandateCreate } from "../mt/mandateitem";
import { findLatestPaymentOffer, safeStr } from "../mt/resolveOffer";
import {
  emitCreditAccount,
  emitCreditInstallment,
} from "../mt/mt.creditintent";
import { usePresenceEmitter } from "../utopy/presence/usepresenceemitter";
import usePresenceScanner from "./usepresencescanner";
import PresenceNowChip from "../utopy/presence/PresenceNowChip";
import PresenceRadar from "../utopy/presence/PresenceRadar";
import { emitPaymentSessionOpen } from "../mt/paymentsession";
import MtLiquidityPanel from "../liquidity/liquiditypanel";
import { bootLiquidityRuntime, ingestLiquidityDV } from "../liquidity/liquidityruntime";

function sanitizeIdPart(x: any, fb = "unknown") {
  const s = String(x ?? "").trim();
  if (!s) return fb;
  return s.replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

function resolveCheckoutBuyerId(rawBuyerId: any, rawBuyerName?: any) {
  const cleanId = sanitizeIdPart(rawBuyerId, "");
  if (cleanId && cleanId !== "buyer:anon") return cleanId;

  const cleanName = sanitizeIdPart(rawBuyerName, "");
  if (cleanName) return `buyer:${cleanName.toLowerCase()}`;

  return `buyer:guest`;
}
function makeInternalInvoiceNumber(prefix = "FAC") {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
}

function compactProductLabel(product: any) {
  return String(
    product?.nombre ||
      product?.name ||
      product?.attrs?.nombre ||
      product?.attrs?.name ||
      product?.id ||
      "Producto"
  ).trim();
}

function buildReceiptDV(input: {
  orderId: string;
  threadId: string;
  sellerId: string;
  sellerName: string | null;
  buyerId: string;
  buyerName?: string | null;
  product: any;
  qty: number;
  unitPrice: number;
  total: number;
  payMethod: "cajero" | "crypto";
  financeChoice: "cash" | "credit";
  cajeroId?: string | null;
  currency?: string | null;
}) {
  const ts = new Date().toISOString();
  const invoiceNumber = makeInternalInvoiceNumber("REC");

  return {
    id: `sale.receipt:${input.orderId}`,
    kind: "sale.receipt",
    attrs: {
      receiptNumber: invoiceNumber,
      orderId: input.orderId,
      threadId: input.threadId,

      buyerId: input.buyerId,
      buyerName: input.buyerName || null,

      sellerId: input.sellerId,
      sellerName: input.sellerName || null,

      cajeroId: input.cajeroId || null,

      productId: input.product?.id || null,
      productName: compactProductLabel(input.product),

      qty: input.qty,
      unitPrice: input.unitPrice,
      subtotal: input.total,
      total: input.total,
      currency: String(input.currency || "PYG"),

      paymentMethod: input.payMethod,
      financeChoice: input.financeChoice,
      status: "issued",
    },
    traits: ["mt:market", "mt:receipt", "mt:sale"],
    meta: {
      ns: input.product?.meta?.ns ?? "mt:market",
      ts,
      source: "ms.web.checkout.receipt",
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 365,
    },
  };
}

function resolveCheckoutThreadId(product: any, buyerId: string) {
  return String(
    product?.threadId ||
      product?.meta?.threadId ||
      product?.attrs?.threadId ||
      product?.contact?.threadId ||
      product?.attrs?.contact?.threadId ||
      `order:thread:${String(product?.id || "product")}:${String(buyerId || "buyer")}`
  );
}

function resolveCheckoutSellerId(product: any) {
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

function resolveCheckoutSellerName(product: any) {
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

function buildInvoiceDraftDV(input: {
  orderId: string;
  threadId: string;
  sellerId: string;
  sellerName: string | null;
  buyerId: string;
  buyerName?: string | null;
  product: any;
  qty: number;
  unitPrice: number;
  total: number;
  payMethod: "cajero" | "crypto";
  financeChoice: "cash" | "credit";
  cajeroId?: string | null;
  currency?: string | null;
}) {
  const ts = new Date().toISOString();
  const invoiceNumber = makeInternalInvoiceNumber("FAC");

  return {
    id: `market.invoice.draft:${input.orderId}`,
    kind: "market.invoice.draft",
    attrs: {
      invoiceNumber,
      orderId: input.orderId,
      threadId: input.threadId,

      buyer: {
        id: input.buyerId,
        name: input.buyerName || null,
      },

      seller: {
        id: input.sellerId,
        name: input.sellerName || null,
      },

      cajeroId: input.cajeroId || null,

      items: [
        {
          productId: input.product?.id || null,
          name: compactProductLabel(input.product),
          qty: input.qty,
          unitPrice: input.unitPrice,
          total: input.total,
        },
      ],

      subtotal: input.total,
      discounts: 0,
      taxes: 0,
      total: input.total,
      currency: String(input.currency || "PYG"),

      paymentMethod: input.payMethod,
      financeChoice: input.financeChoice,

      status: "draft",
      printable: true,
      pdfReady: false,
    },
    traits: ["mt:market", "mt:invoice", "mt:invoice.draft", "mt:sale"],
    meta: {
      ns: input.product?.meta?.ns ?? "mt:market",
      ts,
      source: "ms.web.checkout.invoice",
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 365,
    },
  };
}

function buildInvoiceEventDV(input: {
  orderId: string;
  threadId: string;
  sellerId: string;
  buyerId: string;
  cajeroId?: string | null;
  total: number;
  currency?: string | null;
  financeChoice: "cash" | "credit";
}) {
  return {
    id: `market.order.event:invoice:${input.orderId}:${Date.now()}`,
    kind: "market.order.event",
    attrs: {
      orderId: input.orderId,
      threadId: input.threadId,
      sellerId: input.sellerId,
      buyerId: input.buyerId,
      cajeroId: input.cajeroId || null,
      ok: true,
      type: "invoice.created",
      text:
        input.financeChoice === "credit"
          ? `Factura/comprobante generado automáticamente por ${input.total} ${String(
              input.currency || "PYG"
            )} · compra a crédito`
          : `Factura/comprobante generado automáticamente por ${input.total} ${String(
              input.currency || "PYG"
            )}`,
      unreadBy: [input.sellerId, input.buyerId, input.cajeroId].filter(Boolean),
    },
    traits: ["mt:market", "mt:invoice", "mt:thread"],
    meta: {
      ns: "mt:market",
      ts: new Date().toISOString(),
      source: "ms.web.checkout.invoice.event",
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 30,
    },
  };
}

function emitAutoSaleDocuments(input: {
  orderId: string;
  threadId: string;
  sellerId: string;
  sellerName: string | null;
  buyerId: string;
  buyerName?: string | null;
  product: any;
  qty: number;
  unitPrice: number;
  total: number;
  payMethod: "cajero" | "crypto";
  financeChoice: "cash" | "credit";
  cajeroId?: string | null;
  currency?: string | null;
}) {
  const receiptDV = buildReceiptDV(input);
  const invoiceDV = buildInvoiceDraftDV(input);
  const eventDV = buildInvoiceEventDV(input);

  mtLiveUpsert(receiptDV as any);
  mtLiveUpsert(invoiceDV as any);
  mtLiveUpsert(eventDV as any);

  return {
    receiptDV,
    invoiceDV,
    eventDV,
  };
}

type PayMethod = "cajero";
type FinanceChoice = "cash" | "credit";

type CheckoutProps = {
  open: boolean;
  product: any;
  activeCajero?: { id: string; nombre?: string; meta?: any } | null;
  onNeedCajero?: () => void;
  onClose: () => void;
  onDone: (payload?: {
    orderId: string;
    threadId: string;
    receiptId?: string;
    invoiceId?: string;
  }) => void;
};

function num(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function isCreditPlanDV(d: any) {
  return safeStr(d?.kind).trim() === "credit.plan";
}

function sameText(a: any, b: any) {
  return (
    String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase()
  );
}

function addInterval(
  date: Date,
  interval: "monthly" | "weekly" | "daily",
  every = 1
) {
  const d = new Date(date);
  const n = Math.max(1, Number(every || 1));

  if (interval === "monthly") d.setMonth(d.getMonth() + n);
  else if (interval === "weekly") d.setDate(d.getDate() + 7 * n);
  else d.setDate(d.getDate() + n);

  return d;
}

function findCreditPlanForCheckout(all: any[], product: any) {
  const productCandidates = [
    product?.id,
    product?.nombre,
    product?.name,
    product?.attrs?.nombre,
    product?.attrs?.name,
    product?.meta?.name,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const plans = all
    .filter(isCreditPlanDV)
    .filter((d: any) => {
      const planProductId = String(d?.attrs?.productId || "").trim();
      if (!planProductId) return false;
      return productCandidates.some((p) => sameText(planProductId, p));
    })
    .sort((a: any, b: any) => parseTs(b) - parseTs(a));

  return plans[0] || null;
}

function getEmbeddedCreditFromProduct(product: any) {
  const c =
    product?.meta?.pay?.finance?.credit ||
    product?.meta?.finance?.credit ||
    product?.attrs?.pay?.finance?.credit ||
    null;

  if (!c || typeof c !== "object") return null;

  return {
    downPaymentMin: Math.max(0, num(c.downPaymentMin, 0)),
    installmentCount: Math.max(1, num(c.installmentCount, 1)),
    interval: safeStr(c.interval || "monthly") as
      | "monthly"
      | "weekly"
      | "daily",
    every: Math.max(1, num(c.every, 1)),
    lateFeeFlat: c.lateFeeFlat != null ? num(c.lateFeeFlat, 0) : null,
    lateFeePct: c.lateFeePct != null ? num(c.lateFeePct, 0) : null,
    guaranteeMode: safeStr(c.guaranteeMode || "downpayment"),
    trustRequired: c.trustRequired != null ? num(c.trustRequired, 0) : null,
    note: safeStr(c.note || ""),
  };
}

function normalizeImageSrc(x: any, mime = "image/png"): string | null {
  if (!x || typeof x !== "string") return null;

  const v = x.trim();
  if (!v) return null;

  if (
    v.startsWith("data:image/") ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("blob:")
  ) {
    return v;
  }

  const looksBase64 =
    /^[A-Za-z0-9+/=\s]+$/.test(v) &&
    !v.includes("{") &&
    !v.includes("}");

  if (looksBase64) {
    const compact = v.replace(/\s+/g, "");
    return `data:${mime};base64,${compact}`;
  }

  return v;
}

function isPlaceholderLike(x: any): boolean {
  const v = String(x || "").trim().toLowerCase();
  if (!v) return true;

  return (
    v === "/placeholder.png" ||
    v === "placeholder.png" ||
    v.endsWith("/placeholder.png") ||
    v.includes("placeholder") ||
    v === "null" ||
    v === "undefined"
  );
}

function normalizeImageCandidate(x: any, mime = "image/png"): string {
  const normalized = normalizeImageSrc(
    typeof x === "string" ? x : String(x || ""),
    mime
  );
  return String(normalized || "").trim();
}

function uniqueStrings(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function readGalleryUrls(product: any): string[] {
  const galleryA = Array.isArray(product?.meta?.media?.gallery)
    ? product.meta.media.gallery
    : [];

  const galleryB = Array.isArray(product?.attrs?.media?.gallery)
    ? product.attrs.media.gallery
    : [];

  const galleryC = Array.isArray(product?.media?.gallery)
    ? product.media.gallery
    : [];

  const candidates = [...galleryA, ...galleryB, ...galleryC]
    .map((x: any) => {
      const raw =
        typeof x === "string"
          ? x
          : x?.url || x?.dataUrl || x?.src || x?.image || "";
      const mime = x?.mime || "image/png";
      return normalizeImageCandidate(raw, mime);
    })
    .filter((x: string) => x && !isPlaceholderLike(x));

  const mainCandidates = [
    { raw: product?.imageUrl, mime: product?.imageMime || "image/png" },
    { raw: product?.imagen, mime: product?.mime || "image/png" },
    { raw: product?.image, mime: product?.mime || "image/png" },
    { raw: product?.attrs?.imagen, mime: product?.attrs?.mime || "image/png" },
    { raw: product?.attrs?.image, mime: product?.attrs?.mime || "image/png" },
    { raw: product?.media?.image?.url, mime: product?.media?.image?.mime || "image/png" },
    { raw: product?.media?.image?.dataUrl, mime: product?.media?.image?.mime || "image/png" },
    { raw: typeof product?.media?.image === "string" ? product?.media?.image : "", mime: "image/png" },
    { raw: product?.attrs?.media?.image?.url, mime: product?.attrs?.media?.image?.mime || "image/png" },
    { raw: product?.attrs?.media?.image?.dataUrl, mime: product?.attrs?.media?.image?.mime || "image/png" },
    { raw: typeof product?.attrs?.media?.image === "string" ? product?.attrs?.media?.image : "", mime: product?.attrs?.media?.image?.mime || "image/png" },
    { raw: product?.meta?.media?.image?.url, mime: product?.meta?.media?.image?.mime || "image/png" },
    { raw: product?.meta?.media?.image?.dataUrl, mime: product?.meta?.media?.image?.mime || "image/png" },
    { raw: typeof product?.meta?.media?.image === "string" ? product?.meta?.media?.image : "", mime: product?.meta?.media?.image?.mime || "image/png" },
    { raw: product?.meta?.["mt:media.image"], mime: "image/png" },
    { raw: product?.traits?.render?.url, mime: product?.traits?.render?.mime || "image/png" },
    { raw: product?.traits?.render?.dataUrl, mime: product?.traits?.render?.mime || "image/png" },
  ]
    .map((x) => normalizeImageCandidate(x.raw, x.mime))
    .filter((x) => x && !isPlaceholderLike(x));

  return uniqueStrings([...mainCandidates, ...candidates]);
}

function buildRecommendedMethod(args: {
  entryMethod: string;
  checkoutByEntry: { qr: any[]; nfc: any[] };
  activeCajero?: { id: string; nombre?: string } | null;
  paymentOffer: any;
  financeChoice: FinanceChoice;
}) {
  const accepted = Array.isArray(args.paymentOffer?.attrs?.accepted)
    ? args.paymentOffer.attrs.accepted
    : [];

  const findAccepted = (channel: string) =>
    accepted.find(
      (m: any) =>
        String(m?.channel || "").trim().toLowerCase() === channel
    );

  if (args.financeChoice === "credit") {
    return {
      channel: "credit",
      label: "Compra a crédito",
      meta: { reason: "checkout.credit.selected" },
    };
  }

  if (args.checkoutByEntry?.qr?.length > 0 || args.entryMethod === "qr") {
    return (
      findAccepted("qr") || {
        channel: "qr",
        label: "QR recomendado",
        meta: { reason: "presence.qr.detected" },
      }
    );
  }

  if (args.checkoutByEntry?.nfc?.length > 0 || args.entryMethod === "nfc") {
    return (
      findAccepted("card") || {
        channel: "card",
        label: "Tarjeta / contacto",
        meta: { reason: "presence.nfc.detected" },
      }
    );
  }

  if (args.activeCajero?.id) {
    return (
      findAccepted("cash") || {
        channel: "cash",
        label: "Pagar en caja",
        meta: { reason: "active.cajero.present" },
      }
    );
  }

  return (
    findAccepted("transfer") ||
    findAccepted("link") || {
      channel: "transfer",
      label: "Transferencia sugerida",
      meta: { reason: "fallback.transfer" },
    }
  );
}
function buildAlternativeMethods(args: {
  paymentOffer: any;
  financeChoice: FinanceChoice;
}) {
  const accepted = Array.isArray(args.paymentOffer?.attrs?.accepted)
    ? args.paymentOffer.attrs.accepted
    : [];

  const out: any[] = [];

  for (const m of accepted) {
    if (m && typeof m === "object" && m.channel) out.push(m);
  }

  if (args.financeChoice === "credit") {
    out.unshift({ channel: "credit", label: "Compra a crédito" });
  }

  if (!out.length) {
    out.push({ channel: "cash", label: "Efectivo" });
    out.push({ channel: "transfer", label: "Transferencia" });
  }

  return out;
}
export default function CheckoutModal({
  open,
  product,
  activeCajero,
  onNeedCajero,
  onClose,
  onDone,
}: CheckoutProps) {
  const shouldRender = !!open && !!product;
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { emitPresence, clearSignals } = usePresenceEmitter();

  const currentStage = useMemo(() => {
    if (!open) return "closed";
    if (busy) return "confirming";
    return "review";
  }, [open, busy]);

  const [allDvs, setAllDvs] = useState<any[]>([]);

  useEffect(() => {
    const unsub = mtLiveSubscribe((all: any[]) =>
      setAllDvs(Array.isArray(all) ? all : [])
    );
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);
  useEffect(() => {
  bootLiquidityRuntime();
}, []);

useEffect(() => {
  for (const dv of allDvs) {
    ingestLiquidityDV(dv);
  }
}, [allDvs]);

  const [proofText, setProofText] = useState("");
  const [paidBusy, setPaidBusy] = useState(false);
  const [autoDebit, setAutoDebit] = useState(false);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { name: buyerName, buyerId: rawBuyerId } = useLocalBuyerIdentity();

const buyerId = useMemo(() => {
  return resolveCheckoutBuyerId(rawBuyerId, buyerName);
}, [rawBuyerId, buyerName]);

  const checkoutThreadId = useMemo(() => {
    return resolveCheckoutThreadId(product, buyerId);
  }, [product, buyerId]);

  const sellerId = useMemo(() => {
    return resolveCheckoutSellerId(product);
  }, [product]);

  const sellerName = useMemo(() => {
    return resolveCheckoutSellerName(product);
  }, [product]);

  const entryMethod = useMemo(() => {
    return String(
      product?.meta?.checkout?.entry ||
        product?.meta?.entryMethod ||
        product?.attrs?.entryMethod ||
        "manual"
    );
  }, [product]);

  const {
    nearby: checkoutNearby,
    byEntryMethod: checkoutByEntry,
  } = usePresenceScanner({
    enabled: open,
    ns: product?.meta?.ns ?? "mt:market",
    scope: "checkout",
    targetKind: "product",
    targetId: String(product?.id || ""),
    threadId: checkoutThreadId,
    actorId: String(buyerId || ""),
    maxAgeMs: 1000 * 60,
    limit: 12,
  });

  const checkoutWatchingNow = useMemo(() => {
    return (checkoutNearby || []).map((p: any) => ({
      actorId: p?.actorId,
      productId: p?.productId || p?.meta?.targetId || null,
      threadId: p?.threadId || p?.meta?.threadId || null,
      strength: p?.strength || p?.meta?.strength || 0.7,
    }));
  }, [checkoutNearby]);

  const [payMethod, setPayMethod] = useState<PayMethod>("cajero");
  const [financeChoice, setFinanceChoice] = useState<FinanceChoice>("cash");


  const unitPriceNum = useMemo(
    () => num(product?.precio ?? product?.price ?? 0, 0),
    [product?.precio, product?.price]
  );

  const totalNum = useMemo(() => {
    return Math.max(1, qty) * unitPriceNum;
  }, [qty, unitPriceNum]);

  const unitPriceStr = useMemo(() => String(unitPriceNum || 0), [unitPriceNum]);
  const totalStr = useMemo(() => String(totalNum || 0), [totalNum]);

  const creditPlan = useMemo(() => {
    return findCreditPlanForCheckout(allDvs, product);
  }, [allDvs, product]);

  const embeddedCredit = useMemo(() => {
    return getEmbeddedCreditFromProduct(product);
  }, [product]);
const creditEnabled = !!creditPlan || !!embeddedCredit;
  useEffect(() => {
    if (!creditEnabled && financeChoice === "credit") {
      setFinanceChoice("cash");
    }
  }, [creditEnabled, financeChoice]);

  const creditPreview = useMemo(() => {
    const source = creditPlan?.attrs
      ? {
          downPaymentMin: num(creditPlan.attrs.downPaymentMin, 0),
          installmentCount: Math.max(
            1,
            num(creditPlan.attrs.installmentCount, 1)
          ),
          interval: safeStr(creditPlan.attrs.interval || "monthly") as
            | "monthly"
            | "weekly"
            | "daily",
          every: Math.max(1, num(creditPlan.attrs.every, 1)),
          currency: safeStr(creditPlan.attrs.currency || "PYG"),
          guaranteeMode: safeStr(
            creditPlan.attrs.guaranteeMode || "downpayment"
          ),
          note: safeStr(creditPlan.attrs.note || ""),
          trustRequired:
            creditPlan.attrs.trustRequired != null
              ? num(creditPlan.attrs.trustRequired, 0)
              : null,
        }
      : embeddedCredit
      ? {
          ...embeddedCredit,
          currency: safeStr(product?.meta?.pay?.currency || "PYG"),
        }
      : null;

    if (!source) return null;

    const total = totalNum;
    const down = Math.min(total, Math.max(0, num(source.downPaymentMin, 0)));
    const financed = Math.max(0, total - down);
    const installmentCount = Math.max(1, num(source.installmentCount, 1));
    const installmentValue =
      installmentCount > 0 ? Math.round(financed / installmentCount) : 0;

    return {
      downPaymentMin: down,
      installmentCount,
      interval: source.interval,
      every: Math.max(1, num(source.every, 1)),
      currency: safeStr((source as any).currency || "PYG"),
      guaranteeMode: safeStr(source.guaranteeMode || "downpayment"),
      note: safeStr(source.note || ""),
      financed,
      installmentValue,
      trustRequired:
        (source as any).trustRequired != null
          ? num((source as any).trustRequired, 0)
          : null,
      sourceKind: creditPlan
        ? "credit.plan"
        : embeddedCredit
        ? "product.meta.pay.finance.credit"
        : "none",
    };
  }, [creditPlan, embeddedCredit, totalNum, product]);

  const sessionRef = useRef<{
    orderId: string;
    threadId: string;
    sellerId: string;
    sellerName: string | null;
    createdTs: number;
  } | null>(null);

  const computeSeller = () => {
    const resolvedSellerId =
      payMethod === "cajero"
        ? activeCajero?.id ??
          product?.meta?.caja?.id ??
          product?.productor?.id ??
          sellerId
        : product?.productor?.id ??
          product?.meta?.caja?.id ??
          sellerId;

    const resolvedSellerName =
      payMethod === "cajero"
        ? activeCajero?.nombre ??
          product?.meta?.caja?.nombre ??
          product?.productor?.nombre ??
          sellerName
        : product?.productor?.nombre ??
          product?.meta?.caja?.nombre ??
          sellerName;

    return {
      sellerId: String(resolvedSellerId || "seller:unknown"),
      sellerName: resolvedSellerName ?? null,
    };
  };

  const sellerIdForOffer =
    activeCajero?.id ??
    product?.meta?.caja?.id ??
    product?.productor?.id ??
    sellerId ??
    null;

  const paymentOffer = useMemo(() => {
    if (!sellerIdForOffer) return null;
    return findLatestPaymentOffer(allDvs, String(sellerIdForOffer)) || null;
  }, [allDvs, sellerIdForOffer]);

const recommendedMethod = useMemo(() => {
  return buildRecommendedMethod({
    entryMethod,
    checkoutByEntry: checkoutByEntry || { qr: [], nfc: [] },
    activeCajero,
    paymentOffer,
    financeChoice,
  });
}, [entryMethod, checkoutByEntry, activeCajero, paymentOffer, financeChoice]);
 const alternativeMethods = useMemo(() => {
  return buildAlternativeMethods({
    paymentOffer,
    financeChoice,
  });
}, [paymentOffer, financeChoice]);
  const proposalReason = useMemo(() => {
  if (financeChoice === "credit") return "checkout.credit.selected";
  if (checkoutByEntry?.qr?.length > 0) return "presence.qr.detected";
  if (checkoutByEntry?.nfc?.length > 0) return "presence.nfc.detected";
  if (activeCajero?.id && checkoutNearby.length > 0)
    return "buyer.near.active.cajero";
  if (activeCajero?.id) return "active.cajero.available";
  return "fallback.transfer";
}, [financeChoice, checkoutByEntry, activeCajero, checkoutNearby.length]);
const ensureSession = () => {
  const computed = computeSeller();
  const cleanBuyerId = resolveCheckoutBuyerId(buyerId, buyerName);
  const cleanSellerId = sanitizeIdPart(computed.sellerId, "seller");
  const stableProductId = sanitizeIdPart(product?.id, "product");

  if (
    !sessionRef.current ||
    sessionRef.current.sellerId !== computed.sellerId
  ) {
    const createdTs = Date.now();

    const orderId = `market.order:${cleanBuyerId}:${cleanSellerId}:${stableProductId}:${createdTs}`;
    const threadId = `mt.thread.order:${cleanBuyerId}:${cleanSellerId}:${stableProductId}:${createdTs}`;

    sessionRef.current = {
      orderId,
      threadId,
      sellerId: computed.sellerId,
      sellerName: computed.sellerName,
      createdTs,
    };
  }

  return sessionRef.current!;
};
  useEffect(() => {
    if (!open) sessionRef.current = null;
  }, [open]);

  const galleryImages = useMemo(() => readGalleryUrls(product), [product]);
  const img = galleryImages[0] || "";

  useEffect(() => {
    if (!galleryOpen || !galleryImages.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryOpen(false);
      if (e.key === "ArrowLeft") {
        setGalleryIndex((v) => (v - 1 + galleryImages.length) % galleryImages.length);
      }
      if (e.key === "ArrowRight") {
        setGalleryIndex((v) => (v + 1) % galleryImages.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryOpen, galleryImages.length]);

  const enviarComprobante = async () => {
    try {
      setPaidBusy(true);
      setMsg(null);

      const s = ensureSession();
      if (!proofText.trim()) {
        throw new Error("Escribí un comprobante (alias, nro, link o nota).");
      }

      await emitPaymentProof({
        orderId: s.orderId,
        buyerId,
        buyerName: buyerName || undefined,
        threadId: s.threadId,
        ns: product?.meta?.ns ?? "mt:market",
        proof: { type: "text", value: proofText.trim() },
        note: "Comprobante enviado por el comprador",
      });

      setMsg("🧾 Comprobante enviado ✅");
      setProofText("");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo enviar comprobante");
    } finally {
      setPaidBusy(false);
    }
  };

  const createCreditFlow = async (params: {
    orderId: string;
    threadId: string;
    sellerId: string;
    sellerName: string | null;
    total: number;
  }) => {
    if (!creditPreview) throw new Error("No hay plan de crédito disponible.");

    const firstDueBase =
      creditPlan?.attrs?.firstDueAt && Date.parse(creditPlan.attrs.firstDueAt)
        ? new Date(creditPlan.attrs.firstDueAt)
        : addInterval(new Date(), creditPreview.interval, creditPreview.every);

    const account = await emitCreditAccount({
      planId: creditPlan?.id ?? null,
      orderId: params.orderId,
      sellerId: params.sellerId,
      sellerName: params.sellerName,
      buyerId,
      buyerName: buyerName || undefined,
      cajeroId: activeCajero?.id ?? null,
      threadId: params.threadId,

      principal: params.total,
      downPayment: creditPreview.downPaymentMin,
      financedAmount: creditPreview.financed,
      installmentCount: creditPreview.installmentCount,
      installmentValue: creditPreview.installmentValue,
      interval: creditPreview.interval,
      every: creditPreview.every,
      firstDueAt: firstDueBase.toISOString(),
      nextDueAt: firstDueBase.toISOString(),
      trustSnapshot: creditPreview.trustRequired,
      guaranteeMode: (creditPreview.guaranteeMode as any) || "downpayment",
      currency: creditPreview.currency,
      note: creditPreview.note || "Crédito creado desde checkout",
      ns: product?.meta?.ns ?? "mt:market",
      source: "ms.web.checkout.credit",
    });

    for (let i = 0; i < creditPreview.installmentCount; i++) {
      const dueAt = addInterval(
        firstDueBase,
        creditPreview.interval,
        creditPreview.every * i
      );

      const isLast = i === creditPreview.installmentCount - 1;
      const amountDue = isLast
        ? Math.max(
            0,
            creditPreview.financed -
              creditPreview.installmentValue *
                (creditPreview.installmentCount - 1)
          )
        : creditPreview.installmentValue;

      await emitCreditInstallment({
        accountId: account.id,
        planId: creditPlan?.id ?? null,
        orderId: params.orderId,
        sellerId: params.sellerId,
        buyerId,
        threadId: params.threadId,
        number: i + 1,
        dueAt: dueAt.toISOString(),
        amountDue,
        currency: creditPreview.currency,
        note: `Cuota ${i + 1}/${creditPreview.installmentCount}`,
        ns: product?.meta?.ns ?? "mt:market",
        source: "ms.web.checkout.credit.installment",
      });
    }

    return account;
  };

  const confirmar = async () => {
  setBusy(true);
  setMsg(null);

  try {
    const s = ensureSession();

    const qNum = Math.max(1, Number(qty || 1));
    const priceNum = unitPriceNum;

    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error("Precio inválido.");
    }

    if (!activeCajero) {
      throw new Error("Elegí un cajero para completar el pedido.");
    }

    const total = qNum * priceNum;

    const docs = emitAutoSaleDocuments({
      orderId: s.orderId,
      threadId: s.threadId,
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      buyerId,
      buyerName: buyerName || undefined,
      product,
      qty: qNum,
      unitPrice: priceNum,
      total,
      payMethod: "cajero",
      financeChoice,
      cajeroId: activeCajero?.id ?? null,
      currency:
        paymentOffer?.attrs?.currency ||
        product?.meta?.pay?.currency ||
        "PYG",
    });

    const paymentAttrs =
      financeChoice === "credit" && creditPreview
        ? {
            type: "credit",
            cajeroId: activeCajero?.id ?? null,
            downPaymentMin: creditPreview.downPaymentMin,
            financedAmount: creditPreview.financed,
            installmentCount: creditPreview.installmentCount,
            installmentValue: creditPreview.installmentValue,
            interval: creditPreview.interval,
            every: creditPreview.every,
            currency: creditPreview.currency,
            planId: creditPlan?.id ?? null,
            productId: product?.id ?? null,
            planSource: creditPreview.sourceKind,
          }
        : {
            type: "cajero",
            cajeroId: activeCajero?.id ?? null,
          };

    mtLiveUpsert({
      id: s.orderId,
      kind: "market.order.create",
      attrs: {
        orderId: s.orderId,
        threadId: s.threadId,

        buyerId,
        buyer: { id: buyerId, name: buyerName || null },

        sellerId: s.sellerId,
        sellerName: s.sellerName,

        productId: product?.id,
        fromOfferId:
          product?.meta?.fromOfferId ||
          product?.meta?.fromOffer ||
          null,

        qty: qNum,
        price: priceNum,
        total,
        items: [
          {
            productId: product?.id,
            offerId:
              product?.meta?.fromOfferId ||
              product?.meta?.fromOffer ||
              null,
            qty: qNum,
            price: priceNum,
          },
        ],

        payment: paymentAttrs,
      },
      traits: [
        "mt:order",
        "mt:market",
        ...(financeChoice === "credit" ? ["mt:credit"] : []),
      ],
      meta: {
        ns: product?.meta?.ns ?? "mt:market",
        ts: new Date().toISOString(),

        fromOfferId:
          product?.meta?.fromOfferId ||
          product?.meta?.fromOffer ||
          null,

        caja: {
          id: activeCajero.id,
          nombre: activeCajero.nombre,
        },

        pay: {
          mode: "cajero",
          recommendedCajeroId: activeCajero.id,
          finance:
            financeChoice === "credit" && creditPreview
              ? {
                  mode: "credit",
                  creditEnabled: true,
                  credit: {
                    downPaymentMin: creditPreview.downPaymentMin,
                    installmentCount: creditPreview.installmentCount,
                    installmentValue: creditPreview.installmentValue,
                    interval: creditPreview.interval,
                    every: creditPreview.every,
                    guaranteeMode: creditPreview.guaranteeMode,
                    note: creditPreview.note || null,
                    productId: product?.id ?? null,
                    sourceKind: creditPreview.sourceKind,
                  },
                }
              : { mode: "cash", creditEnabled: false },
        },

        source: "ms.web.checkout",
      },
    } as any);

    await spore?.sayIntent?.({
      sym: financeChoice === "credit" ? "📒" : "🛒",
      say: "market.order.create",
      with: {
        orderId: s.orderId,
        threadId: s.threadId,

        productId: product?.id,
        fromOfferId:
          product?.meta?.fromOfferId ||
          product?.meta?.fromOffer ||
          null,

        qty: qNum,
        price: priceNum,
        total,
        items: [
          {
            productId: product?.id,
            offerId:
              product?.meta?.fromOfferId ||
              product?.meta?.fromOffer ||
              null,
            qty: qNum,
            price: priceNum,
          },
        ],

        buyerId,
        buyer: { id: buyerId, name: buyerName || null },

        sellerId: s.sellerId,
        sellerName: s.sellerName,

        payment: paymentAttrs,

        meta: {
          ns: product?.meta?.ns ?? "mt:market",

          fromOfferId:
            product?.meta?.fromOfferId ||
            product?.meta?.fromOffer ||
            null,

          caja: {
            id: activeCajero.id,
            nombre: activeCajero.nombre,
          },

          pay: {
            mode: "cajero",
            recommendedCajeroId: activeCajero.id,
          },
        },
      },
    });

    if (financeChoice === "credit") {
      await createCreditFlow({
        orderId: s.orderId,
        threadId: s.threadId,
        sellerId: s.sellerId,
        sellerName: s.sellerName,
        total,
      });

      setMsg("Crédito creado ✅ Pedido enviado al cajero ✅");
      onDone({
        orderId: s.orderId,
        threadId: s.threadId,
        receiptId: docs.receiptDV?.id,
        invoiceId: docs.invoiceDV?.id,
      });
      return;
    }

    if (autoDebit) {
      await emitMandateCreate({
        sellerId: s.sellerId,
        sellerName: s.sellerName ?? undefined,
        buyerId,
        buyerName: buyerName || undefined,

        amountMax: total,
        currency: paymentOffer?.attrs?.currency || "PYG",
        interval: "monthly",
        every: 1,

        productId: product?.id,
        ns: product?.meta?.ns ?? "mt:market",
        note: "Mandate creado desde checkout",
      });
    }

    setMsg(
      autoDebit
        ? "Pedido enviado ✅ + Débito automático activado ✅"
        : "Pedido enviado al cajero ✅"
    );

    onDone({
      orderId: s.orderId,
      threadId: s.threadId,
      receiptId: docs.receiptDV?.id,
      invoiceId: docs.invoiceDV?.id,
    });
  } catch (e: any) {
    setMsg(e?.message || "No se pudo completar el checkout");
  } finally {
    setBusy(false);
  }
};const cannotConfirm = busy || !activeCajero;
  const intervalText =
    creditPreview?.interval === "monthly"
      ? "mes"
      : creditPreview?.interval === "weekly"
      ? "semana"
      : creditPreview?.interval === "daily"
      ? "día"
      : creditPreview?.interval || "";

  useEffect(() => {
    if (!open || !product?.id || !buyerId) return;

    emitPresence({
      id: `presence:checkout:${String(buyerId)}:${String(product?.id)}`,
      ns: product?.meta?.ns ?? "mt:market",
      kind: "presence.signal",
      title: `Checkout ${compactProductLabel(product)}`,
      subtitle: currentStage,
      description: `Pago ${payMethod} · ${financeChoice} · ${entryMethod}`,
      actorId: String(buyerId || ""),
      productId: String(product?.id || ""),
      threadId: checkoutThreadId,
      actions: [],
      meta: {
        scope: "checkout",
        stage: currentStage,
        sellerId,
        sellerName,
        cajeroId: activeCajero?.id || null,
        payMethod,
        financeChoice,
        qty,
        total: totalNum,
        currency: String(product?.currency || product?.attrs?.currency || "PYG"),
        entryMethod,
        actorName: String(buyerName || "Comprador"),
        targetKind: "product",
        targetId: String(product?.id || ""),
        targetTitle: compactProductLabel(product),
        ts: new Date().toISOString(),
        source: "ms.web.checkout.presence",
        ttl_ms: 1000 * 30,
      },
    });
  }, [
    open,
    product,
    buyerId,
    buyerName,
    checkoutThreadId,
    currentStage,
    payMethod,
    financeChoice,
    entryMethod,
    emitPresence,
    qty,
    totalNum,
    sellerId,
    sellerName,
    activeCajero?.id,
  ]);
  useEffect(() => {
  if (!open || !product?.id || !buyerId) return;

  const s = ensureSession();

 const sessionAmount = Math.max(
  0,
  Number(
    totalNum ||
      unitPriceNum * Math.max(1, Number(qty || 1)) ||
      product?.precio ||
      product?.price ||
      0
  )
);

void emitPaymentSessionOpen({
  sessionId: `session:${s.orderId}`,
  orderId: s.orderId,
  threadId: s.threadId,
  sellerId: s.sellerId,
  sellerName: s.sellerName,
  buyerId: resolveCheckoutBuyerId(buyerId, buyerName),
  buyerName: buyerName || undefined,
  amount: sessionAmount,
  currency:
    paymentOffer?.attrs?.currency ||
    product?.meta?.pay?.currency ||
    product?.attrs?.currency ||
    product?.currency ||
    "PYG",
  suggested: recommendedMethod,
  note: `Checkout abierto · ${entryMethod}`,
  ns: product?.meta?.ns ?? "mt:market",
  source: "ms.web.checkout.sessionOpen",
});
}, [
  open,
  product,
  buyerId,
  buyerName,
  totalNum,
  paymentOffer?.attrs?.currency,
  recommendedMethod,
  entryMethod,
]);

  useEffect(() => {
    if (!open || !product?.id || !buyerId) return;

    const s = ensureSession();
    const near = checkoutNearby.length > 0 || !!activeCajero?.id;

    void emitPaymentProximity({
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      buyerId,
      buyerName: buyerName || undefined,
      cajeroId: activeCajero?.id ?? null,
      cajeroName: activeCajero?.nombre ?? null,
      orderId: s.orderId,
      mandateId: null,
      threadId: s.threadId,
      near,
      confidence:
        checkoutByEntry?.qr?.length > 0 || checkoutByEntry?.nfc?.length > 0
          ? 0.95
          : checkoutNearby.length > 0
          ? 0.82
          : activeCajero?.id
          ? 0.75
          : 0.45,
      distanceHint:
        checkoutByEntry?.qr?.length > 0 || checkoutByEntry?.nfc?.length > 0
          ? "entry-detected"
          : checkoutNearby.length > 0
          ? "nearby"
          : "manual",
      sourceHint: "checkout.modal",
      note: `Checkout abierto · ${entryMethod}`,
      ns: product?.meta?.ns ?? "mt:market",
      source: "ms.web.checkout.proximity",
    });
  }, [
    open,
    product,
    buyerId,
    buyerName,
    activeCajero?.id,
    activeCajero?.nombre,
    checkoutNearby.length,
    checkoutByEntry?.qr?.length,
    checkoutByEntry?.nfc?.length,
    entryMethod,
  ]);

  useEffect(() => {
    if (!open || !product?.id || !buyerId) return;

    const s = ensureSession();

    const expiresAt = new Date(Date.now() + 1000 * 60 * 5).toISOString();

    void emitPaymentProposal({
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      buyerId,
      buyerName: buyerName || undefined,
      orderId: s.orderId,
      mandateId: null,
      threadId: s.threadId,
      recommended: recommendedMethod,
      alternatives: alternativeMethods,
      amount: totalNum,
      currency:
        paymentOffer?.attrs?.currency ||
        product?.meta?.pay?.currency ||
        product?.currency ||
        "PYG",
      reason: proposalReason,
      expiresAt,
      note: `Propuesta automática desde checkout (${entryMethod})`,
      ns: product?.meta?.ns ?? "mt:market",
      source: "ms.web.checkout.proposal",
    });
  }, [
    open,
    product,
    buyerId,
    buyerName,
    totalNum,
    paymentOffer?.attrs?.currency,
    recommendedMethod,
    alternativeMethods,
    proposalReason,
    entryMethod,
  ]);

  useEffect(() => {
    if (!open) {
      try {
        clearSignals?.();
      } catch {}
    }
  }, [open, clearSignals]);

  if (!shouldRender) return null;

  return (
    <>
      <Backdrop onClick={onClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <TopRow>
            <div style={{ fontWeight: 950 }}>Checkout</div>
            <Btn kind="ghost" onClick={onClose} disabled={busy}>
              Cerrar
            </Btn>
          </TopRow>

          <RowStart>
            {!!img && (
              <Thumb
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!galleryImages.length) return;
                  setGalleryIndex(0);
                  setGalleryOpen(true);
                }}
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    galleryImages.length
                  ) {
                    setGalleryIndex(0);
                    setGalleryOpen(true);
                  }
                }}
                title="Ver imágenes"
              >
                <img
                  src={img}
                  alt={safeStr(product?.nombre || product?.name || "Producto")}
                />
                {galleryImages.length > 1 && (
                  <ThumbBadge>+{galleryImages.length - 1}</ThumbBadge>
                )}
              </Thumb>
            )}

            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {safeStr(product?.nombre || product?.name || "Producto")}
              </div>
              <Subtle>
                Precio: {unitPriceStr} /{" "}
                {safeStr(product?.unidad || product?.unit || "u")}
              </Subtle>
              <Subtle>Stock: {product?.stock ?? "—"}</Subtle>
            </div>
          </RowStart>

          {!!galleryImages.length && (
            <GalleryStrip>
              {galleryImages.slice(0, 8).map((src, i) => (
                <MiniThumb
                  key={`${src}-${i}`}
                  onClick={() => {
                    setGalleryIndex(i);
                    setGalleryOpen(true);
                  }}
                  title={`Abrir imagen ${i + 1}`}
                >
                  <img src={src} alt={`preview-${i + 1}`} />
                </MiniThumb>
              ))}
            </GalleryStrip>
          )}

          <Card>
            <Card>
  <div style={{ fontWeight: 950 }}>UTOPY Liquidity</div>
  <Subtle>
    Este panel muestra la liquidez viva del comprador para este checkout.
    La liquidez del comercio se ve completa en el Pay Center cuando la sesión se cierra.
  </Subtle>

  <MtLiquidityPanel
    actorId={buyerId}
    actorName={buyerName || buyerId}
    defaultCurrency={
      paymentOffer?.attrs?.currency ||
      product?.meta?.pay?.currency ||
      product?.attrs?.currency ||
      product?.currency ||
      "PYG"
    }
    onUseInCheckout={(payload) => {
      setMsg(
        `Liquidez detectada: ${Math.round(payload.spendable).toLocaleString("es-PY")} ${payload.currency} · trust ${Math.round(payload.trustScore * 100)}%`
      );
    }}
    onOpenPayCenter={() => {
      setMsg("Abrí el Pay Center para ver liquidez del comprador y del comercio.");
    }}
  />
</Card>
            <Subtle>
              Método recomendado:{" "}
              <b>{safeStr(recommendedMethod?.label || recommendedMethod?.channel || "—")}</b>
            </Subtle>
            <Subtle>
              Razón: <b>{proposalReason}</b>
            </Subtle>
            {!!alternativeMethods.length && (
              <Subtle>
                Alternativas:{" "}
                <b>
                  {alternativeMethods
                    .map((m: any) => safeStr(m?.label || m?.channel))
                    .filter(Boolean)
                    .slice(0, 5)
                    .join(", ")}
                </b>
              </Subtle>
            )}
          </Card>

          {open && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              {checkoutNearby.length >= 2 ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  👀 {checkoutNearby.length} presencia(s) cerca
                </div>
              ) : null}

              {checkoutByEntry.qr.length > 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  QR {checkoutByEntry.qr.length}
                </div>
              ) : null}

              {checkoutByEntry.nfc.length > 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  NFC {checkoutByEntry.nfc.length}
                </div>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <PresenceNowChip
                  presences={checkoutWatchingNow}
                  selfActorId={buyerId}
                  productId={String(product?.id || "")}
                  threadId={checkoutThreadId}
                  minCount={1}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <PresenceRadar
                  meId={buyerId}
                  presences={checkoutWatchingNow}
                  minCount={2}
                />
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                etapa: {currentStage}
              </div>
            </div>
          )}

          <RowGap>
            <label style={{ fontWeight: 900 }}>Cantidad</label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
            />
          </RowGap>

          <RowGap style={{ justifyContent: "space-between" }}>
            <Subtle>Total</Subtle>
            <Price>{totalStr}</Price>
          </RowGap>

          {payMethod === "cajero" && (
            <Subtle>
              Debug crédito:{" "}
              {creditPlan
                ? `plan encontrado (${creditPlan.id})`
                : embeddedCredit
                ? "usando financiamiento desde product.meta.pay.finance.credit"
                : "sin plan"}
            </Subtle>
          )}

         <Section>
  <div style={{ fontWeight: 950 }}>Método de pago</div>

  <Card>
    <Subtle>
      Método activo: <b>Cajero / UTOPY Pay</b>
    </Subtle>

    <Subtle>
      Cajero: <b>{activeCajero?.nombre ?? "Ninguno"}</b>
    </Subtle>

    {!activeCajero && (
      <Btn kind="ghost" onClick={onNeedCajero}>
        Elegir cajero
      </Btn>
    )}
  </Card>

  {paymentOffer && (
    <Card>
      <div style={{ fontWeight: 950 }}>Métodos que acepta el cajero</div>

      {!!paymentOffer?.attrs?.text && (
        <Subtle>{paymentOffer.attrs.text}</Subtle>
      )}

      <div style={{ display: "grid", gap: 4 }}>
        {(paymentOffer?.attrs?.accepted || []).map((m: any, i: number) => (
          <Subtle key={i}>
            • <b>{safeStr(m?.label || m?.channel)}</b>
          </Subtle>
        ))}
      </div>

      {paymentOffer?.attrs?.currency && (
        <Subtle style={{ opacity: 0.7 }}>
          Moneda: <b>{paymentOffer.attrs.currency}</b>
        </Subtle>
      )}
    </Card>
  )}

  {creditEnabled && creditPreview && (
    <Card>
      <div style={{ fontWeight: 950 }}>Financiación disponible</div>

      <RadioRow>
        <input
          type="radio"
          name="financeChoice"
          checked={financeChoice === "cash"}
          onChange={() => setFinanceChoice("cash")}
        />
        Pagar contado
      </RadioRow>

      <RadioRow>
        <input
          type="radio"
          name="financeChoice"
          checked={financeChoice === "credit"}
          onChange={() => {
            setFinanceChoice("credit");
            setAutoDebit(false);
          }}
        />
        Comprar a crédito
      </RadioRow>

      {financeChoice === "credit" && (
        <PlanBox>
          <Subtle>
            <b>Producto:</b>{" "}
            {safeStr(product?.nombre || product?.name || product?.id || "—")}
          </Subtle>

          <Subtle>
            <b>Entrega mínima:</b>{" "}
            {creditPreview.downPaymentMin.toLocaleString("es-PY")}{" "}
            {creditPreview.currency}
          </Subtle>

          <Subtle>
            <b>Saldo financiado:</b>{" "}
            {creditPreview.financed.toLocaleString("es-PY")}{" "}
            {creditPreview.currency}
          </Subtle>

          <Subtle>
            <b>Cuotas:</b> {creditPreview.installmentCount} de{" "}
            {creditPreview.installmentValue.toLocaleString("es-PY")}{" "}
            {creditPreview.currency}
          </Subtle>

          <Subtle>
            <b>Frecuencia:</b> cada {creditPreview.every} {intervalText}
          </Subtle>

          <Subtle>
            <b>Garantía:</b> {creditPreview.guaranteeMode}
          </Subtle>

          {!!creditPreview.note && (
            <Subtle>
              <b>Nota:</b> {creditPreview.note}
            </Subtle>
          )}
        </PlanBox>
      )}
    </Card>
  )}

  {financeChoice !== "credit" && (
    <Card>
      <div style={{ fontWeight: 950 }}>Débito automático</div>

      <RadioRow>
        <input
          type="checkbox"
          checked={autoDebit}
          onChange={(e) => setAutoDebit(e.target.checked)}
        />
        Activar débito automático (suscripción)
      </RadioRow>

      {autoDebit && (
        <Subtle style={{ opacity: 0.75 }}>
          Se crea un <b>mandate</b> mensual con monto máximo ={" "}
          <b>{totalStr}</b>.
        </Subtle>
      )}
    </Card>
  )}

  <Card>
    <Subtle>Comprobante / Nota de pago (opcional)</Subtle>

    <Input
      value={proofText}
      onChange={(e) => setProofText(e.target.value)}
      placeholder="Ej: Transferí a alias JUAN123, comprobante #8841 / link ..."
    />

    <Btn
      kind="ghost"
      disabled={paidBusy}
      onClick={() => void enviarComprobante()}
    >
      {paidBusy ? "Enviando..." : "Enviar comprobante 🧾"}
    </Btn>
  </Card>
</Section>

          {msg && <Subtle style={{ marginTop: 6 }}>{msg}</Subtle>}

          <Actions>
            <Btn kind="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Btn>
            <Btn kind="solid" onClick={confirmar} disabled={cannotConfirm}>
  {busy
    ? "Procesando..."
    : financeChoice === "credit"
    ? "Crear crédito"
    : "Enviar pedido"}
</Btn>
          </Actions>
        </Modal>
      </Backdrop>

      {galleryOpen && galleryImages.length > 0 && (
        <GalleryBackdrop onClick={() => setGalleryOpen(false)}>
          <GalleryModal onClick={(e) => e.stopPropagation()}>
            <GalleryTop>
              <div style={{ fontWeight: 900 }}>
                {galleryIndex + 1} / {galleryImages.length}
              </div>
              <Btn kind="ghost" onClick={() => setGalleryOpen(false)}>
                Cerrar
              </Btn>
            </GalleryTop>

            <GalleryStage>
              {galleryImages.length > 1 && (
                <NavBtn
                  left
                  onClick={() =>
                    setGalleryIndex(
                      (v) => (v - 1 + galleryImages.length) % galleryImages.length
                    )
                  }
                >
                  ‹
                </NavBtn>
              )}

              <GalleryImage
                src={galleryImages[galleryIndex]}
                alt={`gallery-${galleryIndex + 1}`}
              />

              {galleryImages.length > 1 && (
                <NavBtn
                  onClick={() =>
                    setGalleryIndex((v) => (v + 1) % galleryImages.length)
                  }
                >
                  ›
                </NavBtn>
              )}
            </GalleryStage>

            <GalleryThumbs>
              {galleryImages.map((src, i) => (
                <GalleryMini
                  key={`${src}-${i}`}
                  active={i === galleryIndex}
                  onClick={() => setGalleryIndex(i)}
                >
                  <img src={src} alt={`mini-${i + 1}`} />
                </GalleryMini>
              ))}
            </GalleryThumbs>
          </GalleryModal>
        </GalleryBackdrop>
      )}
    </>
  );
}

/* ---------- UI responsive ---------- */
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 9998;
  padding: 14px;
`;

const Modal = styled.div`
  width: min(520px, 96vw);
  max-height: min(86vh, 760px);
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 24px 60px rgba(0,0,0,0.22);
  padding: 14px;
  display: grid;
  gap: 10px;
`;

const TopRow = styled.div`
  display:flex;
  align-items:center;
  justify-content:space-between;
`;

const RowStart = styled.div`
  display:flex;
  gap:10px;
  align-items:center;
`;

const RowGap = styled.div`
  display:flex;
  gap:10px;
  align-items:center;
  justify-content:space-between;
`;

const Thumb = styled.div`
  width:64px;
  height:64px;
  border-radius:12px;
  overflow:hidden;
  background:#f2f2f2;
  flex:0 0 auto;
  cursor:pointer;
  position:relative;

  img {
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
`;

const ThumbBadge = styled.div`
  position:absolute;
  right:4px;
  bottom:4px;
  background:rgba(0,0,0,0.7);
  color:#fff;
  border-radius:999px;
  padding:2px 6px;
  font-size:0.72rem;
  font-weight:900;
`;

const GalleryStrip = styled.div`
  display:flex;
  gap:8px;
  overflow:auto;
  padding-bottom:2px;
`;

const MiniThumb = styled.button`
  width:52px;
  height:52px;
  padding:0;
  border:none;
  border-radius:10px;
  overflow:hidden;
  background:#f2f2f2;
  cursor:pointer;
  flex:0 0 auto;

  img {
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
`;

const Section = styled.div`
  display:grid;
  gap:10px;
`;

const Card = styled.div`
  border:1px solid rgba(0,0,0,0.06);
  border-radius:12px;
  padding:10px;
  display:grid;
  gap:6px;
`;

const PlanBox = styled.div`
  border:1px solid rgba(0,0,0,0.08);
  border-radius:12px;
  padding:10px;
  background:rgba(0,0,0,0.03);
  display:grid;
  gap:6px;
  margin-top:4px;
`;

const RadioRow = styled.label`
  display:flex;
  gap:8px;
  align-items:center;
  user-select:none;
`;

const Subtle = styled.div`
  font-size:0.9rem;
  opacity:0.82;
`;

const Price = styled.div`
  font-weight:950;
`;

const Input = styled.input`
  border:1px solid rgba(0,0,0,0.14);
  border-radius:10px;
  padding:8px 10px;
  width:100%;
`;

const Actions = styled.div`
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top:4px;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border:1px solid rgba(0,0,0,0.14);
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:950;
  background:${({ kind }) => (kind === "solid" ? "#111" : "#fff")};
  color:${({ kind }) => (kind === "solid" ? "#fff" : "#111")};
  opacity:${({ disabled }) => (disabled ? 0.6 : 1)};
  pointer-events:${({ disabled }) => (disabled ? "none" : "auto")};
`;

const GalleryBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 10020;
  padding: 16px;
`;

const GalleryModal = styled.div`
  width: min(920px, 96vw);
  max-height: 92vh;
  background: #111;
  color: #fff;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 30px 80px rgba(0,0,0,0.4);
  padding: 12px;
  display: grid;
  gap: 10px;
`;

const GalleryTop = styled.div`
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
`;

const GalleryStage = styled.div`
  position: relative;
  min-height: min(70vh, 620px);
  display: grid;
  place-items: center;
  background: rgba(255,255,255,0.03);
  border-radius: 14px;
  overflow: hidden;
`;

const GalleryImage = styled.img`
  max-width: 100%;
  max-height: min(70vh, 620px);
  object-fit: contain;
  display: block;
`;

const NavBtn = styled.button<{ left?: boolean }>`
  position: absolute;
  top: 50%;
  ${({ left }) => (left ? "left: 10px;" : "right: 10px;")}
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-size: 1.4rem;
  cursor: pointer;
`;

const GalleryThumbs = styled.div`
  display:flex;
  gap:8px;
  overflow:auto;
  padding-bottom:2px;
`;

const GalleryMini = styled.button<{ active?: boolean }>`
  width: 64px;
  height: 64px;
  padding: 0;
  border-radius: 10px;
  overflow: hidden;
  flex: 0 0 auto;
  cursor: pointer;
  border: 2px solid ${({ active }) => (active ? "#fff" : "rgba(255,255,255,0.15)")};
  background: #222;

  img {
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
`;