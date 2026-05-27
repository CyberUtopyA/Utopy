// ============================================
// FILE: src/mt/mt.liquidity.ts
// ============================================

export type DVLike = {
  id: string;
  kind: string;
  ts?: number;
  traits?: string[];
  meta?: Record<string, any>;
  attrs?: Record<string, any>;
  labels?: string[];
};

export type LiquidityStatus =
  | "draft"
  | "issued"
  | "redeemed"
  | "transferred"
  | "locked"
  | "unlocked"
  | "active"
  | "closed"
  | "rejected"
  | "expired";

export type LiquidityTrustLevel = "low" | "medium" | "high";

export type LiquidityCounterpartyTrust = {
  actorId: string;
  counterpartyId: string;
  score: number;
  samples: number;
  level: LiquidityTrustLevel;
  updatedAt: number;
  lastReason?: string;
};

export type LiquidityLedgerEntry = {
  id: string;
  kind: LiquidityKind;
  actorId: string;
  counterpartyId?: string;
  amount: number;
  currency: string;
  ts: number;
  status?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  liquidityId?: string;
  raw?: DVLike;
};

export type LiquidityAccountSummary = {
  actorId: string;
  currency: string;
  issued: number;
  redeemed: number;
  transferredIn: number;
  transferredOut: number;
  locked: number;
  unlocked: number;
  creditLine: number;
  available: number;
  reserved: number;
  spendable: number;
  updatedAt: number;
};

export type LiquidityTrustState = {
  actorId: string;
  score: number;
  samples: number;
  level: LiquidityTrustLevel;
  updatedAt: number;
  lastReason?: string;
};

export type LiquidityThreadSummary = {
  threadId: string;
  currency: string;
  totalIssue: number;
  totalRedeem: number;
  totalTransfer: number;
  totalLocked: number;
  updatedAt: number;
  entries: LiquidityLedgerEntry[];
};

export type LiquidityIssueInput = {
  amount: number;
  currency?: string;
  issuerId: string;
  issuerName?: string;
  beneficiaryId: string;
  beneficiaryName?: string;
  buyerId?: string;
  buyerName?: string;
  sellerId?: string;
  sellerName?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  reason?: string;
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityRedeemInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  buyerId?: string;
  buyerName?: string;
  sellerId?: string;
  sellerName?: string;
  issuerId?: string;
  beneficiaryId?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  liquidityId?: string;
  reason?: string;
  redeemTarget?: "order" | "cashout" | "service" | "transfer";
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityTransferInput = {
  amount: number;
  currency?: string;
  fromActorId: string;
  fromActorName?: string;
  toActorId: string;
  toActorName?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  reason?: string;
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityLockInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  reason?: string;
  lockTarget?: "order" | "escrow" | "reservation" | "fabrication";
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityUnlockInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  lockId?: string;
  reason?: string;
  unlockTarget?: "order" | "escrow" | "reservation" | "fabrication";
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityCreditLineInput = {
  actorId: string;
  actorName?: string;
  amountMax: number;
  currency?: string;
  issuerId: string;
  issuerName?: string;
  threadId?: string;
  orderId?: string;
  sessionId?: string;
  reason?: string;
  scopeId?: string;
  trustScore?: number;
  ttlMs?: number;
  pinned?: boolean;
  sourceKind?: string;
  sourceId?: string;
};

export type LiquidityTrustInput = {
  actorId: string;
  actorName?: string;
  trustForId?: string;
  trustForName?: string;
  scoreDelta: number;
  reason: string;
  basedOnKind?: string;
  basedOnId?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  scopeId?: string;
  evidence?: string[];
  ttlMs?: number;
  pinned?: boolean;
};
export type LiquidityKind =
  | "liq.issue"
  | "liq.redeem"
  | "liq.trust"
  | "liq.transfer"
  | "liq.lock"
  | "liq.unlock"
  | "liq.credit.line"
  | "liq.escrow.open"
  | "liq.escrow.release"
  | "liq.escrow.refund"
  | "liq.credit.consume"
  | "liq.credit.repay"
  | "liq.settlement.batch";

export type LiquidityEscrowStatus = "open" | "released" | "refunded";

export type LiquidityEscrowInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  orderId?: string;
  sessionId?: string;
  threadId?: string;
  reason: string;
  escrowStatus: LiquidityEscrowStatus;
  scopeId?: string;
  ttlMs?: number;
  pinned?: boolean;
  trustScore?: number;
};

export type LiquidityCreditConsumeInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  orderId?: string;
  sessionId?: string;
  reason: string;
  scopeId?: string;
  ttlMs?: number;
  pinned?: boolean;
  trustScore?: number;
};

