import { mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";

type AnyDV = any;

export type CircularChainStage =
  | "need"
  | "design"
  | "fabrication"
  | "material_demand"
  | "material_purchase"
  | "production"
  | "sale"
  | "resale"
  | "delivery"
  | "completed";

export type CircularChainStatus =
  | "open"
  | "waiting_confirmation"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CircularChainEventInput = {
  chainId: string;
  rootDvId?: string | null;
  parentDvId?: string | null;
  sourceDvIds?: string[];
  stage: CircularChainStage;
  status?: CircularChainStatus | string;
  action?: string | null;
  title?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  threadId?: string | null;
  capabilities?: string[];
  confirmed?: boolean;
  data?: Record<string, any>;
  scopes?: string[];
  testMode?: boolean;
};

export type CircularChainSnapshot = {
  chainId: string;
  rootDvId: string | null;
  title: string;
  currentStage: CircularChainStage;
  status: CircularChainStatus;
  progress: number;
  nextAction: string | null;
  nextStage: CircularChainStage | null;
  eventCount: number;
  eventIds: string[];
  participants: Array<{
    actorId: string;
    actorName: string;
    nodeId: string | null;
  }>;
  updatedAt: string;
  geo: { lat: number; lng: number } | null;
  events: AnyDV[];
};

const STAGES: CircularChainStage[] = [
  "need",
  "design",
  "fabrication",
  "material_demand",
  "material_purchase",
  "production",
  "sale",
  "resale",
  "delivery",
  "completed",
];

const NEXT: Record<
  CircularChainStage,
  { stage: CircularChainStage | null; action: string | null }
> = {
  need: { stage: "design", action: "Confirmar diseño y presupuesto" },
  design: { stage: "fabrication", action: "Confirmar fabricante compatible" },
  fabrication: {
    stage: "material_demand",
    action: "Publicar los materiales necesarios",
  },
  material_demand: {
    stage: "material_purchase",
    action: "Confirmar proveedor y compra del material",
  },
  material_purchase: {
    stage: "production",
    action: "Confirmar recepción e iniciar producción",
  },
  production: { stage: "sale", action: "Publicar el producto terminado" },
  sale: {
    stage: "delivery",
    action: "Confirmar comprador y entrega, o crear una reventa",
  },
  resale: { stage: "delivery", action: "Confirmar venta y entrega final" },
  delivery: { stage: "completed", action: "Completar la cadena viva" },
  completed: { stage: null, action: null },
};

function safeStr(value: any): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
    ? ""
    : String(value).trim();
}

function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(value: any): string[] {
  return Array.from(
    new Set(safeArray(value).map(safeStr).filter(Boolean))
  );
}

