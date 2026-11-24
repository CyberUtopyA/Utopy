import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import {
  X,
  MapPinned,
  Radar,
  Factory,
  Zap,
  Boxes,
  Satellite,
  GitBranch,
  Truck,
  Sprout,
  Users,
  LayoutGrid,
  Share2,
  Sparkles,
  ChevronLeft,
  Mic,
  Activity,
} from "lucide-react";

import CircularMapPanel from "./circularpanel";
import { mtLiveUpsert } from "../mt/mt.liveStore";
import { startContinuousResonator } from "../mt/mt.resonator";
import { startCircularChainRuntime } from "../mt/mt.circularChain";
import { resonateCircularDV } from "./circular.resonance";
import {
  resolveCurrentIdentityContext,
  type CurrentIdentityContext,
} from "../utopy/identityContext";
import { buildLiveContext } from "../social/liveNetwork.context";
import { livingGlass, LivingModalBackdrop } from "./circularModal";
import GlobalConversationsModal from "../components/GlobalConversationsModal";
import LivingHighlights from "../components/LivingHighlights";
import { projectLivingNodes } from "../utopy/livingNodeProjection";
import { humanCapability } from "../utopy/livingNodeUX";
import { useCircularAtmosphere } from "./useCircularAtmosphere";

const FactoryLiveRadar = lazy(() => import("../mt/factoryliveradar"));
const FabricaVivaPanel = lazy(() => import("../mt/fabricaviva"));
const CircularQuickPublishPanel = lazy(() => import("./circularquickpanel"));
const CircularChainPanel = lazy(() => import("./CircularChainPanel"));
const SymbioticSignalPanel = lazy(() => import("./SymbioticSignalPanel"));
const SupplyFalconPanel = lazy(() => import("./SupplyFalconPanel"));
const ValueContributionPanel = lazy(() => import("../value/ValueContributionPanel"));
const LiveNetworkPanel = lazy(() => import("../social/LiveNetworkPanel"));

type MarketTab =
  | "mercado"
  | "categorias"
  | "ofertas"
  | "mis_pedidos"
  | "producir"
  | "circular";

export type CircularWorldView =
  | "mapa"
  | "publicar"
  | "radar"
  | "fabrica"
  | "conectar"
  | "cadena"
  | "aportes"
  | "valor"
  | "mi_red"
  | "red";

type Props = {
  allLive: any[];
  activeCajero?: any | null;
  setTab: (tab: MarketTab) => void;
  setInboxThreadId: (threadId: string | null) => void;
  onOpenThread?: (threadId: string, cluster?: any) => void;
  onOfferMaterial?: (cluster: any) => void;
  initialView?: CircularWorldView;
  initialProjection?: "feed" | "orbit" | "map";
  onExit?: () => void;
  /** Compatibilidad anterior. La resonancia ya no depende de un nodo fijo. */
  onOpenMO?: (cluster: any) => void;
  purchaseContext?: any | null;
  onContinuePurchase?: (possibility?: any) => void;
  onOpenProduct?: (product: any) => void;
  onCreate?: () => void;
};

const SectionBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassSection>{children}</GlassSection>
);

const GridBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassGrid>{children}</GlassGrid>
);

const CardBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassCard>{children}</GlassCard>
);

const TitleBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassTitle>{children}</GlassTitle>
);

const SubtleBox = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) => <GlassSubtle style={style}>{children}</GlassSubtle>;

const ChipsBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassChips>{children}</GlassChips>
);

const ChipBox = ({
  children,
  tone = "neutral",
}: {
  children?: React.ReactNode;
  tone?: "ok" | "warn" | "neutral";
}) => <GlassChip $tone={tone}>{children}</GlassChip>;

const PriceBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassPrice>{children}</GlassPrice>
);

const ActionsBox = ({ children }: { children?: React.ReactNode }) => (
  <GlassActions>{children}</GlassActions>
);

