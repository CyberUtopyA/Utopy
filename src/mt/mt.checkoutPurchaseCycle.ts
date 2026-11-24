import { normalizeNodeKey } from "./liveCatalog.sources";

export const CHECKOUT_PURCHASE_CYCLE_KINDS = [
  "market.order.received",
  "market.order.accept",
  "market.order.reject",
  "market.order.cancelled",
  "credit.decision",
  "finance.decision",
  "payment.offer",
  "payment.proof",
  "payment.proof.received",
  "payment.proof.review",
  "payment.proof.rejected",
  "payment.outcome",
] as const;

export const PAYMENT_PROOF_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export type CheckoutPurchaseState =
  | "sent"
  | "received"
  | "awaiting_payment"
  | "proof_submitted"
  | "payment_review"
  | "proof_rejected"
  | "payment_confirmed"
  | "accepted"
  | "rejected"
  | "cancelled";

export type CheckoutPaymentMethod = {
  method: string;
  label: string;
  destination: { label: string; value: string } | null;
  raw: any;
};

export type CheckoutPurchaseCycle = {
  state: CheckoutPurchaseState;
  received: any | null;
  paymentOffer: any | null;
  paymentMethods: CheckoutPaymentMethod[];
  proof: any | null;
  proofReview: any | null;
  proofRejected: any | null;
  paymentOutcome: any | null;
  orderDecision: any | null;
};

type PurchaseReference = {
  orderId: string;
  threadId: string;
  chainId: string;
  buyerActorId: string;
  sellerNodeId: string;
  amount: number;
  currency: string;
  acceptedPaymentAmounts: number[];
};

type CheckoutResponseRejection =
  | "orderId"
  | "threadId"
  | "chainId"
  | "buyer"
  | "seller/sourceNode"
  | "amount"
  | "currency"
  | "expiry"
  | "signature";

const DEV =
  typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);
const loggedResponseRejections = new Set<string>();

