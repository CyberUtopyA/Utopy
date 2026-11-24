import {
  mtLiveSnapshot,
  mtLiveSubscribe,
  mtLiveUpsert,
} from "../mt/mt.liveStore";
import { publishDatoVivo } from "../mt/seedbus";
import {
  secureId,
  sha256,
} from "./utopyPay.crypto";
import {
  publishAuthorizedDV,
  verifyAuthorizedDV,
} from "../utopy/authorizedPublish";
import {
  buildLiquidityLockDV,
  buildLiquidityTransferDV,
  buildLiquidityTrustDV,
  buildLiquidityUnlockDV,
} from "../liquidity/mt.liquidity";
import type {
  UtopyPayRoute,
  UtopyPayRouteKind,
  UtopyPaySessionDV,
  UtopyPaySessionInput,
  UtopyPayState,
  UtopyPayView,
} from "./utopyPay.types";

const SESSION_TTL_MS = 1000 * 60 * 15;
const processedReceipts = new Set<string>();
const verifiedConfirmationIds = new Set<string>();
let runtimeStop: (() => void) | null = null;
let runtimeUsers = 0;

function nowIso() {
  return new Date().toISOString();
}

function derivedMeta(meta: any) {
  const {
    ownership: _ownership,
    issuer: _issuer,
    authority: _authority,
    nonce: _nonce,
    sensitivity: _sensitivity,
    ...rest
  } = meta || {};
  return rest;
}

function normalizedCurrency(value: unknown) {
  return String(value || "PYG").trim().toUpperCase();
}

function actorKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^did:utopy:/, "")
    .replace(/^utopy[.:/_-]*node[.:/_-]*/i, "")
    .replace(/^node[.:/_-]*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizedAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe de UTOPY Pay debe ser mayor que cero.");
  }
  return Math.round(amount * 100) / 100;
}

function routeKind(value: any): UtopyPayRouteKind {
  const raw = String(value?.kind || value?.channel || value?.type || "")
    .trim()
    .toLowerCase();
  if (raw.includes("pix") || raw.includes("qr")) return "interoperable_qr";
  if (raw.includes("bank") || raw.includes("transfer") || raw.includes("banco")) return "bank_transfer";
  if (raw.includes("refund") || raw.includes("reintegro")) return "refund_credit";
  if (raw.includes("credit") || raw.includes("credito")) return "commercial_credit";
  if (raw.includes("balance") || raw.includes("saldo")) return "local_balance";
  if (raw.includes("cash") || raw.includes("efectivo")) return "cash";
  return "external";
}

function routeLabel(kind: UtopyPayRouteKind, fallback?: string) {
  if (fallback) return fallback;
  const labels: Record<UtopyPayRouteKind, string> = {
    bank_transfer: "Transferencia bancaria",
    interoperable_qr: "QR interoperable",
    local_balance: "Saldo declarado por un nodo",
    refund_credit: "Reintegro disponible",
    commercial_credit: "Crédito comercial",
    cash: "Pago en caja",
    external: "Método externo confirmado",
  };
  return labels[kind];
}

function publicRouteDetails(candidate: any) {
  const source = candidate?.public || candidate?.details || candidate || {};
  const allowed = [
    "bank", "holder", "account", "alias", "document", "pixKey", "qrPayload",
    "checkoutUrl", "sessionEndpoint", "instructions", "phone", "merchantId",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => source?.[key] !== undefined && source?.[key] !== null && String(source[key]).trim() !== "")
      .map((key) => [key, typeof source[key] === "string" ? source[key].trim() : source[key]]),
  );
}

