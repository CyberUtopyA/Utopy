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

import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  CarrotIcon,
  SendHorizonalIcon,
  Share2Icon,
  ShoppingCart,
  Eye,
  Box as BoxIcon,
  Store,
  Tags,
  Megaphone,
  PackageCheck,
  CirclePlus,
  MapPinned,
  Compass,
  Home,
  Activity,
  Search,
  UserRound,
  Mic,
} from "lucide-react";
import FrequencyVivaModal from "./Notificacion";
// ✅ AR viewer web
import Portal from "./ui/portal"; // ajustá ruta
import { mtLiveSnapshot, mtLiveUpsert, mtLiveSubscribe, mtLiveSetAccessContext } from "../mt/mt.liveStore";
import { acquireLiveSymbiosis } from "../utopy/liveSymbiosis.singleton";
import { useCartStore } from "../components/cardstore";
import CartSidebar from "../components/carrito";
import LiveProductCard from "../components/LiveProductCard";
import UniversalProductDialog, { formatUniversalMoney, projectUniversalProduct, universalProductToCheckoutProduct } from "../components/UniversalProductDialog";
import { productPathFor, readProductOrigin, rememberProductOrigin, resolveProductRoute } from "../mt/productRoute";
import LiveOfferCard from "../components/LiveOfferCard";
import LiveSearchOverlay from "../components/LiveSearchOverlay";
import LivingHighlights from "../components/LivingHighlights";
import LivingProfileQuickView from "../components/LivingProfileQuickView";
import GlobalConversationsModal from "../components/GlobalConversationsModal";
import UnifiedLivingMarket, { isFoodLivingCategory } from "../components/UnifiedLivingMarket";
import { useLivingSpaceNavigation } from "../utopy/livingSpaceNavigation";
import { resolveLiveImage, resolveLiveSeller } from "../mt/livePresentation";
import { readPublishedMerchandising } from "../mt/productMerchandising";
import {
  resolveCurrentIdentityContext,
  type CurrentIdentityContext,
} from "../utopy/identityContext";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { projectLiveProfiles } from "../social/liveProfile";
import { profileHandleForIdentity } from "../mt/productRoute";
import { canRelate, geoPoint, type TerritorialMode } from "../utopy/territorialCompatibility";
import { projectRentalProperties } from "../mt/rental.domain";
import { rentalDisplayPrice } from "../utils/rentalProperty";

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
import OfferActionModal from "../mt/offeractionmodal";
import TradeInboxPanel from "../mt/tradeinboxPanel";
import { resolveOfferThreadId, resolveProductThreadId } from "../mt/tradeThread";
import FabricaVivaPanel from "../mt/fabricaviva";
import MODesignOfferSection from "../mt/MODesignOfferSection";
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
const ProductionQueueWorkspace = lazy(() => import("../components/ProductionQueueWorkspace"));
import { startPaymentBotRuntime } from "../mt/paymentbotruntime";
import { useTradeIntentReceiver } from "../mt/usetradeintentreceiver";
import type { CircularWorldView } from "./circularcenter";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { publishDatoVivo } from "../mt/seedbus";
import {
  buildLinkedWorkIntentDV,
  requestApproximateBrowserLocation,
} from "../mt/mt.threadProtocol";

const CheckoutModal = lazy(() => import("./checkoutmodal"));
const CircularCenter = lazy(() => import("./circularcenter"));
const LiveNetworkPanel = lazy(() => import("../social/LiveNetworkPanel"));
const LivingCreationWorkspace = lazy(() => import("../components/LivingCreationWorkspace"));
const NodeOperationPanel = lazy(() => import("../components/LivingNodePanel"));

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
  width: 100%;
  min-width: 0;
  overflow-x: clip;
  min-height: 100vh;
  background: linear-gradient(180deg, #fffdf9 0%, #faf9f7 42%, #f7f8fa 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Avoid full-surface blur compositing on touch devices. */
  @media (pointer: coarse) {
    & * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    & *, & *::before, & *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
`;

const Content = styled.div`
  width: 100%;
  min-width: 0;
  max-width: ${({ $circular }: { $circular?: boolean }) => $circular ? "none" : "1280px"};
  padding: ${({ $circular }) => $circular ? "0" : "12px"};
  padding-bottom: ${({ $circular }) => $circular ? "0" : "calc(112px + env(safe-area-inset-bottom))"};

  @media (min-width: 900px) {
    padding: ${({ $circular }) => $circular ? "0" : "16px"};
    padding-bottom: ${({ $circular }) => $circular ? "0" : "110px"};
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
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
  @media (min-width: 900px) {
    padding: 0;
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

const OfferGrid = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr));
`;

const OfferSubsection = styled.section`
  display: grid;
  gap: 12px;
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
const ProductCard = styled(Card)`
  border-radius: 20px;
  padding: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.045);
`;

const ProductInfo = styled.div`
  padding: 2px 2px 0;
  display: grid;
  gap: 6px;
`;

const SellerMiniPill = styled.div`
  max-width: 100%;
  width: fit-content;
  font-size: 0.7rem;
  font-weight: 900;
  border-radius: 999px;
  padding: 5px 8px;
  background: rgba(21, 255, 0, 0.1);
  border: 1px solid rgba(21, 255, 0, 0.18);
  color: #111;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IconActions = styled.div`
  display: flex;
  gap: 7px;
  margin-top: 10px;
  align-items: center;
  justify-content: space-between;
`;

const IconActionBtn = styled.button<{ tone?: "primary" | "ghost" }>`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid
    ${({ tone }) =>
      tone === "primary" ? "rgba(34,197,94,0.45)" : "rgba(0,0,0,0.09)"};
  background: ${({ tone }) =>
    tone === "primary" ? "#15ff00ff" : "rgba(255,255,255,0.92)"};
  color: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  }

  svg {
    width: 17px;
    height: 17px;
    stroke-width: 2.4;
  }
`;

const IconActionLink = styled.a<{ tone?: "primary" | "ghost" }>`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid
    ${({ tone }) =>
      tone === "primary" ? "rgba(34,197,94,0.45)" : "rgba(0,0,0,0.09)"};
  background: ${({ tone }) =>
    tone === "primary" ? "#15ff00ff" : "rgba(255,255,255,0.92)"};
  color: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  text-decoration: none;

  svg {
    width: 17px;
    height: 17px;
    stroke-width: 2.4;
  }
`;

const ModalDescription = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.035);
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 0.92rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.76);
`;

const ModalSellerBox = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(21, 255, 0, 0.08);
  border: 1px solid rgba(21, 255, 0, 0.16);
  display: grid;
  gap: 4px;
`;

const ModalActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;

  @media (max-width: 420px) {
    grid-template-columns: 1fr;
  }
`;

const ModalLinkBtn = styled.a`
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 12px;
  padding: 10px 12px;
  background: #15ff00ff;
  color: #111;
  font-weight: 950;
  text-align: center;
  text-decoration: none;
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
const ProductDescription = styled.div`
  font-size: 0.82rem;
  line-height: 1.35;
  opacity: 0.76;
  margin-top: 7px;

  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const SellerPill = styled.div`
  margin-top: 8px;
  font-size: 0.72rem;
  border-radius: 999px;
  padding: 6px 8px;
  background: rgba(21, 255, 0, 0.1);
  border: 1px solid rgba(21, 255, 0, 0.2);
  color: #111;
  width: fit-content;
  max-width: 100%;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ConsultLink = styled.a`
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 12px;
  padding: 10px 10px;
  background: #15ff00ff;
  color: #111;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 900;
  width: 100%;
  text-decoration: none;
  text-align: center;
`;

const UtopyActionBtn = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px 10px;
  background: #fff;
  color: #111;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 900;
  width: 100%;
`;
const NavMoreIcon = styled.span`
  width: 34px;
  height: 34px;
  border-radius: 14px;
  background: #15ff00ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;

  svg {
    width: 18px;
    height: 18px;
  }
`;const FloatingCircularDock = styled.div`
  display: none;
  position: fixed;
  left: 50%;
  bottom: calc(84px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 43;
  display: flex;
  justify-content: center;
  pointer-events: none;

  @media (min-width: 900px) {
    bottom: 24px;
  }
`;
const CircularLoading = styled.div`
  position:fixed;inset:0;z-index:1000;display:grid;place-items:center;align-content:center;gap:10px;background:#f6f8f7;color:#0f172a;
  span{font-size:34px}b{font-size:13px}
`;
const LivingSpaceLayer = styled.div`
  position: fixed; inset: calc(var(--market-header-height, 64px) + 8px) 0 calc(82px + env(safe-area-inset-bottom));
  z-index: 45; overflow: hidden; border-radius: 24px;
  animation: living-space-emerge 240ms ease-out both;
  @keyframes living-space-emerge { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: none; } }
  @media(min-width:900px){inset:calc(var(--market-header-height, 64px) + 8px) 12px 12px}
  @media(prefers-reduced-motion:reduce){animation:none}
  > div { height:100% !important; min-height:0 !important; }
`;
const CircularMapButton = styled.button<{ active?: boolean }>`
  pointer-events: auto;
  border: 1px solid
    ${({ active }) =>
      active ? "rgba(21,255,0,0.65)" : "rgba(255,255,255,0.42)"};

  border-radius: 999px;
  padding: 10px 18px 10px 10px;

  background:
    radial-gradient(circle at 18% 22%, rgba(21,255,0,0.34), transparent 34%),
    linear-gradient(135deg, rgba(15,23,42,0.86), rgba(15,23,42,0.66));

  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 950;
  font-size: 0.86rem;

  box-shadow:
    0 20px 60px rgba(15, 23, 42, 0.34),
    0 0 0 1px rgba(255,255,255,0.08) inset;

  backdrop-filter: blur(20px);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 26px 72px rgba(15, 23, 42, 0.42),
      0 0 28px rgba(21,255,0,0.16);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  span {
    white-space: nowrap;
  }
`;
const CircularIconOrb = styled.span<{ active?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  background: ${({ active }) =>
    active
      ? "linear-gradient(180deg, #15ff00 0%, #9dff7a 100%)"
      : "rgba(255,255,255,0.16)"};

  color: ${({ active }) => (active ? "#071007" : "#fff")};

  box-shadow: ${({ active }) =>
    active ? "0 0 26px rgba(21,255,0,0.32)" : "none"};
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
  right: 7px;
  top: 7px;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.12);
  color: #0f172a;
  font-size: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  | "crear"
  | "circular";

const TopBar = styled.div`
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 90;
  background: rgba(255,255,255,.9);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
`;

const TopInner = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  @media (min-width: 900px) {
    padding: 12px 16px;
  }
`;

const Brand = styled.button`
  border:0;background:transparent;text-align:left;cursor:pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  padding-left: 39px;
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 29px;
    height: 29px;
    border: 5px solid #cba66f;
    border-left-color: transparent;
    border-bottom-color: #ece6dc;
    border-radius: 50%;
    transform: translateY(-50%) rotate(-30deg);
  }
