// Mercado.tsx (actualizado completo)
// ✅ Responsive mobile/tablet
// ✅ Tabs/botones abajo (bottom nav) + "Producir" solo icono
// ✅ Header compacto (arriba ocupa poco)
// ✅ Grid: precio sin “BNB” + “Pago: Cajero recomendado”
// ✅ Checkout: default Cajero, BNB como opción avanzada
// ✅ AR: visor modal responsive si product.meta.ar.modelUrl existe
// ✅ Sem/trust: chips (Sem ok / conflicto) solo lectura (viene de otros nodos)
// ✅ Producir en mobile: SOLO ICONO (sin label)
// ✅ Desktop: tabs arriba (no bottom nav) + botón Producir visible
// ------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { CarrotIcon, Bell, BellOff, SendHorizonalIcon, Share2Icon } from "lucide-react";
import NotificationSelectorModal from "./Notificacion";
// ✅ AR viewer web
import "@google/model-viewer";
import Portal from "./ui/portal"; // ajustá ruta
import { mtLiveUpsert, mtLiveSubscribe } from "../mt/mt.liveStore";
import { useCartStore } from "../components/cardstore";
import CartSidebar from "../components/carrito";

import {
  adaptDatosToMtProducts,
  DatoVivo,
  MtProduct,
  MtOffer,
  adaptDatosToMtOffers,
} from "../mt/mt.traitAdapter";

import { adaptDatosToMtCajeros, MtCajero } from "../mt/mt.cajeroAdapter";
import CajerosPanel from "../mt/CajerosPanel";

import ProducirPanel from "./ProducirPanel";
import CategoriasPanel from "../mt/CategoriasPanel";

import { flyToCart } from "../mt/flytocart";
import { startMtEscrowEngineForMsWeb } from "../mt/mt.escrowEngine";
import { isAdminOrSupervisor } from "../mt/mt.cajeroroles";
import CajeroAuthPanel from "../mt/CajeroAuthPanel";
import CajeroPedidosPanel from "../mt/pedidos";
import BuyerOrdersPanel from "../mt/buyerorderpanel";
import CheckoutModal from "./checkoutmodal";
import OfferActionModal from "../mt/offeractionmodal";
import TradeInboxPanel from "../mt/tradeinboxPanel";
import { requestPushPermission } from "../onesignal";
import { clearNamespaceTags, setNamespaceTag } from "../pushtags";
import { resolveOfferThreadId, resolveProductThreadId } from "../mt/tradeThread";
import FabricaVivaPanel from "../mt/fabricaviva";
import InvoiceCenter from "../mt/invoicecenter";
import MtPresenceOverlay from "../utopy/presence/Mt.presence.overlay";
import { usePresenceEmitter } from "../utopy/presence/usepresenceemitter";
import { offerToPresence, orderToPresence, productToPresence } from "../utopy/presence/mt.presence.adapter";
import usePresenceScanner from "./usepresencescanner";
import PresenceRadar from "../utopy/presence/PresenceRadar";
import PresenceHeatBadge from "../utopy/presence/PresenceHeatBadge";
import PresenceNowChip from "../utopy/presence/PresenceNowChip";
import WorkInboxPanel from "../mt/workinboxpanel";
import ProducerQueuePanel from "../mt/ProducerQueuePanel";
import { startPaymentBotRuntime } from "../mt/paymentbotruntime";
import { useTradeIntentReceiver } from "../mt/usetradeintentreceiver";
import CircularCenter from "./circularcenter";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { publishDatoVivo } from "../mt/seedbus";

// =========================================================
// Estilos base + responsive
// =========================================================
const ProduceHeader = styled.div`
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
`;

const ProduceTitle = styled.div`
  font-weight: 950;
  font-size: 1.05rem;
`;

const ProduceSub = styled.div`
  font-size: 0.9rem;
  opacity: 0.72;
`;

const ProduceBlock = styled.div`
  display: grid;
  gap: 10px;
`;

const ProduceBlockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const ProduceBlockTitle = styled.div`
  font-weight: 950;
  font-size: 0.98rem;
`;

const ProduceBlockSub = styled.div`
  font-size: 0.82rem;
  opacity: 0.68;
`;

const ProduceDivider = styled.div`
  height: 1px;
  background: rgba(0,0,0,0.06);
  margin: 2px 0 4px;
`;


const ProduceHero = styled.div`
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 18px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  display: grid;
  gap: 6px;
`;

const ProduceHeroRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ProducePill = styled.span<{ tone?: "ok" | "warn" | "neutral" }>`
  font-size: 12px;
  font-weight: 900;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.06);
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.12)"
      : tone === "warn"
      ? "rgba(245,158,11,0.14)"
      : "rgba(0,0,0,0.04)"};
`;
const Page = styled.div`
  width: 100vw;
  min-height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Content = styled.div`
  width: 100%;
  max-width: 1100px;
  padding: 12px;
  padding-bottom: calc(76px + env(safe-area-inset-bottom)); /* bottom nav */
  @media (min-width: 900px) {
    padding: 16px;
    padding-bottom: 16px; /* desktop no necesita bottom nav */
  }
`;
const PresenceMiniBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`;

const PresenceMiniChip = styled.span<{ tone?: "ok" | "info" | "warn" }>`
  font-size: 11px;
  font-weight: 900;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.12)"
      : tone === "warn"
        ? "rgba(245,158,11,0.12)"
        : "rgba(59,130,246,0.10)"};
  color: #111;
`;

const Section = styled.section`
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 18px;
  padding: 12px;
  @media (min-width: 900px) {
    padding: 16px;
  }
`;