export function discoverUtopyPayRoutes(input: {
  amount: number;
  currency: string;
  accepted?: unknown[];
  live?: any[];
  sellerIds?: string[];
  threadId?: string | null;
}): UtopyPayRoute[] {
  const amount = normalizedAmount(input.amount);
  const currency = normalizedCurrency(input.currency);
  const candidates = Array.isArray(input.accepted) ? input.accepted : [];
  const routes: UtopyPayRoute[] = [];
  const sellerIds = new Set(
    (input.sellerIds || [])
      .map(actorKey)
      .filter(Boolean),
  );

  candidates.forEach((candidate: any, index) => {
    const kind = routeKind(candidate);
    const fee = Math.max(0, Number(candidate?.fee || 0));
    routes.push({
      id: `route:${kind}:${index}`,
      kind,
      label: routeLabel(kind, String(candidate?.label || "").trim()),
      description: String(
        candidate?.description ||
          "La liquidación ocurre en el proveedor elegido; UTOPY conserva el acuerdo y su prueba.",
      ),
      amount,
      currency,
      fee: Number.isFinite(fee) ? fee : 0,
      etaSeconds: Number.isFinite(Number(candidate?.etaSeconds))
        ? Number(candidate.etaSeconds)
        : null,
      requiresExternalSettlement: !["local_balance", "refund_credit"].includes(kind),
      requiresMerchantConfirmation: true,
      sourceDvId: candidate?.sourceDvId || null,
      publicDetails: publicRouteDetails(candidate),
      priority: Number.isFinite(Number(candidate?.priority))
        ? Number(candidate.priority)
        : 100 + index,
    });
  });

  const live = Array.isArray(input.live) ? input.live : mtLiveSnapshot();
  for (const dv of live) {
    if (dv?.kind !== "liq.route.offer") continue;
    const attrs = dv?.attrs || {};
    const routeThread = String(attrs.threadId || dv?.meta?.threadId || "").trim();
    const routeOwner = actorKey(
      attrs.sellerId || attrs.nodeId || attrs.providerId || dv?.meta?.originNode,
    );
    if (input.threadId && routeThread && routeThread !== input.threadId) continue;
    if (sellerIds.size && routeOwner && !sellerIds.has(routeOwner)) continue;
    if ((input.threadId || sellerIds.size) && !routeThread && !routeOwner) continue;
    if (
      attrs?.currency &&
      normalizedCurrency(attrs.currency) !== currency
    ) {
      continue;
    }
    const kind = routeKind(attrs);
    routes.push({
      id: String(attrs.routeId || dv.id),
      kind,
      label: routeLabel(kind, String(attrs.label || "").trim()),
      description: String(
        attrs.description || "Ruta ofrecida por la Malla de Liquidez Viva.",
      ),
      amount,
      currency,
      fee: Math.max(0, Number(attrs.fee || 0)),
      etaSeconds: Number.isFinite(Number(attrs.etaSeconds))
        ? Number(attrs.etaSeconds)
        : null,
      requiresExternalSettlement: attrs.requiresExternalSettlement !== false,
      requiresMerchantConfirmation: attrs.requiresMerchantConfirmation !== false,
      sourceDvId: dv.id,
      publicDetails: publicRouteDetails(attrs),
      priority: Number.isFinite(Number(attrs.priority))
        ? Number(attrs.priority)
        : 80,
    });
  }

  if (!routes.length) {
    routes.push({
      id: "route:external:default",
      kind: "external",
      label: "Acordar el medio con el comercio",
      description:
        "UTOPY registra importe, vencimiento, confirmaciones y comprobante sin custodiar el dinero.",
      amount,
      currency,
      fee: 0,
      etaSeconds: null,
      requiresExternalSettlement: true,
      requiresMerchantConfirmation: true,
      sourceDvId: null,
      publicDetails: {},
      priority: 999,
    });
  }

  return Array.from(new Map(routes.map((route) => [route.id, route])).values())
    .sort((a, b) => a.priority - b.priority || a.fee - b.fee)
    .slice(0, 8);
}

async function publish(dv: any) {
  mtLiveUpsert(dv);
  void Promise.resolve(publishDatoVivo(dv)).catch(() => {
    // seedbus conserva su propia cola; el store local mantiene la vista inmediata.
  });
  return dv;
}

function hasOwnershipProof(dv: any) {
  return Boolean(dv?.meta?.ownership?.signature?.value);
}

function expectedConfirmationParty(session: UtopyPaySessionDV, role: "buyer" | "merchant") {
  return role === "buyer"
    ? String(session.attrs.buyer.id || "")
    : String(session.attrs.seller.nodeId || session.attrs.seller.id || "");
}

function confirmationStructurallyMatches(
  dv: any,
  session: UtopyPaySessionDV,
  route: UtopyPayRoute | null,
  role: "buyer" | "merchant",
) {
  const attrs = dv?.attrs || {};
  const expectedParty = expectedConfirmationParty(session, role);
  const authority = String(dv?.meta?.authority || attrs.authority || "");
  const partyMatches = String(attrs.confirmingPartyId || "") === expectedParty;
  const authorityMatches = role === "buyer"
    ? authority === expectedParty
    : authority === expectedParty && String(attrs.actingAsNodeId || "") === expectedParty;
  return Boolean(
    dv?.kind === "pay.confirmation" &&
      attrs.sessionId === session.attrs.sessionId &&
      attrs.role === role &&
      attrs.orderId === session.attrs.orderId &&
      Number(attrs.amount) === Number(session.attrs.amount) &&
      String(attrs.currency) === String(session.attrs.currency) &&
      String(attrs.routeId) === String(route?.id || "") &&
      attrs.sessionDigest === session.attrs.digest &&
      partyMatches &&
      authorityMatches &&
      hasOwnershipProof(dv),
  );
}

function confirmationMatches(
  dv: any,
  session: UtopyPaySessionDV,
  route: UtopyPayRoute | null,
  role: "buyer" | "merchant",
) {
  return confirmationStructurallyMatches(dv, session, route, role) &&
    verifiedConfirmationIds.has(String(dv?.id || ""));
}