`;

const BrandEyebrow = styled.div`
  font-size:8px;font-weight:950;letter-spacing:.18em;color:#64748b;line-height:1;text-transform:uppercase;
`;

const BrandTitle = styled.div`
  font-weight: 950;
  font-size: 1.15rem;
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
  @media(max-width:500px){gap:3px}
`;
const HeaderMore = styled.details`
  position:relative;
  >summary{list-style:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;color:#575563;}
  >summary::-webkit-details-marker{display:none}
  >div{position:absolute;right:0;top:48px;z-index:110;display:grid;gap:12px;min-width:230px;padding:18px;background:#fff;border:1px solid #eeedf3;border-radius:22px;box-shadow:0 18px 60px #20202d26;}
  >div>label{display:grid;gap:6px;font-size:12px;color:#777482}
`;
const HeaderSearch = styled.button`
  min-width:0;flex:1;max-width:430px;display:flex;align-items:center;gap:10px;border:1px solid #eeedf3;border-radius:999px;background:#f5f4f8;padding:11px 16px;text-align:left;color:#86828f;font-size:12px;cursor:pointer;svg{width:17px;height:17px;flex:none}
  @media(max-width:580px){span{display:none}flex:none;width:42px;height:42px;padding:12px;}
`;
const HeaderIndicators = styled.div`
  display:flex;gap:5px;align-items:center;
  @media(max-width:900px){display:none;}
`;
const HeaderIndicator = styled.span`
  display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:6px 8px;background:#fff;color:#475569;font-size:10px;font-weight:850;
`;
const MiniSelect = styled.select`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(34, 197, 94, 0.12); /* ✅ verde suave */
  color: #111;
  font-size: 0.85rem;
  max-width: 160px;

  @media(max-width:900px){display:none;}

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
  width:44px;height:44px;padding:0;display:grid;place-items:center;
  @media(max-width:500px){width:38px;height:38px}
  svg{width:20px;height:20px;}

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
  @media (min-width: 1100px) {
    position: relative;
    width:fit-content;
    max-width:100%;
    margin:0 auto 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 999px;
    background: #f5f3f0;
  }
`;const IconGhostBtn = styled.button<{ active?: boolean }>`
  border: none;
  background: ${({ active }) => (active ? "rgba(34, 197, 94, 0.12)" : "transparent")};
  color: ${({ active }) => (active ? "#16a34a" : "#111")};
  width: 42px;
  height: 42px;
  @media(max-width:500px){width:36px;height:36px}
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  @media(max-width:900px){&.market-top-map{display:none;}}
  transition: background 0.18s ease, transform 0.12s ease, color 0.18s ease;

  &:hover {
    background: ${({ active }) =>
      active ? "rgba(34, 197, 94, 0.18)" : "rgba(0, 0, 0, 0.06)"};
  }

  &:active {
    transform: translateY(1px);
  }

  &.frequency-button {
    color: #4f3d71;
    font: 900 24px/1 system-ui, sans-serif;
  }

  &.frequency-button .frequency-glyph {
    position: relative;
    z-index: 1;
    transform: translateY(-1px);
  }

  &.frequency-active {
    background: rgba(222, 213, 242, .42);
  }

  &.frequency-silent {
    opacity: .46;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 3px;
    border-radius: 999px;
    border: 1px solid transparent;
    pointer-events: none;
  }

  &.frequency-active::after {
    border-color: rgba(111, 82, 164, .16);
    box-shadow: 0 0 18px rgba(111, 82, 164, .1);
  }

  &.frequency-pulse::after {
    animation: frequency-wave .9s ease-out 1;
  }

  @keyframes frequency-wave {
    from { inset: 4px; border-color: rgba(111,82,164,.34); opacity: 1; }
    to { inset: -10px; border-color: rgba(111,82,164,0); opacity: 0; }
  }

  svg {
    width: 21px;
    height: 21px;
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
  z-index: 90;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  pointer-events: none;

  @media (min-width: 900px) {
    display: none;
  }
`;

const BottomInner = styled.div`
  width: min(520px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  padding: 8px 6px;
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 35px rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(18px);
  pointer-events: auto;
`;

const NavBtn = styled.button<{ active?: boolean }>`
  border: 0;
  background: transparent;
  color: #0f172a;
  border-radius: 18px;
  min-width: 0;
  height: 56px;
  justify-self: center;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 950;
  font-size: 9px;
  gap: 2px;
  opacity: ${({ active }) => active ? 1 : .58};
  box-shadow: none;
  transition:
    transform 0.14s ease,
    box-shadow 0.14s ease,
    background 0.14s ease;

  &:active {
    transform: translateY(1px) scale(0.98);
  }

  svg {
    width: 21px;
    height: 21px;
    stroke-width: 2.4;
  }
  &.primary-create > div {
    width: 42px;
    height: 42px;
    margin-top: -18px;
    border-radius: 50%;
    color: white;
    background: linear-gradient(145deg,#d9b16f,#a97a38);
    box-shadow: 0 12px 28px rgba(169,122,56,.3);
  }
`;

const NavIcon = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
function displayPrice(v: any) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return "Consultar";
  return `₲ ${n.toLocaleString("es-PY")}`;
}

function getProductDescription(item: any) {
  return (
    item?.attrs?.descripcion ||
    item?.meta?.description ||
    "Producto disponible. Consultar medidas, precio y disponibilidad."
  );
}

function getProductSellerName(item: any, allLive: any[] = []) {
  return resolveLiveSeller(item, allLive);
}
function getProductImageUrl(item: any, allLive: any[] = []) {
  return resolveLiveImage(item, allLive);
}

function toPublicImageUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("data:")) return "";
  if (src.startsWith("blob:")) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;

  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return "";
  }
}
function getProductSellerId(item: any) {
  return (
    item?.attrs?.sellerId ||
    item?.attrs?.storeId ||
    item?.meta?.storeId ||
    item?.meta?.seller?.id ||
    "seller"
  );
}
function isMOFabricableProduct(item: any) {
  const traits = Array.isArray(item?.traits) ? item.traits.map(String) : [];
  const sourceNode = String(
    item?.attrs?.source?.node ||
      item?.attrs?.author?.nodeId ||
      item?.meta?.originNode ||
      item?.meta?.source ||
      "",
  ).toLowerCase();
  const actions = Array.isArray(item?.attrs?.symbioticActions)
    ? item.attrs.symbioticActions
    : [];

  return (
    traits.includes("mo:product") ||
    sourceNode === "mo" ||
    sourceNode.includes("mo:creator") ||
    actions.some((action: any) => action?.id === "fabrication.request")
  );
}function buildWhatsappConsultUrl(item: any) {
  const nombre =
    item?.attrs?.nombre ||
    item?.nombre ||
    item?.meta?.name ||
    "producto";

  const seller = getProductSellerName(item);

  const whatsapp =
    item?.attrs?.whatsapp ||
    item?.meta?.contact?.whatsapp ||
    item?.meta?.seller?.whatsapp ||
    "";

  if (!whatsapp) return "";

  let cleanPhone = String(whatsapp).replace(/\D/g, "");

  if (cleanPhone.startsWith("0")) {
    cleanPhone = `595${cleanPhone.slice(1)}`;
  }

  if (cleanPhone.length === 9 && cleanPhone.startsWith("9")) {
    cleanPhone = `595${cleanPhone}`;
  }

  if (cleanPhone.startsWith("5950")) {
    cleanPhone = `595${cleanPhone.slice(4)}`;
  }

  const productUrl = absolutePublicUrl(
    productPath(item)
  );

  const text = encodeURIComponent(
    `Hola ${seller}, vi este producto en UTOPY Market y quiero consultar precio y disponibilidad:\n\n${nombre}\n\nFicha del producto:\n${productUrl}`
  );

  return `https://wa.me/${cleanPhone}?text=${text}`;
}
function buildProductJsonLd(product: any) {
  const id = String(product?.id || "");

  const name =
    product?.nombre ||
    product?.attrs?.nombre ||
    product?.meta?.name ||
    "Producto UTOPY Market";

  const description =
    product?.attrs?.descripcion ||
    product?.meta?.description ||
    "Producto disponible en UTOPY Market.";

  const rawImage = getProductImageUrl(product) || product?.imagen || "";
  const image = rawImage ? toPublicImageUrl(rawImage) || rawImage : "";

  const sellerName = getProductSellerName(product);

  const price = Number(product?.precio || product?.attrs?.precio || 0);
  const stock = Number(product?.stock ?? product?.attrs?.stock ?? 1);

  const url =
    typeof window !== "undefined"
      ? new URL(productPath(product), window.location.origin).toString()
      : `https://market.utopy.live${productPath(product)}`;

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: image ? [image] : undefined,
    brand: {
      "@type": "Brand",
      name: sellerName,
    },
    seller: {
      "@type": "Organization",
      name: sellerName,
    },
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PYG",
      availability:
        stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: sellerName,
      },
    },
  };

  if (price > 0) {
    jsonLd.offers.price = String(price);
  }

  return jsonLd;
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
function productPath(product: any, siblings: any[] = []) {
  return productPathFor(product, siblings);
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
    kind.startsWith("mt:") ||
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
  const initialRef = useRef<{
    products: MtProduct[];
    offers: MtOffer[];
    cajeros: MtCajero[];
    allLive: DatoVivo[];
  } | null>(null);
  if (!initialRef.current) {
    const local = mtLiveSnapshot().filter((dv: any) => !isExplodedMoPackDV(dv));
    initialRef.current = {
      allLive: local,
      products: adaptDatosToMtProducts(local).map((product) => ({
        ...product,
        imagen: getProductImageUrl(product, local),
        sellerName: getProductSellerName(product, local),
      })),
      offers: adaptDatosToMtOffers(local),
      cajeros: adaptDatosToMtCajeros(local),
    };
  }
  const initial = initialRef.current!;
  const [products, setProducts] = useState<MtProduct[]>(initial.products);
  const [offers, setOffers] = useState<MtOffer[]>(initial.offers);
  const [cajeros, setCajeros] = useState<MtCajero[]>(initial.cajeros);
  const [status, setStatus] = useState<"live" | "fallback" | "idle">(initial.products.length || initial.offers.length ? "live" : "idle");
  const [allLive, setAllLive] = useState<DatoVivo[]>(initial.allLive);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "live" | "offline" | "partial">(() => navigator.onLine ? "syncing" : "offline");

  useEffect(() => {
    let alive = true;
    let recomputeTimer: number | null = null;
    let latestAll: DatoVivo[] = [];
    let settleTimer: number | null = null;
    const sourceStates = new Map<string, string>();

    // Runtime compartido: Market y Falcon adquieren la misma instancia.
    const releaseRuntime = acquireLiveSymbiosis();

    const recompute = (all: DatoVivo[]) => {
      const cleanAll = (all || []).filter((dv: any) => !isExplodedMoPackDV(dv));
      const prods = adaptDatosToMtProducts(cleanAll).map((product) => ({
        ...product,
        imagen: getProductImageUrl(product, cleanAll),
        sellerName: getProductSellerName(product, cleanAll),
      }));
      const offs = adaptDatosToMtOffers(cleanAll);
      const cajs = adaptDatosToMtCajeros(cleanAll);

      if (!alive) return;
      // Public projections are non-urgent; keep typing and navigation responsive.
      React.startTransition(() => {
        setAllLive(cleanAll);
        setProducts(prods);
        setOffers(offs);
        setCajeros(cajs);
        setStatus(prods.length || offs.length || cajs.length ? "live" : "idle");
      });
    };

    const scheduleRecompute = (all: DatoVivo[]) => {
      latestAll = Array.isArray(all) ? all : [];
      if (recomputeTimer != null) return;
      recomputeTimer = window.setTimeout(() => {
        recomputeTimer = null;
        recompute(latestAll);
      }, 60);
    };

    const unsubscribe = mtLiveSubscribe(scheduleRecompute);

    const onSourceStatus = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!alive) return;
      if (detail?.sourceId) sourceStates.set(String(detail.sourceId), String(detail.state || ""));
      if (detail?.state === "loading" || detail?.state === "discovering") {
        setSyncState("syncing");
      } else if (detail?.state === "error" || detail?.state === "cached") {
        setSyncState(latestAll.length ? "partial" : "offline");
      } else if (detail?.state === "live") {
        if (settleTimer != null) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          const partial = Array.from(sourceStates.values()).some((state) => state === "error" || state === "cached");
          setSyncState(partial ? "partial" : "live");
        }, 900);
      }
      if (detail?.state === "error" && latestAll.length === 0) {
        setStatus("fallback");
      } else if (detail?.state === "live") {
        setStatus("live");
      }
    };

    const onOffline = () => setSyncState("offline");
    const onOnline = () => setSyncState("syncing");

    window.addEventListener(
      "utopy:catalog-source:status",
      onSourceStatus as EventListener,
    );
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      alive = false;
      if (recomputeTimer != null) window.clearTimeout(recomputeTimer);
      if (settleTimer != null) window.clearTimeout(settleTimer);
      unsubscribe();
      releaseRuntime();
      window.removeEventListener(
        "utopy:catalog-source:status",
        onSourceStatus as EventListener,
      );
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const refresh = () => {
    setSyncState(navigator.onLine ? "syncing" : "offline");
    window.dispatchEvent(new Event("utopy:catalog-sources:refresh"));
  };

  return { products, offers, cajeros, status, allLive, syncState, refresh, hadLocalState: initial.allLive.length > 0 };
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
  const [viewerReady, setViewerReady] = useState(false);
  useEffect(() => {
    if (!open || !product) return;
    let active = true;
    void import("@google/model-viewer").then(() => { if (active) setViewerReady(true); });
    return () => { active = false; };
  }, [open, product]);
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
          {viewerReady ? <>{/* @ts-ignore */}<model-viewer
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
          /></> : <div style={{ height: "min(62vh, 520px)", display: "grid", placeItems: "center", color: "white", fontWeight: 800 }}>Preparando vista 3D…</div>}
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
  onConsultProduct,
  onFabricateProduct,
  onClose,
  onCheckoutProduct,
  onCheckoutOffer,
  onConsultOffer,
  onShare,
}: {
  product: MtProduct | null;
  offer: MtOffer | null;
  onConsultProduct: (p: MtProduct) => void;
  onFabricateProduct: (p: MtProduct) => void;
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
    ? getOfferImage(offer) || linkedProduct?.imagen || ""
    : product?.imagen || "";

  const price = offer
    ? offer.precio
    : product?.precio;

  const ns = offer
    ? getOfferNs(offer)
    : product?.meta?.ns || "mt:market";
    const productForInfo = product || linkedProduct || null;
const description = productForInfo ? getProductDescription(productForInfo) : "";
const sellerName = productForInfo ? getProductSellerName(productForInfo) : "Nodo vendedor";
const whatsappUrl = productForInfo ? buildWhatsappConsultUrl(productForInfo) : "";

  const sharedSource = offer
    ? {
        ...(linkedProduct || {}),
        ...offer,
        attrs: {
          ...((linkedProduct as any)?.attrs || {}),
          ...((offer as any)?.attrs || {}),
          price: offer.precio,
          sellerName,
        },
      }
    : product;
  const sharedView = projectUniversalProduct(sharedSource, {
    title,
    seller: sellerName,
    description,
    image: img,
    finalPrice: Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null,
    publicPath: productForInfo
      ? (typeof window !== "undefined" && window.location.pathname.startsWith("/producto/")
          ? window.location.pathname
          : productPath(productForInfo, products))
      : "",
  });

  return (
    <Portal>
      <UniversalProductDialog
        open
        product={sharedView}
        onClose={onClose}
        onBuy={() => offer ? onCheckoutOffer(offer) : product ? onCheckoutProduct(product) : undefined}
        onConsult={() => offer ? onConsultOffer(offer) : product ? onConsultProduct(product) : undefined}
      />
    </Portal>
  );

/* Legacy public sheet retained only as source history; the universal sheet above is the live surface.
  return (
    <Portal>
      {productJsonLd ? (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(productJsonLd),
    }}
  />
) : null}
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
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          ) : <div style={{ marginTop: 12, aspectRatio: "4 / 3", display: "grid", placeItems: "center", borderRadius: 16, background: "#f1f5f9", color: "#64748b", fontWeight: 800 }}>📦 Sin imagen</div>}

          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 950 }}>
              {price ? `${price}` : "Precio a consultar"}
            </div>
{productForInfo ? (
  <>
    <ModalSellerBox>
      <div style={{ fontSize: "0.78rem", opacity: 0.68, fontWeight: 900 }}>
        Nodo vendedor
      </div>
      <div style={{ fontWeight: 950 }}>{sellerName}</div>
    </ModalSellerBox>

    <ModalDescription>{description}</ModalDescription>
  </>
) : null}
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
             {product && whatsappUrl ? (
    <ModalLinkBtn href={whatsappUrl} target="_blank" rel="noreferrer">
      Consultar directo
    </ModalLinkBtn>
  ) : null}

  {product ? (
    <SmallBtn tone="ghost" onClick={() => onConsultProduct(product)}>
      💬 Consultar por UTOPY
    </SmallBtn>
  ) : null}

  {product && isMOFabricableProduct(product) ? (
    <SmallBtn tone="ghost" onClick={() => onFabricateProduct(product)}>
      🏭 Fabricar o adaptar
    </SmallBtn>
  ) : null}

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
*/
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
type MercadoLocalProps = {
  kioskMode?: boolean;
  territoryMode?: boolean;
};

export default function MercadoLocal({ kioskMode = false, territoryMode=false }: MercadoLocalProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("mercado");
  const [territorialMode, setTerritorialMode] = useState<TerritorialMode>("for_me");
  const [offerView, setOfferView] = useState<"all" | "sell" | "buy">("all");
  const [circularInitialView, setCircularInitialView] =
    useState<CircularWorldView>("mapa");
  const previousMarketTabRef =
    useRef<Exclude<Tab, "circular">>("mercado");
  const circularReturnToRef = useRef<string | null>(null);
  const surfaceTab = tab === "circular" ? previousMarketTabRef.current : tab;
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileQuickOpen, setProfileQuickOpen] = useState(false);
  const [profileInitialSpace,setProfileInitialSpace]=useState<'home'|'value'>('home');
  const [conversationsOpen, setConversationsOpen] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("conversations") === "1" || query.get("conversaciones") === "1") setConversationsOpen(true);
  }, [location.search]);
  const [cajeroPickerOpen, setCajeroPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProd, setCheckoutProd] = useState<MtProduct | null>(null);
