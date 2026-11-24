// src/mt/Workadapter.ts
// Proyección laboral universal: varios DVs describen una sola operación viva.
// No duplica work.intent, work.plan y mo.fabrication.pack en trabajos separados.

export type WorkCardStatus =
  | "open"
  | "planned"
  | "quoted"
  | "in_progress"
  | "awaiting_confirmation"
  | "done"
  | "cancelled";

export type WorkCardKind =
  | "work.intent"
  | "work.plan"
  | "work.execution"
  | "work.outcome"
  | "work.quote"
  | "work.quote.accepted"
  | "mo.fabrication.pack";

export type WorkCard = {
  id: string;
  workId: string;
  relationIds: string[];
  kind: WorkCardKind;
  title: string;
  subtitle?: string;
  relationshipId: string | null;
  threadId: string | null;
  chainId: string | null;
  rootDvId: string | null;
  designId: string | null;
  ns: string;
  status: WorkCardStatus;
  domain: string;
  actorName?: string | null;
  actorId?: string | null;
  assignedToActorId?: string | null;
  assignedToNodeId?: string | null;
  sourceNodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  participants?: string[];
  unreadBy?: string[];
  budget?: number | null;
  quantity?: number | null;
  materialCount?: number | null;
  requiredCapabilities: string[];
  createdAt?: number;
  source: any;
};