function receiptMatches(
  dv: any,
  session: UtopyPaySessionDV,
  route: UtopyPayRoute | null,
  all: any[],
) {
  const attrs = dv?.attrs || {};
  const confirmationIds = new Set(
    (Array.isArray(attrs.confirmationIds) ? attrs.confirmationIds : []).map(String),
  );
  const buyer = all.find((candidate) =>
    confirmationIds.has(String(candidate?.id || "")) &&
    confirmationMatches(candidate, session, route, "buyer"),
  );
  const merchant = all.find((candidate) =>
    confirmationIds.has(String(candidate?.id || "")) &&
    confirmationMatches(candidate, session, route, "merchant"),
  );
  return Boolean(
    dv?.kind === "pay.receipt" &&
    attrs.sessionId === session.attrs.sessionId &&
    attrs.orderId === session.attrs.orderId &&
    Number(attrs.amount) === Number(session.attrs.amount) &&
    String(attrs.currency) === String(session.attrs.currency) &&
    String(attrs.routeId) === String(route?.id || "") &&
    attrs.state === "settled" &&
    buyer &&
    merchant,
  );
}

export async function openUtopyPaySession(
  input: UtopyPaySessionInput,
): Promise<UtopyPaySessionDV> {
  const amount = normalizedAmount(input.amount);
  const currency = normalizedCurrency(input.currency);
  const createdAt = nowIso();
  const sessionId = input.sessionId || secureId("pay.session");
  const nonce = secureId("nonce");
  const expiresAt = new Date(
    Date.now() + Math.max(60_000, input.expiresInMs || SESSION_TTL_MS),
  ).toISOString();
  const digest = await sha256({
    protocol: "utopy.pay.libre.v1",
    sessionId,
    orderId: input.orderId,
    buyerId: input.buyer.id,
    sellerId: input.seller.id,
    amount,
    currency,
    concept: input.concept,
    nonce,
    expiresAt,
  });
  const routes = discoverUtopyPayRoutes({
    amount,
    currency,
    accepted: input.accepted,
    sellerIds: [input.seller.id, input.seller.nodeId || ""],
    threadId: input.threadId,
  });
  const qrPayload = `utopy://pay/${encodeURIComponent(sessionId)}?nonce=${encodeURIComponent(
    nonce,
  )}&digest=${encodeURIComponent(digest)}`;
  const linkPayload = `${
    typeof window !== "undefined" ? window.location.origin : "https://utopy.live"
  }/pay/${encodeURIComponent(sessionId)}?digest=${encodeURIComponent(digest)}`;

  const dv: UtopyPaySessionDV = {
    id: sessionId,
    kind: "pay.session",
    attrs: {
      protocol: "utopy.pay.libre.v1",
      sessionId,
      orderId: input.orderId,
      threadId: input.threadId,
      buyer: input.buyer,
      seller: input.seller,
      operator: input.operator || null,
      amount,
      currency,
      concept: input.concept,
      productId: input.productId || null,
      nonce,
      digest,
      state: "open",
      selectedRouteId: null,
      routes,
      expiresAt,
      createdAt,
      updatedAt: createdAt,
      qrPayload,
      linkPayload,
      safeguards: {
        amountLocked: true,
        replayProtection: true,
        dualConfirmation: true,
        custody: "external_or_declared_route",
        refundRight: true,
      },
    },
    traits: [
      "utopy:pay",
      "pay:session",
      "pay:libre",
      "escudo:protected",
      "liquidity:routable",
    ],
    meta: {
      ns: input.ns || "mt:market",
      scopes: input.scopes?.length ? input.scopes : ["private:participants"],
      ts: createdAt,
      updatedAt: createdAt,
      version: 1,
      source: input.source || "ms.web.utopy-pay",
      threadId: input.threadId,
      authority: input.seller.nodeId || input.seller.id,
    },
  };
  const allLive = mtLiveSnapshot();
  const publishedSession = await publishAuthorizedDV({
    dv,
    allLive,
    activeActor: {
      id: input.buyer.id,
      actorId: input.buyer.id,
      name: input.buyer.name || "Comprador",
    },
    targetNodeId: input.seller.nodeId || input.seller.id,
    action: "pay.session",
    sensitivity: "relationship",
  });
  const signedSession = publishedSession.dv as UtopyPaySessionDV;
  await publish({
    id: `payment.session.open:${sessionId}`,
    kind: "payment.session.open",
    attrs: {
      protocol: "utopy.pay.libre.v1",
      sessionId,
      paymentSessionId: sessionId,
      orderId: input.orderId,
      threadId: input.threadId,
      buyerId: input.buyer.id,
      buyerName: input.buyer.name || null,
      sellerId: input.seller.id,
      sellerName: input.seller.name || null,
      operatorId: input.operator?.id || null,
      operatorName: input.operator?.name || null,
      amount,
      currency,
      concept: input.concept,
      expiresAt,
      status: "open",
      sourcePaySessionId: sessionId,
    },
    traits: ["utopy:pay", "payment:session", "pay:compat"],
    meta: {
      ...derivedMeta(signedSession.meta),
      source: "utopy.pay.compat.open",
      respondsTo: sessionId,
    },
  });
  return signedSession;
}