function tsOf(dv: AnyDV): number {
  const raw = dv?.meta?.ts ?? dv?.attrs?.ts ?? dv?.ts ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoOf(dv: AnyDV): string {
  const n = tsOf(dv);
  return n > 0 ? new Date(n).toISOString() : new Date(0).toISOString();
}

function explicitChainId(dv: AnyDV): string {
  return safeStr(
    dv?.attrs?.chainId ??
      dv?.meta?.chainId ??
      dv?.chainId ??
      dv?.attrs?.chain?.id ??
      dv?.meta?.chain?.id
  );
}

function referencesOf(dv: AnyDV): string[] {
  const attrs = dv?.attrs || {};
  const meta = dv?.meta || {};

  return uniqueStrings([
    attrs.parentDvId,
    attrs.rootDvId,
    attrs.sourceDvId,
    attrs.designDvId,
    attrs.offerId,
    attrs.productId,
    attrs.workId,
    attrs.orderId,
    attrs.respondsTo,
    meta.respondsTo,
    meta.parentDvId,
    ...safeArray(attrs.sourceDvIds),
    ...safeArray(meta.sourceDvIds),
  ]);
}

function geoOf(dv: AnyDV): { lat: number; lng: number } | null {
  const candidates = [
    dv?.attrs?.geo,
    dv?.attrs?.location,
    dv?.attrs,
    dv?.geo,
    dv?.location,
    dv,
    dv?.meta?.geo,
    dv?.meta?.location,
  ];

  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const lat = Number(item.lat ?? item.latitude);
    const lng = Number(item.lng ?? item.lon ?? item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    if (lat === 0 && lng === 0) continue;
    return { lat, lng };
  }

  return null;
}

function stageOf(dv: AnyDV): CircularChainStage {
  const explicit = safeStr(dv?.attrs?.stage ?? dv?.meta?.stage).toLowerCase();
  if ((STAGES as string[]).includes(explicit)) {
    return explicit as CircularChainStage;
  }

  const kind = safeStr(dv?.kind).toLowerCase();
  const domain = safeStr(dv?.attrs?.domain).toLowerCase();
  const traits = uniqueStrings(dv?.traits).join(" ").toLowerCase();
  const text = `${kind} ${domain} ${traits} ${safeStr(dv?.attrs?.title)}`;

  if (/chain\.completed|cycle\.completed/.test(text)) return "completed";
  if (/deliver|entrega/.test(text)) return "delivery";
  if (/resale|reventa|retail/.test(text)) return "resale";
  if (/product\.created|production\.completed|fabricado|producto terminado/.test(text)) {
    return "production";
  }
  if (/market\.order|payment\.|material\.purchase|compra material/.test(text)) {
    return "material_purchase";
  }
  if (kind === "mt:demand.material" || /material.demand|demanda material/.test(text)) {
    return "material_demand";
  }
  if (/design|diseñ|presupuesto/.test(text)) return "design";
  if (/fabricat|carpint|muebl|work\.intent/.test(text)) return "fabrication";
  if (kind === "mt:offer" || /sale|venta|offer/.test(text)) return "sale";
  return "need";
}

function statusOf(dv: AnyDV): CircularChainStatus {
  const raw = safeStr(
    dv?.attrs?.status ??
      dv?.attrs?.paymentStatus ??
      dv?.meta?.status ??
      dv?.status
  ).toLowerCase();

  if (/cancel|declin|reject/.test(raw)) return "cancelled";
  if (/complete|deliver|paid|settled|closed/.test(raw)) return "completed";
  if (/accept|confirm|approved/.test(raw)) return "accepted";
  if (/progress|working|production/.test(raw)) return "in_progress";
  if (dv?.attrs?.requiresConfirmation && dv?.attrs?.confirmed !== true) {
    return "waiting_confirmation";
  }
  return "open";
}

function isInternalAggregate(dv: AnyDV): boolean {
  const kind = safeStr(dv?.kind).toLowerCase();
  return kind === "circular.chain" || kind === "circular.chain.next";
}

/**
 * Resuelve pertenencia incluso cuando un pago o una orden sólo referencia
 * offerId/productId. Así Mercado no necesita duplicar la lógica de cadena.
 */
function resolveMembership(all: AnyDV[]): Map<string, string> {
  const membership = new Map<string, string>();
  const clean = all.filter((dv) => dv?.id && !isInternalAggregate(dv));

  for (const dv of clean) {
    const chainId = explicitChainId(dv);
    if (chainId) membership.set(safeStr(dv.id), chainId);
  }

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const dv of clean) {
      const id = safeStr(dv.id);
      if (!id || membership.has(id)) continue;
      const inherited = referencesOf(dv)
        .map((ref) => membership.get(ref))
        .find(Boolean);
      if (!inherited) continue;
      membership.set(id, inherited);
      changed = true;
    }
    if (!changed) break;
  }

  return membership;
}

