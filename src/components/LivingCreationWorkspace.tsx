import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronRight, MapPin, MessageCircle, Package, ReceiptText, FileText, Wrench, Factory } from "lucide-react";
import { humanVisibleText } from "../social/liveNetwork.human";
import "./livingCreationWorkspace.css";
const Composer = lazy(() => import("../social/LiveNetworkPanel"));
const creationTitle = (dv: any) => { const title = humanVisibleText(dv?.attrs?.text || dv?.attrs?.title || dv?.attrs?.nombre || dv?.attrs?.name, ""); return /^(vos|voz|resultado vivo)$/i.test(title) ? "" : title; };
const isCreation = (dv: any) => /^(resonance.intent|mt:supply|mt:demand|mt:offer|live.signal|capability.offer|market.offer)$/.test(dv.kind) && Boolean(creationTitle(dv));
type Section = "trabajos" | "conversaciones" | "pedidos" | "publicar" | "caja";
type Props = { allLive: any[]; activeActor: any; initialText: string; onDraftTextChange: (text: string) => void; contextRef?: string; onActivity: (section: Section) => void; onExplore: (reference?: string) => void; onChat: () => void; onOpenThread: (threadId: string) => void; advanced: ReactNode };
export default function LivingCreationWorkspace({ allLive, activeActor, initialText, onDraftTextChange, contextRef, onActivity, onExplore, onChat, onOpenThread, advanced }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const actorId = String(activeActor?.actorId || activeActor?.id || "");
  const own = useMemo(() => { const latest = new Map<string, any>(); for (const dv of allLive) { if (!actorId || !dv?.id || ![dv?.attrs?.actorId, dv?.attrs?.ownerActorId, dv?.attrs?.buyerActorId, ...(dv?.attrs?.participants || [])].includes(actorId)) continue; const prior = latest.get(dv.id); if (!prior || Number(dv.meta?.version || 0) >= Number(prior.meta?.version || 0)) latest.set(dv.id, dv); } return [...latest.values()]; }, [allLive, actorId]);
  const recent = useMemo(() => own.filter(dv => isCreation(dv) && dv?.attrs?.actorId === actorId && dv?.meta?.scopes?.includes("public")).sort((a, b) => Date.parse(b.meta?.updatedAt || b.meta?.ts || "") - Date.parse(a.meta?.updatedAt || a.meta?.ts || "")).slice(0, 5), [own, actorId]);
  const count = (pattern: RegExp) => own.filter(dv => pattern.test(dv.kind)).length;
  return <section className="utopy-ui uc-workspace" aria-label="Crear y centro de producción">
    <div className="uc-main"><header><h1>Crear</h1><p>Contá tu idea. Dale forma y hacela realidad, paso a paso.</p></header>
      <div className="uc-composer"><Suspense fallback={<p role="status">Preparando tu espacio…</p>}><Composer key={actorId} allLive={allLive} activeActor={activeActor} initialView="publish" minimalEmbed initialText={initialText} onDraftTextChange={onDraftTextChange} focusedId={contextRef} onFocusDV={dv => onExplore(dv?.id)} onOpenThread={onOpenThread} onPublishedResponses={() => onActivity("conversaciones")}/></Suspense></div>
      <section className="uc-recent"><div className="uc-section-title"><h2>Mis creaciones recientes</h2><button type="button" onClick={() => onActivity("publicar")}>Ver publicaciones <ArrowRight size={14}/></button></div>
        {recent.length ? recent.map(dv => <button type="button" className="uc-recent-row" key={dv.id} onClick={() => onExplore(dv.id)}><FileText size={20}/><span><b>{creationTitle(dv)}</b><small>Publicación en tu red</small></span><ChevronRight size={16}/></button>) : <div className="uc-empty">Tu próxima creación empieza arriba. Tus publicaciones públicas aparecerán aquí.</div>}
      </section>
      <details className="uc-advanced" onToggle={event => setShowAdvanced(event.currentTarget.open)}><summary>Precios, stock y producción avanzada</summary><p>El publicador técnico y las herramientas existentes siguen disponibles para operaciones que necesitan más detalle.</p>{showAdvanced ? advanced : null}</details>
    </div>
    <aside className="uc-side"><section className="utopy-card"><div className="uc-section-title"><h2>Actividad viva</h2></div>{([[FileText,"Publicaciones","publicar",own.filter(dv => isCreation(dv) && dv?.attrs?.actorId === actorId).length],[Package,"Pedidos","pedidos",count(/^(market.order.create|mt:pedido)$/)],[Wrench,"Trabajos","trabajos",count(/^work\.agreement$/)], [MessageCircle,"Conversaciones","conversaciones",count(/^(live.thread|conversation.thread)$/)], [ReceiptText,"Cobros y caja","caja",count(/^payment\.request$/)]] as const).map(([Icon,label,section,total]) => <button className="uc-activity-row" type="button" key={section} onClick={() => onActivity(section)}><Icon size={17}/><span>{label}</span>{total > 0 ? <small>{total}</small> : null}<ChevronRight size={15}/></button>)}</section>
      <button type="button" className="uc-destination" onClick={() => onActivity("trabajos")}><Factory size={21}/><b>Centro de producción</b><p>Trabajos, cola productiva y seguimiento. Las herramientas de tu nodo, sin perderlas.</p><span>Abrir producción <ArrowRight size={15}/></span></button>
      <button type="button" className="uc-destination" onClick={() => onExplore()}><MapPin size={21}/><b>Mapa de oportunidades</b><p>Descubrí personas, recursos y capacidades.</p><span>Explorar territorio <ArrowRight size={15}/></span></button>
      <button type="button" className="uc-help" onClick={onChat}><MessageCircle size={19}/><span><b>¿Lo conversamos?</b><small>Abrí tus conversaciones para coordinar.</small></span><ChevronRight size={16}/></button>
    </aside>
  </section>;
}
