import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, ChevronRight, CreditCard, FileText, LayoutGrid, MessageCircle, Settings, Share2, ShoppingBag, Sparkles, Sprout, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resolveLivingNode } from "../utopy/livingNodeProjection";
import { activeNeedsForActor, contextualCapabilities } from "../utopy/livingNodeUX";
import { projectLiveProfiles, resolveLivingIdentity } from "../social/liveProfile";
import { profileHandleForIdentity } from "../mt/productRoute";
import { studioProfileUrl } from "../utopy/studioProfileBridge";
import { canPersonalizeProfile } from "../utopy/studioEntitlements";
import "./livingIdentity.css";
const BovedaVivaPanel = lazy(() => import("../vault/BovedaVivaPanel"));
const LivingCashierPanel = lazy(() => import("../pay/LivingCashierPanel"));
const LivingNodePanel = lazy(() => import("./LivingNodePanel"));
const GlobalConversationsModal = lazy(() => import("./GlobalConversationsModal"));
const ProfileSettings = lazy(() => import("../social/LiveNetworkPanel"));
type Props = { open: boolean; allLive: any[]; activeActor?: any; target?: any; own?: boolean; syncing?: boolean; initialSpace?: "home" | "value"; onClose: () => void; onSay?: () => void; onConsult?: () => void; onEdit?: () => void; onConversations?: () => void; onMap?: () => void; onFull?: () => void };

