// src/mt/mt.transactionProtocol.ts
// Estados verificables para compra, fabricación, entrega, disputa y reembolso.

export type TransactionState =
  | "proposed"
  | "accepted"
  | "payment_authorized"
  | "funds_held"
  | "in_production"
  | "ready"
  | "in_transit"
  | "delivered"
  | "completed"
  | "refund_requested"
  | "refund_approved"
  | "refunded"
  | "disputed"
  | "resolved"
  | "cancelled";

export type TransactionActorRole =
  | "buyer"
  | "seller"
  | "provider"
  | "cajero"
  | "system";

export type FundsMode = "none" | "authorization" | "escrow";

export type TransactionProtection = {
  fundsMode: FundsMode;
  paymentRail?: string | null;
  releaseRule: "buyer_confirmation" | "buyer_confirmation_or_timeout";
  refundRailConnected: boolean;
  refundWindowHours: number;
  productionCancellation: "before_start" | "provider_policy";
};

export type TransactionSnapshot = {
  state: TransactionState;
  progress: number;
  label: string;
  paused: boolean;
  terminal: boolean;
  protection: TransactionProtection;
  refundGuaranteed: boolean;
  lastEvent: any | null;
  history: any[];
  warnings: string[];
};

export type BuildTransactionEventInput = {
  threadId: string;
  orderId?: string | null;
  chainId?: string | null;
  state: TransactionState;
  previousState?: TransactionState | null;
  actorId: string;
  actorName?: string | null;
  actorRole: TransactionActorRole;
  toActorId?: string | null;
  participants?: string[];
  reason?: string | null;
  amount?: number | null;
  currency?: string | null;
  protection?: Partial<TransactionProtection>;
  idempotencyKey?: string | null;
  evidenceRefs?: string[];
  attrs?: Record<string, any>;
};

const DEFAULT_PROTECTION: TransactionProtection = {
  fundsMode: "none",
  paymentRail: null,
  releaseRule: "buyer_confirmation_or_timeout",
  refundRailConnected: false,
  refundWindowHours: 72,
  productionCancellation: "before_start",
};

const LABELS: Record<TransactionState, string> = {
  proposed: "Propuesta recibida",
  accepted: "Pedido aceptado",
  payment_authorized: "Pago autorizado",
  funds_held: "Fondos protegidos",
  in_production: "En fabricación",
  ready: "Listo para entregar",
  in_transit: "En camino",
  delivered: "Entrega informada",
  completed: "Entrega confirmada",
  refund_requested: "Reembolso solicitado",
  refund_approved: "Reembolso aprobado",
  refunded: "Reembolsado",
  disputed: "En revisiÃ³n",
  resolved: "Caso resuelto",
  cancelled: "Cancelado",
};

const PROGRESS: Record<TransactionState, number> = {
  proposed: 5,
  accepted: 15,
  payment_authorized: 25,
  funds_held: 30,
  in_production: 50,
  ready: 70,
  in_transit: 82,
  delivered: 92,
  completed: 100,
  refund_requested: 50,
  refund_approved: 75,
  refunded: 100,
  disputed: 50,
  resolved: 100,
  cancelled: 100,
};

const TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  proposed: ["accepted", "cancelled", "disputed"],
  accepted: ["payment_authorized", "funds_held", "in_production", "cancelled", "refund_requested", "disputed"],
  payment_authorized: ["funds_held", "in_production", "cancelled", "refund_requested", "disputed"],
  funds_held: ["in_production", "refund_requested", "disputed"],
  in_production: ["ready", "refund_requested", "disputed"],
  ready: ["in_transit", "delivered", "refund_requested", "disputed"],
  in_transit: ["delivered", "refund_requested", "disputed"],
  delivered: ["completed", "refund_requested", "disputed"],
  completed: ["disputed"],
  refund_requested: ["refund_approved", "disputed", "resolved"],
  refund_approved: ["refunded", "disputed"],
  refunded: [],
  disputed: ["refund_approved", "refunded", "resolved"],
  resolved: [],
  cancelled: [],
};

