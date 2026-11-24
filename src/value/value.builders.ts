import type {
  ValueComposition,
  ValueContributionInput,
  ValueNeedInput,
} from "./value.types";

const iso = () => new Date().toISOString();

function idPart(value: unknown, fallback = "value") {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function uniqueId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${random}`;
}

export function buildValueNeedDV(input: ValueNeedInput) {
  const ts = iso();
  const nodeId = idPart(input.nodeId, "node:unknown");
  const needKey = idPart(input.needKey, "need");
  const threadId =
    input.threadId || `value.thread:${nodeId}:${needKey}`;

  return {
    id: `value.need:${nodeId}:${needKey}`,
    kind: "value.need",
    attrs: {
      needKey,
      nodeId: input.nodeId,
      nodeName: input.nodeName,
      actorId: input.actorId || input.nodeId,
      actorName: input.actorName || input.nodeName,
      title: input.title,
      purpose: input.purpose,
      requirements: input.requirements.map((item) => ({
        ...item,
        amount: Math.max(0, Number(item.amount || 0)),
      })),
      threadId,
      territoryId: input.territoryId || null,
      location: input.location || null,
      status: "open",
      simulation: input.simulation === true,
      nonTradable: true,
      createdAt: ts,
      updatedAt: ts,
    },
    traits: [
      "utopy:value",
      "value:need",
      "value:symbiotic",
      "value:non-tradable",
      ...input.requirements.map((item) => `value:req:${item.kind}`),
    ],
    labels: ["Necesidad viva", input.nodeName],
    meta: {
      ns: "mt:market",
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ts,
      updatedAt: ts,
      version: 1,
      source: "utopy.value.need",
      authority: input.nodeId,
      originNode: input.nodeId,
      threadId,
    },
  };
}

export function buildValueContributionDV(input: ValueContributionInput) {
  const ts = iso();
  const needAttrs = input.need?.attrs || {};
  const needId = String(input.need?.id || "");
  if (!needId) throw new Error("La necesidad viva no tiene identidad.");

  return {
    id: uniqueId("value.contribution"),
    kind: "value.contribution",
    attrs: {
      needId,
      needNodeId: needAttrs.nodeId || input.need?.meta?.originNode || null,
      threadId: needAttrs.threadId || input.need?.meta?.threadId || null,
      actorId: input.actorId,
      actorName: input.actorName || input.actorId,
      capabilityKey: input.capabilityKey,
      capabilityKind: input.capabilityKind,
      mode: input.mode,
      amount: Math.max(0, Number(input.amount || 0)),
      unit: input.unit,
      note: input.note?.trim() || null,
      reward: input.reward,
      status: "offered",
      simulation: needAttrs.simulation === true,
      nonTradable: true,
      createdAt: ts,
      updatedAt: ts,
    },
    traits: [
      "utopy:value",
      "value:contribution",
      `value:cap:${input.capabilityKind}`,
      `value:mode:${input.mode}`,
      "value:non-tradable",
    ],
    labels: ["Aporte vivo", input.actorName || input.actorId],
    meta: {
      ns: input.need?.meta?.ns || "mt:market",
      scopes: input.need?.meta?.scopes || ["public"],
      ts,
      updatedAt: ts,
      version: 1,
      source: "utopy.value.contribution",
      authority: input.actorId,
      originNode: input.actorId,
      threadId: needAttrs.threadId || input.need?.meta?.threadId || null,
      respondsTo: needId,
    },
  };
}

export function acceptValueContributionDV(contribution: any, nodeId: string) {
  // Compatibilidad de lectura con DVs antiguos. Los flujos nuevos no deben
  // reescribir el aporte del contribuyente: publican value.agreement aparte.
  const ts = iso();
  return {
    ...contribution,
    attrs: {
      ...(contribution?.attrs || {}),
      status: "accepted",
      acceptedBy: nodeId,
      acceptedAt: ts,
      updatedAt: ts,
    },
    meta: {
      ...(contribution?.meta || {}),
      ts,
      updatedAt: ts,
      version: Number(contribution?.meta?.version || 1) + 1,
      source: "utopy.value.accept",
      authority: nodeId,
    },
  };
}

export function buildValueContributionOutcomeDV(input: {
  need: any;
  contribution: any;
  actorId: string;
  deliveredAmount?: number | null;
  note?: string | null;
}) {
  const ts = iso();
  const contributionId = String(input.contribution?.id || "");
  return {
    id: uniqueId("value.contribution.outcome"),
    kind: "value.contribution.outcome",
    attrs: {
      needId: input.need?.id,
      contributionId,
      capabilityKey: input.contribution?.attrs?.capabilityKey,
      actorId: input.actorId,
      deliveredAmount: Math.max(
        0,
        Number(input.deliveredAmount ?? input.contribution?.attrs?.amount ?? 0),
      ),
      unit: input.contribution?.attrs?.unit,
      status: "delivered",
      note: input.note?.trim() || null,
      deliveredAt: ts,
    },
    traits: ["utopy:value", "value:outcome", "verification:pending"],
    labels: ["Aporte entregado"],
    meta: {
      ns: input.need?.meta?.ns || "mt:market",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      source: "utopy.value.contribution.outcome",
      authority: input.actorId,
      respondsTo: contributionId,
      threadId: input.need?.attrs?.threadId || input.need?.meta?.threadId || null,
      sensitivity: "relationship",
    },
  };
}

export function buildValueContributionVerifiedDV(input: {
  need: any;
  contribution: any;
  outcome?: any | null;
  verifiedBy: string;
  verifiedAmount?: number | null;
  note?: string | null;
}) {
  const ts = iso();
  const contributionId = String(input.contribution?.id || "");
  return {
    id: uniqueId("value.contribution.verified"),
    kind: "value.contribution.verified",
    attrs: {
      needId: input.need?.id,
      contributionId,
      outcomeId: input.outcome?.id || null,
      capabilityKey: input.contribution?.attrs?.capabilityKey,
      verifiedBy: input.verifiedBy,
      verifiedAmount: Math.max(
        0,
        Number(input.verifiedAmount ?? input.contribution?.attrs?.amount ?? 0),
      ),
      unit: input.contribution?.attrs?.unit,
      status: "verified",
      note: input.note?.trim() || null,
      verifiedAt: ts,
    },
    traits: ["utopy:value", "value:verified", "escudo:verified"],
    labels: ["Aporte verificado"],
    meta: {
      ns: input.need?.meta?.ns || "mt:market",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      source: "utopy.value.contribution.verified",
      authority: input.verifiedBy,
      respondsTo: input.outcome?.id || contributionId,
      threadId: input.need?.attrs?.threadId || input.need?.meta?.threadId || null,
      sensitivity: "sensitive",
    },
  };
}

export function buildValueAgreementDV(input: {
  need: any;
  contribution: any;
  acceptedBy: string;
}) {
  const ts = iso();
  const contributionId = String(input.contribution?.id || "");
  return {
    id: `value.agreement:${contributionId}`,
    kind: "value.agreement",
    attrs: {
      needId: input.need?.id,
      contributionId,
      nodeId: input.need?.attrs?.nodeId,
      contributorId: input.contribution?.attrs?.actorId,
      capabilityKey: input.contribution?.attrs?.capabilityKey,
      amount: input.contribution?.attrs?.amount,
      unit: input.contribution?.attrs?.unit,
      reward: input.contribution?.attrs?.reward,
      status: "accepted",
      acceptedBy: input.acceptedBy,
      consent: {
        contributor: true,
        receivingNode: true,
      },
      simulation: input.need?.attrs?.simulation === true,
      nonTradable: true,
      createdAt: ts,
    },
    traits: [
      "utopy:value",
      "value:agreement",
      "escudo:consent",
      "value:non-tradable",
    ],
    labels: ["Acuerdo vivo"],
    meta: {
      ns: input.need?.meta?.ns || "mt:market",
      scopes: input.need?.meta?.scopes || ["public"],
      ts,
      source: "utopy.value.agreement",
      authority: input.need?.attrs?.nodeId,
      originNode: input.need?.attrs?.nodeId,
      threadId:
        input.need?.attrs?.threadId || input.need?.meta?.threadId || null,
      respondsTo: contributionId,
    },
  };
}

export function buildValueCompositionDV(
  need: any,
  composition: ValueComposition,
) {
  const ts = iso();
  return {
    id: `value.composition:${need.id}`,
    kind: "value.composition",
    attrs: {
      ...composition,
      nodeId: need?.attrs?.nodeId,
      status: composition.status,
      simulation: need?.attrs?.simulation === true,
      nonTradable: true,
      updatedAt: ts,
    },
    traits: [
      "utopy:value",
      "value:composition",
      composition.fulfilled
        ? "value:fulfilled"
        : composition.readyForAgreement
          ? "value:covered"
          : "value:forming",
      "liquidity:aware",
    ],
    labels: ["Composición de valor"],
    meta: {
      ns: need?.meta?.ns || "mt:market",
      scopes: need?.meta?.scopes || ["public"],
      ts,
      updatedAt: ts,
      version: Number(need?.meta?.version || 1),
      source: "utopy.value.composition",
      authority: need?.attrs?.nodeId,
      originNode: need?.attrs?.nodeId,
      threadId: need?.attrs?.threadId || need?.meta?.threadId || null,
      respondsTo: need.id,
    },
  };
}