export type LiquidityCreditRepayInput = {
  amount: number;
  currency?: string;
  actorId: string;
  actorName?: string;
  orderId?: string;
  sessionId?: string;
  reason: string;
  scopeId?: string;
  ttlMs?: number;
  pinned?: boolean;
  trustScore?: number;
};

export type LiquiditySettlementBatchInput = {
  amount: number;
  currency?: string;
  actorId: string;
  trustScore?: number;
  actorName?: string;
  reason: string;
  batchId: string;
  scopeId?: string;
  ttlMs?: number;
  pinned?: boolean;
};

export function buildLiquidityEscrowOpenDV(input: LiquidityEscrowInput): DVLike {
  return {
    id: makeId("liq.escrow.open"),
    kind: "liq.escrow.open",
    ts: now(),
    traits: ["mt:liquidity", "mt:escrow", "mt:market"],
    labels: ["Escrow abierto"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.escrow.open.v1",
    }),
    attrs: {
      status: "open",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      reason: input.reason,
      escrowStatus: input.escrowStatus,
    },
  };
}

export function buildLiquidityEscrowReleaseDV(input: LiquidityEscrowInput): DVLike {
  return {
    id: makeId("liq.escrow.release"),
    kind: "liq.escrow.release",
    ts: now(),
    traits: ["mt:liquidity", "mt:escrow", "mt:market"],
    labels: ["Escrow liberado"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.escrow.release.v1",
    }),
    attrs: {
      status: "released",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      reason: input.reason,
    },
  };
}

export function buildLiquidityEscrowRefundDV(input: LiquidityEscrowInput): DVLike {
  return {
    id: makeId("liq.escrow.refund"),
    kind: "liq.escrow.refund",
    ts: now(),
    traits: ["mt:liquidity", "mt:escrow", "mt:market"],
    labels: ["Escrow reembolsado"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.escrow.refund.v1",
    }),
    attrs: {
      status: "refunded",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      reason: input.reason,
    },
  };
}

export function buildLiquidityCreditConsumeDV(input: LiquidityCreditConsumeInput): DVLike {
  return {
    id: makeId("liq.credit.consume"),
    kind: "liq.credit.consume",
    ts: now(),
    traits: ["mt:liquidity", "mt:credit.consume", "mt:market"],
    labels: ["Crédito consumido"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.credit.consume.v1",
    }),
    attrs: {
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      reason: input.reason,
    },
  };
}

export function buildLiquidityCreditRepayDV(input: LiquidityCreditRepayInput): DVLike {
  return {
    id: makeId("liq.credit.repay"),
    kind: "liq.credit.repay",
    ts: now(),
    traits: ["mt:liquidity", "mt:credit.repay", "mt:market"],
    labels: ["Crédito repago"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.credit.repay.v1",
    }),
    attrs: {
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      reason: input.reason,
    },
  };
}

export function buildLiquiditySettlementBatchDV(input: LiquiditySettlementBatchInput): DVLike {
  return {
    id: makeId("liq.settlement.batch"),
    kind: "liq.settlement.batch",
    ts: now(),
    traits: ["mt:liquidity", "mt:settlement", "mt:market"],
    labels: ["Lote de liquidación"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.settlement.batch.v1",
    }),
    attrs: {
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      batchId: input.batchId,
      reason: input.reason,
    },
  };
}

