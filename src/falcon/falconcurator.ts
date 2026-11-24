export type FalconRootKind = "producto" | "territorio" | "org";

export type CanonicalFalconItem = {
  id: string;
  rootKind: FalconRootKind;
  kind: string;
  title: string;
  subtitle: string;
  cover: string;
  price: number | null;
  currency: string;
  category: string;
  tags: string[];
  ns: string;
  scopes: string[];
  score: number;
  available?: boolean;
  featured: boolean;
  creditEligible: boolean;
  recurrente: boolean;
  territoryId?: string;
  territoryName?: string;
  orgId?: string;
  orgName?: string;
  worldId?: string;
  role?: string;
  governanceMode?: string;
  commons: string[];
  productiveFocus: string[];
  domain?: string;
  marketCategory?: string;
  inputKind?: string;
  publishAs?: "work.intent" | "mt.product" | "both" | "unknown";
  pieceCount: number;
  materialCount: number;
  processCount: number;
  providerCount: number;
  raw: any;
};

export const DEFAULT_FALCON_MT_NAMESPACES = [
  "mt:product",
  "mt:territory",
  "mt:org",
  "mt:market",
  "mt:capital",
  "mt:governance",
  "mo",
];

export function parseNsList(raw?: string): string[] {
  if (!raw) return DEFAULT_FALCON_MT_NAMESPACES;
  const parts = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? parts : DEFAULT_FALCON_MT_NAMESPACES;
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
  if (depth > 6) return null;

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

export function extractDVFromAnyFrame(msg: any): any | null {
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

export function getScopes(raw: any): string[] {
  return Array.from(
    new Set(
      arr<string>(raw?.meta?.scopes)
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  );
}

export function getWorldId(raw: any): string | undefined {
  const scope = getScopes(raw).find((x) => x.startsWith("world:"));
  return scope ? scope.slice("world:".length) : undefined;
}

export function getTraits(raw: any): string[] {
  return Array.from(
    new Set(
      [
        ...arr<string>(raw?.traits),
        ...arr<string>(raw?.tags),
        ...arr<string>(raw?.labels),
      ]
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function matchesNs(raw: any, targetNamespaces: string[]) {
  const ns = getNs(raw);
  if (!ns) return false;
  return targetNamespaces.some((t) => ns === t || ns.includes(t));
}

export function joinedSignals(raw: any) {
  const traits = getTraits(raw);

  return [
    safeText(raw?.kind),
    getNs(raw),
    safeText(raw?.title, raw?.name, raw?.nombre),
    safeText(raw?.description, raw?.summary),
    safeText(raw?.attrs?.title, raw?.attrs?.name, raw?.attrs?.nombre),
    safeText(raw?.attrs?.description, raw?.attrs?.summary),
    safeText(raw?.attrs?.categoria, raw?.attrs?.category),
    safeText(raw?.attrs?.rol, raw?.attrs?.governanceRole),
    safeText(raw?.attrs?.market?.category),
    safeText(raw?.attrs?.workDomain),
    traits.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function rootKindFromDV(raw: any): FalconRootKind | null {
  const kind = String(raw?.kind || "").trim().toLowerCase();
  const traits = getTraits(raw);
  const ns = getNs(raw);

  if (kind === "territorio") return "territorio";
  if (
    traits.includes("mt:territorio") ||
    traits.includes("mt:espacio-vivo") ||
    ns.includes("mt:territory")
  ) {
    return "territorio";
  }

  if (kind === "org" || kind === "almacen") return "org";
  if (
    traits.includes("mt:org") ||
    traits.includes("mt:almacen") ||
    ns.includes("mt:org")
  ) {
    return "org";
  }

  if (kind === "producto" || kind === "mo.fabrication.pack") return "producto";
  if (
    traits.includes("mt:producto") ||
    traits.includes("mt:vendible") ||
    ns.includes("mt:product") ||
    ns.includes("mt:market") ||
    kind.includes("offer") ||
    kind.includes("product")
  ) {
    return "producto";
  }

  return null;
}

export function scoreMtRaw(raw: any) {
  const blob = joinedSignals(raw);
  let score = 50;

  if (blob.includes("featured") || blob.includes("destacado")) score += 20;
  if (blob.includes("territorio") || blob.includes("territory")) score += 10;
  if (blob.includes("producto") || blob.includes("product")) score += 8;
  if (blob.includes("org") || blob.includes("almacen")) score += 6;
  if (blob.includes("vehicle:fabrication")) score += 12;
  if (blob.includes("payment:credit.eligible")) score += 10;
  if (raw?.image || raw?.cover || raw?.attrs?.image || raw?.attrs?.cover) score += 5;

  return score;
}

function storeCategory(raw: any): string {
  const category = safeText(
    raw?.attrs?.categoria,
    raw?.attrs?.category,
    raw?.attrs?.market?.category,
    "producto",
  );
  const normalized = category.toLowerCase();
  if (/aro|anillo|pulsera|tobillera|collar|cadena|joya|accesorio|reloj|bolso|cartera/.test(normalized)) {
    return "accesorios";
  }
  if (/ropa|moda|prenda|camisa|remera|vestido|pantal[oó]n|calzado|zapato/.test(normalized)) {
    return "ropa";
  }
  return category;
}

export function toCanonicalFalconItem(
  raw: any,
  targetNamespaces: string[]
): CanonicalFalconItem | null {
  const rootKind = rootKindFromDV(raw);
  if (!rootKind) return null;

  const fabrication = String(raw?.kind || "").trim() === "mo.fabrication.pack";
  if (!fabrication && !matchesNs(raw, targetNamespaces)) return null;

  const cover =
    normalizeImage(
      raw?.image ||
        raw?.cover ||
        raw?.attrs?.image ||
        raw?.attrs?.cover ||
        raw?.attrs?.media?.image ||
        raw?.attrs?.media?.image?.url ||
        raw?.attrs?.media?.image?.dataUrl ||
        raw?.attrs?.asset?.url ||
        raw?.attrs?.scan?.url,
      raw?.attrs?.media?.image?.mime || "image/png"
    ) || "";

  const title = safeText(
    raw?.attrs?.nombre,
    raw?.attrs?.name,
    raw?.attrs?.title,
    raw?.title,
    raw?.name,
    raw?.nombre,
    fabrication ? raw?.attrs?.title : "",
    rootKind === "territorio" ? "Territorio" : rootKind === "org" ? "Org" : "Producto"
  );

  const subtitle = safeText(
    raw?.attrs?.description,
    raw?.attrs?.summary,
    raw?.attrs?.mission,
    raw?.attrs?.notes,
    raw?.description,
    raw?.summary,
    fabrication ? raw?.attrs?.warnings?.[0] : "",
    rootKind === "territorio"
      ? "Territorio vivo"
      : rootKind === "org"
      ? "Organización activa"
      : "Oferta viva"
  );

  const tags = Array.from(
    new Set(
      [
        ...getTraits(raw),
        safeText(raw?.attrs?.rol),
        safeText(raw?.attrs?.governanceRole),
        safeText(raw?.attrs?.categoria),
        safeText(raw?.attrs?.category),
        safeText(raw?.attrs?.market?.category),
        safeText(raw?.attrs?.workDomain),
        raw?.attrs?.market?.creditEligible ? "payment:credit.eligible" : "",
        raw?.attrs?.commerce?.recurrente ? "mt:recurrente" : "",
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
    )
  );

  const price =
    num(raw?.attrs?.precio) ??
    num(raw?.attrs?.price) ??
    num(raw?.price) ??
    num(raw?.attrs?.estimate?.estimatedCost?.amount) ??
    num(raw?.attrs?.estimate?.estimatedCost);

  const currency = safeText(
    raw?.attrs?.currency,
    raw?.currency,
    raw?.meta?.currency,
    raw?.attrs?.estimate?.estimatedCost?.currency,
    "PYG"
  );

  const territoryId = safeText(
    raw?.attrs?.links?.territoryId,
    raw?.attrs?.territoryId,
    raw?.attrs?.territory?.id
  ) || undefined;

  const territoryName = safeText(
    raw?.attrs?.territoryName,
    raw?.attrs?.territory?.name
  ) || undefined;

  const orgId = safeText(
    raw?.attrs?.links?.orgId,
    raw?.attrs?.orgId,
    raw?.attrs?.org?.id,
    raw?.attrs?.vendor?.id
  ) || undefined;

  const orgName = safeText(
    raw?.attrs?.orgName,
    raw?.attrs?.org?.name,
    raw?.attrs?.vendor?.name
  ) || undefined;

  const featured = tags.includes("featured") || tags.includes("destacado");
  const creditEligible =
    !!raw?.attrs?.market?.creditEligible ||
    !!raw?.meta?.pay?.finance?.credit ||
    !!raw?.attrs?.pay?.finance?.credit ||
    tags.includes("payment:credit.eligible");

  const recurrente =
    !!raw?.attrs?.commerce?.recurrente ||
    tags.includes("mt:recurrente") ||
    tags.includes("recurrente");

  return {
    id: String(raw?.id || `${rootKind}:${title}:${Date.now()}`),
    rootKind,
    kind: String(raw?.kind || rootKind),
    title,
    subtitle,
    cover,
    price,
    currency,
    category: storeCategory(raw),
    tags,
    ns: getNs(raw),
    scopes: getScopes(raw),
    score: scoreMtRaw(raw),
    available:
      raw?.available ??
      raw?.attrs?.available ??
      (typeof raw?.attrs?.stock === "number" ? raw.attrs.stock > 0 : true),
    featured,
    creditEligible,
    recurrente,
    territoryId,
    territoryName,
    orgId,
    orgName,
    worldId: getWorldId(raw),
    role: safeText(raw?.attrs?.rol, raw?.attrs?.governanceRole) || undefined,
    governanceMode: safeText(raw?.attrs?.governance?.mode) || undefined,
    commons: arr<string>(raw?.attrs?.commons).map((x) => String(x)),
    productiveFocus: arr<string>(raw?.attrs?.productiveFocus).map((x) => String(x)),
    domain: safeText(raw?.attrs?.workDomain) || undefined,
    marketCategory: safeText(raw?.attrs?.market?.category) || undefined,
    inputKind: safeText(raw?.attrs?.input?.kind) || undefined,
    publishAs: safeText(raw?.attrs?.market?.publishAs, "unknown") as
      | "work.intent"
      | "mt.product"
      | "both"
      | "unknown",
    pieceCount: arr(raw?.attrs?.pieces).length,
    materialCount: arr(raw?.attrs?.materials).length,
    processCount: arr(raw?.attrs?.processes).length,
    providerCount: arr(raw?.attrs?.providers).length,
    raw,
  };
}

export function upsertById<T extends { id: string; score?: number }>(prev: T[], item: T) {
  const map = new Map<string, T>();
  for (const x of prev) map.set(String(x.id), x);
  map.set(String(item.id), item);

  return Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
}