function snapshotFor(
  chainId: string,
  events: AnyDV[]
): CircularChainSnapshot | null {
  const ordered = [...events].sort((a, b) => tsOf(a) - tsOf(b));
  if (!ordered.length) return null;

  const staged = ordered.map((dv) => ({ dv, stage: stageOf(dv) }));
  const last = staged.reduce((best, current) => {
    const bestIndex = STAGES.indexOf(best.stage);
    const currentIndex = STAGES.indexOf(current.stage);
    if (currentIndex > bestIndex) return current;
    if (currentIndex === bestIndex && tsOf(current.dv) >= tsOf(best.dv)) {
      return current;
    }
    return best;
  });

  const completed = staged.some(
    ({ dv, stage }) => stage === "completed" && statusOf(dv) !== "cancelled"
  );
  const currentStage: CircularChainStage = completed
    ? "completed"
    : last.stage;
  const currentStatus: CircularChainStatus = completed
    ? "completed"
    : statusOf(last.dv);
  const currentIndex = STAGES.indexOf(currentStage);
  const progress = Math.max(
    0,
    Math.min(100, Math.round((currentIndex / (STAGES.length - 1)) * 100))
  );

  const participantMap = new Map<string, CircularChainSnapshot["participants"][number]>();
  for (const dv of ordered) {
    const actorId = safeStr(
      dv?.attrs?.actorId ?? dv?.attrs?.sellerId ?? dv?.attrs?.buyerId
    );
    if (!actorId) continue;
    participantMap.set(actorId, {
      actorId,
      actorName:
        safeStr(
          dv?.attrs?.actorName ?? dv?.attrs?.sellerName ?? dv?.attrs?.buyerName
        ) || actorId,
      nodeId: safeStr(dv?.attrs?.nodeId) || null,
    });
  }

  const root =
    ordered.find((dv) => safeStr(dv?.attrs?.rootDvId) === safeStr(dv?.id)) ||
    ordered.find((dv) => stageOf(dv) === "need") ||
    ordered[0];
  const rootDvId =
    safeStr(root?.attrs?.rootDvId) || safeStr(root?.id) || null;
  const updatedAt = isoOf(ordered[ordered.length - 1]);
  const next = NEXT[currentStage];
  const geo = ordered.map(geoOf).find(Boolean) || null;

  return {
    chainId,
    rootDvId,
    title:
      safeStr(root?.attrs?.title) ||
      safeStr(ordered[0]?.attrs?.title) ||
      "Cadena circular",
    currentStage,
    status: currentStatus,
    progress,
    nextAction: next.action,
    nextStage: next.stage,
    eventCount: ordered.length,
    eventIds: ordered.map((dv) => safeStr(dv.id)).filter(Boolean),
    participants: Array.from(participantMap.values()),
    updatedAt,
    geo,
    events: ordered,
  };
}

