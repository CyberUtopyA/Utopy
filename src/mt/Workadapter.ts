// ============================================
// FILE: src/mt/work.adapter.ts
// Centro laboral real UTOPY
// ============================================

export type WorkCardStatus =
  | "open"
  | "planned"
  | "quoted"
  | "in_progress"
  | "done"
  | "cancelled";

export type WorkCardKind =
  | "work.intent"
  | "work.plan"
  | "work.execution"
  | "work.outcome"
  | "mo.fabrication.pack";

export type WorkCard = {
  id: string;
  workId: string;
  kind: WorkCardKind;
  title: string;
  subtitle?: string;
  threadId: string | null;
  chainId: string | null;
  ns: string;
  status: WorkCardStatus;
  domain: string;
  actorName?: string | null;
  actorId?: string | null;
  assignedToActorId?: string | null;
  assignedToNodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  participants?: string[];
  unreadBy?: string[];
  budget?: number | null;
  quantity?: number | null;
  materialCount?: number | null;
  createdAt?: number;
  source: any;
};

export type WorkAggregate = {
  workId: string;
  title: string;
  subtitle?: string;
  threadId: string | null;
  chainId: string | null;
  ns: string;
  domain: string;
  status: WorkCardStatus;
  actorName?: string | null;
  actorId?: string | null;
  assignedToActorId?: string | null;
  assignedToNodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  participants?: string[];
  unreadBy?: string[];
  budget?: number | null;
  quantity?: number | null;
  materialCount?: number | null;
  base?: WorkCard | null;
  plan?: WorkCard | null;
  execution?: WorkCard | null;
  outcome?: WorkCard | null;
  events: WorkCard[];
};

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x: any, fb: number | null = null): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function parseTs(x: any): number {
  const raw =
    x?.meta?.ts ??
    x?.attrs?.ts ??
    x?.attrs?.startedAt ??
    x?.attrs?.completedAt ??
    x?.ts ??
    0;

  if (typeof raw === "number") return raw;
  const t = Date.parse(String(raw || ""));
  return Number.isFinite(t) ? t : 0;
}

