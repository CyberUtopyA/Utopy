import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { profileHandleForIdentity } from "../mt/productRoute";
import { formatUniversalMoney, projectUniversalProduct, universalProductToCheckoutProduct, type UniversalProductView } from "../mt/universalProduct";
export { formatUniversalMoney, projectUniversalProduct, universalProductToCheckoutProduct } from "../mt/universalProduct";
export type { UniversalProductView } from "../mt/universalProduct";
import { ShareIcon } from "lucide-react";
import ProductRealityPanel from './ProductRealityPanel';
import {projectProductReality} from '../mt/productReality';
import { inspectWithMotion, prefetchProductCheckout, useProductMotionSurface } from './productMotion';
import { useNodeOrderPresence } from '../utopy/useCapabilityPresence';

/* export type UniversalProductView = {
  id: string;
  productId: string;
  sellerNodeId: string;
  title: string;
  seller: string;
  description: string;
  collection: string;
  image: string;
  currency: string;
  finalPrice: number | null;
  basePrice: number | null;
  discountAmount: number | null;
  discountPct: number | null;
  installmentCount: number | null;
  installmentValue: number | null;
  available: boolean;
  stock: number | null;
  publicPath: string;
  source: any;
};

function text(...values: unknown[]) {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}

function positive(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function formatUniversalMoney(value: number | null, currency = "PYG") {
  if (value == null) return "Consultar";
  const formatted = Math.round(value).toLocaleString("es-PY");
  const code = String(currency || "PYG").toUpperCase();
  if (["PYG", "GS", "GUARANI"].includes(code)) return `₲${formatted}`;
  if (code === "BRL") return `R$ ${formatted}`;
  if (code === "USD") return `US$ ${formatted}`;
  return `${formatted} ${code}`;
}

export function projectUniversalProduct(source: any, overrides: Partial<UniversalProductView> = {}): UniversalProductView {
  const raw = source?.raw || source || {};
  const attrs = raw?.attrs || {};
  const merchandising = readPublishedMerchandising(raw);
  const inventory = attrs?.inventory || raw?.inventory || {};
  const stockValue = attrs?.stockQty ?? attrs?.stock ?? inventory?.stockQty ?? inventory?.stock ?? raw?.stockQty ?? raw?.stock ?? source?.stockQty ?? source?.stock;
  const stock = Number.isFinite(Number(stockValue)) ? Number(stockValue) : null;
  const imageCandidate = attrs?.image || attrs?.imagen || attrs?.cover || raw?.image || raw?.imagen || raw?.cover || source?.image || source?.cover;
  const image = Array.isArray(imageCandidate) ? text(imageCandidate[0]) : text(imageCandidate);
  const currency = text(attrs?.currency, raw?.currency, source?.currency, source?.estimatedCurrency, "PYG");
  const productId = productIdentity(raw) || text(overrides.productId, overrides.id, "product");
  const title = text(attrs?.title, attrs?.nombre, attrs?.name, raw?.title, raw?.nombre, raw?.name, source?.title, source?.nombre, overrides.title, "Producto");
  const seller = text(
    attrs?.sellerName, attrs?.storeName, attrs?.producerName, attrs?.vendor?.name,
    raw?.sellerName, raw?.storeName, source?.sellerName, source?.producerName,
    overrides.seller, "Nodo vendedor",
  );
  const description = text(attrs?.shortDescription, attrs?.description, attrs?.descripcion, attrs?.story, attrs?.blurb, attrs?.subtitle, attrs?.summary, raw?.description, raw?.descripcion, raw?.story, raw?.subtitle, raw?.summary, source?.description, source?.subtitle, overrides.description);
  const collection = text(attrs?.collection?.name, attrs?.collection, raw?.collection?.name, raw?.collection);
  const sellerNodeId = text(attrs?.sellerNodeId, attrs?.nodeId, attrs?.sellerId, attrs?.vendor?.id, raw?.sellerNodeId, raw?.nodeId, raw?.sellerId, source?.sellerId, source?.sourceNode, overrides.sellerNodeId);
  const explicitAvailable = attrs?.available ?? inventory?.available ?? raw?.available ?? source?.available ?? source?.inStock;
  const status = text(attrs?.status, inventory?.status, raw?.status).toLowerCase();
  const available = attrs?.deleted !== true && raw?.deleted !== true && (
    (stock != null && stock > 0) || explicitAvailable === true ||
    (stock == null && explicitAvailable !== false && !["out_of_stock", "unavailable", "deleted"].includes(status))
  );
  const finalPrice = merchandising.finalPrice ?? positive(source?.price, source?.estimatedCost, overrides.finalPrice);
  const projected: UniversalProductView = {
    id: productId,
    productId,
    sellerNodeId,
    title,
    seller,
    description,
    collection,
    image: image || text(overrides.image),
    currency: currency || text(overrides.currency, "PYG"),
    finalPrice,
    basePrice: merchandising.basePrice ?? overrides.basePrice ?? null,
    discountAmount: merchandising.discountAmount ?? overrides.discountAmount ?? null,
    discountPct: merchandising.discountPct ?? overrides.discountPct ?? null,
    installmentCount: merchandising.installmentCount ?? overrides.installmentCount ?? null,
    installmentValue: merchandising.installmentValue ?? overrides.installmentValue ?? null,
    available,
    stock,
    publicPath: text(overrides.publicPath),
    source: raw,
  };
  projected.publicPath ||= productPathFor(projected);
  return projected;
}

export function universalProductToCheckoutProduct(product: UniversalProductView) {
  const raw = product.source || {};
  return {
    ...raw,
    id: product.productId,
    productId: product.productId,
    nombre: product.title,
    name: product.title,
    description: product.description,
    collection: product.collection,
    image: product.image,
    price: product.finalPrice,
    finalPrice: product.finalPrice,
    currency: product.currency,
    stock: product.stock,
    stockQty: product.stock,
    available: product.available,
    attrs: {
      ...(raw.attrs || {}),
      productId: product.productId,
      nombre: product.title,
      description: product.description,
      collection: product.collection,
      image: product.image,
      finalPrice: product.finalPrice,
      currency: product.currency,
      stock: product.stock,
      stockQty: product.stock,
      available: product.available,
      sellerName: product.seller,
      sellerNodeId: product.sellerNodeId,
      nodeId: product.sellerNodeId || raw?.attrs?.nodeId,
    },
  };
} */