const [checkoutOffer, setCheckoutOffer] = useState<MtOffer | null>(null);
  const [circularPurchaseContext, setCircularPurchaseContext] = useState<any | null>(() => {
    try { return JSON.parse(window.sessionStorage.getItem("utopy.circular.purchaseContext") || "null")?.context || null; } catch { return null; }
  });
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyOffer, setReplyOffer] = useState<MtOffer | null>(null);
const [inboxThreadId, setInboxThreadId] = useState<string | null>(null);
  const [nsFilter, setNsFilter] = useState<string>("__ALL__");
  const [activeCajero, setActiveCajero] = useState<MtCajero | null>(null);
  const [frequencyEnabled, setFrequencyEnabled] = useState(false);
  const [frequencyMode, setFrequencyMode] = useState<"soft" | "normal" | "now" | "silent">("soft");
  const [frequencyHasActive, setFrequencyHasActive] = useState(false);
  const [frequencyPulse, setFrequencyPulse] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [threadViewerOpen, setThreadViewerOpen] = useState(false);
  const [threadViewerMode, setThreadViewerMode] = useState<"buyer" | "cajero">("buyer");
const [threadViewerId, setThreadViewerId] = useState<string | null>(null);
  const [kioskConsult, setKioskConsult] = useState<{
  title: string;
  seller: string;
  whatsappUrl: string;
  imageUrl?: string;
  productId?: string;
} | null>(null);
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
  useEffect(() => {
    let timer: number | null = null;
    const onAttention = (event: Event) => {
      const decisions = (event as CustomEvent)?.detail?.decisions;
      if (!Array.isArray(decisions) || !decisions.some((item: any) => item?.outcome === "RESONANCE" || item?.outcome === "PUSH")) return;
      setFrequencyPulse(false);
      window.requestAnimationFrame(() => setFrequencyPulse(true));
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => { setFrequencyPulse(false); timer = null; }, 950);
    };
    window.addEventListener("utopy:frequency:attention", onAttention);
    return () => {
      window.removeEventListener("utopy:frequency:attention", onAttention);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);
  const { addToCart } = useCartStore();
  const { products, offers, cajeros, status, allLive, syncState, refresh, hadLocalState } = useMtClient();
  const routeProducts = useMemo(() => {
    const byId = new Map<string, any>();
    for (const product of products) byId.set(String(product.id), product);
    for (const dv of allLive) {
      const kind = String((dv as any)?.kind || "").toLowerCase();
      const traits = Array.isArray((dv as any)?.traits) ? (dv as any).traits.join(" ").toLowerCase() : "";
      if (!/product|producto|asset|pack|project|offer/.test(`${kind} ${traits}`)) continue;
      const id = String((dv as any)?.attrs?.productId || (dv as any)?.id || "");
      if (id && !byId.has(id)) byId.set(id, dv);
    }
    return Array.from(byId.values());
  }, [products, allLive]);
  const { emitPresence, clearSignals } = usePresenceEmitter();
  const [produceView, setProduceView] = useState<ProduceView>("trabajos");
  const [activityOperational, setActivityOperational] = useState(false);
  const [operationalPanelOpen, setOperationalPanelOpen] = useState(false);
  const [operationalPanelSection, setOperationalPanelSection] = useState<"overview" | "automations">("overview");
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

    if (import.meta.env.DEV) console.debug("Trade intent buy recibido", intent);
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

    if (import.meta.env.DEV) console.debug("Trade intent consult recibido", intent);
  },
});
const navigate = useNavigate();
const networkSearchQuery = new URLSearchParams(location.search).get("search") || "";
const [mobileMarketMenuOpen, setMobileMarketMenuOpen] = useState(false);
const marketPressTimerRef = useRef<number | null>(null);
const marketLongPressedRef = useRef(false);
const params = useParams<{
  productId?: string;
  offerId?: string;
  threadId?: string;
}>();
const openProductRoute = (product: MtProduct) => {
  rememberProductOrigin(product, routeProducts, `${location.pathname}${location.search}${location.hash}`);
  navigate(productPath(product, routeProducts));
};

