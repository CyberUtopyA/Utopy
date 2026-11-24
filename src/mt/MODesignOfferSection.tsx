import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveLivingIdentity } from "../social/liveProfile";

const human = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() || fallback : fallback;
const imageUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : "";

function projectPhotos(dv: any) {
  const gallery = Array.isArray(dv?.attrs?.gallery) ? dv.attrs.gallery : [];
  const refs = [
    ...gallery.map((entry: any) => ({ url: typeof entry === "string" ? entry : entry?.url, note: typeof entry === "object" ? entry?.note : "" })),
    ...(Array.isArray(dv?.attrs?.artifacts) ? dv.attrs.artifacts.filter((entry: any) => /image|preview/i.test(String(entry?.format || ""))).map((entry: any) => ({ url: entry?.ref, note: entry?.name || "" })) : []),
    { url: dv?.attrs?.image || dv?.attrs?.imageUrl, note: "" },
  ].map((entry) => ({ ...entry, url: imageUrl(entry.url) })).filter((entry) => entry.url);
  return [...new Map(refs.map((entry) => [entry.url, entry])).values()].slice(0, 8);
}

export default function MODesignOfferSection({ allLive = [] }: { allLive: any[] }) {
  const designs = useMemo(() => {
    const latest = new Map<string, any>();
    for (const dv of allLive) {
      if (!/^(design\.outcome|design\.publication)$/.test(String(dv?.kind || ""))) continue;
      const attrs = dv.attrs || {};
      const scopes = dv.meta?.scopes || attrs.scopes || [];
      if (attrs.status !== "published" || attrs.discoverable === false || !Array.isArray(scopes) || !scopes.includes("public")) continue;
      const designId = human(attrs.designId, String(dv.id || ""));
      const previous = latest.get(designId);
      if (!previous || Number(dv.meta?.version || 0) > Number(previous.meta?.version || 0) || String(dv.meta?.updatedAt || dv.meta?.ts || "") > String(previous.meta?.updatedAt || previous.meta?.ts || "")) latest.set(designId, dv);
    }
    return [...latest.values()].sort((a, b) => String(b.meta?.updatedAt || b.meta?.ts || "").localeCompare(String(a.meta?.updatedAt || a.meta?.ts || "")));
  }, [allLive]);

  if (!designs.length) return null;
  return <section className="mb-6 rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={19}/></span><div><h3 className="text-lg font-black text-slate-900">Diseños para hacer realidad</h3><p className="text-xs text-slate-500">Ideas publicadas desde MO, con sus imágenes y conversación.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{designs.map((dv) => <MODesignCard key={dv.id} dv={dv} allLive={allLive}/> )}</div>
  </section>;
}

function MODesignCard({ dv, allLive }: { dv: any; allLive: any[] }) {
  const photos = useMemo(() => projectPhotos(dv), [dv]);
  const [active, setActive] = useState(0);
  const attrs = dv.attrs || {};
  const title = human(attrs.title, "Diseño vivo");
  const description = human(attrs.description, "Una idea compartida para explorar y materializar.");
  const designId = human(attrs.designId, String(dv.id || ""));
  const threadId = human(attrs.threadId, human(dv.meta?.threadId));
  const identityRef = human(attrs.authorActorId, human(attrs.actorId, human(attrs.author?.id)));
  const profile = resolveLivingIdentity(identityRef, allLive);
  const author = profile.name || "Persona";
  return <article className="overflow-hidden rounded-[20px] border border-white bg-white shadow-[0_8px_24px_rgba(37,35,62,.08)]">
    <div className="relative aspect-[16/10] bg-gradient-to-br from-violet-100 to-amber-50">{photos.length ? <img src={photos[active].url} alt={title} loading="lazy" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-violet-400"><Sparkles size={30}/></div>}
      {photos.length > 1 ? <><button type="button" aria-label="Foto anterior" onClick={() => setActive((index) => (index - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow"><ChevronLeft size={18}/></button><button type="button" aria-label="Foto siguiente" onClick={() => setActive((index) => (index + 1) % photos.length)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow"><ChevronRight size={18}/></button><span className="absolute bottom-2 right-2 rounded-full bg-slate-950/65 px-2 py-1 text-[10px] font-bold text-white">{active + 1}/{photos.length}</span></> : null}
      {photos[active]?.note ? <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-xl bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-700">{photos[active].note}</span> : null}
    </div>
    <div className="p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-violet-600">{profile.avatar ? <img src={profile.avatar} alt="" className="h-6 w-6 rounded-full object-cover"/> : <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-100 text-violet-600">✦</span>}<span>Idea de {author}</span></div><h4 className="line-clamp-1 text-base font-black text-slate-900">{title}</h4><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-slate-600">{description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{(Array.isArray(attrs.materials) ? attrs.materials : []).slice(0, 3).map((item: any) => <span key={String(item?.id || item)} className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{typeof item === "string" ? item : item?.label || "Material"}</span>)}</div>
      {human(attrs.designNotes) ? <p className="mt-2 line-clamp-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">✦ {human(attrs.designNotes)}</p> : null}
      {threadId ? <Link to={`/conversacion/${encodeURIComponent(threadId)}?from=market&to=${encodeURIComponent(identityRef)}`} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-extrabold text-white no-underline transition hover:bg-violet-700"><MessageCircle size={15}/>Conversar sobre esta idea<ArrowRight size={14}/></Link> : <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">La persona puede recibir consultas desde su publicación.</p>}
      <div className="mt-2 text-center text-[9px] text-slate-400">No es una oferta con precio hasta que alguien la cotice.</div>
    </div>
  </article>;
}