type Props = {
  open: boolean;
  product: UniversalProductView | null;
  onClose: () => void;
  onBuy: (product: UniversalProductView) => void;
  onConsult: (product: UniversalProductView) => void;
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export default function UniversalProductDialog({ open, product, onClose, onBuy, onConsult }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const orderPresence=useNodeOrderPresence(product?.sellerNodeId||'',open);
  const paused=orderPresence.checking||orderPresence.status==='paused'||orderPresence.status==='resting';
  const surface = useProductMotionSurface(open && !!product, product?.productId || '', () => fullscreen ? setFullscreen(false) : onClose());
  const fullscreenSurface = useProductMotionSurface(open && fullscreen, product?.productId || '', () => setFullscreen(false));
  useEffect(() => { setFullscreen(false); }, [product?.productId, open]);
  useEffect(() => {
    if (!open || !product || typeof document === "undefined") return;
    const absoluteUrl = new URL(product.publicPath || productPathFor(product), window.location.origin).toString();
    const previousTitle = document.title;
    document.title = `${product.title} · ${product.seller}`;
    const entries: Array<[string, string, string]> = [
      ["name", "description", product.description || `${product.title} disponible en ${product.seller}.`],
      ["property", "og:title", `${product.title} · ${product.seller}`],
      ["property", "og:description", product.description || `${product.title} disponible en ${product.seller}.`],
      ["property", "og:image", product.image],
      ["property", "og:url", absoluteUrl],
    ];
    const touched: Array<{ node: HTMLMetaElement; previous: string | null; created: boolean }> = [];
    for (const [attribute, key, content] of entries) {
      if (!content) continue;
      let node = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      const created = !node;
      if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.appendChild(node); }
      touched.push({ node, previous: node.getAttribute("content"), created });
      node.setAttribute("content", content);
    }
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalCreated = !canonical;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    const previousCanonical = canonical.href;
    canonical.href = absoluteUrl;
    const json = document.createElement("script");
    json.type = "application/ld+json";
    json.dataset.utopyProduct = product.productId;
    const reality=projectProductReality(product.source);
    json.text = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: product.title, description: product.description || undefined, image: product.image ? [product.image] : undefined, seller: { "@type": "Organization", name: product.seller }, offers: product.finalPrice != null ? { "@type": "Offer", url: absoluteUrl, price: String(product.finalPrice), priceCurrency: product.currency, availability: reality.consultationOnly || !reality.availabilityKnown ? undefined : product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } : undefined });
    document.head.appendChild(json);
    return () => {
      document.title = previousTitle;
      touched.forEach(({ node, previous, created }) => created ? node.remove() : previous == null ? node.removeAttribute("content") : node.setAttribute("content", previous));
      if (canonicalCreated) canonical?.remove(); else if (canonical) canonical.href = previousCanonical;
      json.remove();
    };
  }, [open, product]);
  if (!open || !product) return null;
  const reality=projectProductReality(product.source);
  const share = async () => {
    const url = new URL(product.publicPath || productPathFor(product), window.location.origin).toString();
    if (navigator.share) await navigator.share({ title: product.title, text: product.description, url });
    else { await navigator.clipboard.writeText(url); }
  };
  return (
    <Backdrop onClick={onClose}>
      <Dialog ref={surface} role="dialog" aria-modal="true" aria-label={product.title} onClick={(event) => event.stopPropagation()}>
        <Media>{product.image ? <button type="button" onClick={() => setFullscreen(true)} aria-label="Ver imagen grande"><img src={product.image} alt={product.title} /></button> : <span>📦</span>}</Media>
        <Body>
          <Header><div><h2>{product.title}</h2><p><a href={`/${profileHandleForIdentity(product.source, product.seller)}`}>{product.seller}</a></p></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></Header>
          {product.collection ? <Collection>{product.collection}</Collection> : null}
          <Price>
            {product.basePrice ? <s>{formatUniversalMoney(product.basePrice, product.currency)}</s> : null}
            <strong>{formatUniversalMoney(product.finalPrice, product.currency)}</strong>
            {product.discountAmount ? <em>🔥 Ahorrás {formatUniversalMoney(product.discountAmount, product.currency)}</em> : product.discountPct ? <em>🔥 -{product.discountPct}%</em> : null}
          </Price>
          {product.installmentCount && product.installmentValue ? <Installments>🗓 Hasta {product.installmentCount} cuotas de {formatUniversalMoney(product.installmentValue, product.currency)}</Installments> : null}
          <Availability data-available={product.available&&!paused}>{paused?orderPresence.label:reality.consultationOnly||!reality.availabilityKnown?'Consultar disponibilidad y condiciones':product.available ? product.stock != null ? `${product.stock} disponibles` : "Disponible según el vendedor" : "No disponible"}</Availability>
          {product.description ? <details><summary>Sobre este producto</summary><Description>{product.description}</Description></details> : null}
          <ProductRealityPanel key={product.productId} source={product.source}/>
          <NetworkDetails><summary>⚙️ Detalles de red</summary><div>Nodo: {firstText(product.source?.attrs?.nodeId, product.source?.meta?.originNode, product.source?.meta?.authority, product.source?.attrs?.sellerId, "No publicado")}</div><div>Dato vivo: {product.id}</div></NetworkDetails>
          <Actions><button type="button" className="share" aria-label="Compartir producto" onClick={() => { void share().catch(() => {}); }}>
            <ShareIcon />
          </button><button type="button" className="secondary" onClick={() => onConsult(product)}>Consultar</button><button type="button" className="primary" onPointerEnter={prefetchProductCheckout} onFocus={prefetchProductCheckout} disabled={paused || !product.available || !reality.availabilityKnown || reality.consultationOnly || product.finalPrice == null} onClick={(event) => inspectWithMotion(event.currentTarget.closest('[role="dialog"]') as HTMLElement || event.currentTarget, () => onBuy(product))}>Comprar</button></Actions>
        </Body>
      </Dialog>
      {fullscreen && product.image ? <Fullscreen ref={fullscreenSurface} role="dialog" aria-modal="true" aria-label="Imagen del producto" onClick={(event) => { event.stopPropagation(); setFullscreen(false); }}><button type="button" aria-label="Cerrar imagen">×</button><img src={product.image} alt={product.title} /></Fullscreen> : null}
    </Backdrop>
  );
}

