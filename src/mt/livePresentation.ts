// Universal live-DV presentation helpers. These never persist or mutate DVs.
function text(...values: any[]): string {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function firstMedia(value: any): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) for (const entry of value) { const found = firstMedia(entry); if (found) return found; }
  if (value && typeof value === "object") return text(value.url, value.src, value.href, value.dataUrl);
  return "";
}

type LiveList = any[];

// La lista de DVs cambia de referencia solamente cuando liveStore publica una
// revisión. Estos índices viven lo mismo que esa revisión y el GC los libera;
// no son otro store ni conservan una verdad paralela.
const manifestIndexByLive = new WeakMap<LiveList, Map<string, any>>();
const sellerCacheByLive = new WeakMap<LiveList, WeakMap<object, string>>();
const imageCacheByLive = new WeakMap<LiveList, WeakMap<object, string>>();

function manifestAliases(candidate: any): string[] {
  return [
    candidate?.id,
    candidate?.attrs?.nodeId,
    candidate?.attrs?.id,
    candidate?.meta?.originNode,
    candidate?.meta?.authority,
  ]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean);
}

function manifestIndex(allLive: LiveList): Map<string, any> {
  const cached = manifestIndexByLive.get(allLive);
  if (cached) return cached;

  const index = new Map<string, any>();
  for (const candidate of allLive) {
    const kind = text(candidate?.kind).toLowerCase();
    const traits = Array.isArray(candidate?.traits)
      ? candidate.traits.map((value: any) => String(value).toLowerCase())
      : [];
    if (!kind.includes("manifest") && !traits.some((value: string) => value.includes("node:manifest"))) {
      continue;
    }
    for (const alias of manifestAliases(candidate)) {
      if (!index.has(alias)) index.set(alias, candidate);
    }
  }
  manifestIndexByLive.set(allLive, index);
  return index;
}

function objectCache(
  owner: WeakMap<LiveList, WeakMap<object, string>>,
  allLive: LiveList,
): WeakMap<object, string> {
  const cached = owner.get(allLive);
  if (cached) return cached;
  const next = new WeakMap<object, string>();
  owner.set(allLive, next);
  return next;
}

export function liveNodeId(item: any): string {
  return text(item?.attrs?.nodeId, item?.attrs?.storeId, item?.attrs?.originNode, item?.attrs?.author?.nodeId,
    item?.attrs?.source?.node, item?.meta?.originNode, item?.meta?.nodeId, item?.meta?.storeId,
    item?.sourceNode, item?.sellerId, item?.meta?.authority);
}

function nodeManifest(item: any, allLive: any[]): any | null {
  const nodeId = liveNodeId(item).toLowerCase();
  if (!nodeId) return null;
  const live = Array.isArray(allLive) ? allLive : [];
  return manifestIndex(live).get(nodeId) || null;
}

export function resolveLiveSeller(item: any, allLive: any[] = []): string {
  const live = Array.isArray(allLive) ? allLive : [];
  const cache = item && typeof item === "object" ? objectCache(sellerCacheByLive, live) : null;
  const cached = cache?.get(item);
  if (cached !== undefined) return cached;
  const manifest = nodeManifest(item, allLive);
  const resolved = text(item?.attrs?.storeName, item?.attrs?.sellerName, item?.attrs?.nodeName, item?.storeName,
    item?.sellerName, item?.nodeName, item?.attrs?.tienda, item?.attrs?.vendedor, item?.attrs?.vendor?.name,
    item?.attrs?.author?.name, item?.attrs?.contact?.sellerName, item?.meta?.storeName, item?.meta?.sellerName,
    item?.meta?.nodeName, item?.meta?.seller?.name, item?.productor?.nombre, manifest?.attrs?.storeName,
    manifest?.attrs?.sellerName, manifest?.attrs?.nodeName, manifest?.attrs?.name, manifest?.name,
    item?.meta?.authority, item?.attrs?.storeId, item?.attrs?.sellerId) || "Nodo vendedor";
  cache?.set(item, resolved);
  return resolved;
}

export function rawLiveImage(item: any): string {
  return firstMedia(item?.attrs?.image ?? item?.attrs?.imagen ?? item?.attrs?.imageUrl ?? item?.attrs?.image_url ??
    item?.attrs?.gallery?.[0] ?? item?.attrs?.images?.[0] ?? item?.image ?? item?.imagen ?? item?.imageUrl ??
    item?.image_url ?? item?.gallery?.[0] ?? item?.images?.[0] ?? item?.cover ?? item?.meta?.media?.image ??
    item?.attrs?.media?.image);
}