export async function reserveUtopyPayRoute(
  sessionId: string,
  routeId: string,
  actorId: string,
) {
  const view = getUtopyPayView(sessionId);
  if (!view.session) throw new Error("La sesión de pago no existe.");
  if (view.expired) throw new Error("La sesión venció. Creá una nueva.");
  if (view.authorized || view.settled) throw new Error("Este pago ya fue autorizado.");
  const route = view.session.attrs.routes.find((item) => item.id === routeId);
  if (!route) throw new Error("La ruta elegida ya no está disponible.");
  if (route.sourceDvId) {
    const live = mtLiveSnapshot();
    const sourceOffer = live.find((dv: any) => dv?.id === route.sourceDvId);
    const verification = sourceOffer
      ? await verifyAuthorizedDV(sourceOffer, live)
      : null;
    if (!verification?.accepted || verification.proof !== "verified") {
      throw new Error("La ruta de liquidez ya no tiene autoridad verificable.");
    }
  }
  const ts = nowIso();
  const lockId = `liq.lock:${sessionId}`;
  const lockBase = buildLiquidityLockDV({
    actorId,
    actorName: view.session.attrs.buyer.name || actorId,
    amount: view.session.attrs.amount,
    currency: view.session.attrs.currency,
    orderId: view.session.attrs.orderId,
    sessionId,
    threadId: view.session.attrs.threadId,
    lockTarget: "reservation",
    reason: "utopy.pay.route.reserved",
    sourceKind: "pay.session",
    sourceId: sessionId,
  });
  const lock = {
    ...lockBase,
    id: lockId,
    attrs: {
      ...lockBase.attrs,
      lockId,
      routeId,
      state: "reserved",
      expiresAt: view.session.attrs.expiresAt,
      custody: "none",
      note: "Reserva lógica: no representa custodia de fondos por UTOPY.",
    },
    traits: [
      ...(lockBase.traits || []),
      "utopy:liquidity",
      "liq:lock",
      "escudo:protected",
    ],
    meta: {
      ...lockBase.meta,
      ...derivedMeta(view.session.meta),
      ts,
      updatedAt: ts,
      source: "utopy.pay.route.reserve",
      respondsTo: sessionId,
    },
  };
  const next = {
    ...view.session,
    attrs: {
      ...view.session.attrs,
      selectedRouteId: routeId,
      state: "route_reserved" as UtopyPayState,
      updatedAt: ts,
    },
    meta: {
      ...derivedMeta(view.session.meta),
      ts,
      updatedAt: ts,
      version: Number(view.session.meta?.version || 1) + 1,
    },
  };
  const allLive = mtLiveSnapshot();
  const activeActor = {
    id: actorId,
    actorId,
    name: view.session.attrs.buyer.name || "Comprador",
  };
  await publishAuthorizedDV({
    dv: lock,
    allLive,
    activeActor,
    targetNodeId: view.session.attrs.seller.nodeId || view.session.attrs.seller.id,
    action: "liq.lock",
    sensitivity: "sensitive",
  });
  const publishedNext = await publishAuthorizedDV({
    dv: next,
    allLive: mtLiveSnapshot(),
    activeActor,
    targetNodeId: view.session.attrs.seller.nodeId || view.session.attrs.seller.id,
    action: "pay.session",
    sensitivity: "relationship",
  });
  return publishedNext.dv;
}

