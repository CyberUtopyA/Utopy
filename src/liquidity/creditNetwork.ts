import { publishAuthorizedDV, verifyAuthorizedDV } from "../utopy/authorizedPublish";
import { collectRelationshipSnapshots } from "../utopy/relationshipProtocol";
import { normalizeNodeKey } from "../mt/liveCatalog.sources";

export type CreditOfferInput = {
  financeNodeId: string;
  financeNodeName?: string | null;
  currency: string;
  minAmount: number;
  maxAmount: number;
  allowedInstallments: number[];
  territory?: string | string[] | null;
  eligiblePurposes?: string[];
  downPaymentRules?: {
    minimumAmount?: number | null;
    minimumPct?: number | null;
  } | null;
  conditions?: string[];
  relationshipRequirements?: {
    required?: boolean;
    capability?: string | null;
  } | null;
  validFrom?: string | null;
  validUntil?: string | null;
  offerId?: string | null;
};

export type CreditRequestInput = {
  requestId?: string | null;
  buyerActorId: string;
  sellerNodeId: string;
  requestedFinanceNodeId?: string | null;
  selectedOfferId?: string | null;
  orderId: string;
  chainId: string;
  threadId: string;
  relationshipId: string;
  amount: number;
  currency: string;
  installmentPreference: number;
  downPayment: number;
  purpose: string;
  territory?: string | null;
  productId?: string | null;
  workId?: string | null;
  proofRefs?: string[];
  linkId?: string | null;
};

export type CreditDecisionProjection = {
  decisionId: string;
  requestId: string;
  status: "approved" | "review" | "rejected";
  message: string | null;
  financeNodeId: string;
  approvedTerms: Record<string, any> | null;
  source: any;
};

export type CreditMatch = {
  offerId: string;
  financeNodeId: string;
  financeNodeName: string;
  currency: string;
  installmentCount: number;
  minAmount: number;
  maxAmount: number;
  downPaymentMinimum: number;
  habitualRelationship: boolean;
  relationshipId: string | null;
  conditions: string[];
  source: any;
};

function text(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function amount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function uniqueNumbers(values: unknown[]) {
  return Array.from(
    new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0)),
  ).sort((a, b) => a - b);
}

function uniqueText(values: unknown[]) {
  return Array.from(new Set(values.flat(3).map(text).filter(Boolean)));
}