const SmallBtnBox = ({
  children,
  tone = "primary",
  onClick,
  disabled,
}: {
  children?: React.ReactNode;
  tone?: "primary" | "ghost";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) => (
  <GlassSmallBtn
    type="button"
    onClick={onClick}
    disabled={disabled}
    $tone={tone}
  >
    {children}
  </GlassSmallBtn>
);

export default function CircularCenter({
  allLive,
  activeCajero,
  setTab,
  setInboxThreadId,
  onOpenThread,
  onOfferMaterial,
  initialView = "mapa",
  onCreate,
  initialProjection,
  onExit,
  purchaseContext,
  onContinuePurchase,
  onOpenProduct,
}: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<CircularWorldView>(initialView);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [activityRequestKey, setActivityRequestKey] = useState(0);
  const [focusedContextId, setFocusedContextId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<CurrentIdentityContext | null>(null);
  const actorId = identity?.actorId || "";
  const ownProfile = useMemo(() => actorId ? buildLiveContext(allLive, actorId).profile : null, [allLive, actorId]);
  const profileAvatar = String(ownProfile?.attrs?.avatar || ownProfile?.attrs?.avatarRef || "");
  const profileName = String(ownProfile?.attrs?.actorName || identity?.displayName || "Mi Perfil Vivo");
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || "U";
  const profileCapabilities = useMemo(() => (Array.isArray(ownProfile?.attrs?.capabilities) ? ownProfile.attrs.capabilities : [])
    .map((capability: any) => String(capability?.label || "").trim()).filter(Boolean).slice(0, 6), [ownProfile]);
  const contextualCapabilities = useMemo(() => projectLivingNodes(allLive).flatMap((node) => node.capabilities)
    .map((capability) => ({ label: humanCapability(capability), focusId: String(capability.source?.id || "") }))
    .filter((item) => item.label && item.focusId && !/(?:did:|mt:|namespace|[a-z]+(?:[._:][a-z0-9]+){2,})/i.test(item.label))
    .filter((item, index, items) => items.findIndex((other) => other.label === item.label) === index)
    .slice(0, 12), [allLive]);
  const publicPresence = useMemo(() => projectLivingNodes(allLive).find((node) => node.actorId === actorId)?.presence, [allLive, actorId]);
  const atmosphere = useCircularAtmosphere(publicPresence?.lat ?? null, publicPresence?.lng ?? null);

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) setFocusedContextId(focus);
  }, []);

  const contextualActor = useMemo(() => {
    if (!identity) return null;
    return {
      ...(activeCajero || {}),
      id: identity.actorId,
      actorId: identity.actorId,
      actorName: identity.displayName,
      name:
        activeCajero?.nombre ||
        activeCajero?.name ||
        identity.displayName,
      nombre:
        activeCajero?.nombre ||
        activeCajero?.name ||
        identity.displayName,
      cajeroId: identity.cajeroId,
      nodeId: identity.actingAsNodeId || null,
      authority: identity.authority,
      identityReady: true,
    };
  }, [identity, activeCajero]);

  useEffect(() => {
    let mounted = true;
    void resolveCurrentIdentityContext({
      allLive,
      activeActor: activeCajero,
      actingAsNodeId:
        activeCajero?.nodeId || activeCajero?.attrs?.nodeId || null,
    })
      .then((next) => {
        if (mounted) setIdentity(next);
      })
      .catch(() => {
        if (mounted) setIdentity(null);
      });
    return () => {
      mounted = false;
    };
  }, [allLive, activeCajero]);

  useEffect(() => {
    const stopResonator = startContinuousResonator();
    const stopChains = startCircularChainRuntime();

    return () => {
      stopResonator();
      stopChains();
    };
  }, []);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const chooseView = (next: CircularWorldView) => {
    if (next === "publicar" && onCreate) { onCreate(); return; }
    setView(next);
    setToolsOpen(false);
    setProfileOpen(false);
  };

  const closeActiveOverlay = () => {
    if (profileOpen) setProfileOpen(false);
    else if (toolsOpen) setToolsOpen(false);
    else if (view !== "mapa") chooseView("mapa");
  };

  useEffect(() => {
    if (!profileOpen && !toolsOpen && view === "mapa") return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeActiveOverlay(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [profileOpen, toolsOpen, view]);

  const shareMap = async () => {
    const url = new URL("/market/mapa", window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: "Mapa Vivo UTOPY", url });
      else { await navigator.clipboard.writeText(url); setShareMessage("Enlace copiado"); }
    } catch { /* La persona puede cancelar el diálogo de compartir. */ }
  };

  const resonatePoint = async (point: any) => {
    const sourceDv = point?.raw || point;
    if (!sourceDv || !identity?.actorId) return;

    const result = await resonateCircularDV({
      dv: sourceDv,
      actorId: identity.actorId,
      nodeId: identity.actingAsNodeId || null,
      liveDVs: allLive,
      publishDV: async (nextDv) => {
        mtLiveUpsert(nextDv as any);
      },
    });

    onOfferMaterial?.({ ...point, resonance: result });
    setView("radar");
  };

  const openThread = (threadId: string, payload?: any) => {
    setInboxThreadId(threadId);
    onOpenThread?.(threadId, payload);
    const params = new URLSearchParams({ from: "mapa", returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}` });
    navigate(`/conversacion/${encodeURIComponent(threadId)}?${params.toString()}`);
  };

  return (
    <World data-time={atmosphere.time} data-weather={atmosphere.weather}>
      <TopBar>
        <Brand aria-label="UTOPY Mapa Vivo"><BrandMark>U</BrandMark><span>UTOPY</span></Brand>
        <TopActions>
          <TopIcon type="button" onClick={() => setProfileOpen((open) => !open)} aria-label="Mi perfil" title="Mi perfil"><span>{profileInitial}</span>{profileAvatar ? <img src={profileAvatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</TopIcon>
        </TopActions>
      </TopBar>

      {profileOpen ? <ProfilePopover role="dialog" aria-label="Tu cuenta">
        <ModalHeader><b>Tu cuenta</b><button type="button" onClick={() => setProfileOpen(false)} aria-label="Cerrar"><X /></button></ModalHeader>
        <AccountIdentity><ProfilePhoto $small><span>{profileInitial}</span>{profileAvatar ? <img src={profileAvatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</ProfilePhoto><b>{profileName}</b></AccountIdentity>
        <button className="open-profile" type="button" onClick={() => chooseView("red")}>Abrir Perfil Vivo <ChevronLeft /></button>
        <button className="open-profile" type="button" onClick={() => { setProfileOpen(false); setConversationsOpen(true); }}>Conversaciones <ChevronLeft /></button>
      </ProfilePopover> : null}
      {conversationsOpen ? <GlobalConversationsModal open onClose={() => setConversationsOpen(false)} from="mapa" returnTo={`${window.location.pathname}${window.location.search}${window.location.hash}`} onOpenProfile={() => chooseView("red")} /> : null}

      <CloseWorldBtn
        type="button"
        onClick={() => (onExit ? onExit() : setTab("mercado"))}
        aria-label="Salir del mapa vivo"
        title="Salir del mapa vivo"
      >
        <X />
      </CloseWorldBtn>
      {atmosphere.label ? <WeatherBadge aria-label={`Clima aproximado: ${atmosphere.label}`}>{atmosphere.label}</WeatherBadge> : null}

      <WorldBody $mapOnly={view === "mapa" || view === "publicar" || view === "red" || view === "valor"}>
        <MapZone $full={view === "mapa"}>
          <CircularMapPanel
            allLive={allLive}
            networkLive={allLive}
            onOpenThread={(threadId: string, point: any) =>
              openThread(threadId, point)
            }
            onOfferMaterial={resonatePoint}
            actorId={actorId}
            initialProjection={initialProjection}
            onReturnToFeed={onExit}
            purchaseContext={purchaseContext}
            onContinuePurchase={onContinuePurchase}
            onOpenProduct={onOpenProduct}
            focusedId={focusedContextId || undefined}
            overlaySuppressed={profileOpen || toolsOpen || view !== "mapa"}
            activityRequestKey={activityRequestKey}
            hideActivityToggle
          />

          {(profileOpen || toolsOpen || view !== "mapa") ? <LivingModalBackdrop $level={700} onClick={closeActiveOverlay} aria-hidden="true" /> : null}

          <GameDock aria-label="Acciones del mapa">
            <WorldNode $tone="create" type="button" onClick={() => chooseView("mi_red")} aria-label="Mi red"><Users /><span>Mi red</span></WorldNode>
            <WorldNode $tone="share" type="button" onClick={() => chooseView("publicar")} aria-label="Decir"><Mic /><span>Decir</span></WorldNode>
            <WorldNode $tone="explore" type="button" onClick={() => chooseView("valor")} aria-label="Mi Valor"><Sprout /><span>Mi Valor</span></WorldNode>

            {toolsOpen ? (
              <ToolsMenu>
                <ToolsHead><b>Explorar</b><button type="button" onClick={() => setToolsOpen(false)} aria-label="Cerrar"><X /></button></ToolsHead>
                <ToolBtn type="button" onClick={() => chooseView("mapa")}><MapPinned /><span>Mapa</span></ToolBtn>
                <ToolBtn type="button" onClick={() => { chooseView("mapa"); setActivityRequestKey((key) => key + 1); }}><Activity /><span>Actividad</span></ToolBtn>
                <CreateToolButton type="button" onClick={() => chooseView("publicar")}><Sparkles /><span>Crear con ayuda</span></CreateToolButton>
                <MoreTools><summary>Más</summary><MoreToolGrid>
                  <ToolBtn type="button" onClick={() => chooseView("radar")}><Radar /><span>Encontrar</span></ToolBtn>
                  <ToolBtn type="button" onClick={() => chooseView("fabrica")}><Factory /><span>Producir</span></ToolBtn>
                  <ToolBtn type="button" onClick={() => chooseView("conectar")}><Truck /><span>Entregas</span></ToolBtn>
                  <ToolBtn type="button" onClick={() => chooseView("cadena")}><GitBranch /><span>Seguir ciclo</span></ToolBtn>
                  <ToolBtn type="button" onClick={() => chooseView("aportes")}><Sprout /><span>Aportar</span></ToolBtn>
                  <ToolBtn type="button" onClick={() => { setToolsOpen(false); void shareMap(); }}><Share2 /><span>Compartir mapa</span></ToolBtn>
                  {contextualCapabilities.map((item) => <ToolBtn key={`${item.focusId}:${item.label}`} type="button" onClick={() => { setFocusedContextId(item.focusId); chooseView("mapa"); }}><Sparkles /><span>{item.label}</span></ToolBtn>)}
                </MoreToolGrid>
                </MoreTools>
              </ToolsMenu>
            ) : null}
          </GameDock>
          <MapMoreBtn type="button" onClick={() => setToolsOpen((open) => !open)} aria-label="Explorar el mapa"><LayoutGrid /></MapMoreBtn>
          {shareMessage ? <ShareToast role="status">{shareMessage}</ShareToast> : null}
        </MapZone>

        {view !== "mapa" ? <ActionPanel $create={view === "publicar" || view === "red" || view === "valor" || view === "mi_red"} $network={view === "mi_red"}>
          <PanelHead>
            <PanelIcon>
              {view === "mapa" ? <Satellite /> : null}
              {view === "publicar" ? <Zap /> : null}
              {view === "radar" ? <Radar /> : null}
              {view === "fabrica" ? <Factory /> : null}
              {view === "conectar" ? <Truck /> : null}
              {view === "cadena" ? <GitBranch /> : null}
              {view === "aportes" ? <Sprout /> : null}
              {view === "valor" ? <Sprout /> : null}
              {view === "mi_red" ? <Users /> : null}
              {view === "red" ? <Users /> : null}
            </PanelIcon>

            <PanelTitle>
              {view === "mapa" && "Acciones"}
              {view === "publicar" && "Crear"}
              {view === "radar" && "Radar"}
              {view === "fabrica" && "Fábrica viva"}
              {view === "conectar" && "Conectar"}
              {view === "cadena" && "Ciclo vivo"}
              {view === "aportes" && "Aportar"}
              {view === "valor" && "Mi Valor"}
              {view === "mi_red" && "Mi red"}
              {view === "red" && "Perfil Vivo"}
            </PanelTitle>
            <PanelClose type="button" onClick={() => chooseView("mapa")} aria-label="Volver al mapa">
              <X />
            </PanelClose>
          </PanelHead>

          <PanelBody>
            <Suspense fallback={<PanelLoading><i /><span>Abriendo este espacio…</span></PanelLoading>}>
            {view === "mapa" && (
              <IntroGrid>
                <IntroCard onClick={() => setView("publicar")}>
                  <Zap />
                  <strong>Publicar</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("radar")}>
                  <Radar />
                  <strong>Radar</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("fabrica")}>
                  <Factory />
                  <strong>Fábrica viva</strong>
                </IntroCard>

                <IntroCard onClick={() => setTab("mis_pedidos")}>
                  <Boxes />
                  <strong>Pedidos</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("red")}>
                  <Users />
                  <strong>Perfil</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("conectar")}>
                  <Truck />
                  <strong>Conectar</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("cadena")}>
                  <GitBranch />
                  <strong>Ciclo</strong>
                </IntroCard>

                <IntroCard onClick={() => setView("aportes")}>
                  <Sprout />
                  <strong>Aportar</strong>
                </IntroCard>
              </IntroGrid>
            )}

            {view === "publicar" && (
              <>
                <LiveNetworkPanel allLive={allLive} activeActor={contextualActor} initialView="publish" minimalEmbed onFocusDV={() => chooseView("mapa")} onOpenThread={openThread} />
              </>
            )}

            {view === "radar" && (
              <FactoryLiveRadar
                ns="mt:market"
                liveItems={allLive}
                selfActorId={actorId || null}
                title="Radar circular"
                subtitle="Demandas de materiales, matches automáticos y señales de presencia para responder rápido."
                onOpenThread={(threadId, cluster) =>
                  openThread(threadId, cluster)
                }
                onOfferMaterial={resonatePoint}
              />
            )}

            {view === "fabrica" && (
              <FabricaVivaPanel
                allDv={allLive}
                nsFilter="__ALL__"
                activeCajero={contextualActor}
                setInboxThreadId={setInboxThreadId}
                setTab={setTab}
                Section={SectionBox}
                Grid={GridBox}
                Card={CardBox}
                Title={TitleBox}
                Subtle={SubtleBox}
                Chips={ChipsBox}
                Chip={ChipBox}
                Price={PriceBox}
                Actions={ActionsBox}
                SmallBtn={SmallBtnBox}
              />
            )}

            {view === "conectar" && (
              <SupplyFalconPanel
                allLive={allLive}
                activeCajero={contextualActor}
                onOpenThread={openThread}
              />
            )}

            {view === "cadena" && (
              <CircularChainPanel
                allLive={allLive}
                activeCajero={contextualActor}
              />
            )}

            {view === "aportes" && (
              <ValueContributionPanel
                allLive={allLive}
                activeCajero={contextualActor}
              />
            )}

            {view === "valor" && <><ValueIntro><strong>Lo que podés aportar</strong>{profileCapabilities.length ? <ProfileCapabilities>{profileCapabilities.map((label) => <span key={label}>{label}</span>)}</ProfileCapabilities> : <span>Contá qué sabés hacer o qué tenés disponible.</span>}<button type="button" onClick={() => chooseView("publicar")}>Decir lo que puedo ofrecer</button></ValueIntro><LiveNetworkPanel allLive={allLive} activeActor={contextualActor} initialView="vault" minimalEmbed onOpenThread={openThread} /></>}

            {view === "mi_red" && <><NetworkHighlights><LivingHighlights allLive={allLive} actor={contextualActor} /></NetworkHighlights><LiveNetworkPanel allLive={allLive} activeActor={contextualActor} initialView="feed" minimalEmbed onFocusDV={(dv) => { setFocusedContextId(dv?.id || null); chooseView("mapa"); }} onOpenThread={openThread} /></>}

            {view === "red" && (
              <><ProfileSummary>
                <ProfilePhoto><span>{profileInitial}</span>{profileAvatar ? <img src={profileAvatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</ProfilePhoto>
                <h2>{profileName}</h2>
                {profileCapabilities.length ? <ProfileCapabilities>{profileCapabilities.map((label) => <span key={label}>{label}</span>)}</ProfileCapabilities> : null}
                <button type="button" onClick={() => chooseView("mapa")}><MapPinned /> Ver mi mapa circular</button>
              </ProfileSummary><ProfileMore><summary>Ver y editar mi perfil</summary><LiveNetworkPanel
                allLive={allLive}
                activeActor={contextualActor}
                initialView="profile"
                minimalEmbed
                focusedId={focusedContextId}
                onFocusDV={(dv) => {
                  setFocusedContextId(dv?.id ? String(dv.id) : null);
                  if (dv) setView("mapa");
                }}
                onOpenThread={openThread}
              /></ProfileMore></>
            )}
            </Suspense>
          </PanelBody>
        </ActionPanel> : null}
      </WorldBody>
    </World>
  );
}

/* UI */

const World = styled.div`
  position: relative;
  width: 100%;
  height: calc(100dvh - 56px);
  min-height: 520px;
  z-index: 1;
  overflow: hidden;
  --ambient-glow: rgba(231,198,142,.11);
  background: radial-gradient(circle at 52% 36%,var(--ambient-glow),transparent 65%),#fffaf3;
  color: #0f172a;
  border: 0;
  border-radius: 0;
  &[data-time="morning"]{--ambient-glow:rgba(243,206,145,.16)}
  &[data-time="sunset"]{--ambient-glow:rgba(240,173,129,.17)}
  &[data-time="night"]{--ambient-glow:rgba(137,151,198,.13)}
  &[data-weather="rain"]{--ambient-glow:rgba(158,180,194,.17)}
  @media(max-width:700px){height:calc(100dvh - 56px);min-height:0}
`;
const WeatherBadge = styled.span`
  position:absolute;top:23px;right:126px;z-index:720;padding:8px 11px;border-radius:999px;
  background:rgba(255,255,255,.85);border:1px solid rgba(210,192,163,.26);color:#4d5665;
  box-shadow:0 8px 24px rgba(45,50,60,.07);font-size:12px;font-weight:700;
  @media(max-width:700px){display:none}
`;

const TopBar = styled.header`
  position: absolute;
  z-index: 820;
  top: max(18px, env(safe-area-inset-top));
  left: 28px;
  right: 78px;
  height: 48px;
  display: none;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  @media (max-width: 700px) { left: 16px; right: 66px; top: max(12px, env(safe-area-inset-top)); }
`;
const Brand = styled.div`
  display:flex;align-items:center;gap:9px;color:#172444;font-size:13px;font-weight:900;letter-spacing:.25em;
  text-shadow:0 1px 12px #fff;pointer-events:auto;
  @media(max-width:520px){font-size:11px;letter-spacing:.18em}
`;
const BrandMark = styled.span`
  display:grid;place-items:center;width:30px;height:30px;border-radius:999px;
  background:rgba(255,255,255,.9);box-shadow:0 5px 18px rgba(23,36,68,.12);letter-spacing:0;color:#4856c8;font-size:14px;
`;
const TopActions = styled.div`position:fixed;left:50%;top:max(18px, env(safe-area-inset-top));transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto;@media(max-width:700px){top:max(12px, env(safe-area-inset-top))}`;
const TopIcon = styled.button`
  position:relative;
  width:48px;height:48px;border:3px solid rgba(255,255,255,.96);border-radius:999px;background:rgba(255,255,255,.9);color:#1c3152;
  box-shadow:0 8px 25px rgba(23,36,68,.12);display:grid;place-items:center;cursor:pointer;overflow:hidden;padding:3px;
  img{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:cover;border-radius:999px}
  span{font-size:17px;font-weight:900;color:#6270d8}
`;
const ProfilePopover = styled.div`
  ${livingGlass};
  position:absolute;z-index:850;top:calc(max(18px, env(safe-area-inset-top)) + 56px);left:50%;transform:translateX(-50%);width:min(300px,calc(100vw - 24px));padding:16px;
  display:grid;gap:16px;
  .open-profile{border:1px solid rgba(255,255,255,.9);border-radius:17px;background:rgba(255,255,255,.6);color:#35468c;padding:13px;font-weight:850;cursor:pointer;display:flex;align-items:center;justify-content:space-between}
  .open-profile svg{width:17px;transform:rotate(180deg)}
  @media(max-width:700px){top:calc(max(12px, env(safe-area-inset-top)) + 50px)}
`;
const ModalHeader = styled.div`
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  b{font-size:15px;letter-spacing:.01em}
  button{width:30px;height:30px;border:0;border-radius:999px;background:rgba(255,255,255,.67);color:#53618a;display:grid;place-items:center;cursor:pointer}
  button svg{width:16px;height:16px}
`;
const AccountIdentity = styled.div`
  display:flex;align-items:center;gap:13px;
  b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
const ProfilePhoto = styled.div<{ $small?: boolean }>`
  position:relative;
  width:${({ $small }) => $small ? "66px" : "118px"};height:${({ $small }) => $small ? "66px" : "118px"};flex:0 0 auto;
  border:4px solid rgba(255,255,255,.95);border-radius:999px;overflow:hidden;display:grid;place-items:center;
  background:linear-gradient(135deg,#b3bbff,#e4cafa);color:#fff;font-size:${({ $small }) => $small ? "26px" : "46px"};font-weight:800;
  box-shadow:0 10px 27px rgba(76,88,174,.22);
  img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
`;
const ProfileSummary = styled.div`
  display:grid;justify-items:center;gap:12px;padding:22px 16px;text-align:center;
  h2{margin:0;color:#283457;font-size:clamp(22px,3vw,29px);line-height:1.15}
  >button{display:flex;align-items:center;justify-content:center;gap:9px;width:min(100%,310px);padding:12px 18px;border:1px solid rgba(255,255,255,.96);border-radius:999px;background:rgba(255,255,255,.7);color:#4253a7;font-weight:850;cursor:pointer}
  >button svg{width:18px;height:18px}
`;
const ProfileCapabilities = styled.div`
  display:flex;flex-wrap:wrap;justify-content:center;gap:7px;max-width:420px;margin:2px 0 6px;
  span{padding:8px 12px;border:1px solid rgba(255,255,255,.95);border-radius:999px;background:rgba(255,255,255,.58);color:#526083;font-size:12px;font-weight:750}
`;
const ValueIntro = styled.div`
  display:grid;justify-items:center;gap:10px;padding:16px 10px;text-align:center;color:#334467;
  strong{font-size:17px} >span{font-size:13px;color:#67738f}
  button{border:1px solid rgba(255,255,255,.96);border-radius:999px;background:rgba(255,255,255,.72);padding:10px 15px;color:#4c5caf;font-weight:850;cursor:pointer}
`;
const ProfileMore = styled.details`
  margin:0 14px 14px;border-top:1px solid rgba(107,119,178,.12);
  summary{cursor:pointer;padding:14px 3px;color:#5060a7;font-size:13px;font-weight:850}
`;

const WorldAura = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
  opacity: 0.6;
`;

const CloseWorldBtn = styled.button`
  position: absolute;
  top: 18px;
  right: 22px;
  z-index: 900;
  border: 1px solid rgba(15,23,42,0.08);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255,255,255,0.94);
  color: #0f172a;
  cursor: pointer;
  backdrop-filter: blur(18px);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 20px;
    height: 20px;
  }
  @media(max-width:700px){top:14px;right:10px;width:40px;height:40px}
`;

const WorldBody = styled.div<{ $mapOnly?: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 4;
  &:has([data-point-sheet]) { z-index: 60; }
  display: grid;
  grid-template-columns: ${({ $mapOnly }) => $mapOnly ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(340px, 420px)"};
  gap: 10px;
  min-width: 0;
  min-height: 0;

  @media (max-width: 980px) {
    display: block;
    inset: 0;
  }
`;

const MapZone = styled.div<{ $full?: boolean }>`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 0;
  border: 0;
  box-shadow: none;

  @media (max-width: 980px) {
    height: 100%;
    border-radius: 0;
    border: 0;
  }
`;
const MapNeedButton = styled.button`
  position: absolute;
  z-index: 735;
  right: 18px;
  bottom: 84px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 999px;
  padding: 14px 19px;
  background: #15ff00;
  color: #06110b;
  font-weight: 950;
  box-shadow: 0 18px 48px rgba(21,255,0,.34);
  cursor: pointer;
  svg { width: 19px; height: 19px; }
  @media (max-width:980px){right:12px;bottom:142px;padding:12px 15px;}
`;
const ShareToast = styled.div`
  position:absolute;z-index:751;left:50%;bottom:130px;transform:translateX(-50%);padding:9px 15px;border-radius:999px;background:#1e315c;color:white;font-size:12px;font-weight:800;
`;
const GameDock = styled.div`
  position: absolute;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 720;
  display: flex;
  gap: clamp(20px,5vw,72px);
  align-items: center;
  justify-content:center;

  @media (max-width: 980px) {
    width:min(270px,calc(100% - 32px));
    gap:0;
    justify-content:space-between;
    bottom:calc(30px + env(safe-area-inset-bottom));
  }
`;
const MapMoreBtn = styled.button`
  position:absolute;right:72px;top:18px;z-index:720;
  width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.92);border-radius:999px;
  background:rgba(255,255,255,.84);color:#5361ad;box-shadow:0 8px 25px rgba(65,76,142,.15);cursor:pointer;
  svg{width:19px;height:19px}
  @media(max-width:700px){right:56px;top:14px;width:40px;height:40px}
`;
const WorldNode = styled.button<{ $active?: boolean; $tone?: "create" | "share" | "explore" }>`
  position:relative;
  border: 0;
  border-radius: 999px;
  padding: 0;
  width: 70px;
  height: 70px;
  background: ${({ $tone }) => $tone === "create" ? "linear-gradient(135deg,#72e7b6,#26bfa0)" : $tone === "share" ? "linear-gradient(135deg,#93a1ff,#606df0)" : "linear-gradient(135deg,#ff9ecc,#ee4f91)"};
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction:column;
  gap:5px;
  box-shadow:0 12px 30px rgba(53,73,141,.23),inset 0 1px 0 rgba(255,255,255,.75);
  transition:transform .16s ease;
  &:hover{transform:translateY(-3px)}

  svg {
    width: 26px;
    height: 26px;
    color: currentColor;
  }

  > span { position:absolute;top:76px;color:#172444;font-size:12px;font-weight:850;text-shadow:0 1px 10px #fff;white-space:nowrap; }

  @media (max-width: 520px) {
    width:46px;height:46px;
    svg{width:21px;height:21px}
    > span{top:49px;font-size:10px}
  }
  @media(prefers-reduced-motion:reduce){transition:none}
`;

const ToolsMenu = styled.div`
  ${livingGlass};
  position: absolute;
  left:50%;
  top:auto;
  bottom:104px;
  transform:translateX(-50%);
  width:min(360px,calc(100vw - 30px));
  padding: 8px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;

  @media (max-width: 980px) {
    bottom:96px;
  }
`;
const MoreTools = styled.details`
  grid-column:1/-1;display:grid;gap:7px;
  summary{list-style:none;cursor:pointer;border:1px solid rgba(255,255,255,.9);border-radius:15px;background:rgba(255,255,255,.62);padding:13px;color:#44548f;font-weight:850;text-align:center;font-size:12px}
  summary::-webkit-details-marker{display:none}
  &:not([open]) > div{display:none}
`;
const MoreToolGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;
  max-height:190px;overflow-y:auto;overscroll-behavior:contain;padding-top:7px;
`;
const ToolsHead = styled.div`
  grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:2px 4px 6px;color:#273454;
  b{font-size:14px}
  button{width:30px;height:30px;border:0;border-radius:999px;background:rgba(255,255,255,.7);color:#53618a;display:grid;place-items:center;cursor:pointer}
  button svg{width:16px;height:16px}
`;

const ToolBtn = styled.button`
  border: 1px solid #e7ebf5;
  border-radius: 15px;
  min-height: 54px;
  padding: 8px;
  background: #f8faff;
  color: #243656;
  cursor: pointer;
  display: grid;
  place-items: center;
  gap: 4px;
  font-weight: 900;
  font-size: 0.72rem;

  svg {
    width: 18px;
    height: 18px;
    color: #5a69de;
  }
`;
const CreateToolButton = styled(ToolBtn)`
  grid-column:1/-1;display:flex;justify-content:center;gap:9px;
  background:linear-gradient(120deg,rgba(229,239,255,.97),rgba(241,229,255,.96));
  border-color:rgba(179,192,244,.7);font-size:13px;min-height:55px;
`;

const ActionPanel = styled.div<{ $create?: boolean; $network?: boolean }>`
  ${livingGlass};
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  ${({ $create }) => $create ? `
    position:absolute;
    z-index:760;
    top:50%;left:50%;transform:translate(-50%,-50%);
    width:${({ $network }) => $network ? "min(760px,calc(100% - 40px))" : "min(580px,calc(100% - 32px))"};
    height:${({ $network }) => $network ? "min(860px,calc(100dvh - 108px))" : "min(690px,calc(100dvh - 150px))"};
    max-height:calc(100dvh - 30px);
  ` : `margin:90px 12px 100px 0;`}

  @media (max-width: 980px) {
    position: absolute;
    z-index: 760;
    left: 8px;
    right: 8px;
    bottom: calc(96px + env(safe-area-inset-bottom));
    height: ${({ $create, $network }) => $network ? "calc(100dvh - 86px - env(safe-area-inset-bottom))" : $create ? "min(82dvh, 760px)" : "min(58dvh, 590px)"};
    border-radius: 28px 28px 20px 20px;
    transform:none;
    width:auto;
    top:auto;
    margin:0;
  }
`;

const PanelHead = styled.div`
  padding: 13px 16px;
  border-bottom: 1px solid rgba(107,119,178,.12);
  background: rgba(255,255,255,.25);
  display: flex;
  gap: 11px;
  align-items: center;
`;

const PanelIcon = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(255,255,255,.68);
  color: #6676d7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: 0 6px 18px rgba(90,104,177,.12);

  svg {
    width: 20px;
    height: 20px;
  }
`;

const PanelTitle = styled.div`
  font-weight: 850;
  font-size: 1.05rem;
`;

const PanelClose = styled.button`
  margin-left:auto;width:36px;height:36px;border:1px solid rgba(15,23,42,.08);border-radius:999px;background:#fff;color:#0f172a;display:grid;place-items:center;cursor:pointer;
  svg{width:17px;height:17px}
`;

const PanelBody = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 14px;
  background: transparent;
`;
const NetworkHighlights = styled.div`
  margin:-2px 0 8px;padding:12px 14px 4px;border:1px solid rgba(112,121,181,.12);border-radius:24px;background:rgba(255,255,255,.58);
  .living-highlights{margin:0 0 8px}.lh-heading h2{color:#2d395e;font-size:15px}.lh-node{min-width:72px}.lh-avatar{width:58px;height:58px;background:rgba(255,255,255,.7)}
`;

const PanelLoading = styled.div`
  min-height:180px;display:grid;place-items:center;align-content:center;gap:10px;color:#64748b;font-size:12px;font-weight:800;
  i{width:28px;height:28px;border-radius:999px;border:3px solid #dbe5df;border-top-color:#15ff00;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){i{animation:none}}
`;

const IntroGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
`;

const IntroCard = styled.button`
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 18px;
  background: #fff;
  min-height: 78px;
  padding: 12px;
  cursor: pointer;
  text-align: center;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 7px;
  box-shadow: 0 12px 26px rgba(0,0,0,0.04);

  svg {
    width: 22px;
    height: 22px;
    color: #16a34a;
  }

  strong {
    font-size: 0.98rem;
    font-weight: 950;
  }
`;

const GlassSection = styled.div`
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 20px;
  background: #fff;
  padding: 12px;
`;

const GlassGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
`;

const GlassCard = styled.div`
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 18px;
  padding: 12px;
  display: grid;
  gap: 7px;
  min-width: 0;
`;

const GlassTitle = styled.div`
  font-weight: 950;
  line-height: 1.15;
  font-size: 0.96rem;
`;

const GlassSubtle = styled.div`
  opacity: 0.7;
  font-size: 0.86rem;
  line-height: 1.38;
`;

const GlassChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
`;

const GlassChip = styled.span<{ $tone?: "ok" | "warn" | "neutral" }>`
  font-size: 0.7rem;
  font-weight: 900;
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.08);
  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(34,197,94,0.12)"
      : $tone === "warn"
        ? "rgba(245,158,11,0.13)"
        : "rgba(0,0,0,0.04)"};
`;

const GlassPrice = styled.div`
  font-weight: 950;
  margin-top: 3px;
  font-size: 0.94rem;
`;

const GlassActions = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 8px;
`;

const GlassSmallBtn = styled.button<{ $tone?: "primary" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 14px;
  padding: 10px 10px;
  background: ${({ $tone }) => ($tone === "ghost" ? "#fff" : "#15ff00")};
  color: #111;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 950;
  width: 100%;
  opacity: ${({ disabled }) => (disabled ? 0.65 : 1)};
`;

const AdvancedDetails = styled.details`
  margin-top: 12px;
  padding: 11px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;

  summary {
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 900;
    opacity: 0.7;
  }

  &[open] summary {
    margin-bottom: 12px;
  }
`;