const Grid = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (min-width: 520px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (min-width: 900px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (min-width: 1100px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  min-width: 0;
`;

const Img = styled.img.attrs({
  loading: "lazy",
  decoding: "async",
})`
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 12px;
  background: #f2f2f2;
`;
const PresenceGlobalBlock = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: center;
`;
const Title = styled.div`
  font-weight: 900;
  margin-top: 10px;
  line-height: 1.15;
  font-size: 0.95rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Price = styled.div`
  font-weight: 900;
  margin-top: 6px;
  font-size: 0.95rem;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.88rem;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;
const Chip = styled.span<{ tone?: "ok" | "warn" | "neutral" }>`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.10)"
      : tone === "warn"
        ? "rgba(245,158,11,0.12)"
        : "rgba(0,0,0,0.04)"};
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 10px;

  @media (min-width: 520px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const SmallBtn = styled.button<{ tone?: "primary" | "ghost" }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px 10px;
  background: ${({ tone }) => (tone === "ghost" ? "#fff" : "#15ff00ff")};
  color: #111;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 900;
  width: 100%;
`;

const ProducirLayout = styled.div`
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;

  @media (max-width: 1100px) {
    grid-template-columns: 320px minmax(0, 1fr);
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  > * {
    min-width: 0;
  }
`;
const NavHoldWrap = styled.div`
  position: relative;
  min-width: 0;
`;

const NavMoreBubble = styled.div<{ open?: boolean }>`
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%)
    ${({ open }) => (open ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)")};
  opacity: ${({ open }) => (open ? 1 : 0)};
  pointer-events: ${({ open }) => (open ? "auto" : "none")};
  transition: opacity 0.16s ease, transform 0.16s ease;
  z-index: 80;

  min-width: 178px;
  padding: 8px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -7px;
    transform: translateX(-50%) rotate(45deg);
    width: 14px;
    height: 14px;
    background: rgba(255, 255, 255, 0.98);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
`;

const NavMoreBtn = styled.button`
  width: 100%;
  border: none;
  border-radius: 14px;
  background: rgba(34, 197, 94, 0.12);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 950;
  color: #111;
  text-align: left;

  &:active {
    transform: translateY(1px);
  }
`;

const NavMoreIcon = styled.span`
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #15ff00ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
`;

const NavMoreText = styled.span`
  display: grid;
  gap: 1px;
  line-height: 1.05;
`;

const NavMoreTitle = styled.span`
  font-size: 0.82rem;
  font-weight: 950;
`;

const NavMoreSub = styled.span`
  font-size: 0.68rem;
  opacity: 0.65;
  font-weight: 800;
`;

const NavHoldHint = styled.span`
  position: absolute;
  right: 8px;
  top: 5px;
  font-size: 10px;
  opacity: 0.55;
  pointer-events: none;
`;
const ProduceSide = styled.div`
  display: grid;
  gap: 12px;
  min-width: 0;
  align-self: start;
`;

const ProduceMain = styled.div`
  display: grid;
  gap: 12px;
  min-width: 0;
  align-self: start;
`;

const ProduceCard = styled.div`
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 18px;
  background: #fff;
  padding: 12px;
  min-width: 0;
  overflow: hidden;
`;
const ProduceModeBar = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;

  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ProduceModeBtn = styled.button<{ active?: boolean }>`
  border: 1px solid ${({ active }) => (active ? "#111" : "rgba(0,0,0,0.08)")};
  border-radius: 18px;
  padding: 12px 10px;
  background: ${({ active }) =>
    active
      ? "linear-gradient(180deg,#111 0%,#242424 100%)"
      : "linear-gradient(180deg,#fff 0%,#f8fafc 100%)"};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  cursor: pointer;
  display: grid;
  gap: 4px;
  text-align: left;
  min-height: 74px;
  box-shadow: ${({ active }) =>
    active ? "0 14px 34px rgba(0,0,0,0.16)" : "0 8px 20px rgba(0,0,0,0.04)"};
`;

const ProduceModeIcon = styled.div`
  font-size: 1.25rem;
  line-height: 1;
`;

const ProduceModeTitle = styled.div`
  font-size: 0.86rem;
  font-weight: 950;
`;

const ProduceModeSub = styled.div`
  font-size: 0.68rem;
  opacity: 0.68;
  font-weight: 800;
  line-height: 1.15;
`;

const EmptySoftBox = styled.div`
  border: 1px dashed rgba(0,0,0,0.12);
  border-radius: 18px;
  padding: 18px;
  background: rgba(0,0,0,0.025);
  display: grid;
  gap: 6px;
`;
type ProduceView = "trabajos" | "conversaciones" | "pedidos" | "publicar" | "caja";
type Tab =
  | "mercado"
  | "categorias"
  | "ofertas"
  | "mis_pedidos"
  | "producir"
  | "circular"; 

const TopBar = styled.div`
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(250, 250, 250, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
`;

const TopInner = styled.div`
  width: 100%;
  max-width: 1100px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  @media (min-width: 900px) {
    padding: 12px 16px;
  }
`;

const Brand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const BrandTitle = styled.div`
  font-weight: 950;
  font-size: 0.95rem;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BrandSub = styled.div`
  font-size: 0.78rem;
  opacity: 0.7;
  line-height: 1;
  display: flex;
  gap: 8px;
  align-items: center;
`;

const RightTools = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;
const MiniSelect = styled.select`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(34, 197, 94, 0.12); /* ✅ verde suave */
  color: #111;
  font-size: 0.85rem;
  max-width: 160px;

  &:focus {
    outline: none;
    border-color: rgba(34, 197, 94, 0.6);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
  }
`;
const TabWrap = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const BadgeRed = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;


const PillBtn = styled.button`
  border: 1px solid rgba(34, 197, 94, 0.45); /* ✅ borde verde */
  border-radius: 999px;
  padding: 7px 10px;
  background: #15ff00ff; /* ✅ verde vivo */
  color: #111;
  cursor: pointer;
  font-weight: 950;
  font-size: 0.85rem;

  &:active {
    transform: translateY(1px);
  }
`;

const StatusDot = styled.span<{ s: "live" | "fallback" | "idle" }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
  background: ${({ s }) =>
    s === "live" ? "#16a34a" : s === "fallback" ? "#f59e0b" : "#9ca3af"};
`;

const DesktopTabsRow = styled.div`
  display: none;
  @media (min-width: 900px) {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 10px 0 0;
  }
`;const IconGhostBtn = styled.button<{ active?: boolean }>`
  border: none;
  background: ${({ active }) => (active ? "rgba(34, 197, 94, 0.12)" : "transparent")};
  color: ${({ active }) => (active ? "#16a34a" : "#111")};
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.18s ease, transform 0.12s ease, color 0.18s ease;

  &:hover {
    background: ${({ active }) =>
      active ? "rgba(34, 197, 94, 0.18)" : "rgba(0, 0, 0, 0.06)"};
  }

  &:active {
    transform: translateY(1px);
  }

  &::after {
    content: "";
    position: absolute;
    right: 8px;
    top: 8px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: ${({ active }) => (active ? "#16a34a" : "transparent")};
    box-shadow: ${({ active }) =>
      active ? "0 0 0 2px rgba(255,255,255,0.95)" : "none"};
  }

  svg {
    width: 24px;
    height: 24px;
    stroke-width: 2.4;
  }
`;
const DesktopTabBtn = styled.button<{ active?: boolean }>`
  border: 1px solid ${({ active }) => (active ? "#111" : "rgba(0,0,0,0.12)")};
  background: ${({ active }) => (active ? "#111" : "#fff")};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 950;
  font-size: 0.85rem;
`;

const BottomNav = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: env(safe-area-inset-bottom);

  @media (min-width: 900px) {
    display: none;
  }
`;

const BottomInner = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 8px 10px;
`;

const NavBtn = styled.button<{ active?: boolean }>`
  border: none;
  background: ${({ active }) =>
    active ? "rgba(34,197,94,0.12)" : "transparent"};
  border-radius: 14px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 950;
  font-size: 0.72rem;
`;

const NavIcon = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`;

// ✅ Producir: solo icono en mobile
const ProducirLabel = styled.div`
  display: none; /* oculto por default (mobile) */
  @media (min-width: 900px) {
    display: block; /* desktop sí muestra label */
  }
`;
function normalizeImageSrc(x: any, mime = "image/png"): string | null {
  if (!x || typeof x !== "string") return null;

  const v = x.trim();
  if (!v) return null;

  // ya viene listo
  if (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("blob:")
  ) {
    return v;
  }

  // parece base64 crudo
  const looksBase64 =
    /^[A-Za-z0-9+/=\s]+$/.test(v) &&
    !v.includes("{") &&
    !v.includes("}");

  if (looksBase64) {
    const compact = v.replace(/\s+/g, "");
    return `data:${mime};base64,${compact}`;
  }

  return v;
}
// =========================================================
// Helpers + WS client
// =========================================================
const MICELIO_HTTP =
  (import.meta as any).env?.VITE_MICELIO_HTTP ??
  "https://seed.mterra.space/micelio";

const WS_URL =
  (import.meta as any).env?.VITE_UTOPY_WS ??
  "wss://seed.mterra.space/utopy?ns=mt";

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
function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}
function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function normalizeSay(x: any): string {
  return String(x ?? "")
    .trim()
    .replace(/\s+/g, "");
}
function getOfferNs(o: any): string {
  return (
    o?.meta?.ns || o?.attrs?.meta?.ns || o?.attrs?.ns || o?.ns || "__UNKNOWN__"
  );
}
function getOfferStatus(o: any): string {
  return String(
    o?.meta?.status ||
      o?.attrs?.status ||
      o?.status ||
      "active"
  )
    .trim()
    .toLowerCase();
}function isExplodedMoPackDV(x: any) {
  const kind = String(x?.kind || x?.attrs?.kind || "").trim();

  const title = String(
    x?.attrs?.title ||
      x?.attrs?.nombre ||
      x?.attrs?.name ||
      x?.labels?.[0] ||
      ""
  );

  const productId = String(
    x?.attrs?.productoId ||
      x?.attrs?.productId ||
      x?.productoId ||
      x?.productId ||
      ""
  );

  const sourceKind = String(
    x?.attrs?.source?.kind ||
      x?.attrs?.sourceKind ||
      x?.attrs?.dvRef?.kind ||
      ""
  );

  const repeatedPackCount = (title.match(/Pack para Fabricar/g) || []).length;

  const hasResonance =
    x?.meta?.resonance?.mode === "fabrication" ||
    x?.meta?.resonance?.mode === "market.offer" ||
    Boolean(x?.attrs?.publicId) ||
    Boolean(x?.attrs?.targetNode) ||
    Boolean(x?.attrs?.waitForResponse);

  // ✅ Trabajo nuevo correcto enviado desde el modal de resonancia.
  if (kind === "work.intent" && hasResonance) {
    return false;
  }

  // 🚫 Work.intent viejo generado por el bug automático de packs.
  if (
    kind === "work.intent" &&
    sourceKind === "mo.fabrication.pack" &&
    !hasResonance
  ) {
    return true;
  }

  // 🚫 Work.intent viejo con título explotado.
  if (
    kind === "work.intent" &&
    repeatedPackCount >= 2 &&
    !hasResonance
  ) {
    return true;
  }

  // 🚫 Ofertas/productos viejos generados por el puente automático.
  if (
    kind === "mt:offer" ||
    kind === "mt.offer" ||
    kind === "producto" ||
    kind === "mt.product"
  ) {
    return (
      productId.includes("mo.fabrication.pack") ||
      sourceKind === "mo.fabrication.pack" ||
      repeatedPackCount >= 2 ||
      title.includes("Pack para Fabricar · Pack para Fabricar")
    );
  }

  return false;
}
function isOfferClosed(o: any): boolean {
  const s = getOfferStatus(o);
  return (
    s === "completed" ||
    s === "cancelled" ||
    s === "expired" ||
    s === "closed" ||
    s === "settled"
  );
}
function getOfferImage(o: any): string | null {
  const raw =
    o?.imagen ||
    o?.imageUrl ||
    o?.imageDataUrl ||
    o?.meta?.media?.image?.url ||
    o?.meta?.media?.image?.dataUrl ||
    o?.media?.image?.url ||
    o?.media?.image?.dataUrl ||
    o?.attrs?.imagen ||
    o?.attrs?.image ||
    o?.attrs?.media?.image?.url ||
    o?.attrs?.media?.image?.dataUrl ||
    o?.traits?.render?.url ||
    o?.traits?.render?.dataUrl ||
    null;

  const mime =
    o?.meta?.media?.image?.mime ||
    o?.attrs?.media?.image?.mime ||
    o?.traits?.render?.mime ||
    "image/png";

  return normalizeImageSrc(raw, mime);
}
function getOfferTitle(o: any): string {
  return (
    o?.title || o?.attrs?.title || o?.nombre || o?.productoId || "Oferta viva"
  );
}
function getOfferQty(o: any): number {
  const n = Number(o?.cantidad ?? o?.attrs?.cantidad ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function buildEnrichedOfferForAction(o: MtOffer, products: MtProduct[]): MtOffer {
  const linked = products.find((p) => String(p.id) === String(o.productoId));
  const offerAny = o as any;
  const linkedAny = linked as any;

  const threadId =
    offerAny?.attrs?.contact?.threadId ||
    offerAny?.contact?.threadId ||
    offerAny?.meta?.threadId ||
    resolveOfferThreadId(o);

  const author =
    offerAny?.attrs?.author ||
    offerAny?.author ||
    linkedAny?.attrs?.author ||
    linked?.meta?.author ||
    null;

  const contact =
    offerAny?.attrs?.contact ||
    offerAny?.contact ||
    linkedAny?.attrs?.contact ||
    linked?.meta?.contact ||
    null;

  const vendor =
    offerAny?.attrs?.vendor ||
    offerAny?.vendor ||
    linkedAny?.attrs?.vendor ||
    linked?.meta?.vendor ||
    null;

  const source =
    offerAny?.attrs?.source ||
    offerAny?.source ||
    linkedAny?.attrs?.source ||
    linked?.meta?.source ||
    null;

  return {
    ...o,
    meta: {
      ...(o.meta || {}),
      threadId,
      author,
      contact,
      vendor,
      source,
    },
    attrs: {
      ...(offerAny?.attrs || {}),
      author,
      contact,
      vendor,
      source,
    },
  } as MtOffer;
}
function settleOfferQuantity(offer: any, boughtQty: number) {
  const currentQty = Math.max(0, getOfferQty(offer));
  const nextQty = Math.max(0, currentQty - Math.max(0, Number(boughtQty || 0)));
  const completed = nextQty <= 0;
  const now = new Date().toISOString();

  return {
    ...offer,
    cantidad: nextQty,
    attrs: {
      ...(offer?.attrs || {}),
      cantidad: nextQty,
      status: completed ? "completed" : "active",
      completedAt: completed ? now : undefined,
    },
    meta: {
      ...(offer?.meta || {}),
      status: completed ? "completed" : "active",
      ts: now,
    },
  };
}
function productPath(id: any) {
  return `/producto/${encodeURIComponent(String(id || ""))}`;
}

function offerPath(id: any) {
  return `/oferta/${encodeURIComponent(String(id || ""))}`;
}

function pedidoPath(threadId: any) {
  return `/pedido/${encodeURIComponent(String(threadId || ""))}`;
}

function absolutePublicUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}
function closeMandatesForTarget(
  all: any[],
  target: { productId?: string | null; offerId?: string | null }
) {
  const now = new Date().toISOString();

  return all
    .filter((d: any) => {
      const kind = String(d?.kind || "").trim();
      if (
        kind !== "mandate" &&
        kind !== "payment.mandate" &&
        kind !== "subscription.mandate"
      ) {
        return false;
      }

      const sameProduct =
        target.productId &&
        String(d?.attrs?.productId || d?.productId || "").trim() ===
          String(target.productId).trim();

      const sameOffer =
        target.offerId &&
        String(d?.attrs?.offerId || d?.offerId || "").trim() ===
          String(target.offerId).trim();

      return !!sameProduct || !!sameOffer;
    })
    .map((m: any) => ({
      ...m,
      attrs: {
        ...(m?.attrs || {}),
        active: false,
        status: "cancelled",
        cancelledAt: now,
      },
      meta: {
        ...(m?.meta || {}),
        status: "cancelled",
        ts: now,
      },
    }));
}



function notifyNewOffer(o: any) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const ns = getOfferNs(o);
  const title = getOfferTitle(o);

  new Notification("Nueva oferta viva", {
    body: `${title} · ${o?.cantidad ?? "?"}u · ${o?.precio ?? "s/precio"} · ns: ${ns}`,
    icon: getOfferImage(o) || "/placeholder.png",
  });
}

function looksLikeDV(raw: any): boolean {
  if (!raw || typeof raw !== "object") return false;
  if ("payload" in raw) return false;
  const k = typeof raw.kind === "string" ? raw.kind.trim() : "";
  if (!k) return false;
  if (
    k === "dv.upsert" ||
    k === "dato.upsert" ||
    k === "dato.create" ||
    k === "intent"
  )
    return false;
  const hasId = raw.id != null;
  const hasAttrs = raw.attrs && typeof raw.attrs === "object";
  const hasMeta = raw.meta && typeof raw.meta === "object";
  const hasTraits = Array.isArray(raw.traits);
  return (hasId && !!k) || (!!k && (hasAttrs || hasMeta || hasTraits));
}

function deepFindDV(x: any, depth = 0): any | null {
  if (!x || typeof x !== "object") return null;
  if (depth > 4) return null;
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
  if (looksLikeDV(x)) return x;
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
    const say = normalizeSay(msg.payload.say ?? msg.payload.verb);
    if (say === "dv.upsert" || say === "dato.upsert" || say === "dato.create") {
      return deepFindDV(msg.payload) ?? null;
    }
    return deepFindDV(msg.payload) ?? null;
  }

  return deepFindDV(msg) ?? null;
}

function asDatoVivo(raw: any): DatoVivo | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind;
  if (typeof kind !== "string" || !kind.trim()) return null;

  const k = kind.trim();
  if (
    k === "observe.start" ||
    k === "observe.stop" ||
    k === "node.alive" ||
    k === "seed.roster" ||
    k === "sem.ask" ||
    k === "render" ||
    k === "hello" ||
    k === "ping" ||
    k === "micelio.health"
  )
    return null;

  if (k === "dv.upsert" || k === "dato.upsert" || k === "dato.create")
    return null;

  const traits: string[] = Array.isArray(raw.traits) ? raw.traits : [];
  const metaRaw = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const meta = { ...metaRaw };
  if (typeof (meta as any).ns === "string")
    (meta as any).ns = String((meta as any).ns).trim();

  const id =
    raw.id ?? `${k}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  return {
    id: String(id),
    kind: k,
    attrs: raw.attrs || {},
    traits,
    meta,
  };
}
function getMicelioItems(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.dv)) return json.dv;

  // Por si Micelio devuelve objeto tipo { "id1": dv, "id2": dv }
  if (json && typeof json === "object") {
    return Object.values(json).filter((x) => x && typeof x === "object");
  }

  return [];
}

function isMarketRelevantRaw(raw: any): boolean {
  if (!raw || typeof raw !== "object") return false;

  const kind = String(raw?.kind || raw?.attrs?.kind || "").toLowerCase();
  const ns = String(
    raw?.meta?.ns ||
      raw?.attrs?.meta?.ns ||
      raw?.attrs?.ns ||
      raw?.ns ||
      ""
  ).toLowerCase();

  const traits = [
    ...(Array.isArray(raw?.traits) ? raw.traits : []),
    ...(Array.isArray(raw?.attrs?.traits) ? raw.attrs.traits : []),
  ]
    .map(String)
    .map((x) => x.toLowerCase());

  if (ns === "mt:market") return true;
  if (traits.includes("mt:market")) return true;

  return (
    kind.startsWith("mt.") ||
    kind.startsWith("market.") ||
    kind.startsWith("trade.") ||
    kind.startsWith("payment.") ||
    kind === "energy.offer" ||
    kind === "mt.product" ||
    kind === "mt.offer" ||
    kind === "mt.order" ||
    kind === "mt.consult" ||
    kind === "mt.consult.answer" ||
    kind === "cajero.profile"
  );
}

