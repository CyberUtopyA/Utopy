export type TradeIntentMode = "buy" | "consult";

export type TradeIntent = {
  kind: "trade.intent.buy" | "trade.intent.consult";
  id: string;
  attrs: {
    productId: string;
    title: string;
    sellerId?: string;
    sellerName?: string;
    category?: string;
    price?: number | null;
    currency?: string;
    image?: string;
    href?: string;
    preferredView?: "product" | "consult";
  };
  meta: {
    ns: string;
    scopes: string[];
    from: string;
    ts: string;
  };
  raw?: any;
};

const HANDOFF_KEY = "utopy.trade.intent";
const TRADE_NODE_URL = (
  "https://market.utopy.live"
).replace(/\/$/, "");

function uid(prefix = "intent") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function textOf(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function numberOf(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function imageOf(item: any) {
  return (
    item?.image ||
    item?.cover ||
    item?.raw?.image ||
    item?.raw?.cover ||
    item?.raw?.attrs?.image ||
    item?.raw?.attrs?.cover ||
    ""
  );
}

function hrefOf(item: any) {
  return (
    item?.href ||
    item?.raw?.href ||
    item?.raw?.url ||
    item?.raw?.link ||
    item?.raw?.attrs?.href ||
    ""
  );
}

function buildIntent(item: any, mode: TradeIntentMode): TradeIntent {
  return {
    kind: mode === "buy" ? "trade.intent.buy" : "trade.intent.consult",
    id: uid(mode),
    attrs: {
      productId: String(item?.id || item?.raw?.id || ""),
      title: textOf(item?.title, item?.name, item?.raw?.title, "Producto"),
      sellerId: textOf(item?.sellerId, item?.raw?.sellerId, item?.raw?.attrs?.sellerId) || undefined,
      sellerName: textOf(item?.sellerName, item?.raw?.sellerName, item?.raw?.attrs?.sellerName) || undefined,
      category: textOf(item?.category, item?.raw?.category, item?.raw?.attrs?.category) || undefined,
      price: numberOf(item?.price, item?.raw?.price, item?.raw?.attrs?.price),
      currency: textOf(item?.currency, item?.raw?.currency, item?.raw?.attrs?.currency, "PYG"),
      image: imageOf(item) || undefined,
      href: hrefOf(item) || undefined,
      preferredView: mode === "buy" ? "product" : "consult",
    },
    meta: {
      ns: textOf(item?.raw?.meta?.ns, "mt:market"),
      scopes: ["public"],
      from: "falcon",
      ts: new Date().toISOString(),
    },
    raw: item?.raw || item,
  };
}

export function persistTradeIntent(intent: TradeIntent) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(intent));
  } catch (err) {
    console.warn("No se pudo guardar trade intent", err);
  }

  try {
    window.dispatchEvent(
      new CustomEvent("utopy.trade.intent", {
        detail: intent,
      })
    );
  } catch (err) {
    console.warn("No se pudo emitir evento trade intent", err);
  }
}

export function readTradeIntent(): TradeIntent | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTradeIntent() {
  try {
    localStorage.removeItem(HANDOFF_KEY);
  } catch {
    // noop
  }
}

function openResolver(intent: TradeIntent) {
  const params = new URLSearchParams();
  params.set("from", "falcon");
  params.set("intent", intent.kind);
  if (intent.attrs.productId) params.set("productId", intent.attrs.productId);
  if (intent.attrs.title) params.set("q", intent.attrs.title);
  if (intent.attrs.sellerId) params.set("sellerId", intent.attrs.sellerId);

  const url = `${TRADE_NODE_URL}/?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function emitBuyIntent(item: any, opts?: { openResolver?: boolean }) {
  const intent = buildIntent(item, "buy");
  persistTradeIntent(intent);
  if (opts?.openResolver !== false) openResolver(intent);
}

export function emitConsultIntent(item: any, opts?: { openResolver?: boolean }) {
  const intent = buildIntent(item, "consult");
  persistTradeIntent(intent);
  if (opts?.openResolver !== false) openResolver(intent);
}