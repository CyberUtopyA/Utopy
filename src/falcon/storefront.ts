import type { DVLike, FalconStoreCollection, FalconStoreItem } from "../types/falcon.store";

const FALLBACK_CURRENCY = "PYG";

const FALLBACK_STORE_ITEMS: FalconStoreItem[] = [
  {
    id: "fallback-1",
    title: "Combo Hogar Curado",
    description: "Selección visual premium mientras conectás el market real.",
    price: 129000,
    currency: "PYG",
    image: "",
    images: [],
    category: "hogar",
    tags: ["destacados", "hogar"],
    sellerName: "Falcon",
    sourceNode: "falcon",
    featured: true,
    inStock: true,
    score: 90,
    raw: {},
  },
  {
    id: "fallback-2",
    title: "Mueble Local",
    description: "Muebles y fabricación local conectada al storefront.",
    price: 890000,
    currency: "PYG",
    image: "",
    images: [],
    category: "muebles",
    tags: ["muebles", "local"],
    sellerName: "Falcon",
    sourceNode: "falcon",
    featured: true,
    inStock: true,
    score: 88,
    raw: {},
  },
  {
    id: "fallback-3",
    title: "Oferta Tech",
    description: "Electrónica destacada y productos curados del shopping.",
    price: 249000,
    currency: "PYG",
    image: "",
    images: [],
    category: "tech",
    tags: ["tech", "shopping"],
    sellerName: "Falcon",
    sourceNode: "falcon",
    featured: false,
    inStock: true,
    score: 76,
    raw: {},
  },
  {
    id: "fallback-4",
    title: "Kit Cocina",
    description: "Productos del día a día con presentación más comercial.",
    price: 179000,
    currency: "PYG",
    image: "",
    images: [],
    category: "hogar",
    tags: ["hogar", "cocina"],
    sellerName: "Falcon",
    sourceNode: "falcon",
    featured: false,
    inStock: true,
    score: 72,
    raw: {},
  },
];

function toArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function textOf(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberOf(...values: any[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function boolOf(...values: any[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function arrayText(...values: any[]): string[] {
  const result: string[] = [];

  for (const value of values) {
    for (const item of toArray(value)) {
      if (typeof item === "string" && item.trim()) {
        result.push(item.trim());
      }
    }
  }

  return uniq(result);
}

function imageCandidates(obj: any): string[] {
  return uniq(
    arrayText(
      obj?.image,
      obj?.cover,
      obj?.thumbnail,
      obj?.photo,
      obj?.photos,
      obj?.images,
      obj?.attrs?.image,
      obj?.attrs?.cover,
      obj?.attrs?.thumbnail,
      obj?.attrs?.photo,
      obj?.attrs?.photos,
      obj?.attrs?.images,
      obj?.attrs?.media?.image,
      obj?.attrs?.media?.images,
      obj?.media?.image,
      obj?.media?.images
    )
  );
}

function normalizeCategory(input: any, tags: string[]): string {
  const raw = textOf(
    input?.category,
    input?.categoria,
    input?.attrs?.category,
    input?.attrs?.categoria,
    input?.meta?.category
  ).toLowerCase();

  if (raw.includes("mueb") || tags.some((t) => t.includes("mueble"))) return "muebles";
  if (raw.includes("hogar") || raw.includes("casa")) return "hogar";
  if (raw.includes("tech") || raw.includes("electro") || raw.includes("tecno")) return "tech";
  if (raw.includes("shopping") || raw.includes("frontera") || raw.includes("brasil")) return "shopping";
  if (/aro|anillo|pulsera|tobillera|collar|cadena|joya|accesorio|reloj|bolso|cartera/.test(raw)) return "accesorios";
  if (/ropa|moda|prenda|camisa|remera|vestido|pantal[oó]n|calzado|zapato/.test(raw)) return "ropa";

  if (tags.some((t) => t.includes("shopping") || t.includes("frontera") || t.includes("brasil"))) {
    return "shopping";
  }
  if (tags.some((t) => t.includes("hogar") || t.includes("cocina"))) {
    return "hogar";
  }
  if (tags.some((t) => t.includes("tech") || t.includes("electro"))) {
    return "tech";
  }

  return raw || "destacados";
}

export function isLikelyMarketProduct(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;

  const kind = textOf(obj.kind).toLowerCase();
  const ns = textOf(obj?.meta?.ns).toLowerCase();
  const tags = arrayText(obj?.traits, obj?.tags).map((x) => x.toLowerCase());

  return (
    kind.includes("product") ||
    kind.includes("offer") ||
    ns.includes("market") ||
    ns.includes("mt:market") ||
    tags.some((t) => t.includes("product") || t.includes("offer") || t.includes("market"))
  );
}

export function anyToFalconStoreItem(input: any, index = 0): FalconStoreItem | null {
  if (!input || typeof input !== "object") return null;

  const attrs = input.attrs ?? {};
  const tags = arrayText(
    input.tags,
    input.traits,
    attrs.tags,
    attrs.traits,
    input.labels
  ).map((x) => x.toLowerCase());

  const images = imageCandidates(input);
  const title = textOf(
    input.title,
    input.name,
    input.label,
    attrs.title,
    attrs.name,
    attrs.label,
    input?.meta?.title
  );

  if (!title) return null;

  const description = textOf(
    input.description,
    input.summary,
    attrs.description,
    attrs.summary,
    attrs.notes,
    input?.meta?.description
  );

  const price = numberOf(
    input.price,
    input.displayPrice,
    attrs.price,
    attrs.amount,
    attrs.price_amount,
    attrs.price_per_unit,
    input?.meta?.price
  );

  const currency = textOf(
    input.currency,
    attrs.currency,
    attrs.moneda,
    input?.meta?.currency
  ) || FALLBACK_CURRENCY;

  const category = normalizeCategory(input, tags);

  const sellerId = textOf(
    input.sellerId,
    input.owner_id,
    attrs.sellerId,
    attrs.ownerId,
    attrs.author?.id,
    attrs.vendor?.id,
    attrs.contact?.sellerId
  );

  const sellerName = textOf(
    input.sellerName,
    attrs.sellerName,
    attrs.author?.name,
    attrs.vendor?.name,
    attrs.contact?.sellerName,
    input.owner_name
  );

  const sourceNode = textOf(
    input.sourceNode,
    attrs.source?.node,
    input?.meta?.source,
    input?.meta?.ns
  );

  const featured = boolOf(
    input.featured,
    attrs.featured,
    tags.includes("featured"),
    tags.includes("destacado")
  );

  const inStock =
    boolOf(
      input.inStock,
      input.available,
      attrs.inStock,
      attrs.available
    ) ?? true;

  const score =
    numberOf(
      input.score,
      attrs.score,
      featured ? 90 : null
    ) ?? 50;

  return {
    id: textOf(input.id, attrs.id, `${title.toLowerCase().replace(/\s+/g, "-")}-${index}`),
    title,
    description,
    price,
    currency,
    image: images[0] || "",
    images,
    category,
    tags,
    sellerId: sellerId || undefined,
    sellerName: sellerName || undefined,
    sourceNode: sourceNode || undefined,
    href: textOf(input.href, attrs.href) || undefined,
    featured: featured ?? false,
    inStock,
    score,
    raw: input,
  };
}

export function normalizeIncomingProducts(payload: any): FalconStoreItem[] {
  let base: any[] = [];

  if (Array.isArray(payload)) {
    base = payload;
  } else if (Array.isArray(payload?.items)) {
    base = payload.items;
  } else if (Array.isArray(payload?.products)) {
    base = payload.products;
  } else if (Array.isArray(payload?.results)) {
    base = payload.results;
  } else if (Array.isArray(payload?.data)) {
    base = payload.data;
  }

  const normalized = base
    .map((item, index) => anyToFalconStoreItem(item, index))
    .filter(Boolean) as FalconStoreItem[];

  const byId = new Map<string, FalconStoreItem>();
  for (const item of normalized) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

async function tryFetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadStorefrontItems(): Promise<FalconStoreItem[]> {
  // 1) window injection
  const fromWindow =
    typeof window !== "undefined" ? (window as any).__MS_MARKET_PRODUCTS__ : null;

  const winItems = normalizeIncomingProducts(fromWindow);
  if (winItems.length) return winItems;

  // 2) localStorage snapshot
  try {
    if (typeof window !== "undefined") {
      const raw =
        localStorage.getItem("falcon.store.snapshot") ||
        localStorage.getItem("ms.market.snapshot") ||
        localStorage.getItem("ms.market.products");

      if (raw) {
        const parsed = JSON.parse(raw);
        const localItems = normalizeIncomingProducts(parsed);
        if (localItems.length) return localItems;
      }
    }
  } catch {
    // ignore
  }

  // 3) HTTP endpoint
  const envUrl = (import.meta as any)?.env?.VITE_FALCON_MS_PRODUCTS_URL as string | undefined;
  if (envUrl) {
    const fetched = await tryFetchJson(envUrl);
    const fetchedItems = normalizeIncomingProducts(fetched);
    if (fetchedItems.length) return fetchedItems;
  }

  // 4) fallback
  return FALLBACK_STORE_ITEMS;
}

function sortByScore(items: FalconStoreItem[]): FalconStoreItem[] {
  return [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function take(items: FalconStoreItem[], count: number): FalconStoreItem[] {
  return items.slice(0, count);
}

export function filterItemsByCategory(items: FalconStoreItem[], category: string) {
  if (!category || category === "destacados") {
    return sortByScore(items);
  }

  return sortByScore(
    items.filter((item) => {
      const cat = item.category.toLowerCase();
      const tags = item.tags.join(" ").toLowerCase();
      return cat.includes(category.toLowerCase()) || tags.includes(category.toLowerCase());
    })
  );
}

export function buildCollections(items: FalconStoreItem[]): FalconStoreCollection[] {
  const sorted = sortByScore(items);
  const featured = sorted.filter((x) => x.featured || (x.score ?? 0) >= 85);
  const muebles = sorted.filter((x) => x.category === "muebles");
  const hogar = sorted.filter((x) => x.category === "hogar");
  const tech = sorted.filter((x) => x.category === "tech");
  const shopping = sorted.filter((x) => x.category === "shopping");

  const collections: FalconStoreCollection[] = [
    {
      key: "featured",
      title: "Colección curada",
      subtitle: "Lo mejor del storefront hoy",
      items: take(featured.length ? featured : sorted, 8),
    },
    {
      key: "shopping",
      title: "Shopping / frontera",
      subtitle: "Productos con sabor a oportunidad",
      items: take(shopping.length ? shopping : sorted, 8),
    },
    {
      key: "muebles",
      title: "Muebles y hogar",
      subtitle: "Fabricación local + piezas seleccionadas",
      items: take(muebles.length ? muebles : hogar.length ? hogar : sorted, 8),
    },
    {
      key: "tech",
      title: "Electro y tech",
      subtitle: "Conversión rápida y visual limpia",
      items: take(tech.length ? tech : sorted, 8),
    },
  ];

  return collections.filter((c) => c.items.length > 0);
}
