export type DVLike = {
  id?: string;
  kind?: string;
  ts?: number;
  traits?: string[];
  labels?: string[];
  meta?: Record<string, any>;
  attrs?: Record<string, any>;
  [key: string]: any;
};

export type FalconDayliCategory =
  | "comida"
  | "super"
  | "farmacia"
  | "combos"
  | "recurrente";

export type FalconDayliFood = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  price: number | null;
  currency: string;
  cover: string;
  category: FalconDayliCategory;
  producerId?: string;
  producerName?: string;
  territoryId?: string;
  territoryName?: string;
  available?: boolean;
  tags: string[];
  ns: string;
  score: number;
  raw: DVLike;
};

export type FalconDayliProducer = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  territoryId?: string;
  territoryName?: string;
  categories: FalconDayliCategory[];
  tags: string[];
  ns: string;
  score: number;
  raw: DVLike;
};

export type FalconDayliTerritory = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  location?: string;
  tags: string[];
  ns: string;
  score: number;
  raw: DVLike;
};

export type FalconDayliState = {
  foods: FalconDayliFood[];
  producers: FalconDayliProducer[];
  territories: FalconDayliTerritory[];
};

export const DEFAULT_MT_DAYLI_NAMESPACES = [
  "mt:territory",
  "mt:food",
  "mt:market",
  "mt:producer",
  "mt:agro",
  "mt:farm",
  "mt:harvest",
];

export function parseNsList(raw?: string): string[] {
  if (!raw) return DEFAULT_MT_DAYLI_NAMESPACES;
  const parts = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  return parts.length ? parts : DEFAULT_MT_DAYLI_NAMESPACES;
}

export function safeJsonParse(x: any): any | null {
  if (!x) return null;
  if (typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      return JSON.parse(x);
    } catch {
      return null;
    }
  }
  return null;
}

