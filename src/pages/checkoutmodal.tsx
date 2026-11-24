// src/mt/CheckoutModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useProductMotionSurface } from "../components/productMotion";
import { useCapabilityPresence } from '../utopy/useCapabilityPresence';

import { mtLiveSubscribe } from "../mt/mt.liveStore";
import { useLocalBuyerIdentity } from "../mt/uselocalbuyerindentity";
import { spore } from "../utopy/spore.singleton";

import {
  buildSubscriptionEventDV,
  publishSubscriptionDV,
} from "../mt/mt.subscriptionIntent";
import { findLatestPaymentOffer, safeStr } from "../mt/resolveOffer";
import { usePresenceEmitter } from "../utopy/presence/usepresenceemitter";
import usePresenceScanner from "./usepresencescanner";
import PresenceNowChip from "../utopy/presence/PresenceNowChip";
import PresenceRadar from "../utopy/presence/PresenceRadar";
import { emitPaymentSessionOpen } from "../mt/paymentsession";
import { bootLiquidityRuntime, ingestLiquidityDV } from "../liquidity/liquidityruntime";
import { emitPaymentPulseOpen } from "../liquidity/utopypaypulse";
import {
  getUtopyPayView,
  openUtopyPaySession,
  startUtopyPayRuntime,
} from "../pay/utopyPay";
import type { UtopyPayView } from "../pay/utopyPay.types";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import {
  buildRelationshipRequestDV,
} from "../utopy/relationshipProtocol";
import {
  buildCreditRequestDV,
  matchCreditOffers,
  projectCreditDecision,
  publishCreditRequest,
  verifyCreditOffer,
} from "../liquidity/creditNetwork";
import { projectLivingVault } from "../vault/vault.engine";
import { buildValueRedemptionRequestDV } from "../vault/vault.builders";
import { publishVaultDV } from "../vault/vault.publish";
import { useVerifiedAuthorizedDVs } from "../utopy/useVerifiedAuthorizedDVs";
import { useVerifiedNodeManifests } from "../utopy/useVerifiedNodeManifests";
import { readPublishedMerchandising } from "../mt/productMerchandising";
import { projectLiquidityProximity } from "../liquidity/projectLiquidityProximity";
import { projectUniversalProduct } from "../components/UniversalProductDialog";
import {
  buildIdentityLinkRequestDV,
  projectIdentityLinks,
  publishIdentityLinkActorDV,
} from "../utopy/identityLink";
import {
  CHECKOUT_PURCHASE_CYCLE_KINDS,
  buildPrivatePaymentProofDV,
  projectCheckoutPurchaseCycle,
  resolvePrivatePaymentProofRoute,
  uploadPrivatePaymentProof,
  validatePaymentProofFile,
} from "../mt/mt.checkoutPurchaseCycle";

const CHECKOUT_VAULT_KINDS = [
  "benefit.program",
  "benefit.acceptance",
  "value.stamp",
  "value.right",
  "value.redemption.request",
  "value.redemption.outcome",
  "identity.link.request",
  "identity.link.challenge",
  "identity.link.proof",
  "identity.link.accepted",
  "identity.link.active",
  "identity.link.revoke.request",
  "identity.link.revoked",
] as const;

const CHECKOUT_FINANCE_KINDS = [
  "credit.request",
  "credit.decision",
  "finance.decision",
] as const;