function originOf(item: any, allLive: any[]): string {
  const manifest = nodeManifest(item, allLive);
  return text(item?.attrs?.catalogUrl, item?.attrs?.origin, item?.attrs?.baseUrl, item?.attrs?.publicUrl,
    item?.meta?.sourceCatalogUrl, item?.meta?.sourceUrl, item?.meta?.catalogUrl, item?.meta?.origin, item?.meta?.baseUrl, item?.meta?.publicUrl,
    manifest?.attrs?.catalogUrl, manifest?.attrs?.origin, manifest?.attrs?.baseUrl, manifest?.attrs?.publicUrl,
    manifest?.meta?.sourceUrl, manifest?.catalogUrl, manifest?.origin, manifest?.baseUrl, manifest?.publicUrl);
}

export function resolveLiveImage(item: any, allLive: any[] = []): string {
  const live = Array.isArray(allLive) ? allLive : [];
  const cache = item && typeof item === "object" ? objectCache(imageCacheByLive, live) : null;
  const cached = cache?.get(item);
  if (cached !== undefined) return cached;
  const raw = rawLiveImage(item);
  if (!raw) {
    cache?.set(item, "");
    return "";
  }
  if (/^(https?:|blob:|data:image\/)/i.test(raw)) {
    cache?.set(item, raw);
    return raw;
  }
  const origin = originOf(item, allLive);
  if (!origin) {
    cache?.set(item, "");
    return "";
  }
  try {
    const resolved = new URL(raw, origin).toString();
    cache?.set(item, resolved);
    return resolved;
  } catch {
    cache?.set(item, "");
    return "";
  }
}

export function liveTitle(item: any): string {
  return text(item?.attrs?.nombre, item?.attrs?.name, item?.attrs?.title, item?.nombre, item?.name,
    item?.title, item?.labels?.[0], "Resultado vivo");
}

