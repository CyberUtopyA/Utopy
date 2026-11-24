function text(...values: unknown[]) {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

export function productIdentity(product: any) {
  const raw = product?.raw || product || {};
  const attrs = raw?.attrs || {};
  return text(attrs.productId, raw.productId, raw.id, product?.id);
}

export function productTitle(product: any) {
  const raw = product?.raw || product || {};
  const attrs = raw?.attrs || {};
  return text(attrs.title, attrs.nombre, attrs.name, raw.title, raw.nombre, raw.name, product?.title, product?.nombre, "producto");
}

export function slugifyProduct(value: unknown) {
  return String(value || "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "producto";
}

export function profileHandleForIdentity(identity: any, fallbackName = "") {
  const raw = identity?.raw || identity || {};
  const attrs = raw?.attrs || {};
  const human = String(attrs.sellerProfileHandle || attrs.handle || attrs.username || raw.handle || attrs.displayName || attrs.actorName || attrs.nodeName || attrs.sellerName || attrs.vendor?.name || raw.sellerName || fallbackName || attrs.name || raw.name || raw.title || "perfil");
  return slugifyProduct(human).replace(/-/g, "").slice(0, 32);
}

function stableSuffix(value: unknown) {
  const input = String(value || "product");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(-8);
}

export function productSlug(product: any, siblings: any[] = []) {
  const base = slugifyProduct(productTitle(product));
  const id = productIdentity(product);
  const repeated = siblings.filter((candidate) => slugifyProduct(productTitle(candidate)) === base).length > 1;
  return repeated ? `${base}-${stableSuffix(id)}` : base;
}

export function productPathFor(product: any, siblings: any[] = []) {
  return `/producto/${productSlug(product, siblings)}`;
}

export function resolveProductRoute<T = any>(products: T[], routeValue: unknown): T | null {
  let wanted = String(routeValue || "");
  try { wanted = decodeURIComponent(wanted); } catch {}
  const byId = products.find((product: any) => productIdentity(product) === wanted || String(product?.id || "") === wanted);
  if (byId) return byId;
  if (typeof window !== "undefined") {
    try {
      const remembered = JSON.parse(window.sessionStorage.getItem(`${ORIGIN_PREFIX}${wanted}`) || "null");
      const rememberedProduct = products.find((product: any) => productIdentity(product) === String(remembered?.productId || ""));
      if (rememberedProduct) return rememberedProduct;
    } catch {}
  }
  return products.find((product: any) => productSlug(product, products) === wanted) || null;
}

const ORIGIN_PREFIX = "utopy.product.origin:";

export function rememberProductOrigin(product: any, siblings: any[], route: string) {
  if (typeof window === "undefined") return;
  const slug = productSlug(product, siblings);
  try {
    window.sessionStorage.setItem(`${ORIGIN_PREFIX}${slug}`, JSON.stringify({ route, scrollY: window.scrollY, productId: productIdentity(product), ts: Date.now() }));
  } catch {}
}

export function readProductOrigin(product: any, siblings: any[], consume = false): { route: string; scrollY: number } | null {
  if (typeof window === "undefined") return null;
  const routeSlug = window.location.pathname.startsWith("/producto/")
    ? decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "")
    : "";
  const keys = Array.from(new Set([
    `${ORIGIN_PREFIX}${productSlug(product, siblings)}`,
    routeSlug ? `${ORIGIN_PREFIX}${routeSlug}` : "",
  ].filter(Boolean)));
  try {
    const key = keys.find((candidate) => window.sessionStorage.getItem(candidate)) || keys[0];
    const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (consume) keys.forEach((candidate) => window.sessionStorage.removeItem(candidate));
    if (!parsed?.route || !String(parsed.route).startsWith("/")) return null;
    return { route: String(parsed.route), scrollY: Number(parsed.scrollY || 0) };
  } catch { return null; }
}