function sanitizeIdPart(x: any, fb = "unknown") {
  const s = String(x ?? "").trim();
  if (!s) return fb;
  return s.replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

function resolveCheckoutBuyerId(rawBuyerId: any, rawBuyerName?: any) {
  const cleanId = sanitizeIdPart(rawBuyerId, "");
  if (cleanId && !/^buyer:(anon|guest|local)/i.test(cleanId)) return cleanId;
  return "";
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
  // El comercio/nodo es el destinatario económico. El cajero es solamente operador.
  return String(
    product?.sellerId ||
      product?.attrs?.sellerId ||
      product?.storeId ||
      product?.attrs?.storeId ||
      product?.vendor?.id ||
      product?.attrs?.vendor?.id ||
      product?.contact?.sellerId ||
      product?.attrs?.contact?.sellerId ||
      product?.targetAuthor?.id ||
      product?.attrs?.targetAuthor?.id ||
      product?.meta?.authority ||
      product?.attrs?.authority ||
      product?.meta?.originNode ||
      product?.attrs?.originNode ||
      ""
  );
}

function resolveCheckoutSellerName(product: any) {
  return String(
    product?.sellerName ||
      product?.attrs?.sellerName ||
      product?.storeName ||
      product?.attrs?.storeName ||
      product?.vendor?.name ||
      product?.attrs?.vendor?.name ||
      product?.contact?.sellerName ||
      product?.attrs?.contact?.sellerName ||
      product?.targetAuthor?.name ||
      product?.attrs?.targetAuthor?.name ||
      product?.meta?.storeName ||
      "Comercio"
  );
}

type CheckoutNodeIdentity = {
  sellerId: string;
  sellerName: string | null;
  storeId: string | null;
  storeName: string | null;
  nodeId: string | null;
  originNode: string | null;
  authority: string | null;
  manifest: any | null;
  capabilities: string[];
};

function normalizeNodeIdentityPart(input: unknown) {
  return String(input ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^utopy\.node\./, "")
    .replace(/^node:/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueText(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function nodeAliases(source: any) {
  const attrs = source?.attrs || {};
  const meta = source?.meta || {};
  const vendor = attrs?.vendor || source?.vendor || {};
  const contact = attrs?.contact || source?.contact || {};

  return uniqueText([
    source?.sellerId,
    source?.storeId,
    source?.nodeId,
    source?.authority,
    source?.originNode,

    attrs?.sellerId,
    attrs?.storeId,
    attrs?.nodeId,
    attrs?.authority,
    attrs?.originNode,
    attrs?.sellerName,
    attrs?.storeName,

    vendor?.id,
    vendor?.name,
    contact?.sellerId,
    contact?.sellerName,

    meta?.authority,
    meta?.originNode,
    meta?.nodeId,
    meta?.storeId,
  ])
    .map(normalizeNodeIdentityPart)
    .filter(Boolean);
}

function isNodeManifestDV(dv: any) {
  const kind = String(dv?.kind || "").trim().toLowerCase();
  return (
    kind === "utopy.node.manifest" ||
    kind === "node.manifest" ||
    kind === "utopy.node.profile" ||
    kind === "node.profile"
  );
}

function readCapabilityStrings(source: any): string[] {
  const attrs = source?.attrs || {};
  const manifestCaps = Array.isArray(attrs?.capabilities)
    ? attrs.capabilities
    : Array.isArray(source?.capabilities)
      ? source.capabilities
      : [];

  const provides = Array.isArray(attrs?.provides) ? attrs.provides : [];
  const accepts = Array.isArray(attrs?.accepts) ? attrs.accepts : [];
  const produces = Array.isArray(attrs?.produces) ? attrs.produces : [];
  const traits = Array.isArray(source?.traits) ? source.traits : [];

  return uniqueText([
    ...manifestCaps.flatMap((capability: any) =>
      typeof capability === "string"
        ? [capability]
        : [
            capability?.id,
            capability?.kind,
            capability?.name,
            capability?.label,
            capability?.purpose,
          ],
    ),
    ...provides,
    ...accepts,
    ...produces,
    ...traits,
  ]);
}

function resolveCheckoutNodeIdentity(
  product: any,
  allDvs: any[],
): CheckoutNodeIdentity {
  const productAliasSet = new Set(nodeAliases(product));
  const manifests = (Array.isArray(allDvs) ? allDvs : [])
    .filter(isNodeManifestDV)
    .filter((manifest) => {
      const aliases = nodeAliases(manifest);
      return aliases.some((alias) => productAliasSet.has(alias));
    })
    .sort((a, b) => parseTs(b) - parseTs(a));

  const manifest = manifests[0] || null;
  const ma = manifest?.attrs || {};
  const pa = product?.attrs || {};
  const pm = product?.meta || {};

  const sellerId = String(
    product?.sellerId ||
      pa?.sellerId ||
      ma?.sellerId ||
      product?.storeId ||
      pa?.storeId ||
      ma?.storeId ||
      ma?.nodeId ||
      pm?.authority ||
      ma?.authority ||
      resolveCheckoutSellerId(product),
  );

  const sellerName =
    String(
      product?.sellerName ||
        pa?.sellerName ||
        ma?.sellerName ||
        product?.storeName ||
        pa?.storeName ||
        ma?.storeName ||
        ma?.name ||
        resolveCheckoutSellerName(product) ||
        "",
    ).trim() || null;

  const storeId =
    String(
      product?.storeId ||
        pa?.storeId ||
        ma?.storeId ||
        "",
    ).trim() || null;

  const storeName =
    String(
      product?.storeName ||
        pa?.storeName ||
        ma?.storeName ||
        ma?.name ||
        sellerName ||
        "",
    ).trim() || null;

  const originNode =
    String(
      pa?.originNode ||
        pm?.originNode ||
        ma?.originNode ||
        ma?.nodeId ||
        "",
    ).trim() || null;

  const nodeId =
    String(
      pa?.nodeId ||
        pm?.nodeId ||
        ma?.nodeId ||
        originNode ||
        "",
    ).trim() || null;

  const authority =
    String(
      pa?.authority ||
        pm?.authority ||
        ma?.authority ||
        sellerId ||
        "",
    ).trim() || null;

  return {
    sellerId,
    sellerName,
    storeId,
    storeName,
    nodeId,
    originNode,
    authority,
    manifest,
    capabilities: uniqueText([
      ...readCapabilityStrings(product),
      ...readCapabilityStrings(manifest),
    ]),
  };
}

function capabilityMatches(capabilities: string[], patterns: RegExp[]) {
  return capabilities.some((capability) => {
    const normalized = String(capability || "").trim().toLowerCase();
    return patterns.some((pattern) => pattern.test(normalized));
  });
}

function buildUniversalDeliveryRequestDV(input: {
  orderId: string;
  threadId: string;
  node: CheckoutNodeIdentity;
  buyerId: string;
  buyerName?: string | null;
  product: any;
  address: string;
  lat?: number | null;
  lng?: number | null;
  paymentSessionId?: string | null;
  paymentStatus?: string | null;
  relationshipId?: string | null;
}) {
  const ts = new Date().toISOString();
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const hasGeo =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  return {
    id: `delivery.request:${input.orderId}`,
    kind: "delivery.request",
    attrs: {
      orderId: input.orderId,
      workId: `delivery:${input.orderId}`,
      threadId: input.threadId,
      chainId: input.orderId,
      relationshipId: input.relationshipId || null,
      rootDvId: input.orderId,
      parentDvId: input.orderId,

      title: `Entregar ${compactProductLabel(input.product)}`,
      description: "Se necesita retirar y entregar este pedido.",
      status: "open",
      state: "open",

      requesterId: input.buyerId,
      requesterName: input.buyerName || null,
      customerActorId: input.buyerId,

      pickupNodeId:
        input.node.nodeId ||
        input.node.originNode ||
        input.node.sellerId,
      pickupStoreId: input.node.storeId,
      pickupName:
        input.node.storeName ||
        input.node.sellerName ||
        "Nodo vendedor",

      destination: {
        address: String(input.address || "").trim() || null,
        lat: hasGeo ? lat : null,
        lng: hasGeo ? lng : null,
        precision: hasGeo ? "private-participants" : null,
      },

      package: {
        productId: input.product?.id || null,
        title: compactProductLabel(input.product),
      },

      paymentSessionId: input.paymentSessionId || null,
      paymentStatus: input.paymentStatus || "waiting",

      requestedCapabilities: [
        "delivery.offer",
        "pickup.perform",
        "package.deliver",
        "delivery.outcome",
      ],

      participants: uniqueText([
        input.buyerId,
        input.node.sellerId,
        input.node.nodeId,
        input.node.originNode,
      ]),

      security: {
        requiresConsent: true,
        automaticAssignment: false,
        exactDestinationPublic: false,
      },
    },
    traits: [
      "delivery:request",
      "work:intent",
      "resonance:intent",
      "frequency:live",
      "utopy:chain",
      "consent:required",
    ],
    meta: {
      ns: "mt:market",
      ts,
      updatedAt: ts,
      threadId: input.threadId,
      chainId: input.orderId,
      originNode: input.node.originNode,
      authority: input.node.authority,
      relationshipId: input.relationshipId || null,
      source: "ms.web.checkout.delivery.universal",
      scopes: ["participants"],
      ttl_ms: 1000 * 60 * 60 * 6,
    },
  };
}

function buildPublicDeliveryIntentDV(deliveryRequest: any) {
  const destination = deliveryRequest?.attrs?.destination || {};
  const lat = Number(destination.lat);
  const lng = Number(destination.lng);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const ts = new Date().toISOString();
  return {
    id: `delivery.intent:${deliveryRequest?.attrs?.orderId}`,
    kind: "delivery.intent",
    attrs: {
      orderId: deliveryRequest?.attrs?.orderId,
      workId: deliveryRequest?.attrs?.workId,
      threadId: deliveryRequest?.attrs?.threadId,
      chainId: deliveryRequest?.attrs?.chainId,
      relationshipId: deliveryRequest?.attrs?.relationshipId,
      rootDvId: deliveryRequest?.attrs?.rootDvId,
      title: deliveryRequest?.attrs?.title || "Entrega disponible",
      status: "open",
      state: "open",
      pickupNodeId: deliveryRequest?.attrs?.pickupNodeId,
      pickupName: deliveryRequest?.attrs?.pickupName,
      requestedCapabilities: deliveryRequest?.attrs?.requestedCapabilities || [],
      approximateDestination: hasGeo
        ? {
            lat: Math.round(lat * 100) / 100,
            lng: Math.round(lng * 100) / 100,
            precision: "approximate-public",
          }
        : null,
      security: {
        exactDestinationPublic: false,
        assignmentRequiresConsent: true,
      },
    },
    traits: ["delivery:intent", "work:intent", "map:visible", "consent:required"],
    meta: {
      ns: "mt:market",
      ts,
      updatedAt: ts,
      threadId: deliveryRequest?.attrs?.threadId,
      chainId: deliveryRequest?.attrs?.chainId,
      relationshipId: deliveryRequest?.attrs?.relationshipId,
      scopes: ["public"],
      source: "ms.web.checkout.delivery.discovery",
      ttl_ms: 1000 * 60 * 60 * 6,
      sensitivity: "ephemeral",
    },
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
  onOpenMap?: (context: {
    productId: string;
    sellerNodeId: string;
    amount: number;
    currency: string;
    buyerActorId: string;
    threadId?: string | null;
    relationshipId?: string | null;
  }) => void;
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

function finiteNumberOrNull(...values: unknown[]): number | null {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function formatCheckoutMoney(value: unknown, currency = "PYG") {
  const amount = num(value, 0);
  const code = String(currency || "PYG").trim().toUpperCase();
  const formatted = Math.round(amount).toLocaleString("es-PY");
  if (code === "PYG" || code === "GS" || code === "GUARANI") return `₲${formatted}`;
  if (code === "BRL") return `R$ ${formatted}`;
  if (code === "USD") return `US$ ${formatted}`;
  return `${formatted} ${code}`;
}

function formatCheckoutDate(value: unknown) {
  const raw = String(value || "").trim();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString("es-PY") : raw;
}

function shortNetworkId(value: unknown) {
  const text = String(value || "").trim();
  if (text.length <= 22) return text || "—";
  return `${text.slice(0, 11)}…${text.slice(-7)}`;
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
  const finance =
    product?.meta?.pay?.finance ||
    product?.meta?.finance ||
    product?.attrs?.pay?.finance ||
    null;
  const c =
    product?.meta?.pay?.finance?.credit ||
    product?.meta?.finance?.credit ||
    product?.attrs?.pay?.finance?.credit ||
    (finance && typeof finance === "object" &&
    ["downPaymentMin", "installmentCount", "interval", "every"].some((key) => key in finance)
      ? finance
      : null) ||
    null;

  if (!c || typeof c !== "object") return null;

  return {
    downPaymentMin: Math.max(0, num(c.downPaymentMin, 0)),
    installmentCount: Math.max(1, num(c.installmentCount, 1)),
    installmentValue:
      c.installmentAmount ?? c.installmentValue ?? c.installmentPrice ?? null,
    financedAmount: c.financedAmount ?? c.totalFinanced ?? null,
    firstDueAt: c.firstDueAt ?? c.firstDue ?? null,
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
        label: "💵 Pagar en el comercio",
        meta: { reason: "active.cajero.present" },
      }
    );
  }

  return findAccepted("transfer") || findAccepted("link") || null;
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

  return out;
}
export default function CheckoutModal({
  open,
  product,
  activeCajero,
  onNeedCajero,
  onClose,
  onOpenMap,
  onDone,
}: CheckoutProps) {
  const shouldRender = !!open && !!product;
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const confirmingRef = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [modifierSelections, setModifierSelections] = useState<
    Record<string, string>
  >({});
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryGeo, setDeliveryGeo] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { emitPresence, clearSignals } = usePresenceEmitter();

  const currentStage = useMemo(() => {
    if (!open) return "closed";
    if (busy) return "confirming";
    return "review";
  }, [open, busy]);

  const [allDvs, setAllDvs] = useState<any[]>([]);

  useEffect(() => {
    if (!open) {
      setAllDvs([]);
      setAdvancedOpen(false);
      return;
    }

    const unsub = mtLiveSubscribe((all: any[]) => {
      setAllDvs(Array.isArray(all) ? all : []);
    });

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    bootLiquidityRuntime();
    return startUtopyPayRuntime();
  }, [open]);

  const ingestedLiquidityRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !allDvs.length) return;

    const seen = ingestedLiquidityRef.current;

    for (const dv of allDvs) {
      const key = [
        String(dv?.id || ""),
        String(dv?.kind || ""),
        String(dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.ts || ""),
      ].join("|");

      if (!key || seen.has(key)) continue;
      seen.add(key);
      ingestLiquidityDV(dv);
    }

    // Evita que una sesión muy larga conserve una tabla ilimitada.
    if (seen.size > 8_000) {
      const recent = Array.from(seen).slice(-4_000);
      ingestedLiquidityRef.current = new Set(recent);
    }
  }, [open, allDvs]);

  const [submittedOrder, setSubmittedOrder] = useState<any | null>(null);
  const [financeRequestId, setFinanceRequestId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofUploadBusy, setProofUploadBusy] = useState(false);
  const [selectedNodeMethod, setSelectedNodeMethod] = useState("");
  const [waitingLong, setWaitingLong] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const cameraProofInputRef = useRef<HTMLInputElement | null>(null);
  const galleryProofInputRef = useRef<HTMLInputElement | null>(null);
  const [recurringProposal, setRecurringProposal] = useState(false);
  const [utopyPayView, setUtopyPayView] = useState<UtopyPayView | null>(null);
const [activePulse, setActivePulse] = useState<any | null>(null);
const [pulseTick, setPulseTick] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { name: buyerName, buyerId: rawBuyerId, ready: identityReady } = useLocalBuyerIdentity();

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

  const { verifiedManifests: nodeManifests } = useVerifiedNodeManifests(allDvs);

  const nodeIdentity = useMemo(
    () => resolveCheckoutNodeIdentity(product, nodeManifests),
    [
      product?.id,
      product?.sellerId,
      product?.storeId,
      product?.attrs?.sellerId,
      product?.attrs?.storeId,
      product?.attrs?.nodeId,
      product?.attrs?.originNode,
      product?.attrs?.authority,
      product?.meta?.originNode,
      product?.meta?.authority,
      nodeManifests,
    ],
  );

  const nodeCapabilities = nodeIdentity.capabilities;

  const canonicalProduct = useMemo(() => projectUniversalProduct(product), [product]);
  const presence=useCapabilityPresence(allDvs);
  const orderPresence=presence(canonicalProduct.sellerNodeId);
  const nodePaused=orderPresence.checking||orderPresence.status==='paused'||orderPresence.status==='resting';
  const productUnavailable = !canonicalProduct.available || nodePaused;

  const modifierGroups = useMemo(
    () =>
      Array.isArray(product?.attrs?.modifiers)
        ? product.attrs.modifiers
        : Array.isArray(product?.modifiers)
          ? product.modifiers
          : [],
    [product],
  );

  const supportsModifiers = modifierGroups.length > 0;

  const supportsDelivery = useMemo(
    () =>
      product?.attrs?.delivery?.enabled === true ||
      product?.attrs?.fulfillment?.delivery === true ||
      capabilityMatches(nodeCapabilities, [
        /delivery/,
        /logistic/,
        /pickup/,
        /package\.deliver/,
        /entrega/,
        /repart/,
      ]),
    [product, nodeCapabilities],
  );

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const group of modifierGroups) {
      const options = Array.isArray(group?.options) ? group.options : [];
      const selected = options.find((option: any) => option?.default) || options[0];
      if (group?.id && selected?.id) defaults[String(group.id)] = String(selected.id);
    }
    setModifierSelections(defaults);
    setDeliveryMode("pickup");
    setDeliveryAddress("");
    setDeliveryGeo(null);
  }, [product?.id, modifierGroups]);

  const selectedModifiers = useMemo(() => {
    return modifierGroups
      .map((group: any) => {
        const options = Array.isArray(group?.options) ? group.options : [];
        const selected =
          options.find(
            (option: any) =>
              String(option?.id || "") ===
              String(modifierSelections[String(group?.id || "")] || ""),
          ) ||
          options.find((option: any) => option?.default) ||
          options[0];
        if (!selected) return null;
        return {
          group_id: String(group?.id || ""),
          group_label: String(group?.label || group?.id || ""),
          option_id: String(selected?.id || ""),
          label: String(selected?.label || selected?.id || ""),
          price_delta: num(selected?.price_delta, 0),
        };
      })
      .filter(Boolean) as Array<{
      group_id: string;
      group_label: string;
      option_id: string;
      label: string;
      price_delta: number;
    }>;
  }, [modifierGroups, modifierSelections]);

  const modifierDelta = useMemo(
    () =>
      selectedModifiers.reduce(
        (total, modifier) => total + num(modifier.price_delta, 0),
        0,
      ),
    [selectedModifiers],
  );

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
  const [selectedFinanceOptionId, setSelectedFinanceOptionId] = useState("seller");
  const [selectedRightId, setSelectedRightId] = useState("");
  const [selectedLiquidityOptionId, setSelectedLiquidityOptionId] = useState("");

  // Cada señal automática se emite una sola vez por estado significativo.
  // Esto corta los ciclos: emitir DV → cambia mt.liveStore → render → volver a emitir.
  const emissionSignaturesRef = useRef<Record<string, string>>({});

  const shouldEmitAutomatic = (channel: string, signature: string) => {
    if (!signature) return false;
    if (emissionSignaturesRef.current[channel] === signature) return false;
    emissionSignaturesRef.current[channel] = signature;
    return true;
  };

  const merchandising = useMemo(() => readPublishedMerchandising(product), [product]);
  const unitPriceNum = useMemo(
    () =>
      Math.max(
        0,
        num(merchandising.finalPrice ?? product?.precio ?? product?.price ?? 0, 0) + modifierDelta,
      ),
    [merchandising.finalPrice, product?.precio, product?.price, modifierDelta],
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
  const sellerCreditPreview = useMemo(() => {
    const source = creditPlan?.attrs
      ? {
          downPaymentMin: num(creditPlan.attrs.downPaymentMin, 0),
          installmentCount: Math.max(
            1,
            num(creditPlan.attrs.installmentCount, 1)
          ),
          installmentValue:
            creditPlan.attrs.installmentAmount ??
            creditPlan.attrs.installmentValue ??
            creditPlan.attrs.installmentPrice ??
            null,
          financedAmount:
            creditPlan.attrs.financedAmount ?? creditPlan.attrs.totalFinanced ?? null,
          firstDueAt: creditPlan.attrs.firstDueAt ?? creditPlan.attrs.firstDue ?? null,
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
      : merchandising.creditEnabled && merchandising.installmentCount
      ? {
          downPaymentMin: finiteNumberOrNull(
            product?.attrs?.downPaymentMin,
            product?.downPaymentMin,
          ) ?? 0,
          installmentCount: merchandising.installmentCount,
          installmentValue: merchandising.installmentValue,
          financedAmount: finiteNumberOrNull(
            product?.attrs?.financedAmount,
            product?.attrs?.totalFinanced,
            product?.financedAmount,
            product?.totalFinanced,
          ),
          firstDueAt: null,
          interval: "monthly" as const,
          every: 1,
          currency: safeStr(
            product?.meta?.pay?.currency || product?.attrs?.currency || product?.currency || "PYG",
          ),
          guaranteeMode: "node_decision",
          note: "",
          trustRequired: null,
        }
      : null;

    if (!source) return null;

    const down = Math.max(0, num(source.downPaymentMin, 0));
    const installmentCount = Math.max(1, num(source.installmentCount, 1));
    const installmentValue =
      (source as any).installmentValue != null
        ? Math.max(0, num((source as any).installmentValue, 0))
        : merchandising.installmentCount === installmentCount
          ? merchandising.installmentValue
          : null;
    const financed =
      (source as any).financedAmount != null
        ? Math.max(0, num((source as any).financedAmount, 0))
        : null;

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
      firstDueAt: safeStr((source as any).firstDueAt || "") || null,
      trustRequired:
        (source as any).trustRequired != null
          ? num((source as any).trustRequired, 0)
          : null,
      sourceKind: creditPlan
        ? "credit.plan"
        : embeddedCredit
        ? "product.meta.pay.finance.credit"
        : "product.published.finance",
      financeNodeId: nodeIdentity.nodeId || nodeIdentity.authority || nodeIdentity.sellerId,
      financeNodeName: nodeIdentity.nodeId === nodeIdentity.sellerId
        ? nodeIdentity.sellerName
        : nodeIdentity.nodeId,
      offerId: creditPlan?.id || null,
    };
  }, [creditPlan, embeddedCredit, merchandising, nodeIdentity]);

  const externalCreditMatches = useMemo(
    () => matchCreditOffers({
      allLive: allDvs,
      amount: totalNum,
      currency: safeStr(product?.meta?.pay?.currency || product?.attrs?.currency || product?.currency || "PYG"),
      installmentPreference: sellerCreditPreview?.installmentCount || 6,
      territory: safeStr(product?.attrs?.territoryId || product?.meta?.territoryId || "") || null,
      purpose: "market.purchase",
      actorId: buyerId,
    }).filter((match) => match.financeNodeId !== (nodeIdentity.nodeId || nodeIdentity.sellerId)),
    [allDvs, totalNum, product, sellerCreditPreview?.installmentCount, buyerId, nodeIdentity],
  );

  const creditEnabled = Boolean(sellerCreditPreview || externalCreditMatches.length);
  useEffect(() => {
    if (!creditEnabled && financeChoice === "credit") setFinanceChoice("cash");
    if (!sellerCreditPreview && selectedFinanceOptionId === "seller" && externalCreditMatches[0]) {
      setSelectedFinanceOptionId(externalCreditMatches[0].offerId);
    }
  }, [creditEnabled, financeChoice, sellerCreditPreview, selectedFinanceOptionId, externalCreditMatches]);

  const selectedExternalCredit = externalCreditMatches.find(
    (match) => match.offerId === selectedFinanceOptionId,
  ) || null;
  const creditPreview = useMemo(() => {
    if (!selectedExternalCredit) return sellerCreditPreview;
    return {
      downPaymentMin: selectedExternalCredit.downPaymentMinimum,
      financed: null,
      installmentCount: selectedExternalCredit.installmentCount,
      installmentValue: null,
      firstDueAt: null,
      interval: "monthly" as const,
      every: 1,
      currency: selectedExternalCredit.currency,
      guaranteeMode: "según condiciones del nodo",
      note: selectedExternalCredit.conditions.join(" · "),
      trustRequired: null,
      sourceKind: "credit.offer",
      financeNodeId: selectedExternalCredit.financeNodeId,
      financeNodeName: selectedExternalCredit.financeNodeName,
      offerId: selectedExternalCredit.offerId,
    };
  }, [selectedExternalCredit, sellerCreditPreview]);

  const authorizedInstallmentOptions = useMemo(() => {
    const options: Array<{
      id: string;
      count: number;
      monthly: number | null;
      down: number;
      currency: string;
      provider: string;
    }> = [];
    if (sellerCreditPreview) {
      options.push({
        id: "seller",
        count: sellerCreditPreview.installmentCount,
        monthly: sellerCreditPreview.installmentValue,
        down: sellerCreditPreview.downPaymentMin,
        currency: sellerCreditPreview.currency,
        provider: nodeIdentity.sellerName || "El comercio",
      });
    }
    for (const match of externalCreditMatches) {
      options.push({
        id: match.offerId,
        count: match.installmentCount,
        monthly: null,
        down: match.downPaymentMinimum,
        currency: match.currency,
        provider: match.financeNodeName,
      });
    }
    const seen = new Set<string>();
    return options.filter((option) => {
      const key = `${option.id}:${option.count}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return option.count > 0;
    });
  }, [sellerCreditPreview, externalCreditMatches, nodeIdentity.sellerName]);

  const verifiedVaultIds = useVerifiedAuthorizedDVs(allDvs, CHECKOUT_VAULT_KINDS);
  const livingVault = useMemo(
    () => projectLivingVault(allDvs, buyerId, verifiedVaultIds),
    [allDvs, buyerId, verifiedVaultIds],
  );
  const compatibleRights = useMemo(
    () => livingVault.activeRights.filter((right) =>
      right.state === "active" && right.acceptedBy.some((acceptance: any) =>
        [nodeIdentity.nodeId, nodeIdentity.sellerId, nodeIdentity.authority]
          .filter(Boolean)
          .includes(String(acceptance?.attrs?.nodeId || "")),
      ),
    ),
    [livingVault.activeRights, nodeIdentity],
  );

  const identityLinks = useMemo(
    () => projectIdentityLinks(allDvs, buyerId, verifiedVaultIds),
    [allDvs, buyerId, verifiedVaultIds],
  );
  const currentIdentityLink = useMemo(() => {
    const nodeKeys = [
      nodeIdentity.nodeId,
      nodeIdentity.originNode,
      nodeIdentity.sellerId,
      nodeIdentity.authority,
    ]
      .map(normalizeNodeIdentityPart)
      .filter(Boolean);
    return (
      identityLinks.find(
        (link) =>
          ["active", "accepted", "requested", "challenged", "proved"].includes(link.status) &&
          nodeKeys.includes(normalizeNodeIdentityPart(link.nodeId)),
      ) || null
    );
  }, [identityLinks, nodeIdentity]);
  const identityConnected = currentIdentityLink?.status === "active";
  const canRequestIdentityLink =
    !currentIdentityLink &&
    capabilityMatches(nodeCapabilities, [
      /identity\.link/,
      /identity\.customer\.link/,
      /customer\.relationship/,
    ]);
  const loyaltyView = useMemo(() => {
    const loyalty = currentIdentityLink?.loyalty;
    if (!loyalty || typeof loyalty !== "object") return null;
    const current = Math.max(
      0,
      num(
        loyalty.currentStamps ??
          loyalty.stamps ??
          loyalty.totalStamps ??
          loyalty.purchases,
        0,
      ),
    );
    const target = Math.max(
      0,
      num(
        loyalty.requiredStamps ??
          loyalty.targetStamps ??
          loyalty.required ??
          loyalty.goal,
        0,
      ),
    );
    const reward = String(
      loyalty.rewardTitle || loyalty.rewardLabel || loyalty.reward || "",
    ).trim();
    const rewardAvailable =
      loyalty.rewardAvailable === true ||
      loyalty.rewardsAvailable === true ||
      num(loyalty.rewardsAvailable, 0) > 0;
    if (!target && !reward && !rewardAvailable) return null;
    return {
      current: target ? Math.min(current, target) : current,
      target,
      remaining: target ? Math.max(0, target - current) : 0,
      reward,
      rewardAvailable,
    };
  }, [currentIdentityLink]);
  const liquidityProximity = useMemo(
    () => projectLiquidityProximity({
      allLive: allDvs,
      actorId: buyerId,
      sellerNodeId: nodeIdentity.nodeId || nodeIdentity.originNode || nodeIdentity.sellerId,
      sellerName: nodeIdentity.sellerName || nodeIdentity.storeName,
      currency: safeStr(product?.meta?.pay?.currency || product?.attrs?.currency || product?.currency || "PYG"),
      amount: totalNum,
      territory: safeStr(product?.attrs?.territoryId || product?.meta?.territoryId || "") || null,
      installmentPreference: creditPreview?.installmentCount || 6,
      sellerFinance: sellerCreditPreview,
      applicableRights: compatibleRights,
    }),
    [allDvs, buyerId, nodeIdentity, product, totalNum, creditPreview?.installmentCount, sellerCreditPreview, compatibleRights],
  );
  const selectedLiquidityOption = liquidityProximity.network.find((item) => item.id === selectedLiquidityOptionId) || null;

  const verifiedPurchaseEventIds = useVerifiedAuthorizedDVs(
    allDvs,
    CHECKOUT_PURCHASE_CYCLE_KINDS,
  );
  const purchaseCycle = useMemo(
    () =>
      submittedOrder
        ? projectCheckoutPurchaseCycle({
            order: submittedOrder,
            allLive: allDvs,
            verifiedIds: verifiedPurchaseEventIds,
          })
        : null,
    [submittedOrder, allDvs, verifiedPurchaseEventIds],
  );
  const verifiedFinanceEventIds = useVerifiedAuthorizedDVs(
    allDvs,
    CHECKOUT_FINANCE_KINDS,
  );
  const activeFinanceRequest = useMemo(() => {
    if (!submittedOrder) return null;
    const orderAttrs = submittedOrder?.attrs || {};
    const orderId = String(orderAttrs.orderId || submittedOrder.id || "");
    const threadId = String(orderAttrs.threadId || submittedOrder?.meta?.threadId || "");
    const chainId = String(orderAttrs.chainId || orderId);
    return [...allDvs]
      .filter((dv) => dv?.kind === "credit.request")
      .filter((dv) => verifiedFinanceEventIds.has(String(dv?.id || "")))
      .filter((dv) => {
        const attrs = dv?.attrs || {};
        return (
          String(attrs.orderId || "") === orderId &&
          String(attrs.threadId || dv?.meta?.threadId || "") === threadId &&
          String(attrs.chainId || dv?.meta?.chainId || "") === chainId &&
          String(attrs.buyerActorId || attrs.buyerId || "") === buyerId &&
          normalizeNodeIdentityPart(attrs.sellerNodeId || attrs.sellerId) ===
            normalizeNodeIdentityPart(orderAttrs.targetNodeId || orderAttrs.sellerNodeId)
        );
      })
      .sort((a, b) => parseTs(b) - parseTs(a))[0] || null;
  }, [submittedOrder, allDvs, verifiedFinanceEventIds, buyerId]);
  const activeFinanceRequestId = financeRequestId || String(activeFinanceRequest?.id || "");
  const financeDecision = useMemo(() => {
    if (!submittedOrder || !activeFinanceRequestId) return null;
    const orderAttrs = submittedOrder?.attrs || {};
    const requestAttrs = activeFinanceRequest?.attrs || {};
    const financeNodeId = String(
      requestAttrs.financeNodeId ||
        requestAttrs.requestedFinanceNodeId ||
        orderAttrs?.payment?.financeNodeId ||
        orderAttrs?.payment?.credit?.financeNodeId ||
        submittedOrder?.meta?.pay?.finance?.credit?.financeNodeId ||
        orderAttrs.targetNodeId ||
        "",
    );
    if (!financeNodeId) return null;
    return projectCreditDecision({
      allLive: allDvs,
      verifiedIds: verifiedFinanceEventIds,
      requestId: activeFinanceRequestId,
      orderId: String(orderAttrs.orderId || submittedOrder.id || ""),
      chainId: String(orderAttrs.chainId || orderAttrs.orderId || submittedOrder.id || ""),
      threadId: String(orderAttrs.threadId || submittedOrder?.meta?.threadId || ""),
      buyerActorId: String(orderAttrs.buyerActorId || orderAttrs.buyerId || buyerId),
      sellerNodeId: String(orderAttrs.targetNodeId || orderAttrs.sellerNodeId || ""),
      financeNodeId,
    });
  }, [submittedOrder, activeFinanceRequestId, activeFinanceRequest, allDvs, verifiedFinanceEventIds, buyerId]);
  const activeNodePaymentMethod = useMemo(() => {
    const methods = purchaseCycle?.paymentMethods || [];
    return (
      methods.find((method) => method.method === selectedNodeMethod) ||
      methods[0] ||
      null
    );
  }, [purchaseCycle?.paymentMethods, selectedNodeMethod]);

  useEffect(() => {
    const firstMethod = purchaseCycle?.paymentMethods?.[0]?.method || "";
    if (!purchaseCycle?.paymentMethods?.some((method) => method.method === selectedNodeMethod)) {
      setSelectedNodeMethod(firstMethod);
    }
  }, [purchaseCycle?.paymentMethods, selectedNodeMethod]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreviewUrl("");
      return;
    }
    const previewUrl = URL.createObjectURL(proofFile);
    setProofPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [proofFile]);

  useEffect(() => {
    if (!submittedOrder || !purchaseCycle) {
      setWaitingLong(false);
      return;
    }
    if (!["sent", "received"].includes(purchaseCycle.state)) {
      setWaitingLong(false);
      return;
    }
    setWaitingLong(false);
    const timer = window.setTimeout(() => setWaitingLong(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [submittedOrder?.id, purchaseCycle?.state, retryNonce]);

  const sessionRef = useRef<{
    orderId: string;
    threadId: string;
    sellerId: string;
    sellerName: string | null;
    createdTs: number;
  } | null>(null);

  const computeSeller = () => ({
    sellerId: nodeIdentity.sellerId || String(sellerId || ""),
    sellerName: nodeIdentity.sellerName || sellerName || null,
  });

  const sellerOfferIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            computeSeller().sellerId,
            product?.sellerId,
            product?.attrs?.sellerId,
            product?.storeId,
            product?.attrs?.storeId,
            product?.meta?.authority,
            product?.attrs?.authority,
            product?.meta?.originNode,
            product?.attrs?.originNode,
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      ),
    [
      sellerId,
      sellerName,
      nodeIdentity.sellerId,
      nodeIdentity.storeId,
      nodeIdentity.nodeId,
      nodeIdentity.originNode,
      nodeIdentity.authority,
      product?.sellerId,
      product?.storeId,
      product?.attrs?.sellerId,
      product?.attrs?.storeId,
      product?.meta?.authority,
      product?.attrs?.authority,
      product?.meta?.originNode,
      product?.attrs?.originNode,
    ],
  );

  const paymentOffer = useMemo(() => {
    const offers = sellerOfferIds
      .map((id) => findLatestPaymentOffer(allDvs, id))
      .filter(Boolean)
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
    return offers[0] || null;
  }, [allDvs, sellerOfferIds]);

  const paymentOfferSignature = useMemo(
    () =>
      JSON.stringify({
        id: paymentOffer?.id || null,
        ts: paymentOffer?.meta?.updatedAt || paymentOffer?.meta?.ts || null,
        currency: paymentOffer?.attrs?.currency || null,
        accepted: Array.isArray(paymentOffer?.attrs?.accepted)
          ? paymentOffer.attrs.accepted
          : [],
      }),
    [
      paymentOffer?.id,
      paymentOffer?.meta?.updatedAt,
      paymentOffer?.meta?.ts,
      paymentOffer?.attrs?.currency,
      paymentOffer?.attrs?.accepted,
    ],
  );

  const qrPresenceCount = checkoutByEntry?.qr?.length || 0;
  const nfcPresenceCount = checkoutByEntry?.nfc?.length || 0;

  const recommendedMethod = useMemo(() => {
    return buildRecommendedMethod({
      entryMethod,
      checkoutByEntry: {
        qr: qrPresenceCount ? [true] : [],
        nfc: nfcPresenceCount ? [true] : [],
      },
      activeCajero,
      paymentOffer,
      financeChoice,
    });
  }, [
    entryMethod,
    qrPresenceCount,
    nfcPresenceCount,
    activeCajero?.id,
    activeCajero?.nombre,
    paymentOfferSignature,
    financeChoice,
  ]);

  const alternativeMethods = useMemo(() => {
    return buildAlternativeMethods({
      paymentOffer,
      financeChoice,
    });
  }, [paymentOfferSignature, financeChoice]);

  const recommendedMethodKey = useMemo(
    () => JSON.stringify(recommendedMethod || null),
    [recommendedMethod],
  );

  const alternativeMethodsKey = useMemo(
    () => JSON.stringify(alternativeMethods || []),
    [alternativeMethods],
  );
  const proposalReason = useMemo(() => {
  if (financeChoice === "credit") return "Financiación elegida";
  if (checkoutByEntry?.qr?.length > 0) return "Pago cercano detectado";
  if (checkoutByEntry?.nfc?.length > 0) return "Pago cercano detectado";
  if (activeCajero?.id && checkoutNearby.length > 0)
    return "El comercio está disponible cerca";
  if (activeCajero?.id) return "El comercio está disponible";
  return "Esperando opciones del comercio";
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

  if (!sessionAmount) return;

  const pulseSignature = JSON.stringify({
    orderId: s.orderId,
    productId: String(product?.id || ""),
    buyerId,
    sellerId: s.sellerId,
    amount: sessionAmount,
    currency:
      paymentOffer?.attrs?.currency ||
      product?.meta?.pay?.currency ||
      product?.attrs?.currency ||
      product?.currency ||
      "PYG",
  });

  if (!shouldEmitAutomatic("pulse", pulseSignature)) return;

  const pulse = emitPaymentPulseOpen({
    sessionId: `session:${s.orderId}`,
    orderId: s.orderId,
    threadId: s.threadId,

    sellerId: s.sellerId,
    sellerName: s.sellerName,

    buyerId: resolveCheckoutBuyerId(buyerId, buyerName),
    buyerName: buyerName || undefined,

    productId: String(product?.id || ""),
    productName: compactProductLabel(product),

    amount: sessionAmount,
    currency:
      paymentOffer?.attrs?.currency ||
      product?.meta?.pay?.currency ||
      product?.attrs?.currency ||
      product?.currency ||
      "PYG",

    territoryId: "salto",
    ns: product?.meta?.ns ?? "mt:market",
    source: "ms.web.checkout.pulse",
    ttlMs: 1000 * 30,
  });

  setActivePulse(pulse);
}, [
  open,
  product?.id,
  product?.precio,
  product?.price,
  product?.meta?.pay?.currency,
  product?.attrs?.currency,
  product?.currency,
  buyerId,
  buyerName,
  sellerId,
  sellerName,
  totalNum,
  unitPriceNum,
  qty,
  paymentOffer?.attrs?.currency,
  pulseTick,
]);
  useEffect(() => {
    if (!open) {
      sessionRef.current = null;
      setUtopyPayView(null);
      setSubmittedOrder(null);
      setFinanceRequestId("");
      setProofFile(null);
      setProofError("");
      setSelectedNodeMethod("");
      setSelectedLiquidityOptionId("");
      setWaitingLong(false);
      emissionSignaturesRef.current = {};
      ingestedLiquidityRef.current.clear();
    }
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

  const onProofFileSelected = (file?: File | null) => {
    const validation = validatePaymentProofFile(file);
    if (validation) {
      setProofFile(null);
      setProofError(validation);
      return;
    }
    setProofError("");
    setProofFile(file || null);
  };

  const removeProofFile = () => {
    setProofFile(null);
    setProofError("");
    if (cameraProofInputRef.current) cameraProofInputRef.current.value = "";
    if (galleryProofInputRef.current) galleryProofInputRef.current.value = "";
  };

  const requestIdentityConnection = async () => {
    const targetNodeId = nodeIdentity.nodeId || nodeIdentity.originNode || "";
    if (!buyerId || !targetNodeId || !canRequestIdentityLink) return;
    try {
      setMsg(null);
      const request = buildIdentityLinkRequestDV({
        actorId: buyerId,
        actorName: buyerName || null,
        nodeId: targetNodeId,
        nodeName: nodeIdentity.sellerName || nodeIdentity.storeName || targetNodeId,
        purpose: "Continuidad de compra con el nodo",
      });
      await publishIdentityLinkActorDV({
        dv: request,
        allLive: allDvs,
        activeActor: { id: buyerId, actorId: buyerId, name: buyerName || "Comprador" },
        targetNodeId,
      });
      setMsg(`Solicitud privada enviada a ${nodeIdentity.sellerName || "el comercio"}.`);
    } catch (error: any) {
      setMsg(error?.message || "No pudimos solicitar la vinculación.");
    }
  };

  const enviarComprobantePrivado = async () => {
    try {
      setProofUploadBusy(true);
      setProofError("");
      setMsg(null);
      if (!submittedOrder || !purchaseCycle?.paymentOffer || !activeNodePaymentMethod) {
        throw new Error("Todavía no recibimos una opción de pago válida del comercio.");
      }
      const validation = validatePaymentProofFile(proofFile);
      if (validation) throw new Error(validation);
      const targetNodeId = nodeIdentity.nodeId || nodeIdentity.originNode || "";
      if (!buyerId || !targetNodeId) {
        throw new Error("No hay identidad o nodo receptor verificable.");
      }
      const route = resolvePrivatePaymentProofRoute({
        offer: purchaseCycle.paymentOffer,
        manifest: nodeIdentity.manifest,
        method: activeNodePaymentMethod,
      });
      if (!route) {
        throw new Error("El comercio todavía no anunció un canal privado para el comprobante.");
      }
      const attrs = submittedOrder.attrs || {};
      const proofRef = await uploadPrivatePaymentProof({
        file: proofFile!,
        orderId: String(attrs.orderId || submittedOrder.id),
        route,
      });
      const submittedAt = new Date().toISOString();
      await publishAuthorizedDV({
        dv: buildPrivatePaymentProofDV({
          proofRef,
          orderId: String(attrs.orderId || submittedOrder.id),
          threadId: String(attrs.threadId || submittedOrder.meta?.threadId || ""),
          chainId: String(attrs.chainId || attrs.orderId || submittedOrder.id),
          buyerActorId: buyerId,
          sellerNodeId: targetNodeId,
          submittedAt,
          ns: product?.meta?.ns || "mt:market",
        }) as any,
        allLive: allDvs,
        activeActor: {
          id: buyerId,
          actorId: buyerId,
          name: buyerName || "Comprador",
        },
        targetNodeId,
        sensitivity: "sensitive",
      });
      removeProofFile();
      setMsg(`Comprobante enviado. Esperando confirmación de ${nodeIdentity.sellerName || "el comercio"}.`);
    } catch (error: any) {
      if (import.meta.env.DEV && error?.nodeMessage) console.error("[UTOPY proof upload response]", error.nodeMessage);
      setProofError(error?.message || "No pudimos enviar la imagen. Revisá tu conexión e intentá otra vez.");
    } finally {
      setProofUploadBusy(false);
    }
  };

  const retrySubmittedOrder = async () => {
    if (!submittedOrder) return;
    const attrs = submittedOrder.attrs || {};
    setWaitingLong(false);
    setRetryNonce((current) => current + 1);
    setMsg("Volvimos a avisar al comercio. Tu pedido sigue siendo el mismo.");
    try {
      await spore?.sayIntent?.({
        sym: "🛒",
        say: "market.order.create",
        with: {
          orderId: attrs.orderId || submittedOrder.id,
          threadId: attrs.threadId || submittedOrder.meta?.threadId,
          chainId: attrs.chainId || attrs.orderId || submittedOrder.id,
          relationshipId: attrs.relationshipId,
          targetNodeId: attrs.targetNodeId,
          retry: true,
          dv: submittedOrder,
        },
      });
    } catch {
      setMsg("No pudimos avisar de nuevo. Tu pedido original sigue enviado.");
    }
  };

  const chooseAnotherPaymentForSameOrder = (
    choice: FinanceChoice,
    financeOptionId = "seller",
  ) => {
    if (!submittedOrder) return;
    setFinanceChoice(choice);
    setSelectedFinanceOptionId(financeOptionId);
    setFinanceRequestId("");
    setSubmittedOrder(null);
    setMsg(
      choice === "cash"
        ? "Tu pedido sigue siendo el mismo. Elegí contado para continuar."
        : "Tu pedido sigue siendo el mismo. Confirmá esta alternativa de cuotas.",
    );
  };

  const confirmar = async () => {
  if (confirmingRef.current) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) { setMsg("Sin conexión. Reconectate antes de enviar el pedido; no se confirmó ninguna compra."); return; }
  confirmingRef.current = true;
  setBusy(true);
  setMsg(null);

  try {
    if (!buyerId) {
      throw new Error("Tu identidad viva todavía se está preparando.");
    }
    const explicitTargetNodeId =
      nodeIdentity.nodeId || nodeIdentity.originNode || "";
    if (!explicitTargetNodeId || !nodeIdentity.sellerId) {
      throw new Error(
        "Esta oferta todavía no declara un nodo receptor verificable. No se creó ningún pedido.",
      );
    }
    const s = ensureSession();
    const resolvedCajero = activeCajero
      ? { id: activeCajero.id, nombre: activeCajero.nombre || "Cajero" }
      : { id: null, nombre: null };

    const qNum = Math.max(1, Number(qty || 1));
    const priceNum = unitPriceNum;

    if (productUnavailable) {
      throw new Error(nodePaused ? 'Este comercio pausó las nuevas solicitudes. Tus pedidos activos no se cancelan.' : "Este producto está agotado o ya no está disponible.");
    }

    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error("Precio inválido.");
    }

    if (
      supportsDelivery &&
      deliveryMode === "delivery" &&
      !deliveryAddress.trim()
    ) {
      throw new Error("Indicá la dirección de entrega.");
    }

    const total = qNum * priceNum;
    const currency = String(
      product?.meta?.pay?.currency ||
        product?.attrs?.currency ||
        product?.currency ||
        paymentOffer?.attrs?.currency ||
        "PYG",
    );
    let paymentView = financeChoice === "credit" ? utopyPayView : null;
    if (
      financeChoice === "credit" &&
      (
        !paymentView?.session ||
        paymentView.session.attrs.orderId !== s.orderId ||
        paymentView.session.attrs.amount !== total ||
        paymentView.session.attrs.currency !== currency
      )
    ) {
      const session = await openUtopyPaySession({
        orderId: s.orderId,
        threadId: s.threadId,
        buyer: { id: buyerId, name: buyerName || null },
        seller: {
          id: s.sellerId,
          name: s.sellerName,
          nodeId:
            product?.attrs?.originNode ||
            product?.meta?.originNode ||
            s.sellerId,
        },
        amount: total,
        currency,
        concept: compactProductLabel(product),
        productId: product?.id || null,
        accepted: paymentOffer?.attrs?.accepted || [],
        ns: product?.meta?.ns ?? "mt:market",
        source: "ms.web.checkout",
      });
      paymentView = getUtopyPayView(session.attrs.sessionId);
      setUtopyPayView(paymentView);
    }
    const paySessionId = paymentView?.session?.attrs.sessionId || null;
    const payState = paymentView?.settled
      ? "settled"
      : paymentView?.authorized
        ? "authorized"
        : "waiting";

    const relationshipId = `rel.order:${s.orderId}`;
    const targetNodeId = explicitTargetNodeId;
    const financeNodeId = creditPreview?.financeNodeId || targetNodeId;
    const financeRelationshipId =
      selectedExternalCredit?.relationshipId ||
      (financeNodeId !== targetNodeId
        ? `rel.finance:${s.orderId}:${sanitizeIdPart(financeNodeId)}`
        : relationshipId);
    const orderLineId = `${s.orderId}:line:${sanitizeIdPart(product?.id || "product")}`;

    const paymentAttrs =
      financeChoice === "credit" && creditPreview
        ? {
            type: "utopy_pay",
            routeType: "commercial_credit",
            sessionId: paySessionId,
            status: payState,
            cajeroId: resolvedCajero.id,
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
            financeNodeId,
            financeNodeName: creditPreview.financeNodeName || financeNodeId,
            financeOfferId: creditPreview.offerId || null,
            financeRelationshipId,
          }
        : {
            type: "node_payment_offer",
            routeType: "awaiting_node_offer",
            sessionId: null,
            status: "waiting",
            cajeroId: resolvedCajero.id,
          };

    const orderDv = {
      id: s.orderId,
      kind: "market.order.create",
      attrs: {
        orderId: s.orderId,
        threadId: s.threadId,
        chainId: s.orderId,
        relationshipId,

        buyerId,
        buyerActorId: buyerId,
        buyer: { id: buyerId, name: buyerName || null },
        identityLink: identityConnected && currentIdentityLink?.linkId
          ? {
              linkId: currentIdentityLink.linkId,
              relationshipId: currentIdentityLink.relationshipId,
              claims: [
                "relationship",
                ...(currentIdentityLink.loyalty ? ["loyalty.summary"] : []),
                ...(currentIdentityLink.finance ? ["finance.availability"] : []),
              ],
            }
          : null,

        sellerId: s.sellerId,
        sellerNodeId: targetNodeId,
        sellerName: s.sellerName,
        targetNodeId,
        targetAuthority: nodeIdentity.authority,
        requestedCapabilities: [
          "commerce.order.receive",
          "market.order.accept",
          "payment.receive",
        ],
        storeId: nodeIdentity.storeId,
        storeName: nodeIdentity.storeName,
        originNode: nodeIdentity.originNode,

        productId: product?.id,
        fromOfferId:
          product?.meta?.fromOfferId ||
          product?.meta?.fromOffer ||
          null,

        qty: qNum,
        price: priceNum,
        total,
        currency,
        items: [
          {
            orderLineId,
            productId: product?.id,
            offerId:
              product?.meta?.fromOfferId ||
              product?.meta?.fromOffer ||
              null,
            qty: qNum,
            price: priceNum,
            basePrice: num(product?.precio ?? product?.price ?? 0, 0),
            modifiers: selectedModifiers,
          },
        ],

        payment: paymentAttrs,
        delivery: supportsDelivery
          ? {
              mode: deliveryMode,
              address: deliveryAddress.trim() || null,
              lat: deliveryGeo?.lat ?? null,
              lng: deliveryGeo?.lng ?? null,
              status:
                deliveryMode === "delivery"
                  ? "requested"
                  : "pickup_requested",
            }
          : null,
        status: "sent",
        progress: 8,
      },
      traits: [
        "mt:order",
        "mt:market",
        "commerce:order.request",
        "consent:required",
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
          id: resolvedCajero.id,
          nombre: resolvedCajero.nombre,
        },

        pay: {
          mode: "utopy_pay",
          protocol: "utopy.pay.libre.v1",
          sessionId: paySessionId,
          status: payState,
          recommendedCajeroId: resolvedCajero.id,
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
                    financeNodeId,
                    financeNodeName: creditPreview.financeNodeName || financeNodeId,
                    offerId: creditPreview.offerId || null,
                    relationshipId: financeRelationshipId,
                  },
                }
              : { mode: "cash", creditEnabled: false },
        },

        source: "ms.web.checkout",
        chainId: s.orderId,
        relationshipId,
        originNode: nodeIdentity.originNode,
      },
    } as any;

    const activeBuyer = {
      id: buyerId,
      actorId: buyerId,
      name: buyerName || "Persona compradora",
    };
    const relationshipRequest = buildRelationshipRequestDV({
      relationshipId,
      actorId: buyerId,
      parties: [
        { actorId: buyerId, role: "buyer" },
        { nodeId: targetNodeId, role: "seller" },
      ],
      purpose: "Compra y coordinación del pedido",
      scopes: [
        "message",
        "order.status",
        "payment.offer",
        "payment.proof",
        "payment.outcome",
        "delivery.proposal",
      ],
      privacyScopes: ["participants"],
    });
    await publishAuthorizedDV({
      dv: relationshipRequest as any,
      allLive: allDvs,
      activeActor: activeBuyer,
      targetNodeId,
      sensitivity: "relationship",
    });
    if (financeChoice === "credit" && financeNodeId !== targetNodeId) {
      const financeRelationshipRequest = buildRelationshipRequestDV({
        relationshipId: financeRelationshipId,
        actorId: buyerId,
        parties: [
          { actorId: buyerId, role: "borrower" },
          { nodeId: financeNodeId, role: "finance" },
        ],
        purpose: "Evaluar financiación para una compra",
        scopes: ["credit.request", "credit.decision", "credit.account"],
        privacyScopes: ["participants"],
      });
      await publishAuthorizedDV({
        dv: financeRelationshipRequest as any,
        allLive: allDvs,
        activeActor: activeBuyer,
        targetNodeId: financeNodeId,
        sensitivity: "relationship",
      });
    }
    const authorizedOrder = await publishAuthorizedDV({
      dv: orderDv,
      allLive: allDvs,
      activeActor: activeBuyer,
      targetNodeId,
      sensitivity: "relationship",
    });
    setSubmittedOrder(authorizedOrder.dv);
    setMsg("Pedido enviado.");
    await spore?.sayIntent?.({
      sym: financeChoice === "credit" ? "📒" : "🛒",
      say: "market.order.create",
      with: {
        orderId: s.orderId,
        threadId: s.threadId,
        chainId: s.orderId,
        relationshipId,
        targetNodeId,
        dv: authorizedOrder.dv,
      },
    });

    if (selectedRightId) {
      const selectedRight = compatibleRights.find((right) => right.dv.id === selectedRightId);
      const acceptance = selectedRight?.acceptedBy.find((candidate: any) =>
        [targetNodeId, nodeIdentity.nodeId, nodeIdentity.sellerId]
          .filter(Boolean)
          .includes(String(candidate?.attrs?.nodeId || "")),
      );
      if (!selectedRight || !acceptance) {
        throw new Error("El derecho seleccionado ya no es compatible con este nodo.");
      }
      await publishVaultDV(
        buildValueRedemptionRequestDV({
          right: selectedRight.dv,
          acceptance,
          actorId: buyerId,
          actorName: buyerName || buyerId,
        }),
        {
          allLive: allDvs,
          activeActor: activeBuyer,
          targetNodeId,
        },
      );
    }

    if (supportsDelivery && deliveryMode === "delivery") {
      const deliveryDv = buildUniversalDeliveryRequestDV({
        orderId: s.orderId,
        threadId: s.threadId,
        node: nodeIdentity,
        buyerId,
        buyerName: buyerName || null,
        product,
        address: deliveryAddress.trim(),
        lat: deliveryGeo?.lat ?? null,
        lng: deliveryGeo?.lng ?? null,
        paymentSessionId: paySessionId,
        paymentStatus: paymentView?.settled ? "settled" : "waiting",
        relationshipId,
      });

      await publishAuthorizedDV({
        dv: deliveryDv as any,
        allLive: allDvs,
        activeActor: activeBuyer,
        targetNodeId,
        sensitivity: "relationship",
      });
      await publishAuthorizedDV({
        dv: buildPublicDeliveryIntentDV(deliveryDv) as any,
        allLive: allDvs,
        activeActor: activeBuyer,
        sensitivity: "ephemeral",
      });
    }

    if (financeChoice === "credit") {
      if (selectedExternalCredit && !(await verifyCreditOffer(selectedExternalCredit.source, allDvs))) {
        throw new Error("La oferta financiera seleccionada ya no tiene autoridad verificable.");
      }
      const creditRequest = buildCreditRequestDV({
        buyerActorId: buyerId,
        sellerNodeId: targetNodeId,
        requestedFinanceNodeId: financeNodeId,
        selectedOfferId: creditPreview?.offerId || null,
        orderId: s.orderId,
        chainId: s.orderId,
        threadId: s.threadId,
        relationshipId: financeRelationshipId,
        amount: total,
        currency: creditPreview?.currency || currency,
        installmentPreference: creditPreview?.installmentCount || 1,
        downPayment: creditPreview?.downPaymentMin || 0,
        purpose: "market.purchase",
        territory: safeStr(product?.attrs?.territoryId || product?.meta?.territoryId || "") || null,
        productId: product?.id || null,
        proofRefs: [s.orderId, creditPreview?.offerId || ""].filter(Boolean),
        linkId: identityConnected ? currentIdentityLink?.linkId || null : null,
      });
      setFinanceRequestId(creditRequest.id);
      await publishCreditRequest({
        dv: creditRequest,
        financeNodeId,
        allLive: allDvs,
        activeActor: activeBuyer,
      });

      setMsg(
        "Pedido enviado. La financiación y la aceptación del comercio se confirman por separado.",
      );
      return;
    }

    if (recurringProposal) {
      await publishSubscriptionDV(
        buildSubscriptionEventDV("subscription.proposal", {
          relationshipId,
          threadId: s.threadId,
          chainId: s.orderId,
          rootDvId: s.orderId,
          orderId: s.orderId,
          actorId: buyerId,
          actorName: buyerName || "Comprador",
          participants: [buyerId, s.sellerId],
          title: `Abastecimiento recurrente de ${
            product?.attrs?.nombre ||
            product?.attrs?.name ||
            product?.attrs?.title ||
            "este pedido"
          }`,
          frequency: "monthly",
          every: 1,
          attrs: {
            relationshipId,
            buyerId,
            sellerId: s.sellerId,
            sellerName: s.sellerName || null,
            productId: product?.id || null,
            paymentPreference: "undecided",
            amountReference: total,
            currency: paymentOffer?.attrs?.currency || "PYG",
          },
          authority: buyerId,
        }),
        {
          allLive: allDvs,
          activeActor: activeBuyer,
          targetNodeId,
        },
      );
    }

    setMsg(
      recurringProposal
        ? "Pedido enviado. También propusiste abastecimiento recurrente; cada entrega se paga por separado salvo autorización posterior."
        : paymentView?.settled
          ? "Pago confirmado. El pedido fue enviado y espera la aceptación del comercio."
          : "Pedido enviado. El comercio debe aceptarlo y el pago sigue pendiente.",
    );
  } catch (e: any) {
    setMsg(e?.message || "No se pudo completar el checkout");
  } finally {
    confirmingRef.current = false;
    setBusy(false);
  }
};
  const captureDeliveryLocation = () => {
    if (!navigator.geolocation) {
      setMsg("Este navegador no permite compartir ubicación.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoBusy(false);
        setMsg("Ubicación agregada a la entrega Falcon.");
      },
      () => {
        setGeoBusy(false);
        setMsg("No se pudo obtener la ubicación. Podés escribir la dirección.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  const cannotConfirm =
    busy ||
    !identityReady ||
    !buyerId ||
    !nodeIdentity.sellerId ||
    !(nodeIdentity.nodeId || nodeIdentity.originNode) ||
    productUnavailable ||
    (supportsDelivery &&
      deliveryMode === "delivery" &&
      !deliveryAddress.trim());
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

    const presenceSignature = JSON.stringify({
      productId: String(product?.id || ""),
      buyerId,
      currentStage,
      payMethod,
      financeChoice,
      entryMethod,
      qty,
      totalNum,
      sellerId,
      cajeroId: activeCajero?.id || null,
    });

    if (!shouldEmitAutomatic("presence", presenceSignature)) return;

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
    product?.id,
    product?.meta?.ns,
    product?.currency,
    product?.attrs?.currency,
    buyerId,
    buyerName,
    checkoutThreadId,
    currentStage,
    payMethod,
    financeChoice,
    entryMethod,
    qty,
    totalNum,
    sellerId,
    sellerName,
    activeCajero?.id,
  ]);
  useEffect(() => {
  if (!open || !product?.id || !buyerId) return;
  if (financeChoice !== "credit") return;

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

const sessionOpenSignature = JSON.stringify({
  orderId: s.orderId,
  amount: sessionAmount,
  currency:
    paymentOffer?.attrs?.currency ||
    product?.meta?.pay?.currency ||
    product?.attrs?.currency ||
    product?.currency ||
    "PYG",
  recommendedMethodKey,
});

if (!shouldEmitAutomatic("payment-session-open", sessionOpenSignature)) return;

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
  product?.id,
  product?.precio,
  product?.price,
  product?.meta?.ns,
  product?.meta?.pay?.currency,
  product?.attrs?.currency,
  product?.currency,
  buyerId,
  buyerName,
  totalNum,
  unitPriceNum,
  qty,
  paymentOffer?.attrs?.currency,
  recommendedMethodKey,
  entryMethod,
  financeChoice,
]);

  const previousOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (wasOpen && !open) {
      try {
        clearSignals?.();
      } catch {}
    }
  }, [open]);

  const motionSurface = useProductMotionSurface(shouldRender, `${product?.id || ''}:${submittedOrder?.id || 'review'}`, () => {
    if (galleryOpen) setGalleryOpen(false);
    else if (!busy && !confirmingRef.current) onClose();
  });
  const closeCheckout = () => { if (!busy && !confirmingRef.current) onClose(); };
  const gallerySurface = useProductMotionSurface(shouldRender && galleryOpen, product?.id || '', () => setGalleryOpen(false));
  if (!shouldRender) return null;

  const payPanelSession = ensureSession();
  const payPanelCurrency = String(
    paymentOffer?.attrs?.currency ||
      product?.meta?.pay?.currency ||
      product?.attrs?.currency ||
      product?.currency ||
      "PYG",
  );
  const oldUnitPrice = merchandising.basePrice
    ? merchandising.basePrice + modifierDelta
    : null;
  const oldTotal = oldUnitPrice ? oldUnitPrice * Math.max(1, qty) : null;
  const savingsTotal = merchandising.discountAmount
    ? merchandising.discountAmount * Math.max(1, qty)
    : 0;
  const sellerDisplayName =
    nodeIdentity.storeName || nodeIdentity.sellerName || "Comercio";

  if (submittedOrder && purchaseCycle) {
    const orderAttrs = submittedOrder.attrs || {};
    const orderId = String(orderAttrs.orderId || submittedOrder.id);
    const orderThreadId = String(orderAttrs.threadId || submittedOrder.meta?.threadId || "");
    const commerceName = nodeIdentity.sellerName || nodeIdentity.storeName || "el comercio";
    const financeWasRequested =
      orderAttrs?.payment?.routeType === "commercial_credit" ||
      submittedOrder?.meta?.pay?.finance?.mode === "credit" ||
      Boolean(activeFinanceRequestId);
    const approvedTerms = financeDecision?.approvedTerms || null;
    const approvedDownPayment = finiteNumberOrNull(
      approvedTerms?.downPayment,
      approvedTerms?.initialPayment,
      approvedTerms?.downPaymentAmount,
      financeDecision?.source?.attrs?.downPayment,
      financeDecision?.source?.attrs?.initialPayment,
    );
    const approvedInstallments = finiteNumberOrNull(
      approvedTerms?.installmentCount,
      approvedTerms?.approvedInstallmentCount,
    );
    const approvedMonthly = finiteNumberOrNull(
      approvedTerms?.installmentAmount,
      approvedTerms?.installmentValue,
      approvedTerms?.monthlyAmount,
    );
    const approvedFinancedTotal = finiteNumberOrNull(
      approvedTerms?.totalFinanced,
      approvedTerms?.financedAmount,
      approvedTerms?.amount,
    );
    const approvedCurrency = String(
      approvedTerms?.currency || orderAttrs.currency || payPanelCurrency,
    );
    const approvedFirstDue = String(
      approvedTerms?.firstDueAt || approvedTerms?.firstDue || "",
    ).trim();
    const stateCopy: Record<string, { title: string; detail: string; tone: string }> = {
      sent: { title: "🛍️ Pedido enviado", detail: "Esperando que la tienda lo reciba.", tone: "amber" },
      received: { title: "👋 La tienda recibió tu pedido", detail: "Está preparando una forma de pago para esta compra.", tone: "green" },
      awaiting_payment: { title: "🏦 Esperando tu transferencia", detail: "Usá solamente los datos privados de esta compra.", tone: "amber" },
      proof_submitted: { title: "📎 Comprobante enviado", detail: `Ya está en manos de ${commerceName}.`, tone: "green" },
      payment_review: { title: "👀 La tienda está revisando", detail: "Podés cerrar esta pantalla; el pedido sigue vivo.", tone: "amber" },
      proof_rejected: { title: "🔄 Probemos otra vez", detail: "La tienda necesita otro comprobante. Tu pedido continúa.", tone: "red" },
      payment_confirmed: { title: "✅ Pago confirmado", detail: "La tienda está terminando de confirmar la compra.", tone: "green" },
      accepted: { title: "🎉 Compra confirmada", detail: `Todo listo con ${commerceName}.`, tone: "green" },
      rejected: { title: "No pudieron aceptar el pedido", detail: String(purchaseCycle.orderDecision?.attrs?.reason || "La tienda no pudo aceptar esta compra."), tone: "red" },
      cancelled: { title: "Pedido cancelado", detail: "La operación quedó cerrada.", tone: "red" },
    };
    const cycleCopy = stateCopy[purchaseCycle.state] || stateCopy.sent;
    const rejectionReasons: Record<string, string> = {
      amount_mismatch: "Importe diferente",
      unreadable: "No se alcanza a leer",
      wrong_proof: "Comprobante equivocado",
      other: "La tienda necesita otra imagen",
    };
    const rejectionCode = String(
      purchaseCycle.proofRejected?.attrs?.reasonCode || purchaseCycle.proofRejected?.attrs?.reason || "",
    );
    const rejectionText = rejectionReasons[rejectionCode] || String(
      purchaseCycle.proofRejected?.attrs?.message || rejectionCode || "Revisá la imagen e intentá nuevamente.",
    );
    const canAttachProof = Boolean(activeNodePaymentMethod) &&
      ["awaiting_payment", "proof_rejected"].includes(purchaseCycle.state);
    const destination = activeNodePaymentMethod?.destination || null;
    const paymentAmount = num(
      purchaseCycle.paymentOffer?.attrs?.amount ?? purchaseCycle.paymentOffer?.attrs?.total,
      orderAttrs.total || totalNum,
    );
    const paymentCurrency = String(
      purchaseCycle.paymentOffer?.attrs?.currency || orderAttrs.currency || payPanelCurrency,
    );
    const timelineIndex = purchaseCycle.state === "accepted"
      ? 3
      : ["awaiting_payment", "proof_submitted", "payment_review", "proof_rejected", "payment_confirmed"].includes(purchaseCycle.state)
        ? 2
        : purchaseCycle.state === "received"
          ? 1
          : 0;
    const transportRoute = String(
      orderAttrs?.transport?.route || submittedOrder?.meta?.transport?.route || "",
    ).trim();

    return (
      <Backdrop onClick={onClose}>
        <Modal ref={motionSurface} role="dialog" aria-modal="true" aria-label="Comprar" onClick={(event) => event.stopPropagation()}>
          <CheckoutHeader>
            <HeaderBack type="button" onClick={onClose} aria-label="Volver">←</HeaderBack>
            <div>Comprar</div>
            <HeaderClose type="button" onClick={onClose} disabled={proofUploadBusy} aria-label="Cerrar">×</HeaderClose>
          </CheckoutHeader>

          <ProgressLine data-step={purchaseCycle.state === "accepted" ? "confirmation" : "payment"}>
            <span>Producto</span><i>→</i><span>Pago</span><i>→</i><span>Confirmación</span>
          </ProgressLine>

          <PurchaseSummary>
            {!!img && <img src={img} alt={compactProductLabel(product)} />}
            <div>
              <b>{compactProductLabel(product)}</b>
              <span>{commerceName} ✓ · {qty} unidad{qty === 1 ? "" : "es"}</span>
            </div>
            <strong>{formatCheckoutMoney(orderAttrs.total || totalNum, orderAttrs.currency || payPanelCurrency)}</strong>
          </PurchaseSummary>

          <LivingTimeline aria-label="Estado de la compra">
            {["Pedido", "Recibido", "Pago", "Confirmación"].map((label, index) => (
              <TimelineStep
                key={label}
                data-state={index < timelineIndex ? "done" : index === timelineIndex ? "current" : "todo"}
              >
                <i>{index < timelineIndex ? "✓" : index === timelineIndex ? "●" : "○"}</i>
                <span>{label}</span>
              </TimelineStep>
            ))}
          </LivingTimeline>

          {purchaseCycle.state === "accepted" ? (
            <SuccessView>
              <div className="celebration">🎉</div>
              <h2>¡Listo!</h2>
              <p>Tu compra fue confirmada</p>
              <SuccessReceipt>
                <span>{compactProductLabel(product)}</span>
                <span>{commerceName}</span>
                <b>{formatCheckoutMoney(orderAttrs.total || totalNum, orderAttrs.currency || payPanelCurrency)}</b>
              </SuccessReceipt>
              {orderAttrs.delivery ? (
                <DeliveryNote>🛵 {orderAttrs.delivery.mode === "delivery" ? "Entrega solicitada" : "Retiro en el comercio"}</DeliveryNote>
              ) : null}
            </SuccessView>
          ) : (
            <PurchaseStateCard data-tone={cycleCopy.tone}>
              <StatusMark aria-hidden="true">{purchaseCycle.state.includes("reject") ? "!" : "●"}</StatusMark>
              <div><b>{cycleCopy.title}</b><span>{cycleCopy.detail}</span></div>
            </PurchaseStateCard>
          )}

          {purchaseCycle.state === "proof_rejected" ? (
            <RetryProofCard role="alert">
              <b>🔄 Probemos otra vez</b>
              <span>{rejectionText}</span>
            </RetryProofCard>
          ) : null}

          {financeWasRequested ? (
            <FinanceDecisionCard data-status={financeDecision?.status || "requested"}>
              {!financeDecision ? (
                <><b>🗓 Solicitando cuotas…</b><span>Esperando la respuesta firmada de quien financia.</span></>
              ) : financeDecision.status === "review" ? (
                <><b>👀 La tienda está revisando tu solicitud</b><span>{financeDecision.message || "Tu pedido sigue abierto mientras la revisan."}</span></>
              ) : financeDecision.status === "rejected" ? (
                <>
                  <b>No pudimos usar estas cuotas</b>
                  <span>{financeDecision.message || "Podés continuar con otra forma de pago sin crear otro pedido."}</span>
                  <FinanceAlternativeRow>
                    <button type="button" onClick={() => chooseAnotherPaymentForSameOrder("cash")}>💸 Contado</button>
                    {externalCreditMatches
                      .filter((match) => match.offerId !== activeFinanceRequest?.attrs?.selectedOfferId)
                      .map((match) => (
                        <button key={match.offerId} type="button" onClick={() => chooseAnotherPaymentForSameOrder("credit", match.offerId)}>
                          🤝 {match.financeNodeName}
                        </button>
                      ))}
                    {liquidityProximity.network.length ? (
                      <button type="button" onClick={() => {
                        const option = liquidityProximity.network[0];
                        if (option.kind === "credit" && option.id.startsWith("credit:")) {
                          chooseAnotherPaymentForSameOrder("credit", option.id.slice("credit:".length));
                        }
                      }}>🤝 Red de Liquidez</button>
                    ) : null}
                  </FinanceAlternativeRow>
                </>
              ) : (
                <>
                  <b>✅ Cuotas aprobadas</b>
                  <FinanceDecisionTerms>
                    {approvedDownPayment != null ? <><span>Entrega inicial</span><strong>{formatCheckoutMoney(approvedDownPayment, approvedCurrency)}</strong></> : null}
                    {approvedInstallments != null ? <><span>Cantidad aprobada</span><strong>{approvedInstallments} cuotas</strong></> : null}
                    {approvedMonthly != null ? <><span>Valor mensual</span><strong>{formatCheckoutMoney(approvedMonthly, approvedCurrency)}</strong></> : null}
                    {approvedFinancedTotal != null ? <><span>Total financiado</span><strong>{formatCheckoutMoney(approvedFinancedTotal, approvedCurrency)}</strong></> : null}
                    {approvedFirstDue ? <><span>Primera fecha</span><strong>{formatCheckoutDate(approvedFirstDue)}</strong></> : null}
                  </FinanceDecisionTerms>
                </>
              )}
            </FinanceDecisionCard>
          ) : null}

          {identityConnected ? (
            <IdentityNote>
              <b>✓ {sellerDisplayName} conectado</b>
              {loyaltyView?.target ? <span>{loyaltyView.current}/{loyaltyView.target} sellos</span> : null}
              {currentIdentityLink?.finance ? <span>Cuotas disponibles</span> : null}
            </IdentityNote>
          ) : currentIdentityLink ? (
            <IdentityNote>🔗 Vinculación solicitada a {sellerDisplayName}</IdentityNote>
          ) : canRequestIdentityLink ? (
            <IdentityAction type="button" onClick={() => void requestIdentityConnection()}>🔗 Vincular mi cuenta {sellerDisplayName}</IdentityAction>
          ) : null}

          {purchaseCycle.paymentMethods.length > 1 && canAttachProof ? (
            <MethodChoices aria-label="Opciones de pago del comercio">
              {purchaseCycle.paymentMethods.map((method) => (
                <button
                  type="button"
                  key={method.method}
                  data-active={activeNodePaymentMethod?.method === method.method}
                  onClick={() => setSelectedNodeMethod(method.method)}
                >
                  {method.method === "transfer" ? "🏦 " : ""}{method.label}
                </button>
              ))}
            </MethodChoices>
          ) : null}

          {canAttachProof && activeNodePaymentMethod ? (
            <PaymentInstructionCard>
              <div className="payment-title">🏦 Transferí al comercio</div>
              <PaymentHeroAmount>{formatCheckoutMoney(paymentAmount, paymentCurrency)}</PaymentHeroAmount>
              {destination ? (
                <PaymentDestinationValue>
                  <span>{destination.label}</span>
                  <b>{destination.value}</b>
                  <Btn
                    kind="ghost"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(destination.value);
                        setMsg("Dato copiado ✓");
                      } catch {
                        setMsg("Mantené presionado el dato para copiarlo.");
                      }
                    }}
                  >
                    📋 Copiar
                  </Btn>
                </PaymentDestinationValue>
              ) : null}
              <div className="proof-copy">Cuando termines, enviá tu comprobante 👇</div>

              <input ref={cameraProofInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => onProofFileSelected(event.currentTarget.files?.[0])} />
              <input ref={galleryProofInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onProofFileSelected(event.currentTarget.files?.[0])} />

              {!proofFile ? (
                <ProofChoiceRow>
                  <Btn kind="ghost" type="button" onClick={() => cameraProofInputRef.current?.click()}>📷 Sacar foto</Btn>
                  <Btn kind="ghost" type="button" onClick={() => galleryProofInputRef.current?.click()}>🖼️ Elegir imagen</Btn>
                </ProofChoiceRow>
              ) : (
                <ProofPreview>
                  <img src={proofPreviewUrl} alt="Vista previa del comprobante" />
                  <div>
                    <button type="button" onClick={() => galleryProofInputRef.current?.click()}>Cambiar</button>
                    <button type="button" onClick={removeProofFile}>Eliminar</button>
                  </div>
                </ProofPreview>
              )}
              {proofError ? <HumanError role="alert">{proofError}</HumanError> : null}
            </PaymentInstructionCard>
          ) : null}

          {waitingLong ? (
            <WaitingCard>
              <b>Todavía no recibimos respuesta de la tienda.</b>
              <span>Tu pedido sigue enviado y no se cancelará automáticamente.</span>
            </WaitingCard>
          ) : null}

          {msg ? <Notice role="status">{msg}</Notice> : null}

          <NetworkDetails>
            <summary>⚙️ Detalles de red</summary>
            <NetworkGrid>
              <span>Nodo</span><b>{nodeIdentity.nodeId || nodeIdentity.originNode || nodeIdentity.sellerId}</b>
              <span>Pedido</span><b>{shortNetworkId(orderId)}</b>
              <span>Firma</span><b>{submittedOrder?.meta?.ownership?.signature?.value ? "Firmado" : "En verificación"}</b>
              {transportRoute ? <><span>Transporte</span><b>{transportRoute}</b></> : null}
              <span>Fecha</span><b>{new Date(submittedOrder?.meta?.ts || Date.now()).toLocaleString("es-PY")}</b>
            </NetworkGrid>
          </NetworkDetails>

          <StickyActions>
            {purchaseCycle.state === "accepted" ? (
              <>
                <Btn kind="ghost" type="button" onClick={onClose}>Seguir comprando</Btn>
                <Btn kind="solid" type="button" onClick={() => onDone({ orderId, threadId: orderThreadId })}>Ver pedido</Btn>
              </>
            ) : waitingLong ? (
              <>
                <Btn kind="ghost" type="button" onClick={onClose}>Volver</Btn>
                <Btn kind="solid" type="button" onClick={() => void retrySubmittedOrder()}>Reintentar</Btn>
              </>
            ) : canAttachProof ? (
              <>
                <Btn kind="ghost" type="button" onClick={onClose}>Volver</Btn>
                {proofFile ? (
                  <Btn kind="solid" type="button" disabled={proofUploadBusy} onClick={() => void enviarComprobantePrivado()}>
                    {proofUploadBusy ? "Enviando…" : "Enviar comprobante"}
                  </Btn>
                ) : purchaseCycle.state === "proof_rejected" ? (
                  <Btn kind="solid" type="button" onClick={() => cameraProofInputRef.current?.click()}>📷 Enviar otro comprobante</Btn>
                ) : null}
              </>
            ) : (
              <Btn kind="ghost" type="button" onClick={onClose}>Volver</Btn>
            )}
          </StickyActions>
        </Modal>
      </Backdrop>
    );
  }

  return (
    <>
      <Backdrop onClick={closeCheckout}>
        <Modal ref={motionSurface} role="dialog" aria-modal="true" aria-label="Comprar" onClick={(event) => event.stopPropagation()}>
          <CheckoutHeader>
            <HeaderBack type="button" onClick={closeCheckout} disabled={busy} aria-label="Volver">←</HeaderBack>
            <div>Comprar</div>
            <HeaderClose type="button" onClick={onClose} disabled={busy} aria-label="Cerrar">×</HeaderClose>
          </CheckoutHeader>

          <ProgressLine data-step="product">
            <span>Producto</span><i>→</i><span>Pago</span><i>→</i><span>Confirmación</span>
          </ProgressLine>

          <ReviewFields disabled={busy}>
          <ProductCard>
            <ProductMedia
              type="button"
              onClick={() => {
                if (!galleryImages.length) return;
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}
              disabled={!galleryImages.length}
              aria-label="Ver imágenes del producto"
            >
              {img ? <img src={img} alt={compactProductLabel(product)} /> : <span>UTOPY</span>}
              {galleryImages.length > 1 ? <ThumbBadge>+{galleryImages.length - 1}</ThumbBadge> : null}
            </ProductMedia>
            <ProductInfo>
              <div className="product-name">{compactProductLabel(product)}</div>
              <div className="seller">{sellerDisplayName}</div>
              <div className={productUnavailable ? "availability unavailable" : "availability"}>
                {productUnavailable ? "No disponible" : canonicalProduct.stock != null ? String(canonicalProduct.stock) + " disponibles" : "Disponible"}
              </div>
              <QuantityControl aria-label="Cantidad">
                <button type="button" onClick={() => setQty((current) => Math.max(1, current - 1))} aria-label="Quitar uno">−</button>
                <b>{qty}</b>
                <button type="button" onClick={() => setQty((current) => current + 1)} aria-label="Agregar uno">+</button>
              </QuantityControl>
            </ProductInfo>
            <ProductPrice>
              {oldTotal && savingsTotal > 0 ? <s>{formatCheckoutMoney(oldTotal, payPanelCurrency)}</s> : null}
              <strong>{formatCheckoutMoney(totalNum, payPanelCurrency)}</strong>
            </ProductPrice>
          </ProductCard>

          {oldTotal && savingsTotal > 0 && merchandising.discountPct ? (
            <SavingsBanner>🔥 Ahorrás {formatCheckoutMoney(savingsTotal, payPanelCurrency)} · {merchandising.discountPct}%</SavingsBanner>
          ) : null}

          {galleryImages.length > 1 ? (
            <GalleryStrip aria-label="Más imágenes">
              {galleryImages.slice(0, 8).map((src, index) => (
                <MiniThumb key={src + "-" + index} type="button" onClick={() => { setGalleryIndex(index); setGalleryOpen(true); }}>
                  <img src={src} alt={"Imagen " + (index + 1)} />
                </MiniThumb>
              ))}
            </GalleryStrip>
          ) : null}

          {supportsModifiers ? (
            <SoftSection>
              <SectionTitle><span>✨</span><div><b>Elegí como te gusta</b><small>Solo cambia este producto</small></div></SectionTitle>
              {modifierGroups.map((group: any) => (
                <OptionGroup key={String(group?.id || group?.label)}>
                  <label>{String(group?.label || "Opción")}</label>
                  <OptionScroller>
                    {(Array.isArray(group?.options) ? group.options : []).map((option: any) => {
                      const active = String(modifierSelections[String(group?.id || "")] || "") === String(option?.id || "");
                      return (
                        <OptionChip
                          type="button"
                          key={String(option?.id || option?.label)}
                          data-active={active}
                          onClick={() => setModifierSelections((current) => ({ ...current, [String(group?.id || "")]: String(option?.id || "") }))}
                        >
                          {String(option?.label || option?.id)}
                          {num(option?.price_delta, 0) ? " · " + (num(option?.price_delta, 0) > 0 ? "+" : "") + formatCheckoutMoney(num(option?.price_delta, 0), payPanelCurrency) : ""}
                        </OptionChip>
                      );
                    })}
                  </OptionScroller>
                </OptionGroup>
              ))}
            </SoftSection>
          ) : null}

          {supportsDelivery ? (
            <SoftSection>
              <SectionTitle><span>🛵</span><div><b>¿Cómo lo recibís?</b><small>Elegí lo más fácil para vos</small></div></SectionTitle>
              <ChoiceRow>
                <ChoiceButton type="button" data-active={deliveryMode === "pickup"} onClick={() => setDeliveryMode("pickup")}>
                  <span>🏪</span><div><b>Retiro</b><small>En {sellerDisplayName}</small></div>
                </ChoiceButton>
                <ChoiceButton type="button" data-active={deliveryMode === "delivery"} onClick={() => setDeliveryMode("delivery")}>
                  <span>🛵</span><div><b>Entrega</b><small>Hasta vos</small></div>
                </ChoiceButton>
              </ChoiceRow>
              {deliveryMode === "delivery" ? (
                <DeliveryFields>
                  <Input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Dirección o punto de referencia" />
                  <Btn kind="ghost" type="button" disabled={geoBusy} onClick={captureDeliveryLocation}>
                    {geoBusy ? "Buscando…" : deliveryGeo ? "Ubicación agregada ✓" : "📍 Usar mi ubicación"}
                  </Btn>
                </DeliveryFields>
              ) : null}
            </SoftSection>
          ) : null}

          <SoftSection>
            <SectionTitle><span>💚</span><div><b>¿Cómo querés pagar?</b><small>Mostramos solo lo disponible</small></div></SectionTitle>
            <PaymentChoiceGrid>
              <PaymentChoice type="button" data-active={financeChoice === "cash" && !selectedRightId && !selectedLiquidityOption} onClick={() => { setFinanceChoice("cash"); setSelectedRightId(""); setSelectedLiquidityOptionId(""); }}>
                <span>💸</span><div><b>Contado</b><small>Pago al comercio</small></div><i>✓</i>
              </PaymentChoice>
              {creditEnabled && creditPreview ? (
                <PaymentChoice type="button" data-active={financeChoice === "credit" && !selectedLiquidityOption} onClick={() => { setFinanceChoice("credit"); setSelectedLiquidityOptionId(""); setRecurringProposal(false); }}>
                  <span>🗓️</span><div><b>Cuotas</b><small>La tienda confirma</small></div><i>✓</i>
                </PaymentChoice>
              ) : null}
              {compatibleRights.length ? (
                <PaymentChoice type="button" data-active={Boolean(selectedRightId)} onClick={() => { setFinanceChoice("cash"); setSelectedLiquidityOptionId(""); setSelectedRightId(compatibleRights[0].dv.id); }}>
                  <span>🌱</span><div><b>Mi Valor</b><small>Tenés un beneficio</small></div><i>✓</i>
                </PaymentChoice>
              ) : null}
              {liquidityProximity.network.length ? (
                <PaymentChoice type="button" data-active={Boolean(selectedLiquidityOption)} onClick={() => { setSelectedRightId(""); setSelectedLiquidityOptionId(liquidityProximity.network[0].id); }}>
                  <span>🤝</span><div><b>Red de Liquidez</b><small>Hay una posibilidad real</small></div><i>✓</i>
                </PaymentChoice>
              ) : null}
            </PaymentChoiceGrid>

            {financeChoice === "cash" && !selectedRightId && !selectedLiquidityOption ? (
              <PaymentExpand>
                <b>💸 Pago directo al comercio</b>
                <span>Después de enviar el pedido, la tienda te dará una opción válida para esta compra.</span>
              </PaymentExpand>
            ) : null}

            {financeChoice === "credit" && creditPreview ? (
              <PaymentExpand>
                <div className="finance-title">🗓️ Pagá a tu ritmo</div>
                <InstallmentHero>
                  <div><span>{creditPreview.installmentCount} cuotas</span>{creditPreview.installmentValue != null ? <strong>{formatCheckoutMoney(creditPreview.installmentValue, creditPreview.currency)} <small>/ {intervalText}</small></strong> : <strong>La tienda confirma el valor</strong>}</div>
                  <div><span>Entrega inicial</span><b>{formatCheckoutMoney(creditPreview.downPaymentMin, creditPreview.currency)}</b></div>
                </InstallmentHero>
                <InstallmentChips aria-label="Cuotas disponibles">
                  {authorizedInstallmentOptions.map((option) => (
                    <button type="button" key={option.id + ":" + option.count} data-active={selectedFinanceOptionId === option.id} onClick={() => setSelectedFinanceOptionId(option.id)} title={option.provider}>{option.count}x</button>
                  ))}
                </InstallmentChips>
                <FinanceFacts>
                  <span>Total de la compra</span><b>{formatCheckoutMoney(totalNum, creditPreview.currency)}</b>
                  {creditPreview.financed != null ? <><span>Parte financiada</span><b>{formatCheckoutMoney(creditPreview.financed, creditPreview.currency)}</b></> : null}
                </FinanceFacts>
                <small className="human-note">La tienda confirmará tu solicitud de cuotas.</small>
              </PaymentExpand>
            ) : null}

            {selectedRightId ? (
              <PaymentExpand>
                <b>🌱 Tenés un beneficio disponible</b>
                <span>Este comercio publicó que puede aceptarlo.</span>
                <BenefitChoices>
                  {compatibleRights.map((right) => (
                    <button type="button" key={right.dv.id} data-active={selectedRightId === right.dv.id} onClick={() => setSelectedRightId(right.dv.id)}>🎁 {right.dv?.attrs?.title || "Usar beneficio"}</button>
                  ))}
                </BenefitChoices>
              </PaymentExpand>
            ) : null}

            {selectedLiquidityOption ? (
              <PaymentExpand>
                <b>🤝 Tu red puede ayudar</b>
                <span>Encontramos una posibilidad para completar esta compra.</span>
                <BenefitChoices>
                  {liquidityProximity.network.map((option) => (
                    <button type="button" key={option.id} data-active={selectedLiquidityOptionId === option.id} onClick={() => {
                      setSelectedLiquidityOptionId(option.id);
                      if (option.kind === "credit" && option.id.startsWith("credit:")) {
                        setFinanceChoice("credit");
                        setSelectedFinanceOptionId(option.id.slice("credit:".length));
                      }
                    }}>{option.name} · Ver opciones</button>
                  ))}
                  {onOpenMap ? <button type="button" onClick={() => onOpenMap({
                    productId: canonicalProduct.productId,
                    sellerNodeId: canonicalProduct.sellerNodeId || nodeIdentity.nodeId || nodeIdentity.originNode || nodeIdentity.sellerId,
                    amount: totalNum,
                    currency: payPanelCurrency,
                    buyerActorId: buyerId,
                    threadId: checkoutThreadId || null,
                    relationshipId: selectedLiquidityOption.source?.attrs?.relationshipId || selectedLiquidityOption.source?.meta?.relationshipId || null,
                  })}>🗺 Ver en Mapa Vivo</button> : null}
                </BenefitChoices>
              </PaymentExpand>
            ) : null}
          </SoftSection>

          {loyaltyView ? (
            <LoyaltyCard>
              <div><b>💜 {sellerDisplayName}</b><span>{loyaltyView.rewardAvailable ? "🎁 " + (loyaltyView.reward || "Tenés una recompensa") : loyaltyView.remaining ? "Te faltan " + loyaltyView.remaining + " compras para tu próxima recompensa" : loyaltyView.reward}</span></div>
              {loyaltyView.target > 0 && loyaltyView.target <= 10 ? (
                <LoyaltyDots aria-label={loyaltyView.current + " de " + loyaltyView.target}>
                  {Array.from({ length: loyaltyView.target }).map((_, index) => <i key={index} data-filled={index < loyaltyView.current}>●</i>)}
                  <small>{loyaltyView.current}/{loyaltyView.target}</small>
                </LoyaltyDots>
              ) : null}
            </LoyaltyCard>
          ) : null}

          {identityConnected ? (
            <IdentityNote>
              <b>✓ {sellerDisplayName} conectado</b>
              {loyaltyView?.target ? <span>{loyaltyView.current}/{loyaltyView.target} sellos</span> : null}
              {currentIdentityLink?.finance ? <span>Cuotas disponibles</span> : null}
            </IdentityNote>
          ) : currentIdentityLink ? (
            <IdentityNote>🔗 Vinculación solicitada a {sellerDisplayName}</IdentityNote>
          ) : canRequestIdentityLink ? (
            <IdentityAction type="button" onClick={() => void requestIdentityConnection()}>🔗 Vincular mi cuenta {sellerDisplayName}</IdentityAction>
          ) : null}

          {financeChoice !== "credit" ? (
            <RecurringDetails>
              <summary>🔁 ¿Querés repetir esta compra?</summary>
              <label><input type="checkbox" checked={recurringProposal} onChange={(event) => setRecurringProposal(event.target.checked)} /> Proponerla cada mes</label>
              {recurringProposal ? <small>Esto no autoriza débitos automáticos. Cada pago se decide por separado.</small> : null}
            </RecurringDetails>
          ) : null}

          <NetworkDetails>
            <summary>⚙️ Detalles de red</summary>
            <NetworkGrid>
              <span>Nodo</span><b>{nodeIdentity.nodeId || nodeIdentity.originNode || nodeIdentity.sellerId}</b>
              <span>Pedido</span><b>{shortNetworkId(payPanelSession.orderId)}</b>
              <span>Firma</span><b>Se firma al confirmar</b>
              <span>Fecha</span><b>{new Date().toLocaleDateString("es-PY")}</b>
            </NetworkGrid>
            {!activeCajero && onNeedCajero ? <Btn kind="ghost" type="button" onClick={onNeedCajero}>Elegir operador</Btn> : null}
          </NetworkDetails>

          {msg ? <Notice role="status">{msg}</Notice> : null}

          </ReviewFields>
          <StickyActions>
            <CheckoutTotal><span>Total a confirmar por la tienda</span><strong>{formatCheckoutMoney(totalNum, payPanelCurrency)}</strong></CheckoutTotal>
            <Btn kind="ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</Btn>
            <Btn kind="solid" type="button" onClick={confirmar} disabled={cannotConfirm}>
              {busy ? "Enviando…" : financeChoice === "credit" ? "Solicitar cuotas" : supportsDelivery && deliveryMode === "delivery" ? "Comprar con entrega" : "Confirmar compra"}
            </Btn>
          </StickyActions>
        </Modal>
      </Backdrop>

      {galleryOpen && galleryImages.length > 0 ? (
        <GalleryBackdrop onClick={() => setGalleryOpen(false)}>
          <GalleryModal ref={gallerySurface} role="dialog" aria-modal="true" aria-label="Imágenes del producto" onClick={(event) => event.stopPropagation()}>
            <GalleryTop>
              <b>{galleryIndex + 1} / {galleryImages.length}</b>
              <Btn kind="ghost" type="button" onClick={() => setGalleryOpen(false)}>Cerrar</Btn>
            </GalleryTop>
            <GalleryStage>
              {galleryImages.length > 1 ? <NavBtn left type="button" onClick={() => setGalleryIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length)}>‹</NavBtn> : null}
              <GalleryImage src={galleryImages[galleryIndex]} alt={"Imagen " + (galleryIndex + 1)} />
              {galleryImages.length > 1 ? <NavBtn type="button" onClick={() => setGalleryIndex((current) => (current + 1) % galleryImages.length)}>›</NavBtn> : null}
            </GalleryStage>
          </GalleryModal>
        </GalleryBackdrop>
      ) : null}
    </>
  );

/* Legacy visual kept out of the bundle while the shared protocol remains intact.
  return (
    <>
      <Backdrop onClick={onClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <TopRow>
            <div>
              <CheckoutEyebrow>UTOPY CHECKOUT</CheckoutEyebrow>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Tu compra, clara y protegida</div>
            </div>
            <Btn kind="ghost" onClick={onClose} disabled={busy}>
              ×
            </Btn>
          </TopRow>

          <CheckoutSteps>
            <b>1 · Resumen</b><span>2 · Pago del nodo</span><span>3 · Confirmación</span>
          </CheckoutSteps>

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
                {unitPriceStr} /{" "}
                {safeStr(product?.unidad || product?.unit || "u")}{" "}
                {safeStr(product?.attrs?.currency || product?.currency || "")}
              </Subtle>
              {merchandising.basePrice && merchandising.discountPct ? (
                <DiscountLine>
                  <s>{merchandising.basePrice.toLocaleString("es-PY")} {safeStr(product?.attrs?.currency || product?.currency || "PYG")}</s>
                  <b>-{merchandising.discountPct}%</b>
                </DiscountLine>
              ) : null}
              <Subtle>
                {productUnavailable
                  ? "Agotado · no se puede comprar"
                  : `Stock: ${canonicalProduct.stock ?? "disponible"}`}
              </Subtle>
              <Subtle>
                🌱 {" "}
                {nodeIdentity.storeName ||
                  nodeIdentity.sellerName ||
                  nodeIdentity.nodeId ||
                  "Comercio"}
              </Subtle>
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

          <ValueStrip>
            <span>🏪 Pago al nodo</span>
            <span>🤝 Vos confirmás</span>
            <span>✓ Comprobante verificable</span>
          </ValueStrip>

          {supportsModifiers ? (
            <Card>
              <div style={{ fontWeight: 950 }}>Elegí tus adicionales</div>
              <Subtle>
                Se conservan en el DV, checkout, cocina e impresión Bematech.
              </Subtle>
              {modifierGroups.map((group: any) => (
                <RowGap key={String(group?.id || group?.label)}>
                  <label style={{ fontWeight: 900 }}>
                    {String(group?.label || "Opción")}
                  </label>
                  <select
                    value={modifierSelections[String(group?.id || "")] || ""}
                    onChange={(event) =>
                      setModifierSelections((current) => ({
                        ...current,
                        [String(group?.id || "")]: event.target.value,
                      }))
                    }
                    style={{
                      minHeight: 42,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,.14)",
                      padding: "0 12px",
                      background: "#fff",
                      fontWeight: 800,
                    }}
                  >
                    {(Array.isArray(group?.options) ? group.options : []).map(
                      (option: any) => (
                        <option
                          key={String(option?.id || option?.label)}
                          value={String(option?.id || "")}
                        >
                          {String(option?.label || option?.id)}
                          {num(option?.price_delta, 0) === 0
                            ? ""
                            : ` · ${num(option?.price_delta, 0) > 0 ? "+" : ""}${num(
                                option?.price_delta,
                                0,
                              )} BRL`}
                        </option>
                      ),
                    )}
                  </select>
                </RowGap>
              ))}
            </Card>
          ) : null}

          {supportsDelivery ? (
            <Card>
              <div style={{ fontWeight: 950 }}>Entrega viva</div>
              <Subtle>
                Retirá en el nodo o pedí una entrega a la red cercana.
              </Subtle>
              <RadioRow>
                <input
                  type="radio"
                  name="lapiedraDelivery"
                  checked={deliveryMode === "pickup"}
                  onChange={() => setDeliveryMode("pickup")}
                />
                Retiro en {nodeIdentity.storeName || nodeIdentity.sellerName || "el comercio"}
              </RadioRow>
              <RadioRow>
                <input
                  type="radio"
                  name="lapiedraDelivery"
                  checked={deliveryMode === "delivery"}
                  onChange={() => setDeliveryMode("delivery")}
                />
                Entrega con Falcon
              </RadioRow>
              {deliveryMode === "delivery" ? (
                <>
                  <Input
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Dirección o punto de referencia"
                  />
                  <Btn
                    kind="ghost"
                    type="button"
                    disabled={geoBusy}
                    onClick={captureDeliveryLocation}
                  >
                    {geoBusy
                      ? "Buscando ubicación…"
                      : deliveryGeo
                        ? "Ubicación agregada ✓"
                        : "Usar mi ubicación"}
                  </Btn>
                </>
              ) : null}
            </Card>
          ) : null}

          <AdvancedCheckout open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
            <summary>Ver detalles de red</summary>
            {advancedOpen ? <>
            <Card>
              <Card>
  <div style={{ fontWeight: 950 }}>Red de Liquidez</div>
  <Subtle>
    Posibilidades verificables para esta compra. UTOPY no custodia tu dinero.
  </Subtle>

  <Suspense fallback={<Subtle>Preparando detalles…</Subtle>}><MtLiquidityPanel
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
        `Hay una posibilidad de la red disponible para esta compra en ${payload.currency}.`
      );
    }}
    onOpenPayCenter={() => {
      setMsg("Abrí el Pay Center para ver liquidez del comprador y del comercio.");
    }}
  /></Suspense>
</Card>
{activePulse && (
  <Card>
    <div style={{ fontWeight: 950 }}>💓 Pago cercano</div>

    <Subtle>
      Señal emitida por el comercio para reconocer este pago.
    </Subtle>

    <div
      style={{
        fontSize: 26,
        fontWeight: 950,
        letterSpacing: "0.04em",
        padding: "12px",
        borderRadius: 14,
        background: "rgba(34,197,94,0.10)",
        textAlign: "center",
      }}
    >
      {String(activePulse.attrs?.word || "Pago").replace(/^./, (letter) => letter.toUpperCase())} {activePulse.attrs?.code || ""}
    </div>

    <Subtle>
      Método recomendado: {safeStr(recommendedMethod?.label || "Transferencia al comercio")}
    </Subtle>
  </Card>
)}
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

            </div>
            )}
            </> : null}
          </AdvancedCheckout>

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

         <Section>
  <PaymentDestination>
    <div><span>Cobra este nodo</span><b>{payPanelSession.sellerName || payPanelSession.sellerId}</b></div>
    {!activeCajero && onNeedCajero ? <Btn kind="ghost" onClick={onNeedCajero}>Elegir operador</Btn> : null}
  </PaymentDestination>

  {financeChoice === "credit" ? <UtopyPayPanel
    key={`${payPanelSession.orderId}:${totalNum}:${payPanelCurrency}`}
    input={{
      sessionId:
        utopyPayView?.session?.attrs.orderId === payPanelSession.orderId &&
        utopyPayView.session.attrs.amount === totalNum &&
        utopyPayView.session.attrs.currency === payPanelCurrency
          ? utopyPayView.session.attrs.sessionId
          : undefined,
      orderId: payPanelSession.orderId,
      threadId: payPanelSession.threadId,
      buyer: {
        id: buyerId,
        name: buyerName || null,
      },
      seller: {
        id: payPanelSession.sellerId,
        name: payPanelSession.sellerName,
        nodeId:
          product?.attrs?.originNode ||
          product?.meta?.originNode ||
          payPanelSession.sellerId,
      },
      operator: activeCajero?.id
        ? { id: activeCajero.id, name: activeCajero.nombre || activeCajero.id }
        : null,
      amount: totalNum,
      currency: payPanelCurrency,
      concept: compactProductLabel(product),
      productId: product?.id || null,
      accepted: paymentOffer?.attrs?.accepted || [],
      ns: product?.meta?.ns ?? "mt:market",
      source: "ms.web.checkout",
    }}
    onSession={setUtopyPayView}
  /> : (
    <Card>
      <div style={{ fontWeight: 950 }}>Pago del comercio</div>
      <Subtle>
        Después de enviar el pedido, el comercio indicará una opción válida para esta compra.
      </Subtle>
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
            setRecurringProposal(false);
          }}
        />
        Comprar a crédito
      </RadioRow>

      {financeChoice === "credit" && (
        <PlanBox>
          <Subtle><b>Elegí quién evalúa la financiación:</b></Subtle>
          {sellerCreditPreview ? (
            <RadioRow>
              <input
                type="radio"
                name="financeProvider"
                checked={selectedFinanceOptionId === "seller"}
                onChange={() => setSelectedFinanceOptionId("seller")}
              />
              {nodeIdentity.sellerName || "Nodo vendedor"} · financiación del comercio
            </RadioRow>
          ) : null}
          {externalCreditMatches.map((match) => (
            <RadioRow key={match.offerId}>
              <input
                type="radio"
                name="financeProvider"
                checked={selectedFinanceOptionId === match.offerId}
                onChange={() => setSelectedFinanceOptionId(match.offerId)}
              />
              {match.financeNodeName} · {match.habitualRelationship ? "relación activa" : "oferta abierta"}
            </RadioRow>
          ))}
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

          <Subtle>
            <b>Decide:</b>{" "}
            {creditPreview.financeNodeName || creditPreview.financeNodeId || "nodo vendedor"}.
            La solicitud no abre una cuenta ni aprueba crÃ©dito automÃ¡ticamente.
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

  {compatibleRights.length ? (
    <Card>
      <div style={{ fontWeight: 950 }}>Derechos disponibles en este nodo</div>
      <RadioRow>
        <input
          type="radio"
          name="checkoutRight"
          checked={!selectedRightId}
          onChange={() => setSelectedRightId("")}
        />
        Comprar sin solicitar un derecho
      </RadioRow>
      {compatibleRights.map((right) => (
        <RadioRow key={right.dv.id}>
          <input
            type="radio"
            name="checkoutRight"
            checked={selectedRightId === right.dv.id}
            onChange={() => setSelectedRightId(right.dv.id)}
          />
          {right.dv?.attrs?.title || "Beneficio disponible"}
        </RadioRow>
      ))}
      <Subtle>
        El nodo emisor debe confirmar el uso. La solicitud sola no cierra ni descuenta el derecho.
      </Subtle>
    </Card>
  ) : null}

  {financeChoice !== "credit" && (
    <AdvancedCheckout>
      <summary>Abastecimiento recurrente</summary>
      <Card>

      <RadioRow>
        <input
          type="checkbox"
          checked={recurringProposal}
          onChange={(e) => setRecurringProposal(e.target.checked)}
        />
        Proponer repetir este pedido cada mes
      </RadioRow>

      {recurringProposal && (
        <Subtle style={{ opacity: 0.75 }}>
          Esto propone un abastecimiento recurrente. No autoriza cobros
          automáticos; podrás elegir cómo pagar después del acuerdo.
        </Subtle>
      )}
      </Card>
    </AdvancedCheckout>
  )}

</Section>

          {msg && <Subtle style={{ marginTop: 6 }}>{msg}</Subtle>}

          <Actions>
            <div className="checkout-action-total"><small>Total del pedido</small><strong>{formatCheckoutMoney(totalNum, payPanelCurrency)}</strong></div>
            <Btn kind="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Btn>
            <Btn kind="solid" onClick={confirmar} disabled={cannotConfirm}>
	  {busy
	    ? "Procesando..."
	    : financeChoice === "credit"
	    ? "Crear crédito"
	    : supportsDelivery && deliveryMode === "delivery"
      ? "Confirmar con entrega"
      : "Confirmar pedido"}
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
*/
}

/* ---------- UI responsive ---------- */
const CheckoutHeader = styled.header`
  position: sticky;
  top: -18px;
  z-index: 8;
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  min-height: 58px;
  margin: -18px -18px 0;
  padding: 12px 18px 6px;
  background: rgba(252, 255, 253, .9);
  backdrop-filter: blur(16px) saturate(1.15);
  > div { text-align: center; font-size: 18px; font-weight: 950; letter-spacing: -.02em; }
  @media (max-width: 640px) { top: -16px; margin: -16px -16px 0; padding: 10px 16px 5px; }
`;

const HeaderBack = styled.button`
  width: 42px; height: 42px; border: 0; border-radius: 999px; background: transparent;
  color: #102119; font-size: 24px; cursor: pointer;
  &:hover { background: rgba(15, 23, 42, .06); }
`;

const HeaderClose = styled(HeaderBack)`
  border: 1px solid rgba(15, 23, 42, .1);
  background: rgba(255,255,255,.76);
  font-size: 21px;
`;

const ProgressLine = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 0 5px 4px;
  color: #849188;
  font-size: 11px;
  font-weight: 850;
  span:first-child, &[data-step="payment"] span:nth-of-type(-n+2), &[data-step="confirmation"] span { color: #13773d; }
  i { height: 1px; overflow: hidden; background: #d9e5dc; color: transparent; }
`;

const ProductCard = styled.section`
  min-width: 0;
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 13px;
  border: 1px solid rgba(21, 128, 61, .12);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(241,249,244,.86));
  box-shadow: 0 12px 34px rgba(17, 65, 38, .07);
  @media (max-width: 460px) { grid-template-columns: 78px minmax(0, 1fr); gap: 11px; }
`;

const ProductMedia = styled.button`
  position: relative; width: 90px; height: 90px; padding: 0; overflow: hidden;
  border: 0; border-radius: 19px; background: linear-gradient(145deg,#ecf5ef,#e5f0e9);
  color: #2f6d48; font-size: 11px; font-weight: 950; cursor: pointer;
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  &:disabled { cursor: default; }
  @media (max-width: 460px) { width: 78px; height: 78px; border-radius: 17px; }
`;

const ProductInfo = styled.div`
  min-width: 0; display: grid; gap: 3px;
  .product-name { font-size: 16px; font-weight: 950; line-height: 1.15; }
  .seller { color: #53645a; font-size: 12px; }
  .seller b { color: #159447; }
  .availability { color: #168247; font-size: 11px; font-weight: 850; }
  .availability.unavailable { color: #be123c; }
`;

const QuantityControl = styled.div`
  display: grid; grid-template-columns: 34px 34px 34px; align-items: center; width: max-content; margin-top: 5px;
  border: 1px solid #dae5dd; border-radius: 999px; background: #fff; overflow: hidden;
  button { width: 44px; height: 44px; border: 0; background: transparent; font-size: 18px; cursor: pointer; }
  b { text-align: center; font-size: 13px; }
  grid-template-columns:44px 34px 44px;
`;

const ReviewFields = styled.fieldset`display:contents;border:0;padding:0;margin:0;min-width:0;`;
const CheckoutTotal = styled.div`flex:1 0 100%;display:flex;justify-content:space-between;align-items:baseline;gap:12px;span{font-size:11px;color:#647168}strong{font-size:18px;color:#17251c}@media(max-width:380px){flex-wrap:wrap}`;

const ProductPrice = styled.div`
  display: grid; justify-items: end; gap: 2px; white-space: nowrap;
  s { color: #8b9790; font-size: 11px; }
  strong { color: #0d2418; font-size: 18px; font-weight: 1000; overflow-wrap: anywhere; }
  @media (max-width: 460px) { grid-column: 1 / -1; grid-template-columns: auto auto; justify-content: space-between; justify-items: start; width: 100%; strong { font-size: 20px; } }
`;

const SavingsBanner = styled.div`
  padding: 10px 13px; border-radius: 16px; color: #b42335; background: #fff1f2;
  border: 1px solid #fecdd3; font-size: 13px; font-weight: 950; text-align: center;
`;

const SoftSection = styled.section`
  display: grid; gap: 11px; padding: 14px; border: 1px solid rgba(15, 23, 42, .07);
  border-radius: 22px; background: rgba(255,255,255,.72);
`;

const SectionTitle = styled.div`
  display: flex; align-items: center; gap: 10px;
  > span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; background: #eaf8ee; }
  > div { display: grid; gap: 1px; }
  b { font-size: 14px; }
  small { color: #718078; font-size: 11px; }
`;

const OptionGroup = styled.div`
  display: grid; gap: 6px;
  > label { color: #516158; font-size: 11px; font-weight: 900; }
`;

const OptionScroller = styled.div`
  display: flex; gap: 7px; overflow-x: auto; padding: 1px 1px 4px; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const OptionChip = styled.button`
  flex: 0 0 auto; min-height: 38px; padding: 8px 12px; border: 1px solid #d9e4dc; border-radius: 999px;
  background: #fff; color: #425148; font-size: 12px; font-weight: 850; cursor: pointer;
  &[data-active="true"] { color: #0e6432; border-color: #54d27c; background: #ecfdf2; box-shadow: 0 4px 14px rgba(22, 163, 74, .1); }
`;

const ChoiceRow = styled.div`
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
`;

const ChoiceButton = styled.button`
  display: flex; align-items: center; gap: 9px; min-height: 64px; padding: 10px; text-align: left;
  border: 1px solid #dfe7e1; border-radius: 17px; background: #fff; cursor: pointer;
  > span { font-size: 20px; } div { min-width: 0; display: grid; gap: 2px; } b { font-size: 13px; } small { color: #77847c; font-size: 10px; }
  &[data-active="true"] { border-color: #5bd582; background: #edfbf1; box-shadow: inset 0 0 0 1px rgba(21,128,61,.08); }
`;

const DeliveryFields = styled.div`
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const PaymentChoiceGrid = styled.div`
  display: grid; gap: 8px;
`;

const PaymentChoice = styled.button`
  display: grid; grid-template-columns: 38px minmax(0, 1fr) 24px; align-items: center; gap: 10px;
  width: 100%; min-height: 66px; padding: 11px 13px; text-align: left; border: 1px solid #dfe8e2;
  border-radius: 18px; background: rgba(255,255,255,.9); cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease;
  > span { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px; background: #f1f6f3; font-size: 20px; }
  > div { display: grid; gap: 2px; } b { font-size: 14px; } small { color: #718078; font-size: 11px; }
  > i { display: none; place-items: center; width: 22px; height: 22px; border-radius: 999px; color: #fff; background: #18a94e; font-size: 11px; font-style: normal; }
  &[data-active="true"] { border-color: #4bd078; background: #effcf3; transform: translateY(-1px); }
  &[data-active="true"] > i { display: grid; }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const PaymentExpand = styled.div`
  display: grid; gap: 9px; padding: 13px; border-radius: 18px; background: linear-gradient(145deg,#f4fbf6,#edf8f1);
  border: 1px solid #d6eadc; animation: reveal .18s ease-out;
  > span, .human-note { color: #5f6e65; font-size: 11px; line-height: 1.45; }
  .finance-title { font-size: 16px; font-weight: 950; }
  @keyframes reveal { from { opacity: .3; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const InstallmentHero = styled.div`
  display: grid; grid-template-columns: 1.3fr .7fr; gap: 8px;
  > div { display: grid; gap: 3px; padding: 11px; border-radius: 15px; background: rgba(255,255,255,.78); }
  span { color: #607067; font-size: 10px; } strong { color: #0e5f31; font-size: 18px; } strong small { font-size: 10px; }
  @media (max-width: 430px) { grid-template-columns: 1fr; }
`;

const InstallmentChips = styled.div`
  display: flex; gap: 7px; overflow-x: auto; padding-bottom: 3px; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  button { flex: 0 0 auto; min-width: 48px; min-height: 38px; border: 1px solid #d6e3da; border-radius: 999px; background: #fff; font-weight: 900; cursor: pointer; }
  button[data-active="true"] { color: #fff; border-color: #168443; background: #168443; }
`;

const FinanceFacts = styled.div`
  display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; font-size: 11px;
  span { color: #6c7971; } b { text-align: right; }
`;

const BenefitChoices = styled.div`
  display: flex; gap: 7px; overflow-x: auto;
  button { flex: 0 0 auto; padding: 9px 11px; border: 1px solid #d8e4dc; border-radius: 13px; background: #fff; font-weight: 850; cursor: pointer; }
  button[data-active="true"] { border-color: #54cd79; background: #edfbf1; }
`;

const LoyaltyCard = styled.section`
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 14px;
  border: 1px solid #eadcf4; border-radius: 20px; background: linear-gradient(145deg,#fff,#faf5ff);
  > div { display: grid; gap: 4px; } span { color: #6e5f75; font-size: 11px; }
  @media (max-width: 460px) { align-items: flex-start; flex-direction: column; }
`;

const LoyaltyDots = styled.div`
  display: flex; align-items: center; gap: 3px; color: #d9c7e5;
  i { font-style: normal; font-size: 13px; } i[data-filled="true"] { color: #8f48b5; } small { margin-left: 5px; color: #70547e; font-weight: 900; }
`;

const IdentityNote = styled.div`
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px;
  padding: 10px 12px; color: #17663a; border-radius: 15px; background: #eefaf2; font-size: 12px; font-weight: 900;
  span { padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.72); color: #39704e; font-size: 10px; }
`;

const IdentityAction = styled.button`
  justify-self: start; min-height: 40px; padding: 9px 12px; border: 1px solid #cfddd4; border-radius: 14px;
  background: #fff; color: #17663a; font-size: 12px; font-weight: 900; cursor: pointer;
`;

const RecurringDetails = styled.details`
  padding: 10px 12px; border: 1px solid rgba(15,23,42,.07); border-radius: 16px; background: rgba(255,255,255,.68);
  summary { color: #506057; font-size: 12px; font-weight: 900; cursor: pointer; }
  label { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; font-weight: 800; }
  small { display: block; margin-top: 8px; color: #6e7b73; line-height: 1.4; }
`;

const NetworkDetails = styled.details`
  padding: 10px 12px; border: 1px solid rgba(15,23,42,.07); border-radius: 16px; background: rgba(255,255,255,.62);
  summary { color: #617067; font-size: 11px; font-weight: 850; cursor: pointer; }
  &[open] { display: grid; gap: 10px; }
`;

const NetworkGrid = styled.div`
  display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 7px 10px; padding-top: 5px; font-size: 10px;
  span { color: #7a867f; } b { min-width: 0; overflow-wrap: anywhere; color: #39473f; }
`;

const Notice = styled.div`
  padding: 10px 12px; border-radius: 14px; color: #48574e; background: #f4f7f5; font-size: 11px; line-height: 1.4;
`;

const StickyActions = styled.div`
  position: sticky; bottom: -18px; z-index: 8; display: flex; flex-wrap:wrap; justify-content: flex-end; gap: 8px;
  margin: 2px -18px -18px; padding: 12px 18px calc(18px + env(safe-area-inset-bottom));
  overflow-x: auto; background: rgba(252,255,253,.92); backdrop-filter: blur(16px) saturate(1.1);
  border-top: 1px solid rgba(15,23,42,.06); scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  > button { flex: 0 0 auto; min-height: 46px; }
  @media (max-width: 640px) {
    bottom: -16px; margin: 2px -16px -16px; padding: 11px 16px calc(12px + env(safe-area-inset-bottom));
    > button { flex: 1 1 0; min-width: 0; padding-inline: 10px; white-space: nowrap; font-size: 12px; }
  }
`;

const LivingTimeline = styled.div`
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 3px;
`;

const TimelineStep = styled.div`
  position: relative; display: grid; justify-items: center; gap: 4px; color: #9aa59e; font-size: 9px; font-weight: 850;
  &:not(:last-child)::after { content: ""; position: absolute; top: 9px; left: 63%; width: 74%; height: 1px; background: #dfe7e1; }
  i { position: relative; z-index: 1; display: grid; place-items: center; width: 19px; height: 19px; border-radius: 999px; background: #edf2ef; font-size: 9px; font-style: normal; }
  &[data-state="done"], &[data-state="current"] { color: #14703a; }
  &[data-state="done"] i { color: #fff; background: #1aaa51; }
  &[data-state="current"] i { color: #159044; background: #d9f9e3; animation: gentlePulse 1.8s ease-in-out infinite; }
  @keyframes gentlePulse { 50% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { &[data-state="current"] i { animation: none; } }
`;

const SuccessView = styled.section`
  display: grid; justify-items: center; gap: 5px; padding: 19px 15px; text-align: center;
  .celebration { font-size: 38px; } h2 { margin: 0; font-size: 25px; } p { margin: 0 0 8px; color: #5e6d64; font-size: 13px; }
`;

const SuccessReceipt = styled.div`
  width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; padding: 13px; text-align: left;
  border: 1px solid #d9e7dd; border-radius: 17px; background: #f4fbf6; font-size: 12px;
  span:nth-child(2) { text-align: right; color: #617067; } b { grid-column: 1 / -1; text-align: right; font-size: 17px; }
`;

const DeliveryNote = styled.div`
  padding: 8px 11px; border-radius: 999px; color: #166534; background: #eaf9ef; font-size: 11px; font-weight: 850;
`;

const RetryProofCard = styled.div`
  display: grid; gap: 4px; padding: 12px 13px; border: 1px solid #fecdd3; border-radius: 17px; background: #fff1f2;
  color: #9f1239; b { font-size: 14px; } span { font-size: 11px; }
`;

const FinanceDecisionCard = styled.section`
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #d8e7dc;
  border-radius: 20px;
  background: linear-gradient(145deg, #f2fbf5, #fff);
  b { font-size: 15px; }
  > span { color: #58685f; font-size: 12px; line-height: 1.45; }
  &[data-status="requested"], &[data-status="review"] { border-color: #fde68a; background: #fffbeb; }
  &[data-status="rejected"] { border-color: #fecdd3; background: #fff1f2; }
`;

const FinanceDecisionTerms = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px 14px;
  padding-top: 4px;
  span { color: #64748b; font-size: 11px; }
  strong { text-align: right; color: #173d28; font-size: 12px; }
`;

const FinanceAlternativeRow = styled.div`
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-top: 2px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  button {
    flex: 0 0 auto;
    min-height: 38px;
    padding: 8px 11px;
    border: 1px solid #e4d4d8;
    border-radius: 13px;
    background: #fff;
    color: #334155;
    font-weight: 900;
    cursor: pointer;
  }
`;

const PaymentHeroAmount = styled.div`
  color: #10241a; font-size: clamp(26px, 7vw, 34px); font-weight: 1000; letter-spacing: -.035em;
`;

const PurchaseSummary = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 12px;
  border-radius: 20px;
  background: rgba(244, 250, 246, .86);
  border: 1px solid #dce8df;
  img { width: 54px; height: 54px; object-fit: cover; border-radius: 15px; background: #fff; }
  div { min-width: 0; display: grid; gap: 3px; }
  b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span { color: #64748b; font-size: 11px; }
  strong { font-size: 15px; white-space: nowrap; }
  @media (max-width: 430px) { grid-template-columns: auto minmax(0,1fr); strong { grid-column: 2; justify-self: start; } }
`;

const PurchaseStateCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px;
  border-radius: 21px;
  border: 1px solid #d7e4da;
  background: #effaf2;
  &[data-tone="amber"] { background: #fffbeb; border-color: #fde68a; }
  &[data-tone="red"] { background: #fff1f2; border-color: #fecdd3; }
  div { display: grid; gap: 3px; }
  b { font-size: 15px; }
  span { color: #52635a; font-size: 12px; line-height: 1.45; }
`;

const StatusMark = styled.span`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: #166534;
  background: #dcfce7;
  font-weight: 1000;
`;

const MethodChoices = styled.div`
  display: flex;
  gap: 7px;
  overflow-x: auto;
  button {
    flex: 0 0 auto;
    border: 1px solid #d7e1da;
    border-radius: 999px;
    padding: 8px 11px;
    background: #fff;
    color: #334155;
    font-weight: 900;
    cursor: pointer;
  }
  button[data-active="true"] { color: #14532d; border-color: #4ade80; background: #ecfdf3; }
`;

const PaymentInstructionCard = styled.div`
  display: grid;
  gap: 11px;
  padding: 16px;
  border-radius: 24px;
  color: #0f172a;
  background: linear-gradient(145deg, #fff, #f1faf4);
  border: 1px solid #d8e7dc;
  .payment-title { font-size: 17px; font-weight: 1000; }
  .proof-copy { font-size: 13px; font-weight: 900; }
`;

const PaymentDestinationValue = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 10px;
  padding: 12px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  span { color: #64748b; font-size: 11px; }
  b { grid-column: 1; font-size: 17px; overflow-wrap: anywhere; user-select: all; }
  button { grid-column: 2; grid-row: 1 / span 2; }
`;

const ProofChoiceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  > button { flex: 1 1 150px; min-height: 48px; }
`;

const ProofPreview = styled.div`
  display: grid;
  gap: 8px;
  img {
    width: 100%;
    max-height: 260px;
    object-fit: contain;
    border-radius: 16px;
    background: #edf2ef;
    border: 1px solid #dce6df;
  }
  div { display: flex; gap: 12px; }
  button { border: 0; padding: 0; background: transparent; color: #166534; font-weight: 900; cursor: pointer; }
`;

const HumanError = styled.div`
  padding: 10px 12px;
  border-radius: 13px;
  color: #9f1239;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  font-size: 12px;
  font-weight: 850;
`;

const WaitingCard = styled.div`
  display: grid;
  gap: 8px;
  padding: 13px;
  border-radius: 17px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  span { color: #6b6250; font-size: 12px; }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 50% 10%, rgba(29, 104, 60, .16), rgba(2, 12, 7, .58));
  backdrop-filter: blur(10px) saturate(.9);
  display: grid;
  place-items: center;
  z-index: 9998;
  padding: 20px;
  @media(max-width:640px){place-items:end center;padding:0;}
`;

const Modal = styled.div`
  box-sizing: border-box;
  width: min(620px, 96vw);
  max-height: min(91dvh, 860px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  background: linear-gradient(165deg, rgba(255,255,255,.96), rgba(245,251,247,.91));
  backdrop-filter: blur(24px) saturate(1.12);
  border-radius: 32px;
  border: 1px solid rgba(255,255,255,.72);
  box-shadow: 0 34px 100px rgba(0,20,8,.32), inset 0 0 0 1px rgba(21,128,61,.08);
  padding: 18px;
  display: grid;
  gap: 14px;
  > * { min-width: 0; }
  animation:none;
  @keyframes checkoutIn{from{transform:translateY(12px);opacity:.75}to{transform:translateY(0);opacity:1}}
  @media (min-width:641px) and (max-width:900px){width:min(680px,94vw);max-height:90dvh;padding:20px;}
  @media(max-width:640px){width:100%;max-width:100vw;max-height:96dvh;border-radius:28px 28px 0 0;border-bottom:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));}
  @media(prefers-reduced-motion:reduce){animation:none;}
`;

const TopRow = styled.div`
  display:flex;
  align-items:center;
  justify-content:space-between;
`;

const CheckoutEyebrow = styled.div`
  color: #15803d;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .14em;
`;

const CheckoutSteps = styled.div`
  display: flex;
  gap: 7px;
  overflow: auto;
  span, b {
    flex: 0 0 auto;
    border-radius: 999px;
    padding: 6px 9px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 10px;
  }
  b { background: #dcfce7; color: #166534; }
`;

const ValueStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  span {
    border-radius: 999px;
    padding: 6px 8px;
    background: #f0fdf4;
    color: #166534;
    font-size: 10px;
    font-weight: 850;
  }
`;

const DiscountLine = styled.div`
  display:flex;align-items:center;gap:7px;font-size:11px;s{color:#ef4444;font-weight:800}b{color:#fff;background:#ef4444;border-radius:999px;padding:3px 6px;font-size:9px}
`;

const AdvancedCheckout = styled.details`
  border: 1px solid rgba(15, 23, 42, .08);
  border-radius: 16px;
  padding: 9px 11px;
  background: rgba(255,255,255,.7);
  summary { cursor: pointer; color: #475569; font-size: 12px; font-weight: 900; }
  &[open] { display: grid; gap: 9px; }
`;

const PaymentDestination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  div { min-width: 0; display: grid; gap: 1px; }
  span { color: #64748b; font-size: 11px; }
  b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  border-radius:18px;
  padding:12px;
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
  border-radius:14px;
  min-height:46px;
  padding:10px 12px;
  width:100%;
  background:#fff;
  font-size:16px;
`;

const Actions = styled.div`
  display:flex;
  justify-content:flex-end;
  gap:8px;
  position: sticky;
  bottom: -18px;
  margin: 2px -18px -18px;
  padding: 12px 18px 18px;
  background: rgba(255,255,255,.94);
  backdrop-filter: blur(12px);
  align-items:center;flex-wrap:wrap;
  .checkout-action-total{display:grid;gap:3px;margin-right:auto;min-width:0;small{font-size:10px;color:#7c7687}strong{font-size:17px;letter-spacing:-.03em;color:#25232a}}
  @media(max-width:640px){bottom:-16px;margin:2px -16px -16px;padding:12px 16px calc(16px + env(safe-area-inset-bottom));>button:last-child{flex:1;min-width:150px}.checkout-action-total{flex-basis:100%;grid-template-columns:1fr auto;align-items:center}}
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  min-height:42px;
  border:1px solid rgba(15,23,42,0.12);
  border-radius:14px;
  padding:10px 14px;
  cursor:pointer;
  font-weight:950;
  background:${({ kind }) => (kind === "solid" ? "#c2f571" : "rgba(255,255,255,.86)")};
  color:${({ kind }) => (kind === "solid" ? "#073b1d" : "#17221b")};
  box-shadow:${({ kind }) => (kind === "solid" ? "0 8px 22px rgba(20,184,74,.22)" : "none")};
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