export function livePrice(item: any): number | null {
  const parsed = Number(item?.attrs?.precio ?? item?.attrs?.price ?? item?.precio ?? item?.price);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function liveTime(item: any): number {
  const raw = item?.meta?.updatedAt || item?.meta?.ts || item?.attrs?.updatedAt || item?.attrs?.ts;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw < 1e10 ? raw * 1000 : raw;
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function relativeLiveTime(item: any, now = Date.now()): string {
  const timestamp = liveTime(item);
  if (!timestamp) return "Ahora";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
}

export function resolveHumanIdentityName(item: any, allLive: any[] = []): string {
  const direct = text(
    item?.attrs?.actorName,
    item?.attrs?.actor?.name,
    item?.attrs?.requesterName,
    item?.attrs?.providerName,
    item?.attrs?.sellerName,
    item?.attrs?.storeName,
    item?.attrs?.nodeName,
    item?.attrs?.author?.name,
    item?.meta?.actorName,
    item?.meta?.storeName,
  );
  if (direct && !/^(actor|buyer|node|did|urn):/i.test(direct)) return direct;
  const seller = resolveLiveSeller(item, allLive);
  return seller === "Nodo vendedor" || /^(actor|buyer|node|did|urn):/i.test(seller)
    ? "Alguien de la red"
    : seller;
}

export function humanizeLiveDomain(value: any): string {
  const normalized = text(value).toLowerCase();
  if (!normalized) return "Actividad cercana";
  if (/delivery|transport|logistic/.test(normalized)) return "Entrega y transporte";
  if (/wood|carp|furniture|mueble|fabric/.test(normalized)) return "Fabricación y muebles";
  if (/food|milk|coffee|alimento|leche|caf/.test(normalized)) return "Alimentos";
  if (/repair|repar/.test(normalized)) return "Reparación";
  if (/reus|recycl|circular|waste|material/.test(normalized)) return "Materiales circulares";
  if (/finance|credit|liquid/.test(normalized)) return "Financiación";
  if (/property|space|realestate/.test(normalized)) return "Espacios";
  return normalized
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function humanizeCapability(value: any): string {
  const normalized = text(value?.label, value?.name, value).toLowerCase();
  if (/deliver|transport|pickup|logistic/.test(normalized)) return "Puede transportar";
  if (/manufact|fabric|build|carp|wood/.test(normalized)) return "Puede fabricar";
  if (/repair|fix/.test(normalized)) return "Puede reparar";
  if (/finance|credit/.test(normalized)) return "Puede financiar";
  if (/store|warehouse|storage/.test(normalized)) return "Puede almacenar";
  if (/transform|recycl|reuse/.test(normalized)) return "Puede transformar o reutilizar";
  return normalized ? humanizeLiveDomain(normalized) : "Puede ayudar";
}

export type HumanLiveActivity = {
  id: string;
  dv: any;
  nodeKey: string;
  actorName: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  timestamp: number;
  category: string;
  own: boolean;
};

export function humanizeActivityDV(
  item: any,
  allLive: any[] = [],
  actorId = "",
): HumanLiveActivity | null {
  const kind = text(item?.kind).toLowerCase();
  if (!kind || /manifest|heartbeat|presence\.signal|resonance\.frequency/.test(kind)) return null;
  const attrs = item?.attrs || {};
  const title = liveTitle(item);
  const material = text(attrs.materialName, attrs.productName, attrs.resource, attrs.intent?.resources?.[0]);
  const quantity = Number(attrs.quantity ?? attrs.cantidad ?? attrs.qty ?? 0);
  const unit = text(attrs.unit, attrs.unidad, "u");
  const amount = quantity > 0 ? `${quantity} ${unit}` : "";
  const actorName = resolveHumanIdentityName(item, allLive);
  const domain = humanizeLiveDomain(attrs.domain || attrs.category || kind);
  let icon = "✨";
  let humanTitle = `${actorName} compartió una actividad`;
  let detail = text(attrs.description, attrs.note, domain);

  if (/market\.order\.create/.test(kind)) {
    icon = "🛒";
    humanTitle = `${actorName} envió un pedido`;
    detail = title;
  } else if (/market\.order\.accept/.test(kind)) {
    icon = "🤝";
    humanTitle = `${actorName} aceptó un pedido`;
    detail = title;
  } else if (/delivery\.(request|intent)/.test(kind)) {
    icon = "🚚";
    humanTitle = `${actorName} necesita una entrega`;
    detail = title;
  } else if (/delivery\.(delivered|status)/.test(kind)) {
    icon = "📍";
    humanTitle = `${actorName} actualizó una entrega`;
    detail = text(attrs.state, attrs.status, title);
  } else if (/work\.intent/.test(kind)) {
    icon = "🧰";
    humanTitle = `${actorName} necesita ayuda`;
    detail = text(title, domain);
  } else if (/work\.quote/.test(kind)) {
    icon = "📋";
    humanTitle = `${actorName} envió una cotización`;
    detail = title;
  } else if (/capability|service\.offer/.test(kind)) {
    icon = "🛠️";
    humanTitle = `${actorName} puede ayudar`;
    detail = humanizeCapability(attrs.capability || attrs.capabilities?.[0] || attrs.domain);
  } else if (/demand|need/.test(kind)) {
    icon = "⚡";
    humanTitle = `${actorName} necesita ${material || title}`;
    detail = amount || domain;
  } else if (/offer|product|producto|mt:producto/.test(kind)) {
    icon = "🌱";
    humanTitle = `${actorName} ofrece ${material || title}`;
    detail = amount || domain;
  } else if (/value\.contribution/.test(kind)) {
    icon = "✨";
    humanTitle = `${actorName} realizó un aporte`;
    detail = /delivery/.test(text(attrs.type, attrs.domain).toLowerCase())
      ? "Entrega realizada"
      : /material|supply/.test(text(attrs.type, attrs.domain).toLowerCase())
        ? "Material aportado"
        : /finance/.test(text(attrs.type, attrs.domain).toLowerCase())
          ? "Financiación aportada"
          : /work|labor/.test(text(attrs.type, attrs.domain).toLowerCase())
            ? "Trabajo realizado"
            : "Aporte realizado";
  } else if (/outcome|fulfilled|completed/.test(kind)) {
    icon = "✅";
    humanTitle = `${actorName} completó una operación`;
    detail = title;
  }

  const itemActorId = text(attrs.actorId, attrs.actor?.id, item?.meta?.issuer);
  const nodeKey = liveNodeId(item) || itemActorId || String(item?.id || "activity");
  return {
    id: String(item?.id || `${kind}:${liveTime(item)}`),
    dv: item,
    nodeKey,
    actorName,
    icon,
    title: humanTitle,
    detail,
    time: relativeLiveTime(item),
    timestamp: liveTime(item),
    category: domain,
    own: Boolean(actorId && itemActorId === actorId),
  };
}

export function collectHumanLiveActivity(
  allLive: any[] = [],
  actorId = "",
  limit = 40,
): HumanLiveActivity[] {
  const seen = new Set<string>();
  return allLive
    .filter((item) => {
      const scopes = Array.isArray(item?.meta?.scopes)
        ? item.meta.scopes.map(String)
        : [];
      const participants = Array.isArray(item?.attrs?.participants)
        ? item.attrs.participants.map(String)
        : [];
      const restricted =
        item?.meta?.sensitivity === "sensitive" ||
        (scopes.length > 0 && !scopes.includes("public"));
      return !restricted || Boolean(actorId && participants.includes(actorId));
    })
    .map((item) => humanizeActivityDV(item, allLive, actorId))
    .filter((item): item is HumanLiveActivity => Boolean(item))
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item) => {
      const operationKey = text(
        item.dv?.attrs?.chainId,
        item.dv?.attrs?.orderId,
        item.dv?.attrs?.workId,
        item.dv?.attrs?.relationshipId,
        item.id,
      );
      const key = `${item.nodeKey}:${item.dv?.kind}:${operationKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