export function collectCircularChainSnapshots(all: AnyDV[]): CircularChainSnapshot[] {
  const clean = safeArray(all).filter((dv) => dv && !isInternalAggregate(dv));
  const membership = resolveMembership(clean);
  const groups = new Map<string, AnyDV[]>();

  for (const dv of clean) {
    const chainId = membership.get(safeStr(dv.id));
    if (!chainId) continue;
    const group = groups.get(chainId) || [];
    group.push(dv);
    groups.set(chainId, group);
  }

  return Array.from(groups.entries())
    .map(([chainId, events]) => snapshotFor(chainId, events))
    .filter((item): item is CircularChainSnapshot => !!item)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function circularChainSnapshotDV(snapshot: CircularChainSnapshot): AnyDV {
  return {
    id: `circular.chain:${snapshot.chainId}`,
    kind: "circular.chain",
    attrs: {
      chainId: snapshot.chainId,
      rootDvId: snapshot.rootDvId,
      title: snapshot.title,
      currentStage: snapshot.currentStage,
      status: snapshot.status,
      progress: snapshot.progress,
      nextAction: snapshot.nextAction,
      nextStage: snapshot.nextStage,
      eventCount: snapshot.eventCount,
      eventIds: snapshot.eventIds,
      participants: snapshot.participants,
      updatedAt: snapshot.updatedAt,
      geo: snapshot.geo,
      location: snapshot.geo,
    },
    traits: ["mt:circular", "mt:chain", "sem:lineage", "consent:required"],
    meta: {
      ns: "mt:market",
      ts: snapshot.updatedAt,
      chainId: snapshot.chainId,
      scopes: ["public"],
      schema: "utopy.circular.chain@1",
    },
  };
}

function eventFingerprint(snapshot: CircularChainSnapshot): string {
  return snapshot.events
    .map((dv) =>
      [
        safeStr(dv.id),
        stageOf(dv),
        statusOf(dv),
        safeStr(dv?.attrs?.confirmed),
        safeStr(dv?.meta?.ts ?? dv?.attrs?.ts),
      ].join("|")
    )
    .join("::");
}

export function createCircularChainId(prefix = "cycle"): string {
  return `mt.chain.${safeStr(prefix) || "cycle"}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function makeCircularChainEvent(input: CircularChainEventInput): AnyDV {
  const ts = new Date().toISOString();
  const id = `circular.chain.event:${input.chainId}:${input.stage}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const confirmed = input.confirmed === true;

  return {
    id,
    kind: "circular.chain.event",
    attrs: {
      chainId: input.chainId,
      rootDvId: input.rootDvId || null,
      parentDvId: input.parentDvId || null,
      sourceDvIds: uniqueStrings(input.sourceDvIds),
      stage: input.stage,
      status: input.status || (confirmed ? "accepted" : "waiting_confirmation"),
      action: input.action || null,
      title: input.title || `Etapa ${input.stage}`,
      actorId: input.actorId || null,
      actorName: input.actorName || null,
      nodeId: input.nodeId || null,
      threadId: input.threadId || null,
      capabilities: uniqueStrings(input.capabilities),
      requiresConfirmation: true,
      confirmed,
      confirmedAt: confirmed ? ts : null,
      testMode: input.testMode === true,
      data: input.data || {},
    },
    traits: [
      "mt:circular",
      "mt:chain:event",
      `mt:stage:${input.stage}`,
      "consent:explicit",
    ],
    meta: {
      ns: "mt:market",
      ts,
      chainId: input.chainId,
      threadId: input.threadId || null,
      scopes: input.scopes?.length ? input.scopes : ["public"],
      schema: "utopy.circular.chain.event@1",
      test: input.testMode === true,
    },
  };
}

export function publishCircularChainEvent(
  input: CircularChainEventInput,
  options: { broadcast?: boolean } = {}
): AnyDV {
  const dv = makeCircularChainEvent(input);
  mtLiveUpsert(dv);

  if (options.broadcast !== false) {
    try {
      window.dispatchEvent(
        new CustomEvent("utopy.emit", {
          detail: { ns: "mt", say: "dv.upsert", dv },
        })
      );
    } catch {
      // El store local sigue funcionando fuera del navegador.
    }
  }

  return dv;
}

type ChainRuntime = {
  refs: number;
  release: () => void;
};

let activeRuntime: ChainRuntime | null = null;

export function startCircularChainRuntime(): () => void {
  if (activeRuntime) {
    activeRuntime.refs += 1;
    return activeRuntime.release;
  }

  const fingerprints = new Map<string, string>();
  let stopped = false;

  const unsubscribe = mtLiveSubscribe((next: AnyDV[]) => {
    if (stopped) return;
    const snapshots = collectCircularChainSnapshots(next);

    for (const snapshot of snapshots) {
      const fingerprint = eventFingerprint(snapshot);
      if (fingerprints.get(snapshot.chainId) === fingerprint) continue;
      fingerprints.set(snapshot.chainId, fingerprint);
      mtLiveUpsert(circularChainSnapshotDV(snapshot));
    }
  });

  const runtime: ChainRuntime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;
      stopped = true;
      unsubscribe?.();
      if (activeRuntime === runtime) activeRuntime = null;
    },
  };

  activeRuntime = runtime;
  return runtime.release;
}