const ROLES: Partial<Record<TransactionState, TransactionActorRole[]>> = {
  accepted: ["buyer", "cajero", "system"],
  payment_authorized: ["buyer", "cajero", "system"],
  funds_held: ["cajero", "system"],
  in_production: ["seller", "provider", "cajero", "system"],
  ready: ["seller", "provider", "cajero", "system"],
  in_transit: ["seller", "provider", "cajero", "system"],
  delivered: ["seller", "provider", "cajero", "system"],
  completed: ["buyer", "cajero", "system"],
  refund_requested: ["buyer", "cajero"],
  refund_approved: ["seller", "provider", "cajero", "system"],
  refunded: ["cajero", "system"],
  disputed: ["buyer", "seller", "provider", "cajero"],
  resolved: ["cajero", "system"],
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function unique(values: unknown[]): string[] {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function id(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}:${uuid}`
    : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function timestamp(event: any): number {
  const raw = event?.meta?.ts || event?.attrs?.ts || 0;
  const parsed = typeof raw === "number" ? raw : Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function transactionStateOf(event: any): TransactionState | null {
  const kind = text(event?.kind).toLowerCase();
  if (kind === "trade.intent.accept") return "accepted";
  if (kind === "sale.receipt") return "payment_authorized";
  const explicit = text(event?.attrs?.transaction?.state || event?.attrs?.state || event?.attrs?.status);
  if (explicit in LABELS) return explicit as TransactionState;
  const action = text(event?.attrs?.action || event?.attrs?.eventType).toLowerCase();
  if (action.includes("production")) return "in_production";
  if (action.includes("ready")) return "ready";
  if (action.includes("transit") || action.includes("shipping")) return "in_transit";
  if (action.includes("delivered")) return "delivered";
  if (action.includes("confirm") && action.includes("sale")) return "completed";
  if (action.includes("refund") && action.includes("request")) return "refund_requested";
  if (action.includes("refund") && action.includes("approve")) return "refund_approved";
  if (action.includes("refunded")) return "refunded";
  if (action.includes("dispute")) return "disputed";
  if (action.includes("cancel")) return "cancelled";
  return null;
}

export function canTransition(
  previous: TransactionState,
  next: TransactionState,
  actorRole: TransactionActorRole
): { ok: boolean; reason?: string } {
  if (previous === next) return { ok: true };
  if (!TRANSITIONS[previous]?.includes(next)) {
    return { ok: false, reason: `No se puede pasar de ${LABELS[previous]} a ${LABELS[next]}.` };
  }
  const roles = ROLES[next];
  if (roles && !roles.includes(actorRole)) {
    return { ok: false, reason: "Este actor no tiene permiso para realizar ese cambio." };
  }
  return { ok: true };
}

export function buildTransactionEventDV(input: BuildTransactionEventInput) {
  const threadId = text(input.threadId);
  if (!threadId) throw new Error("La operación necesita threadId.");
  if (input.previousState) {
    const transition = canTransition(input.previousState, input.state, input.actorRole);
    if (!transition.ok) throw new Error(transition.reason);
  }
  const protection: TransactionProtection = {
    ...DEFAULT_PROTECTION,
    ...(input.protection || {}),
  };
  const amount = Math.max(0, Number(input.amount || 0));
  const transactionId = text(input.orderId) || threadId;
  const eventIdempotency =
    text(input.idempotencyKey) ||
    `${transactionId}:${input.state}:${input.actorId}`;
  const ts = new Date().toISOString();
  return {
    id: id("market.order.event"),
    kind: "market.order.event",
    attrs: {
      threadId,
      chainId: input.chainId || threadId,
      orderId: input.orderId || transactionId,
      transactionId,
      eventType: "transaction.state.changed",
      action: `transaction.${input.state}`,
      state: input.state,
      status: input.state,
      previousState: input.previousState || null,
      actorId: input.actorId,
      actorName: input.actorName || null,
      actorRole: input.actorRole,
      fromActorId: input.actorId,
      toActorId: input.toActorId || null,
      participants: unique([...(input.participants || []), input.actorId, input.toActorId]),
      unreadBy: input.toActorId ? [input.toActorId] : [],
      reason: input.reason || null,
      amount,
      currency: input.currency || "PYG",
      evidenceRefs: unique(input.evidenceRefs || []),
      idempotencyKey: eventIdempotency,
      transaction: {
        state: input.state,
        previousState: input.previousState || null,
        progress: PROGRESS[input.state],
        label: LABELS[input.state],
        protection,
        refundGuaranteed:
          protection.fundsMode === "escrow" && protection.refundRailConnected,
      },
      security: {
        requiresConsent: true,
        automaticActions: false,
        idempotent: true,
        paymentExecution: "external-rail-required",
      },
      ...(input.attrs || {}),
    },
    traits: [
      "mt:order.event",
      "mt:transaction",
      "utopy:protected-operation",
      "consent:required",
      `transaction:${input.state}`,
    ],
    meta: {
      ns: "mt:market",
      ts,
      scopes: ["participants"],
      ttl_ms: 1000 * 60 * 60 * 24 * 365,
      schema: "utopy.transaction.event@1",
      threadId,
      chainId: input.chainId || threadId,
      idempotencyKey: eventIdempotency,
    },
    labels: [LABELS[input.state], input.reason || "Operación protegida"],
  };
}

export function reduceTransaction(
  events: any[],
  fallbackProtection: Partial<TransactionProtection> = {}
): TransactionSnapshot {
  const history = (Array.isArray(events) ? events : [])
    .filter((event) => transactionStateOf(event))
    .sort((a, b) => timestamp(a) - timestamp(b));
  const deduped = Array.from(
    new Map(
      history.map((event) => [
        text(event?.attrs?.idempotencyKey || event?.meta?.idempotencyKey || event?.id),
        event,
      ])
    ).values()
  );
  const lastEvent = deduped[deduped.length - 1] || null;
  const state = transactionStateOf(lastEvent) || "proposed";
  const protection: TransactionProtection = {
    ...DEFAULT_PROTECTION,
    ...(fallbackProtection || {}),
    ...(lastEvent?.attrs?.transaction?.protection || {}),
  };
  const warnings: string[] = [];
  if (protection.fundsMode !== "escrow") {
    warnings.push("El DV registra el acuerdo, pero el dinero no está en custodia.");
  }
  if (!protection.refundRailConnected) {
    warnings.push("El reembolso requiere confirmación del Cajero o medio de pago.");
  }
  return {
    state,
    progress: PROGRESS[state],
    label: LABELS[state],
    paused: ["refund_requested", "refund_approved", "disputed"].includes(state),
    terminal: ["completed", "refunded", "resolved", "cancelled"].includes(state),
    protection,
    refundGuaranteed:
      protection.fundsMode === "escrow" && protection.refundRailConnected,
    lastEvent,
    history: deduped,
    warnings,
  };
}

export function transactionLabel(state: TransactionState) {
  return LABELS[state];
}
