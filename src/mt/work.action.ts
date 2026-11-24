// src/mt/work.action.ts
// Builders de ejecución y resultado conservando la identidad relacional.

function uid(prefix = "work") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function uniq(values: any[]) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

type RelationArgs = {
  workId: string;
  relationshipId?: string | null;
  designId?: string | null;
  threadId?: string | null;
  chainId?: string | null;
  rootDvId?: string | null;
  parentDvId?: string | null;
  sourceRefs?: Array<{ id: string; kind?: string }>;
};

type CommonArgs = RelationArgs & {
  title?: string;
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  domain?: string | null;
  existingParticipants?: string[];
  unreadBy?: string[];
};

function relationAttrs(args: RelationArgs) {
  return {
    workId: args.workId,
    relationshipId: args.relationshipId || null,
    designId: args.designId || null,
    threadId: args.threadId || null,
    chainId: args.chainId || args.threadId || null,
    rootDvId: args.rootDvId || null,
    parentDvId: args.parentDvId || null,
    relation: {
      workId: args.workId,
      relationshipId: args.relationshipId || null,
      designId: args.designId || null,
      threadId: args.threadId || null,
      chainId: args.chainId || args.threadId || null,
      rootDvId: args.rootDvId || null,
      parentDvId: args.parentDvId || null,
    },
    sourceRefs: args.sourceRefs || [],
  };
}

function relationMeta(args: RelationArgs) {
  return {
    threadId: args.threadId || null,
    chainId: args.chainId || args.threadId || null,
    relationshipId: args.relationshipId || null,
    rootDvId: args.rootDvId || null,
    parentDvId: args.parentDvId || null,
  };
}

export function makeWorkQuoteDV(
  args: CommonArgs & {
    amount: number;
    currency: string;
    estimatedDays: number;
    depositPercent?: number | null;
    conditions?: string | null;
  },
) {
  const participants = uniq([...(args.existingParticipants || []), args.actorId, args.nodeId]);
  const now = new Date().toISOString();
  const amount = Math.max(0, Number(args.amount || 0));
  const depositPercent = Math.max(0, Math.min(100, Number(args.depositPercent || 0)));
  return {
    id: uid("work.quote"),
    kind: "work.quote",
    attrs: {
      ...relationAttrs(args),
      title: args.title || "Cotización de trabajo",
      status: "offered",
      quote: {
        amount,
        currency: args.currency || "PYG",
        estimatedDays: Math.max(1, Math.round(Number(args.estimatedDays || 1))),
        depositPercent,
        depositAmount: amount * (depositPercent / 100),
        conditions: args.conditions?.trim() || null,
      },
      by: { actorId: args.actorId || null, actorName: args.actorName || null },
      providerNodeId: args.nodeId || null,
      participants,
      unreadBy: uniq([...(args.unreadBy || []), ...participants]).filter(
        (id) => id !== String(args.actorId || ""),
      ),
      domain: args.domain || "general",
      visibility: "participants",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      consent: { provider: true, requester: false, automaticAcceptance: false },
      createdAt: now,
    },
    traits: ["work:quote", "utopy:chain", "consent:required"],
    meta: {
      ns: "mt:market",
      ts: now,
      ...relationMeta(args),
      scopes: ["participants"],
      source: "ms.market.work.quote",
      schema: "utopy.work.quote@1",
      authority: args.nodeId || args.actorId || null,
      originNode: args.nodeId || null,
      sensitivity: "relationship",
    },
  };
}

export function makeWorkQuoteAcceptedDV(
  args: CommonArgs & { quote: any; acceptedBy: string },
) {
  const now = new Date().toISOString();
  const quoteId = String(args.quote?.id || "");
  return {
    id: uid("work.quote.accepted"),
    kind: "work.quote.accepted",
    attrs: {
      ...relationAttrs(args),
      quoteId,
      quote: args.quote?.attrs?.quote || null,
      status: "accepted",
      acceptedBy: args.acceptedBy,
      participants: uniq([...(args.existingParticipants || []), args.acceptedBy]),
      consent: { provider: true, requester: true, automaticAcceptance: false },
      acceptedAt: now,
    },
    traits: ["work:quote:accepted", "work:agreement", "consent:bilateral"],
    meta: {
      ns: "mt:market",
      ts: now,
      ...relationMeta(args),
      scopes: ["participants"],
      source: "ms.market.work.quote.accepted",
      respondsTo: quoteId,
      authority: args.acceptedBy,
      sensitivity: "sensitive",
    },
  };
}