export const LIQ_NS = "mt:liquidity";

export function now() {
  return Date.now();
}

export function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export function asCurrency(v?: string) {
  return String(v || "PYG").toUpperCase();
}

export function makeId(prefix: string) {
  return `${prefix}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function trustLevel(score: number): LiquidityTrustLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function makeThreadId(input: {
  buyerId?: string;
  sellerId?: string;
  actorId?: string;
  counterpartyId?: string;
  sessionId?: string;
  orderId?: string;
}) {
  const a = input.buyerId || input.actorId || "actor:a";
  const b = input.sellerId || input.counterpartyId || "actor:b";
  const c = input.sessionId || input.orderId || String(now());
  return `mt.thread.liquidity:${a}:${b}:${c}`;
}

function buildBaseMeta(input: {
  scopeId?: string;
  ttlMs?: number;
  pinned?: boolean;
  by?: string;
  trustScore?: number;
  schema: string;
}) {
  return {
    ns: LIQ_NS,
    scopes: input.scopeId ? ["public", `world:${input.scopeId}`] : ["public"],
    ttl_ms: input.ttlMs ?? 1000 * 60 * 60 * 24 * 30,
    pinned: input.pinned ?? false,
    by: input.by || "mt:system",
    trustScore: clamp(safeNum(input.trustScore, 0.6)),
    schema: input.schema,
  };
}

export function buildLiquidityIssueDV(input: LiquidityIssueInput): DVLike {
  const threadId =
    input.threadId ||
    makeThreadId({
      buyerId: input.buyerId,
      sellerId: input.sellerId || input.beneficiaryId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    });

  return {
    id: makeId("liq.issue"),
    kind: "liq.issue",
    ts: now(),
    traits: ["mt:liquidity", "mt:wallet.credit", "mt:market"],
    labels: ["Liquidez emitida"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.issuerId,
      trustScore: input.trustScore,
      schema: "utopy.liq.issue.v2",
    }),
    attrs: {
      status: "issued",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      issuer: { id: input.issuerId, name: input.issuerName || input.issuerId },
      beneficiary: {
        id: input.beneficiaryId,
        name: input.beneficiaryName || input.beneficiaryId,
      },
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      sellerId: input.sellerId,
      sellerName: input.sellerName,
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId,
      reason: input.reason || "payment.accepted",
      source: {
        kind: input.sourceKind || "payment.session.status",
        id: input.sourceId || input.sessionId || input.orderId,
      },
    },
  };
}

export function buildLiquidityRedeemDV(input: LiquidityRedeemInput): DVLike {
  const threadId =
    input.threadId ||
    makeThreadId({
      actorId: input.actorId,
      counterpartyId: input.sellerId || input.beneficiaryId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    });

  return {
    id: makeId("liq.redeem"),
    kind: "liq.redeem",
    ts: now(),
    traits: ["mt:liquidity", "mt:wallet.debit", "mt:market"],
    labels: ["Liquidez redimida"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.redeem.v2",
    }),
    attrs: {
      status: "redeemed",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      sellerId: input.sellerId,
      sellerName: input.sellerName,
      issuerId: input.issuerId,
      beneficiaryId: input.beneficiaryId,
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId,
      liquidityId: input.liquidityId,
      redeemTarget: input.redeemTarget || "order",
      reason: input.reason || "checkout.consume",
      source: {
        kind: input.sourceKind || "checkout",
        id: input.sourceId || input.orderId || input.sessionId,
      },
    },
  };
}

export function buildLiquidityTransferDV(input: LiquidityTransferInput): DVLike {
  const threadId =
    input.threadId ||
    makeThreadId({
      actorId: input.fromActorId,
      counterpartyId: input.toActorId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    });

  return {
    id: makeId("liq.transfer"),
    kind: "liq.transfer",
    ts: now(),
    traits: ["mt:liquidity", "mt:wallet.transfer", "mt:market"],
    labels: ["Liquidez transferida"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.fromActorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.transfer.v1",
    }),
    attrs: {
      status: "transferred",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      from: { id: input.fromActorId, name: input.fromActorName || input.fromActorId },
      to: { id: input.toActorId, name: input.toActorName || input.toActorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId,
      reason: input.reason || "wallet.transfer",
      source: {
        kind: input.sourceKind || "wallet",
        id: input.sourceId || input.orderId || input.sessionId,
      },
    },
  };
}

export function buildLiquidityLockDV(input: LiquidityLockInput): DVLike {
  const threadId =
    input.threadId ||
    makeThreadId({
      actorId: input.actorId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    });

  return {
    id: makeId("liq.lock"),
    kind: "liq.lock",
    ts: now(),
    traits: ["mt:liquidity", "mt:wallet.lock", "mt:market"],
    labels: ["Liquidez bloqueada"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.lock.v1",
    }),
    attrs: {
      status: "locked",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId,
      lockTarget: input.lockTarget || "order",
      reason: input.reason || "funds.reserved",
      source: {
        kind: input.sourceKind || "wallet",
        id: input.sourceId || input.orderId || input.sessionId,
      },
    },
  };
}

export function buildLiquidityUnlockDV(input: LiquidityUnlockInput): DVLike {
  const threadId =
    input.threadId ||
    makeThreadId({
      actorId: input.actorId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    });

  return {
    id: makeId("liq.unlock"),
    kind: "liq.unlock",
    ts: now(),
    traits: ["mt:liquidity", "mt:wallet.unlock", "mt:market"],
    labels: ["Liquidez desbloqueada"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs,
      pinned: input.pinned,
      by: input.actorId,
      trustScore: input.trustScore,
      schema: "utopy.liq.unlock.v1",
    }),
    attrs: {
      status: "unlocked",
      amount: safeNum(input.amount),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId,
      lockId: input.lockId,
      unlockTarget: input.unlockTarget || "order",
      reason: input.reason || "funds.released",
      source: {
        kind: input.sourceKind || "wallet",
        id: input.sourceId || input.orderId || input.sessionId,
      },
    },
  };
}

export function buildLiquidityCreditLineDV(input: LiquidityCreditLineInput): DVLike {
  return {
    id: makeId("liq.credit.line"),
    kind: "liq.credit.line",
    ts: now(),
    traits: ["mt:liquidity", "mt:credit.line", "mt:market"],
    labels: ["Línea de crédito"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs ?? 1000 * 60 * 60 * 24 * 90,
      pinned: input.pinned ?? false,
      by: input.issuerId,
      trustScore: input.trustScore,
      schema: "utopy.liq.credit.line.v1",
    }),
    attrs: {
      status: "active",
      amountMax: safeNum(input.amountMax),
      currency: asCurrency(input.currency),
      actor: { id: input.actorId, name: input.actorName || input.actorId },
      issuer: { id: input.issuerId, name: input.issuerName || input.issuerId },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      reason: input.reason || "trust.credit.line",
      source: {
        kind: input.sourceKind || "trust",
        id: input.sourceId || input.orderId || input.sessionId,
      },
    },
  };
}

export function buildLiquidityTrustDV(input: LiquidityTrustInput): DVLike {
  return {
    id: makeId("liq.trust"),
    kind: "liq.trust",
    ts: now(),
    traits: ["mt:liquidity", "mt:trust", "mt:reputation", "mt:market"],
    labels: ["Trust actualizado"],
    meta: buildBaseMeta({
      scopeId: input.scopeId,
      ttlMs: input.ttlMs ?? 1000 * 60 * 60 * 24 * 90,
      pinned: input.pinned ?? false,
      by: input.actorId,
      schema: "utopy.liq.trust.v2",
    }),
    attrs: {
      actorId: input.actorId,
      actorName: input.actorName,
      trustForId: input.trustForId,
      trustForName: input.trustForName,
      scoreDelta: safeNum(input.scoreDelta),
      reason: input.reason,
      basedOn: {
        kind: input.basedOnKind,
        id: input.basedOnId,
      },
      orderId: input.orderId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      evidence: input.evidence || [],
    },
  };
}

export function isLiquidityDV(dv: DVLike | null | undefined): dv is DVLike {
  const kind = dv?.kind;
  return (
    kind === "liq.issue" ||
    kind === "liq.redeem" ||
    kind === "liq.trust" ||
    kind === "liq.transfer" ||
    kind === "liq.lock" ||
    kind === "liq.unlock" ||
    kind === "liq.credit.line" ||
    kind === "liq.escrow.open" ||
    kind === "liq.escrow.release" ||
    kind === "liq.escrow.refund" ||
    kind === "liq.credit.consume" ||
    kind === "liq.credit.repay" ||
    kind === "liq.settlement.batch"
  );
}

export function getLiquidityCurrency(dv: DVLike): string {
  return asCurrency(dv?.attrs?.currency || "PYG");
}

export function getLiquidityThreadId(dv: DVLike): string | undefined {
  return dv?.attrs?.threadId;
}

export function getLiquidityOrderId(dv: DVLike): string | undefined {
  return dv?.attrs?.orderId;
}

export function getLiquiditySessionId(dv: DVLike): string | undefined {
  return dv?.attrs?.sessionId;
}

export function getActorIdsForDV(dv: DVLike): string[] {
  const a = dv?.attrs || {};
  const ids = new Set<string>();

  if (a?.actor?.id) ids.add(a.actor.id);
  if (a?.beneficiary?.id) ids.add(a.beneficiary.id);
  if (a?.issuer?.id) ids.add(a.issuer.id);
  if (a?.from?.id) ids.add(a.from.id);
  if (a?.to?.id) ids.add(a.to.id);

  if (a?.actorId) ids.add(a.actorId);
  if (a?.trustForId) ids.add(a.trustForId);
  if (a?.buyerId) ids.add(a.buyerId);
  if (a?.sellerId) ids.add(a.sellerId);
  if (a?.issuerId) ids.add(a.issuerId);
  if (a?.beneficiaryId) ids.add(a.beneficiaryId);

  return [...ids].filter(Boolean);
}
export function extractPrimaryActorId(dv: DVLike): string | undefined {
  const a = dv?.attrs || {};
  if (dv.kind === "liq.issue") return a?.beneficiary?.id || a?.beneficiaryId || a?.sellerId || a?.buyerId;
  if (dv.kind === "liq.redeem") return a?.actor?.id || a?.actorId || a?.buyerId || a?.sellerId;
  if (dv.kind === "liq.transfer") return a?.from?.id;
  if (dv.kind === "liq.lock") return a?.actor?.id;
  if (dv.kind === "liq.unlock") return a?.actor?.id;
  if (dv.kind === "liq.credit.line") return a?.actor?.id;
  if (dv.kind === "liq.trust") return a?.actorId;
  if (
    dv.kind === "liq.escrow.open" ||
    dv.kind === "liq.escrow.release" ||
    dv.kind === "liq.escrow.refund" ||
    dv.kind === "liq.credit.consume" ||
    dv.kind === "liq.credit.repay" ||
    dv.kind === "liq.settlement.batch"
  ) {
    return a?.actor?.id || a?.actorId;
  }
  return undefined;
}

export function extractCounterpartyId(dv: DVLike): string | undefined {
  const a = dv?.attrs || {};
  if (dv.kind === "liq.issue") return a?.issuer?.id || a?.buyerId;
  if (dv.kind === "liq.redeem") return a?.sellerId || a?.beneficiaryId || a?.issuerId;
  if (dv.kind === "liq.transfer") return a?.to?.id;
  if (dv.kind === "liq.trust") return a?.trustForId;
  return undefined;
}

export function toLedgerEntries(dv: DVLike): LiquidityLedgerEntry[] {
  if (!isLiquidityDV(dv)) return [];

  const ts = safeNum(dv.ts, now());
  const currency = getLiquidityCurrency(dv);
  const a = dv.attrs || {};

  if (dv.kind === "liq.transfer") {
    const fromId = a?.from?.id;
    const toId = a?.to?.id;
    const amount = safeNum(a.amount);

    const out: LiquidityLedgerEntry[] = [];

    if (fromId) {
      out.push({
        id: `${dv.id}:out`,
        kind: dv.kind,
        actorId: fromId,
        counterpartyId: toId,
        amount: -Math.abs(amount),
        currency,
        ts,
        status: a.status,
        orderId: a.orderId,
        sessionId: a.sessionId,
        threadId: a.threadId,
        raw: dv,
      });
    }

    if (toId) {
      out.push({
        id: `${dv.id}:in`,
        kind: dv.kind,
        actorId: toId,
        counterpartyId: fromId,
        amount: Math.abs(amount),
        currency,
        ts,
        status: a.status,
        orderId: a.orderId,
        sessionId: a.sessionId,
        threadId: a.threadId,
        raw: dv,
      });
    }

    return out;
  }

  if (dv.kind === "liq.issue") {
    const actorId = extractPrimaryActorId(dv);
    if (!actorId) return [];
    return [{
      id: dv.id,
      kind: dv.kind,
      actorId,
      counterpartyId: extractCounterpartyId(dv),
      amount: Math.abs(safeNum(a.amount)),
      currency,
      ts,
      status: a.status,
      orderId: a.orderId,
      sessionId: a.sessionId,
      threadId: a.threadId,
      raw: dv,
    }];
  }

  if (dv.kind === "liq.redeem") {
    const actorId = extractPrimaryActorId(dv);
    if (!actorId) return [];
    return [{
      id: dv.id,
      kind: dv.kind,
      actorId,
      counterpartyId: extractCounterpartyId(dv),
      amount: -Math.abs(safeNum(a.amount)),
      currency,
      ts,
      status: a.status,
      orderId: a.orderId,
      sessionId: a.sessionId,
      threadId: a.threadId,
      liquidityId: a.liquidityId,
      raw: dv,
    }];
  }

  if (dv.kind === "liq.lock") {
    const actorId = extractPrimaryActorId(dv);
    if (!actorId) return [];
    return [{
      id: dv.id,
      kind: dv.kind,
      actorId,
      amount: Math.abs(safeNum(a.amount)),
      currency,
      ts,
      status: a.status,
      orderId: a.orderId,
      sessionId: a.sessionId,
      threadId: a.threadId,
      raw: dv,
    }];
  }

  if (dv.kind === "liq.unlock") {
    const actorId = extractPrimaryActorId(dv);
    if (!actorId) return [];
    return [{
      id: dv.id,
      kind: dv.kind,
      actorId,
      amount: Math.abs(safeNum(a.amount)),
      currency,
      ts,
      status: a.status,
      orderId: a.orderId,
      sessionId: a.sessionId,
      threadId: a.threadId,
      raw: dv,
    }];
  }

  if (dv.kind === "liq.credit.line") {
    const actorId = extractPrimaryActorId(dv);
    if (!actorId) return [];
    return [{
      id: dv.id,
      kind: dv.kind,
      actorId,
      counterpartyId: extractCounterpartyId(dv),
      amount: Math.abs(safeNum(a.amountMax)),
      currency,
      ts,
      status: a.status,
      orderId: a.orderId,
      sessionId: a.sessionId,
      threadId: a.threadId,
      raw: dv,
    }];
  }

  return [];
}

export function reduceTrustForActor(actorId: string, dvs: DVLike[]): LiquidityTrustState {
  let score = 0.5;
  let samples = 0;
  let updatedAt = 0;
  let lastReason = "";

  for (const dv of dvs) {
    if (dv.kind !== "liq.trust") continue;
    if (dv?.attrs?.actorId !== actorId) continue;
    const delta = safeNum(dv.attrs?.scoreDelta);
    score = clamp(score + delta, 0, 1);
    samples += 1;
    updatedAt = Math.max(updatedAt, safeNum(dv.ts));
    lastReason = String(dv.attrs?.reason || lastReason || "");
  }

  return {
    actorId,
    score,
    samples,
    level: trustLevel(score),
    updatedAt,
    lastReason,
  };
}

export function reduceTrustByCounterparty(
  actorId: string,
  counterpartyId: string,
  dvs: DVLike[]
): LiquidityCounterpartyTrust {
  let score = 0.5;
  let samples = 0;
  let updatedAt = 0;
  let lastReason = "";

  for (const dv of dvs) {
    if (dv.kind !== "liq.trust") continue;
    const a = dv.attrs || {};
    if (a.actorId !== actorId) continue;
    if ((a.trustForId || "") !== counterpartyId) continue;
    const delta = safeNum(a.scoreDelta);
    score = clamp(score + delta, 0, 1);
    samples += 1;
    updatedAt = Math.max(updatedAt, safeNum(dv.ts));
    lastReason = String(a.reason || lastReason || "");
  }

  return {
    actorId,
    counterpartyId,
    score,
    samples,
    level: trustLevel(score),
    updatedAt,
    lastReason,
  };
}

export function reduceAccountSummary(
  actorId: string,
  currency: string,
  dvs: DVLike[]
): LiquidityAccountSummary {
  const cur = asCurrency(currency);

  let issued = 0;
  let redeemed = 0;
  let transferredIn = 0;
  let transferredOut = 0;
  let locked = 0;
  let unlocked = 0;
  let creditLine = 0;
  let updatedAt = 0;

  for (const dv of dvs) {
    if (!isLiquidityDV(dv)) continue;
    if (dv.kind === "liq.trust") continue;
    if (getLiquidityCurrency(dv) !== cur) continue;

    const entries = toLedgerEntries(dv);
    for (const e of entries) {
      if (e.actorId !== actorId) continue;
      updatedAt = Math.max(updatedAt, e.ts);

      if (e.kind === "liq.issue") issued += Math.abs(e.amount);
      if (e.kind === "liq.redeem") redeemed += Math.abs(e.amount);
      if (e.kind === "liq.transfer") {
        if (e.amount >= 0) transferredIn += Math.abs(e.amount);
        else transferredOut += Math.abs(e.amount);
      }
      if (e.kind === "liq.lock") locked += Math.abs(e.amount);
      if (e.kind === "liq.unlock") unlocked += Math.abs(e.amount);
      if (e.kind === "liq.credit.line") creditLine += Math.abs(e.amount);
    }
  }

  const available = issued + transferredIn + creditLine - redeemed - transferredOut;
  const reserved = Math.max(0, locked - unlocked);
  const spendable = Math.max(0, available - reserved);

  return {
    actorId,
    currency: cur,
    issued,
    redeemed,
    transferredIn,
    transferredOut,
    locked,
    unlocked,
    creditLine,
    available: Math.max(0, available),
    reserved,
    spendable,
    updatedAt,
  };
}

export function reduceThreadSummary(
  threadId: string,
  currency: string,
  dvs: DVLike[]
): LiquidityThreadSummary {
  const cur = asCurrency(currency);
  const entries = dvs
    .filter((dv) => isLiquidityDV(dv) && dv.kind !== "liq.trust")
    .filter((dv) => getLiquidityThreadId(dv) === threadId)
    .filter((dv) => getLiquidityCurrency(dv) === cur)
    .flatMap((dv) => toLedgerEntries(dv))
    .sort((a, b) => b.ts - a.ts);

  let totalIssue = 0;
  let totalRedeem = 0;
  let totalTransfer = 0;
  let totalLocked = 0;
  let updatedAt = 0;

  for (const e of entries) {
    updatedAt = Math.max(updatedAt, e.ts);
    if (e.kind === "liq.issue") totalIssue += Math.abs(e.amount);
    if (e.kind === "liq.redeem") totalRedeem += Math.abs(e.amount);
    if (e.kind === "liq.transfer") totalTransfer += Math.abs(e.amount);
    if (e.kind === "liq.lock") totalLocked += Math.abs(e.amount);
  }

  return {
    threadId,
    currency: cur,
    totalIssue,
    totalRedeem,
    totalTransfer,
    totalLocked,
    updatedAt,
    entries,
  };
}

export function shouldIssueLiquidityFromPaymentStatus(dv: DVLike): boolean {
  if (!dv || dv.kind !== "payment.session.status") return false;
  const st = String(dv.attrs?.status || "").toLowerCase();
  return st === "paid" || st === "accepted" || st === "settled" || st === "confirmed";
}

export function issueFromPaymentStatus(dv: DVLike): DVLike | null {
  if (!shouldIssueLiquidityFromPaymentStatus(dv)) return null;
  const a = dv.attrs || {};
  const amount = safeNum(a.amount);
  if (amount <= 0) return null;

  const sellerId = a.sellerId || a.assignment?.sellerId || a.assignedTo;
  if (!sellerId) return null;

  return buildLiquidityIssueDV({
    amount,
    currency: a.currency || "PYG",
    issuerId: "mt.liquidity.bot",
    issuerName: "UTOPY Liquidity",
    beneficiaryId: sellerId,
    beneficiaryName: a.sellerName || sellerId,
    buyerId: a.buyerId,
    buyerName: a.buyerName,
    sellerId,
    sellerName: a.sellerName,
    orderId: a.orderId || a.order?.id,
    sessionId: a.sessionId || a.paymentSessionId || a.session?.id || dv.id,
    threadId: a.threadId || a.order?.threadId,
    reason: `payment.${String(a.status || "accepted").toLowerCase()}`,
    sourceKind: dv.kind,
    sourceId: dv.id,
    trustScore: 0.7,
  });
}

export function trustFromPaymentStatus(dv: DVLike): DVLike[] {
  if (!dv || dv.kind !== "payment.session.status") return [];
  const a = dv.attrs || {};
  const st = String(a.status || "").toLowerCase();

  const buyerId = a.buyerId || a.assignment?.buyerId;
  const sellerId = a.sellerId || a.assignment?.sellerId || a.assignedTo;
  const orderId = a.orderId || a.order?.id;
  const sessionId = a.sessionId || a.paymentSessionId || a.session?.id || dv.id;
  const threadId = a.threadId || a.order?.threadId;

  const out: DVLike[] = [];

  if (sellerId && ["paid", "accepted", "settled", "confirmed"].includes(st)) {
    out.push(
      buildLiquidityTrustDV({
        actorId: sellerId,
        actorName: a.sellerName,
        trustForId: buyerId,
        trustForName: a.buyerName,
        scoreDelta: 0.06,
        reason: "payment.accepted",
        basedOnKind: dv.kind,
        basedOnId: dv.id,
        orderId,
        sessionId,
        threadId,
      })
    );
  }

  if (buyerId && ["paid", "accepted", "settled", "confirmed"].includes(st)) {
    out.push(
      buildLiquidityTrustDV({
        actorId: buyerId,
        actorName: a.buyerName,
        trustForId: sellerId,
        trustForName: a.sellerName,
        scoreDelta: 0.03,
        reason: "payment.completed",
        basedOnKind: dv.kind,
        basedOnId: dv.id,
        orderId,
        sessionId,
        threadId,
      })
    );
  }

  if (sellerId && ["rejected", "failed", "disputed"].includes(st)) {
    out.push(
      buildLiquidityTrustDV({
        actorId: sellerId,
        actorName: a.sellerName,
        trustForId: buyerId,
        trustForName: a.buyerName,
        scoreDelta: -0.08,
        reason: `payment.${st}`,
        basedOnKind: dv.kind,
        basedOnId: dv.id,
        orderId,
        sessionId,
        threadId,
      })
    );
  }

  return out;
}