const Backdrop = styled.div`position:fixed;inset:0;z-index:9996;display:grid;place-items:center;padding:18px;background:rgba(3,14,8,.54);backdrop-filter:blur(10px);@media(max-width:640px){place-items:end center;padding:0;}`;
const Dialog = styled.div`width:min(760px,96vw);max-height:92dvh;overflow:auto;display:grid;grid-template-columns:minmax(260px,.92fr) minmax(0,1.08fr);border:1px solid rgba(255,255,255,.72);border-radius:32px;background:linear-gradient(150deg,rgba(255,255,255,.97),rgba(244,251,247,.93));box-shadow:0 30px 90px rgba(0,20,8,.3);@media(max-width:640px){width:100%;max-width:100vw;max-height:95dvh;grid-template-columns:1fr;border-radius:28px 28px 0 0;}`;
const Media = styled.div`min-height:360px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#edf6f0,#e5f0e9);font-size:54px;button{width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}img{width:100%;height:100%;object-fit:cover;}@media(max-width:640px){min-height:220px;max-height:36dvh;}`;
const Body = styled.div`min-width:0;display:grid;align-content:start;gap:12px;padding:22px;@media(max-width:640px){padding:18px 16px calc(16px + env(safe-area-inset-bottom));}`;
const Header = styled.header`display:flex;justify-content:space-between;align-items:flex-start;gap:14px;h2{margin:0;font-size:24px;line-height:1.1;}p{margin:6px 0 0;color:#5c6b62;font-size:13px;}p a{color:inherit;font-weight:800;text-decoration:none}p a:hover{text-decoration:underline}button{width:42px;height:42px;flex:0 0 auto;border:1px solid #dce5df;border-radius:999px;background:#fff;font-size:21px;cursor:pointer;}`;
const Collection = styled.div`width:max-content;padding:6px 10px;border:1px solid #ddd6fe;border-radius:999px;background:#f5f3ff;color:#6d28d9;font-size:10px;font-weight:950;letter-spacing:.08em;`;
const Price = styled.div`display:grid;gap:3px;s{color:#8b9690;font-size:13px;}strong{font-size:30px;line-height:1;color:#10251a;}em{width:max-content;margin-top:5px;padding:7px 10px;border-radius:999px;background:#fff1f2;color:#b42335;font-size:12px;font-style:normal;font-weight:950;}`;
const Installments = styled.div`padding:10px 12px;border-radius:15px;background:#eef8f1;color:#17643a;font-size:12px;font-weight:900;`;
const Availability = styled.div`width:max-content;padding:6px 9px;border-radius:999px;background:#edf9f1;color:#17713e;font-size:11px;font-weight:900;&[data-available="false"]{background:#fff1f2;color:#be123c;}`;
const Description = styled.p`margin:10px 0 0;color:#536259;font-size:13px;line-height:1.55;white-space:pre-line;overflow-wrap:anywhere;`;
const NetworkDetails = styled.details`padding:9px 11px;border:1px solid #e0e7e2;border-radius:14px;color:#647168;font-size:10px;summary{cursor:pointer;font-weight:900;}div{margin-top:6px;overflow-wrap:anywhere;}`;
const Actions = styled.div`position:sticky;bottom:-22px;display:grid;grid-template-columns:auto 1fr 1.4fr;gap:8px;margin:4px -22px -22px;padding:12px 22px calc(18px + env(safe-area-inset-bottom));background:rgba(250,254,251,.92);backdrop-filter:blur(15px);button{min-height:48px;border-radius:15px;font-weight:950;cursor:pointer}.share,.secondary{border:1px solid #d7e0da;background:#fff}.primary{border:0;background:linear-gradient(135deg,#18e65b,#32ff6f);color:#073b1d;box-shadow:0 8px 22px rgba(20,184,74,.2)}button:disabled{opacity:.48;cursor:not-allowed}@media(max-width:640px){bottom:-18px;margin:4px -16px -18px;padding-inline:16px;grid-template-columns:1fr 1fr}.primary{grid-column:1/-1}}`;
const Fullscreen = styled.div`position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:24px;background:rgba(0,8,4,.92);cursor:zoom-out;img{max-width:96vw;max-height:92dvh;object-fit:contain;border-radius:20px}button{position:absolute;right:18px;top:18px;width:48px;height:48px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:28px}`;