export function safeText(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function num(x: any): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const cleaned = x.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function arr<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

export function normalizeImage(raw: any, mime = "image/png"): string {
  if (!raw || typeof raw !== "string") return "";
  const v = raw.trim();
  if (!v) return "";
  if (
    v.startsWith("data:image/") ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("blob:")
  ) {
    return v;
  }
  const looksBase64 =
    /^[A-Za-z0-9+/=\s]+$/.test(v) &&
    !v.includes("{") &&
    !v.includes("}");
  if (looksBase64) {
    return `data:${mime};base64,${v.replace(/\s+/g, "")}`;
  }
  return v;
}

export function looksLikeDV(raw: any): boolean {
  if (!raw || typeof raw !== "object") return false;
  const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
  if (!kind) return false;
  if (kind === "dv.upsert" || kind === "dato.upsert" || kind === "dato.create") return false;
  return true;
}

export function deepFindDV(x: any, depth = 0): any | null {
  if (!x || typeof x !== "object") return null;
  if (depth > 5) return null;

  if (looksLikeDV(x)) return x;

  const candidates = [
    x.dv,
    x.payload,
    x.payload?.dv,
    x.with?.dv,
    x.payload?.with?.dv,
    x.data,
    x.item,
    x.msg,
    x.body,
  ];

  for (const c of candidates) {
    const found = deepFindDV(c, depth + 1);
    if (found) return found;
  }

  return null;
}

export function extractDVFromAnyFrame(msg: any): DVLike | null {
  if (!msg || typeof msg !== "object") return null;

  if (msg?.ack && typeof msg?.echo === "string") {
    const echoed = safeJsonParse(msg.echo);
    if (!echoed) return null;
    return extractDVFromAnyFrame(echoed);
  }

  if (msg?.kind === "intent" && msg?.payload) {
    return deepFindDV(msg.payload);
  }

  return deepFindDV(msg);
}

export function getNs(raw: any): string {
  return safeText(
    raw?.meta?.ns,
    raw?.attrs?.meta?.ns,
    raw?.attrs?.ns,
    raw?.ns
  ).toLowerCase();
}

export function matchesNs(raw: any, targetNamespaces: string[]) {
  const ns = getNs(raw);
  if (!ns) return false;
  return targetNamespaces.some((t) => ns === t || ns.includes(t));
}

export function joinedSignals(raw: any): string {
  const traits = arr<string>(raw?.traits).map((x) => String(x).toLowerCase());
  const labels = arr<string>(raw?.labels).map((x) => String(x).toLowerCase());

  const blob = [
    safeText(raw?.kind),
    getNs(raw),
    safeText(raw?.title, raw?.name, raw?.nombre),
    safeText(raw?.description, raw?.summary),
    safeText(raw?.attrs?.title, raw?.attrs?.name, raw?.attrs?.nombre),
    safeText(raw?.attrs?.description, raw?.attrs?.summary),
    safeText(raw?.attrs?.category, raw?.attrs?.categoria),
    traits.join(" "),
    labels.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return blob;
}

export function isTerritoryDV(raw: any, targetNamespaces: string[]) {
  if (!raw) return false;
  const blob = joinedSignals(raw);
  return (
    matchesNs(raw, targetNamespaces) &&
    (blob.includes("territory") ||
      blob.includes("territorio") ||
      blob.includes("mt.territory") ||
      blob.includes("territory.upgrade"))
  );
}

export function isProducerDV(raw: any, targetNamespaces: string[]) {
  if (!raw) return false;
  const blob = joinedSignals(raw);
  return (
    matchesNs(raw, targetNamespaces) &&
    (blob.includes("producer") ||
      blob.includes("productor") ||
      blob.includes("proveedor") ||
      blob.includes("farm") ||
      blob.includes("granja"))
  );
}

export function isFoodDV(raw: any, targetNamespaces: string[]) {
  if (!raw) return false;
  const blob = joinedSignals(raw);
  return (
    matchesNs(raw, targetNamespaces) &&
    (blob.includes("food") ||
      blob.includes("comida") ||
      blob.includes("alimento") ||
      blob.includes("harvest") ||
      blob.includes("canasta") ||
      blob.includes("farmacia") ||
      blob.includes("market") ||
      blob.includes("offer") ||
      blob.includes("product"))
  );
}

export function classifyDailyCategory(raw: any): FalconDayliCategory {
  const blob = joinedSignals(raw);

  if (
    blob.includes("farmacia") ||
    blob.includes("pharma") ||
    blob.includes("salud") ||
    blob.includes("wellness") ||
    blob.includes("higiene") ||
    blob.includes("botiquin")
  ) {
    return "farmacia";
  }

  if (
    blob.includes("combo") ||
    blob.includes("kit") ||
    blob.includes("inicio") ||
    blob.includes("extranjero") ||
    blob.includes("estudiante")
  ) {
    return "combos";
  }

  if (
    blob.includes("recurrente") ||
    blob.includes("reposición") ||
    blob.includes("reposicion") ||
    blob.includes("suscripcion") ||
    blob.includes("subscription") ||
    blob.includes("weekly") ||
    blob.includes("mensual") ||
    blob.includes("automat")
  ) {
    return "recurrente";
  }

  if (
    blob.includes("super") ||
    blob.includes("mercado") ||
    blob.includes("canasta") ||
    blob.includes("despensa") ||
    blob.includes("hogar") ||
    blob.includes("basic")
  ) {
    return "super";
  }

  return "comida";
}

export function scoreDailyRaw(raw: any) {
  const blob = joinedSignals(raw);
  let score = 50;

  if (blob.includes("featured") || blob.includes("destacado")) score += 20;
  if (blob.includes("food") || blob.includes("comida")) score += 8;
  if (blob.includes("producer") || blob.includes("productor")) score += 6;
  if (blob.includes("territory") || blob.includes("territorio")) score += 6;
  if (raw?.image || raw?.attrs?.image || raw?.cover || raw?.attrs?.cover) score += 5;

  return score;
}

export function toFalconDayliFood(raw: DVLike): FalconDayliFood | null {
  const title = safeText(
    raw?.title,
    raw?.name,
    raw?.nombre,
    raw?.attrs?.title,
    raw?.attrs?.name,
    raw?.attrs?.nombre,
    raw?.meta?.title
  );

  if (!title) return null;

  const cover =
    normalizeImage(
      raw?.image ||
        raw?.cover ||
        raw?.attrs?.image ||
        raw?.attrs?.cover ||
        raw?.media?.image?.url ||
        raw?.attrs?.media?.image?.url ||
        raw?.media?.image?.dataUrl ||
        raw?.attrs?.media?.image?.dataUrl,
      raw?.media?.image?.mime ||
        raw?.attrs?.media?.image?.mime ||
        "image/png"
    ) || "";

  const tags = [
    ...arr<string>(raw?.traits),
    ...arr<string>(raw?.tags),
    ...arr<string>(raw?.labels),
  ].map((x) => String(x).toLowerCase());

  return {
    id: String(raw?.id || `${title}:${Date.now()}`),
    kind: String(raw?.kind || "mt.food"),
    title,
    subtitle: safeText(
      raw?.description,
      raw?.summary,
      raw?.attrs?.description,
      raw?.attrs?.summary,
      raw?.attrs?.notes,
      "Oferta viva del territorio"
    ),
    price:
      num(raw?.price) ??
      num(raw?.attrs?.price) ??
      num(raw?.attrs?.amount) ??
      num(raw?.attrs?.price_amount),
    currency: safeText(
      raw?.currency,
      raw?.attrs?.currency,
      raw?.meta?.currency,
      "PYG"
    ),
    cover,
    category: classifyDailyCategory(raw),
    producerId: safeText(
      raw?.producerId,
      raw?.attrs?.producerId,
      raw?.attrs?.producer?.id,
      raw?.vendor?.id,
      raw?.attrs?.vendor?.id
    ) || undefined,
    producerName: safeText(
      raw?.producerName,
      raw?.attrs?.producerName,
      raw?.attrs?.producer?.name,
      raw?.vendor?.name,
      raw?.attrs?.vendor?.name
    ) || undefined,
    territoryId: safeText(
      raw?.territoryId,
      raw?.attrs?.territoryId,
      raw?.attrs?.territory?.id
    ) || undefined,
    territoryName: safeText(
      raw?.territoryName,
      raw?.attrs?.territoryName,
      raw?.attrs?.territory?.name
    ) || undefined,
    available: raw?.available ?? raw?.attrs?.available ?? true,
    tags,
    ns: getNs(raw),
    score: scoreDailyRaw(raw),
    raw,
  };
}

export function toFalconDayliProducer(raw: DVLike): FalconDayliProducer | null {
  const title = safeText(
    raw?.title,
    raw?.name,
    raw?.nombre,
    raw?.attrs?.title,
    raw?.attrs?.name,
    raw?.attrs?.nombre,
    raw?.attrs?.producerName
  );

  if (!title) return null;

  const cover =
    normalizeImage(
      raw?.image ||
        raw?.cover ||
        raw?.attrs?.image ||
        raw?.attrs?.cover ||
        raw?.media?.image?.url ||
        raw?.attrs?.media?.image?.url ||
        raw?.media?.image?.dataUrl ||
        raw?.attrs?.media?.image?.dataUrl,
      raw?.media?.image?.mime ||
        raw?.attrs?.media?.image?.mime ||
        "image/png"
    ) || "";

  const tags = [
    ...arr<string>(raw?.traits),
    ...arr<string>(raw?.tags),
    ...arr<string>(raw?.labels),
  ].map((x) => String(x).toLowerCase());

  return {
    id: String(raw?.id || `${title}:${Date.now()}`),
    kind: String(raw?.kind || "mt.producer"),
    title,
    subtitle: safeText(
      raw?.description,
      raw?.summary,
      raw?.attrs?.description,
      raw?.attrs?.summary,
      "Productor o proveedor activo"
    ),
    cover,
    territoryId: safeText(
      raw?.territoryId,
      raw?.attrs?.territoryId,
      raw?.attrs?.territory?.id
    ) || undefined,
    territoryName: safeText(
      raw?.territoryName,
      raw?.attrs?.territoryName,
      raw?.attrs?.territory?.name
    ) || undefined,
    categories: [classifyDailyCategory(raw)],
    tags,
    ns: getNs(raw),
    score: scoreDailyRaw(raw),
    raw,
  };
}

export function toFalconDayliTerritory(raw: DVLike): FalconDayliTerritory | null {
  const title = safeText(
    raw?.title,
    raw?.name,
    raw?.nombre,
    raw?.attrs?.title,
    raw?.attrs?.name,
    raw?.attrs?.nombre,
    raw?.attrs?.territoryName
  );

  if (!title) return null;

  const cover =
    normalizeImage(
      raw?.image ||
        raw?.cover ||
        raw?.attrs?.image ||
        raw?.attrs?.cover ||
        raw?.media?.image?.url ||
        raw?.attrs?.media?.image?.url ||
        raw?.media?.image?.dataUrl ||
        raw?.attrs?.media?.image?.dataUrl,
      raw?.media?.image?.mime ||
        raw?.attrs?.media?.image?.mime ||
        "image/png"
    ) || "";

  const tags = [
    ...arr<string>(raw?.traits),
    ...arr<string>(raw?.tags),
    ...arr<string>(raw?.labels),
  ].map((x) => String(x).toLowerCase());

  return {
    id: String(raw?.id || `${title}:${Date.now()}`),
    kind: String(raw?.kind || "mt.territory"),
    title,
    subtitle: safeText(
      raw?.description,
      raw?.summary,
      raw?.attrs?.description,
      raw?.attrs?.summary,
      "Territorio activo"
    ),
    cover,
    location: safeText(
      raw?.location,
      raw?.attrs?.location,
      raw?.attrs?.territory?.location
    ) || undefined,
    tags,
    ns: getNs(raw),
    score: scoreDailyRaw(raw),
    raw,
  };
}

export function upsertById<T extends { id: string; score?: number }>(prev: T[], item: T) {
  const map = new Map<string, T>();
  for (const x of prev) map.set(String(x.id), x);
  map.set(String(item.id), item);

  return Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function reduceDayliState(
  prev: FalconDayliState,
  raw: DVLike,
  targetNamespaces: string[]
): FalconDayliState {
  if (!raw) return prev;

  if (isTerritoryDV(raw, targetNamespaces)) {
    const territory = toFalconDayliTerritory(raw);
    if (!territory) return prev;
    return {
      ...prev,
      territories: upsertById(prev.territories, territory),
    };
  }

  if (isProducerDV(raw, targetNamespaces)) {
    const producer = toFalconDayliProducer(raw);
    if (!producer) return prev;
    return {
      ...prev,
      producers: upsertById(prev.producers, producer),
    };
  }

  if (isFoodDV(raw, targetNamespaces)) {
    const food = toFalconDayliFood(raw);
    if (!food) return prev;
    return {
      ...prev,
      foods: upsertById(prev.foods, food),
    };
  }

  return prev;
}

export function emptyDayliState(): FalconDayliState {
  return {
    foods: [],
    producers: [],
    territories: [],
  };
}