function uid(prefix: string) {
  return `${prefix}:${typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`}`;
}

function validNow(attrs: any, now = Date.now()) {
  const from = attrs?.validFrom ? Date.parse(String(attrs.validFrom)) : 0;
  const until = attrs?.validUntil ? Date.parse(String(attrs.validUntil)) : Number.POSITIVE_INFINITY;
  return (!Number.isFinite(from) || from <= now) && (!Number.isFinite(until) || until > now);
}

function hasCanonicalNodeForm(value: unknown) {
  return /^(?:did:utopy:|utopy[.:/_-]*node[.:/_-]*|node[.:/_-]+)/i.test(text(value));
}

function sameNodeIdentity(left: unknown, right: unknown) {
  const a = text(left).toLowerCase();
  const b = text(right).toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (!hasCanonicalNodeForm(a) && !hasCanonicalNodeForm(b)) return false;
  return normalizeNodeKey(a) === normalizeNodeKey(b);
}

function territoryMatches(offerTerritory: unknown, requestTerritory: unknown) {
  const wanted = text(requestTerritory).toLowerCase();
  const offered = uniqueText(Array.isArray(offerTerritory) ? offerTerritory : [offerTerritory])
    .map((value) => value.toLowerCase());
  if (!offered.length || offered.includes("*") || offered.includes("any")) return true;
  if (!wanted) return false;
  return offered.some((value) => wanted === value || wanted.includes(value) || value.includes(wanted));
}

function purposeMatches(eligiblePurposes: unknown, purpose: string) {
  const allowed = uniqueText(Array.isArray(eligiblePurposes) ? eligiblePurposes : [eligiblePurposes])
    .map((value) => value.toLowerCase());
  if (!allowed.length || allowed.includes("*") || allowed.includes("any")) return true;
  const wanted = purpose.toLowerCase();
  return allowed.some((value) => wanted === value || wanted.includes(value));
}

export function buildCreditOfferDV(input: CreditOfferInput) {
  const nodeId = text(input.financeNodeId);
  const currency = text(input.currency).toUpperCase();
  const installments = uniqueNumbers(input.allowedInstallments || []);
  if (!nodeId || !currency || !installments.length) {
    throw new Error("La oferta necesita nodo financiero, moneda y cuotas permitidas.");
  }
  const minAmount = amount(input.minAmount);
  const maxAmount = amount(input.maxAmount);
  if (maxAmount <= 0 || maxAmount < minAmount) {
    throw new Error("El rango público de financiación no es válido.");
  }
  const ts = new Date().toISOString();
  const offerId = input.offerId || uid("credit.offer");
  return {
    id: offerId,
    kind: "credit.offer",
    attrs: {
      offerId,
      financeNodeId: nodeId,
      financeNodeName: input.financeNodeName || nodeId,
      authority: nodeId,
      currency,
      minAmount,
      maxAmount,
      allowedInstallments: installments,
      territory: input.territory || null,
      eligiblePurposes: uniqueText(input.eligiblePurposes || ["any"]),
      downPaymentRules: {
        minimumAmount: amount(input.downPaymentRules?.minimumAmount),
        minimumPct: Math.min(100, amount(input.downPaymentRules?.minimumPct)),
      },
      conditions: uniqueText(input.conditions || []),
      relationshipRequirements: {
        required: input.relationshipRequirements?.required === true,
        capability: text(input.relationshipRequirements?.capability) || null,
      },
      validFrom: input.validFrom || ts,
      validUntil: input.validUntil || null,
      status: "available",
      approvalRequired: true,
      automaticApproval: false,
      privateRiskRulesIncluded: false,
    },
    traits: ["mt:credit", "finance:credit:offer", "resonance:capable", "consent:required"],
    labels: ["Financiación disponible", input.financeNodeName || nodeId],
    meta: {
      ns: "mt:finance",
      ts,
      updatedAt: ts,
      version: 1,
      scopes: ["public"],
      authority: nodeId,
      originNode: nodeId,
      schema: "utopy.credit.offer@1",
      sensitivity: "relationship",
    },
  };
}

export function buildCreditRequestDV(input: CreditRequestInput) {
  const financeNodeId = text(input.requestedFinanceNodeId || input.sellerNodeId);
  const ts = new Date().toISOString();
  const requestId = text(input.requestId) || [
    "credit.request",
    input.orderId,
    financeNodeId,
    input.selectedOfferId || "seller",
    Math.max(1, Math.round(input.installmentPreference)),
  ].map((part) => String(part).replace(/[^a-zA-Z0-9:._-]+/g, "_")).join(":");
  return {
    id: requestId,
    kind: "credit.request",
    attrs: {
      requestId,
      buyerActorId: input.buyerActorId,
      buyerId: input.buyerActorId,
      sellerNodeId: input.sellerNodeId,
      sellerId: input.sellerNodeId,
      financeNodeId,
      requestedFinanceNodeId: financeNodeId,
      selectedOfferId: input.selectedOfferId || null,
      orderId: input.orderId,
      chainId: input.chainId,
      threadId: input.threadId,
      relationshipId: input.relationshipId,
      amount: amount(input.amount),
      principal: amount(input.amount),
      currency: text(input.currency).toUpperCase(),
      installmentPreference: Math.max(1, Math.round(input.installmentPreference)),
      installmentCount: Math.max(1, Math.round(input.installmentPreference)),
      downPayment: amount(input.downPayment),
      downPaymentProposed: amount(input.downPayment),
      purpose: input.purpose,
      territory: input.territory || null,
      productId: input.productId || null,
      workId: input.workId || null,
      proofRefs: uniqueText(input.proofRefs || []),
      linkId: input.linkId || null,
      status: "requested",
      approvalRequired: true,
      automaticAccountOpening: false,
      participants: uniqueText([
        input.buyerActorId,
        input.sellerNodeId,
        financeNodeId,
      ]),
    },
    traits: ["mt:credit", "finance:request", "resonance:need", "consent:required"],
    meta: {
      ns: "mt:finance",
      ts,
      updatedAt: ts,
      version: 1,
      relationshipId: input.relationshipId,
      chainId: input.chainId,
      threadId: input.threadId,
      targetNodeId: financeNodeId,
      scopes: ["participants"],
      source: "utopy.credit.request",
      sensitivity: "relationship",
    },
  };
}

function decisionTs(dv: any) {
  const parsed = Date.parse(text(dv?.meta?.updatedAt, dv?.attrs?.decidedAt, dv?.meta?.ts));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Proyecta únicamente una decisión firmada que responde a la solicitud exacta.
 * `credit.decision` es el nombre vigente del protocolo y `finance.decision`
 * queda admitido como alias de interoperabilidad, sin relajar autoridad ni refs.
 */
export function projectCreditDecision(input: {
  allLive: any[];
  verifiedIds: Set<string>;
  requestId: string;
  orderId: string;
  chainId: string;
  threadId: string;
  buyerActorId: string;
  sellerNodeId: string;
  financeNodeId: string;
}): CreditDecisionProjection | null {
  const candidates = (Array.isArray(input.allLive) ? input.allLive : [])
    .filter((dv) => ["credit.decision", "finance.decision"].includes(text(dv?.kind)))
    .filter((dv) => input.verifiedIds.has(text(dv?.id)))
    .filter((dv) => {
      const attrs = dv?.attrs || {};
      const authority = text(dv?.meta?.authority, dv?.attrs?.authority);
      const origin = text(dv?.meta?.originNode, dv?.attrs?.sourceNodeId, authority);
      const financeNodeId = text(attrs.financeNodeId, authority);
      return (
        text(attrs.requestId, dv?.meta?.respondsTo) === input.requestId &&
        text(attrs.orderId) === input.orderId &&
        text(attrs.chainId, dv?.meta?.chainId) === input.chainId &&
        text(attrs.threadId, dv?.meta?.threadId) === input.threadId &&
        text(attrs.borrowerActorId, attrs.buyerActorId, attrs.buyerId) === input.buyerActorId &&
        sameNodeIdentity(text(attrs.sellerNodeId, attrs.sellerId), input.sellerNodeId) &&
        sameNodeIdentity(financeNodeId, input.financeNodeId) &&
        sameNodeIdentity(authority, input.financeNodeId) &&
        sameNodeIdentity(origin, input.financeNodeId)
      );
    })
    .sort((a, b) => decisionTs(b) - decisionTs(a));
  const source = candidates[0] || null;
  if (!source) return null;
  const status = text(source?.attrs?.status).toLowerCase();
  if (!["approved", "review", "rejected"].includes(status)) return null;
  return {
    decisionId: text(source?.attrs?.decisionId, source?.id),
    requestId: input.requestId,
    status: status as CreditDecisionProjection["status"],
    message: text(source?.attrs?.message, source?.attrs?.publicMessage) || null,
    financeNodeId: text(source?.attrs?.financeNodeId, source?.meta?.authority),
    approvedTerms:
      status === "approved" && source?.attrs?.approvedTerms && typeof source.attrs.approvedTerms === "object"
        ? source.attrs.approvedTerms
        : null,
    source,
  };
}

export function buildCreditDecisionDV(input: {
  request: any;
  financeNodeId: string;
  status: "approved" | "review" | "rejected";
  publicMessage?: string | null;
  approvedTerms?: {
    amount: number;
    installmentCount: number;
    installmentValue: number;
    currency: string;
    firstDue?: string | null;
  } | null;
}) {
  const request = input.request?.attrs || {};
  if (input.request?.kind !== "credit.request") {
    throw new Error("La decisión necesita una solicitud de crédito.");
  }
  if (text(request.financeNodeId, request.requestedFinanceNodeId, request.targetNodeId) !== text(input.financeNodeId)) {
    throw new Error("La solicitud está dirigida a otro nodo financiero.");
  }
  if (input.status === "approved" && !input.approvedTerms) {
    throw new Error("Una aprobación necesita términos explícitos.");
  }
  const ts = new Date().toISOString();
  return {
    id: uid(`credit.decision:${input.request.id}`),
    kind: "credit.decision",
    attrs: {
      requestId: input.request.id,
      orderId: request.orderId,
      chainId: request.chainId,
      threadId: request.threadId,
      relationshipId: request.relationshipId,
      borrowerActorId: text(request.buyerActorId, request.buyerId),
      sellerNodeId: text(request.sellerNodeId, request.sellerId),
      financeNodeId: input.financeNodeId,
      status: input.status,
      message: input.publicMessage || null,
      approvedTerms: input.status === "approved" ? input.approvedTerms : null,
      decidedAt: ts,
      automaticDecision: false,
      privateRiskReasonsIncluded: false,
      participants: uniqueText([
        request.buyerActorId,
        request.buyerId,
        request.sellerNodeId,
        request.sellerId,
        input.financeNodeId,
      ]),
    },
    traits: ["mt:credit", "finance:decision", `finance:${input.status}`, "consent:required"],
    meta: {
      ns: "mt:finance",
      ts,
      updatedAt: ts,
      version: 1,
      relationshipId: request.relationshipId,
      chainId: request.chainId,
      threadId: request.threadId,
      scopes: ["participants"],
      authority: input.financeNodeId,
      originNode: input.financeNodeId,
      respondsTo: input.request.id,
      schema: "utopy.credit.decision@1",
      sensitivity: "sensitive",
    },
  };
}

export function findReusableCreditAccount(input: {
  allLive: any[];
  borrowerActorId: string;
  financeNodeId: string;
  relationshipId?: string | null;
  currency?: string | null;
}) {
  return (input.allLive || [])
    .filter((dv) => dv?.kind === "credit.account")
    .filter((dv) => {
      const attrs = dv?.attrs || {};
      return text(attrs.borrowerActorId, attrs.buyerId) === input.borrowerActorId &&
        text(attrs.financeNodeId) === input.financeNodeId &&
        (!input.relationshipId || text(attrs.relationshipId) === input.relationshipId) &&
        (!input.currency || text(attrs.currency).toUpperCase() === text(input.currency).toUpperCase()) &&
        !["closed", "revoked"].includes(text(attrs.status).toLowerCase());
    })
    .sort((a, b) => Date.parse(text(b?.meta?.updatedAt, b?.meta?.ts)) - Date.parse(text(a?.meta?.updatedAt, a?.meta?.ts)))[0] || null;
}

export function buildCreditAccountDV(input: {
  decision: any;
  financeNodeId: string;
  existingAccount?: any | null;
}) {
  const decision = input.decision?.attrs || {};
  if (input.decision?.kind !== "credit.decision" || decision.status !== "approved") {
    throw new Error("Una cuenta de crÃ©dito necesita una decisiÃ³n aprobada.");
  }
  if (text(decision.financeNodeId) !== text(input.financeNodeId)) {
    throw new Error("La decisiÃ³n pertenece a otro nodo financiero.");
  }
  const existing = input.existingAccount?.attrs || {};
  const borrowerActorId = text(decision.borrowerActorId);
  const relationshipId = text(decision.relationshipId);
  const accountId = text(
    existing.accountId,
    input.existingAccount?.id,
    `credit.account:${input.financeNodeId}:${borrowerActorId}:${relationshipId}`,
  );
  const ts = new Date().toISOString();
  return {
    id: accountId,
    kind: "credit.account",
    attrs: {
      ...existing,
      accountId,
      borrowerActorId,
      financeNodeId: input.financeNodeId,
      relationshipId,
      currency: decision.approvedTerms?.currency,
      approvedTerms: decision.approvedTerms,
      status: "active",
      automaticDebitAuthorized: false,
      automaticApproval: false,
      lastDecisionId: input.decision.id,
      participants: [borrowerActorId, input.financeNodeId],
    },
    traits: ["mt:credit", "finance:account", "consent:required"],
    meta: {
      ns: "mt:finance",
      ts: input.existingAccount?.meta?.ts || ts,
      updatedAt: ts,
      version: Number(input.existingAccount?.meta?.version || 0) + 1,
      relationshipId,
      scopes: ["participants"],
      authority: input.financeNodeId,
      originNode: input.financeNodeId,
      respondsTo: input.decision.id,
      schema: "utopy.credit.account@1",
      sensitivity: "sensitive",
    },
  };
}

function structurallyAuthorizedOffer(dv: any) {
  const nodeId = text(dv?.attrs?.financeNodeId);
  return Boolean(
    nodeId &&
      dv?.meta?.ownership?.signature?.value &&
      text(dv?.meta?.authority) === nodeId &&
      text(dv?.attrs?.actingAsNodeId) === nodeId,
  );
}

export function matchCreditOffers(input: {
  allLive: any[];
  amount: number;
  currency: string;
  installmentPreference: number;
  territory?: string | null;
  purpose: string;
  actorId?: string | null;
  requireAuthorized?: boolean;
}): CreditMatch[] {
  const requestedAmount = amount(input.amount);
  const currency = text(input.currency).toUpperCase();
  const relationships = collectRelationshipSnapshots(input.allLive || []);
  return (Array.isArray(input.allLive) ? input.allLive : [])
    .filter((dv) => dv?.kind === "credit.offer")
    .filter((dv) => input.requireAuthorized === false || structurallyAuthorizedOffer(dv))
    .filter((dv) => {
      const attrs = dv.attrs || {};
      return (
        attrs.status !== "closed" &&
        validNow(attrs) &&
        text(attrs.currency).toUpperCase() === currency &&
        requestedAmount >= amount(attrs.minAmount) &&
        requestedAmount <= amount(attrs.maxAmount) &&
        territoryMatches(attrs.territory, input.territory) &&
        purposeMatches(attrs.eligiblePurposes, input.purpose)
      );
    })
    .map((dv): CreditMatch | null => {
      const attrs = dv.attrs || {};
      const financeNodeId = text(attrs.financeNodeId);
      const activeRelationship = relationships.find((relationship) =>
        relationship.status === "active" &&
        relationship.parties.some((party) => text(party.nodeId) === financeNodeId) &&
        (!input.actorId || relationship.parties.some((party) => text(party.actorId) === input.actorId)),
      );
      if (attrs.relationshipRequirements?.required === true && !activeRelationship) return null;
      const allowed = uniqueNumbers(attrs.allowedInstallments || []);
      const preferred = Math.max(1, Math.round(input.installmentPreference || 1));
      const installmentCount = allowed.includes(preferred)
        ? preferred
        : allowed.find((value) => value >= preferred) || allowed[allowed.length - 1];
      const minimumAmount = amount(attrs.downPaymentRules?.minimumAmount);
      const minimumPctAmount = requestedAmount * amount(attrs.downPaymentRules?.minimumPct) / 100;
      return {
        offerId: text(attrs.offerId, dv.id),
        financeNodeId,
        financeNodeName: text(attrs.financeNodeName, financeNodeId),
        currency,
        installmentCount,
        minAmount: amount(attrs.minAmount),
        maxAmount: amount(attrs.maxAmount),
        downPaymentMinimum: Math.max(minimumAmount, minimumPctAmount),
        habitualRelationship: Boolean(activeRelationship),
        relationshipId: activeRelationship?.relationshipId || null,
        conditions: uniqueText(attrs.conditions || []),
        source: dv,
      };
    })
    .filter((match): match is CreditMatch => Boolean(match))
    .sort((a, b) =>
      Number(b.habitualRelationship) - Number(a.habitualRelationship) ||
      b.installmentCount - a.installmentCount ||
      a.financeNodeName.localeCompare(b.financeNodeName),
    );
}

function capabilityStrings(manifest: any) {
  const capabilities = Array.isArray(manifest?.attrs?.capabilities)
    ? manifest.attrs.capabilities
    : [];
  return uniqueText(capabilities.flatMap((capability: any) =>
    typeof capability === "string"
      ? [capability]
      : [capability?.id, capability?.capability, capability?.kind, capability?.domains || []],
  )).map((value) => value.toLowerCase());
}

export async function publishCreditOffer(input: {
  dv: any;
  nodeId: string;
  activeActor?: any;
  allLive?: any[];
}) {
  const allLive = Array.isArray(input.allLive) ? input.allLive : [];
  const manifests = allLive.filter((candidate) =>
    /node\.manifest$/i.test(String(candidate?.kind || "")) &&
    text(candidate?.attrs?.nodeId, candidate?.attrs?.node?.id) === input.nodeId,
  );
  let capable = false;
  for (const manifest of manifests) {
    const proof = await verifyAuthorizedDV(manifest, allLive);
    const capabilities = capabilityStrings(manifest);
    if (
      proof.accepted &&
      proof.proof === "verified" &&
      capabilities.some((capability) =>
        ["credit.offer", "credit.provide", "finance.credit", "finance.credit.offer"]
          .some((wanted) => capability === wanted || capability.startsWith(`${wanted}.`)),
      )
    ) {
      capable = true;
      break;
    }
  }
  if (!capable) {
    throw new Error("El nodo no publicó una capability financiera firmada.");
  }
  return publishAuthorizedDV({
    dv: input.dv,
    allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.nodeId,
    requiredAuthority: input.nodeId,
    action: "credit.offer",
    sensitivity: "relationship",
  });
}

export function publishCreditRequest(input: {
  dv: any;
  financeNodeId: string;
  activeActor?: any;
  allLive?: any[];
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    targetNodeId: input.financeNodeId,
    action: "credit.request",
    sensitivity: "relationship",
  });
}

export function publishCreditDecision(input: {
  dv: any;
  financeNodeId: string;
  targetActorId?: string | null;
  activeActor?: any;
  allLive?: any[];
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.financeNodeId,
    requiredAuthority: input.financeNodeId,
    targetNodeId: input.targetActorId || null,
    action: "credit.decision",
    sensitivity: "sensitive",
  });
}

export function publishCreditAccount(input: {
  dv: any;
  financeNodeId: string;
  targetActorId: string;
  activeActor?: any;
  allLive?: any[];
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.financeNodeId,
    requiredAuthority: input.financeNodeId,
    targetNodeId: input.targetActorId,
    action: "credit.account",
    sensitivity: "sensitive",
  });
}

export async function verifyCreditOffer(dv: any, allLive: any[]) {
  if (dv?.kind !== "credit.offer" || !structurallyAuthorizedOffer(dv)) return false;
  const proof = await verifyAuthorizedDV(dv, allLive);
  return proof.accepted && proof.proof === "verified";
}
