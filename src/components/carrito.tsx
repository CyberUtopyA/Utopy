import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { X } from "lucide-react";
import { useCartStore } from "./cardstore";
const MOBILE_BP = 600;
function isPlaceholderLike(x: any): boolean {
  const v = String(x || "").trim().toLowerCase();
  if (!v) return true;

  return (
    v === "/placeholder.png" ||
    v === "placeholder.png" ||
    v.endsWith("/placeholder.png") ||
    v.includes("placeholder") ||
    v === "null" ||
    v === "undefined"
  );
}

function normalizeImageSrc(x: any, mime = "image/png"): string {
  const v = String(x || "").trim();
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
// =====================
// UI
// =====================
const Overlay = styled.div<{ $isOpen: boolean; $show: boolean }>`
  position: fixed;
  inset: 0;
  display: ${({ $isOpen, $show }) => ($isOpen && $show ? "block" : "none")};
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 999;
`;

const SidebarContainer = styled.aside<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  height: 100dvh;
  height: 100vh;

  width: 380px;
  @media (max-width: ${MOBILE_BP}px) {
    width: min(92vw, 420px);
  }

  background: #ffffff;
  color: #111;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.18);
  border-left: 1px solid rgba(0, 0, 0, 0.06);

  transform: translateX(${({ $isOpen }) => ($isOpen ? "0%" : "100%")});
  transition: transform 0.28s ease-in-out;

  z-index: 1000;
  display: grid;
  grid-template-rows: auto 1fr auto;
`;

const Header = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: -0.01em;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #111;
  cursor: pointer;
  padding: 8px;
  border-radius: 10px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
`;

const Items = styled.div`
  overflow-y: auto;
  padding: 10px 12px;

  @supports (padding: max(0px)) {
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  @media (max-width: ${MOBILE_BP}px) {
    padding: 10px 12px;
  }
`;

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`;

const ItemInfo = styled.div`
  display: grid;
  gap: 8px;
  min-width: 0;

  .top {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .thumb {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    overflow: hidden;
    background: #f3f4f6;
    flex: 0 0 auto;
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumbPh {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.45);
  }

  .name {
    font-weight: 950;
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  .meta {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: 0.85rem;
    opacity: 0.88;
    flex-wrap: wrap;
  }

  .price {
    font-weight: 950;
    opacity: 0.98;
  }

  .sub {
    font-weight: 900;
  }
`;

const ControlsRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;

  @media (max-width: ${MOBILE_BP}px) {
    gap: 8px;
  }
`;

const QtyBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 999px;
  padding: 5px 8px;
  background: #fff;

  @media (max-width: ${MOBILE_BP}px) {
    padding: 6px 10px;
  }
`;

const QtyBtn = styled.button`
  border: none;
  background: rgba(0, 0, 0, 0.06);
  cursor: pointer;
  font-weight: 950;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #000; /* ✅ negro */
  transition: background 0.12s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  &:active {
    background: rgba(0, 0, 0, 0.14);
  }
`;

const QtyVal = styled.div`
  min-width: 22px;
  text-align: center;
  font-weight: 950;
  color: #111;
`;

const RemoveBtn = styled.button`
  background: rgba(229, 57, 53, 0.08);
  border: 1px solid rgba(229, 57, 53, 0.22);
  color: #b71c1c;
  cursor: pointer;
  padding: 7px 10px;
  border-radius: 10px;
  transition: background 0.15s ease, transform 0.05s ease;
  font-weight: 900;

  &:hover {
    background: rgba(229, 57, 53, 0.12);
  }
  &:active {
    transform: translateY(1px);
  }

  @media (max-width: ${MOBILE_BP}px) {
    padding: 8px 10px;
  }
`;

const Footer = styled.div`
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding: 12px 12px;

  @supports (padding: max(0px)) {
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  display: grid;
  gap: 10px;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 950;
  font-size: 1rem;
`;

const Note = styled.div`
  font-size: 0.85rem;
  opacity: 0.78;
`;

const ErrorNote = styled(Note)`
  color: #b00020;
  opacity: 1;
  font-weight: 800;
`;

const ConfirmBtn = styled.button<{ disabled?: boolean; tone?: "primary" | "dark" | "ghost" }>`
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 14px;
  font-weight: 950;
  cursor: pointer;
  transition: transform 0.05s ease, opacity 0.2s ease;

  background: ${({ tone }) => (tone === "dark" ? "#111" : tone === "ghost" ? "#f3f4f6" : "#ffcc00")};
  color: ${({ tone }) => (tone === "dark" ? "#fff" : "#111")};

  &:active {
    transform: translateY(1px);
  }

  ${({ disabled }) =>
    disabled &&
    `
    opacity: .55;
    pointer-events: none;
  `}
`;

// =====================
// helpers
// =====================
type TokenMeta = { address: `0x${string}`; decimals: number; symbol?: string };
type CajeroLike = { id: string; nombre?: string; meta?: any };

function safeNum(n: any, fallback = 0) {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num : fallback;
}
function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

type CartCheckoutPayload = {
  kind: "market.cart.checkout";
  cajero: { id: string; nombre?: string };
  currency: { symbol: string; token?: TokenMeta | null };
  totals: { total: number };
  items: Array<{
    id: string;
    nombre: string;
    qty: number;
    unitPrice: number;
    subtotal: number;
    meta?: any;
  }>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  showOverlay?: boolean;
  activeCajero?: CajeroLike | null;

  // ✅ NUEVO: abre selector de cajero/caja
  onNeedCajero?: () => void;

  // ✅ abre tu checkout/modal principal
  onCheckout?: (payload: CartCheckoutPayload) => void;
};

const CartSidebar: React.FC<Props> = ({
  isOpen,
  onClose,
  showOverlay = true,
  activeCajero,
  onNeedCajero,
  onCheckout,
}) => {
  const { cart, removeFromCart, setQty, clearCart } = useCartStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);
function resolveSellerKey(p: any): { sellerId: string; sellerName?: string | null; cajaId?: string | null } {
  const cajaId =
    p?.meta?.caja?.id ??
    p?.attrs?.meta?.caja?.id ??
    p?.attrs?.caja?.id ??
    null;

  const sellerId =
    p?.sellerId ??
    p?.attrs?.sellerId ??
    p?.meta?.sellerId ??
    p?.nodeId ??
    p?.attrs?.nodeId ??
    p?.meta?.nodeId ??
    p?.originNode ??
    p?.attrs?.originNode ??
    p?.meta?.originNode ??
    p?.storeId ??
    p?.attrs?.storeId ??
    p?.meta?.storeId ??
    p?.productor?.id ??
    p?.attrs?.productor?.id ??
    p?.meta?.productor?.id ??
    "";

  const sellerName =
    p?.sellerName ??
    p?.attrs?.sellerName ??
    p?.meta?.sellerName ??
    p?.storeName ??
    p?.attrs?.storeName ??
    p?.meta?.storeName ??
    p?.nodeName ??
    p?.attrs?.nodeName ??
    p?.productor?.nombre ??
    p?.attrs?.productor?.nombre ??
    p?.meta?.productor?.nombre ??
    null;

  return {
    sellerId: String(sellerId || ""),
    sellerName: sellerName ? String(sellerName) : null,
    cajaId: cajaId ? String(cajaId) : null,
  };
}

  // ✅ normalizar campos (vienen de DV o UI)
  const getId = (p: any) => String(p?.id ?? p?.attrs?.id ?? "");

  const getName = (p: any) =>
    safeStr(p?.nombre ?? p?.name ?? p?.attrs?.nombre ?? p?.attrs?.name ?? "Producto");

  // ✅ FIX imagen: soporta imageUrl + media.image
const getImg = (p: any) => {
  const mime =
    p?.meta?.media?.image?.mime ||
    p?.attrs?.media?.image?.mime ||
    p?.media?.image?.mime ||
    "image/png";

  const rawCandidates = [
    p?.imagen,
    p?.imageUrl,
    p?.imageDataUrl,
    p?.image,

    p?.meta?.media?.image?.url,
    p?.meta?.media?.image?.dataUrl,
    typeof p?.meta?.media?.image === "string" ? p.meta.media.image : "",

    p?.attrs?.media?.image?.url,
    p?.attrs?.media?.image?.dataUrl,
    typeof p?.attrs?.media?.image === "string" ? p.attrs.media.image : "",

    p?.media?.image?.url,
    p?.media?.image?.dataUrl,
    typeof p?.media?.image === "string" ? p.media.image : "",

    p?.attrs?.imagen,
    p?.attrs?.imageUrl,
    p?.attrs?.imageDataUrl,
    p?.attrs?.image,

    p?.meta?.imageUrl,
    p?.meta?.image,
    p?.meta?.["mt:media.image"],
  ];

  for (const raw of rawCandidates) {
    if (!raw || isPlaceholderLike(raw)) continue;
    const normalized = normalizeImageSrc(raw, mime);
    if (normalized && !isPlaceholderLike(normalized)) return normalized;
  }

  const gallery =
    (Array.isArray(p?.meta?.media?.gallery) ? p.meta.media.gallery : [])
      .concat(Array.isArray(p?.attrs?.media?.gallery) ? p.attrs.media.gallery : [])
      .concat(Array.isArray(p?.media?.gallery) ? p.media.gallery : []);

  for (const g of gallery) {
    const raw =
      typeof g === "string"
        ? g
        : g?.url || g?.dataUrl || g?.src || g?.image || "";

    if (!raw || isPlaceholderLike(raw)) continue;
    const normalized = normalizeImageSrc(raw, mime);
    if (normalized && !isPlaceholderLike(normalized)) return normalized;
  }

  return "";
};

  const getUnitPrice = (p: any) =>
    safeNum(p?.price ?? p?.precio ?? p?.attrs?.precio ?? p?.attrs?.price ?? 0, 0);

  const getQty = (p: any) => {
    const q = safeNum(p?.qty ?? p?.cantidad ?? p?.attrs?.qty ?? p?.attrs?.cantidad ?? 1, 1);
    return q > 0 ? q : 1;
  };

  // ✅ detectar vendedor/caja owner (para bloquear multi-vendedor)
  const getSellerId = (p: any) =>
    safeStr(resolveSellerKey(p).sellerId);

  const sellerIds = useMemo(() => {
    const s = new Set<string>();
    for (const it of cart) {
      const id = getSellerId(it);
      if (id) s.add(id);
    }
    return Array.from(s);
  }, [cart]);

  const multiSellerWarning =
    sellerIds.length > 1
      ? `Tenés productos de ${sellerIds.length} vendedores distintos. Separá el pedido por vendedor (o habilitá split automático).`
      : null;

  const total = useMemo(() => {
    return cart.reduce((acc: number, p: any) => acc + getUnitPrice(p) * getQty(p), 0);
  }, [cart]);

  const resolveCurrency = (): { symbol: string; token?: TokenMeta | null; warning?: string } => {
    const firstToken: TokenMeta | null = cart?.[0]?.meta?.token ?? cart?.[0]?.token ?? null;

    const cajToken: TokenMeta | null =
      activeCajero?.meta?.token ?? activeCajero?.meta?.currency?.token ?? null;

    const cajSymbol: string | null =
      activeCajero?.meta?.currencySymbol ?? activeCajero?.meta?.currency?.symbol ?? null;

    const token = firstToken || cajToken || null;
    const symbol = token?.symbol || cajSymbol || "PYG";

    const tokenKeys = new Set(
      cart
        .map((it: any) => it?.meta?.token?.address || it?.token?.address || "__NATIVE__")
        .filter(Boolean)
    );

    if (tokenKeys.size > 1) {
      return { symbol, token, warning: "Tenés productos con monedas distintas. Separá el pedido por moneda." };
    }

    // ✅ el cajero es requerido para confirmar
    if (!activeCajero?.id) {
      return { symbol, token, warning: "Seleccioná un cajero (Caja) para confirmar el pedido." };
    }

    return { symbol, token };
  };

  const formatMoney = (n: number, symbol: string) => `${Math.round(n).toLocaleString("es-PY")} ${symbol}`;
const confirmarPedido = async () => {
  setErr(null);
  if (!cart.length) return;

  const missingSeller = cart.some((product: any) => !resolveSellerKey(product).sellerId);
  if (missingSeller) {
    setErr("Uno de los productos no declara su comercio o nodo vendedor.");
    return;
  }

  const currency = resolveCurrency();
  if (currency.warning) {
    setErr(currency.warning);
    return;
  }

  try {
    setBusy(true);

    // El carrito prepara contexto; Checkout crea la única orden canónica.
    onCheckout?.({
      kind: "market.cart.checkout",
      cajero: { id: String(activeCajero?.id || "caja:unknown"), nombre: activeCajero?.nombre },
      currency: { symbol: currency.symbol, token: currency.token ?? null },
      totals: { total },
      items: cart.map((p: any) => {
        const unitPrice = getUnitPrice(p);
        const qty = getQty(p);
        return {
          id: getId(p),
          nombre: getName(p),
          qty,
          unitPrice,
          subtotal: unitPrice * qty,
          meta: p.meta,
        };
      }),
    });

    // ✅ 4) limpiar y cerrar
    clearCart();
    onClose();
  } catch (e: any) {
    setErr(e?.message || "No se pudo confirmar el pedido.");
  } finally {
    setBusy(false);
  }
};

  const currency = resolveCurrency();
  const canConfirm =
    cart.length > 0 && !busy && !!activeCajero?.id && !multiSellerWarning && !currency.warning;

  return (
    <>
      <Overlay $isOpen={isOpen} $show={showOverlay} onClick={onClose} aria-hidden={!isOpen} />
      <SidebarContainer $isOpen={isOpen} role="dialog" aria-modal="true" aria-label="Carrito">
        <Header>
          <h2>Carrito</h2>
          <CloseButton onClick={onClose} aria-label="Cerrar carrito">
            <X size={22} />
          </CloseButton>
        </Header>

        <Items>
          {cart.length === 0 ? (
            <p style={{ opacity: 0.7, margin: 0 }}>El carrito está vacío</p>
          ) : (
            cart.map((p: any) => {
              const id = getId(p);
              const name = getName(p);
              const img = getImg(p);
              const unitPrice = getUnitPrice(p);
              const qty = getQty(p);
              const subtotal = unitPrice * qty;

              return (
                <ItemRow key={id}>
                  <ItemInfo>
                    <div className="top">
                      <div className="thumb">
                        {img ? (
                          <img src={img} alt={name} />
                        ) : (
                          <div className="thumbPh">🧬</div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div className="name">{name}</div>
                        <div className="meta">
                          <span className="price">{formatMoney(unitPrice, currency.symbol)}</span>
                          <span>× {qty}</span>
                          <span className="sub">= {formatMoney(subtotal, currency.symbol)}</span>
                        </div>
                      </div>
                    </div>

                    <ControlsRow>
                      <QtyBox>
                        <QtyBtn type="button" aria-label="Restar" onClick={() => setQty(id, Math.max(1, qty - 1))}>
                          –
                        </QtyBtn>
                        <QtyVal>{qty}</QtyVal>
                        <QtyBtn type="button" aria-label="Sumar" onClick={() => setQty(id, qty + 1)}>
                          +
                        </QtyBtn>
                      </QtyBox>

                      <RemoveBtn type="button" onClick={() => removeFromCart(id)} aria-label={`Quitar ${name}`}>
                        Quitar
                      </RemoveBtn>
                    </ControlsRow>
                  </ItemInfo>
                </ItemRow>
              );
            })
          )}
        </Items>

        <Footer>
          <TotalRow>
            <span>Total</span>
            <span>{formatMoney(total, currency.symbol)}</span>
          </TotalRow>

          <Note>
            Caja: <b>{activeCajero?.nombre || "sin turno"}</b> · Moneda: <b>{currency.symbol}</b>
          </Note>

          {/* ✅ bloqueos/avisos */}
          {multiSellerWarning && <ErrorNote>{multiSellerWarning}</ErrorNote>}
          {currency.warning && !multiSellerWarning && <ErrorNote>{currency.warning}</ErrorNote>}
          {err && <ErrorNote>{err}</ErrorNote>}

          {/* ✅ si no hay cajero, botón para abrir selector */}
          {!activeCajero?.id && (
            <ConfirmBtn type="button" tone="dark" disabled={busy} onClick={() => onNeedCajero?.()}>
              Elegir cajero / caja
            </ConfirmBtn>
          )}

          <ConfirmBtn disabled={!canConfirm} onClick={confirmarPedido}>
            {busy ? "Enviando..." : "Confirmar pedido"}
          </ConfirmBtn>

          <ConfirmBtn
            type="button"
            tone="ghost"
            disabled={cart.length === 0 || busy}
            onClick={() => {
              clearCart();
              setErr(null);
            }}
          >
            Vaciar carrito
          </ConfirmBtn>
        </Footer>
      </SidebarContainer>
    </>
  );
};

export default CartSidebar;