export async function confirmUtopyPayParty(input: {
  sessionId: string;
  actorId: string;
  actorName?: string | null;
  role: "buyer" | "merchant";
  proof?: string | null;
  actingAsNodeId?: string | null;
  allLive?: any[];
}) {
  const live = input.allLive || mtLiveSnapshot();
  const view = getUtopyPayView(input.sessionId, live);
  if (!view.session) throw new Error("La sesión de pago no existe.");
  if (!view.route) throw new Error("Primero elegí una ruta de pago.");
  if (view.expired) throw new Error("La sesión venció.");
  const expected = expectedConfirmationParty(view.session, input.role);
  if (input.role === "buyer" && String(input.actorId) !== expected) {
    throw new Error("La identidad activa no puede confirmar por esta parte.");
  }
  if (
    input.role === "merchant" &&
    String(input.actingAsNodeId || "") !== expected
  ) {
    throw new Error("El cobro debe ser confirmado actuando como el nodo vendedor.");
  }
  const existing = live.find(
    (dv: any) =>
      confirmationStructurallyMatches(dv, view.session!, view.route, input.role),
  );
  if (existing) return existing;

  const signedAt = nowIso();
  const payload = {
    protocol: "utopy.pay.libre.v1",
    sessionId: input.sessionId,
    orderId: view.session.attrs.orderId,
    role: input.role,
    confirmingPartyId: expected,
    amount: view.session.attrs.amount,
    currency: view.session.attrs.currency,
    routeId: view.route.id,
    sessionDigest: view.session.attrs.digest,
    signedAt,
  };
  const confirmation = {
    id: `pay.confirmation:${input.sessionId}:${input.role}`,
    kind: "pay.confirmation",
    attrs: {
      ...payload,
      actorName: input.actorName || null,
      proof: input.proof?.trim() || null,
      state: "confirmed",
    },
    traits: [
      "utopy:pay",
      "pay:confirmation",
      `pay:role:${input.role}`,
      "escudo:signed",
    ],
    meta: {
      ...derivedMeta(view.session.meta),
      ts: signedAt,
      updatedAt: signedAt,
      source: `utopy.pay.confirm.${input.role}`,
      respondsTo: input.sessionId,
    },
  };
  const published = await publishAuthorizedDV({
    dv: confirmation,
    allLive: live,
    activeActor: {
      id: input.actorId,
      actorId: input.actorId,
      name: input.actorName || (input.role === "buyer" ? "Comprador" : "Operador del nodo"),
    },
    actingAsNodeId: input.role === "merchant" ? expected : null,
    targetNodeId:
      input.role === "merchant"
        ? view.session.attrs.buyer.id
        : view.session.attrs.seller.nodeId || view.session.attrs.seller.id,
    requiredAuthority: expected,
    action: "pay.confirmation",
    sensitivity: "sensitive",
  });
  verifiedConfirmationIds.add(String(published.dv.id));
  await trySettleUtopyPay(input.sessionId);
  return published.dv;
}

export function getUtopyPayView(
  sessionId: string,
  all: any[] = mtLiveSnapshot(),
): UtopyPayView {
  const session =
    (all.find(
      (dv: any) => dv?.kind === "pay.session" && dv?.attrs?.sessionId === sessionId,
    ) as UtopyPaySessionDV | undefined) || null;
  if (!session) {
    return {
      session: null,
      state: "missing",
      route: null,
      buyerConfirmed: false,
      merchantConfirmed: false,
      authorized: false,
      settled: false,
      expired: false,
      receipt: null,
      refund: null,
    };
  }
  const selectedRoute =
    session.attrs.routes.find(
      (item) => item.id === session.attrs.selectedRouteId,
    ) || null;
  const receipt = all.find((dv: any) =>
    receiptMatches(dv, session, selectedRoute, all),
  ) || null;
  const refund =
    all
      .filter(
        (dv: any) =>
          ["refund.request", "refund.settlement"].includes(String(dv?.kind)) &&
          dv?.attrs?.sessionId === sessionId,
      )
      .sort(
        (a: any, b: any) =>
          Date.parse(String(b?.meta?.ts || "")) -
          Date.parse(String(a?.meta?.ts || "")),
      )[0] || null;
  const route = selectedRoute;
  const buyerConfirmed = all.some((dv: any) =>
    confirmationMatches(dv, session, route, "buyer"),
  );
  const merchantConfirmed = all.some((dv: any) =>
    confirmationMatches(dv, session, route, "merchant"),
  );
  const expired = Date.parse(session.attrs.expiresAt) <= Date.now();
  const state =
    receipt?.attrs?.state ||
    (expired
      ? "expired"
      : buyerConfirmed && merchantConfirmed
        ? "authorized"
        : buyerConfirmed
          ? "buyer_confirmed"
          : merchantConfirmed
            ? "merchant_confirmed"
            : session.attrs.state);
  return {
    session,
    state,
    route,
    buyerConfirmed,
    merchantConfirmed,
    authorized: ["authorized", "settled"].includes(String(state)),
    settled: String(state) === "settled",
    expired,
    receipt,
    refund,
  };
}

