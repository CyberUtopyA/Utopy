import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { LivingHighlight, HighlightPreferences, HighlightAction } from "../social/livingHighlights";
import { resolveLivingNode } from "../utopy/livingNodeProjection";

export default function LivingHighlightsViewer({ session, highlights, allLive, preferences, onPreferences, onClose, offline }: { session: string[]; highlights: LivingHighlight[]; allLive: any[]; preferences: HighlightPreferences; onPreferences: (next: HighlightPreferences) => void; onClose: () => void; offline: boolean }) {
  const [index, setIndex] = useState(0); const [menu, setMenu] = useState(false); const [ar, setAr] = useState(false); const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null); const video = useRef<HTMLVideoElement>(null); const touch = useRef<{x:number;y:number} | null>(null); const wheel = useRef(0);
  const navigate = useNavigate(); const location = useLocation();
  const current = highlights.find((h) => h.highlightId === session[index]);
  const next = highlights.find((h) => h.highlightId === session[index + 1]);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const advance = (delta: number) => { setIndex((i) => Math.max(0, Math.min(session.length, i + delta))); setMenu(false); setAr(false); setNotice(""); };
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; root.current?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  useEffect(() => { if (current && !preferences.seen[current.highlightId]) onPreferences({ ...preferences, seen: { ...preferences.seen, [current.highlightId]: Date.now() } }); }, [current?.highlightId, preferences, onPreferences]);
  useEffect(() => { if (next?.mediaType !== "image" || !next.mediaRef) return; const image = new Image(); image.src = next.mediaRef; return () => { image.src = ""; }; }, [next?.mediaRef]);
  useEffect(() => { const hidden = () => { if (document.hidden) video.current?.pause(); }; document.addEventListener("visibilitychange", hidden); return () => document.removeEventListener("visibilitychange", hidden); }, []);
  const action = async (ref: HighlightAction) => {
    if (ref.kind === "ar") { try { await import("@google/model-viewer"); setAr(true); } catch { setNotice("No se pudo abrir AR. Podés ver la ficha."); } return; }
    if (ref.kind === "mo" && current) { const node = resolveLivingNode(current.nodeId, allLive); if (node) { const { openMOWithLivingNode } = await import("../mt/mo.capabilityBridge"); openMOWithLivingNode(node, location.pathname + location.search); onClose(); } return; }
    if (ref.path) { onClose(); navigate(ref.path, { state: { returnTo: location.pathname + location.search, scrollY: window.scrollY } }); }
  };
  const share = async () => { const path = current?.actionRefs.find((ref) => ref.path)?.path; if (!path) return; const url = new URL(path, window.location.origin).href; try { if (navigator.share) await navigator.share({ title: current?.title, url }); else { await navigator.clipboard.writeText(url); setNotice("Enlace copiado"); } } catch { setNotice("No se compartió el enlace."); } };
  return createPortal(<div className="lh-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Novedades Vivas" className="lh-viewer" onKeyDown={(e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); advance(e.key === "ArrowDown" ? 1 : -1); }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); advance(e.key === "ArrowRight" ? 1 : -1); }
      if (e.key === "Tab") { const elements = root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], video[controls], [tabindex="0"]'); if (!elements?.length) return; const first = elements[0], last = elements[elements.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }} onWheel={(e) => { if (Math.abs(e.deltaY) < 25 || Date.now() - wheel.current < 500 || (e.target as HTMLElement).closest(".lh-copy, .lh-menu")) return; wheel.current = Date.now(); advance(e.deltaY > 0 ? 1 : -1); }}>
      <div className="lh-story-progress" aria-hidden="true">{session.map((id, position) => <span key={id} data-seen={position <= index}/>)}</div>
      <header className="lh-viewer-header"><div>{current?.avatarRef ? <img src={current.avatarRef} alt=""/> : <span>⌁</span>}<div><b>{current?.nodeName || "Novedades"}</b>{current ? <small>{new Date(current.createdAt).toLocaleDateString("es-PY", { day: "numeric", month: "short" })}</small> : null}</div></div><button type="button" aria-label="Cerrar novedades" onClick={onClose}>✕</button></header>
      {offline ? <p className="lh-status">◌ Mostrando lo último que conocemos.</p> : null}
      {current ? <>
        <div className="lh-media" onTouchStart={(e) => { touch.current = {x:e.touches[0].clientX,y:e.touches[0].clientY}; }} onTouchEnd={(e) => { if (touch.current == null) return; const dx = touch.current.x - e.changedTouches[0].clientX; const dy = touch.current.y - e.changedTouches[0].clientY; const delta = Math.abs(dx)>Math.abs(dy)?dx:dy; touch.current = null; if (Math.abs(delta) > 55) advance(delta > 0 ? 1 : -1); }}>
          {ar && current.modelRef ? React.createElement("model-viewer", { src: current.modelRef, ar: true, "camera-controls": true, alt: current.summary, style: { width: "100%", height: "100%" } }) : current.mediaType === "video" ? <video key={current.mediaRef} ref={video} src={current.mediaRef} controls playsInline muted autoPlay={preferences.autoplay && !reduced && !document.hidden} preload="metadata">{current.captionsRef ? <track kind="captions" src={current.captionsRef} srcLang="es" label="Español" default/> : null}</video> : current.mediaRef ? <img key={current.mediaRef} src={current.mediaRef} alt={current.summary} decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}/ > : <span aria-hidden="true">⌁</span>}
        </div>
        <div className="lh-copy" aria-live="polite"><h2>{current.title}</h2><p>{current.summary}</p>{current.context.slice(0, 1).map((line) => <small key={line}>{line}</small>)}<div className="lh-actions">{current.actionRefs.map((ref) => <button className="lh-button" key={ref.kind + ref.label} type="button" onClick={() => void action(ref)}>{ref.label}</button>)}</div></div>
        <div className="lh-tools"><button type="button" onClick={() => void share()}>Compartir</button><button type="button" aria-label="Opciones de novedades" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button></div>
        {menu ? <div className="lh-menu"><button type="button" onClick={() => { onPreferences({ ...preferences, hidden: [...preferences.hidden, current.highlightId] }); advance(1); }}>No me interesa</button><button type="button" onClick={() => { onPreferences({ ...preferences, lessKinds: [...new Set([...preferences.lessKinds, current.kind])] }); setMenu(false); }}>Ver menos como esto</button><button type="button" onClick={() => { onPreferences({ ...preferences, mutedNodes: [...new Set([...preferences.mutedNodes, current.nodeId])] }); advance(1); }}>Silenciar novedades de este nodo</button><label><input type="checkbox" checked={preferences.autoplay} onChange={(e) => onPreferences({ ...preferences, autoplay: e.target.checked })}/> Reproducir videos sin sonido</label></div> : null}
      </> : index < session.length ? <div className="lh-end"><span>⌁</span><h2>Esta novedad ya cambió.</h2><p>La disponibilidad se actualizó en la red.</p><button className="lh-button" type="button" onClick={() => advance(1)}>Continuar</button></div> : <div className="lh-end"><span>⌁</span><h2>Ya viste lo nuevo.</h2><p>La red sigue viva por acá.</p><button className="lh-button" type="button" onClick={onClose}>Volver a {location.pathname === "/market" || location.pathname === "/" ? "Market" : "mi lugar"}</button></div>}
      {notice ? <p className="lh-status" role="status">{notice}</p> : null}
      <footer className="lh-progress"><button type="button" aria-label="Novedad anterior" disabled={index === 0} onClick={() => advance(-1)}>↑</button><span>{Math.min(index + 1, session.length)} de {session.length}</span><button type="button" aria-label="Novedad siguiente" disabled={index >= session.length} onClick={() => advance(1)}>↓</button></footer>
      {highlights.filter((h) => !session.includes(h.highlightId) && !preferences.seen[h.highlightId]).length ? <small className="lh-status">⌁ Hay novedades para tu próxima visita.</small> : null}
    </div>
  </div>, document.body);
}
