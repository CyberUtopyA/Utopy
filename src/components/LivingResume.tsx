import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ExternalLink, FileDown } from "lucide-react";
import { buildLivingResumeDV, emptyLivingResume, normalizeLivingResume, projectLivingResume, type LivingResume } from "../social/livingResume";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";

const field = "min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800";

export function LivingResumeEditor({ allLive, activeActor, onSaved }: { allLive: any[]; activeActor?: any; onSaved?: () => void }) {
  const [actorId, setActorId] = useState("");
  const [draft, setDraft] = useState<LivingResume>(emptyLivingResume);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draftActor = useRef("");
  useEffect(() => { let active = true; void resolveCurrentIdentityContext({ allLive, activeActor }).then(identity => { if (active) setActorId(identity.actorId); }).catch(() => setNotice("No pudimos resolver tu identidad.")); return () => { active = false; }; }, [activeActor, allLive]);
  const saved = useMemo(() => projectLivingResume(allLive, actorId, actorId), [allLive, actorId]);
  useEffect(() => {
    if (draftActor.current !== actorId) { draftActor.current = actorId; setDirty(false); setNotice(""); setDraft(saved || emptyLivingResume()); }
    else if (!dirty) setDraft(saved || emptyLivingResume());
  }, [saved, actorId, dirty]);
  const change = (next: LivingResume) => { setDraft(next); setDirty(true); setNotice(""); };
  const save = async () => {
    if (saving || !actorId) return;
    setSaving(true);
    try {
      const dv = buildLivingResumeDV(actorId, draft);
      await publishAuthorizedDV({ dv, allLive, activeActor, action: "living.resume.update", actingAsNodeId: null, requiredAuthority: actorId, sensitivity: "relationship", localOnly: !draft.public });
      setDirty(false); setNotice(draft.public ? "Currículum firmado y publicado. Si antes compartiste otra versión, sus destinatarios pueden conservarla." : "Currículum firmado y guardado como privado. Las copias que antes compartiste no se pueden retirar de sus destinatarios."); onSaved?.();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); }
  };
  return <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 text-slate-900 sm:p-6" aria-label="Crear mi currículum vivo">
    <div><h3 className="text-xl font-black">Mi currículum vivo</h3><p className="mt-1 text-sm leading-6 text-slate-500">Personal, profesional, creativo o deportivo. Contá qué sabés hacer y mostralo con experiencias y enlaces.</p></div>
    <label className="block text-sm font-bold">Presentación<input className={`${field} mt-1`} maxLength={160} value={draft.headline} onChange={event => change({ ...draft, headline: event.target.value })} placeholder="Tu especialidad, objetivo o forma de presentarte"/></label>
    <label className="block text-sm font-bold">Sobre mí<textarea className={`${field} mt-1`} rows={3} maxLength={3000} value={draft.summary} onChange={event => change({ ...draft, summary: event.target.value })} placeholder="Tu recorrido, lo que te interesa y lo que buscás"/></label>
    <label className="block text-sm font-bold">Capacidades y habilidades<input className={`${field} mt-1`} value={draft.skills.join(", ")} onChange={event => change({ ...draft, skills: event.target.value.split(",") })} placeholder="Separá cada habilidad con una coma"/></label>
    <label className="block text-sm font-bold">Idiomas<input className={`${field} mt-1`} value={draft.languages.join(", ")} onChange={event => change({ ...draft, languages: event.target.value.split(",") })} placeholder="Idiomas que usás"/></label>
    <h4 className="font-black">Experiencia, equipos y proyectos</h4>
    {draft.experiences.map((item, index) => <fieldset key={item.id} className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">Experiencia {index + 1}</legend>{([['role', 'Rol o actividad'], ['organization', 'Organización, equipo o proyecto'], ['period', 'Período · por ejemplo 2023–2025'], ['description', 'Responsabilidades, logros y contexto']] as const).map(([name, label]) => <label key={name} className={`text-xs font-bold ${name === 'description' ? 'sm:col-span-2' : ''}`}>{label}<input className={`${field} mt-1`} value={item[name]} onChange={event => change({ ...draft, experiences: draft.experiences.map((entry, position) => position === index ? { ...entry, [name]: event.target.value } : entry) })}/></label>)}<button type="button" className={`${button} sm:col-span-2`} onClick={() => change({ ...draft, experiences: draft.experiences.filter((_, position) => position !== index) })}>Quitar experiencia</button></fieldset>)}
    <button type="button" disabled={draft.experiences.length >= 30} className={button} onClick={() => change({ ...draft, experiences: [...draft.experiences, { id: crypto.randomUUID(), role: "", organization: "", period: "", description: "" }] })}><Plus size={16}/>Agregar experiencia</button>
    <h4 className="font-black">Portafolio y enlaces destacados</h4>
    <p className="text-sm text-slate-500">Pegá un enlace a tu video, jugada, foto o proyecto. No subimos ni reproducimos videos aquí. Compartí solo lo que tenés permiso de mostrar.</p>
    {draft.highlights.map((item, index) => <fieldset key={item.id} className="grid gap-3 rounded-2xl bg-slate-50 p-3"><legend className="px-1 text-sm font-bold">Destacado {index + 1}</legend><label className="text-xs font-bold">Título<input className={`${field} mt-1`} value={item.title} onChange={event => change({ ...draft, highlights: draft.highlights.map((entry, position) => position === index ? { ...entry, title: event.target.value } : entry) })}/></label><label className="text-xs font-bold">Enlace HTTPS<input type="url" className={`${field} mt-1`} value={item.url} onChange={event => change({ ...draft, highlights: draft.highlights.map((entry, position) => position === index ? { ...entry, url: event.target.value } : entry) })} placeholder="https://…"/></label><label className="text-xs font-bold">Tipo<select className={`${field} mt-1`} value={item.kind} onChange={event => change({ ...draft, highlights: draft.highlights.map((entry, position) => position === index ? { ...entry, kind: event.target.value as 'video' | 'image' | 'link' } : entry) })}><option value="video">Video</option><option value="image">Foto o imagen</option><option value="link">Trabajo o enlace</option></select></label><label className="text-xs font-bold">Descripción<input className={`${field} mt-1`} value={item.description} onChange={event => change({ ...draft, highlights: draft.highlights.map((entry, position) => position === index ? { ...entry, description: event.target.value } : entry) })} placeholder="Qué muestra, tu participación y su contexto"/></label><button type="button" className={button} onClick={() => change({ ...draft, highlights: draft.highlights.filter((_, position) => position !== index) })}>Quitar destacado</button></fieldset>)}
    <button type="button" disabled={draft.highlights.length >= 30} className={button} onClick={() => change({ ...draft, highlights: [...draft.highlights, { id: crypto.randomUUID(), title: "", url: "", kind: "video", description: "" }] })}><Plus size={16}/>Agregar destacado</button>
    <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.public} onChange={event => change({ ...draft, public: event.target.checked })}/><span>Publicar este currículum en mi Perfil Vivo. Sin marcar, queda privado.</span></label>
    <button type="button" className={`${button} w-full !border-slate-950 !bg-slate-950 !text-white`} disabled={saving || !actorId} onClick={() => void save()}>{saving ? "Guardando…" : draft.public ? "Firmar y publicar currículum" : "Guardar currículum privado"}</button>
    {notice ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{notice}</p> : null}
    <LivingResumeView resume={normalizeLivingResume(draft)} preview/>
  </section>;
}