function uniq(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function getWorkId(dv: any): string {
  return (
    safeStr(dv?.attrs?.workId) ||
    safeStr(dv?.attrs?.packId) ||
    safeStr(dv?.attrs?.intentId) ||
    safeStr(dv?.attrs?.planId) ||
    safeStr(dv?.id)
  );
}

function detectStatus(dv: any): WorkCardStatus {
  const k = safeStr(dv?.kind);
  const s =
    safeStr(dv?.attrs?.status) ||
    safeStr(dv?.meta?.status) ||
    safeStr(dv?.status);

  if (s === "planned") return "planned";
  if (s === "quoted") return "quoted";
  if (s === "in_progress") return "in_progress";
  if (s === "done") return "done";
  if (s === "cancelled") return "cancelled";

  if (k === "work.plan") return "planned";
  if (k === "work.execution") return "in_progress";
  if (k === "work.outcome") {
    const result = safeStr(dv?.attrs?.result || "").toLowerCase();
    if (result === "cancelled") return "cancelled";
    return "done";
  }

  return "open";
}

function detectDomain(dv: any): string {
  return (
    safeStr(dv?.attrs?.domain) ||
    safeStr(dv?.attrs?.workDomain) ||
    safeStr(dv?.meta?.domain) ||
    (Array.isArray(dv?.traits)
      ? dv.traits
          .find((t: string) => String(t).startsWith("work:domain:"))
          ?.replace("work:domain:", "")
      : "") ||
    "general"
  );
}

export function isWorkLikeDV(dv: any) {
  const k = safeStr(dv?.kind);
  return (
    k === "work.intent" ||
    k === "work.plan" ||
    k === "work.execution" ||
    k === "work.outcome" ||
    k === "mo.fabrication.pack"
  );
}

export function toWorkCard(dv: any): WorkCard | null {
  if (!isWorkLikeDV(dv)) return null;

  const kind = safeStr(dv?.kind) as WorkCardKind;
  const attrs = dv?.attrs || {};
  const meta = dv?.meta || {};
  const workId = getWorkId(dv);

  const participants = uniq(attrs?.participants || []);
  const unreadBy = uniq(attrs?.unreadBy || []);

  if (kind === "mo.fabrication.pack") {
    const pieceCount =
      toNum(attrs?.estimate?.pieceCount) ??
      (Array.isArray(attrs?.pieces) ? attrs.pieces.length : null);

    const materialCount =
      Array.isArray(attrs?.cutlist)
        ? attrs.cutlist.length
        : Array.isArray(attrs?.pieces)
        ? attrs.pieces.length
        : 0;

    return {
      id: safeStr(dv?.id),
      workId,
      kind,
      title:
        safeStr(attrs?.title) ||
        `Pack de fabricación ${safeStr(attrs?.sceneId).slice(-6)}`,
      subtitle:
        safeStr(attrs?.sourceType) ||
        `${pieceCount || 0} piezas · ${materialCount || 0} materiales`,
      threadId: safeStr(meta?.threadId || attrs?.threadId || null) || null,
      chainId: safeStr(meta?.chainId || attrs?.chainId || null) || null,
      ns: safeStr(meta?.ns || "mt:market"),
      status: "planned",
      domain:
        safeStr(attrs?.workDomain) ||
        safeStr(attrs?.domain) ||
        "furniture",
      actorName: null,
      actorId: null,
      assignedToActorId: safeStr(attrs?.assignedToActorId || null) || null,
      assignedToNodeId: safeStr(attrs?.assignedToNodeId || null) || null,
      orgId: safeStr(attrs?.orgId || null) || null,
      territoryId: safeStr(attrs?.territoryId || null) || null,
      participants,
      unreadBy,
      budget: null,
      quantity: pieceCount,
      materialCount,
      createdAt: parseTs(dv),
      source: dv,
    };
  }

  return {
    id: safeStr(dv?.id),
    workId,
    kind,
    title: safeStr(attrs?.title || "Trabajo"),
    subtitle: safeStr(attrs?.description || attrs?.summary || ""),
    threadId: safeStr(meta?.threadId || attrs?.threadId || null) || null,
    chainId: safeStr(meta?.chainId || attrs?.chainId || null) || null,
    ns: safeStr(meta?.ns || "work"),
    status: detectStatus(dv),
    domain: detectDomain(dv),
    actorName:
      safeStr(attrs?.by?.actorName) ||
      safeStr(attrs?.owner?.actorName) ||
      safeStr(attrs?.sellerName) ||
      null,
    actorId:
      safeStr(attrs?.by?.actorId) ||
      safeStr(attrs?.owner?.actorId) ||
      safeStr(attrs?.author?.id) ||
      null,
    assignedToActorId:
      safeStr(attrs?.assignedToActorId) ||
      safeStr(attrs?.owner?.actorId) ||
      safeStr(attrs?.target?.actorId) ||
      null,
    assignedToNodeId:
      safeStr(attrs?.assignedToNodeId) ||
      safeStr(attrs?.owner?.nodeId) ||
      safeStr(attrs?.target?.nodeId) ||
      null,
    orgId: safeStr(attrs?.orgId || null) || null,
    territoryId: safeStr(attrs?.territoryId || null) || null,
    participants,
    unreadBy,
    budget:
      toNum(attrs?.constraints?.budget) ??
      toNum(attrs?.estimate?.amount) ??
      null,
    quantity:
      toNum(attrs?.quantity) ??
      toNum(attrs?.estimate?.pieceCount) ??
      null,
    materialCount: Array.isArray(attrs?.materials)
      ? attrs.materials.length
      : null,
    createdAt: parseTs(dv),
    source: dv,
  };
}

export function isWorkVisibleForActor(
  dv: any,
  filters?: {
    actorId?: string | null;
    nodeId?: string | null;
    orgId?: string | null;
    territoryId?: string | null;
  }
) {
  const a = dv?.attrs || {};
  const actorId = safeStr(filters?.actorId || "");
  const nodeId = safeStr(filters?.nodeId || "");
  const orgId = safeStr(filters?.orgId || "");
  const territoryId = safeStr(filters?.territoryId || "");

  const assignedActorId =
    safeStr(a?.assignedToActorId) ||
    safeStr(a?.owner?.actorId) ||
    safeStr(a?.target?.actorId) ||
    "";

  const assignedNodeId =
    safeStr(a?.assignedToNodeId) ||
    safeStr(a?.owner?.nodeId) ||
    safeStr(a?.target?.nodeId) ||
    "";

  const byActorId =
    safeStr(a?.by?.actorId) ||
    safeStr(a?.author?.id) ||
    "";

  const dvOrgId = safeStr(a?.orgId || "");
  const dvTerritoryId = safeStr(a?.territoryId || "");

  const visibility = safeStr(a?.visibility || "public");
  const participants = Array.isArray(a?.participants) ? a.participants.map(String) : [];
  const unreadBy = Array.isArray(a?.unreadBy) ? a.unreadBy.map(String) : [];

  if (orgId && dvOrgId && dvOrgId !== orgId) return false;
  if (territoryId && dvTerritoryId && dvTerritoryId !== territoryId) return false;

  if (actorId && assignedActorId && assignedActorId === actorId) return true;
  if (nodeId && assignedNodeId && assignedNodeId === nodeId) return true;
  if (actorId && byActorId && byActorId === actorId) return true;
  if (actorId && participants.includes(actorId)) return true;
  if (actorId && unreadBy.includes(actorId)) return true;

  if (visibility === "public" && !assignedActorId && !assignedNodeId) return true;

  return false;
}

export function collectWorkCards(
  allLive: any[],
  filters?: {
    actorId?: string | null;
    nodeId?: string | null;
    orgId?: string | null;
    territoryId?: string | null;
  }
): WorkCard[] {
  return (allLive || [])
    .filter((dv) => isWorkLikeDV(dv))
    .filter((dv) => isWorkVisibleForActor(dv, filters))
    .map(toWorkCard)
    .filter(Boolean) as WorkCard[];
}

export function aggregateWorkCards(cards: WorkCard[]): WorkAggregate[] {
  const map = new Map<string, WorkAggregate>();

  const sorted = [...cards].sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );

  for (const card of sorted) {
    const key = card.workId || card.id;
    const prev = map.get(key) || {
      workId: key,
      title: card.title,
      subtitle: card.subtitle,
      threadId: card.threadId,
      chainId: card.chainId,
      ns: card.ns,
      domain: card.domain,
      status: "planned" as WorkCardStatus,
      actorName: card.actorName || null,
      actorId: card.actorId || null,
      assignedToActorId: card.assignedToActorId || null,
      assignedToNodeId: card.assignedToNodeId || null,
      orgId: card.orgId || null,
      territoryId: card.territoryId || null,
      participants: card.participants || [],
      unreadBy: card.unreadBy || [],
      budget: card.budget ?? null,
      quantity: card.quantity ?? null,
      materialCount: card.materialCount ?? null,
      base: null,
      plan: null,
      execution: null,
      outcome: null,
      events: [],
    };

    prev.title = card.title || prev.title;
    prev.subtitle = card.subtitle || prev.subtitle;
    prev.threadId = card.threadId || prev.threadId;
    prev.chainId = card.chainId || prev.chainId;
    prev.ns = card.ns || prev.ns;
    prev.domain = card.domain || prev.domain;
    prev.actorName = card.actorName || prev.actorName;
    prev.actorId = card.actorId || prev.actorId;
    prev.assignedToActorId = card.assignedToActorId || prev.assignedToActorId;
    prev.assignedToNodeId = card.assignedToNodeId || prev.assignedToNodeId;
    prev.orgId = card.orgId || prev.orgId;
    prev.territoryId = card.territoryId || prev.territoryId;
    prev.participants = uniq([...(prev.participants || []), ...(card.participants || [])]);
    prev.unreadBy = uniq([...(prev.unreadBy || []), ...(card.unreadBy || [])]);
    prev.budget = card.budget ?? prev.budget;
    prev.quantity = card.quantity ?? prev.quantity;
    prev.materialCount = card.materialCount ?? prev.materialCount;
    prev.events.push(card);

    if (card.kind === "mo.fabrication.pack" || card.kind === "work.intent") {
      prev.base = card;
    }
    if (card.kind === "work.plan") prev.plan = card;
    if (card.kind === "work.execution") prev.execution = card;
    if (card.kind === "work.outcome") prev.outcome = card;

    map.set(key, prev);
  }

  const out = Array.from(map.values()).map((agg) => {
    if (agg.outcome) {
      const s = agg.outcome.status;
      agg.status = s === "cancelled" ? "cancelled" : "done";
    } else if (agg.execution) {
      agg.status = "in_progress";
    } else if (agg.plan) {
      agg.status = agg.plan.status || "planned";
    } else if (agg.base) {
      agg.status = agg.base.status || "planned";
    } else {
      agg.status = "open";
    }
    return agg;
  });

  return out.sort((a, b) => {
    const ta =
      a.outcome?.createdAt ||
      a.execution?.createdAt ||
      a.plan?.createdAt ||
      a.base?.createdAt ||
      0;
    const tb =
      b.outcome?.createdAt ||
      b.execution?.createdAt ||
      b.plan?.createdAt ||
      b.base?.createdAt ||
      0;
    return tb - ta;
  });
}