export default function LivingProfileQuickView({ open, allLive, activeActor, target, own = false, syncing = false, initialSpace = "home", onClose, onSay, onConsult, onEdit, onConversations, onMap, onFull }: Props) {
  const navigate = useNavigate();
  const [space, setSpace] = useState<"home" | "value" | "settings">("home");
  const [settingsSection, setSettingsSection] = useState<"public" | "resume">("public");
  const [panelOpen, setPanelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const node = useMemo(() => resolveLivingNode(target || activeActor, allLive), [target, activeActor, allLive]);
  const identity = useMemo(() => resolveLivingIdentity(target || activeActor, allLive), [target, activeActor, allLive]);
  const actorId = String(activeActor?.actorId || activeActor?.id || "");
  const profile = useMemo(() => projectLiveProfiles(allLive).find(item => item.actorId === (own ? actorId : target?.actorId) || (!!node?.nodeId && item.nodeId === node.nodeId)), [allLive, actorId, own, target, node]);
  const name = profile?.name || identity.name || "Persona";
  const image = profile?.avatar || identity.avatar || "";
  const needs = useMemo(() => activeNeedsForActor(allLive, actorId), [allLive, actorId]);
  const capabilities = useMemo(() => node ? contextualCapabilities(node, needs) : [], [node, needs]);
  const handle = profile?.handle || profileHandleForIdentity(target || activeActor || {}, name);
  const profilePath = `/${encodeURIComponent(handle)}?full=1`;
  const go = (path: string) => { onClose(); navigate(path); };
  const openSettings = () => { setSettingsSection("public"); setSpace("settings"); };
  const studio = studioProfileUrl(allLive, { actorId, nodeId: node?.nodeId }, `${window.location.origin}${profilePath}`);
  const personalization = canPersonalizeProfile(allLive, actorId, node?.nodeId);
  useEffect(() => { if (!open) return; setSpace(own ? initialSpace : "home"); setNotice(""); setPanelOpen(false); setChatOpen(false); setCollecting(false); const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; dialog.current?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, [open,initialSpace]);
  useEffect(() => { if (open && !panelOpen && !chatOpen) dialog.current?.focus(); }, [open, panelOpen, chatOpen, space, collecting]);
  if (!open) return null;
  if (panelOpen) return <Suspense fallback={<div className="uli-overlay" role="status">Abriendo tu panel…</div>}><LivingNodePanel open allLive={allLive} activeActor={activeActor} onClose={() => setPanelOpen(false)}/></Suspense>;
  if (chatOpen) return <Suspense fallback={<div className="uli-overlay" role="status">Abriendo conversaciones…</div>}><GlobalConversationsModal open onClose={() => setChatOpen(false)} from="market" returnTo={window.location.pathname + window.location.search} onOpenProfile={() => setChatOpen(false)}/></Suspense>;
  const share = async () => { try { const url = new URL(profilePath, window.location.origin).href; if (navigator.share) await navigator.share({ title: name, url }); else { await navigator.clipboard.writeText(url); setNotice("Enlace copiado. Solo se comparte tu información pública."); } } catch (error: any) { if (error?.name !== "AbortError") setNotice("No pudimos compartir el enlace. Abrí tu perfil y copiá su dirección."); } };
  const row = (Icon: any, title: string, caption: string, action: () => void) => <button type="button" className="uli-row" onClick={action}><Icon size={19}/><span><b>{title}</b><small>{caption}</small></span><ChevronRight size={16}/></button>;
  return <div className="uli-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={own ? "Mi identidad UTOPY" : `Perfil de ${name}`} className={`uli-panel ${space === "home" && own && !collecting ? "uli-dark" : ""}`} onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); if (collecting) setCollecting(false); else if (space !== "home") setSpace("home"); else onClose(); }
      if (event.key === "Tab") { const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,summary,[tabindex="0"]') || []).filter(el => el.getClientRects().length); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); } }
    }}>
      <header className="uli-top"><button type="button" aria-label={collecting || space !== "home" ? "Volver al perfil" : "Cerrar perfil"} onClick={() => collecting ? setCollecting(false) : space === "home" ? onClose() : setSpace("home")}>{space === "home" && !collecting ? <X size={19}/> : <ArrowLeft size={19}/>}</button><span>{collecting ? "Cobrar" : space === "value" ? "Mi Valor" : space === "settings" ? "Configuración" : "Identidad UTOPY"}</span>{!collecting ? <button type="button" onClick={() => void share()} aria-label="Compartir perfil"><Share2 size={18}/></button> : <span/>}</header>
      {collecting ? <Suspense fallback={<p role="status">Abriendo Caja Viva…</p>}><LivingCashierPanel allLive={allLive} activeActor={activeActor} mode="quickCollect"/></Suspense> : space === "value" ? <>
        <p className="uli-note">Tu economía, tus tarjetas y tus vínculos, sin saldos inventados.</p>
        <div className="uli-content"><Suspense fallback={<p role="status">Abriendo Mi Valor…</p>}><BovedaVivaPanel allLive={allLive} actor={{ ...activeActor, id: actorId, name }}/></Suspense>
        {row(CreditCard, "Cobrar", "Preparar una solicitud y revisarla", () => setCollecting(true))}
        {row(CreditCard, "Pagos y suscripciones", "Comprobantes, acuerdos y autorizaciones", () => go("/market?tab=mis_pedidos"))}
        <p className="uli-note">Las tarjetas se vinculan únicamente en el proveedor seguro que ofrezca el comercio. Market no guarda números de tarjeta ni códigos de seguridad.</p></div>
      </> : space === "settings" ? <div className="uli-content"><Suspense fallback={<p role="status">Abriendo configuración…</p>}><ProfileSettings allLive={allLive} activeActor={activeActor} initialView="profile" initialProfileSection={settingsSection} minimalEmbed onProfileDone={() => setSpace("home")}/></Suspense></div> : <>
        <div className="uli-portrait">{image ? <img src={image} alt={name} decoding="async"/> : <UserRound size={64}/>}<span className="uli-portrait-orb" aria-hidden="true"/>{own ? <button type="button" className="uli-edit-photo" onClick={openSettings} aria-label="Editar foto y perfil"><Settings size={16}/></button> : null}</div>
        <div className="uli-name"><h2>{name}</h2>{profile?.handle ? <p>@{profile.handle}</p> : null}{syncing ? <small>Actualizando…</small> : null}</div>
        {own ? <div className="uli-shortcuts"><button type="button" onClick={() => setSpace("value")}><Sprout/><b>Mi Valor</b><small>Lo que construís</small></button><button type="button" onClick={() => onConversations ? onConversations() : setChatOpen(true)}><MessageCircle/><b>Chat Directo</b><small>Conversaciones</small></button><button type="button" onClick={openSettings}><Settings/><b>Configuración</b><small>Tu identidad</small></button></div> : null}
        <div className="uli-content">
          {profile?.bio ? <p className="uli-bio">{profile.bio}</p> : null}
          {capabilities.length ? <div className="uli-skills">{capabilities.slice(0, 6).map(item => <span key={item.capability.id}>{item.label}</span>)}</div> : null}
          {row(UserRound, own ? "Mi perfil público" : "Ver perfil completo", "Presentación, currículum y portafolio", () => onFull ? onFull() : go(profilePath))}
          {own ? <>
            {personalization && studio ? <a className="uli-studio" href={studio}><LayoutGrid size={22}/><span><b>Personalizar mi espacio</b><small>Abrir en Fundación Studio</small></span><ArrowUpRight size={18}/></a> : <p className="uli-note">Tu perfil y currículum son gratuitos. La personalización visual requiere un Pass activo para este espacio.</p>}
            {row(ShoppingBag, "Mis pedidos", "Compras, pagos y seguimiento", () => go("/market?tab=mis_pedidos"))}
            {row(BriefcaseBusiness, "Mis negocios", "Elegir mi espacio de trabajo", () => go("/mi-espacio"))}
            {row(BriefcaseBusiness, "Mi panel personal", "Currículum y capacidades", () => setPanelOpen(true))}
            <details className="uli-more"><summary>Más herramientas</summary>
              {row(Sparkles, "Crear publicación", "Una oferta, necesidad o producción", () => go("/market?tab=producir&section=publicar"))}
              {row(FileText, "Mi currículum", "Experiencia y trabajos destacados", () => { setSettingsSection("resume"); setSpace("settings"); })}
              {row(CreditCard, "Cobrar", "Abrir mi Caja Viva", () => setCollecting(true))}
              {row(BriefcaseBusiness, "Actividad", "Trabajos y pedidos del nodo", () => go("/market?tab=mis_pedidos&section=trabajos"))}
            </details>
          </> : onConsult ? row(MessageCircle, "Consultar", "Conversar con este nodo", onConsult) : null}
          {node?.presence && onMap ? row(LayoutGrid, "Ver en mapa", "Presencia autorizada", onMap) : null}
        </div>
      </>}
      {notice ? <p role="status" className="uli-notice">{notice}</p> : null}
    </section>
  </div>;
}