export async function trySettleUtopyPay(sessionId: string) {
  const view = getUtopyPayView(sessionId);
  if (!view.session || !view.route) return view;
  if (view.receipt) return view;
  if (view.expired || ["expired", "cancelled", "rejected", "settled"].includes(String(view.state))) return view;

  const allLive = mtLiveSnapshot();
  const confirmations = allLive.filter(
    (dv: any) =>
      dv?.kind === "pay.confirmation" &&
      dv?.attrs?.sessionId === sessionId,
  );
  for (const role of ["buyer", "merchant"] as const) {
    const confirmation = confirmations.find(
      (dv: any) => confirmationStructurallyMatches(dv, view.session!, view.route, role),
    );
    const verification = confirmation
      ? await verifyAuthorizedDV(confirmation, allLive)
      : null;
    if (
      !confirmation ||
      !confirmationStructurallyMatches(confirmation, view.session, view.route, role) ||
      !verification?.accepted ||
      verification.proof !== "verified"
    ) {
      return getUtopyPayView(sessionId);
    }
    verifiedConfirmationIds.add(String(confirmation.id));
  }

  const ts = nowIso();
  const receiptId = `pay.receipt:${sessionId}`;
  const digest = await sha256({
    sessionDigest: view.session.attrs.digest,
    routeId: view.route.id,
    buyerConfirmed: true,
    merchantConfirmed: true,
    settledAt: ts,
  });
  const receipt = {
    id: receiptId,
    kind: "pay.receipt",
    attrs: {
      receiptId,
      sessionId,
      orderId: view.session.attrs.orderId,
      threadId: view.session.attrs.threadId,
      amount: view.session.attrs.amount,
      currency: view.session.attrs.currency,
      routeId: view.route.id,
      routeKind: view.route.kind,
      state: "settled",
      digest,
      buyerId: view.session.attrs.buyer.id,
      sellerId: view.session.attrs.seller.id,
      settledAt: ts,
      custody: "external_or_declared_route",
      refundEligible: true,
      confirmationIds: confirmations
        .filter((candidate: any) =>
          ["buyer", "merchant"].some((role) =>
            confirmationMatches(
              candidate,
              view.session!,
              view.route,
              role as "buyer" | "merchant",
            ),
          ),
        )
        .map((candidate: any) => candidate.id),
      settlementAuthority:
        "confirmaciones independientes del comprador y del nodo vendedor",
    },
    traits: [
      "utopy:pay",
      "pay:receipt",
      "pay:settled",
      "escudo:verified",
      "trust:event",
    ],
    meta: {
      ...derivedMeta(view.session.meta),
      ts,
      updatedAt: ts,
      source: "utopy.pay.settle",
      respondsTo: sessionId,
    },
  };
  const unlockBase = buildLiquidityUnlockDV({
    actorId: view.session.attrs.buyer.id,
    actorName: view.session.attrs.buyer.name || view.session.attrs.buyer.id,
    amount: view.session.attrs.amount,
    currency: view.session.attrs.currency,
    orderId: view.session.attrs.orderId,
    sessionId,
    threadId: view.session.attrs.threadId,
    lockId: `liq.lock:${sessionId}`,
    unlockTarget: "reservation",
    reason: "utopy.pay.settled",
    sourceKind: "pay.receipt",
    sourceId: receiptId,
  });
  const unlock = {
    ...unlockBase,
    id: `liq.unlock:${sessionId}`,
    attrs: {
      ...unlockBase.attrs,
      routeId: view.route.id,
      state: "settled",
      releasedAt: ts,
    },
    traits: [
      ...(unlockBase.traits || []),
      "utopy:liquidity",
      "pay:settled",
    ],
    meta: {
      ...unlockBase.meta,
      ...derivedMeta(view.session.meta),
      ts,
      source: "utopy.pay.settle",
      respondsTo: `liq.lock:${sessionId}`,
    },
  };
  const transferBase = buildLiquidityTransferDV({
    fromActorId: view.session.attrs.buyer.id,
    fromActorName:
      view.session.attrs.buyer.name || view.session.attrs.buyer.id,
    toActorId: view.session.attrs.seller.id,
    toActorName:
      view.session.attrs.seller.name || view.session.attrs.seller.id,
    amount: view.session.attrs.amount,
    currency: view.session.attrs.currency,
    orderId: view.session.attrs.orderId,
    sessionId,
    threadId: view.session.attrs.threadId,
    reason: "utopy.pay.settled",
    sourceKind: "pay.receipt",
    sourceId: receiptId,
  });
  const transfer = {
    ...transferBase,
    id: `liq.transfer:${sessionId}`,
    attrs: {
      ...transferBase.attrs,
      receiptId,
      routeId: view.route.id,
      routeKind: view.route.kind,
      state: "settled",
      custody: "external_or_declared_route",
      settledAt: ts,
    },
    traits: [
      ...(transferBase.traits || []),
      "utopy:liquidity",
      "pay:settled",
    ],
    meta: {
      ...transferBase.meta,
      ...derivedMeta(view.session.meta),
      ts,
      source: "utopy.pay.liquidity",
      respondsTo: receiptId,
    },
  };
  const refundRight = {
    id: `refund.right:${sessionId}`,
    kind: "refund.right",
    attrs: {
      sessionId,
      receiptId,
      buyerId: view.session.attrs.buyer.id,
      sellerId: view.session.attrs.seller.id,
      maximumAmount: view.session.attrs.amount,
      currency: view.session.attrs.currency,
      state: "available",
      createdAt: ts,
      note:
        "Derecho de solicitar revisión/reintegro; no significa devolución automática.",
    },
    traits: ["utopy:pay", "refund:right", "escudo:protected"],
    meta: {
      ...derivedMeta(view.session.meta),
      ts,
      source: "utopy.pay.refund-right",
      respondsTo: receiptId,
    },
  };
  const buyerTrustBase = buildLiquidityTrustDV({
    actorId: view.session.attrs.buyer.id,
    actorName:
      view.session.attrs.buyer.name || view.session.attrs.buyer.id,
    trustForId: view.session.attrs.seller.id,
    trustForName:
      view.session.attrs.seller.name || view.session.attrs.seller.id,
    scoreDelta: 0.02,
    reason: "payment.completed",
    basedOnKind: "pay.receipt",
    basedOnId: receiptId,
    orderId: view.session.attrs.orderId,
    sessionId,
    threadId: view.session.attrs.threadId,
    evidence: [receiptId],
  });
  const sellerTrustBase = buildLiquidityTrustDV({
    actorId: view.session.attrs.seller.id,
    actorName:
      view.session.attrs.seller.name || view.session.attrs.seller.id,
    trustForId: view.session.attrs.buyer.id,
    trustForName:
      view.session.attrs.buyer.name || view.session.attrs.buyer.id,
    scoreDelta: 0.02,
    reason: "payment.received",
    basedOnKind: "pay.receipt",
    basedOnId: receiptId,
    orderId: view.session.attrs.orderId,
    sessionId,
    threadId: view.session.attrs.threadId,
    evidence: [receiptId],
  });
  const trustEvents = [
    {
      ...buyerTrustBase,
      id: `liq.trust:${sessionId}:buyer`,
      meta: {
        ...buyerTrustBase.meta,
        ...derivedMeta(view.session.meta),
        ts,
        source: "utopy.pay.trust",
        respondsTo: receiptId,
      },
    },
    {
      ...sellerTrustBase,
      id: `liq.trust:${sessionId}:merchant`,
      meta: {
        ...sellerTrustBase.meta,
        ...derivedMeta(view.session.meta),
        ts,
        source: "utopy.pay.trust",
        respondsTo: receiptId,
      },
    },
  ];
  const compatibilityStatus = {
    id: `payment.session.status:${sessionId}`,
    kind: "payment.session.status",
    attrs: {
      protocol: "utopy.pay.libre.v1",
      status: "settled",
      sessionId,
      paymentSessionId: sessionId,
      orderId: view.session.attrs.orderId,
      threadId: view.session.attrs.threadId,
      buyerId: view.session.attrs.buyer.id,
      buyerName: view.session.attrs.buyer.name || null,
      sellerId: view.session.attrs.seller.id,
      sellerName: view.session.attrs.seller.name || null,
      amount: view.session.attrs.amount,
      currency: view.session.attrs.currency,
      receiptId,
      liquidityAlreadyRecorded: true,
    },
    traits: ["utopy:pay", "payment:status", "pay:compat", "pay:settled"],
    meta: {
      ...derivedMeta(view.session.meta),
      ts,
      updatedAt: ts,
      source: "utopy.pay.compat.status",
      respondsTo: receiptId,
    },
  };
  await publish(receipt);
  await publish(unlock);
  await publish(transfer);
  await publish(refundRight);
  for (const trust of trustEvents) await publish(trust);
  await publish(compatibilityStatus);
  return getUtopyPayView(sessionId);
}

