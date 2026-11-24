// ============================================
// FILE: src/mt/mt.threadProtocol.ts
// Protocolo local de hilos y Frecuencia Viva para MS Market.
// ============================================

export type AnyDV = {
  id?: string;
  kind?: string;
  attrs?: Record<string, any>;
  traits?: string[];
  meta?: Record<string, any>;
  [key: string]: any;
};

export type OperationActorRole =
  | "requester"
  | "provider"
  | "seller"
  | "buyer"
  | "driver"
  | "producer"
  | "financier"
  | "observer";

export type SubscriptionStatus =
  | "none"
  | "proposed"
  | "accepted"
  | "active"
  | "paused"
  | "cancelled";

export type DerivedSubscriptionState = {
  exists: boolean;
  status: SubscriptionStatus;
  recurring: boolean;
  subscriptionId: string | null;
  nextOccurrence: string | null;
  canAccept: boolean;
  canPause: boolean;
  canCancel: boolean;
  autopay: {
    exists: boolean;
    status: "none" | "active" | "revoked";
    authorizationId: string | null;
    pendingRevoke: boolean;
    canRevoke: boolean;
  };
  evidence: {
    subscription: AnyDV | null;
    autopayAuthorization: AnyDV | null;
    autopayRevocation: AnyDV | null;
    autopayRevokeRequest: AnyDV | null;
  };
};

export type DerivedThreadState = {
  phase:
    | "open"
    | "proposal"
    | "accepted"
    | "planned"
    | "in_progress"
    | "in_transit"
    | "awaiting_confirmation"
    | "completed"
    | "cancelled"
    | "disputed";
  label: string;
  tone: "ok" | "warn" | "info" | "neutral";
  role: OperationActorRole;
  primaryAction:
    | "wait"
    | "view_proposal"
    | "talk"
    | "view_progress"
    | "view_delivery"
    | "confirm_received"
    | "manage_recurrence";
  primaryLabel: string;
  primaryEnabled: boolean;
  subscription: DerivedSubscriptionState;
  lastStateEvent: AnyDV | null;
};

export type WorkDomain = string;

export type WorkCapability = {
  id: string;
  label: string;
  domain: string;
  level?: number;
  tags?: string[];
};

export type WorkCell = {
  id: string;
  nodeId: string;
  name: string;
  kind: "person" | "team" | "workshop" | "machine" | "microfactory" | "node";
  roleLabel: string;
  domains: WorkDomain[];
  capabilities: WorkCapability[];
  tools: string[];
  capacity: Record<string, any>;
  availability: Record<string, any>;
  serviceArea: Record<string, any>;
  contact: Record<string, any>;
  meta?: Record<string, any>;
};

export type ThreadActionInput = {
  kind: string;
  threadId: string;
  text: string;
  fromActorId: string;
  fromActorName?: string | null;
  toActorId?: string | null;
  toActorName?: string | null;
  participants?: Array<string | null | undefined>;
  responseToId?: string | null;
  chainId?: string | null;
  rootDvId?: string | null;
  parentDvId?: string | null;
  attrs?: Record<string, any>;
  traits?: string[];
  meta?: Record<string, any>;
};

export type LinkedWorkIntentInput = {
  text: string;
  actorId: string;
  actorName?: string | null;
  nodeId?: string | null;
  threadId?: string | null;
  chainId?: string | null;
  sourceDV?: AnyDV | null;
  sourceActionId?: string | null;
  title?: string | null;
  domain?: string | null;
  quantity?: number | null;
  unit?: string | null;
  location?: { lat?: number; lng?: number; lon?: number; [key: string]: any } | null;
  scopes?: string[];
};

const THREAD_KINDS = new Set([
  "trade.message",
  "trade.intent.accept",
  "trade.intent.counter",
  "trade.intent.barter",
  "trade.intent.fulfill",
  "trade.intent.message",
  "market.order.event",
  "market.order.message",
  "market.order.create",
  "market.order.received",
  "market.order.accept",
  "market.order.reject",
  "mt.demand",
  "mt.consult",
  "mt.consult.answer",
  "work.intent",
  "work.plan",
  "work.execution",
  "work.outcome",
  "mo.fabrication.pack",
  "resonance.response",
  "match.proposal",
  "utopy.reaction.proposal",
  "utopy.reaction.accepted",
  "utopy.reaction.outcome",
  "payment.session.open",
  "payment.outcome",
  "pay.session",
  "pay.confirmation",
  "pay.receipt",
  "credit.request",
  "credit.decision",
  "credit.account",
  "liq.settlement.batch",
  "value.redemption.request",
  "value.redemption.outcome",
  "identity.link.request",
  "identity.link.active",
  "identity.link.revoked",
  "delivery.outcome",
  "delivery.status",
  "subscription.proposal",
  "subscription.accepted",
  "subscription.active",
  "subscription.paused",
  "subscription.cancelled",
  "subscription.pause.request",
  "subscription.cancel.request",
  "payment.autopay.authorization.request",
  "payment.autopay.authorization",
  "payment.autopay.revoke.request",
  "payment.autopay.revoked",
  "payment.mandate",
  "payment.mandate.create",
  "payment.mandate.cancel",
  "trust.proof",
  "value.proof",
  "sale.receipt",
  "market.invoice.draft",
]);