useEffect(() => {
  if (networkSearchQuery) setSearchOpen(true);
}, [networkSearchQuery]);

const safeInternalReturnPath = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw || typeof window === "undefined") return null;

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw.startsWith("/") ? raw : null;
  }
};

const rememberCircularOrigin = () => {
  if (tab !== "circular") {
    previousMarketTabRef.current = tab as Exclude<Tab, "circular">;
  }
};

const openCircular = (
  view: CircularWorldView = "mapa",
  returnTo?: string | null,
) => {
  if (view === "publicar") {
    const context = new URLSearchParams(location.search).get("createWith") || spaceNavigation.selectedRef;
    setTab("crear");
    navigate(`/market?tab=crear${context ? `&createWith=${encodeURIComponent(context)}` : ""}`);
    return;
  }
  rememberCircularOrigin();
  setMobileMarketMenuOpen(false);
  setCircularInitialView(view);
  const origin = safeInternalReturnPath(returnTo) || (tab !== "circular" ? `${location.pathname}${location.search}${location.hash}` : circularReturnToRef.current);
  circularReturnToRef.current = origin;
  setTab("circular");
  navigate(`/market?tab=circular&view=${encodeURIComponent(view)}${origin ? `&returnTo=${encodeURIComponent(origin)}` : ""}`);
};

const openLivingSpace = (projection: "orbit" | "map") => {
  updateSpaceNavigation({ projection });
  openCircular("mapa");
};

const selectMainTab = (next: Exclude<Tab, "circular">) => {
  const root=territoryMode?'/mt':'/market';
  if (next === "producir") { setTab("crear"); navigate(`${root}?tab=crear`); return; }
  navigate(`${root}?tab=${next}`);
  setTab(next);
};

const closeCircular = () => {
  updateSpaceNavigation({ projection: "feed" });
  const query = new URLSearchParams(location.search);
  const queryReturnTo = safeInternalReturnPath(query.get("returnTo"));

  let storedReturnTo: string | null = null;
  try {
    storedReturnTo = safeInternalReturnPath(
      window.sessionStorage.getItem("utopy.circular.returnTo"),
    );
    window.sessionStorage.removeItem("utopy.circular.returnTo");
  } catch {}

  const returnTo =
    circularReturnToRef.current || queryReturnTo || storedReturnTo;

  let pendingPurchase: any = null;
  try { pendingPurchase = JSON.parse(window.sessionStorage.getItem("utopy.circular.purchaseContext") || "null"); } catch {}

  circularReturnToRef.current = null;

  const currentRoute =
    `${location.pathname}${location.search}${location.hash}`;

  if (returnTo && returnTo !== currentRoute) {
    navigate(returnTo, { replace: true });
    return;
  }

  if (pendingPurchase?.context && checkoutProd) {
    try { window.sessionStorage.removeItem("utopy.circular.purchaseContext"); } catch {}
    setCircularPurchaseContext(null);
    setTab(previousMarketTabRef.current || "mercado");
    setCheckoutOpen(true);
    return;
  }

  setTab(previousMarketTabRef.current || "mercado");

  // Limpia el deep-link del mapa para que Atrás/Adelante no lo reabra.
  if (
    (location.pathname === "/market" || location.pathname === "/market/mapa") &&
    (query.get("tab") === "circular" ||
      query.get("view") === "profile" ||
      query.get("view") === "red" ||
      location.pathname === "/market/mapa")
  ) {
    navigate("/market", { replace: true });
  }
};

useEffect(() => {
  const query = new URLSearchParams(location.search);
  const requestedTab = String(query.get("tab") || "").toLowerCase();
  const requestedView = String(query.get("view") || "").toLowerCase();
  if (query.get("frequencyId") && !frequencyOpen) setFrequencyOpen(true);
  if (["mercado", "categorias", "ofertas", "producir", "mis_pedidos", "crear"].includes(requestedTab)) {
    setTab(requestedTab === "producir" ? "mis_pedidos" : requestedTab as Tab);
  }
  const requestedSection = query.get("section");
  if (["producir", "mis_pedidos"].includes(requestedTab)) {
    const operational = !!requestedSection && ["trabajos", "conversaciones", "pedidos", "publicar", "caja"].includes(requestedSection);
    setActivityOperational(requestedTab === "producir" || operational);
    if (operational) setProduceView(requestedSection as ProduceView);
  }

  const shouldOpenCircular =
    location.pathname === "/market/mapa" ||
    requestedTab === "circular" ||
    requestedView === "profile" ||
    requestedView === "red";

  if (requestedView === "publicar" && shouldOpenCircular) {
    setTab("crear");
    const context = query.get("createWith") || spaceNavigation.selectedRef;
    navigate(`/market?tab=crear${context ? `&createWith=${encodeURIComponent(context)}` : ""}`, { replace: true });
    return;
  }
  if (!shouldOpenCircular) {
    if (location.pathname === "/market" && !["mercado", "categorias", "ofertas", "producir", "mis_pedidos", "crear"].includes(requestedTab)) setTab("mercado");
    return;
  }

  const nextView: CircularWorldView =
    requestedView === "profile" || requestedView === "red"
      ? "red"
      : ([
            "mapa",
            "publicar",
            "radar",
            "fabrica",
            "conectar",
            "cadena",
            "aportes",
          ].includes(requestedView)
          ? requestedView
          : "mapa") as CircularWorldView;

  if (tab !== "circular") {
    previousMarketTabRef.current = tab as Exclude<Tab, "circular">;
  }

  circularReturnToRef.current = safeInternalReturnPath(query.get("returnTo"));
  try {
    const pending = JSON.parse(window.sessionStorage.getItem("utopy.circular.purchaseContext") || "null");
    setCircularPurchaseContext(pending?.context || null);
  } catch {}

  if (circularInitialView !== nextView) {
    setCircularInitialView(nextView);
  }
  if (tab !== "circular") {
    setTab("circular");
  }
}, [location.pathname, location.search]);

const openedDeepLinkRef = useRef<string | null>(null);
const [presenceOrderDocs, setPresenceOrderDocs] = useState<{
  orderId: string;
  threadId: string;
} | null>(null);


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

    return base
      .filter((p: any) => {
        const hidden = p?.meta?.hidden === true || p?.attrs?.hidden === true;
        const status = String(
          p?.meta?.status ?? p?.attrs?.status ?? "active",
        ).toLowerCase();
        const available =
          p?.available ?? p?.attrs?.available ?? p?.meta?.available;
        const rawStock =
          p?.stock ??
          p?.attrs?.stock ??
          p?.attrs?.stockQty ??
          p?.meta?.stock ??
          p?.meta?.stockQty;
        const stockKnown =
          rawStock !== undefined &&
          rawStock !== null &&
          String(rawStock).trim() !== "" &&
          Number.isFinite(Number(rawStock));
        const stock = stockKnown ? Number(rawStock) : null;

        if (hidden) return false;
        if (["out_of_stock", "disabled", "inactive", "deleted"].includes(status)) {
          return false;
        }
        if (available === false) return false;
        if (stockKnown && Number(stock) <= 0) return false;

        // Un nodo puede publicar disponibilidad sin revelar un stock exacto.
        // Market lo muestra; Falcon decidirá después si lo selecciona.
        return true;
      })
      .sort((a: any, b: any) => {
        const at = Date.parse(
          String(a?.meta?.updatedAt ?? a?.meta?.ts ?? a?.attrs?.updatedAt ?? ""),
        );
        const bt = Date.parse(
          String(b?.meta?.updatedAt ?? b?.meta?.ts ?? b?.attrs?.updatedAt ?? ""),
        );
        return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
      });
  }, [products, nsFilter]);
  const [feedProductIds, setFeedProductIds] = useState<Set<string>>(() => new Set(products.map((product) => String(product.id))));
  const [pendingProductIds, setPendingProductIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(visibleProducts.map((product) => String(product.id)));
    setFeedProductIds((previous) => {
      const retained = new Set(Array.from(previous).filter((id) => currentIds.has(id)));
      const incoming = Array.from(currentIds).filter((id) => !retained.has(id));
      if (!incoming.length) return retained;
      if (retained.size === 0 || window.scrollY < 180) {
        incoming.forEach((id) => retained.add(id));
        return retained;
      }
      setPendingProductIds((pending) => new Set([...pending, ...incoming]));
      return retained;
    });
  }, [visibleProducts]);
  const displayedProducts = useMemo(
    () => visibleProducts.filter((product) => feedProductIds.has(String(product.id))),
    [visibleProducts, feedProductIds],
  );
  const revealPendingProducts = () => {
    const anchor = window.scrollY;
    setFeedProductIds((current) => new Set([...current, ...pendingProductIds]));
    setPendingProductIds(new Set());
    window.requestAnimationFrame(() => window.scrollTo({ top: anchor }));
  };
  const hasVisibleMoDesigns = useMemo(() => (allLive || []).some((dv: any) =>
    /^(design\.outcome|design\.publication)$/.test(String(dv?.kind || "")) &&
    dv?.attrs?.status === "published" && dv?.attrs?.discoverable !== false &&
    (dv?.meta?.scopes || dv?.attrs?.scopes || []).includes("public")
  ), [allLive]);
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
  const displayOffers = useMemo(
    () => visibleOffers.filter((offer: any) => {
      if (offerView === "all") return true;
      return offerView === "buy" ? offer?.tipo === "compra" : offer?.tipo !== "compra";
    }),
    [offerView, visibleOffers],
  );

