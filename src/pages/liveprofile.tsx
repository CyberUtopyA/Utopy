import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LiveProductCard from "../components/LiveProductCard";
import { formatUniversalMoney } from "../components/UniversalProductDialog";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { productPathFor } from "../mt/productRoute";
import { acquireLiveSymbiosis } from "../utopy/liveSymbiosis.singleton";
import { projectLiveProfile, publicProfileOfferTitle } from "../social/liveProfile";
import { resolveCurrentIdentityContext, type CurrentIdentityContext } from "../utopy/identityContext";
import { profileHandleForIdentity } from "../mt/productRoute";
import { resolveLivingNode } from "../utopy/livingNodeProjection";
import { openMOWithLivingNode } from "../mt/mo.capabilityBridge";
import LivingProfileQuickView from "../components/LivingProfileQuickView";
import LivingHighlights from "../components/LivingHighlights";
import { projectLivingResume } from "../social/livingResume";
import { LivingResumeView } from "../components/LivingResume";
import { studioProfileUrl } from "../utopy/studioProfileBridge";
import { canPersonalizeProfile } from "../utopy/studioEntitlements";
import { projectLivingNodes } from "../utopy/livingNodeProjection";
import { activeNeedsForActor, contextualCapabilities, groupLivingActivity } from "../utopy/livingNodeUX";
const ResumeEditor = lazy(() => import("../components/LivingResume").then(module => ({ default: module.LivingResumeEditor })));
const liveTitle = (dv: any) => publicProfileOfferTitle(dv) || "Publicación";

