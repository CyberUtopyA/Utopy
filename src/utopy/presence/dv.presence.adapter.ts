import type {
  PresenceAction,
  PresenceKind,
  PresenceScanInput,
} from "./presence.types";
import type {
  DVLike,
  ResonanceCapability,
  ResonanceGeo,
  ResonanceIntent,
} from "./resonance.types";

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function kindToPresence(kind: string): PresenceKind {
  const value = kind.toLowerCase();
  if (value === "match.proposal") return "match";
  if (value.includes("need") || value.includes("demand")) return "need";
  if (value.includes("work")) return "work";
  if (
    value.includes("material") ||
    value.includes("waste") ||
    value.includes("mining")
  ) {
    return "material";
  }
  if (value.includes("capability")) return "capability";
  if (value.includes("offer")) return "offer";
  if (value.includes("order")) return "order";
  if (value.includes("product")) return "product";
  if (value.includes("plan") || value.includes("project")) return "project";
  if (value.includes("presence")) return "presence.signal";
  return kind || "custom";
}

function readGeo(dv: DVLike): ResonanceGeo | null {
  const attrs = dv.attrs || {};
  const value =
    attrs.geo ||
    attrs.location ||
    (attrs.lat != null ? { lat: attrs.lat, lng: attrs.lng ?? attrs.lon } : null);
  const lat = Number(value?.lat);
  const lng = Number(value?.lng ?? value?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { ...value, lat, lng };
}

function expiresAt(dv: DVLike): number | null {
  const explicit = Number(dv.attrs?.frequency?.expiresAt || dv.attrs?.expiresAt);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const ts = Number(dv.ts || 0);
  const ttl = Number(dv.meta?.ttl_ms || 0);
  return ts > 0 && ttl > 0 ? ts + ttl : null;
}

function action(
  id: string,
  type: PresenceAction["type"],
  label: string,
  payload: Record<string, any>,
  priority: number
): PresenceAction {
  return {
    id,
    type,
    label,
    payload,
    priority,
    requiresConsent: true,
  };
}

function genericActions(dv: DVLike): PresenceAction[] {
  const attrs = dv.attrs || {};
  const actions: PresenceAction[] = [];
  const threadId = text(attrs.threadId || attrs.target?.threadId || dv.meta?.threadId);
  const whatsapp = text(
    attrs.contact?.whatsapp || attrs.contact?.phone || attrs.whatsapp
  );
  const geo = readGeo(dv);

  if (threadId) {
    actions.push(
      action("open-thread", "open_thread", "Abrir conversación", { threadId }, 20)
    );
  }
  if (whatsapp) {
    actions.push(
      action(
        "open-whatsapp",
        "open_whatsapp",
        "Consultar directo",
        { whatsapp, dvId: dv.id },
        18
      )
    );
  }
  if (geo) {
    actions.push(
      action("open-map", "open_map", "Ver en el mapa", { geo, dvId: dv.id }, 8)
    );
  }

  if (dv.kind === "match.proposal") {
    actions.unshift(
      action(
        "respond-signal",
        "respond_signal",
        "Responder a la resonancia",
        { proposalId: dv.id },
        30
      )
    );
  } else {
    actions.push(
      action(
        "request-utopy",
        "request_utopy",
        "Solicitar por UTOPY",
        { dvId: dv.id, kind: dv.kind },
        16
      )
    );
  }

  return actions;
}

export function canProjectDVToPresence(dv: DVLike | null | undefined): boolean {
  if (!dv?.id || !dv.kind) return false;
  if (dv.kind === "catalog.source") return false;
  const traits = list(dv.traits);
  return Boolean(
    dv.attrs?.intent ||
      dv.attrs?.capabilities ||
      dv.attrs?.frequency ||
      dv.attrs?.geo ||
      dv.attrs?.location ||
      traits.some((trait) =>
        /resonance|presence|capability|circular|material|work|supply|demand/.test(
          trait.toLowerCase()
        )
      ) ||
      /need|demand|offer|work|material|waste|capability|presence|match|plan/.test(
        dv.kind.toLowerCase()
      )
  );
}

export function dvToPresenceInput(dv: DVLike): PresenceScanInput {
  const attrs = dv.attrs || {};
  const labels = list(dv.labels);
  const actor = attrs.actor || {};
  const target = attrs.target || {};
  const frequency = attrs.frequency || {};
  const intent = (attrs.intent || null) as ResonanceIntent | null;
  const capabilities = Array.isArray(attrs.capabilities)
    ? (attrs.capabilities as ResonanceCapability[])
    : [];

  return {
    id: `presence:${dv.id}`,
    nodeId: text(actor.nodeId || attrs.node?.id || dv.meta?.originNode) || undefined,
    ns: text(dv.meta?.ns) || "utopy:resonance",
    kind: kindToPresence(dv.kind),
    title: labels[0] || text(attrs.title) || dv.kind.replace(/[.:_-]+/g, " "),
    subtitle:
      labels[1] ||
      (intent?.mode ? `Señal ${intent.mode}` : capabilities.length ? "Puede ayudarte con esto" : "Señal viva"),
    description: labels[2] || text(attrs.description),
    labels,
    strength: Number(attrs.proximity ?? attrs.strength ?? 0.72),
    distanceLabel: text(attrs.distanceHint),
    image: text(attrs.image || attrs.imagen) || null,
    actorId: text(actor.id || attrs.actorId || dv.meta?.by) || null,
    productId: text(attrs.productId || attrs.productoId) || null,
    offerId: /offer/.test(dv.kind) ? dv.id : text(attrs.offerId) || null,
    orderId: /order/.test(dv.kind) ? dv.id : text(attrs.orderId) || null,
    threadId: text(attrs.threadId || target.threadId || dv.meta?.threadId) || null,
    sessionId: text(attrs.sessionId || frequency.sessionId) || null,
    scope: text(attrs.scope) || null,
    stage: text(attrs.stage || attrs.status) || null,
    sourceDVId: text(attrs.source?.dvId || target.id || dv.id) || null,
    entryMethod: text(attrs.entryMethod || (frequency.protocol ? "resonance" : "manual")),
    geo: readGeo(dv),
    intent,
    capabilities,
    signature: text(frequency.signature) || null,
    verified: Boolean(dv.meta?.signature),
    expiresAt: expiresAt(dv),
    actions: genericActions(dv),
    meta: { ...(dv.meta || {}), sourceKind: dv.kind },
    sourceDV: dv,
    ts: dv.ts || dv.meta?.ts,
  };
}

export function projectDVsToPresence(dvs: DVLike[]): PresenceScanInput[] {
  return (dvs || []).filter(canProjectDVToPresence).map(dvToPresenceInput);
}