export type WorkAggregate = {
  workId: string;
  title: string;
  subtitle?: string;
  relationshipId: string | null;
  threadId: string | null;
  chainId: string | null;
  rootDvId: string | null;
  designId: string | null;
  ns: string;
  domain: string;
  status: WorkCardStatus;
  actionable: boolean;
  technicalOnly: boolean;
  actorName?: string | null;
  actorId?: string | null;
  assignedToActorId?: string | null;
  assignedToNodeId?: string | null;
  sourceNodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  participants?: string[];
  unreadBy?: string[];
  budget?: number | null;
  quantity?: number | null;
  materialCount?: number | null;
  requiredCapabilities: string[];
  base?: WorkCard | null;
  plan?: WorkCard | null;
  quote?: WorkCard | null;
  pack?: WorkCard | null;
  execution?: WorkCard | null;
  outcome?: WorkCard | null;
  events: WorkCard[];
};

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x: any, fb: number | null = null): number | null {
  if (x === "" || x == null) return fb;
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

function uniq(values: any[]) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function capabilityStrings(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(capabilityStrings);
  if (value && typeof value === "object") {
    return uniq([
      value.id,
      value.label,
      value.name,
      value.domain,
      ...(Array.isArray(value.domains) ? value.domains : []),
      ...(Array.isArray(value.tags) ? value.tags : []),
      ...(Array.isArray(value.verbs) ? value.verbs : []),
      ...(Array.isArray(value.resources) ? value.resources : []),
    ]);
  }
  return safeStr(value) ? [safeStr(value)] : [];
}

function attrsOf(dv: any) {
  return dv?.attrs && typeof dv.attrs === "object" ? dv.attrs : {};
}

function metaOf(dv: any) {
  return dv?.meta && typeof dv.meta === "object" ? dv.meta : {};
}

function relationIdsOf(dv: any): string[] {
  const attrs = attrsOf(dv);
  const relation = attrs?.relation || metaOf(dv)?.relation || {};
  const refs = Array.isArray(attrs?.sourceRefs) ? attrs.sourceRefs : [];
  const source = attrs?.source || {};
  const strong = [
    attrs?.workId,
    relation?.workId,
    attrs?.intentId,
    attrs?.planId,
    attrs?.packId,
    attrs?.sourceWorkId,
    attrs?.parentWorkId,
    attrs?.links?.dvId,
    source?.workId,
    ...refs
      .filter((ref: any) =>
        /work\.|work:|fabrication\.pack/.test(String(ref?.kind || "")),
      )
      .map((ref: any) => ref?.id),
    dv?.id,
  ];

  const ids = uniq(strong);
  if (ids.length > 1) return ids;

  return uniq([
    ...ids,
    attrs?.rootDvId,
    metaOf(dv)?.rootDvId,
    attrs?.designId,
    relation?.designId,
  ]);
}

function primaryWorkId(dv: any): string {
  const attrs = attrsOf(dv);
  return safeStr(
    attrs?.workId ||
      attrs?.relation?.workId ||
      attrs?.intentId ||
      attrs?.planId ||
      attrs?.packId ||
      attrs?.sourceWorkId ||
      dv?.id,
  );
}

function detectStatus(dv: any): WorkCardStatus {
  const kind = safeStr(dv?.kind);
  const status = safeStr(
    dv?.attrs?.status || dv?.meta?.status || dv?.status,
  ).toLowerCase();

  if (kind === "work.quote") return "quoted";
  if (kind === "work.quote.accepted") return "planned";

  if (kind === "work.outcome") {
    if (safeStr(dv?.attrs?.result).toLowerCase() === "cancelled") {
      return "cancelled";
    }
    const proof = safeStr(dv?.attrs?.proof?.status).toLowerCase();
    return /verified|confirmed|accepted/.test(proof) || dv?.attrs?.verified === true
      ? "done"
      : "awaiting_confirmation";
  }

  if (["planned", "draft", "accepted"].includes(status)) return "planned";
  if (["quoted", "proposal"].includes(status)) return "quoted";
  if (["in_progress", "working", "started"].includes(status)) return "in_progress";
  if (["done", "completed", "delivered"].includes(status)) return "done";
  if (["cancelled", "canceled", "rejected"].includes(status)) return "cancelled";
  if (kind === "work.plan" || kind === "mo.fabrication.pack") return "planned";
  if (kind === "work.execution") return "in_progress";
  return "open";
}

function detectDomain(dv: any): string {
  return (
    safeStr(dv?.attrs?.domain) ||
    safeStr(dv?.attrs?.workDomain) ||
    safeStr(dv?.meta?.domain) ||
    (Array.isArray(dv?.traits)
      ? safeStr(
          dv.traits
            .find((trait: string) => String(trait).startsWith("work:domain:"))
            ?.replace("work:domain:", ""),
        )
      : "") ||
    "general"
  );
}

function humanTitle(dv: any, kind: WorkCardKind): string {
  const attrs = attrsOf(dv);
  const raw = safeStr(attrs?.title || attrs?.name || attrs?.nombre);
  if (raw) return raw.replace(/^Pack para\s+/i, "Preparar ");
  if (kind === "mo.fabrication.pack") return "Preparación técnica";
  if (kind === "work.plan") return "Plan de trabajo";
  return "Trabajo";
}

export function isWorkLikeDV(dv: any) {
  return [
    "work.intent",
    "work.plan",
    "work.execution",
    "work.outcome",
    "work.quote",
    "work.quote.accepted",
    "mo.fabrication.pack",
  ].includes(safeStr(dv?.kind));
}

export function toWorkCard(dv: any): WorkCard | null {
  if (!isWorkLikeDV(dv)) return null;

  const kind = safeStr(dv?.kind) as WorkCardKind;
  const attrs = attrsOf(dv);
  const meta = metaOf(dv);
  const relation = attrs?.relation || meta?.relation || {};
  const participants = uniq(attrs?.participants || []);
  const unreadBy = uniq(attrs?.unreadBy || []);
  const relationIds = relationIdsOf(dv);
  const workId = primaryWorkId(dv);

  const pieceCount =
    toNum(attrs?.estimate?.pieceCount) ??
    (Array.isArray(attrs?.pieces) ? attrs.pieces.length : null);
  const materialCount = Array.isArray(attrs?.materials)
    ? attrs.materials.length
    : Array.isArray(attrs?.cutlist)
      ? attrs.cutlist.length
      : Array.isArray(attrs?.pieces)
        ? attrs.pieces.length
        : null;

  return {
    id: safeStr(dv?.id),
    workId,
    relationIds,
    kind,
    title: humanTitle(dv, kind),
    subtitle:
      safeStr(attrs?.description || attrs?.summary || attrs?.sourceType) ||
      (kind === "mo.fabrication.pack"
        ? `${pieceCount || 0} piezas · ${materialCount || 0} insumos`
        : ""),
    relationshipId: safeStr(attrs?.relationshipId || meta?.relationshipId || relation?.relationshipId) || null,
    threadId: safeStr(attrs?.threadId || meta?.threadId || relation?.threadId) || null,
    chainId: safeStr(attrs?.chainId || meta?.chainId || relation?.chainId) || null,
    rootDvId: safeStr(attrs?.rootDvId || meta?.rootDvId || relation?.rootDvId) || null,
    designId: safeStr(attrs?.designId || relation?.designId) || null,
    ns: safeStr(meta?.ns || "mt:market"),
    status: detectStatus(dv),
    domain: detectDomain(dv),
    actorName:
      safeStr(attrs?.by?.actorName) ||
      safeStr(attrs?.owner?.actorName) ||
      safeStr(attrs?.requesterName) ||
      safeStr(attrs?.sellerName) ||
      null,
    actorId:
      safeStr(attrs?.by?.actorId) ||
      safeStr(attrs?.owner?.actorId) ||
      safeStr(attrs?.requesterId) ||
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
    sourceNodeId:
      safeStr(attrs?.source?.nodeId) ||
      safeStr(attrs?.author?.nodeId) ||
      safeStr(meta?.originNode) ||
      safeStr(meta?.authority) ||
      null,
    orgId: safeStr(attrs?.orgId) || null,
    territoryId: safeStr(attrs?.territoryId || attrs?.context?.territoryId) || null,
    participants,
    unreadBy,
    budget:
      toNum(attrs?.quote?.amount) ??
      toNum(attrs?.constraints?.budget) ??
      toNum(attrs?.estimate?.amount) ??
      null,
    quantity: toNum(attrs?.quantity) ?? pieceCount ?? null,
    materialCount,
    requiredCapabilities: uniq([
      ...capabilityStrings(attrs?.requiredCapabilities),
      ...capabilityStrings(attrs?.requestedCapabilities),
      ...capabilityStrings(attrs?.intent?.capabilities),
      ...(Array.isArray(dv?.traits)
        ? dv.traits
            .filter((trait: string) => String(trait).startsWith("work:req:"))
            .map((trait: string) => String(trait).replace("work:req:", ""))
        : []),
      ...(detectDomain(dv) !== "general" ? [detectDomain(dv)] : []),
    ]),
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
  },
) {
  const attrs = attrsOf(dv);
  const actorId = safeStr(filters?.actorId);
  const nodeId = safeStr(filters?.nodeId);
  const orgId = safeStr(filters?.orgId);
  const territoryId = safeStr(filters?.territoryId);
  const assignedActorId = safeStr(
    attrs?.assignedToActorId || attrs?.owner?.actorId || attrs?.target?.actorId,
  );
  const assignedNodeId = safeStr(
    attrs?.assignedToNodeId || attrs?.owner?.nodeId || attrs?.target?.nodeId,
  );
  const byActorId = safeStr(
    attrs?.by?.actorId || attrs?.author?.id || attrs?.requesterId,
  );
  const dvOrgId = safeStr(attrs?.orgId);
  const dvTerritoryId = safeStr(attrs?.territoryId || attrs?.context?.territoryId);
  const visibility = safeStr(attrs?.visibility || "public");
  const participants = uniq(attrs?.participants || []);
  const unreadBy = uniq(attrs?.unreadBy || []);

  if (orgId && dvOrgId && dvOrgId !== orgId) return false;
  if (territoryId && dvTerritoryId && dvTerritoryId !== territoryId) return false;
  if (actorId && assignedActorId === actorId) return true;
  if (nodeId && assignedNodeId === nodeId) return true;
  if (actorId && byActorId === actorId) return true;
  if (actorId && (participants.includes(actorId) || unreadBy.includes(actorId))) return true;
  if (!actorId && !nodeId) return visibility === "public" || !visibility;
  return visibility === "public" && !assignedActorId && !assignedNodeId;
}

export function collectWorkCards(
  allLive: any[],
  filters?: {
    actorId?: string | null;
    nodeId?: string | null;
    orgId?: string | null;
    territoryId?: string | null;
  },
): WorkCard[] {
  return (allLive || [])
    .filter(isWorkLikeDV)
    .filter((dv) => isWorkVisibleForActor(dv, filters))
    .map(toWorkCard)
    .filter(Boolean) as WorkCard[];
}

class DisjointSet {
  private parent = new Map<string, string>();

  add(id: string) {
    if (id && !this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    const parent = this.parent.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    if (!a || !b) return;
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

function chooseBase(current: WorkCard | null | undefined, next: WorkCard) {
  if (!current) return next;
  if (next.kind === "work.intent" && current.kind !== "work.intent") return next;
  if (current.kind === "work.intent" && next.kind !== "work.intent") return current;
  return (next.createdAt || 0) >= (current.createdAt || 0) ? next : current;
}

export function aggregateWorkCards(cards: WorkCard[]): WorkAggregate[] {
  const dsu = new DisjointSet();
  for (const card of cards) {
    const ids = uniq([card.workId, ...card.relationIds]);
    ids.forEach((id) => dsu.add(id));
    for (let i = 1; i < ids.length; i += 1) dsu.union(ids[0], ids[i]);
  }

  const map = new Map<string, WorkAggregate>();
  const sorted = [...cards].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  for (const card of sorted) {
    const key = dsu.find(card.workId || card.id);
    const prev = map.get(key) || {
      workId: card.workId || key,
      title: card.title,
      subtitle: card.subtitle,
      relationshipId: card.relationshipId,
      threadId: card.threadId,
      chainId: card.chainId,
      rootDvId: card.rootDvId,
      designId: card.designId,
      ns: card.ns,
      domain: card.domain,
      status: "open" as WorkCardStatus,
      actionable: false,
      technicalOnly: false,
      actorName: card.actorName || null,
      actorId: card.actorId || null,
      assignedToActorId: card.assignedToActorId || null,
      assignedToNodeId: card.assignedToNodeId || null,
      sourceNodeId: card.sourceNodeId || null,
      orgId: card.orgId || null,
      territoryId: card.territoryId || null,
      participants: [],
      unreadBy: [],
      budget: null,
      quantity: null,
      materialCount: null,
      requiredCapabilities: [],
      base: null,
      plan: null,
      quote: null,
      pack: null,
      execution: null,
      outcome: null,
      events: [],
    };

    prev.workId =
      safeStr(card.source?.attrs?.workId) ||
      safeStr(prev.workId) ||
      card.workId ||
      key;
    prev.relationshipId = card.relationshipId || prev.relationshipId;
    prev.threadId = card.threadId || prev.threadId;
    prev.chainId = card.chainId || prev.chainId;
    prev.rootDvId = card.rootDvId || prev.rootDvId;
    prev.designId = card.designId || prev.designId;
    prev.ns = card.ns || prev.ns;
    prev.domain = card.domain !== "general" ? card.domain : prev.domain;
    prev.actorName = card.actorName || prev.actorName;
    prev.actorId = card.actorId || prev.actorId;
    prev.assignedToActorId = card.assignedToActorId || prev.assignedToActorId;
    prev.assignedToNodeId = card.assignedToNodeId || prev.assignedToNodeId;
    prev.sourceNodeId = card.sourceNodeId || prev.sourceNodeId;
    prev.orgId = card.orgId || prev.orgId;
    prev.territoryId = card.territoryId || prev.territoryId;
    prev.participants = uniq([...(prev.participants || []), ...(card.participants || [])]);
    prev.unreadBy = uniq([...(prev.unreadBy || []), ...(card.unreadBy || [])]);
    prev.budget = card.budget ?? prev.budget;
    prev.quantity = card.quantity ?? prev.quantity;
    prev.materialCount = card.materialCount ?? prev.materialCount;
    prev.requiredCapabilities = uniq([
      ...(prev.requiredCapabilities || []),
      ...(card.requiredCapabilities || []),
    ]);
    prev.events.push(card);

    if (card.kind === "work.intent") prev.base = chooseBase(prev.base, card);
    if (card.kind === "mo.fabrication.pack") prev.pack = card;
    if (card.kind === "work.plan") prev.plan = card;
    if (card.kind === "work.quote" || card.kind === "work.quote.accepted") prev.quote = card;
    if (card.kind === "work.execution") prev.execution = card;
    if (card.kind === "work.outcome") prev.outcome = card;

    map.set(key, prev);
  }

  return Array.from(map.values())
    .map((agg) => {
      if (!agg.base && agg.pack) agg.base = agg.pack;
      const preferred = agg.base || agg.plan || agg.pack || agg.execution || agg.outcome;
      if (preferred) {
        agg.title = preferred.title || agg.title;
        agg.subtitle = preferred.subtitle || agg.subtitle;
      }

      if (agg.outcome) {
        agg.status = agg.outcome.status;
      } else if (agg.execution) {
        agg.status = "in_progress";
      } else if (agg.plan) {
        agg.status = agg.plan.status || "planned";
      } else if (agg.quote) {
        agg.status = agg.quote.status || "quoted";
      } else if (agg.base) {
        agg.status = agg.base.status || "open";
      }

      agg.technicalOnly = !agg.events.some((event) => event.kind === "work.intent");
      agg.actionable =
        !agg.technicalOnly &&
        ["open", "planned", "quoted", "in_progress"].includes(agg.status);
      return agg;
    })
    .sort((a, b) => {
      const latest = (item: WorkAggregate) =>
        Math.max(0, ...item.events.map((event) => event.createdAt || 0));
      return latest(b) - latest(a);
    });
}

function semantic(value: unknown) {
  return safeStr(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function identityValues(dv: any) {
  const attrs = attrsOf(dv);
  const meta = metaOf(dv);
  return uniq([
    dv?.id,
    attrs.actorId,
    attrs.nodeId,
    attrs.orgId,
    attrs.owner?.actorId,
    attrs.owner?.nodeId,
    attrs.author?.id,
    attrs.author?.nodeId,
    attrs.provider?.id,
    attrs.provider?.nodeId,
    meta.actor,
    meta.authority,
    meta.originNode,
  ]);
}

function providerCapabilityTerms(dv: any) {
  const attrs = attrsOf(dv);
  return uniq([
    ...capabilityStrings(attrs.capabilities),
    ...capabilityStrings(attrs.providedCapabilities),
    ...capabilityStrings(attrs.domains),
    ...capabilityStrings(attrs.services),
    ...capabilityStrings(attrs.role),
    ...(Array.isArray(dv?.traits)
      ? dv.traits
          .filter((trait: string) =>
            /capability|work:domain|service|transport|delivery|fabrication|install/i.test(
              String(trait),
            ),
          )
          .map(String)
      : []),
  ]);
}

function termMatches(required: string, provided: string) {
  const need = semantic(required);
  const have = semantic(provided);
  if (!need || !have) return false;
  if (need === have || need.includes(have) || have.includes(need)) return true;
  const needWords = new Set(need.split(" ").filter((word) => word.length >= 4));
  const haveWords = new Set(have.split(" ").filter((word) => word.length >= 4));
  return Array.from(needWords).some((word) => haveWords.has(word));
}

export type WorkEligibility = {
  eligible: boolean;
  reason: string;
  matchedCapabilities: string[];
  requiredCapabilities: string[];
  providerCapabilities: string[];
  consentRequired: boolean;
};

/** Verifica capacidad publicada, territorio y disponibilidad antes de tomar. */
export function deriveWorkEligibility(
  allLive: any[],
  work: WorkAggregate,
  actor: {
    actorId?: string | null;
    nodeId?: string | null;
    orgId?: string | null;
    territoryId?: string | null;
  },
): WorkEligibility {
  const identities = new Set(
    uniq([actor.actorId, actor.nodeId, actor.orgId]).map(String),
  );
  const sources = (allLive || []).filter((dv) =>
    identityValues(dv).some((id) => identities.has(id)),
  );
  const providerCapabilities = uniq(sources.flatMap(providerCapabilityTerms));
  const requiredCapabilities = uniq(work.requiredCapabilities || []);
  const matchedCapabilities = requiredCapabilities.filter((required) =>
    providerCapabilities.some((provided) => termMatches(required, provided)),
  );
  const territoryMismatch = Boolean(
    actor.territoryId &&
      work.territoryId &&
      String(actor.territoryId) !== String(work.territoryId),
  );
  const unavailable = sources.some((dv) => {
    const attrs = attrsOf(dv);
    const status = semantic(
      attrs?.availability?.status || attrs?.availability || attrs?.status,
    );
    return ["offline", "unavailable", "no disponible"].includes(status);
  });
  const hasRequiredMatch =
    requiredCapabilities.length > 0 && matchedCapabilities.length > 0;
  const eligible =
    identities.size > 0 &&
    providerCapabilities.length > 0 &&
    hasRequiredMatch &&
    !territoryMismatch &&
    !unavailable;
  const firstRequirement = requiredCapabilities[0] || "una capacidad compatible";
  const consentRequired =
    work.base?.source?.attrs?.security?.requiresConsent !== false;

  return {
    eligible,
    reason: territoryMismatch
      ? "Fuera de la zona de este trabajo"
      : unavailable
        ? "Tu capacidad figura como no disponible"
        : !providerCapabilities.length
          ? "Publicá una capacidad compatible para tomar este trabajo"
          : !hasRequiredMatch
            ? `Necesita ${firstRequirement}`
            : consentRequired
              ? "Tu capacidad coincide; tomarlo requiere tu confirmación"
              : "Tu capacidad coincide",
    matchedCapabilities,
    requiredCapabilities,
    providerCapabilities,
    consentRequired,
  };
}

export function isWorkAssignedTo(
  work: WorkAggregate,
  actor: {
    actorId?: string | null;
    nodeId?: string | null;
    orgId?: string | null;
  },
) {
  const actorId = safeStr(actor.actorId);
  const nodeId = safeStr(actor.nodeId);
  const orgId = safeStr(actor.orgId);
  return Boolean(
    (actorId &&
      [work.assignedToActorId, work.actorId]
        .map((value) => safeStr(value))
        .includes(actorId)) ||
      (nodeId &&
        [work.assignedToNodeId, work.sourceNodeId]
          .map((value) => safeStr(value))
          .includes(nodeId)) ||
      (orgId && safeStr(work.orgId) === orgId),
  );
}

export function humanWorkDomain(domain: string) {
  const value = semantic(domain);
  if (/transport|delivery|logistic/.test(value)) return "Entrega";
  if (/install|mount|finishing/.test(value)) return "Instalación";
  if (/fabric|produc|manufact/.test(value)) return "Fabricación";
  if (/repair|repar|adapt/.test(value)) return "Reparación";
  if (/material|supply/.test(value)) return "Materiales";
  if (/design|disen/.test(value)) return "Diseño";
  return "Trabajo";
}

export function workDomainIcon(domain: string) {
  const label = humanWorkDomain(domain);
  if (label === "Entrega") return "🚚";
  if (label === "Instalación") return "🛠️";
  if (label === "Fabricación") return "🏭";
  if (label === "Reparación") return "🔧";
  if (label === "Materiales") return "🪵";
  if (label === "Diseño") return "✏️";
  return "✨";
}
