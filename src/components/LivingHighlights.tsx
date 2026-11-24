import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { projectLivingHighlights, highlightSession, readHighlightPreferences, writeHighlightPreferences, type HighlightPreferences } from "../social/livingHighlights";
import "./livingHighlights.css";
import "./livingHighlightsRail.css";
const Viewer = lazy(() => import("./LivingHighlightsViewer"));

export default function LivingHighlights({ allLive, actor, nodeId, syncing = false, variant = "rail", children }: { allLive: any[]; actor?: any; nodeId?: string; syncing?: boolean; variant?: "rail" | "avatar"; children?: React.ReactNode }) {
  const actorId = String(actor?.actorId || actor?.id || "device");
  const [preferences, setPreferences] = useState(() => readHighlightPreferences(actorId));
  const [session, setSession] = useState<string[] | null>(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { setPreferences(readHighlightPreferences(actorId)); setSession(null); }, [actorId]);
  useEffect(() => { const status = () => { setOffline(!navigator.onLine); setNow(Date.now()); }; window.addEventListener("online", status); window.addEventListener("offline", status); window.addEventListener("focus", status); return () => { window.removeEventListener("online", status); window.removeEventListener("offline", status); window.removeEventListener("focus", status); }; }, []);
  const highlights = useMemo(() => projectLivingHighlights(allLive, { actor, preferences, now }), [allLive, actor, preferences, now]);
  const visible = useMemo(() => nodeId ? highlights.filter((h) => h.nodeId === nodeId) : highlights, [nodeId, highlights]);
  const nodes = useMemo(() => Array.from(new Map(visible.map((h) => [h.nodeId, h])).values()).slice(0, 15), [visible]);
  const update = (next: HighlightPreferences) => { writeHighlightPreferences(actorId, next); setPreferences(next); };
  // A single semantic-expiry timer, not polling or a new subscription.
  useEffect(() => { const next = highlights.map((h) => h.expiresAt).filter((at): at is number => Boolean(at && at > Date.now())).sort((a, b) => a - b)[0]; if (!next) return; const timer = window.setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 10, 2_147_483_647)); return () => clearTimeout(timer); }, [highlights]);
  const open = (id?: string) => { setNow(Date.now()); setSession(highlightSession(visible, preferences, id)); };
  if (variant === "avatar") return <>
    {visible.length ? <button type="button" className="lh-profile-story" aria-label="Ver novedades de este perfil" onClick={() => open(nodeId)}>{children}<span className="lh-profile-story-dot" aria-hidden="true"/></button> : <span className="lh-profile-no-story">{children}</span>}
    {session ? <Suspense fallback={<p role="status">Abriendo novedades…</p>}><Viewer key={actorId} session={session} highlights={visible} allLive={allLive} preferences={preferences} onPreferences={update} onClose={() => setSession(null)} offline={offline}/></Suspense> : null}
  </>;
  if (!visible.length && !session) return null;
  return <section className="living-highlights" aria-label="Novedades Vivas">
    <div className="lh-heading"><h2>Novedades vivas</h2><button type="button" onClick={() => open()}>Ver todas</button></div>
    {offline ? <p className="lh-status">◌ Mostrando lo último que conocemos.</p> : syncing ? <p className="lh-status">⌁ Buscando novedades…</p> : null}
    {nodeId ? <div className="lh-profile-items">{visible.slice(0, 3).map((h) => <button type="button" key={h.highlightId} onClick={() => setSession([h.highlightId, ...visible.filter((other) => other.highlightId !== h.highlightId).map((other) => other.highlightId)].slice(0, 15))}>{h.mediaType === "image" && h.mediaRef ? <img src={h.mediaRef} alt="" loading="lazy"/> : <span>⌁</span>}<b>{h.title}</b></button>)}</div> : <div className="lh-nodes">{nodes.map((node) => { const unseen = visible.some((h) => h.nodeId === node.nodeId && !preferences.seen[h.highlightId]); return <button type="button" key={node.nodeId} className="lh-node" aria-label={`${node.nodeName}${unseen ? ": novedades sin ver" : ": novedades vistas"}`} onClick={() => open(node.nodeId)}><span className={`lh-avatar ${unseen ? "lh-unseen" : ""}`}>{node.avatarRef ? <img src={node.avatarRef} alt="" loading="lazy" decoding="async"/> : <span>{node.nodeName.slice(0, 1)}</span>}</span><span>{node.nodeName}</span></button>; })}</div>}
    {session ? <Suspense fallback={<div className="lh-backdrop"><button type="button" className="lh-button" onClick={() => setSession(null)}>Abriendo novedades… · Cerrar</button></div>}><Viewer key={actorId} session={session} highlights={visible} allLive={allLive} preferences={preferences} onPreferences={update} onClose={() => setSession(null)} offline={offline}/></Suspense> : null}
  </section>;
}
