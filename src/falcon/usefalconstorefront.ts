import { useEffect, useMemo, useState } from "react";
import type { FalconStoreCollection, FalconStoreItem } from "../types/falcon.store";

const MICELIO_HTTP =
  (import.meta as any)?.env?.VITE_MICELIO_HTTP ||
  "https://seed.mterra.space/micelio";

const SEED_WS =
  (import.meta as any)?.env?.VITE_SEED_WS ||
  "wss://seed.mterra.space/utopy?ns=mt";

const TARGET_NS =
  String((import.meta as any)?.env?.VITE_FALCON_STORE_NS || "deco:hogar").trim().toLowerCase();

function safeJsonParse(x: any): any | null {
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

function safeText(...values: any[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function num(x: any) {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const cleaned = x.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function arr<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function normalizeImage(raw: any, mime = "image/png"): string {
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

function looksLikeDV(raw: any): boolean {
  if (!raw || typeof raw !== "object") return false;
  const k = typeof raw.kind === "string" ? raw.kind.trim() : "";
  if (!k) return false;
  if (k === "dv.upsert" || k === "dato.upsert" || k === "dato.create") return false;
  return true;
}

function deepFindDV(x: any, depth = 0): any | null {
  if (!x || typeof x !== "object") return null;
  if (depth > 5) return null;

  if (looksLikeDV(x)) return x;

  const cands = [
    x.payload,
    x.dv,
    x.with?.dv,
    x.payload?.dv,
    x.payload?.with?.dv,
    x.with,
    x.data,
    x.item,
    x.msg,
  ];

  for (const c of cands) {
    const found = deepFindDV(c, depth + 1);
    if (found) return found;
  }

  return null;
}

function extractDVFromAnyFrame(msg: any): any | null {
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

function getNs(raw: any) {
  return safeText(raw?.meta?.ns, raw?.attrs?.meta?.ns, raw?.attrs?.ns, raw?.ns).toLowerCase();
}

function nsMatches(raw: any) {
  const ns = getNs(raw);
  if (!ns) return false;
  return ns === TARGET_NS || ns.includes(TARGET_NS);
}

function isStoreProduct(raw: any) {
  const kind = safeText(raw?.kind).toLowerCase();
  const traits = arr<string>(raw?.traits).map((x) => String(x).toLowerCase());

  const maybeProduct =
    kind.includes("product") ||
    kind.includes("offer") ||
    traits.some((t) => t.includes("product") || t.includes("offer") || t.includes("market"));

  return maybeProduct && nsMatches(raw);
}

function toStoreItem(raw: any): FalconStoreItem | null {
  if (!isStoreProduct(raw)) return null;

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

  const description = safeText(
    raw?.description,
    raw?.summary,
    raw?.attrs?.description,
    raw?.attrs?.summary,
    raw?.attrs?.notes
  );

  const price =
    num(raw?.price) ??
    num(raw?.attrs?.price) ??
    num(raw?.attrs?.amount) ??
    num(raw?.attrs?.price_amount);

  const currency = safeText(
    raw?.currency,
    raw?.attrs?.currency,
    raw?.meta?.currency,
    "PYG"
  );

  const image =
    normalizeImage(
      raw?.image ||
        raw?.imageUrl ||
        raw?.attrs?.image ||
        raw?.attrs?.imagen ||
        raw?.media?.image?.url ||
        raw?.media?.image?.dataUrl ||
        raw?.attrs?.media?.image?.url ||
        raw?.attrs?.media?.image?.dataUrl,
      raw?.media?.image?.mime ||
        raw?.attrs?.media?.image?.mime ||
        "image/png"
    ) || "";

  const tags = [
    ...arr<string>(raw?.tags),
    ...arr<string>(raw?.traits),
    ...arr<string>(raw?.labels),
  ].map((x) => String(x).toLowerCase());

  return {
    id: String(raw?.id || `${title}:${Date.now()}`),
    title,
    description,
    price,
    currency,
    image,
    images: image ? [image] : [],
    category:
      safeText(raw?.category, raw?.attrs?.category, raw?.attrs?.categoria, "deco hogar").toLowerCase(),
    tags,
    sellerId: safeText(
      raw?.sellerId,
      raw?.attrs?.sellerId,
      raw?.contact?.sellerId,
      raw?.attrs?.contact?.sellerId
    ) || undefined,
    sellerName: safeText(
      raw?.sellerName,
      raw?.attrs?.sellerName,
      raw?.contact?.sellerName,
      raw?.attrs?.contact?.sellerName
    ) || undefined,
    sourceNode: safeText(raw?.sourceNode, raw?.meta?.source, raw?.meta?.ns) || undefined,
    href: safeText(raw?.href, raw?.attrs?.href) || undefined,
    featured: tags.includes("featured") || tags.includes("destacado"),
    inStock: raw?.inStock ?? raw?.available ?? raw?.attrs?.available ?? true,
    score: typeof raw?.score === "number" ? raw.score : 50,
    raw,
  };
}

function uniqById(items: FalconStoreItem[]) {
  const map = new Map<string, FalconStoreItem>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

function byScore(items: FalconStoreItem[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function buildCollections(items: FalconStoreItem[]): FalconStoreCollection[] {
  const ordered = byScore(items);

  const featured = ordered.filter((x) => x.featured || (x.score || 0) >= 70);
  const hogar = ordered.filter((x) => x.category.includes("hogar"));
  const muebles = ordered.filter((x) => x.category.includes("mueble"));
  const deco = ordered.filter((x) => x.category.includes("deco") || x.tags.includes("deco"));

  const groups: FalconStoreCollection[] = [
    {
      key: "featured",
      title: "Selección destacada",
      subtitle: "Lo mejor de Deco Hogar",
      items: (featured.length ? featured : ordered).slice(0, 10),
    },
    {
      key: "hogar",
      title: "Hogar",
      subtitle: "Objetos y piezas para el día a día",
      items: (hogar.length ? hogar : ordered).slice(0, 10),
    },
    {
      key: "muebles",
      title: "Muebles",
      subtitle: "Piezas con foco en casa y ambientación",
      items: (muebles.length ? muebles : ordered).slice(0, 10),
    },
    {
      key: "deco",
      title: "Deco",
      subtitle: "Decoración y selección visual",
      items: (deco.length ? deco : ordered).slice(0, 10),
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}

function filterByCat(items: FalconStoreItem[], cat: string) {
  if (!cat || cat === "destacados") return byScore(items);

  const q = cat.toLowerCase();
  return byScore(
    items.filter((x) => x.category.includes(q) || x.tags.some((t) => t.includes(q)))
  );
}

export function useFalconStorefront(cat: string) {
  const [items, setItems] = useState<FalconStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    function ingest(raw: any) {
      const dv = extractDVFromAnyFrame(raw) || raw;
      const item = toStoreItem(dv);
      if (!item) return;

      setItems((prev) => uniqById([item, ...prev]));
    }

    const localRaw =
      typeof window !== "undefined"
        ? localStorage.getItem("falcon.store.snapshot") ||
          localStorage.getItem("ms.market.snapshot") ||
          localStorage.getItem("ms.market.products")
        : null;

    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        const base = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.products)
          ? parsed.products
          : [];
        const normalized = uniqById(base.map((x: any) => toStoreItem(x)).filter(Boolean) as FalconStoreItem[]);
        if (normalized.length) {
          setItems(normalized);
          setLoading(false);
        }
      } catch {}
    }

    const ws = new WebSocket(SEED_WS);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          kind: "query",
          id: "falcon:web:snapshot",
          where: {},
          limit: 5000,
          auth: "utopy-resonancia",
        })
      );
    };

    ws.onmessage = (ev) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;

      if (msg?.ok && Array.isArray(msg.items)) {
        for (const it of msg.items) ingest(it);
        if (alive) setLoading(false);
        return;
      }

      ingest(msg);
      if (alive) setLoading(false);
    };

    ws.onerror = () => {
      if (alive) setError("No se pudo abrir snapshot del catálogo.");
    };

    const es = new EventSource(`${MICELIO_HTTP}/events`);
    const onAny = (ev: MessageEvent) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;
      ingest(msg);
      if (alive) setLoading(false);
    };

    es.addEventListener("message", onAny);
    es.addEventListener("intent", onAny);
    es.addEventListener("dv", onAny);
    es.addEventListener("dato", onAny);

    es.onerror = () => {
      if (alive && !items.length) {
        setError("No se pudo sincronizar Falcon Store en vivo.");
      }
    };

    return () => {
      alive = false;
      try {
        es.close();
      } catch {}
      try {
        ws.close();
      } catch {}
    };
  }, []);

  const filtered = useMemo(() => filterByCat(items, cat), [items, cat]);
  const collections = useMemo(() => buildCollections(items), [items]);

  return {
    items,
    filtered,
    collections,
    loading,
    error,
  };
}