export async function requestUtopyPayRefund(input: {
  sessionId: string;
  actorId: string;
  reason: string;
}) {
  const view = getUtopyPayView(input.sessionId);
  if (!view.receipt) throw new Error("Solo un pago liquidado puede pedir reintegro.");
  if (input.actorId !== view.session?.attrs.buyer.id) {
    throw new Error("Solo el comprador de esta operación puede iniciar el reintegro.");
  }
  const ts = nowIso();
  const payload = {
    sessionId: input.sessionId,
    receiptId: view.receipt.id,
    actorId: input.actorId,
    amount: view.receipt.attrs.amount,
    currency: view.receipt.attrs.currency,
    reason: input.reason.trim(),
    requestedAt: ts,
  };
  const request = {
    id: `refund.request:${input.sessionId}`,
    kind: "refund.request",
    attrs: { ...payload, state: "requested" },
    traits: ["utopy:pay", "refund:request", "escudo:signed"],
    meta: {
      ...view.session?.meta,
      ts,
      updatedAt: ts,
      source: "utopy.pay.refund",
      respondsTo: view.receipt.id,
    },
  };
  const published = await publishAuthorizedDV({
    dv: request,
    allLive: mtLiveSnapshot(),
    activeActor: { id: input.actorId, actorId: input.actorId, name: "Comprador" },
    targetNodeId: view.session?.attrs.seller.nodeId || view.session?.attrs.seller.id,
    requiredAuthority: input.actorId,
    action: "refund.request",
    sensitivity: "sensitive",
  });
  return published.dv;
}