// =========================================================
// MT client (seed snapshot + micelio sse)
// =========================================================
export function useMtClient() {
  const [products, setProducts] = useState<MtProduct[]>([]);
  const [offers, setOffers] = useState<MtOffer[]>([]);
  const [cajeros, setCajeros] = useState<MtCajero[]>([]);
  const [status, setStatus] = useState<"live" | "fallback" | "idle">("idle");
const snapshotLoadedRef = useRef(false);
  useEffect(() => {
   const recompute = (all: DatoVivo[]) => {
  const cleanAll = (all || []).filter((dv: any) => !isExplodedMoPackDV(dv));

  const prods = adaptDatosToMtProducts(cleanAll);
  const offs = adaptDatosToMtOffers(cleanAll);
  const cajs = adaptDatosToMtCajeros(cleanAll);

  setProducts(prods);
  setOffers(offs);
  setCajeros(cajs);

  if (prods.length || offs.length || cajs.length) setStatus("live");
};

       let recomputeTimer: number | null = null;
let latestAll: DatoVivo[] = [];

const scheduleRecompute = (all: DatoVivo[]) => {
  latestAll = Array.isArray(all) ? all : [];

  if (recomputeTimer != null) return;

  recomputeTimer = window.setTimeout(() => {
    recomputeTimer = null;
    if (!alive) return;
    recompute(latestAll);
  }, 80);
};

const unsubscribe = mtLiveSubscribe(scheduleRecompute);
    let alive = true;
    async function yieldToBrowser() {
  await new Promise<void>((resolve) => {
    const w = globalThis as any;

    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve(), { timeout: 500 });
      return;
    }

    if (typeof w.requestAnimationFrame === "function") {
      w.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(() => resolve(), 0);
  });
}

async function loadMicelioSnapshot() {
  if (snapshotLoadedRef.current) return;
  snapshotLoadedRef.current = true;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5500);

  try {
    const res = await fetch(`${MICELIO_HTTP}/dv`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Micelio HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawItems = getMicelioItems(json);

    const pending: DatoVivo[] = [];
    const seen = new Set<string>();

    for (const it of rawItems.slice(0, 3000)) {
      const raw = extractDVFromAnyFrame(it) || it;
      if (!isMarketRelevantRaw(raw)) continue;

     const dv = asDatoVivo(raw);
if (!dv) continue;

if (isExplodedMoPackDV(raw) || isExplodedMoPackDV(dv)) continue;

const key = `${dv.kind}:${dv.id}:${dv.meta?.ts || dv.attrs?.status || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      pending.push(dv);
    }

    const chunkSize = 80;

    for (let i = 0; i < pending.length; i += chunkSize) {
      const chunk = pending.slice(i, i + chunkSize);

      for (const dv of chunk) {
        mtLiveUpsert(dv);
      }

      await yieldToBrowser();
    }

    console.log("[MT web] Micelio snapshot:", {
      total: rawItems.length,
      accepted: pending.length,
    });
  } catch (err) {
    console.warn("[MT web] Snapshot Micelio omitido:", err);
  } finally {
    window.clearTimeout(timeout);
  }
}
    window.setTimeout(() => {
      if (alive) loadMicelioSnapshot();
    }, 250);


    // A) Snapshot SEED
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          kind: "dato.query",
          id: "mt:web:snapshot",
          where: {},
          limit: 1200,
          auth: "utopy-resonancia",
        }),
      );
    };

    ws.onmessage = (ev) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;
      if (msg?.ok && Array.isArray(msg.items)) {
        for (const it of msg.items) {
          const raw = extractDVFromAnyFrame(it) || it;
          const dv = asDatoVivo(raw);
          if (dv) mtLiveUpsert(dv);
        }
      }
    };

    ws.onerror = (e) => console.warn("[MT web] Seed WS error:", e);
    ws.onclose = () => console.warn("[MT web] Seed WS closed");

    // B) Live MICELIO SSE
    const es = new EventSource(`${MICELIO_HTTP}/events`);
    const onAny = (ev: MessageEvent) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;
      const raw = extractDVFromAnyFrame(msg) || msg;
      const dv = asDatoVivo(raw);
      if (!dv) return;
      mtLiveUpsert(dv);
    };

    es.addEventListener("message", onAny);
    es.addEventListener("intent", onAny);
    es.addEventListener("dv", onAny);
    es.addEventListener("dato", onAny);

    es.onerror = (err) => {
      console.error("[MT web] Micelio SSE error:", err);
      if (alive) setStatus("fallback");
    };

    return () => {
  alive = false;

  if (recomputeTimer != null) {
    window.clearTimeout(recomputeTimer);
  }

  try {
    es.close();
  } catch {}

  try {
    ws.close();
  } catch {}

  unsubscribe();
};
  }, []);

  return { products, offers, cajeros, status };
}

// =========================================================
// AR Modal
// =========================================================
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 12px;
`;

const Modal = styled.div`
  width: 100%;
  max-width: 920px;
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 12px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 950;
  ${({ kind }) =>
    kind === "solid"
      ? `background:#111;color:#fff;`
      : `background:#fff;color:#111;`}
`;

function ArModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: MtProduct | null;
  onClose: () => void;
}) {
  if (!open || !product) return null;

  const ar = product.meta?.ar as any;
  const modelUrl: string | undefined = ar?.modelUrl;
  if (!modelUrl) return null;

  const title = ar?.title || product.nombre || "AR";
  const poster = ar?.posterUrl || product.imagen || "";

  return (
    <Backdrop onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Row style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <Btn kind="ghost" onClick={onClose}>
            Cerrar
          </Btn>
        </Row>

        <div
          style={{
            width: "100%",
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.10)",
            background: "#000",
          }}
        >
          {/* @ts-ignore */}
          <model-viewer
            src={modelUrl}
            poster={poster}
            ar
            ar-modes="scene-viewer webxr quick-look"
            camera-controls
            auto-rotate
            style={{
              width: "100%",
              height: "min(62vh, 520px)",
            }}
          />
        </div>

        <Subtle style={{ marginTop: 8 }}>
          Si tu celular soporta AR, aparecerá “Ver en tu espacio”.
        </Subtle>
      </Modal>
    </Backdrop>
  );
}



const CheckoutModalBox = styled.div`
  width: 100%;
  max-width: 520px;
  z-index: 9999;
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 14px;

  @media (max-width: 420px) {
    padding: 12px;
    max-width: 96vw;
  }
`;
function PublicProductOfferModal({
  product,
  offer,
  products,
  onClose,
  onCheckoutProduct,
  onCheckoutOffer,
  onConsultOffer,
  onShare,
}: {
  product: MtProduct | null;
  offer: MtOffer | null;
  products: MtProduct[];
  onClose: () => void;
  onCheckoutProduct: (p: MtProduct) => void;
  onCheckoutOffer: (o: MtOffer) => void;
  onConsultOffer: (o: MtOffer) => void;
  onShare: () => void;
}) {
  if (!product && !offer) return null;

  const linkedProduct =
    offer && products.find((p) => String(p.id) === String(offer.productoId));

  const title = offer
    ? getOfferTitle(offer)
    : product?.nombre || "Producto";

  const img = offer
    ? getOfferImage(offer) || linkedProduct?.imagen || "/placeholder.png"
    : product?.imagen || "/placeholder.png";

  const price = offer
    ? offer.precio
    : product?.precio;

  const ns = offer
    ? getOfferNs(offer)
    : product?.meta?.ns || "mt:market";

  return (
    <Portal>
      <PickerBackdrop onClick={onClose}>
        <CheckoutModalBox
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 560,
            width: "100%",
            maxHeight: "88vh",
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: "1.1rem" }}>
                {title}
              </div>
              <Subtle>Ficha pública · {ns}</Subtle>
            </div>

            <Btn kind="ghost" onClick={onClose}>
              Cerrar
            </Btn>
          </div>

          {img ? (
            <img
              src={img}
              alt={title}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: 16,
                marginTop: 12,
                background: "#f2f2f2",
              }}
            />
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 950 }}>
              {price ? `${price}` : "Precio a consultar"}
            </div>

            {offer ? (
              <Subtle>
                Oferta: {offer.tipo?.toUpperCase?.() || "OFERTA"} ·{" "}
                {offer.cantidad ?? "—"}u
              </Subtle>
            ) : (
              <Subtle>
                Stock: {product?.stock ?? "—"} · Unidad: {product?.unidad || "u"}
              </Subtle>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 14,
            }}
          >
            <SmallBtn tone="ghost" onClick={onShare}>
              Compartir
            </SmallBtn>

            {offer ? (
              <SmallBtn tone="ghost" onClick={() => onConsultOffer(offer)}>
                Consultar
              </SmallBtn>
            ) : null}

            {offer ? (
              <SmallBtn onClick={() => onCheckoutOffer(offer)}>
                Ir al cajero
              </SmallBtn>
            ) : product ? (
              <SmallBtn onClick={() => onCheckoutProduct(product)}>
                Ir al cajero
              </SmallBtn>
            ) : null}
          </div>
        </CheckoutModalBox>
      </PickerBackdrop>
    </Portal>
  );
}
function CajeroPickerModal({
  open,
  cajeros,
  onPick,
  onClose,
}: {
  open: boolean;
  cajeros: MtCajero[];
  onPick: (c: MtCajero) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Portal>
      <PickerBackdrop onClick={onClose}>
        <CheckoutModalBox onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 950 }}>Elegir cajero</div>
            <Btn kind="ghost" onClick={onClose}>
              Cerrar
            </Btn>
          </div>

          <Subtle style={{ marginTop: 6 }}>
            Elegí quién está en turno para cobrar y confirmar entregas.
          </Subtle>

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {cajeros.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => onPick(c)}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{c.nombre}</div>
                  <Subtle>ID: {c.id.slice(-10)}</Subtle>
                </div>
                <Btn kind="solid">Elegir</Btn>
              </div>
            ))}
          </div>
        </CheckoutModalBox>
      </PickerBackdrop>
    </Portal>
  );
}

// =========================================================
// Vista principal
// =========================================================
export default function MercadoLocal() {
  const [tab, setTab] = useState<Tab>("mercado");
  const [cartOpen, setCartOpen] = useState(false);
  const [cajeroPickerOpen, setCajeroPickerOpen] = useState(false);
const [allDv, setAllDv] = useState<DatoVivo[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProd, setCheckoutProd] = useState<MtProduct | null>(null);
const [checkoutOffer, setCheckoutOffer] = useState<MtOffer | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyOffer, setReplyOffer] = useState<MtOffer | null>(null);
const [inboxThreadId, setInboxThreadId] = useState<string | null>(null);
  const [nsFilter, setNsFilter] = useState<string>("__ALL__");
  const [activeCajero, setActiveCajero] = useState<MtCajero | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyNs, setNotifyNs] = useState<string>("__ALL__");
  const seenOfferIdsRef = useRef<Set<string>>(new Set());
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [threadViewerOpen, setThreadViewerOpen] = useState(false);
  const [threadViewerMode, setThreadViewerMode] = useState<"buyer" | "cajero">("buyer");
const [threadViewerId, setThreadViewerId] = useState<string | null>(null);
  // AR
  const [publicProduct, setPublicProduct] = useState<MtProduct | null>(null);
const [publicOffer, setPublicOffer] = useState<MtOffer | null>(null);
  const [arOpen, setArOpen] = useState(false);
  const [arProduct, setArProduct] = useState<MtProduct | null>(null);
const [invoiceCenterOpen, setInvoiceCenterOpen] = useState(false);
const [lastCheckoutDocs, setLastCheckoutDocs] = useState<{
  orderId: string;
  threadId: string;
  receiptId?: string;
  invoiceId?: string;
} | null>(null);
  const { addToCart } = useCartStore();
  const { products, offers, cajeros, status } = useMtClient();
  const { emitPresence, clearSignals } = usePresenceEmitter();
  const [produceView, setProduceView] = useState<ProduceView>("trabajos");
  useTradeIntentReceiver({
  products,
  onBuyProduct: (product, intent) => {
    const pAny = product as any;
    const threadId =
      pAny?.attrs?.contact?.threadId ||
      pAny?.meta?.threadId ||
      resolveProductThreadId(product);

    setCheckoutOffer(null);
    setCheckoutProd({
      ...product,
      meta: {
        ...(product.meta || {}),
        threadId,
      },
    });
    setInboxThreadId(threadId || null);
    setCheckoutOpen(true);

    console.log("Trade intent buy recibido", intent);
  },
  onConsultProduct: (product, intent) => {
    const matchedOffer =
      offers.find((o: any) => String(o?.productoId) === String(product?.id)) || null;

    if (matchedOffer) {
      const enriched = buildEnrichedOfferForAction(matchedOffer as any, products);
      const threadId =
        (enriched as any)?.attrs?.contact?.threadId ||
        (enriched as any)?.meta?.threadId ||
        resolveOfferThreadId(enriched as any);

      setReplyOffer(enriched as any);
      setInboxThreadId(threadId || null);
      setReplyOpen(true);
    } else {
      const pAny = product as any;
      const threadId =
        pAny?.attrs?.contact?.threadId ||
        pAny?.meta?.threadId ||
        resolveProductThreadId(product);

      setCheckoutOffer(null);
      setCheckoutProd({
        ...product,
        meta: {
          ...(product.meta || {}),
          threadId,
        },
      });
      setInboxThreadId(threadId || null);
      setCheckoutOpen(true);
    }

    console.log("Trade intent consult recibido", intent);
  },
});
const navigate = useNavigate();
const location = useLocation();
const [mobileMarketMenuOpen, setMobileMarketMenuOpen] = useState(false);
const marketPressTimerRef = useRef<number | null>(null);
const marketLongPressedRef = useRef(false);
const params = useParams<{
  productId?: string;
  offerId?: string;
  threadId?: string;
}>();

const openedDeepLinkRef = useRef<string | null>(null);
const [presenceOrderDocs, setPresenceOrderDocs] = useState<{
  orderId: string;
  threadId: string;
} | null>(null);
useEffect(() => {
  const unsub = mtLiveSubscribe((all: DatoVivo[]) => {
    setAllDv(all || []);
  });
  return () => unsub();
}, []);
const openThreadGlobal = (
  threadId: string | null | undefined,
  mode: "buyer" | "cajero" = "buyer"
) => {
  const id = String(threadId || "").trim();
  if (!id) return;

  setInboxThreadId(id);
  setThreadViewerId(id);
  setThreadViewerMode(mode); // 🔥 CLAVE
  setThreadViewerOpen(true);
};
const namespaces = useMemo(() => {
  const productNs = products
    .map((p) => p.meta?.ns)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());

  const offerNs = offers
    .map((o) => getOfferNs(o))
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .filter((v) => v !== "__UNKNOWN__");

  return Array.from(new Set([...productNs, ...offerNs])).sort();
}, [products, offers]);
  const visibleProducts = useMemo(() => {
    const base =
      nsFilter === "__ALL__"
        ? products
        : products.filter((p) => p.meta?.ns === nsFilter);

    return base.filter((p: any) => {
      const stock = Number(p.stock ?? 0);
      const hidden = p?.meta?.hidden === true;
      const status = p?.meta?.status; // "out_of_stock" | "active" | etc

      // ✅ solo mostrar si está activo y con stock
      return !hidden && status !== "out_of_stock" && stock > 0;
    });
  }, [products, nsFilter]);
  const visibleOffers = useMemo(() => {
  const byId = new Map(products.map((p) => [String(p.id), p]));

  const base =
    nsFilter === "__ALL__"
      ? offers
      : offers.filter((o: any) => getOfferNs(o) === nsFilter);

  return base.filter((o: any) => {
    if (isOfferClosed(o)) return false;

    const qty = Number(o?.cantidad ?? 0);
    if (Number.isFinite(qty) && qty <= 0) return false;

    const p: any = byId.get(String(o.productoId));
    if (!p) return true;

    const stock = Number(p.stock ?? 0);
    const hidden = p?.meta?.hidden === true;
    const status = p?.meta?.status;

    if (hidden) return false;
    if (status === "out_of_stock") return false;
    if (Number.isFinite(stock) && stock <= 0) return false;

    return true;
  });
}, [offers, products, nsFilter]);

async function upsertAndPublishDV(dv: any) {
  const finalDv = {
    ...dv,
    meta: {
      ...(dv?.meta || {}),
      ns: dv?.meta?.ns || "mt:market",
      ts: dv?.meta?.ts || new Date().toISOString(),
    },
  };

  // 1. Local inmediato
  mtLiveUpsert(finalDv);

  // 2. Seed / bus
  try {
    await publishDatoVivo(finalDv);
  } catch (err) {
    console.warn("[MT] No se pudo publicar por seedbus:", err);
  }

  // 3. Micelio directo para que al recargar NO vuelva el viejo
  try {
    await fetch(`${MICELIO_HTTP}/dv`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalDv),
    });
  } catch (err) {
    console.warn("[MT] No se pudo persistir directo en Micelio:", err);
  }

  return finalDv;
}

async function publishClosedMandates(
  all: any[],
  target: { productId?: string | null; offerId?: string | null }
) {
  const mandatesToClose = closeMandatesForTarget(all, target);

  for (const m of mandatesToClose) {
    await upsertAndPublishDV(m);
  }

  return mandatesToClose;
}
const openProductionThread = (threadId: string | null | undefined) => {
  const id = String(threadId || "").trim();
  if (!id) return;

  setInboxThreadId(id);
  setProduceView("conversaciones");
  openThreadGlobal(id, "cajero");
};

function buildClosedOfferDV(offer: any) {
  const now = new Date().toISOString();

  return {
    ...offer,
    id: String(offer?.id || offer?.attrs?.id || `offer:closed:${Date.now()}`),
    kind: offer?.kind || "mt:offer",
    cantidad: 0,
    stock: 0,
    attrs: {
      ...(offer?.attrs || {}),
      id: String(offer?.id || offer?.attrs?.id || ""),
      productoId: offer?.productoId || offer?.attrs?.productoId || null,
      cantidad: 0,
      stock: 0,
      status: "completed",
      closed: true,
      completedAt: now,
      closedAt: now,
    },
    meta: {
      ...(offer?.meta || {}),
      ns: offer?.meta?.ns || "mt:market",
      status: "completed",
      hidden: true,
      ts: now,
      closedAt: now,
    },
  };
}

function buildProductStockDV(product: any, nextStock: number) {
  const now = new Date().toISOString();
  const completed = nextStock <= 0;

  const raw =
    allLive.find((d: any) => String(d?.id) === String(product?.id)) ||
    product ||
    {};

  return {
    ...raw,
    id: String(product?.id || raw?.id || `product:stock:${Date.now()}`),
    kind: raw?.kind || "producto",
    stock: nextStock,
    attrs: {
      ...(raw?.attrs || {}),
      nombre: product?.nombre || raw?.attrs?.nombre || raw?.nombre,
      unidad: product?.unidad || raw?.attrs?.unidad || raw?.unidad || "u",
      precio: product?.precio ?? raw?.attrs?.precio ?? raw?.precio,
      imagen: product?.imagen || raw?.attrs?.imagen || raw?.imagen,
      productor: product?.productor || raw?.attrs?.productor || raw?.productor,
      stock: nextStock,
      status: completed ? "out_of_stock" : "active",
      completedAt: completed ? now : raw?.attrs?.completedAt,
    },
    traits: Array.from(
      new Set([
        ...(Array.isArray(raw?.traits) ? raw.traits : []),
        "mt:producto",
        "mt:vendible",
        "mt:market",
      ])
    ),
    meta: {
      ...(raw?.meta || product?.meta || {}),
      ns: raw?.meta?.ns || product?.meta?.ns || "mt:market",
      status: completed ? "out_of_stock" : "active",
      hidden: completed ? true : raw?.meta?.hidden,
      ts: now,
    },
  };
}



  useEffect(() => {
    const currentIds = new Set<string>();

    for (const o of offers) {
      const id = String(o?.id || "");
      if (!id) continue;

      currentIds.add(id);

      const wasSeen = seenOfferIdsRef.current.has(id);
      if (wasSeen) continue;

      // primera carga: solo registrar, no notificar spam inicial
      if (seenOfferIdsRef.current.size === 0) continue;

      const ns = getOfferNs(o);
      const nsMatches = notifyNs === "__ALL__" || ns === notifyNs;

      if (notifyEnabled && nsMatches) {
        notifyNewOffer(o);
      }
    }

    seenOfferIdsRef.current = currentIds;
  }, [offers, notifyEnabled, notifyNs]);
  useEffect(() => {
    const eng = startMtEscrowEngineForMsWeb({
      ns: "mt:market",
      policy: {
        requiredOk: 2,
        requiredRoles: ["seller", "buyer", "cajero"],
        disputeIfAnyNok: true,
        dedupeTtlMs: 12 * 60 * 60 * 1000,
      },
      autoLock: true,
      autoSettle: true,
      debug: false,
    });

    return () => eng?.stop?.();
  }, []);
const abrirCheckout = (p: MtProduct) => {
  const pAny = p as any;
  const threadId =
    pAny?.attrs?.contact?.threadId ||
    pAny?.meta?.threadId ||
    resolveProductThreadId(p);

  const nextProduct: MtProduct = {
    ...p,
    meta: {
      ...(p.meta || {}),
      threadId,
      author: pAny?.attrs?.author || pAny?.meta?.author,
      contact: pAny?.attrs?.contact || pAny?.meta?.contact,
      caja: activeCajero
  ? {
      id: activeCajero.id,
      nombre: activeCajero.nombre,
    }
  : pAny?.meta?.caja,

cajeroId: activeCajero?.id || pAny?.meta?.cajeroId || null,

pay: {
  ...(pAny?.meta?.pay || {}),
  recommendedCajeroId:
    activeCajero?.id || pAny?.meta?.pay?.recommendedCajeroId || null,
},
      vendor: pAny?.attrs?.vendor || pAny?.meta?.vendor,
      source: pAny?.attrs?.source || pAny?.meta?.source,
    },
  };

  setCheckoutOffer(null);
  setCheckoutProd(nextProduct);
  setInboxThreadId(threadId);
  setCheckoutOpen(true);
};

const abrirCheckoutDesdeOferta = (o: MtOffer) => {
  setCheckoutOffer(o);

  const linked = products.find((p) => String(p.id) === String(o.productoId));
  const offerAny = o as any;
  const linkedAny = linked as any;

  const threadId =
    offerAny?.attrs?.contact?.threadId ||
    offerAny?.contact?.threadId ||
    offerAny?.meta?.threadId ||
    resolveOfferThreadId(o);

  const offerImage =
    o?.imagen ||
    offerAny?.imageUrl ||
    offerAny?.imageDataUrl ||
    o?.meta?.media?.image?.url ||
    o?.meta?.media?.image?.dataUrl ||
    offerAny?.media?.image?.url ||
    offerAny?.media?.image?.dataUrl ||
    offerAny?.attrs?.imagen ||
    offerAny?.attrs?.image ||
    offerAny?.attrs?.media?.image?.url ||
    offerAny?.attrs?.media?.image?.dataUrl ||
    "";

  const offerGallery = Array.isArray(o?.meta?.media?.gallery)
    ? o.meta.media.gallery
    : Array.isArray(offerAny?.attrs?.media?.gallery)
    ? offerAny.attrs.media.gallery
    : Array.isArray(offerAny?.media?.gallery)
    ? offerAny.media.gallery
    : [];

  const mergedMedia =
    offerImage || offerGallery.length
      ? {
          image: offerImage
            ? {
                url: offerImage,
                dataUrl: offerImage.startsWith("data:image/")
                  ? offerImage
                  : undefined,
              }
            : undefined,
          gallery: offerGallery,
        }
      : linked?.meta?.media || linkedAny?.attrs?.media || undefined;

  const p: MtProduct = {
    ...(linked || ({} as MtProduct)),
    id: String(linked?.id || o.productoId || `offer:${o.id}`),

    nombre:
      linked?.nombre ||
      o?.meta?.name ||
      offerAny?.attrs?.nombre ||
      offerAny?.title ||
      `Producto ${String(o.productoId || "").slice(-4)}`,

    imagen:
      offerImage ||
      linked?.imagen ||
      linked?.meta?.media?.image?.url ||
      linkedAny?.attrs?.media?.image?.url ||
      "",

    precio:
      typeof linked?.precio === "number" && linked.precio > 0
        ? linked.precio
        : o.precio,

    unidad: linked?.unidad || "u",

    stock:
      typeof linked?.stock === "number"
        ? linked.stock
        : o.cantidad,

    productor: linked?.productor || o.productor,

    meta: {
      ...(linked?.meta || {}),
      fromOffer: o.id,
      fromOfferId: o.id,
      caja: activeCajero
  ? {
      id: activeCajero.id,
      nombre: activeCajero.nombre,
    }
  : linked?.meta?.caja,

cajeroId: activeCajero?.id || linked?.meta?.cajeroId || null,

pay: {
  ...((linked?.meta as any)?.pay || {}),
  ...((o?.meta as any)?.pay || {}),
  recommendedCajeroId:
    activeCajero?.id ||
    (o?.meta as any)?.pay?.recommendedCajeroId ||
    (linked?.meta as any)?.pay?.recommendedCajeroId ||
    null,
},
      ns: o?.meta?.ns || linked?.meta?.ns,
      media: mergedMedia,
      threadId,

      // identidad viva desde MO
      author:
        offerAny?.author ||
        offerAny?.attrs?.author ||
        linkedAny?.attrs?.author ||
        linked?.meta?.author,

      contact:
        offerAny?.contact ||
        offerAny?.attrs?.contact ||
        linkedAny?.attrs?.contact ||
        linked?.meta?.contact || {
          threadId,
        },

      vendor:
        offerAny?.vendor ||
        offerAny?.attrs?.vendor ||
        linkedAny?.attrs?.vendor ||
        linked?.meta?.vendor,

      source:
        offerAny?.source ||
        offerAny?.attrs?.source ||
        linkedAny?.attrs?.source ||
        linked?.meta?.source,

      offerSnapshot: {
        id: o.id,
        tipo: o.tipo,
        cantidad: o.cantidad,
        precio: o.precio,
      },
    },
  };

  setCheckoutProd(p);
  setInboxThreadId(threadId);
  setCheckoutOpen(true);
};


const ensureOrderVisibleForCajero = async (payload: any) => {
  const orderId = String(payload?.orderId || "").trim();
  const threadId = String(payload?.threadId || "").trim();

  if (!orderId || !threadId) return;

  const buyerId =
    String(payload?.buyerId || localBuyerActor?.id || "buyer:local").trim();

  const cajeroId = String(activeCajero?.id || "").trim();
  const cajeroName = String(activeCajero?.nombre || "").trim();

  const productId =
    String(
      payload?.productId ||
        payload?.productoId ||
        checkoutProd?.id ||
        checkoutOffer?.productoId ||
        ""
    ).trim();

  const offerId =
    String(
      payload?.offerId ||
        checkoutOffer?.id ||
        checkoutProd?.meta?.fromOfferId ||
        checkoutProd?.meta?.fromOffer ||
        ""
    ).trim();

  const participants = Array.from(
    new Set([buyerId, cajeroId].filter(Boolean))
  );

  const routedOrder = {
    id: orderId,
    kind: "mt.order",
    attrs: {
      orderId,
      threadId,
      productId: productId || null,
      productoId: productId || null,
      offerId: offerId || null,

      buyerId,
      cajeroId: cajeroId || null,
      sellerId: cajeroId || null,
      sellerName: cajeroName || null,

      participants,
      unreadBy: cajeroId ? [cajeroId] : [],

      status: "open",
      paymentStatus: "pending",
      title:
        checkoutProd?.nombre ||
        checkoutProd?.meta?.name ||
        checkoutOffer?.meta?.name ||
        "Pedido Market",
      qty:
        payload?.qty ||
        payload?.quantity ||
        payload?.cantidad ||
        checkoutOffer?.cantidad ||
        1,
      total:
        payload?.total ||
        payload?.amount ||
        checkoutProd?.precio ||
        checkoutOffer?.precio ||
        null,
      currency: payload?.currency || "PYG",
    },
    traits: ["mt:order", "mt:market", "mt:cajero.inbox"],
    meta: {
      ns: "mt:market",
      ts: new Date().toISOString(),
      source: "ms.web.checkout.route",
      status: "open",
      cajeroId: cajeroId || null,
    },
  };

  mtLiveUpsert(routedOrder as any);

  try {
    await publishDatoVivo(routedOrder as any);
  } catch (err) {
    console.warn("[MT] No se pudo publicar ruta de pedido a cajero:", err);
  }
};
const stockClosedByOrderRef = useRef<Set<string>>(new Set());

function isPaidOrConfirmedDV(d: any) {
  const k = String(d?.kind || "").trim();
  const status = String(
    d?.attrs?.status ||
      d?.attrs?.paymentStatus ||
      d?.meta?.status ||
      ""
  ).toLowerCase();

  if (k === "payment.accept" && d?.attrs?.ok !== false) return true;
  if (k === "market.order.event" && d?.attrs?.ok === true) return true;
  if (k === "payment.session.status" && status === "paid") return true;
  if (k === "sale.receipt") return true;

  return (
    status === "paid" ||
    status === "confirmed" ||
    status === "settled" ||
    status === "delivered"
  );
}

function getOrderKeyFromDV(d: any) {
  return String(
    d?.attrs?.orderId ||
      d?.orderId ||
      d?.attrs?.threadId ||
      d?.threadId ||
      ""
  ).trim();
}

function findOrderContextForPaidDV(d: any) {
  const orderId = String(d?.attrs?.orderId || d?.orderId || "").trim();
  const threadId = String(d?.attrs?.threadId || d?.threadId || "").trim();

  const found = allLive.find((x: any) => {
    const xOrderId = String(x?.attrs?.orderId || x?.id || "").trim();
    const xThreadId = String(x?.attrs?.threadId || "").trim();

    return (
      (orderId && xOrderId === orderId) ||
      (threadId && xThreadId === threadId)
    );
  });

  const attrs = {
    ...(found?.attrs || {}),
    ...(d?.attrs || {}),
  };

  return {
    raw: found || d,
    orderId: orderId || attrs.orderId || found?.id || "",
    threadId: threadId || attrs.threadId || "",
    productId:
      attrs.productId ||
      attrs.productoId ||
      attrs.targetId ||
      attrs.itemId ||
      "",
    offerId: attrs.offerId || attrs.fromOfferId || attrs.fromOffer || "",
    qty: Number(attrs.qty || attrs.quantity || attrs.cantidad || 1),
  };
}

async function publishStockMutation(dv: any) {
  mtLiveUpsert(dv);

  try {
    await publishDatoVivo(dv);
  } catch (err) {
    console.warn("[MT] No se pudo publicar mutación de stock:", err);
  }
}

function buildOfferClosedMutation(offer: any) {
  const now = new Date().toISOString();

  const raw =
    allLive.find((d: any) => String(d?.id) === String(offer?.id)) ||
    allLive.find(
      (d: any) => String(d?.attrs?.id || "") === String(offer?.id)
    ) ||
    {};

  return {
    ...raw,
    id: String(offer?.id || raw?.id),
    kind: raw?.kind || "mt:offer",
    cantidad: 0,
    attrs: {
      ...(raw?.attrs || {}),
      id: String(offer?.id || raw?.id),
      productoId: offer?.productoId || offer?.attrs?.productoId || null,
      cantidad: 0,
      status: "completed",
      closed: true,
      completedAt: now,
    },
    traits: Array.from(
      new Set([
        ...(Array.isArray(raw?.traits) ? raw.traits : []),
        "mt:offer",
        "mt:market",
      ])
    ),
    meta: {
      ...(raw?.meta || offer?.meta || {}),
      ns: raw?.meta?.ns || offer?.meta?.ns || "mt:market",
      status: "completed",
      hidden: true,
      ts: now,
    },
  };
}

const sharePublicLink = async (path: string, title?: string) => {
  const url = absolutePublicUrl(path);

  try {
    if (navigator.share) {
      await navigator.share({
        title: title || "Market UTOPY",
        text: title || "Mirá esto en Market UTOPY",
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("Link copiado al portapapeles");
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado al portapapeles");
    } catch {
      window.prompt("Copiá este link:", url);
    }
  }
};
useEffect(() => {
  const productId = params.productId
    ? decodeURIComponent(params.productId)
    : null;

  const offerId = params.offerId
    ? decodeURIComponent(params.offerId)
    : null;

  const threadId = params.threadId
    ? decodeURIComponent(params.threadId)
    : null;

  const key = `${location.pathname}:${products.length}:${offers.length}`;

  if (openedDeepLinkRef.current === key) return;

  if (productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) return;

    openedDeepLinkRef.current = key;
    setTab("mercado");

    // ✅ NO abre checkout automáticamente
    setPublicProduct(product);
    setPublicOffer(null);
    return;
  }

  if (offerId) {
    const offer = offers.find((o: any) => String(o.id) === String(offerId));
    if (!offer) return;

    openedDeepLinkRef.current = key;
    setTab("ofertas");

    // ✅ NO abre checkout automáticamente
    setPublicOffer(offer);
    setPublicProduct(null);
    return;
  }

  if (threadId) {
    openedDeepLinkRef.current = key;
    setTab("mis_pedidos");
    openThreadGlobal(threadId, "buyer");
  }
}, [
  params.productId,
  params.offerId,
  params.threadId,
  location.pathname,
  products,
  offers,
]);
  const abrirAr = (p: MtProduct) => {
    setArProduct(p);
    setArOpen(true);
  };
  const [allLive, setAllLive] = useState<any[]>([]);
  const allLiveClean = useMemo(
  () => (allLive || []).filter((dv: any) => !isExplodedMoPackDV(dv)),
  [allLive]
);

const allDvClean = useMemo(
  () => (allDv || []).filter((dv: any) => !isExplodedMoPackDV(dv)),
  [allDv]
);

useEffect(() => {
  return mtLiveSubscribe((items) => setAllLive(items || []));
}, []);
const enrichedReplyOffer = useMemo(() => {
  if (!replyOffer) return null;
  return buildEnrichedOfferForAction(replyOffer, products);
}, [replyOffer, products]);

const localBuyerActor = useMemo(() => {
  try {
    const raw = localStorage.getItem("mt.actor");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed;
    }
  } catch {}
  return { id: "buyer:local", name: "Comprador local", role: "buyer" };
}, []);

const tradeMessages = useMemo(() => {
  return allLive.filter((d: any) => {
    const k = safeStr(d?.kind);
    return (
      k === "trade.message" ||
      k === "trade.intent.accept" ||
      k === "trade.intent.counter" ||
      k === "trade.intent.barter" ||
      k === "trade.intent.fulfill" ||
      k === "trade.intent.message" ||
      k === "market.order.message" ||
      k === "market.order.event"
    );
  });
}, [allLive]);

const offersUnreadCount = useMemo(() => {
  return visibleOffers.length;
}, [visibleOffers]);

const buyerUnreadCount = useMemo(() => {
  const actorId = String(localBuyerActor?.id || "");
  if (!actorId) return 0;
  return tradeMessages.filter((d: any) => {
    const unreadBy = Array.isArray(d?.attrs?.unreadBy)
      ? d.attrs.unreadBy.map(String)
      : [];
    return unreadBy.includes(actorId);
  }).length;
}, [tradeMessages, localBuyerActor]);

const cajeroUnreadCount = useMemo(() => {
  const actorId = String(activeCajero?.id || "");
  if (!actorId) return 0;
  return tradeMessages.filter((d: any) => {
    const unreadBy = Array.isArray(d?.attrs?.unreadBy)
      ? d.attrs.unreadBy.map(String)
      : [];
    return unreadBy.includes(actorId);
  }).length;
}, [tradeMessages, activeCajero]);
const currentPresenceTarget = useMemo(() => {
  if (tab === "mercado" && visibleProducts[0]) {
    const p = visibleProducts[0];
    return {
      ns: p?.meta?.ns ?? "mt:market",
      targetKind: "product",
      targetId: String(p?.id || ""),
      threadId: resolveProductThreadId?.(p) || null,
      title: String(p?.nombre || p?.nombre || p?.id || "Producto"),
      entryMethod: String(
        p?.meta?.checkout?.entry ||
          p?.meta?.entryMethod ||
          p?.meta?.entryMethod ||
          "manual"
      ),
    };
  }

  if (tab === "ofertas" && visibleOffers[0]) {
    const o = visibleOffers[0] as any;
    return {
      ns: o?.meta?.ns ?? "mt:market",
      targetKind: "offer",
      targetId: String(o?.id || ""),
      threadId: resolveOfferThreadId?.(o) || null,
      title: String(o?.title || o?.attrs?.title || o?.id || "Oferta"),
      entryMethod: String(
        o?.meta?.checkout?.entry ||
          o?.meta?.entryMethod ||
          o?.attrs?.entryMethod ||
          "manual"
      ),
    };
  }
  

  if (tab === "mis_pedidos" && inboxThreadId) {
    const orderIdGuess = String(inboxThreadId).replace("order:thread:", "");
    return {
      ns: "mt:market",
      targetKind: "order",
      targetId: orderIdGuess,
      threadId: inboxThreadId,
      title: `Pedido ${orderIdGuess.slice(-6)}`,
      entryMethod: "manual",
    };
  }

  return {
    ns: nsFilter !== "__ALL__" ? nsFilter : "mt:market",
    targetKind: null,
    targetId: null,
    threadId: null,
    title: null,
    entryMethod: "manual",
  };
}, [tab, visibleProducts, visibleOffers, inboxThreadId, nsFilter]);

const { presences: marketPresences, nearby: marketNearby, byEntryMethod: marketByEntry } =
  usePresenceScanner({
    enabled: true,
    ns: currentPresenceTarget.ns,
    targetKind: currentPresenceTarget.targetKind || undefined,
    targetId: currentPresenceTarget.targetId || undefined,
    threadId: currentPresenceTarget.threadId || undefined,
    actorId: String(localBuyerActor?.id || activeCajero?.id || ""),
    maxAgeMs: 1000 * 60 * 2,
    limit: 12,
  });
  const radarPresences = useMemo(() => {
  return (marketNearby || []).map((p: any) => ({
    actorId: p?.actorId,
    strength: p?.strength || p?.meta?.strength || 0.7,
  }));
}, [marketNearby]);

  const productHeatMap = useMemo(() => {
  const map: Record<string, number> = {};

  for (const p of visibleProducts || []) {
    const pid = String(p?.id || "");
    if (!pid) continue;

    const score = (marketPresences || []).reduce((acc: number, pr: any) => {
      const targetId =
        String(
          pr?.targetId ||
          pr?.productId ||
          pr?.meta?.targetId ||
          ""
        );

      if (targetId !== pid) return acc;

      const actorWeight =
        String(pr?.actorId || "") === String(localBuyerActor?.id || "")
          ? 0
          : Math.max(0.35, Number(pr?.strength ?? pr?.meta?.strength ?? 1));

      return acc + actorWeight;
    }, 0);

    map[pid] = score;
  }

  return map;
}, [visibleProducts, marketPresences, localBuyerActor]);
const marketPresenceItems = useMemo(() => {
  return (marketPresences || []).map((p: any) => ({
    actorId: p?.actorId,
    productId: p?.targetId || p?.productId || p?.meta?.targetId || null,
    threadId: p?.threadId || p?.meta?.threadId || null,
    strength: p?.strength || p?.meta?.strength || 0.7,
  }));
}, [marketPresences]);
const stockClosedByEventRef = useRef<Set<string>>(new Set());

function isRealCloseEvent(d: any) {
  const kind = String(d?.kind || "").trim();

  const status = String(
    d?.attrs?.status ||
      d?.attrs?.paymentStatus ||
      d?.meta?.status ||
      ""
  ).toLowerCase();

  const action = String(d?.attrs?.action || "").toLowerCase();
  const eventType = String(d?.attrs?.eventType || "").toLowerCase();

  if (kind === "market.order.event" && d?.attrs?.ok === true) return true;
  if (kind === "payment.accept" && d?.attrs?.ok !== false) return true;
  if (kind === "payment.session.status" && status === "paid") return true;
  if (kind === "sale.receipt") return true;

  if (action === "confirm.close.sale") return true;
  if (eventType === "sale.confirmed") return true;

  return (
    status === "paid" ||
    status === "confirmed" ||
    status === "settled" ||
    status === "delivered"
  );
}

function findContextFromThread(threadId: string) {
  const items = allLive.filter(
    (x: any) => String(x?.attrs?.threadId || x?.meta?.threadId || "") === threadId
  );

  const newestFirst = [...items].sort((a, b) => parseTs(b) - parseTs(a));

  for (const x of newestFirst) {
    const attrs = x?.attrs || {};

    const offerId =
      attrs.offerId ||
      attrs.fromOfferId ||
      attrs.fromOffer ||
      x?.meta?.fromOfferId ||
      "";

    const productId =
      attrs.productId ||
      attrs.productoId ||
      attrs.targetId ||
      attrs.itemId ||
      x?.meta?.productId ||
      "";

    const qty =
      attrs.qty ||
      attrs.quantity ||
      attrs.cantidad ||
      x?.qty ||
      x?.cantidad ||
      1;

    if (offerId || productId) {
      return {
        offerId: String(offerId || ""),
        productId: String(productId || ""),
        qty: Math.max(1, Number(qty || 1)),
      };
    }
  }

  return {
    offerId: "",
    productId: "",
    qty: 1,
  };
}

function getCloseContextFromEvent(ev: any) {
  const attrs = ev?.attrs || {};

  const threadId = String(attrs.threadId || ev?.threadId || "").trim();

  const directOfferId = String(
    attrs.offerId ||
      attrs.fromOfferId ||
      attrs.fromOffer ||
      ev?.offerId ||
      ""
  ).trim();

  const directProductId = String(
    attrs.productId ||
      attrs.productoId ||
      attrs.targetId ||
      attrs.itemId ||
      ev?.productId ||
      ev?.productoId ||
      ""
  ).trim();

  const directQty = Math.max(
    1,
    Number(attrs.qty || attrs.quantity || attrs.cantidad || ev?.qty || 1)
  );

  const fromThread = threadId ? findContextFromThread(threadId) : null;

  return {
    threadId,
    offerId: directOfferId || fromThread?.offerId || "",
    productId: directProductId || fromThread?.productId || "",
    qty: directQty || fromThread?.qty || 1,
  };
}

function buildClosedOfferMutation(offer: any) {
  const now = new Date().toISOString();

  const raw =
    allLive.find((d: any) => String(d?.id) === String(offer?.id)) ||
    allLive.find((d: any) => String(d?.attrs?.id || "") === String(offer?.id)) ||
    offer ||
    {};

  const id = String(offer?.id || raw?.id || raw?.attrs?.id || "");

  return {
    ...raw,
    id,
    kind: raw?.kind || "mt:offer",
    cantidad: 0,
    stock: 0,
    attrs: {
      ...(raw?.attrs || {}),
      id,
      productoId: offer?.productoId || raw?.attrs?.productoId || null,
      cantidad: 0,
      stock: 0,
      status: "completed",
      closed: true,
      completedAt: now,
      closedAt: now,
    },
    traits: Array.from(
      new Set([
        ...(Array.isArray(raw?.traits) ? raw.traits : []),
        "mt:offer",
        "mt:market",
      ])
    ),
    meta: {
      ...(raw?.meta || offer?.meta || {}),
      ns: raw?.meta?.ns || offer?.meta?.ns || "mt:market",
      status: "completed",
      hidden: true,
      ts: now,
      closedAt: now,
    },
  };
}

function buildProductStockMutation(product: any, nextStock: number) {
  const now = new Date().toISOString();
  const completed = nextStock <= 0;

  const raw =
    allLive.find((d: any) => String(d?.id) === String(product?.id)) ||
    allLive.find((d: any) => String(d?.attrs?.id || "") === String(product?.id)) ||
    product ||
    {};

  const id = String(product?.id || raw?.id || raw?.attrs?.id || "");

  return {
    ...raw,
    id,
    kind: raw?.kind || "producto",
    stock: nextStock,
    attrs: {
      ...(raw?.attrs || {}),
      id,
      nombre: product?.nombre || raw?.attrs?.nombre || raw?.nombre,
      unidad: product?.unidad || raw?.attrs?.unidad || raw?.unidad || "u",
      precio: product?.precio ?? raw?.attrs?.precio ?? raw?.precio,
      imagen: product?.imagen || raw?.attrs?.imagen || raw?.imagen,
      productor: product?.productor || raw?.attrs?.productor || raw?.productor,
      stock: nextStock,
      status: completed ? "out_of_stock" : "active",
      completedAt: completed ? now : raw?.attrs?.completedAt,
      stockUpdatedAt: now,
    },
    traits: Array.from(
      new Set([
        ...(Array.isArray(raw?.traits) ? raw.traits : []),
        "mt:producto",
        "mt:vendible",
        "mt:market",
      ])
    ),
    meta: {
      ...(raw?.meta || product?.meta || {}),
      ns: raw?.meta?.ns || product?.meta?.ns || "mt:market",
      status: completed ? "out_of_stock" : "active",
      hidden: completed ? true : raw?.meta?.hidden,
      ts: now,
    },
  };
}

useEffect(() => {
  async function closeConfirmedSales() {
    const closeEvents = allLive.filter(isRealCloseEvent);

    for (const ev of closeEvents) {
      const ctx = getCloseContextFromEvent(ev);

      const key = String(
        ev?.id ||
          ctx.threadId ||
          ctx.offerId ||
          ctx.productId ||
          `${ev?.kind}:${ev?.meta?.ts}`
      );

      if (!key) continue;
      if (stockClosedByEventRef.current.has(key)) continue;

      let touched = false;

      if (ctx.offerId) {
        const offer =
          offers.find((o: any) => String(o?.id) === String(ctx.offerId)) ||
          allLive.find((x: any) => String(x?.id) === String(ctx.offerId)) ||
          allLive.find(
            (x: any) => String(x?.attrs?.id || "") === String(ctx.offerId)
          );

        if (offer) {
          await upsertAndPublishDV(buildClosedOfferMutation(offer));
          touched = true;
        }
      }

      const productIdFromOffer =
        ctx.offerId
          ? String(
              offers.find((o: any) => String(o?.id) === String(ctx.offerId))
                ?.productoId || ""
            )
          : "";

      const productId = ctx.productId || productIdFromOffer;

      if (productId) {
        const product =
          products.find((p: any) => String(p?.id) === String(productId)) ||
          allLive.find((x: any) => String(x?.id) === String(productId)) ||
          allLive.find(
            (x: any) => String(x?.attrs?.id || "") === String(productId)
          );

        if (product) {
          const currentStock = Math.max(
            0,
            Number(
              product?.stock ??
                product?.attrs?.stock ??
                product?.meta?.stock ??
                0
            )
          );

          const nextStock = Math.max(0, currentStock - Math.max(1, ctx.qty || 1));

          await upsertAndPublishDV(buildProductStockMutation(product, nextStock));
          touched = true;
        }
      }

      if (touched) {
        stockClosedByEventRef.current.add(key);
        console.log("[MT] Venta confirmada: stock/oferta cerrado", ctx);
      } else {
        console.warn("[MT] Evento confirmado sin producto/oferta encontrado", {
          ev,
          ctx,
        });
      }
    }
  }

  closeConfirmedSales();
}, [allLive, offers, products]);
useEffect(() => {
  clearSignals();

  const send = () => {
    if (tab === "mercado" && visibleProducts[0]) {
      emitPresence(productToPresence(visibleProducts[0]));
      return;
    }

    if (tab === "ofertas" && visibleOffers[0]) {
      emitPresence(offerToPresence(visibleOffers[0]));
      return;
    }

    if (tab === "mis_pedidos" && inboxThreadId) {
      const orderIdGuess = String(inboxThreadId).replace("order:thread:", "");
      emitPresence(
        orderToPresence({
          orderId: orderIdGuess,
          threadId: inboxThreadId,
          title: `Pedido ${orderIdGuess.slice(-6)}`,
        })
      );
    }
  };

  send();
  const timer = window.setInterval(send, 15000);

  return () => {
    window.clearInterval(timer);
    clearSignals();
  };
}, [tab, visibleProducts, visibleOffers, inboxThreadId, emitPresence, clearSignals]);
useEffect(() => {
  async function closeStockFromPaidOrders() {
    const paidEvents = allLive.filter(isPaidOrConfirmedDV);

    for (const ev of paidEvents) {
      const key = getOrderKeyFromDV(ev);
      if (!key) continue;
      if (stockClosedByOrderRef.current.has(key)) continue;

      const ctx = findOrderContextForPaidDV(ev);
      const qty = Number.isFinite(ctx.qty) && ctx.qty > 0 ? ctx.qty : 1;

      let touched = false;

      if (ctx.offerId) {
        const offer = offers.find(
          (o: any) => String(o?.id) === String(ctx.offerId)
        );

        if (offer) {
          const closedOffer = buildOfferClosedMutation(offer);
          await publishStockMutation(closedOffer);
          touched = true;
        }
      }

      if (ctx.productId) {
        const product = products.find(
          (p: any) => String(p?.id) === String(ctx.productId)
        );

        if (product) {
          const currentStock = Math.max(0, Number(product?.stock ?? 0));
          const nextStock = Math.max(0, currentStock - qty);

          const updatedProduct = buildProductStockMutation(product, nextStock);
          await publishStockMutation(updatedProduct);
          touched = true;
        }
      }

      if (touched) {
        stockClosedByOrderRef.current.add(key);
      }
    }
  }

  closeStockFromPaidOrders();
}, [allLive, offers, products]);
useEffect(() => {
  if (!activeCajero?.id) return;

  const bot = startPaymentBotRuntime({
  sellerId: activeCajero.id,
  sellerName: activeCajero.nombre,
  ns: activeCajero.meta?.ns || "mt:market",
  cajeros: [
    {
      id: activeCajero.id,
      nombre: activeCajero.nombre,
      online:
        (activeCajero as any)?.presence?.online !== false,
      guard: true,
      negotiator: !!(activeCajero as any)?.payment?.negotiator,
      creditEnabled: !!(activeCajero as any)?.payment?.creditEnabled,
      trustScore: 0.8,
    },
  ],
}); 

  return () => {
    try {
      bot.stop();
    } catch {}
  };
}, [activeCajero?.id, activeCajero?.nombre, activeCajero?.meta?.ns]);
const clearMarketPressTimer = () => {
  if (marketPressTimerRef.current != null) {
    window.clearTimeout(marketPressTimerRef.current);
    marketPressTimerRef.current = null;
  }
};

const startMarketLongPress = () => {
  clearMarketPressTimer();
  marketLongPressedRef.current = false;

  marketPressTimerRef.current = window.setTimeout(() => {
    marketLongPressedRef.current = true;
    setMobileMarketMenuOpen(true);

    try {
      navigator.vibrate?.(18);
    } catch {}
  }, 420);
};

const endMarketLongPress = () => {
  clearMarketPressTimer();
};

const handleMarketMobileClick = () => {
  if (marketLongPressedRef.current) {
    window.setTimeout(() => {
      marketLongPressedRef.current = false;
    }, 0);
    return;
  }

  setMobileMarketMenuOpen(false);
  setTab("mercado");
};
useEffect(() => {
  if (tab !== "mercado") {
    setMobileMarketMenuOpen(false);
  }
}, [tab]);
  return (
    <Page>
      {/* ✅ Header compacto */}
      <TopBar>
        <TopInner>
         <Brand>
  <BrandTitle>Market</BrandTitle>
  <BrandSub>
    <StatusDot s={status} />
    <span>
      {activeCajero
        ? `Cajero: ${activeCajero.nombre}`
        : "Caja: sin turno"}
    </span>
  </BrandSub>

  <PresenceMiniBar>
  {marketNearby.length > 0 ? (
    <PresenceMiniChip tone="ok">
      👀 {marketNearby.length} cerca
    </PresenceMiniChip>
  ) : null}

  {marketByEntry.qr.length > 0 ? (
    <PresenceMiniChip tone="info">
      QR {marketByEntry.qr.length}
    </PresenceMiniChip>
  ) : null}

  {marketByEntry.nfc.length > 0 ? (
    <PresenceMiniChip tone="info">
      NFC {marketByEntry.nfc.length}
    </PresenceMiniChip>
  ) : null}

  {currentPresenceTarget.threadId ? (
    <PresenceMiniChip tone="warn">
      hilo activo
    </PresenceMiniChip>
  ) : null}
</PresenceMiniBar>
</Brand>

          <RightTools>
  <MiniSelect
    value={nsFilter}
    onChange={(e) => setNsFilter(e.target.value)}
  >
    <option value="__ALL__">Todos</option>
    {namespaces.map((ns) => (
      <option key={ns} value={ns}>
        {ns}
      </option>
    ))}
  </MiniSelect>

 <IconGhostBtn
  active={notifyEnabled}
  onClick={() => setNotifModalOpen(true)}
  title="Configurar notificaciones"
  aria-label="Configurar notificaciones"
>
  {notifyEnabled ? <Bell /> : <BellOff />}
</IconGhostBtn>

  <PillBtn onClick={() => setCartOpen(true)}>
    🛒 
  </PillBtn>
</RightTools>
        </TopInner>
<DesktopTabsRow>
  <DesktopTabBtn active={tab === "mercado"} onClick={() => setTab("mercado")}>
    <TabWrap>Mercado</TabWrap>
  </DesktopTabBtn>
  <DesktopTabBtn
  active={tab === "circular"}
  onClick={() => setTab("circular")}
>
  <TabWrap>Circular</TabWrap>
</DesktopTabBtn>

  <DesktopTabBtn
    active={tab === "categorias"}
    onClick={() => setTab("categorias")}
  >
    <TabWrap>Categorías</TabWrap>
  </DesktopTabBtn>

  <DesktopTabBtn active={tab === "ofertas"} onClick={() => setTab("ofertas")}>
    <TabWrap>
      Ofertas
      {offersUnreadCount > 0 ? <BadgeRed>{offersUnreadCount}</BadgeRed> : null}
    </TabWrap>
  </DesktopTabBtn>

  <DesktopTabBtn
    active={tab === "producir"}
    onClick={() => setTab("producir")}
  >
    <TabWrap>
      Producir
      {cajeroUnreadCount > 0 ? <BadgeRed>{cajeroUnreadCount}</BadgeRed> : null}
    </TabWrap>
  </DesktopTabBtn>

  <DesktopTabBtn
    active={tab === "mis_pedidos"}
    onClick={() => setTab("mis_pedidos")}
  >
    <TabWrap>
      Mis pedidos
      {buyerUnreadCount > 0 ? <BadgeRed>{buyerUnreadCount}</BadgeRed> : null}
    </TabWrap>
  </DesktopTabBtn>
</DesktopTabsRow>
      </TopBar>
      <PresenceGlobalBlock>
  <PresenceRadar
    meId={localBuyerActor?.id}
    presences={radarPresences}
    minCount={2}
  />
</PresenceGlobalBlock>
{tab === "mercado" && visibleProducts[0] ? (
  <Section style={{ marginTop: 12 }}>
    <PresenceNowChip
      presences={marketPresenceItems}
      selfActorId={localBuyerActor?.id}
      productId={String(visibleProducts[0]?.id || "")}
      threadId={resolveProductThreadId?.(visibleProducts[0]) || ""}
      minCount={1}
    />
  </Section>
) : null}
      <MtPresenceOverlay
  isMobile={typeof window !== "undefined" ? window.innerWidth <= 900 : false}
  onOpenProduct={(productId) => {
    const p = products.find((x) => String(x.id) === String(productId));
    if (p) abrirCheckout(p);
  }}
  onOpenOffer={(offerId) => {
    const o = offers.find((x) => String((x as any).id) === String(offerId));
    if (o) abrirCheckoutDesdeOferta(o);
  }}
  onOpenCheckout={(payload) => {
    if (payload?.offerId) {
      const o = offers.find((x) => String((x as any).id) === String(payload.offerId));
      if (o) abrirCheckoutDesdeOferta(o);
      return;
    }

    if (payload?.productId) {
      const p = products.find((x) => String(x.id) === String(payload.productId));
      if (p) abrirCheckout(p);
    }
  }}
  onOpenThread={(threadId) => {
    openThreadGlobal(threadId);
    setTab("mis_pedidos");
  }}
  onOpenInvoice={(payload) => {
    setPresenceOrderDocs({
      orderId: String(payload?.orderId || ""),
      threadId: String(payload?.threadId || ""),
    });
    setInvoiceCenterOpen(true);
  }}
  onOpenMarket={() => {
    setTab("mercado");
  }}
/>

      <Content>
        {tab === "mercado" && (
          <Section>
            {nsFilter !== "__ALL__" && (
              <Subtle style={{ marginBottom: 10 }}>
                Filtrando por <b>{nsFilter}</b>
              </Subtle>
            )}

            <Grid>
              {visibleProducts.map((p) => (
                <Card key={p.id}>
                  <Img src={p.imagen || "/placeholder.png"} alt={p.nombre} />
                  <Title>{p.nombre}</Title>

                  <Subtle style={{ marginTop: 6 }}>
                    {p.unidad || "u"} · Stock: {p.stock ?? "—"}
                  </Subtle>

                  {typeof p.precio === "number" && <Price>{p.precio}</Price>}
                  <Subtle style={{ marginTop: 4 }}>
                    Pago: Cajero (recomendado) · BNB (opcional)
                  </Subtle>

                  <Chips>
                    {p.meta?.ns && <Chip tone="neutral">{p.meta.ns}</Chip>}

                    {p.meta?.sem?.conflict ? (
                      <Chip
                        tone="warn"
                        title={
                          p.meta.sem.conflictReason || "Conflicto semántico"
                        }
                      >
                        Sem: conflicto
                      </Chip>
                    ) : p.meta?.sem?.chosen ? (
                      <Chip
                        tone="ok"
                        title="Interpretación por consenso + trust"
                      >
                        Sem: ok
                      </Chip>
                    ) : null}


                    {p.meta?.ar?.modelUrl ? (
                      <Chip tone="neutral">AR</Chip>
                    ) : null}
                     <PresenceHeatBadge score={productHeatMap[String(p.id)] || 0} />
                  </Chips>

                  <Actions>
                    <SmallBtn
                      onClick={(e) => {
                        flyToCart(e.currentTarget as HTMLElement, p.imagen);
                     addToCart({
  id: String(p.id),
  nombre: p.nombre,
  imagen: p.imagen,
  price: p.precio || 0,
  unidad: p.unidad || "u",
  qty: 1,
  meta: {
    ns: p.meta?.ns,
    token: p.meta?.token,
    media: p.meta?.media,
    caja: p.meta?.caja,
    fromOfferId: (p.meta as any)?.fromOfferId,

    // ✅ nuevo
    threadId:
      (p as any)?.attrs?.contact?.threadId ??
      (p.meta as any)?.threadId ??
      resolveProductThreadId(p),

    author: (p as any)?.attrs?.author,
    contact: (p as any)?.attrs?.contact,
    vendor: (p as any)?.attrs?.vendor,
    source: (p as any)?.attrs?.source,
  },
});
                      }}
                    >
                      Agregar
                    </SmallBtn>
<SmallBtn
  tone="ghost"
  onClick={() => {
    navigate(productPath(p.id));
    setPublicProduct(p);
    setPublicOffer(null);
  }}
>
  Ver ficha
</SmallBtn>

<SmallBtn
  tone="ghost"
  onClick={() => sharePublicLink(productPath(p.id), p.nombre)}
>
  Compartir
</SmallBtn>

                    {p.meta?.ar?.modelUrl && (
                      <SmallBtn tone="ghost" onClick={() => abrirAr(p)}>
                        Ver en AR
                      </SmallBtn>
                    )}
                  </Actions>
                </Card>
              ))}
            </Grid>
          </Section>
        )}
        {tab === "circular" && (
  <Section>
    <CircularCenter
      allLive={allLive}
      activeCajero={activeCajero}
      setTab={setTab}
      setInboxThreadId={setInboxThreadId}
      onOpenThread={(threadId) => openThreadGlobal(threadId, "cajero")}
      onOfferMaterial={(cluster) => {
        console.log("ofertar material", cluster);
      }}
      onOpenMO={(payload) => {
        console.log("abrir en MO", payload);
      }}
    />
  </Section>
)}
        {tab === "categorias" && (
          <Section>
            <CategoriasPanel
              products={visibleProducts}
              nsFilter={nsFilter}
              onAddToCart={(p) =>
                addToCart({
                  id: String(p.id),
                  nombre: p.nombre,
                  imagen: p.imagen,
                  price: p.precio || 0,
                  unidad: p.unidad || "u",
                  qty: 1,
                  meta: {
  token: p.meta?.token,
  ns: p.meta?.ns,
  media: p.meta?.media,
  caja: p.meta?.caja,
  fromOfferId: (p.meta as any)?.fromOfferId,

  threadId:
    (p as any)?.attrs?.contact?.threadId ??
    (p.meta as any)?.threadId ??
    resolveProductThreadId(p),

  author: (p as any)?.attrs?.author,
  contact: (p as any)?.attrs?.contact,
  vendor: (p as any)?.attrs?.vendor,
  source: (p as any)?.attrs?.source,
},
                })
              }
              onCheckout={abrirCheckout}
            />
          </Section>
        )}

       {tab === "ofertas" && (
  <>
    <Section>
      <div style={{ fontWeight: 950, fontSize: "1rem" }}>Ofertas</div>
      <Subtle style={{ margin: "6px 0 10px" }}>
        Ofertas vivas publicadas en la red (venta/compra).
      </Subtle>

      {nsFilter !== "__ALL__" && (
        <Subtle style={{ marginBottom: 10 }}>
          Filtrando ofertas por <b>{nsFilter}</b>
        </Subtle>
      )}

      <Grid>
        {visibleOffers.filter((o: any) => !isExplodedMoPackDV(o)).map((o) => {
          const img = getOfferImage(o);
          const ns = getOfferNs(o);
          const title = getOfferTitle(o);

          return (
            <Card key={o.id}>
              {img ? <Img src={img} alt={title} /> : null}

              <Title>{title}</Title>

              <Subtle style={{ marginTop: 6 }}>
                {o.tipo.toUpperCase()} · {o.cantidad}u
              </Subtle>

              <Subtle>Producto: {o.productoId}</Subtle>

              <Chips>
                <Chip tone="neutral">{ns}</Chip>
              </Chips>

              <Price>{o.precio}</Price>
              <Subtle style={{ marginTop: 4 }}>
                Pago: Cajero (recomendado) · BNB (opcional)
              </Subtle>

              <Actions>
               <SmallBtn
  tone="ghost"
  onClick={() => {
    navigate(offerPath(o.id));
    setPublicOffer(o);
    setPublicProduct(null);
  }}
>
  Ver oferta
</SmallBtn>

<SmallBtn
  tone="ghost"
  onClick={() => sharePublicLink(offerPath(o.id), getOfferTitle(o))}
>
  <Share2Icon/>
</SmallBtn>

                <SmallBtn
  onClick={() => {
    const enriched = buildEnrichedOfferForAction(o, products);
    const threadId =
      (enriched as any)?.attrs?.contact?.threadId ||
      (enriched as any)?.meta?.threadId ||
      resolveOfferThreadId(enriched);
console.log("ENRICHED OFFER", {
  id: enriched?.id,
  sellerId: (enriched as any)?.sellerId,
  sellerName: (enriched as any)?.sellerName,
  threadId: (enriched as any)?.threadId,
  attrsSellerId: (enriched as any)?.attrs?.sellerId,
  attrsSellerName: (enriched as any)?.attrs?.sellerName,
  contactSellerId: (enriched as any)?.attrs?.contact?.sellerId,
  contactThreadId: (enriched as any)?.attrs?.contact?.threadId,
  authorId: (enriched as any)?.attrs?.author?.id,
  vendorId: (enriched as any)?.attrs?.vendor?.id,
});
    setReplyOffer(enriched);
    setInboxThreadId(threadId);
    setReplyOpen(true);
  }}
>
  Responder
</SmallBtn>
              </Actions>
            </Card>
          );
        })}
      </Grid>
    </Section>

    <div style={{ height: 14 }} />

    <FabricaVivaPanel
      allDv={allDvClean}
      nsFilter={nsFilter}
      activeCajero={activeCajero}
      setInboxThreadId={setInboxThreadId}
      setTab={setTab}
      Section={Section}
      Grid={Grid}
      Card={Card}
      Title={Title}
      Subtle={Subtle}
      Chips={Chips}
      Chip={Chip}
      Price={Price}
      Actions={Actions}
      SmallBtn={SmallBtn}
    />
  </>
)}
      {tab === "producir" && (
  <Section>
    <ProduceHeader>
      <ProduceTitle>🏭 Centro de producción</ProduceTitle>
      <ProduceSub>
        Trabajos, pedidos, conversaciones y publicación separados para operar simple.
      </ProduceSub>
    </ProduceHeader>

    <ProduceHero>
      <div style={{ fontWeight: 950 }}>
        {activeCajero
          ? `Turno activo: ${activeCajero.nombre}`
          : "Sin cajero en turno"}
      </div>

      <div style={{ fontSize: "0.9rem", opacity: 0.76 }}>
        Elegí una estación. Cada estación hace una sola cosa.
      </div>

      <ProduceHeroRow>
        <ProducePill tone={activeCajero ? "ok" : "warn"}>
          {activeCajero ? "caja activa" : "sin turno"}
        </ProducePill>
        <ProducePill tone="neutral">trabajos</ProducePill>
        <ProducePill tone="neutral">conversaciones</ProducePill>
        <ProducePill tone="neutral">pedidos</ProducePill>
        <ProducePill tone="neutral">publicar</ProducePill>
      </ProduceHeroRow>
    </ProduceHero>

    <ProduceModeBar>
      <ProduceModeBtn
        active={produceView === "trabajos"}
        onClick={() => setProduceView("trabajos")}
      >
        <ProduceModeIcon>🧰</ProduceModeIcon>
        <ProduceModeTitle>Trabajos</ProduceModeTitle>
        <ProduceModeSub>Abrir, asignar y producir</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "conversaciones"}
        onClick={() => setProduceView("conversaciones")}
      >
        <ProduceModeIcon>💬</ProduceModeIcon>
        <ProduceModeTitle>Inbox</ProduceModeTitle>
        <ProduceModeSub>Hablar por hilo vivo</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "pedidos"}
        onClick={() => setProduceView("pedidos")}
      >
        <ProduceModeIcon>📦</ProduceModeIcon>
        <ProduceModeTitle>Pedidos</ProduceModeTitle>
        <ProduceModeSub>Cobro, entrega y estado</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "publicar"}
        onClick={() => setProduceView("publicar")}
      >
        <ProduceModeIcon>✨</ProduceModeIcon>
        <ProduceModeTitle>Publicar</ProduceModeTitle>
        <ProduceModeSub>Producto, oferta o producción</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "caja"}
        onClick={() => setProduceView("caja")}
      >
        <ProduceModeIcon>👤</ProduceModeIcon>
        <ProduceModeTitle>Caja</ProduceModeTitle>
        <ProduceModeSub>Turno y permisos</ProduceModeSub>
      </ProduceModeBtn>
    </ProduceModeBar>

    <div style={{ height: 12 }} />

    {produceView === "trabajos" && (
      <ProducirLayout>
        <ProduceSide>
          <ProduceCard>
            <ProduceBlock>
              <ProduceBlockHead>
                <ProduceBlockTitle>🧰 Trabajos abiertos</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Acá entran work.intent, producción, materiales y packs.
              </ProduceBlockSub>
              <ProduceDivider />

              <WorkInboxPanel
                allLive={allLiveClean}
                actorId={activeCajero?.id || null}
                actorName={activeCajero?.nombre || null}
                nodeId={activeCajero?.id || null}
                orgId={activeCajero?.orgId || null}
                territoryId={activeCajero?.territorioId || null}
                onOpenThread={(threadId) => openProductionThread(threadId)}
              />
            </ProduceBlock>
          </ProduceCard>
        </ProduceSide>

        <ProduceMain>
          <ProduceCard>
            <ProduceBlock>
              <ProduceBlockHead>
                <ProduceBlockTitle>📚 Cola productiva</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Vista simple de lo abierto, planeado o en curso.
              </ProduceBlockSub>
              <ProduceDivider />

              <ProducerQueuePanel
                allLive={allLiveClean}
                actorId={activeCajero?.id || null}
                actorName={activeCajero?.nombre || null}
                nodeId={activeCajero?.id || null}
                orgId={activeCajero?.orgId || null}
                territoryId={activeCajero?.territorioId || null}
              />
            </ProduceBlock>
          </ProduceCard>

          <ProduceCard>
            <ProduceBlock>
              <ProduceBlockHead>
                <ProduceBlockTitle>🛰️ Radar de fábrica</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Demandas y materiales agrupados para responder rápido.
              </ProduceBlockSub>
              <ProduceDivider />

              <FabricaVivaPanel
                allDv={allDvClean}
                nsFilter={nsFilter}
                activeCajero={activeCajero}
                setInboxThreadId={setInboxThreadId}
                setTab={setTab}
                Section={Section}
                Grid={Grid}
                Card={Card}
                Title={Title}
                Subtle={Subtle}
                Chips={Chips}
                Chip={Chip}
                Price={Price}
                Actions={Actions}
                SmallBtn={SmallBtn}
              />
            </ProduceBlock>
          </ProduceCard>
        </ProduceMain>
      </ProducirLayout>
    )}

    {produceView === "conversaciones" && (
      <ProduceCard>
        <ProduceBlock>
          <ProduceBlockHead>
            <ProduceBlockTitle>💬 Conversaciones de producción</ProduceBlockTitle>
          </ProduceBlockHead>
          <ProduceBlockSub>
            Un solo hilo activo. Menos ruido, más claridad.
          </ProduceBlockSub>
          <ProduceDivider />

          {inboxThreadId ? (
          <TradeInboxPanel
  key={`work-thread:${inboxThreadId || "empty"}`}
  mode="all"
  activeCajero={activeCajero}
  title="Hilo vivo del trabajo"
  initialThreadId={inboxThreadId}
  focusThreadOnly
  simple
/>
          ) : (
            <EmptySoftBox>
              <div style={{ fontWeight: 950 }}>Elegí un trabajo primero 🧰</div>
              <div style={{ opacity: 0.72, fontSize: "0.9rem" }}>
                Abrí un trabajo desde la sección Trabajos y acá aparecerá su conversación.
              </div>
            </EmptySoftBox>
          )}
        </ProduceBlock>
      </ProduceCard>
    )}

    {produceView === "pedidos" && (
      <ProduceCard>
        <ProduceBlock>
          <ProduceBlockHead>
            <ProduceBlockTitle>📦 Pedidos y operación</ProduceBlockTitle>
          </ProduceBlockHead>
          <ProduceBlockSub>
            Cobros, entregas y apertura rápida del hilo.
          </ProduceBlockSub>
          <ProduceDivider />

          <CajeroPedidosPanel
            activeCajero={activeCajero}
            onOpenThread={(threadId) => openProductionThread(threadId)}
          />
        </ProduceBlock>
      </ProduceCard>
    )}

    {produceView === "publicar" && (
      <ProduceCard>
        <ProduceBlock>
          <ProduceBlockHead>
            <ProduceBlockTitle>✨ Publicar en MT</ProduceBlockTitle>
          </ProduceBlockHead>
          <ProduceBlockSub>
            Producto, oferta, demanda o producción.
          </ProduceBlockSub>
          <ProduceDivider />

          <ProducirPanel currentCajero={activeCajero} />
        </ProduceBlock>
      </ProduceCard>
    )}

    {produceView === "caja" && (
      <ProducirLayout>
        <ProduceSide>
          <ProduceCard>
            <ProduceBlock>
              <ProduceBlockHead>
                <ProduceBlockTitle>👤 Turno y caja</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Elegí quién está operando producción y cobros.
              </ProduceBlockSub>
              <ProduceDivider />

              <CajerosPanel
                cajeros={cajeros}
                currentCajeroId={activeCajero?.id ?? null}
                onSelect={(c) => setActiveCajero(c)}
              />
            </ProduceBlock>
          </ProduceCard>
        </ProduceSide>

     <ProduceMain>
  <ProduceCard>
    <ProduceBlock>
      <ProduceBlockHead>
        <ProduceBlockTitle>📦 Caja operativa</ProduceBlockTitle>
      </ProduceBlockHead>

      <ProduceBlockSub>
        Pedidos activos, cobros, entregas y conversaciones de la caja.
      </ProduceBlockSub>

      <ProduceDivider />

      <CajeroPedidosPanel
        activeCajero={activeCajero}
        onOpenThread={(threadId) => {
          openProductionThread(threadId);
        }}
      />
    </ProduceBlock>
  </ProduceCard>

  <ProduceCard>
    <ProduceBlock>
      <ProduceBlockHead>
        <ProduceBlockTitle>💬 Conversaciones de caja</ProduceBlockTitle>
      </ProduceBlockHead>

      <ProduceBlockSub>
        Abrí un pedido para ver su hilo. Si no elegís uno, se muestra el inbox general.
      </ProduceBlockSub>

      <ProduceDivider />

      <TradeInboxPanel
        key={`caja-thread:${inboxThreadId || "general"}`}
        mode="all"
        activeCajero={activeCajero}
        title={inboxThreadId ? "Hilo del pedido" : "Inbox operativo"}
        initialThreadId={inboxThreadId}
        focusThreadOnly={!!inboxThreadId}
        simple
      />
    </ProduceBlock>
  </ProduceCard>

  {isAdminOrSupervisor(activeCajero) ? (
    <ProduceCard>
      <ProduceBlock>
        <ProduceBlockHead>
          <ProduceBlockTitle>🔐 Autorización y control</ProduceBlockTitle>
        </ProduceBlockHead>

        <ProduceBlockSub>
          Configuración administrativa para organización y territorio.
        </ProduceBlockSub>

        <ProduceDivider />

        <CajeroAuthPanel activeCajero={activeCajero} />
      </ProduceBlock>
    </ProduceCard>
  ) : (
    <EmptySoftBox>
      <div style={{ fontWeight: 950 }}>Caja operativa simple ✅</div>
      <div style={{ opacity: 0.72, fontSize: "0.9rem" }}>
        Esta caja puede operar pedidos y conversaciones. Los controles avanzados
        aparecen solo con un cajero admin o supervisor.
      </div>
    </EmptySoftBox>
  )}
</ProduceMain>
      </ProducirLayout>
    )}
  </Section>
)}
{tab === "mis_pedidos" && (
  <Section>
    <div style={{ display: "grid", gap: 12 }}>
     <BuyerOrdersPanel
  onOpenThread={(threadId) => {
    openThreadGlobal(threadId);
  }}
/>

    <TradeInboxPanel
  key={`buyer:${inboxThreadId || "empty"}`}
  mode="buyer"
  activeCajero={activeCajero}
  title="Mensajes de mis pedidos / ofertas"
  initialThreadId={inboxThreadId}
/>
    </div>
  </Section>
)}
      </Content>
{/* ✅ Bottom nav (mobile/tablet) */}
<BottomNav>
  <BottomInner>
    <NavHoldWrap>
      <NavMoreBubble open={mobileMarketMenuOpen}>
        <NavMoreBtn
          onClick={() => {
            setTab("categorias");
            setMobileMarketMenuOpen(false);
          }}
        >
          <NavMoreIcon>🗂️</NavMoreIcon>
          <NavMoreText>
            <NavMoreTitle>Categorías</NavMoreTitle>
            <NavMoreSub>Explorar por tipo</NavMoreSub>
          </NavMoreText>
        </NavMoreBtn>
      </NavMoreBubble>

      <NavBtn
        active={tab === "mercado" || tab === "categorias"}
        onClick={handleMarketMobileClick}
        onMouseDown={startMarketLongPress}
        onMouseUp={endMarketLongPress}
        onMouseLeave={endMarketLongPress}
        onTouchStart={startMarketLongPress}
        onTouchEnd={endMarketLongPress}
        onTouchCancel={endMarketLongPress}
        aria-label="Mercado. Mantener presionado para categorías"
        title="Mantener presionado para Categorías"
      >
        <NavHoldHint>＋</NavHoldHint>
        <NavIcon>{tab === "categorias" ? "🗂️" : "🏪"}</NavIcon>
        {tab === "categorias" ? "Categorías" : "Mercado"}
      </NavBtn>
    </NavHoldWrap>

    <NavBtn
      active={tab === "circular"}
      onClick={() => {
        setMobileMarketMenuOpen(false);
        setTab("circular");
      }}
    >
      <NavIcon>♻️</NavIcon>
      <div>Circular</div>
    </NavBtn>

    <NavBtn
      active={tab === "ofertas"}
      onClick={() => {
        setMobileMarketMenuOpen(false);
        setTab("ofertas");
      }}
    >
      <NavIcon>📣</NavIcon>
      Ofertas
    </NavBtn>

    {/* ✅ Producir SOLO ICONO en mobile (sin label) */}
    <NavBtn
      active={tab === "producir"}
      onClick={() => {
        setMobileMarketMenuOpen(false);
        setTab("producir");
      }}
    >
      <NavIcon>➕</NavIcon>
      <ProducirLabel>Producir</ProducirLabel>
    </NavBtn>

    <NavBtn
      active={tab === "mis_pedidos"}
      onClick={() => {
        setMobileMarketMenuOpen(false);
        setTab("mis_pedidos");
      }}
    >
      <NavIcon>📦</NavIcon>
      <div>Pedidos</div>
    </NavBtn>
  </BottomInner>
</BottomNav>
      {/* Carrito */}
      <CartSidebar
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        activeCajero={activeCajero}
        onNeedCajero={() => setCajeroPickerOpen(true)}
        onCheckout={(payload) => {
          const first = payload.items[0];
          if (!first) return;
          const p = products.find((x) => x.id === first.id);
          if (p) {
            setCheckoutProd(p);
            setCheckoutOpen(true);
          }
        }}
      />
<PublicProductOfferModal
  product={publicProduct}
  offer={publicOffer}
  products={products}
  onClose={() => {
    setPublicProduct(null);
    setPublicOffer(null);

    if (
      location.pathname.startsWith("/producto/") ||
      location.pathname.startsWith("/oferta/") ||
      location.pathname.startsWith("/market/producto/") ||
      location.pathname.startsWith("/market/oferta/")
    ) {
      navigate("/market", { replace: true });
    }
  }}
  onShare={() => {
    const path = publicOffer
      ? offerPath(publicOffer.id)
      : publicProduct
      ? productPath(publicProduct.id)
      : "/market";

    sharePublicLink(path, publicOffer ? getOfferTitle(publicOffer) : publicProduct?.nombre);
  }}
  onCheckoutProduct={(p) => {
    setPublicProduct(null);
    setPublicOffer(null);
    abrirCheckout(p);
  }}
  onCheckoutOffer={(o) => {
    setPublicProduct(null);
    setPublicOffer(null);
    abrirCheckoutDesdeOferta(o);
  }}
  onConsultOffer={(o) => {
    const enriched = buildEnrichedOfferForAction(o, products);
    const threadId =
      (enriched as any)?.attrs?.contact?.threadId ||
      (enriched as any)?.meta?.threadId ||
      resolveOfferThreadId(enriched);

    setPublicProduct(null);
    setPublicOffer(null);
    setReplyOffer(enriched);
    setInboxThreadId(threadId);
    setReplyOpen(true);
  }}
/>
  {checkoutProd && (
  <CheckoutModal
  open={checkoutOpen}
  product={checkoutProd}
  activeCajero={activeCajero}
  onNeedCajero={() => setCajeroPickerOpen(true)}
  onClose={() => {
  setCheckoutOpen(false);

  if (
    location.pathname.startsWith("/producto/") ||
    location.pathname.startsWith("/oferta/")
  ) {
    navigate("/", { replace: true });
  }
}}
 onDone={async (payload) => {
  setCheckoutOpen(false);

  if (payload?.threadId) {
    setInboxThreadId(payload.threadId);
  }

  if (payload?.orderId) {
    await ensureOrderVisibleForCajero(payload);
    setLastCheckoutDocs(payload);
    setInvoiceCenterOpen(true);
  }
}}
/>
)}
<InvoiceCenter
  open={invoiceCenterOpen}
  orderId={lastCheckoutDocs?.orderId || null}
  threadId={lastCheckoutDocs?.threadId || null}
  onClose={() => setInvoiceCenterOpen(false)}
  onOpenThread={(threadId) => {
    openThreadGlobal(threadId);
    setTab("mis_pedidos");
  }}
/>
      {/* Cajero picker (global, no depende del checkoutProd) */}
      <CajeroPickerModal
        open={cajeroPickerOpen}
        cajeros={cajeros}
        onClose={() => setCajeroPickerOpen(false)}
        onPick={(c) => {
          setActiveCajero(c);
          setCajeroPickerOpen(false);
        }}
      />

{enrichedReplyOffer && (
  <OfferActionModal
  open={replyOpen}
  offer={enrichedReplyOffer}
  threadId={inboxThreadId || ""}
  products={products}
  activeCajero={activeCajero}
  onNeedCajero={() => setCajeroPickerOpen(true)}
  onClose={() => {
    setReplyOpen(false);
    setReplyOffer(null);
  }}
/>
)}
      {/* AR modal */}
      <ArModal
        open={arOpen}
        product={arProduct}
        onClose={() => setArOpen(false)}
      />
      <NotificationSelectorModal
  open={notifModalOpen}
  namespaces={namespaces}
  onClose={() => setNotifModalOpen(false)}
  onStateChange={({ enabled, selectedNs }) => {
    setNotifyEnabled(enabled);
    setNotifyNs(selectedNs);
  }}
/>
{threadViewerOpen && (
  <Portal>
    <PickerBackdrop
      onClick={() => {
        setThreadViewerOpen(false);
      }}
    >
      <CheckoutModalBox
        style={{
          maxWidth: 860,
          width: "100%",
          maxHeight: "88vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 950 }}>Conversación</div>
            <Subtle>
              Hilo: <code>{threadViewerId || "—"}</code>
            </Subtle>
          </div>

          <Btn kind="ghost" onClick={() => setThreadViewerOpen(false)}>
            Cerrar
          </Btn>
        </div>

        <TradeInboxPanel
          key={`global-thread:${threadViewerId || "empty"}`}
          mode={
            threadViewerMode
          }
          activeCajero={activeCajero}
          title="Conversación del pedido"
          initialThreadId={threadViewerId}
        />
      </CheckoutModalBox>
    </PickerBackdrop>
  </Portal>
)}
    </Page>
  );
}
const PickerBackdrop = styled(Backdrop)`
  z-index: 10050; /* mayor que el checkout */
`;
