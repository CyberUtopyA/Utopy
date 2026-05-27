// ============================================
// FILE: src/mt/work.actions.ts
// Builders de work.execution / work.outcome
// ============================================

function uid(prefix = "work") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function uniq(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

export function makeWorkExecutionDV(args: {
  workId: string;
  title?: string;
  threadId?: string | null;
  chainId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  domain?: string | null;
  existingParticipants?: string[];
  unreadBy?: string[];
}) {
  const participants = uniq([
    ...(args.existingParticipants || []),
    args.actorId || null,
  ]);

  const nextUnreadBy = uniq([
    ...(args.unreadBy || []),
    ...(participants || []),
  ]).filter((x) => String(x) !== String(args.actorId || ""));

  return {
    id: uid("work.execution"),
    kind: "work.execution",
    attrs: {
      workId: args.workId,
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
      startedAt: new Date().toISOString(),
      domain: args.domain || "general",
      visibility: "assigned",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
    },
    traits: [
      "work:execution",
      "work:status:in_progress",
      args.orgId ? `work:org:${args.orgId}` : null,
      args.territoryId ? `work:territory:${args.territoryId}` : null,
    ].filter(Boolean),
    meta: {
      ns: "mt:market",
      ts: new Date().toISOString(),
      threadId: args.threadId || null,
      chainId: args.chainId || null,
      scopes: ["public"],
      source: "ms.market.work.actions",
    },
  };
}

export function makeWorkOutcomeDV(args: {
  workId: string;
  title?: string;
  threadId?: string | null;
  chainId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  domain?: string | null;
  result?: "done" | "cancelled";
  existingParticipants?: string[];
  unreadBy?: string[];
}) {
  const result = args.result || "done";

  const participants = uniq([
    ...(args.existingParticipants || []),
    args.actorId || null,
  ]);

  const nextUnreadBy = uniq([
    ...(args.unreadBy || []),
    ...(participants || []),
  ]).filter((x) => String(x) !== String(args.actorId || ""));

  return {
    id: uid("work.outcome"),
    kind: "work.outcome",
    attrs: {
      workId: args.workId,
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
      completedAt: new Date().toISOString(),
      domain: args.domain || "general",
      visibility: "assigned",
      orgId: args.orgId || null,
      territoryId: args.territoryId || null,
    },
    traits: [
      "work:outcome",
      result === "done" ? "work:status:done" : "work:status:cancelled",
      args.orgId ? `work:org:${args.orgId}` : null,
      args.territoryId ? `work:territory:${args.territoryId}` : null,
    ].filter(Boolean),
    meta: {
      ns: "mt:market",
      ts: new Date().toISOString(),
      threadId: args.threadId || null,
      chainId: args.chainId || null,
      scopes: ["public"],
      source: "ms.market.work.actions",
    },
  };
}