export default function LiveProfilePage() {
  const { handle = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [allLive, setAllLive] = useState<any[]>(() => mtLiveSnapshot());
  const [ownIdentity, setOwnIdentity] = useState<CurrentIdentityContext | null>(null);
  const [syncing, setSyncing] = useState(() => navigator.onLine);
  const [showFull, setShowFull] = useState(() => new URLSearchParams(window.location.search).get("full") === "1");
  const [shareNotice, setShareNotice] = useState("");
  const reserved = new Set(["falcon", "producto", "oferta", "pedido", "market", "mapa", "login", "payment", "renta", "store", "daily", "capital", "skylines", "totem"]);
  useEffect(() => {
    const release = acquireLiveSymbiosis();
    const unsubscribe = mtLiveSubscribe(setAllLive);
    const settle = window.setTimeout(() => setSyncing(false), 4000);
    const onStatus = (event: Event) => {
      const state = (event as CustomEvent)?.detail?.state;
      if (state === "loading" || state === "discovering") setSyncing(true);
      if (["live", "cached", "error"].includes(state)) setSyncing(false);
    };
    const onOffline = () => setSyncing(false);
    window.addEventListener("utopy:catalog-source:status", onStatus as EventListener);
    window.addEventListener("offline", onOffline);
    return () => { window.clearTimeout(settle); unsubscribe(); release(); window.removeEventListener("utopy:catalog-source:status", onStatus as EventListener); window.removeEventListener("offline", onOffline); };
  }, []);
  useEffect(() => { let active = true; void resolveCurrentIdentityContext({ allLive }).then((identity) => { if (active) setOwnIdentity(identity); }).catch(() => {}); return () => { active = false; }; }, [allLive]);
  const profile = useMemo(() => {
    if (reserved.has(handle.toLowerCase())) return null;
    const projected = projectLiveProfile(allLive, handle);
    if (projected) return projected;
    if (!ownIdentity) return null;
    const ownHandle = profileHandleForIdentity(ownIdentity, ownIdentity.displayName);
    if (![ownHandle, ownIdentity.actorId, ownIdentity.nodeId].filter(Boolean).includes(handle)) return null;
    return { id: ownIdentity.actorId, actorId: ownIdentity.actorId, nodeId: ownIdentity.nodeId || "", handle: ownHandle, name: ownIdentity.displayName || "Mi Perfil Vivo", avatar: "", bio: "", collection: "", territory: "", verified: true, products: [], offers: [], capabilities: [], activity: [], presence: null, source: ownIdentity };
  }, [allLive, handle, ownIdentity]);
  const livingNode = useMemo(() => resolveLivingNode(handle, allLive), [handle, allLive]);
  const resume = useMemo(() => projectLivingResume(allLive, profile?.actorId || "", ownIdentity?.actorId || ""), [allLive, profile?.actorId, ownIdentity?.actorId]);
  const own = Boolean(ownIdentity && [profile?.actorId, profile?.nodeId].filter(Boolean).some((id) => id === ownIdentity.actorId || id === ownIdentity.nodeId));
  const personalization = own && canPersonalizeProfile(allLive, ownIdentity?.actorId || "", profile?.nodeId || "");
  const needs = useMemo(() => activeNeedsForActor(allLive, String(ownIdentity?.actorId || "")), [allLive, ownIdentity?.actorId]);
  const capabilities = useMemo(() => livingNode ? contextualCapabilities(livingNode, needs) : [], [livingNode, needs]);
  const activity = useMemo(() => groupLivingActivity(profile?.activity || [], projectLivingNodes(allLive)).slice(0, 3), [profile?.activity, allLive]);
  const goBack = () => {
    const returnTo = (location.state as any)?.returnTo;
    if (typeof returnTo === "string" && returnTo.startsWith("/")) navigate(returnTo);
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/market?tab=mercado");
  };
  const createWithNode = () => {
    if (!livingNode) return;
    openMOWithLivingNode(livingNode, `/${profile?.handle || handle}`);
    navigate(`/market/mapa?view=publicar&createWith=${encodeURIComponent(livingNode.handle || handle)}&returnTo=${encodeURIComponent(`/${profile?.handle || handle}`)}`);
  };
  if (!profile && syncing) return <main className="mx-auto min-h-[70vh] max-w-5xl px-4 pt-8"><div className="rounded-[32px] border border-slate-100 bg-white p-7"><div className="h-24 w-24 animate-pulse rounded-[30px] bg-slate-100 motion-reduce:animate-none"/><div className="mt-5 h-7 w-52 rounded bg-slate-100"/><p className="mt-4 text-sm font-bold text-slate-500">⌁ Actualizando actividad…</p></div></main>;
  if (!profile) return <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 text-center"><div><div className="text-5xl">◌</div><h1 className="mt-4 text-2xl font-black">Estamos terminando de reconocer este Nodo Vivo.</h1><p className="mt-2 text-sm text-slate-500">Su identidad pública todavía se está sincronizando.</p><button className="mt-5 rounded-full bg-slate-950 px-5 py-3 font-bold text-white" onClick={goBack}>Volver</button></div></main>;
  if (!showFull) return <LivingProfileQuickView open allLive={allLive} activeActor={ownIdentity} target={livingNode || profile} own={own} syncing={syncing} onClose={goBack} onSay={() => navigate("/market/mapa?view=publicar")} onConsult={() => navigate(`/market?tab=circular&view=red&focus=${encodeURIComponent(profile.id)}`)} onEdit={own ? () => navigate("/market?tab=circular&view=red&quick=profile") : undefined} onMap={() => navigate(`/market?tab=circular&view=mapa&focus=${encodeURIComponent(profile.id)}&returnTo=${encodeURIComponent(`/${profile.handle}`)}`)} onFull={() => setShowFull(true)} />;
  const mapUrl = `/market?tab=circular&view=mapa&focus=${encodeURIComponent(profile.id)}&returnTo=${encodeURIComponent(`/${profile.handle}`)}`;
  const share = async () => { try { const url = new URL(`/${encodeURIComponent(profile.handle)}?full=1`, window.location.origin).href; if (navigator.share) await navigator.share({ title: profile.name, text: profile.bio, url }); else { await navigator.clipboard.writeText(url); setShareNotice("Enlace público copiado."); } } catch (error: any) { if (error?.name !== "AbortError") setShareNotice("No pudimos compartir el enlace."); } };
  const studio = studioProfileUrl(allLive, { actorId: profile.actorId, nodeId: profile.nodeId }, window.location.origin + location.pathname);
  return <main className="upl-profile mx-auto max-w-5xl space-y-7 px-4 pb-28 pt-8">
    <section className="upl-hero overflow-hidden rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_28px_80px_rgba(15,23,42,.12)] md:p-8">
      <div className="upl-cover" aria-hidden="true"><span/><i/></div>
      <button type="button" onClick={goBack} className="mb-5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black">← Volver</button>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><LivingHighlights allLive={allLive} actor={ownIdentity} nodeId={livingNode?.id || profile.id} variant="avatar"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-50 text-4xl">{profile.avatar ? <img src={profile.avatar} alt={profile.name} loading="eager" decoding="async" className="h-full w-full object-cover" /> : "◈"}</div></LivingHighlights><div className="min-w-0 flex-1"><h1 className="text-3xl font-black text-slate-950">{profile.name} {profile.verified ? <span className="text-emerald-500">✓</span> : null}</h1><p className="mt-1 font-bold text-slate-500">@{profile.handle}</p>{profile.collection ? <span className="mt-3 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{profile.collection}</span> : null}{profile.bio ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{profile.bio}</p> : null}{profile.territory ? <p className="mt-2 text-sm font-semibold text-slate-500">📍 {profile.territory}</p> : null}{syncing ? <p className="mt-2 text-xs font-bold text-slate-400">⌁ Actualizando actividad…</p> : null}</div></div>
      <div className="mt-6 flex flex-wrap gap-2"><button onClick={() => navigate(`/market?tab=circular&view=red&focus=${encodeURIComponent(profile.id)}&returnTo=${encodeURIComponent(`/${profile.handle}`)}`)} className="rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white">💬 Hablar</button>{livingNode?.capabilities.length ? <button onClick={createWithNode} className="rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white">✨ Crear con este nodo</button> : null}<button onClick={() => navigate(mapUrl)} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold">🗺 Ver en mapa</button><button onClick={() => void share()} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold">↗ Compartir</button></div>
      {shareNotice ? <p role="status" className="mt-3 text-sm">{shareNotice}</p> : null}
      {personalization && studio ? <a className="uli-studio mt-5" href={studio}><span><b>Personalizar mi espacio</b><small>Diseñar en Fundación Studio</small></span><span aria-hidden="true">↗</span></a> : own ? <p className="mt-5 text-sm text-slate-500">Tu perfil y currículum son gratuitos. Personalización visual opcional con Pass activo.</p> : null}
    </section>
    {profile.products.length || profile.offers.length ? <section><h2 className="mb-3 text-xl font-black">{own ? "Lo que ofrecés" : "Lo que ofrece"}</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{profile.products.map((product) => <LiveProductCard key={product.id} title={product.title} seller={profile.name} collection={product.collection} price={formatUniversalMoney(product.finalPrice, product.currency)} image={product.image} actionLabel="Ver" onAction={() => navigate(productPathFor(product, profile.products))} />)}</div>{profile.offers.length ? <div className="mt-3 grid gap-2">{profile.offers.map((offer) => <button key={offer.id} onClick={() => navigate(`/oferta/${encodeURIComponent(offer.id)}`)} className="rounded-[20px] border border-slate-200 bg-white p-4 text-left font-bold">✨ {liveTitle(offer)} <span className="float-right">→</span></button>)}</div> : null}</section> : null}
    {own ? <details className="utopy-ui utopy-card"><summary className="cursor-pointer font-semibold">{resume ? "Editar mi currículum completo" : "Crear mi currículum completo"}</summary><Suspense fallback={<p>Abriendo tu currículum…</p>}><ResumeEditor allLive={allLive} activeActor={ownIdentity}/></Suspense></details> : null}
    {resume ? <LivingResumeView resume={resume} /> : null}
    {capabilities.length ? <section><h2 className="mb-3 text-xl font-black">{own ? "Lo que podés hacer" : needs.length ? "Puede ayudarte con" : "Lo que puede hacer"}</h2><div className="flex flex-wrap gap-2">{capabilities.slice(0, 3).map((item) => <span key={item.capability.id} className="rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-800">{item.label}</span>)}</div>{capabilities.length > 3 ? <p className="mt-2 text-sm font-bold text-slate-400">＋ {capabilities.length - 3} más</p> : null}</section> : null}
    {own && livingNode?.needs.length ? <section><h2 className="mb-3 text-xl font-black">Lo que buscás ahora</h2><div className="space-y-2">{livingNode.needs.slice(0, 3).map((dv: any) => <div key={dv.id} className="rounded-[20px] bg-slate-50 p-4 font-bold">{liveTitle(dv)}</div>)}</div></section> : null}
    {activity.length ? <section><h2 className="mb-3 text-xl font-black">Actividad</h2><div className="space-y-2">{activity.map((group) => <div key={group.id} className="rounded-[20px] bg-slate-50 p-4"><b>{group.icon} {group.title}</b><p className="mt-1 text-sm text-slate-600">{group.detail}</p></div>)}</div></section> : null}
    {profile.presence ? <section className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5"><h2 className="font-black">Mapa</h2><p className="mt-1 text-sm text-emerald-900">Presencia pública aproximada{profile.presence.territory ? ` · ${profile.presence.territory}` : ""}</p><button onClick={() => navigate(mapUrl)} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold">Abrir Mapa Circular →</button></section> : null}
  </main>;
}