export function LivingResumeView({ resume, preview = false }: { resume: LivingResume; preview?: boolean }) {
  const download = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "mi-curriculum-vivo.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-7" aria-label={preview ? "Vista previa de mi currículum" : "Currículum vivo"}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">{preview ? "Vista previa" : "Currículum vivo"}</h2><button type="button" onClick={download} className={button}><FileDown size={16}/>Descargar datos</button></div>
    <h3 className="text-2xl font-bold">{resume.headline || "Tu presentación"}</h3>{resume.summary ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{resume.summary}</p> : null}
    <div className="flex flex-wrap gap-2">{resume.skills.map(skill => <span key={skill} className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{skill}</span>)}</div>
    {resume.languages.length ? <p className="text-sm text-slate-500">Idiomas: {resume.languages.join(" · ")}</p> : null}
    {resume.experiences.map(item => <section key={item.id} className="border-l-2 border-amber-200 pl-4"><h4 className="font-bold">{item.role}</h4><p className="text-sm font-semibold">{item.organization}</p><small className="text-slate-500">{item.period}</small><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p></section>)}
    {resume.highlights.length ? <div className="grid gap-3 sm:grid-cols-2">{resume.highlights.map(item => <section key={item.id} className="min-w-0 rounded-2xl border border-slate-100 p-4"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.kind === "video" ? "Video" : item.kind === "image" ? "Imagen" : "Trabajo"}</span><h4 className="mt-1 break-words font-bold">{item.title}</h4><p className="mt-2 text-sm text-slate-500">{item.description}</p>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className={`${button} mt-3`}><ExternalLink size={16}/>Abrir {item.kind === "video" ? "video" : "enlace"}</a> : null}</section>)}</div> : null}
    <p className="text-xs text-slate-400">Experiencia y habilidades declaradas por la persona. No equivalen a certificaciones verificadas. Los enlaces externos solo se abren cuando los elegís.</p>
  </article>;
}