async function upsertAndPublishDV(dv: any) {
  const finalDv = {
    ...dv,
    meta: {
      ...(dv?.meta || {}),
      ns: dv?.meta?.ns || "mt:market",
      ts: dv?.meta?.ts || new Date().toISOString(),
    },
  };
  const targetNodeId = String(
    finalDv?.attrs?.target?.nodeId ||
      finalDv?.attrs?.targetNodeId ||
      finalDv?.attrs?.sellerNodeId ||
      finalDv?.attrs?.sellerId ||
      "",
  ) || null;
  const result = await publishAuthorizedDV({
    dv: finalDv,
    allLive,
    activeActor: localBuyerActor,
    targetNodeId,
    sensitivity: "relationship",
  });
  return result.dv;
}
async function solicitarPorUtopy(item: any) {
  if (!localBuyerActor?.id) return;
  const productId = String(item?.id || "");
  const nombre =
    item?.attrs?.nombre || item?.nombre || item?.meta?.name || "Producto";
  const imageUrl = getProductImageUrl(item);
  const sellerId =
    item?.attrs?.sellerId ||
    item?.attrs?.storeId ||
    item?.meta?.storeId ||
    item?.meta?.seller?.id ||
    "seller";
  const sellerName = getProductSellerName(item);
  const threadId = resolveProductThreadId(item);
  const relation = item?.attrs?.relation || item?.meta?.relation || {};
  const chainId =
    item?.attrs?.chainId || item?.meta?.chainId || relation?.chainId || threadId;
  const rootDvId =
    item?.attrs?.rootDvId || item?.meta?.rootDvId || relation?.rootDvId || item?.id;

  const dv: DatoVivo = {
    id: `mt:consult:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind: "mt:consult",
    attrs: {
      productId,
      nombre,
      imageUrl,
      imagen: imageUrl,
      sellerId,
      sellerName,
      designId: item?.attrs?.designId || relation?.designId || null,
      workId: item?.attrs?.workId || relation?.workId || null,
      threadId,
      chainId,
      rootDvId,
      parentDvId: item?.id || null,
      relation: {
        designId: item?.attrs?.designId || relation?.designId || null,
        workId: item?.attrs?.workId || relation?.workId || null,
        threadId,
        chainId,
        rootDvId,
        parentDvId: item?.id || null,
      },
      sourceRefs: [{ id: productId, kind: String(item?.kind || "mt:producto") }],
      participants: [String(localBuyerActor.id), String(sellerId)],
      fromActorId: String(localBuyerActor.id),
      fromActorName: String(localBuyerActor.name || "Persona compradora"),
      toActorId: String(sellerId),
      message: `Consulta por ${nombre}`,
      text: `Consulta por ${nombre}`,
      status: "open",
    },
    traits: ["mt:consult", "mt:market", "mt:intent", "utopy:chain", `seller:${sellerId}`],
    meta: {
      ns: item?.meta?.ns || "mt:market",
      ts: new Date().toISOString(),
      source: "market.product.card",
      imageUrl,
      storeId: sellerId,
      storeName: sellerName,
      threadId,
      chainId,
      rootDvId,
      parentDvId: item?.id || null,
      scopes: ["participants"],
      product: item,
    },
  };

  await upsertAndPublishDV(dv);
  setInboxThreadId(threadId);
  setThreadViewerId(threadId);
  setThreadViewerMode("buyer");
  setThreadViewerOpen(true);
}

async function solicitarFabricacion(item: any) {
  if (!localBuyerActor?.id) return;
  const nombre =
    item?.attrs?.nombre || item?.nombre || item?.meta?.name || "diseño";
  const sellerNodeId =
    item?.attrs?.author?.nodeId ||
    item?.attrs?.source?.nodeId ||
    item?.meta?.originNode ||
    null;
  const sellerActorId =
    item?.attrs?.author?.id ||
    item?.attrs?.sellerId ||
    item?.attrs?.storeId ||
    item?.meta?.seller?.id ||
    null;
  const buyerActorId = String(localBuyerActor.id);
  const location = await requestApproximateBrowserLocation();
  const signal = buildLinkedWorkIntentDV({
    text: `Quiero fabricar o adaptar ${nombre}. Necesito una propuesta clara de fabricación, materiales, tiempo y entrega.`,
    actorId: String(localBuyerActor.id),
    actorName: String(localBuyerActor.name || "Persona compradora"),
    nodeId: String(localBuyerActor?.nodeId || "") || null,
    threadId: resolveProductThreadId(item),
    chainId:
      item?.attrs?.chainId ||
      item?.meta?.chainId ||
      item?.attrs?.relation?.chainId ||
      null,
    sourceDV: item,
    sourceActionId: item?.id || null,
    title: `Fabricar · ${nombre}`,
    domain: item?.attrs?.workDomain || item?.attrs?.domain || "furniture",
    quantity: 1,
    unit: "job",
    location,
    scopes: ["public"],
  });

  signal.attrs = {
    ...(signal.attrs || {}),
    productId: item?.id || null,
    sourceKind: String(item?.kind || "mt:producto"),
    source: {
      ...(item?.attrs?.source || {}),
      id: item?.id || null,
      kind: String(item?.kind || "mt:producto"),
      sceneId:
        item?.attrs?.source?.sceneId || item?.attrs?.sceneId || null,
      designId:
        item?.attrs?.designId || item?.attrs?.relation?.designId || null,
    },
    context: {
      sceneId:
        item?.attrs?.source?.sceneId || item?.attrs?.sceneId || null,
    },
    category: "fabrication",
    sellerId: sellerActorId,
    toActorId: sellerActorId,
    participants: Array.from(
      new Set([buyerActorId, sellerActorId].filter(Boolean).map(String)),
    ),
    unreadBy: sellerActorId ? [String(sellerActorId)] : [],
    target:
      sellerNodeId || sellerActorId
        ? { nodeId: sellerNodeId, actorId: sellerActorId }
        : null,
    requestedCapabilities: Array.from(
      new Set([
        ...((signal.attrs?.requestedCapabilities || []) as string[]),
        "Fabricar a partir de un diseño MO",
        "Preparar materiales y presupuesto",
        "Coordinar entrega o instalación",
      ]),
    ),
  };
  signal.traits = Array.from(
    new Set([
      ...(signal.traits || []),
      "mo:fabrication.request",
      "circular:demand",
      "map:visible",
    ]),
  );

  await upsertAndPublishDV(signal);
  const threadId = String(signal?.attrs?.threadId || signal?.meta?.threadId || "");
  setInboxThreadId(threadId || null);
  openCircular("mapa");
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

  const canonicalCheckoutProduct = universalProductToCheckoutProduct(projectUniversalProduct(p));
  const nextProduct: MtProduct = {
    ...canonicalCheckoutProduct,
    meta: {
      ...(canonicalCheckoutProduct.meta || p.meta || {}),
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


async function handleConsultarDirecto(item: any) {
  const whatsappUrl = buildWhatsappConsultUrl(item);

  if (!whatsappUrl) {
    await solicitarPorUtopy(item);
    return;
  }

  const title =
    item?.attrs?.nombre ||
    item?.nombre ||
    item?.meta?.name ||
    "Producto";

  const seller = getProductSellerName(item);

  // En tótem NO salir de la página
  if (kioskMode) {
    await solicitarPorUtopy(item);

  setKioskConsult({
  title,
  seller,
  whatsappUrl,
  imageUrl: getProductImageUrl(item),
  productId: String(item?.id || ""),
});

    return;
  }

  // En celular/PC normal sí abrir WhatsApp
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}
const ensureOrderVisibleForCajero = async (payload: any) => {
  const orderId = String(payload?.orderId || "").trim();
  const threadId = String(payload?.threadId || "").trim();

  if (!orderId || !threadId) return;

  const buyerId =
    String(payload?.buyerId || localBuyerActor?.id || "").trim();

  if (!buyerId) return;

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
// El descuento/cierre automático de stock se desactiva en la UI.
// Debe ejecutarlo el nodo propietario o un runtime idempotente del servidor.
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
    const product = resolveProductRoute(routeProducts, productId) as MtProduct | null;
    if (!product) return;

    const humanPath = productPath(product, routeProducts);
    if (location.pathname !== humanPath && /[:%]/.test(productId)) navigate(humanPath, { replace: true });

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
  routeProducts,
  offers,
]);
  const abrirAr = (p: MtProduct) => {
    setArProduct(p);
    setArOpen(true);
  };
  const allLiveClean = useMemo(
  () => (allLive || []).filter((dv: any) => !isExplodedMoPackDV(dv)),
  [allLive]
);

const allDvClean = allLiveClean;



const enrichedReplyOffer = useMemo(() => {
  if (!replyOffer) return null;
  return buildEnrichedOfferForAction(replyOffer, products);
}, [replyOffer, products]);

const [identityContext, setIdentityContext] = useState<CurrentIdentityContext | null>(null);
const [spaceNavigation, updateSpaceNavigation] = useLivingSpaceNavigation(identityContext?.actorId || "");
useEffect(() => {
  let mounted = true;
  void resolveCurrentIdentityContext({ allLive, activeActor: activeCajero })
    .then((next) => {
      if (mounted) setIdentityContext(next);
      if (mounted) mtLiveSetAccessContext({ actorId: next.actorId, nodeId: next.actingAsNodeId || undefined });
    })
    .catch(() => {
      if (mounted) { setIdentityContext(null); mtLiveSetAccessContext(null); }
    });
  return () => {
    mounted = false;
  };
}, [allLive, activeCajero]);

const localBuyerActor = useMemo(
  () => identityContext
    ? {
        id: identityContext.actorId,
        actorId: identityContext.actorId,
        name: identityContext.displayName || "Persona",
        role: "buyer",
        nodeId: identityContext.actingAsNodeId || identityContext.nodeId || null,
      }
    : null,
  [identityContext],
);
const myLiveProfile = useMemo(() => {
  const profiles = projectLiveProfiles(allLive);
  const actorId = String(localBuyerActor?.id || "");
  const nodeId = String(localBuyerActor?.nodeId || "");
  return profiles.find((profile) =>
    (actorId && profile.actorId === actorId) ||
    (nodeId && profile.nodeId === nodeId)
  ) || null;
}, [allLive, localBuyerActor]);
const openMyLiveProfile = () => {
  setProfileQuickOpen(true);
};
useEffect(()=>{const params=new URLSearchParams(location.search);if(params.get('account')!=='1')return;setProfileQuickOpen(true);params.delete('account');navigate({pathname:location.pathname,search:params.toString()?`?${params}`:''},{replace:true,state:location.state});},[location.pathname,location.search,navigate]);
const territorialFeedProducts = useMemo(() => {
  if (territorialMode === "explore") return displayedProducts;
  const need = myLiveProfile?.source || localBuyerActor;
  const territory = String((need as any)?.attrs?.territoryId || (need as any)?.attrs?.territory?.id || "");
  if (!geoPoint(need) && !territory) return displayedProducts;
  const scored = displayedProducts.map((product) => ({ product, relation: canRelate({ need, capability: product, mode: territorialMode }) }));
  const recommended = scored.filter((entry) => entry.relation.recommended);
  if (!recommended.length) return displayedProducts;
  return recommended.sort((left, right) => Number(left.relation.distanceKm ?? Infinity) - Number(right.relation.distanceKm ?? Infinity)).map((entry) => entry.product);
}, [displayedProducts, localBuyerActor, myLiveProfile, territorialMode]);

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
      k === "market.order.event" ||
      k === "work.intent" ||
      k === "work.plan" ||
      k === "work.execution" ||
      k === "work.outcome" ||
      k === "mo.fabrication.pack" ||
      k === "resonance.response" ||
      k === "match.proposal" ||
      k === "payment.outcome" ||
      k === "delivery.outcome" ||
      k === "trust.proof" ||
      k === "value.proof"
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
  const livingFeedItems = useMemo(() => {
    const categoryOf = (product: any) => [
      product?.meta?.cat,
      product?.meta?.category,
      ...(product?.meta?.categorias || []),
      ...(Array.isArray(product?.meta?.categories) ? product.meta.categories : []),
      product?.categoria,
      ...(product?.categorias || []),
      product?.attrs?.category,
      product?.attrs?.categoria,
      ...(product?.attrs?.categories || []),
      ...(product?.attrs?.categorias || []),
      ...(product?.tags || []),
      ...(product?.attrs?.tags || []),
      product?.kind,
      ...(product?.traits || []),
    ].filter(Boolean).join(" ");
    const leadProducts = territoryMode?displayedProducts:territorialFeedProducts;
    const foodProducts = territorialFeedProducts.filter((product: any) => isFoodLivingCategory(categoryOf(product))).slice(0, 8);
    const selectedProducts = Array.from(new Map([...leadProducts, ...foodProducts].map((product: any) => [String(product.id), product])).values());
    const productItems = selectedProducts.map((product: any) => {
    const merchandising = readPublishedMerchandising(product);
    const view = projectUniversalProduct(product, {
      title: product?.nombre,
      seller: getProductSellerName(product, allLive),
      image: getProductImageUrl(product, allLive),
    });
    return {
      id: String(product?.id || ""), title: view.title, seller: view.seller, sellerNodeId: view.sellerNodeId, image: view.image,
      price: formatUniversalMoney(view.finalPrice, view.currency),
      previousPrice: view.basePrice ? formatUniversalMoney(view.basePrice, view.currency) : null,
      badge: merchandising.discountPct ? `-${merchandising.discountPct}%` : null,
      category: categoryOf(product),
      catalogCategory: String(product?.attrs?.category || product?.attrs?.categoria || product?.categoria || product?.meta?.category || product?.meta?.cat || ''),
      financeAvailable: Boolean(merchandising.installmentCount || product?.creditEnabled || product?.attrs?.creditEnabled),
      available: product?.available !== false && product?.attrs?.available !== false,
      raw: product,
    };
    });
    const housingItems = projectRentalProperties(allLive).filter((property) => property.availableRooms > 0).map((property) => {
      const offer=allLive.find(dv=>dv.kind==='rental.offer'&&dv.attrs?.propertyId===property.id);
      const nodeId=String(property.sellerNodeId||property.ownerNodeId||offer?.attrs?.sellerNodeId||'');
      const manifest=allLive.find(dv=>/node\.manifest$/.test(String(dv.kind))&&String(dv.attrs?.nodeId||dv.attrs?.node?.id||dv.id)===nodeId);
      return {
      id: String(property.id), title: String(property.name || "Propiedad"), seller: String(manifest?.attrs?.name||manifest?.attrs?.node?.name||property.nodeName||property.name||'Vivienda'),
      sellerNodeId: nodeId,
      image: property.image || property.photos?.[0] || "",
      price: rentalDisplayPrice(property.rooms, property.price, property.currency),
      previousPrice: null, badge: null, category: "vivienda alquiler rental property",
      catalogCategory:String(property.propertyType||property.tipo||''),
      financeAvailable: false, available: true, raw: property,
    };});
    return [...productItems, ...housingItems];
  }, [territorialFeedProducts, displayedProducts, territoryMode, allLive]);
  const livingActivityCount = useMemo(() => {
    const actorId = String(localBuyerActor?.id || "");
    if (!actorId) return 0;
    return allLive.filter((dv: any) => /order|pedido|conversation|message|contract|finance|delivery|work/i.test(String(dv?.kind || "")) && [dv?.attrs?.actorId, dv?.attrs?.buyerActorId, dv?.attrs?.holderActorId, dv?.attrs?.tenantActorId].some((value) => String(value || "") === actorId)).length;
  }, [allLive, localBuyerActor?.id]);
  const restoredMarketScrollRef = useRef(false);
  useEffect(() => {
    const scrollY = Number((location.state as any)?.restoreScrollY);
    if (restoredMarketScrollRef.current || !Number.isFinite(scrollY) || scrollY <= 0) return;
    if (!livingFeedItems.length && syncState !== "offline") return;
    restoredMarketScrollRef.current = true;
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior })));
    return () => window.cancelAnimationFrame(frame);
  }, [location.state, livingFeedItems.length, syncState]);
  return (
    <Page className={territoryMode?'mt-territory-root':undefined} style={{ "--market-header-height": `${headerHeight}px` } as React.CSSProperties}>
      {/* ✅ Header compacto */}
      <TopBar ref={headerRef}>
        <TopInner>
         <Brand type="button" aria-label="Volver al inicio de MS Market" onClick={() => selectMainTab("mercado")}>
  <BrandEyebrow>UTOPÝ</BrandEyebrow>
  <BrandTitle>{territoryMode?'MT':'MS MARKET'}</BrandTitle>
</Brand>
          {tab !== "circular" && tab !== "mercado" ? <HeaderSearch type="button" onClick={() => openLivingSpace("map")} aria-label="Buscar productos, tiendas o servicios"><Search/><span>Buscar productos, tiendas o servicios</span></HeaderSearch> : null}
          <RightTools>
  <HeaderMore><summary aria-label="Más herramientas">⋯</summary><div><label>Red y catálogo
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
  </label>
  <HeaderIndicators>
    {activeCajero ? <HeaderIndicator title={`Caja: ${activeCajero.nombre}`}><StatusDot s={status} /> Caja</HeaderIndicator> : null}
  </HeaderIndicators>

  <IconGhostBtn onClick={() => openLivingSpace("orbit")} title="Expresar una intención" aria-label="Expresar una intención"><Mic /></IconGhostBtn>

 <IconGhostBtn
  onClick={() => setFrequencyOpen(true)}
  title="Frecuencia"
  aria-label="Abrir Frecuencia Viva"
  aria-pressed={frequencyOpen}
  className={[
    "frequency-button",
    frequencyEnabled ? "frequency-enabled" : "",
    frequencyHasActive ? "frequency-active" : "",
    frequencyMode === "silent" ? "frequency-silent" : "",
    frequencyPulse ? "frequency-pulse" : "",
  ].filter(Boolean).join(" ")}
 >
  <span className="frequency-glyph" aria-hidden="true">⌁</span>
 </IconGhostBtn>
  </div></HeaderMore>
  <PillBtn onClick={() => setCartOpen(true)} aria-label="Abrir carrito" title="Carrito">
    <ShoppingCart />
  </PillBtn>
  <IconGhostBtn onClick={() => setProfileQuickOpen(true)} title="Mi identidad UTOPY" aria-label="Abrir Perfil Vivo" style={{ borderRadius:"50%",background:"#eee6ff",border:"2px solid #fff",boxShadow:"0 0 0 1px #e6def1",overflow:"hidden" }}>
    {myLiveProfile?.avatar ? <img src={myLiveProfile.avatar} alt="" loading="eager" decoding="async" style={{ width:34,height:34,borderRadius:"50%",objectFit:"cover" }}/> : <UserRound/>}
  </IconGhostBtn>
</RightTools>
        </TopInner>
<DesktopTabsRow>
  <DesktopTabBtn active={tab === "mercado"} onClick={() => selectMainTab("mercado")}>
    <TabWrap>Inicio</TabWrap>
  </DesktopTabBtn>


  <DesktopTabBtn
    active={tab === "categorias"}
    onClick={() => territoryMode?selectMainTab("mercado"):openLivingSpace("map")}
  >
    <TabWrap>Explorar</TabWrap>
  </DesktopTabBtn>

  <DesktopTabBtn active={tab === "crear"} onClick={() => selectMainTab("producir")}>
    <TabWrap>
      Crear
    </TabWrap>
  </DesktopTabBtn>

  <DesktopTabBtn
    active={tab === "mis_pedidos"}
    onClick={() => selectMainTab("mis_pedidos")}
  >
    <TabWrap>
      Actividad
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

      <Content data-living-space={tab === "circular" ? spaceNavigation.projection : "feed"}>
        {tab === "crear" ? <Suspense fallback={<p>Abriendo tu espacio para crear…</p>}><LivingCreationWorkspace allLive={allLive} activeActor={identityContext || localBuyerActor} initialText={spaceNavigation.query} onDraftTextChange={query => updateSpaceNavigation({ query })} contextRef={new URLSearchParams(location.search).get("createWith") || spaceNavigation.selectedRef} onActivity={section => { setActivityOperational(true); setProduceView(section); setTab("mis_pedidos"); navigate(`/market?tab=mis_pedidos&section=${section}`); }} onExplore={reference => { if (reference) updateSpaceNavigation({ selectedRef: reference }); openLivingSpace("map"); }} onChat={() => setConversationsOpen(true)} onOpenThread={openThreadGlobal} advanced={<ProducirPanel currentCajero={activeCajero}/>} /></Suspense> : null}
        {tab !== "circular" && ["mis_pedidos", "producir"].includes(surfaceTab) ? <section className="utopy-ui utopy-card" style={{marginBottom:16}}><h2>Tu actividad</h2><p className="utopy-muted">Compras, conversaciones y trabajo, en un solo lugar.</p><nav className="utopy-activity-nav" aria-label="Actividad"><button className="utopy-button" type="button" aria-pressed={!activityOperational} onClick={() => { setActivityOperational(false); navigate("/market?tab=mis_pedidos"); }}>Mis compras</button>{activeCajero || identityContext?.actingAsNodeId || identityContext?.authorizations?.length ? <button className="utopy-button" type="button" aria-pressed={activityOperational} onClick={() => { setActivityOperational(true); navigate("/market?tab=mis_pedidos&section=trabajos"); }}>Trabajo y gestión de mi nodo</button> : null}<button className="utopy-button" type="button" onClick={() => setConversationsOpen(true)}>Chat Directo</button></nav></section> : null}
        {tab === "mercado" && (
          <Section>
            <UnifiedLivingMarket
              items={livingFeedItems}
              catalogStatus={syncState}
              territoryMode={territoryMode}
              onValue={()=>{setProfileInitialSpace('value');setProfileQuickOpen(true);}}
              onChat={()=>setConversationsOpen(true)}
              actorId={identityContext?.actorId || ""}
              allLive={allLive}
              highlights={<LivingHighlights allLive={allLive} actor={localBuyerActor} syncing={syncState === "syncing"} />}
              onProjection={(projection) => projection === "feed" ? closeCircular() : openLivingSpace(projection)}
              activityCount={livingActivityCount}
              onOpenItem={(item) => {
                if (Array.isArray(item?.rooms)) {
                  const returnTo = `${location.pathname}${location.search}${location.hash}`;
                  const scrollY = window.scrollY;
                  sessionStorage.setItem("utopy.market.return", JSON.stringify({ returnTo, scrollY }));
                  navigate(`/falcon/skylines/propiedad/${encodeURIComponent(String(item.id))}`, { state: { returnTo, scrollY } });
                  return;
                }
                openProductRoute(item); setPublicProduct(item); setPublicOffer(null);
              }}
              onOpenNode={(item, seller) => {
                const handle = profileHandleForIdentity(item, seller);
                navigate(`/${handle}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } });
              }}
              onSearch={() => openLivingSpace("map")}
              onExplore={() => openLivingSpace("map")}
              onExploreFar={() => { setTerritorialMode("explore"); selectMainTab("categorias"); }}
              onOffers={() => selectMainTab("ofertas")}
              onCreate={() => selectMainTab("producir")}
              onTerritory={setTerritorialMode}
              onContext={(context) => {
                const returnTo = `${location.pathname}${location.search}${location.hash}`;
                const scrollY = window.scrollY;
                sessionStorage.setItem("utopy.market.return", JSON.stringify({ returnTo, scrollY }));
                navigate(`/falcon/${context}`, { state: { returnTo, scrollY } });
              }}
            />
            {!displayedProducts.length ? <div className="mt-6 rounded-[24px] bg-white p-6 text-center text-sm text-slate-600"><b>{syncState === "offline" ? "Todavía no hay contenido guardado" : "Descubriendo la red…"}</b><p className="mt-2">{syncState === "offline" ? "Volvé a intentarlo cuando tengas conexión." : "Las novedades aparecerán acá."}</p><button type="button" onClick={refresh} className="mt-3 rounded-full bg-slate-950 px-4 py-2 font-bold text-white">Actualizar</button></div> : null}
          </Section>
        )}
        {tab === "circular" && (
  <LivingSpaceLayer role="region" aria-label="Explorar tu espacio vivo">
  <Suspense fallback={<CircularLoading><span>🗺️</span><b>Abriendo Mapa Vivo…</b></CircularLoading>}>
  <CircularCenter
    allLive={allLive}
    initialProjection={spaceNavigation.projection}
    onCreate={() => openCircular("publicar")}
    activeCajero={activeCajero}
    setTab={setTab}
    setInboxThreadId={setInboxThreadId}
    initialView={circularInitialView}
    onExit={closeCircular}
    onOpenThread={(threadId) => openThreadGlobal(threadId, "cajero")}
    onOfferMaterial={(cluster) => {
      if (import.meta.env.DEV) console.debug("ofertar material", cluster);
    }}
    onOpenMO={(payload) => {
      if (import.meta.env.DEV) console.debug("abrir en MO", payload);
    }}
    purchaseContext={circularPurchaseContext}
    onContinuePurchase={() => closeCircular()}
    onOpenProduct={(raw) => {
      const product = products.find((candidate: any) => String(candidate?.id) === String(raw?.id));
      if (!product) return;
      openProductRoute(product);
      setPublicProduct(product);
      setPublicOffer(null);
    }}
  />
  </Suspense>
  </LivingSpaceLayer>
)}
        {surfaceTab === "categorias" && (
          <CategoriasPanel
              products={visibleProducts}
              allLive={allLive}
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
              onOpenProduct={(product) => {
                openProductRoute(product);
                setPublicProduct(product);
                setPublicOffer(null);
              }}
            />
        )}

       {surfaceTab === "ofertas" && (
  <>
    <MODesignOfferSection allLive={allLive} />
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-950">Ofertas</h2>
        <p className="text-sm text-slate-500">Oportunidades vivas de la red</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setOfferView("all")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${offerView === "all" ? "border-cyan-300 bg-cyan-100" : "border-slate-200 bg-white"}`}>Para vos</button>
        {visibleOffers.some((offer: any) => offer?.tipo !== "compra") ? <button type="button" onClick={() => setOfferView("sell")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${offerView === "sell" ? "border-cyan-300 bg-cyan-100" : "border-slate-200 bg-white"}`}>Productos</button> : null}
        {visibleOffers.some((offer: any) => offer?.tipo === "compra") ? <button type="button" onClick={() => setOfferView("buy")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${offerView === "buy" ? "border-cyan-300 bg-cyan-100" : "border-slate-200 bg-white"}`}>Buscan</button> : null}
      </div>

      {displayOffers.length ? (
        <section className="space-y-3">
          <h3 className="text-lg font-black text-slate-950">✨ Para vos</h3>
          <OfferGrid>
            {displayOffers.filter((offer: any) => !isExplodedMoPackDV(offer)).map((offer) => {
              const linkedProduct = products.find((product) => String(product.id) === String(offer.productoId));
              const title =
                (offer as any)?.title ||
                (offer as any)?.attrs?.title ||
                (offer as any)?.attrs?.nombre ||
                linkedProduct?.nombre ||
                (offer.tipo === "compra" ? "Necesitan un producto" : "Producto disponible");
              const seller = resolveLiveSeller(offer, allLive);
              const image = resolveLiveImage(offer, allLive) || getOfferImage(offer) || (linkedProduct ? getProductImageUrl(linkedProduct, allLive) : "");
              const hasResponse = tradeMessages.some((event: any) =>
                String(event?.attrs?.offerId || event?.attrs?.respondsTo || "") === String(offer.id),
              );
              const open = () => {
                if (offer.tipo !== "compra") {
                  navigate(offerPath(offer.id));
                  setPublicOffer(offer);
                  setPublicProduct(null);
                  return;
                }
                const enriched = buildEnrichedOfferForAction(offer, products);
                const threadId =
                  (enriched as any)?.attrs?.contact?.threadId ||
                  (enriched as any)?.meta?.threadId ||
                  resolveOfferThreadId(enriched);
                setReplyOffer(enriched);
                setInboxThreadId(threadId);
                setReplyOpen(true);
              };

              return (
                <LiveOfferCard
                  key={offer.id}
                  title={String(title)}
                  seller={seller !== "Nodo vendedor" ? seller : undefined}
                  sellerIdentity={offer}
                  meta={`${Number(offer.cantidad || 1).toLocaleString("es-PY")} ${Number(offer.cantidad || 1) === 1 ? "unidad" : "unidades"}`}
                  image={image}
                  icon={offer.tipo === "compra" ? "🤝" : "🛍️"}
                  eyebrow={offer.tipo === "compra" ? "Buscan" : "Producto"}
                  actionLabel={hasResponse ? "Conversación" : offer.tipo === "compra" ? "Me interesa" : "Ver"}
                  live={hasResponse}
                  onAction={open}
                />
              );
            })}
          </OfferGrid>
        </section>
      ) : (
        !hasVisibleMoDesigns ? <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-500">No hay ofertas en esta selección.</div> : null
      )}
    </div>

    <div style={{ height: 14 }} />

    <FabricaVivaPanel
      allDv={allDvClean}
      nsFilter={nsFilter}
      activeCajero={activeCajero}
      setInboxThreadId={setInboxThreadId}
      setTab={setTab}
      Section={OfferSubsection}
      Grid={OfferGrid}
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
      {(surfaceTab === "producir" || (surfaceTab === "mis_pedidos" && activityOperational)) && (
  <Section className="utopy-ui utopy-operations">
    <ProduceHeader>
      <ProduceTitle>Centro de producción</ProduceTitle>
      <ProduceSub>
        Tu taller de trabajo: pedidos, conversaciones, cola productiva y seguimiento.
      </ProduceSub>
    </ProduceHeader>

    <ProduceModeBar>
      <ProduceModeBtn
        active={produceView === "trabajos"}
        onClick={() => { setProduceView("trabajos"); navigate("/market?tab=mis_pedidos&section=trabajos"); }}
      >
        <ProduceModeIcon>🧰</ProduceModeIcon>
        <ProduceModeTitle>Trabajos</ProduceModeTitle>
        <ProduceModeSub>Abrir, asignar y producir</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "conversaciones"}
        onClick={() => { setProduceView("conversaciones"); navigate("/market?tab=mis_pedidos&section=conversaciones"); }}
      >
        <ProduceModeIcon>💬</ProduceModeIcon>
        <ProduceModeTitle>Conversaciones</ProduceModeTitle>
        <ProduceModeSub>Hablar por hilo vivo</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "pedidos"}
        onClick={() => { setProduceView("pedidos"); navigate("/market?tab=mis_pedidos&section=pedidos"); }}
      >
        <ProduceModeIcon>📦</ProduceModeIcon>
        <ProduceModeTitle>Pedidos</ProduceModeTitle>
        <ProduceModeSub>Cobro, entrega y estado</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "publicar"}
        onClick={() => { setProduceView("publicar"); navigate("/market?tab=mis_pedidos&section=publicar"); }}
      >
        <ProduceModeIcon>✨</ProduceModeIcon>
        <ProduceModeTitle>Publicar</ProduceModeTitle>
        <ProduceModeSub>Producto, oferta o producción</ProduceModeSub>
      </ProduceModeBtn>

      <ProduceModeBtn
        active={produceView === "caja"}
        onClick={() => { setProduceView("caja"); navigate("/market?tab=mis_pedidos&section=caja"); }}
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
                <ProduceBlockTitle>🧰 Trabajos · Para vos</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Oportunidades que tu nodo puede ver; solo puede tomar las compatibles con sus capacidades.
              </ProduceBlockSub>
              <ProduceDivider />

              <WorkInboxPanel
                allLive={allLiveClean}
                actorId={identityContext?.actorId || null}
                actorName={identityContext?.displayName || activeCajero?.nombre || null}
                nodeId={identityContext?.actingAsNodeId || identityContext?.nodeId || null}
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
                Trabajos que ya aceptaste, ordenados por su estado real.
              </ProduceBlockSub>
              <ProduceDivider />

              <Suspense fallback={<p>Abriendo tu cola de trabajo…</p>}><ProductionQueueWorkspace
                allLive={allLiveClean}
                preferredNodeId={identityContext?.actingAsNodeId || identityContext?.nodeId || null}
                onOpenThread={openProductionThread}
                legacyQueue={<ProducerQueuePanel
                allLive={allLiveClean}
                actorId={identityContext?.actorId || null}
                actorName={identityContext?.displayName || null}
                nodeId={identityContext?.actingAsNodeId || identityContext?.nodeId || null}
                orgId={activeCajero?.orgId || null}
                territoryId={activeCajero?.territorioId || null}
                hideOpen
                onOpenThread={(threadId) => openProductionThread(threadId)}
              />}/></Suspense>
            </ProduceBlock>
          </ProduceCard>

          <ProduceCard>
            <ProduceBlock>
              <ProduceBlockHead>
                <ProduceBlockTitle>🛰️ Radar de fábrica</ProduceBlockTitle>
              </ProduceBlockHead>
              <ProduceBlockSub>
                Necesidades relacionadas agrupadas para descubrir dónde podés ayudar.
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
              <div style={{ fontWeight: 950 }}>Tus conversaciones, en un solo lugar</div>
              <div style={{ opacity: 0.72, fontSize: "0.9rem" }}>
                Podés abrir un trabajo para ver su hilo o entrar a todas tus conversaciones.
              </div>
              <button type="button" className="mt-3 min-h-11 rounded-full border bg-white px-5 font-bold" onClick={() => setConversationsOpen(true)}>Abrir conversaciones</button>
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

          {!activeCajero ? <EmptySoftBox><b>¿Son tus compras o pedidos que recibís?</b><p>Las compras están en Mis pedidos. Para atender ventas, elegí una caja de tu Nodo.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-full bg-slate-950 px-4 font-bold text-white" onClick={() => selectMainTab("mis_pedidos")}>Mis compras</button><button type="button" className="min-h-11 rounded-full border bg-white px-4 font-bold" onClick={() => setProduceView("caja")}>Elegir caja para atender</button></div></EmptySoftBox> : <CajeroPedidosPanel
            activeCajero={activeCajero}
            onOpenThread={(threadId) => openProductionThread(threadId)}
          />}
        </ProduceBlock>
      </ProduceCard>
    )}

    {produceView === "publicar" && (
      <ProduceCard>
        <ProduceBlock>
          <ProduceBlockHead>
            <ProduceBlockTitle>✨ Crear una publicación</ProduceBlockTitle>
          </ProduceBlockHead>
          <ProduceBlockSub>
            Producto, oferta, demanda o producción.
          </ProduceBlockSub>
          <ProduceDivider />

          <Suspense fallback={<p>Abriendo creación…</p>}><LiveNetworkPanel allLive={allLive} activeActor={localBuyerActor} initialView="publish" minimalEmbed onOpenThread={openThreadGlobal}/></Suspense>
          <details className="utopy-ui mt-4"><summary className="utopy-button">Publicación técnica y producción avanzada</summary><ProducirPanel currentCajero={activeCajero} /></details>
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
              <div className="mb-4 grid gap-2"><button type="button" className="min-h-11 rounded-2xl border bg-white px-4 text-left font-bold" onClick={() => { setOperationalPanelSection("overview"); setOperationalPanelOpen(true); }}>Administrar mi Nodo y permisos</button><button type="button" className="min-h-11 rounded-2xl border bg-white px-4 text-left font-bold" onClick={() => { setOperationalPanelSection("automations"); setOperationalPanelOpen(true); }}>Automatizaciones del Nodo</button><p className="text-xs text-slate-500">Elegí un Nodo autorizado para ver sus módulos, Pass y automatizaciones.</p></div>

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
        title={inboxThreadId ? "Conversación del pedido" : "Conversaciones"}
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

        <CajeroAuthPanel activeCajero={activeCajero} allLive={allLive} />
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
{surfaceTab === "mis_pedidos" && !activityOperational && (
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
{operationalPanelOpen ? <Suspense fallback={null}><NodeOperationPanel open allLive={allLive} activeActor={localBuyerActor} initialSection={operationalPanelSection} onClose={() => setOperationalPanelOpen(false)} /></Suspense> : null}
{/* ✅ Bottom nav glass minimalista */}
<BottomNav>
  <BottomInner>
    <NavBtn
      active={tab === "mercado"}
      onClick={() => selectMainTab("mercado")}
      aria-label="Inicio"
    >
      <NavIcon><Home /></NavIcon><span>Inicio</span>
    </NavBtn>
    <NavBtn
      active={tab === "categorias" || tab === "ofertas"}
      onClick={() => territoryMode?selectMainTab("mercado"):openLivingSpace("map")}
      aria-label={territoryMode?'Descubrir posibilidades':'Explorar'}
    >
      <NavIcon><Compass /></NavIcon><span>Explorar</span>
    </NavBtn>
    <NavBtn
      active={tab === "crear"}
      onClick={() => selectMainTab("producir")}
      aria-label="Crear"
    >
      <NavIcon><CirclePlus /></NavIcon><span>Crear</span>
    </NavBtn>
    <NavBtn
      active={tab === "mis_pedidos"}
      onClick={() => selectMainTab("mis_pedidos")}
      aria-label="Actividad"
    >
      <NavIcon><Activity /></NavIcon><span>Actividad</span>
    </NavBtn>
    <NavBtn active={profileQuickOpen} onClick={() => setProfileQuickOpen(true)} aria-label="Mi identidad UTOPY"><NavIcon><UserRound/></NavIcon><span>Perfil</span></NavBtn>
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
  products={routeProducts as MtProduct[]}
  onClose={() => {
    const productOrigin = publicProduct ? readProductOrigin(publicProduct, routeProducts, true) : null;
    setPublicProduct(null);
    setPublicOffer(null);

    if (
      location.pathname.startsWith("/producto/") ||
      location.pathname.startsWith("/oferta/") ||
      location.pathname.startsWith("/market/producto/") ||
      location.pathname.startsWith("/market/oferta/")
    ) {
      navigate(productOrigin?.route || "/market", { replace: true });
      if (productOrigin) window.requestAnimationFrame(() => window.scrollTo({ top: productOrigin.scrollY, behavior: "instant" as ScrollBehavior }));
    }
  }}
  onShare={() => {
    const path = publicOffer
      ? offerPath(publicOffer.id)
      : publicProduct
      ? productPath(publicProduct, routeProducts)
      : "/market";

    sharePublicLink(path, publicOffer ? getOfferTitle(publicOffer) : publicProduct?.nombre);
  }}
  onConsultProduct={async (p) => {
    setPublicProduct(null);
    setPublicOffer(null);
    await solicitarPorUtopy(p);
  }}
  onFabricateProduct={async (p) => {
    setPublicProduct(null);
    setPublicOffer(null);
    await solicitarFabricacion(p);
  }}
  onCheckoutProduct={(p) => {
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
  <Suspense fallback={null}>
  <CheckoutModal
  open={checkoutOpen}
  product={checkoutProd}
  activeCajero={activeCajero}
  onNeedCajero={() => setCajeroPickerOpen(true)}
  onOpenMap={(context) => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    try { window.sessionStorage.setItem("utopy.circular.purchaseContext", JSON.stringify({ context, returnTo, ts: Date.now() })); } catch {}
    setCircularPurchaseContext(context);
    setCheckoutOpen(false);
    openCircular("mapa", returnTo);
  }}
  onClose={() => {
  setCheckoutOpen(false);
  setCheckoutProd(null);
}}
onDone={async (payload) => {
  setCheckoutOpen(false);
  setCheckoutProd(null);

  if (payload?.threadId) {
    setInboxThreadId(payload.threadId);
  }

  if (payload?.orderId) {
    if (payload?.receiptId || payload?.invoiceId) {
      setLastCheckoutDocs(payload);
      setInvoiceCenterOpen(true);
    }
  }
}}
/>
  </Suspense>
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
      <FrequencyVivaModal
  open={frequencyOpen}
  allLive={allLive}
  activeActor={localBuyerActor}
  onClose={() => setFrequencyOpen(false)}
  onStateChange={({ enabled, mode, hasActiveFrequency }) => {
    setFrequencyEnabled(enabled);
    setFrequencyMode(mode);
    setFrequencyHasActive(hasActiveFrequency);
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
{kioskConsult && (
  <Portal>
    <PickerBackdrop onClick={() => setKioskConsult(null)}>
      <CheckoutModalBox
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: "1.15rem" }}>
          Consulta enviada al nodo ✅
        </div>

        <Subtle style={{ marginTop: 6 }}>
          Producto: {kioskConsult.title}
        </Subtle>
        {kioskConsult.imageUrl ? (
  <img
    src={kioskConsult.imageUrl}
    alt={kioskConsult.title}
    style={{
      width: "100%",
      maxWidth: 280,
      aspectRatio: "1 / 1",
      objectFit: "cover",
      borderRadius: 18,
      margin: "16px auto 0",
      display: "block",
      background: "#f2f2f2",
      border: "1px solid rgba(0,0,0,0.08)",
    }}
  />
) : null}

        <div style={{ marginTop: 12, fontWeight: 900 }}>
          Vendedor: {kioskConsult.seller}
        </div>

        <div
          style={{
            margin: "18px auto 0",
            width: 260,
            maxWidth: "100%",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: 12,
          }}
        >
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
              kioskConsult.whatsappUrl
            )}`}
            alt="QR WhatsApp"
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "contain",
            }}
          />
        </div>

        <Subtle style={{ marginTop: 12 }}>
          Escaneá este QR con tu celular para continuar por WhatsApp.
          El tótem no sale de la experiencia.
        </Subtle>

        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <SmallBtn onClick={() => setKioskConsult(null)}>
            Volver al catálogo
          </SmallBtn>
        </div>
      </CheckoutModalBox>
    </PickerBackdrop>
  </Portal>
)}
      <LivingProfileQuickView
        open={profileQuickOpen}
        initialSpace={profileInitialSpace}
        allLive={allLive}
        activeActor={localBuyerActor}
        target={myLiveProfile || identityContext || localBuyerActor}
        own
        onClose={() => {setProfileQuickOpen(false);setProfileInitialSpace('home');}}
        onSay={() => { setProfileQuickOpen(false); navigate("/market/mapa?view=publicar"); }}
        onEdit={() => { setProfileQuickOpen(false); navigate("/market?tab=circular&view=red&quick=profile"); }}
        onConversations={() => { setProfileQuickOpen(false); setConversationsOpen(true); }}
        onMap={() => { setProfileQuickOpen(false); navigate(`/market?tab=circular&view=mapa&focus=${encodeURIComponent(String(myLiveProfile?.id || localBuyerActor?.id || ""))}`); }}
        onFull={() => { const identity = myLiveProfile || identityContext || localBuyerActor; const handle = myLiveProfile?.handle || profileHandleForIdentity(identity, identityContext?.displayName || localBuyerActor?.name || "mi-perfil"); setProfileQuickOpen(false); navigate(`/${handle}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } }); }}
      />
      {conversationsOpen ? <GlobalConversationsModal open onClose={() => setConversationsOpen(false)} from="market" returnTo={`${location.pathname}${location.search}${location.hash}`} onOpenProfile={openMyLiveProfile} /> : null}
      <LiveSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        allLive={allLive}
        surface="market"
        initialQuery={networkSearchQuery}
        onSelect={(dv, kind) => {
          const id = encodeURIComponent(String(dv?.id || ""));
          if (kind === "profile") {
            navigate(`/${dv?.attrs?.handle}`);
          } else if (kind === "product") {
            const product = routeProducts.find((item) => String((item as any).id) === String(dv?.id)) as MtProduct | undefined;
            if (product) { setPublicProduct(product); setPublicOffer(null); }
            navigate(productPath(product || dv, routeProducts));
          } else if (kind === "property") {
            navigate("/falcon/skylines");
          } else {
            setTab("circular");
          }
        }}
      />
    </Page>
  );
}
const PickerBackdrop = styled(Backdrop)`
  z-index: 10050; /* mayor que el checkout */
`;