export function makeWorkPlanDV(args: CommonArgs) {
  const participants = uniq([...(args.existingParticipants || []), args.actorId]);
  const nextUnreadBy = uniq([
    ...(args.unreadBy || []),
    ...participants,
  ]).filter((id) => id !== String(args.actorId || ""));
  const now = new Date().toISOString();

  return {
    id: uid("work.plan"),
    kind: "work.plan",
    attrs: {
      ...relationAttrs(args),
      title: args.title || "Trabajo aceptado",
      status: "accepted",
      assignedToActorId: args.actorId || null,
      assignedToNodeId: args.nodeId || null,
      owner: {
        actorId: args.actorId || null,
        actorName: args.actorName || null,
        nodeId: args.nodeId || null,
      },
      by: {
        actorId: args.actorId || null,
        actorName: args.actorName || null,
      },
      participants,
      unreadBy: nextUnreadBy,
      acceptedAt: now,
      domain: args.domain || "general",
      visibility: "participants",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    traits: [
      "work:plan",
      "utopy:chain",
      "work:status:accepted",
      "consent:confirmed",
      args.orgId ? `work:org:${args.orgId}` : null,
      args.territoryId ? `work:territory:${args.territoryId}` : null,
    ].filter(Boolean),
    meta: {
      ns: "mt:market",
      ts: now,
      ...relationMeta(args),
      scopes: ["participants"],
      source: "ms.market.work.actions",
      schema: "utopy.work.plan@2",
      authority: args.nodeId || args.actorId || null,
      originNode: args.nodeId || null,
    },
  };
}

export function makeWorkExecutionDV(args: CommonArgs) {
  const participants = uniq([
    ...(args.existingParticipants || []),
    args.actorId,
  ]);
  const nextUnreadBy = uniq([
    ...(args.unreadBy || []),
    ...participants,
  ]).filter((id) => id !== String(args.actorId || ""));
  const now = new Date().toISOString();

  return {
    id: uid("work.execution"),
    kind: "work.execution",
    attrs: {
      ...relationAttrs(args),
      title: args.title || "Trabajo tomado",
      status: "in_progress",
      assignedToActorId: args.actorId || null,
      assignedToNodeId: args.nodeId || null,
      by: {
        actorId: args.actorId || null,
        actorName: args.actorName || null,
      },
      owner: {
        actorId: args.actorId || null,
        actorName: args.actorName || null,
        nodeId: args.nodeId || null,
      },
      participants,
      unreadBy: nextUnreadBy,
      startedAt: now,
      domain: args.domain || "general",
      visibility: "participants",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    traits: [
      "work:execution",
      "utopy:chain",
      "work:status:in_progress",
      args.orgId ? `work:org:${args.orgId}` : null,
      args.territoryId ? `work:territory:${args.territoryId}` : null,
    ].filter(Boolean),
    meta: {
      ns: "mt:market",
      ts: now,
      ...relationMeta(args),
      scopes: ["participants"],
      source: "ms.market.work.actions",
      schema: "utopy.work.execution@2",
      authority: args.nodeId || args.actorId || null,
      originNode: args.nodeId || null,
    },
  };
}

export function makeWorkOutcomeDV(
  args: CommonArgs & { result?: "done" | "cancelled" },
) {
  const result = args.result || "done";
  const participants = uniq([
    ...(args.existingParticipants || []),
    args.actorId,
  ]);
  const nextUnreadBy = uniq([
    ...(args.unreadBy || []),
    ...participants,
  ]).filter((id) => id !== String(args.actorId || ""));
  const now = new Date().toISOString();

  return {
    id: uid("work.outcome"),
    kind: "work.outcome",
    attrs: {
      ...relationAttrs(args),
      title:
        args.title ||
        (result === "done" ? "Trabajo terminado" : "Trabajo cancelado"),
      status: result === "done" ? "done" : "cancelled",
      result,
      by: {
        actorId: args.actorId || null,
        actorName: args.actorName || null,
      },
      assignedToActorId: args.actorId || null,
      assignedToNodeId: args.nodeId || null,
      participants,
      unreadBy: nextUnreadBy,
      completedAt: now,
      domain: args.domain || "general",
      visibility: "participants",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
      proof: {
        status: result === "done" ? "awaiting_receiver_verification" : "cancelled",
      },
    },
    traits: [
      "work:outcome",
      "utopy:chain",
      result === "done" ? "work:status:done" : "work:status:cancelled",
      args.orgId ? `work:org:${args.orgId}` : null,
      args.territoryId ? `work:territory:${args.territoryId}` : null,
    ].filter(Boolean),
    meta: {
      ns: "mt:market",
      ts: now,
      ...relationMeta(args),
      scopes: ["participants"],
      source: "ms.market.work.actions",
      schema: "utopy.work.outcome@2",
      authority: args.nodeId || args.actorId || null,
      originNode: args.nodeId || null,
    },
  };
}