function text(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalized(...values: unknown[]) {
  return text(...values).toLowerCase();
}

function hasCanonicalNodeForm(value: unknown) {
  return /^(?:did:utopy:|utopy[.:/_-]*node[.:/_-]*|node[.:/_-]+)/i.test(text(value));
}

function sameNodeIdentity(left: unknown, right: unknown) {
  const leftText = normalized(left);
  const rightText = normalized(right);
  if (!leftText || !rightText) return false;
  if (leftText === rightText) return true;

  // La equivalencia abre solamente la forma canónica que ya usa el
  // descubrimiento de nodos. Dos aliases libres nunca se equiparan entre sí.
  if (!hasCanonicalNodeForm(leftText) && !hasCanonicalNodeForm(rightText)) {
    return false;
  }
  return normalizeNodeKey(leftText) === normalizeNodeKey(rightText);
}

function eventTs(dv: any) {
  const parsed = Date.parse(
    text(dv?.meta?.updatedAt, dv?.meta?.ts, dv?.attrs?.occurredAt, dv?.attrs?.submittedAt),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function latest(items: any[]) {
  return [...items].sort((a, b) => eventTs(b) - eventTs(a))[0] || null;
}

function eventBuyerId(dv: any) {
  return text(
    dv?.attrs?.buyerActorId,
    dv?.attrs?.buyerId,
    dv?.attrs?.buyer?.id,
    dv?.attrs?.targetActorId,
  );
}

function eventSellerNodeId(dv: any) {
  return text(
    dv?.attrs?.sellerNodeId,
    dv?.attrs?.actingAsNodeId,
    dv?.attrs?.sourceNodeId,
    dv?.attrs?.sellerId,
    dv?.sourceNodeId,
    dv?.authority,
    dv?.meta?.authority,
    dv?.meta?.originNode,
  );
}

function eventSourceNodeId(dv: any) {
  return text(
    dv?.sourceNodeId,
    dv?.attrs?.sourceNodeId,
    dv?.attrs?.actingAsNodeId,
    dv?.attrs?.sellerNodeId,
    dv?.meta?.originNode,
  );
}

function eventAuthorityNodeId(dv: any) {
  return text(dv?.authority, dv?.meta?.authority, dv?.attrs?.authority);
}

function hasExactReferences(dv: any, reference: PurchaseReference) {
  return (
    text(dv?.attrs?.orderId, dv?.meta?.respondsTo) === reference.orderId &&
    text(dv?.attrs?.threadId, dv?.meta?.threadId) === reference.threadId &&
    text(dv?.attrs?.chainId) === reference.chainId &&
    eventBuyerId(dv) === reference.buyerActorId &&
    sameNodeIdentity(eventSellerNodeId(dv), reference.sellerNodeId)
  );
}

function isNodeEventForOrder(
  dv: any,
  reference: PurchaseReference,
  verifiedIds: Set<string>,
) {
  return (
    verifiedIds.has(text(dv?.id)) &&
    hasExactReferences(dv, reference) &&
    sameNodeIdentity(eventSourceNodeId(dv), reference.sellerNodeId) &&
    sameNodeIdentity(eventAuthorityNodeId(dv), reference.sellerNodeId)
  );
}

function isBuyerProofForOrder(
  dv: any,
  reference: PurchaseReference,
  verifiedIds: Set<string>,
) {
  return (
    verifiedIds.has(text(dv?.id)) &&
    hasExactReferences(dv, reference) &&
    text(dv?.meta?.authority, dv?.attrs?.authority) === reference.buyerActorId &&
    sameNodeIdentity(
      text(dv?.attrs?.targetNodeId, dv?.meta?.targetNodeId),
      reference.sellerNodeId,
    ) &&
    Boolean(text(dv?.attrs?.proofRef))
  );
}

function paymentOfferIsCurrent(dv: any, now: number) {
  const expiresAt = Date.parse(text(dv?.attrs?.expiresAt, dv?.attrs?.validUntil));
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function paymentOfferHasExactValue(dv: any, reference: PurchaseReference) {
  const amount = Number(dv?.attrs?.amount ?? dv?.attrs?.total);
  return (
    Number.isFinite(amount) &&
    reference.acceptedPaymentAmounts.some(
      (accepted) => Math.abs(amount - accepted) < 0.000001,
    ) &&
    normalized(dv?.attrs?.currency) === normalized(reference.currency)
  );
}

function nodeResponseRejection(
  dv: any,
  reference: PurchaseReference,
  verifiedIds: Set<string>,
): CheckoutResponseRejection | null {
  if (text(dv?.attrs?.orderId, dv?.meta?.respondsTo) !== reference.orderId) {
    return "orderId";
  }
  if (text(dv?.attrs?.threadId, dv?.meta?.threadId) !== reference.threadId) {
    return "threadId";
  }
  if (text(dv?.attrs?.chainId) !== reference.chainId) return "chainId";
  if (eventBuyerId(dv) !== reference.buyerActorId) return "buyer";
  if (
    !sameNodeIdentity(eventSellerNodeId(dv), reference.sellerNodeId) ||
    !sameNodeIdentity(eventSourceNodeId(dv), reference.sellerNodeId) ||
    !sameNodeIdentity(eventAuthorityNodeId(dv), reference.sellerNodeId)
  ) {
    return "seller/sourceNode";
  }
  if (!verifiedIds.has(text(dv?.id))) return "signature";
  return null;
}

function paymentOfferRejection(
  dv: any,
  reference: PurchaseReference,
  verifiedIds: Set<string>,
  now: number,
): CheckoutResponseRejection | null {
  const nodeRejection = nodeResponseRejection(dv, reference, verifiedIds);
  if (nodeRejection) return nodeRejection;
  const amount = Number(dv?.attrs?.amount ?? dv?.attrs?.total);
  if (
    !Number.isFinite(amount) ||
    !reference.acceptedPaymentAmounts.some(
      (accepted) => Math.abs(amount - accepted) < 0.000001,
    )
  ) {
    return "amount";
  }
  if (normalized(dv?.attrs?.currency) !== normalized(reference.currency)) {
    return "currency";
  }
  if (!paymentOfferIsCurrent(dv, now)) return "expiry";
  return null;
}

function logRelevantResponseRejection(
  dv: any,
  reference: PurchaseReference,
  rejection: CheckoutResponseRejection | null,
) {
  if (!DEV || !rejection) return;
  const sharesOrderReference =
    text(dv?.attrs?.orderId, dv?.meta?.respondsTo) === reference.orderId ||
    text(dv?.attrs?.threadId, dv?.meta?.threadId) === reference.threadId ||
    text(dv?.attrs?.chainId) === reference.chainId;
  if (!sharesOrderReference) return;
  const key = `${reference.orderId}\u0000${text(dv?.id)}\u0000${rejection}`;
  if (loggedResponseRejections.has(key)) return;
  loggedResponseRejections.add(key);
  console.debug("[UTOPY checkout] response rejected", {
    kind: text(dv?.kind),
    failed: rejection,
  });
}

function methodName(method: any) {
  return normalized(method?.method, method?.channel, method?.type, method);
}

function destinationOf(method: any, offer: any) {
  const source =
    method?.destination ||
    method?.meta?.destination ||
    offer?.attrs?.destination ||
    offer?.attrs?.paymentDestination ||
    null;
  const label = text(source?.label, source?.type, method?.meta?.destinationLabel);
  const value = text(
    source?.value,
    source?.alias,
    method?.address,
    method?.meta?.destinationValue,
  );
  return label && value ? { label, value } : null;
}

export function readCheckoutPaymentMethods(offer: any): CheckoutPaymentMethod[] {
  const attrs = offer?.attrs || {};
  const candidates = [
    ...(Array.isArray(attrs.methods) ? attrs.methods : []),
    ...(Array.isArray(attrs.accepted) ? attrs.accepted : []),
    ...(attrs.method ? [attrs.method] : []),
  ];
  const seen = new Set<string>();
  const methods: CheckoutPaymentMethod[] = [];
  for (const candidate of candidates) {
    const method = methodName(candidate);
    if (!method || seen.has(method)) continue;
    const destination = destinationOf(candidate, offer);
    if (method === "transfer" && !destination) continue;
    seen.add(method);
    methods.push({
      method,
      label: text(candidate?.label) || (method === "transfer" ? "Transferencia" : method),
      destination,
      raw: candidate,
    });
  }
  return methods;
}

export function projectCheckoutPurchaseCycle(input: {
  order: any;
  allLive: any[];
  verifiedIds: Set<string>;
  now?: number;
}): CheckoutPurchaseCycle {
  const attrs = input.order?.attrs || {};
  const all = Array.isArray(input.allLive) ? input.allLive : [];
  const verifiedIds = input.verifiedIds || new Set<string>();
  const orderId = text(attrs.orderId, input.order?.id);
  const threadId = text(attrs.threadId, input.order?.meta?.threadId);
  const chainId = text(attrs.chainId, attrs.orderId, input.order?.id);
  const buyerActorId = text(attrs.buyerActorId, attrs.buyerId, attrs.buyer?.id);
  const sellerNodeId = text(attrs.targetNodeId, attrs.sellerNodeId, attrs.originNode);
  const currency = text(attrs.currency, attrs.payment?.currency);
  const approvedDownPayments = all
    .filter((dv) => ["credit.decision", "finance.decision"].includes(text(dv?.kind)))
    .filter((dv) => verifiedIds.has(text(dv?.id)))
    .filter((dv) => {
      const decision = dv?.attrs || {};
      const financeNodeId = text(decision.financeNodeId);
      return (
        normalized(decision.status) === "approved" &&
        text(decision.orderId) === orderId &&
        text(decision.threadId, dv?.meta?.threadId) === threadId &&
        text(decision.chainId, dv?.meta?.chainId) === chainId &&
        text(decision.borrowerActorId, decision.buyerActorId, decision.buyerId) === buyerActorId &&
        sameNodeIdentity(text(decision.sellerNodeId, decision.sellerId), sellerNodeId) &&
        financeNodeId &&
        sameNodeIdentity(text(dv?.meta?.authority), financeNodeId) &&
        sameNodeIdentity(text(dv?.meta?.originNode, dv?.meta?.authority), financeNodeId) &&
        normalized(decision.approvedTerms?.currency, decision.currency) === normalized(currency)
      );
    })
    .map((dv) =>
      Number(
        dv?.attrs?.approvedTerms?.downPayment ??
          dv?.attrs?.approvedTerms?.initialPayment ??
          dv?.attrs?.approvedTerms?.downPaymentAmount ??
          dv?.attrs?.downPayment ??
          dv?.attrs?.initialPayment,
      ),
    )
    .filter((value) => Number.isFinite(value) && value > 0);
  const reference: PurchaseReference = {
    orderId,
    threadId,
    chainId,
    buyerActorId,
    sellerNodeId,
    amount: Number(attrs.total),
    currency,
    acceptedPaymentAmounts: Array.from(
      new Set([Number(attrs.total), ...approvedDownPayments].filter((value) => Number.isFinite(value) && value > 0)),
    ),
  };
  const now = input.now ?? Date.now();
  for (const dv of all) {
    if (dv?.kind === "market.order.received") {
      logRelevantResponseRejection(
        dv,
        reference,
        nodeResponseRejection(dv, reference, verifiedIds),
      );
    } else if (dv?.kind === "payment.offer") {
      logRelevantResponseRejection(
        dv,
        reference,
        paymentOfferRejection(dv, reference, verifiedIds, now),
      );
    }
  }
  const nodeEvents = all.filter((dv) => isNodeEventForOrder(dv, reference, verifiedIds));
  const received = latest(nodeEvents.filter((dv) => dv?.kind === "market.order.received"));
  const paymentOffer = received
    ? latest(
        nodeEvents.filter(
          (dv) =>
            dv?.kind === "payment.offer" &&
            paymentOfferIsCurrent(dv, now) &&
            paymentOfferHasExactValue(dv, reference) &&
            readCheckoutPaymentMethods(dv).length > 0,
        ),
      )
    : null;
  const proof = latest(
    all.filter(
      (dv) => dv?.kind === "payment.proof" && isBuyerProofForOrder(dv, reference, verifiedIds),
    ),
  );
  const proofReview = latest(
    nodeEvents.filter((dv) =>
      ["payment.proof.received", "payment.proof.review"].includes(text(dv?.kind)),
    ),
  );
  const rejectedCandidate = latest(
    nodeEvents.filter((dv) => dv?.kind === "payment.proof.rejected"),
  );
  const proofRejected =
    rejectedCandidate && eventTs(rejectedCandidate) >= eventTs(proof)
      ? rejectedCandidate
      : null;
  const paymentOutcome = latest(
    nodeEvents.filter((dv) => {
      if (dv?.kind !== "payment.outcome") return false;
      const amount = Number(dv?.attrs?.amount);
      return (
        Number.isFinite(amount) &&
        reference.acceptedPaymentAmounts.some(
          (accepted) => Math.abs(amount - accepted) < 0.000001,
        ) &&
        normalized(dv?.attrs?.currency) === normalized(reference.currency)
      );
    }),
  );
  const orderDecision = latest(
    nodeEvents.filter((dv) =>
      ["market.order.accept", "market.order.reject", "market.order.cancelled"].includes(
        text(dv?.kind),
      ),
    ),
  );

  let state: CheckoutPurchaseState = "sent";
  if (received) state = "received";
  if (paymentOffer) state = "awaiting_payment";
  if (proof) state = "proof_submitted";
  if (proofReview && eventTs(proofReview) >= eventTs(proof)) state = "payment_review";
  if (proofRejected) state = "proof_rejected";
  if (normalized(paymentOutcome?.attrs?.status) === "paid") state = "payment_confirmed";
  if (orderDecision?.kind === "market.order.accept") state = "accepted";
  if (orderDecision?.kind === "market.order.reject") state = "rejected";
  if (orderDecision?.kind === "market.order.cancelled") state = "cancelled";

  return {
    state,
    received,
    paymentOffer,
    paymentMethods: paymentOffer ? readCheckoutPaymentMethods(paymentOffer) : [],
    proof,
    proofReview,
    proofRejected,
    paymentOutcome,
    orderDecision,
  };
}

function safeUploadEndpoint(raw: unknown, baseUrl?: unknown) {
  const value = text(raw);
  if (!value) return "";
  try {
    const url = new URL(value, text(baseUrl) || undefined);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function paymentCapabilityEndpoint(manifest: any) {
  const capabilities = Array.isArray(manifest?.attrs?.capabilities)
    ? manifest.attrs.capabilities
    : [];
  for (const capability of capabilities) {
    const semantic = normalized(
      capability?.id,
      capability?.kind,
      capability?.produces?.join(" "),
      capability?.accepts?.join(" "),
    );
    if (!/payment|proof|comprobante/.test(semantic)) continue;
    const endpoint = text(
      capability?.reaction?.proofUploadEndpoint,
      capability?.reaction?.endpoint,
    );
    if (endpoint) return endpoint;
  }
  return "";
}

export function resolvePrivatePaymentProofRoute(input: {
  offer: any;
  manifest?: any | null;
  method?: CheckoutPaymentMethod | null;
}) {
  const offerAttrs = input.offer?.attrs || {};
  const method = input.method?.raw || {};
  const manifestAttrs = input.manifest?.attrs || {};
  const endpoints = manifestAttrs.endpoints || {};
  const baseUrl = text(manifestAttrs.baseUrl, input.manifest?.baseUrl);
  const candidates = [
    offerAttrs?.proofUpload?.endpoint,
    offerAttrs?.proofUpload?.url,
    offerAttrs?.upload?.endpoint,
    offerAttrs?.endpoints?.paymentProof,
    offerAttrs?.endpoints?.proofUpload,
    offerAttrs?.proofUploadEndpoint,
    method?.proofUploadEndpoint,
    method?.meta?.proofUploadEndpoint,
    method?.meta?.uploadEndpoint,
    endpoints.paymentProof,
    endpoints.paymentProofUpload,
    endpoints.proofUpload,
    endpoints.privatePaymentProof,
    paymentCapabilityEndpoint(input.manifest),
  ];
  const endpoint = candidates
    .map((candidate) => safeUploadEndpoint(candidate, baseUrl))
    .find(Boolean) || "";
  if (!endpoint) return null;
  return {
    endpoint,
    token: text(
      offerAttrs?.proofUpload?.token,
      offerAttrs?.proofUpload?.uploadToken,
    ),
    challenge: text(
      offerAttrs?.proofUpload?.challenge,
      offerAttrs?.challenge,
      method?.meta?.challenge,
    ) || null,
  };
}

export function validatePaymentProofFile(file: File | null | undefined) {
  if (!file) return "Elegí una imagen del comprobante.";
  if (!(PAYMENT_PROOF_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Elegí una imagen JPEG, PNG o WebP.";
  }
  if (file.size > PAYMENT_PROOF_MAX_BYTES) return "La imagen es demasiado grande.";
  return "";
}

export function buildPrivatePaymentProofDV(input: {
  proofRef: string;
  orderId: string;
  threadId: string;
  chainId: string;
  buyerActorId: string;
  sellerNodeId: string;
  submittedAt?: string;
  ns?: string;
}) {
  const submittedAt = input.submittedAt || new Date().toISOString();
  if (!/^[a-zA-Z0-9._:-]{1,256}$/.test(text(input.proofRef))) {
    throw new Error("La referencia privada del comprobante no es válida.");
  }
  return {
    id: `payment.proof:${input.orderId}:${submittedAt}`,
    kind: "payment.proof",
    attrs: {
      proofRef: input.proofRef,
      orderId: input.orderId,
      threadId: input.threadId,
      chainId: input.chainId,
      buyerActorId: input.buyerActorId,
      sellerNodeId: input.sellerNodeId,
      submittedAt,
    },
    traits: ["mt:payment.proof", "mt:market", "consent:required"],
    meta: {
      ns: input.ns || "mt:market",
      ts: submittedAt,
      threadId: input.threadId,
      scopes: ["participants"],
      source: "ms.web.checkout.payment.proof.private-ref",
    },
  };
}

export async function uploadPrivatePaymentProof(input: {
  file: File;
  orderId: string;
  route: { endpoint: string; token?: string | null };
  signal?: AbortSignal;
}) {
  const validation = validatePaymentProofFile(input.file);
  if (validation) throw new Error(validation);
  if (!text(input.route.token)) throw new Error("El comercio no envió una autorización válida para subir el comprobante.");
  const form = new FormData();
  form.append("orderId", input.orderId);
  form.append("uploadToken", text(input.route.token));
  form.append("image", input.file);
  const response = await fetch(input.route.endpoint, {
    method: "POST",
    body: form,
    credentials: "omit",
    signal: input.signal,
  });
  const rawResponse = await response.text();
  let payload: any = {};
  try { payload = rawResponse ? JSON.parse(rawResponse) : {}; } catch {}
  if (![200, 201].includes(response.status)) {
    const nodeMessage = text(payload?.message, payload?.error, payload?.data?.message, rawResponse);
    if (import.meta.env.DEV) console.error("[UTOPY proof upload]", { status: response.status, message: nodeMessage });
    const human = response.status === 401 || response.status === 403
      ? "La autorización del comprobante venció. Pedí una nueva opción de pago."
      : response.status === 413
        ? "La imagen es demasiado grande. Elegí una más liviana."
        : response.status === 415
          ? "Ese formato de imagen no es compatible. Usá JPEG, PNG o WebP."
          : `El comercio no pudo recibir la imagen (HTTP ${response.status}).`;
    const error: any = new Error(human);
    error.status = response.status;
    error.nodeMessage = nodeMessage;
    throw error;
  }
  const proofRef = text(payload?.proofRef, payload?.data?.proofRef);
  if (!proofRef || proofRef.length > 256 || !/^[a-zA-Z0-9._:-]+$/.test(proofRef)) {
    throw new Error("El comercio no devolvió una referencia privada válida.");
  }
  return proofRef;
}
