import { FalconStoreItem } from "../types/falcon.store";

const MS_MARKET_BASE = (
  import.meta.env.VITE_MS_MARKET_URL || "https://market.utopy.live"
).replace(/\/$/, "");

const HANDOFF_KEY = "falcon.msmarket.payload";

function textOf(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveDirectHref(item: FalconStoreItem | any): string {
  return textOf(
    item?.href,
    item?.raw?.href,
    item?.raw?.url,
    item?.raw?.link,
    item?.raw?.attrs?.href,
    item?.raw?.attrs?.url,
    item?.raw?.attrs?.link
  );
}

function buildPayload(item: FalconStoreItem | any, mode: "product" | "consult" = "product") {
  return {
    mode,
    from: "falcon",
    productId: item?.id || item?.raw?.id || "",
    title: item?.title || "",
    sellerId: item?.sellerId || "",
    sellerName: item?.sellerName || "",
    sourceNode: item?.sourceNode || "",
    category: item?.category || "",
    price: item?.price ?? null,
    currency: item?.currency || "PYG",
    href: item?.href || "",
    raw: item?.raw || {},
    ts: Date.now(),
  };
}

function persistPayload(payload: any) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("No se pudo guardar payload en localStorage", err);
  }
}

export function readFalconMsMarketPayload() {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearFalconMsMarketPayload() {
  try {
    localStorage.removeItem(HANDOFF_KEY);
  } catch {
    // noop
  }
}

export function openInMsMarket(item: FalconStoreItem | any) {
  if (!item) return;

  const directHref = resolveDirectHref(item);
  if (directHref) {
    window.open(directHref, "_blank", "noopener,noreferrer");
    return;
  }

  const payload = buildPayload(item, "product");
  persistPayload(payload);

  const params = new URLSearchParams();
  params.set("from", "falcon");
  params.set("open", "product");
  if (payload.productId) params.set("productId", payload.productId);
  if (payload.title) params.set("q", payload.title);

  const url = `${MS_MARKET_BASE}/?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function consultInMsMarket(item: FalconStoreItem | any) {
  if (!item) return;

  const payload = buildPayload(item, "consult");
  persistPayload(payload);

  const params = new URLSearchParams();
  params.set("from", "falcon");
  params.set("open", "consult");
  if (payload.productId) params.set("productId", payload.productId);
  if (payload.title) params.set("q", payload.title);
  if (payload.sellerId) params.set("sellerId", payload.sellerId);

  const url = `${MS_MARKET_BASE}/?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}