const STOP_WORDS = new Set([
  "algo",
  "como",
  "con",
  "del",
  "desde",
  "el",
  "ella",
  "en",
  "esta",
  "este",
  "hacer",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "necesito",
  "para",
  "por",
  "que",
  "quiero",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
]);

function newId(prefix = "dv:") {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}${uuid}`
    : `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function text(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function normalized(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unique(values: Array<unknown>) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function timestampOf(dv: AnyDV) {
  const raw = dv?.meta?.ts || dv?.attrs?.ts || dv?.ts || "";
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceLocation(source?: AnyDV | null) {
  const attrs = source?.attrs || {};
  const raw =
    attrs.location ||
    attrs.geo ||
    source?.meta?.location ||
    source?.meta?.geo ||
    (attrs.lat != null ? { lat: attrs.lat, lng: attrs.lng ?? attrs.lon } : null);
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng ?? raw?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? {
        ...raw,
        lat: Math.round(lat * 1000) / 1000,
        lng: Math.round(lng * 1000) / 1000,
        precision: "approximate",
      }
    : null;
}

/** Pide permiso al navegador y nunca publica la coordenada exacta. */
export function requestApproximateBrowserLocation(timeoutMs = 8000) {
  return new Promise<{
    lat: number;
    lng: number;
    accuracy?: number;
    precision: "approximate";
    source: "browser-consent";
  } | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: Math.round(position.coords.latitude * 1000) / 1000,
          lng: Math.round(position.coords.longitude * 1000) / 1000,
          accuracy: Math.round(position.coords.accuracy || 0),
          precision: "approximate",
          source: "browser-consent",
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

export function humanCapabilityTerms(value: string, max = 24) {
  const words = normalized(value)
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  const phrases = words
    .slice(0, 14)
    .map((word, index) =>
      index < words.length - 1 ? `${word} ${words[index + 1]}` : ""
    )
    .filter(Boolean);
  return unique([...words, ...phrases]).slice(0, max);
}

export function buildWorkCellDV(cell: WorkCell): AnyDV {
  return {
    id: newId("work.cell:"),
    kind: "work.cell",
    attrs: cell,
    traits: [
      "work:cell",
      "resonance:capable",
      "frequency:live",
      `work:kind:${cell.kind}`,
      ...cell.domains.map((domain) => `work:domain:${domain}`),
    ],
    meta: {
      ns: "work:cell",
      ts: nowIso(),
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 30,
      source: cell.meta?.source || "mt.threadProtocol",
    },
  };
}

function directThreadId(dv: AnyDV) {
  return text(
    dv?.attrs?.threadId ||
      dv?.attrs?.contact?.threadId ||
      dv?.attrs?.relation?.threadId ||
      dv?.attrs?.target?.threadId ||
      dv?.meta?.threadId ||
      dv?.meta?.relation?.threadId ||
      dv?.contact?.threadId ||
      dv?.threadId,
  );
}

function relationIds(dv: AnyDV) {
  const attrs = dv?.attrs || {};
  const meta = dv?.meta || {};
  return unique([
    attrs.parentDvId,
    attrs.rootDvId,
    attrs.responseToId,
    attrs.respondsTo,
    attrs.intentRef?.id,
    attrs.proposalRef?.id,
    attrs.target?.id,
    meta.parentDvId,
    meta.rootDvId,
    meta.respondsTo,
    ...(Array.isArray(attrs.sourceDvIds) ? attrs.sourceDvIds : []),
    ...(Array.isArray(attrs.sourceRefs) ? attrs.sourceRefs.map((ref: any) => ref?.id) : []),
  ]);
}

/** Resuelve una sola identidad de hilo sin inventar protocolos nuevos. */
export function resolveDvThreadId(dv: AnyDV, universe: AnyDV[] = []) {
  const direct = directThreadId(dv);
  if (direct) return direct;
  if (!universe.length) return "";

  const byId = new Map(
    universe.filter((item) => item?.id).map((item) => [text(item.id), item]),
  );
  const queue = relationIds(dv);
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift() || "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const related = byId.get(id);
    if (!related) continue;
    const found = directThreadId(related);
    if (found) return found;
    queue.push(...relationIds(related));
  }
  return "";
}

export function readThreadId(dv: AnyDV) {
  return resolveDvThreadId(dv);
}

export function readThreadText(dv: AnyDV) {
  const attrs = dv?.attrs || {};
  return text(
    attrs.text ||
      attrs.answer ||
      attrs.note ||
      attrs.message ||
      attrs.notes ||
      attrs.question ||
      attrs.consultText ||
      dv?.kind
  );
}

export function humanThreadEventLabel(dv: AnyDV) {
  const kind = text(dv?.kind);
  if (
    kind === "payment.outcome" &&
    (!dv?.meta?.ownership?.signature?.value ||
      text(dv?.meta?.authority) !== text(dv?.attrs?.actingAsNodeId))
  ) {
    return "Pago informado sin autoridad comprobable";
  }
  const explicitState = normalized(
    dv?.attrs?.transaction?.state || dv?.attrs?.state || dv?.attrs?.status,
  );
  const labels: Record<string, string> = {
    "work.intent": "Publicaste una necesidad",
    "market.order.create": "Pedido enviado al comercio",
    "market.order.received": "El comercio recibiÃ³ el pedido",
    "market.order.accept": "El comercio aceptÃ³ el pedido",
    "market.order.reject": "El comercio no pudo aceptar el pedido",
    "match.proposal": "UTOPY encontró una coincidencia",
    "work.plan": "Se preparó un plan",
    "work.execution": "El trabajo está en marcha",
    "work.outcome":
      normalized(dv?.attrs?.proof?.status).includes("awaiting")
        ? "Resultado pendiente de confirmación"
        : "Trabajo completado",
    "payment.session.open": "Pago iniciado",
    "payment.outcome": "Pago confirmado",
    "pay.session": "Elegiste cÃ³mo coordinar el pago",
    "pay.confirmation": "Una parte confirmÃ³ el pago",
    "pay.receipt": "Pago comprobado por ambas partes",
    "credit.request": "Solicitaste financiaciÃ³n",
    "credit.decision": "El nodo financiero respondiÃ³",
    "credit.account": "Acuerdo de crÃ©dito activo",
    "liq.settlement.batch": "Plan de obligaciones preparado",
    "value.redemption.request": "Solicitaste usar un beneficio",
    "value.redemption.outcome": "El nodo respondiÃ³ sobre el beneficio",
    "identity.link.request": "Solicitaste vincularte con el nodo",
    "identity.link.active": "VÃ­nculo privado activo",
    "identity.link.revoked": "VÃ­nculo privado cerrado",
    "delivery.outcome": "Entrega completada",
    "delivery.status":
      explicitState === "in_transit"
        ? "Va en camino"
        : explicitState === "delivered"
          ? "Entrega informada"
          : "Estado de entrega actualizado",
    "subscription.proposal": "Propusieron un abastecimiento recurrente",
    "subscription.accepted": "Aceptaste el acuerdo recurrente",
    "subscription.active": "Abastecimiento recurrente activo",
    "subscription.paused": "Abastecimiento recurrente pausado",
    "subscription.cancelled": "Abastecimiento recurrente cancelado",
    "subscription.pause.request": "Solicitaste pausar la recurrencia",
    "subscription.cancel.request": "Solicitaste cancelar la recurrencia",
    "payment.autopay.authorization.request": "Solicitaste activar el pago automático",
    "payment.autopay.authorization": "Pago automático autorizado",
    "payment.autopay.revoke.request": "Solicitaste desactivar el pago automático",
    "payment.autopay.revoked": "Pago automático desactivado",
    "payment.mandate": "Pago automático autorizado",
    "payment.mandate.create": "Pago automático autorizado",
    "payment.mandate.cancel": "Pago automático desactivado",
    "value.proof": "Resultado comprobado",
    "resonance.response": "Alguien respondió",
  };
  return labels[kind] || "Actualización";
}

function meaningfulSubject(dv: AnyDV) {
  const attrs = dv?.attrs || {};
  const kind = text(dv?.kind);
  const allowMessageText = [
    "work.intent",
    "market.order",
    "market.order.create",
    "subscription.proposal",
    "subscription.accepted",
    "subscription.active",
    "mt.offer",
    "mt:producto",
  ].includes(kind);
  const raw = text(
    attrs.title ||
      attrs.productName ||
      attrs.nombre ||
      attrs.name ||
      attrs.materialName ||
      attrs.work?.title ||
      attrs.order?.productName ||
      (allowMessageText ? attrs.description || attrs.text : ""),
  );
  if (!raw || /^(work|match|mt|payment|delivery|subscription)[.:]/i.test(raw)) {
    return "";
  }
  if (/^(voy en camino|en camino|entregado|completado|pago confirmado)$/i.test(raw)) {
    return "";
  }
  return raw.slice(0, 72);
}

function humanizeRootSubject(raw: string) {
  const clean = raw
    .replace(/^necesito que alguien\s+/i, "")
    .replace(/^(necesito|busco|quiero|fabricar)\s+/i, "")
    .replace(/\bmi casa\b/gi, "tu casa")
    .trim();
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

/** El tema se obtiene de la raíz; nunca del último estado o mensaje. */
export function resolveHumanThreadTitle(
  thread: AnyDV[] | { items?: AnyDV[]; last?: AnyDV | null },
  allLive: AnyDV[] = [],
) {
  const items = Array.isArray(thread)
    ? thread
    : thread?.items || (thread?.last ? [thread.last] : []);
  const universe = allLive.length ? allLive : items;
  const byId = new Map(
    universe.filter((item) => item?.id).map((item) => [text(item.id), item]),
  );
  const rootIds = unique(
    items.flatMap((item) => [
      item?.attrs?.rootDvId,
      item?.attrs?.relation?.rootDvId,
      item?.meta?.rootDvId,
      item?.meta?.relation?.rootDvId,
    ]),
  );
  const roots = rootIds.map((id) => byId.get(id)).filter(Boolean) as AnyDV[];
  const priority: Record<string, number> = {
    "work.intent": 0,
    "market.order.create": 1,
    "market.order": 1,
    "subscription.proposal": 2,
    "subscription.accepted": 2,
    "subscription.active": 2,
    "mo.design": 3,
    "mt.offer": 4,
  };
  const candidates = Array.from(
    new Map(
      [...roots, ...items].map((item, index) => [
        text(item?.id) || `thread-item:${index}`,
        item,
      ]),
    ).values(),
  ).sort((a, b) => {
    const rankA = priority[text(a?.kind)] ?? 20;
    const rankB = priority[text(b?.kind)] ?? 20;
    return rankA - rankB || timestampOf(a) - timestampOf(b);
  });

  for (const item of candidates) {
    const subject = humanizeRootSubject(meaningfulSubject(item));
    if (!subject) continue;
    const kind = text(item?.kind);
    if (kind === "market.order" || kind === "market.order.create") {
      return /^pedido\b/i.test(subject) ? subject : `Pedido de ${subject}`;
    }
    return subject;
  }

  const participant = candidates
    .map((item) =>
      text(
        item?.attrs?.displayName ||
          item?.attrs?.sellerName ||
          item?.attrs?.nodeName ||
          item?.attrs?.actorName,
      ),
    )
    .find(Boolean);
  return participant ? `Conversación con ${participant}` : "Conversación viva";
}

export function humanThreadTitleFromDVs(items: AnyDV[]) {
  return resolveHumanThreadTitle(items, items);
}

function actorIdsOf(dv: AnyDV) {
  const attrs = dv?.attrs || {};
  return unique([
    attrs.actorId,
    attrs.fromActorId,
    attrs.requesterId,
    attrs.providerId,
    attrs.sellerId,
    attrs.buyerId,
    attrs.driverId,
    attrs.producerId,
    attrs.financierId,
    attrs.assignedToActorId,
    attrs.owner?.actorId,
    attrs.by?.actorId,
    attrs.author?.id,
    dv?.meta?.actor,
    dv?.meta?.authority,
    ...(Array.isArray(attrs.participants) ? attrs.participants : []),
  ]);
}

export function resolveCurrentActorRole(
  items: AnyDV[],
  currentActorId: string | null | undefined,
): OperationActorRole {
  const actorId = text(currentActorId);
  if (!actorId) return "observer";
  const ordered = [...(items || [])].sort((a, b) => timestampOf(a) - timestampOf(b));
  const isActor = (value: unknown) => text(value) === actorId;

  for (const dv of ordered) {
    const attrs = dv?.attrs || {};
    if (isActor(attrs.requesterId)) return "requester";
    if (isActor(attrs.buyerId)) return "buyer";
  }
  for (const dv of ordered) {
    const attrs = dv?.attrs || {};
    const domain = normalized(attrs.domain || attrs.workDomain);
    if (
      isActor(attrs.driverId) ||
      (isActor(attrs.assignedToActorId || attrs.owner?.actorId) &&
        /(transport|delivery|logistic)/.test(domain))
    ) {
      return "driver";
    }
    if (isActor(attrs.producerId)) return "producer";
    if (isActor(attrs.financierId)) return "financier";
    if (isActor(attrs.sellerId)) return "seller";
    if (
      isActor(attrs.providerId) ||
      isActor(attrs.assignedToActorId) ||
      isActor(attrs.owner?.actorId)
    ) {
      return "provider";
    }
  }
  return ordered.some((dv) => actorIdsOf(dv).includes(actorId))
    ? "provider"
    : "observer";
}

function isActorAuthorized(items: AnyDV[], actorId: string) {
  return Boolean(
    actorId && items.some((item) => actorIdsOf(item).includes(actorId)),
  );
}

function subscriptionStatusOf(dv: AnyDV): SubscriptionStatus | null {
  const kind = text(dv?.kind);
  const byKind: Record<string, SubscriptionStatus> = {
    "subscription.proposal": "proposed",
    "subscription.accepted": "accepted",
    "subscription.active": "active",
    "subscription.paused": "paused",
    "subscription.cancelled": "cancelled",
  };
  if (byKind[kind]) return byKind[kind];
  if (!kind.startsWith("subscription.")) return null;
  const explicit = normalized(dv?.attrs?.status || dv?.attrs?.state);
  return ["proposed", "accepted", "active", "paused", "cancelled"].includes(
    explicit,
  )
    ? (explicit as SubscriptionStatus)
    : null;
}

function isAutopayAuthorization(dv: AnyDV) {
  const kind = text(dv?.kind);
  if (kind === "payment.autopay.authorization") {
    return !["revoked", "cancelled", "inactive"].includes(
      normalized(dv?.attrs?.status),
    );
  }
  return (
    (kind === "payment.mandate" || kind === "payment.mandate.create") &&
    dv?.attrs?.active !== false
  );
}

function isAutopayRevocation(dv: AnyDV) {
  return ["payment.autopay.revoked", "payment.mandate.cancel"].includes(
    text(dv?.kind),
  );
}

/**
 * Reduce recurrencia y autopay por DVs relacionados. Palabras como "cada
 * semana" nunca crean por sí solas una suscripción ni una autorización.
 */
export function deriveSubscriptionState(
  items: AnyDV[],
  currentActorId?: string | null,
): DerivedSubscriptionState {
  const ordered = [...(items || [])].sort((a, b) => timestampOf(a) - timestampOf(b));
  const subscriptionEvents = ordered.filter((item) => subscriptionStatusOf(item));
  const subscription = subscriptionEvents[subscriptionEvents.length - 1] || null;
  const status = subscriptionStatusOf(subscription || {}) || "none";
  const authorizationEvents = ordered.filter(isAutopayAuthorization);
  const revocations = ordered.filter(isAutopayRevocation);
  const requests = ordered.filter(
    (item) => text(item?.kind) === "payment.autopay.revoke.request",
  );
  const authorization = authorizationEvents[authorizationEvents.length - 1] || null;
  const revocation = revocations[revocations.length - 1] || null;
  const revokeRequest = requests[requests.length - 1] || null;
  const authorizationTs = timestampOf(authorization || {});
  const revocationTs = timestampOf(revocation || {});
  const requestTs = timestampOf(revokeRequest || {});
  const autopayActive = Boolean(authorization && authorizationTs > revocationTs);
  const autopayRevoked = Boolean(revocation && revocationTs >= authorizationTs);
  const actorId = text(currentActorId);
  const authorized = isActorAuthorized(ordered, actorId);
  const terminal = status === "cancelled";

  return {
    exists: status !== "none",
    status,
    recurring: status !== "none",
    subscriptionId:
      text(subscription?.attrs?.subscriptionId || subscription?.id) || null,
    nextOccurrence:
      text(
        subscription?.attrs?.nextOccurrence ||
          subscription?.attrs?.nextDeliveryAt ||
          subscription?.attrs?.schedule?.next,
      ) || null,
    canAccept: status === "proposed" && authorized,
    canPause: status === "active" && authorized && !terminal,
    canCancel:
      (status === "active" || status === "paused") && authorized && !terminal,
    autopay: {
      exists: Boolean(authorization || revocation),
      status: autopayActive ? "active" : autopayRevoked ? "revoked" : "none",
      authorizationId:
        text(
          authorization?.attrs?.authorizationId ||
            authorization?.attrs?.mandateId ||
            authorization?.id,
        ) || null,
      pendingRevoke:
        autopayActive && Boolean(revokeRequest && requestTs > authorizationTs),
      canRevoke: autopayActive && authorized,
    },
    evidence: {
      subscription,
      autopayAuthorization: authorization,
      autopayRevocation: revocation,
      autopayRevokeRequest: revokeRequest,
    },
  };
}

function explicitOperationPhase(dv: AnyDV): DerivedThreadState["phase"] | null {
  const kind = text(dv?.kind);
  if (
    kind === "payment.outcome" &&
    (!dv?.meta?.ownership?.signature?.value ||
      text(dv?.meta?.authority) !== text(dv?.attrs?.actingAsNodeId))
  ) return null;
  const status = normalized(
    dv?.attrs?.transaction?.state ||
      dv?.attrs?.state ||
      dv?.attrs?.status ||
      dv?.attrs?.result,
  );
  const proof = normalized(dv?.attrs?.proof?.status);
  if (status === "disputed" || status === "refund_requested") return "disputed";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "in_transit" || status === "en_route") return "in_transit";
  if (status === "delivered") return "awaiting_confirmation";
  if (status === "completed" || status === "confirmed") return "completed";
  if (kind === "market.order.reject" || kind === "credit.decision" && status === "rejected") return "cancelled";
  if (["market.order.received", "credit.request", "value.redemption.request"].includes(kind)) return "awaiting_confirmation";
  if (["market.order.accept", "pay.receipt", "value.redemption.outcome"].includes(kind)) return "completed";
  if (kind === "work.outcome") {
    return /verified|confirmed|accepted/.test(proof) || dv?.attrs?.verified === true
      ? "completed"
      : "awaiting_confirmation";
  }
  if (kind === "work.execution" || status === "in_progress") return "in_progress";
  if (kind === "work.plan") return "planned";
  if (kind === "trade.intent.accept" || kind === "utopy.reaction.accepted") {
    return "accepted";
  }
  if (kind === "match.proposal" || kind === "utopy.reaction.proposal") {
    return "proposal";
  }
  if (kind === "work.intent") return "open";
  return null;
}

function phasePresentation(phase: DerivedThreadState["phase"]) {
  const values: Record<
    DerivedThreadState["phase"],
    { label: string; tone: "ok" | "warn" | "info" | "neutral" }
  > = {
    open: { label: "Buscando opciones", tone: "neutral" },
    proposal: { label: "Hay una propuesta", tone: "info" },
    accepted: { label: "Propuesta aceptada", tone: "info" },
    planned: { label: "Trabajo planeado", tone: "info" },
    in_progress: { label: "En curso", tone: "info" },
    in_transit: { label: "En camino", tone: "info" },
    awaiting_confirmation: { label: "Esperando confirmación", tone: "warn" },
    completed: { label: "Completado", tone: "ok" },
    cancelled: { label: "Cancelado", tone: "warn" },
    disputed: { label: "En revisión", tone: "warn" },
  };
  return values[phase];
}

/** Una sola proyección de estado y acción contextual para el Hilo Vivo. */
export function deriveThreadState(
  items: AnyDV[],
  currentActorId?: string | null,
): DerivedThreadState {
  const ordered = [...(items || [])].sort((a, b) => timestampOf(a) - timestampOf(b));
  const stateEvents = ordered
    .map((event) => ({ event, phase: explicitOperationPhase(event) }))
    .filter((entry) => entry.phase);
  const latest = stateEvents[stateEvents.length - 1] || null;
  const subscription = deriveSubscriptionState(ordered, currentActorId);
  const role = resolveCurrentActorRole(ordered, currentActorId);
  const phase = latest?.phase || "open";
  const presentation = phasePresentation(phase);
  let primaryAction: DerivedThreadState["primaryAction"] = "wait";
  let primaryLabel = "Esperar respuestas";
  let primaryEnabled = false;
  const requesterId = text(
    ordered.find((item) => text(item?.kind) === "work.intent")?.attrs
      ?.requesterId,
  );
  const hasHumanReply = ordered.some((item) => {
    const kind = text(item?.kind);
    const actorId = text(item?.attrs?.fromActorId || item?.attrs?.actorId);
    return (
      ["trade.message", "market.order.message", "trade.intent.message"].includes(
        kind,
      ) &&
      actorId &&
      (!requesterId || actorId !== requesterId)
    );
  });

  if (phase === "open" && subscription.status === "proposed") {
    primaryAction = "view_proposal";
    primaryLabel = "Ver propuesta";
    primaryEnabled = true;
  } else if (phase === "open" && subscription.status === "accepted") {
    primaryAction = "wait";
    primaryLabel = "Esperando activación";
    primaryEnabled = false;
  } else if (phase === "open" && hasHumanReply) {
    primaryAction = "talk";
    primaryLabel = "Hablar";
    primaryEnabled = true;
  } else if (phase === "proposal") {
    primaryAction = "view_proposal";
    primaryLabel = "Ver propuesta";
    primaryEnabled = true;
  } else if (phase === "accepted" || phase === "planned") {
    primaryAction = "talk";
    primaryLabel = "Hablar";
    primaryEnabled = true;
  } else if (phase === "in_progress") {
    primaryAction = "view_progress";
    primaryLabel = "Ver progreso";
    primaryEnabled = true;
  } else if (phase === "in_transit") {
    primaryAction = "view_delivery";
    primaryLabel = "Ver entrega";
    primaryEnabled = true;
  } else if (phase === "awaiting_confirmation") {
    if (role === "buyer" || role === "requester") {
      primaryAction = "confirm_received";
      primaryLabel = "Confirmar recibido";
      primaryEnabled = true;
    } else {
      primaryAction = "view_delivery";
      primaryLabel = "Esperar confirmación";
      primaryEnabled = false;
    }
  } else if (subscription.status === "active") {
    primaryAction = "manage_recurrence";
    primaryLabel = "Administrar recurrencia";
    primaryEnabled = true;
  } else if (phase === "completed") {
    primaryAction = "talk";
    primaryLabel = "Hablar";
    primaryEnabled = true;
  }

  return {
    phase,
    label: presentation.label,
    tone: presentation.tone,
    role,
    primaryAction,
    primaryLabel,
    primaryEnabled,
    subscription,
    lastStateEvent: latest?.event || null,
  };
}

export function formatHumanThreadTime(value: unknown, nowValue = Date.now()) {
  const raw =
    typeof value === "object" && value
      ? (value as AnyDV)?.meta?.ts || (value as AnyDV)?.attrs?.ts
      : value;
  const date = new Date(String(raw || ""));
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date(nowValue);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startToday - startDate) / 86_400_000);
  const time = new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (dayDiff === 0) return `Hoy · ${time}`;
  if (dayDiff === 1) return `Ayer · ${time}`;
  const day = new Intl.DateTimeFormat("es-PY", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
  return `${day} · ${time}`;
}

export function resolveHumanActorName(
  dv: AnyDV,
  currentActorId?: string | null,
  allLive: AnyDV[] = [],
) {
  const attrs = dv?.attrs || {};
  const actorId = text(
    attrs.fromActorId || attrs.actorId || attrs.by?.actorId || attrs.author?.id,
  );
  if (actorId && actorId === text(currentActorId)) return "Vos";
  if (
    ["match.proposal", "resonance.response", "utopy.reaction.proposal"].includes(
      text(dv?.kind),
    )
  ) {
    return "UTOPY";
  }
  const direct = text(
    attrs.displayName ||
      attrs.actorName ||
      attrs.fromActorName ||
      attrs.profile?.name ||
      attrs.nodeName ||
      attrs.storeName ||
      attrs.sellerName ||
      attrs.by?.actorName ||
      attrs.owner?.actorName ||
      attrs.author?.name,
  );
  if (
    direct &&
    !direct.includes(":") &&
    !/^(actor|usuario|nodo|comprador) local$/i.test(direct)
  ) {
    return direct;
  }
  const identity = allLive.find((item) => {
    const itemAttrs = item?.attrs || {};
    return [item?.id, itemAttrs.actorId, itemAttrs.nodeId, itemAttrs.profile?.id]
      .map(text)
      .includes(actorId);
  });
  return (
    text(
      identity?.attrs?.displayName ||
        identity?.attrs?.name ||
        identity?.attrs?.nombre ||
        identity?.attrs?.profile?.name ||
        identity?.attrs?.nodeName ||
        identity?.attrs?.storeName,
    ) || "Participante"
  );
}

export function isThreadDV(dv: AnyDV) {
  return Boolean(readThreadId(dv) && THREAD_KINDS.has(text(dv?.kind)));
}

function canonicalScore(dv: AnyDV) {
  const kind = text(dv?.kind);
  if (kind === "trade.message" || kind === "market.order.message") return 1;
  if (kind === "trade.intent.message") return 2;
  return 3;
}

/**
 * Oculta los mensajes espejo antiguos sin borrar historial. Una acción y su
 * descripción son una sola interacción; work.intent sí permanece separado
 * porque representa una nueva señal para el territorio.
 */
export function dedupeThreadDVs(items: AnyDV[]) {
  const byId = new Map<string, AnyDV>();
  for (const item of Array.isArray(items) ? items : []) {
    if (!isThreadDV(item)) continue;
    const id = text(item?.id) || newId("legacy:");
    byId.set(id, item);
  }

  const candidates = Array.from(byId.values()).sort(
    (a, b) => timestampOf(a) - timestampOf(b)
  );
  const output: AnyDV[] = [];

  for (const item of candidates) {
    const attrs = item?.attrs || {};
    const tid = readThreadId(item);
    const actor = text(attrs.fromActorId || attrs.actorId || attrs.author?.id);
    const body = normalized(readThreadText(item)).replace(/^consulta:\s*/, "");
    const ts = timestampOf(item);

    const duplicateIndex = output.findIndex((previous) => {
      const previousAttrs = previous?.attrs || {};
      return (
        readThreadId(previous) === tid &&
        text(
          previousAttrs.fromActorId ||
            previousAttrs.actorId ||
            previousAttrs.author?.id
        ) === actor &&
        normalized(readThreadText(previous)).replace(/^consulta:\s*/, "") === body &&
        Math.abs(timestampOf(previous) - ts) <= 1500
      );
    });

    if (duplicateIndex < 0) {
      output.push(item);
      continue;
    }

    if (canonicalScore(item) > canonicalScore(output[duplicateIndex])) {
      output[duplicateIndex] = item;
    }
  }

  return output.sort((a, b) => timestampOf(a) - timestampOf(b));
}

export function buildThreadActionDV(input: ThreadActionInput): AnyDV {
  const threadId = text(input.threadId);
  const fromActorId = text(input.fromActorId);
  const toActorId = text(input.toActorId);
  const participants = unique([
    ...(input.participants || []),
    fromActorId,
    toActorId,
  ]);
  const chainId = text(input.chainId) || threadId;
  const body = text(input.text);

  return {
    id: newId(`${input.kind}:`),
    kind: input.kind,
    attrs: {
      ...(input.attrs || {}),
      threadId,
      chainId,
      rootDvId: input.rootDvId || input.attrs?.rootDvId || null,
      parentDvId: input.parentDvId || input.attrs?.parentDvId || null,
      responseToId: input.responseToId || input.attrs?.responseToId || null,
      respondsTo: input.responseToId || input.attrs?.respondsTo || null,
      fromActorId,
      fromActorName: input.fromActorName || null,
      actorId: fromActorId,
      actorName: input.fromActorName || null,
      toActorId: toActorId || null,
      toActorName: input.toActorName || null,
      participants,
      unreadBy: toActorId && toActorId !== fromActorId ? [toActorId] : [],
      text: body,
      actionKind: input.kind,
      status: input.attrs?.status || "sent",
    },
    traits: unique([
      "mt:thread",
      "utopy:action",
      input.kind,
      ...(input.traits || []),
    ]),
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 7,
      schema: "utopy.thread.action@1",
      threadId,
      chainId,
      ...(input.meta || {}),
    },
  };
}

/** Crea una necesidad humana enlazada al hilo y visible para Mapa Vivo. */
export function buildLinkedWorkIntentDV(
  input: LinkedWorkIntentInput
): AnyDV {
  const body = text(input.text);
  if (body.length < 3) {
    throw new Error("La necesidad necesita un poco más de contexto.");
  }

  const source = input.sourceDV || null;
  const sourceAttrs = source?.attrs || {};
  const sourceMeta = source?.meta || {};
  const sourceRelation = sourceAttrs?.relation || sourceMeta?.relation || {};
  const threadId =
    text(input.threadId) ||
    readThreadId(source || {}) ||
    newId("mt.thread:");
  const chainId =
    text(input.chainId) ||
    text(sourceAttrs?.chainId || sourceMeta?.chainId || sourceRelation?.chainId) ||
    threadId;
  const rootDvId =
    text(sourceAttrs?.rootDvId || sourceMeta?.rootDvId || sourceRelation?.rootDvId) ||
    text(source?.id) ||
    null;
  const sourceWorkId =
    text(sourceAttrs?.workId || sourceRelation?.workId) || null;
  const designId =
    text(sourceAttrs?.designId || sourceRelation?.designId || sourceAttrs?.source?.designId) ||
    null;
  const workId = newId("work:");
  const terms = humanCapabilityTerms(body);
  const location = input.location
    ? sourceLocation({ attrs: { location: input.location } })
    : sourceLocation(source);
  const quantity = Number(input.quantity || 0);
  const parentDvId = input.sourceActionId || source?.id || null;

  return {
    id: newId("work.intent:"),
    kind: "work.intent",
    attrs: {
      workId,
      designId,
      sourceWorkId,
      chainId,
      threadId,
      rootDvId,
      parentDvId,
      sourceActionId: parentDvId,
      relation: {
        workId,
        designId,
        sourceWorkId,
        chainId,
        threadId,
        rootDvId,
        parentDvId,
      },
      sourceRefs: source?.id
        ? [{ id: String(source.id), kind: String(source.kind || "dato") }]
        : [],
      requesterId: input.actorId,
      requesterName: input.actorName || null,
      actorId: input.actorId,
      actorName: input.actorName || null,
      fromActorId: input.actorId,
      fromActorName: input.actorName || null,
      participants: unique([
        input.actorId,
        ...(Array.isArray(sourceAttrs?.participants) ? sourceAttrs.participants : []),
      ]),
      nodeId: input.nodeId || null,
      title: text(input.title) || body.slice(0, 160),
      description: body,
      text: body,
      domain: text(input.domain) || "general",
      requestedCapabilities: terms,
      semanticTerms: terms,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: input.unit || "u",
      location,
      geo: location,
      status: "open",
      state: "open",
      visibility: "public",
      intent: {
        mode: "need",
        domains: terms,
        resources: terms,
        verbs: ["respond", "offer", "collaborate"],
      },
      security: {
        requiresConsent: true,
        automaticActions: false,
        exactAddressPublic: false,
      },
    },
    traits: [
      "work:intent",
      "mt:work",
      "resonance:intent",
      "frequency:live",
      "map:visible",
      "circular:demand",
      "utopy:chain",
    ],
    meta: {
      ns: "work:intent",
      ts: nowIso(),
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 7,
      source: "mt.threadProtocol.linked-intent",
      schema: "utopy.work.intent@3",
      threadId,
      chainId,
      rootDvId,
      parentDvId,
      relation: {
        workId,
        designId,
        sourceWorkId,
        threadId,
        chainId,
        rootDvId,
        parentDvId,
      },
    },
  };
}