function updateLinkedOrderAndDelivery(receipt: any, all: any[]) {
  const sessionId = String(receipt?.attrs?.sessionId || "");
  const orderId = String(receipt?.attrs?.orderId || "");
  if (!sessionId || !orderId || processedReceipts.has(receipt.id)) return;
  const verifiedView = getUtopyPayView(sessionId, all);
  if (verifiedView.receipt?.id !== receipt.id) return;
  processedReceipts.add(receipt.id);
  const ts = nowIso();

  for (const intent of all) {
    if (
      intent?.kind !== "work.intent" ||
      String(intent?.attrs?.paymentSessionId || "") !== sessionId ||
      !Array.isArray(intent?.traits) ||
      !intent.traits.includes("falcon:delivery")
    ) {
      continue;
    }
    const nextIntent = {
      ...intent,
      attrs: {
        ...intent.attrs,
        status: "open",
        deliveryStatus: "buscando_repartidor",
        paymentStatus: "settled",
        paymentReceiptId: receipt.id,
        visibleToResponders: true,
        progress: Math.max(8, Number(intent?.attrs?.progress || 0)),
      },
      traits: Array.from(
        new Set([
          ...intent.traits.filter((trait: string) => trait !== "pay:waiting"),
          "pay:settled",
          "capability:discoverable",
        ]),
      ),
      meta: {
        ...intent.meta,
        ts,
        updatedAt: ts,
        version: Number(intent?.meta?.version || 1) + 1,
        source: "falcon.payment-gate",
      },
    };
    void publishAuthorizedDV({
      dv: nextIntent,
      allLive: all,
      activeActor: {
        id: verifiedView.session?.attrs.buyer.id,
        actorId: verifiedView.session?.attrs.buyer.id,
        name: verifiedView.session?.attrs.buyer.name,
      },
      targetNodeId:
        verifiedView.session?.attrs.seller.nodeId ||
        verifiedView.session?.attrs.seller.id,
      requiredAuthority: verifiedView.session?.attrs.buyer.id,
      action: "delivery.payment.ready",
      sensitivity: "ephemeral",
    }).catch(() => {
      // Solamente el dispositivo comprador puede liberar su intención de entrega.
    });
  }
}

export function startUtopyPayRuntime() {
  runtimeUsers += 1;
  if (!runtimeStop) {
    const observedSessions = new Map<string, string>();
    runtimeStop = mtLiveSubscribe((all: any[]) => {
      for (const session of all) {
        if (session?.kind === "pay.session") {
          const sessionId = String(session?.attrs?.sessionId || "");
          if (!sessionId) continue;
          const view = getUtopyPayView(sessionId, all);
          if (!view.session || !view.route || view.receipt || view.settled || view.expired || ["expired", "cancelled", "rejected", "settled"].includes(String(view.state))) {
            observedSessions.delete(sessionId);
            continue;
          }
          const related = all
            .filter((dv: any) => String(dv?.attrs?.sessionId || "") === sessionId && ["pay.confirmation", "pay.receipt"].includes(String(dv?.kind || "")))
            .map((dv: any) => `${dv.id}:${dv?.meta?.version || ""}:${dv?.meta?.updatedAt || dv?.meta?.ts || ""}`)
            .sort()
            .join("|");
          const signature = `${session?.meta?.version || ""}:${session?.attrs?.state || ""}:${related}`;
          if (observedSessions.get(sessionId) === signature) continue;
          observedSessions.set(sessionId, signature);
          while (observedSessions.size > 1000) observedSessions.delete(observedSessions.keys().next().value);
          void trySettleUtopyPay(sessionId).catch((error) => {
            if (import.meta.env.DEV) console.error("[UTOPY Pay settle]", error);
          });
        }
      }
      for (const receipt of all) {
        if (
          receipt?.kind === "pay.receipt" &&
          ["authorized", "settled"].includes(String(receipt?.attrs?.state))
        ) {
          updateLinkedOrderAndDelivery(receipt, all);
        }
      }
    });
  }
  return () => {
    runtimeUsers = Math.max(0, runtimeUsers - 1);
    if (runtimeUsers === 0) {
      runtimeStop?.();
      runtimeStop = null;
    }
  };
}

export function subscribeUtopyPay(
  sessionId: string,
  listener: (view: UtopyPayView) => void,
) {
  return mtLiveSubscribe((all: any[]) =>
    listener(getUtopyPayView(sessionId, all)),
  );
}
