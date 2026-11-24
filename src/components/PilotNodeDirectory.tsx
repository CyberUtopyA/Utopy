import { ArrowLeft, ArrowUpRight, Wrench, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LIVING_PILOTS, type PilotKey } from "../pilots/livingPilotDefinitions";

// Directory presentation from the existing pilot configuration. This does not
// mint actorIds, claim ownership or announce unsigned capabilities as verified.
export default function PilotNodeDirectory({ selected }: { selected?: PilotKey }) {
  const navigate = useNavigate();
  if (selected) {
    const node = LIVING_PILOTS[selected];
    const Icon = selected === "encicar" ? Wrench : Sprout;
    return <section className="mx-auto max-w-3xl space-y-5 pb-10">
      <button type="button" className="flex min-h-11 items-center gap-2 font-bold" onClick={() => navigate("/falcon/daily")}><ArrowLeft size={18}/>Volver a Daily</button>
      <article className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm sm:p-9"><div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-800"><Icon size={30}/></div><h1 className="text-3xl font-black">{node.name}</h1><p className="mt-2 text-slate-500">{node.summary}</p><span className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Perfil en preparación · propietario pendiente de vincular</span><div className="mt-6 flex flex-wrap gap-2">{node.modules.map(label => <span className="rounded-full border px-3 py-2 text-sm" key={label}>{label}</span>)}</div><p className="mt-6 text-sm leading-6 text-slate-600">El propietario debe confirmar sus servicios o productos, contacto, disponibilidad e identidad antes de recibir operaciones. Todavía no hay precios, ubicación ni trabajos reales publicados para este perfil.</p><button type="button" className="mt-5 min-h-11 rounded-full bg-slate-950 px-5 font-bold text-white" onClick={() => navigate("/market?tab=mercado")}>Volver a MS Market</button></article>
    </section>;
  }
  return <section aria-label="Nodos de la comunidad" className="space-y-3"><h2 className="text-lg font-black">Nodos de la comunidad</h2><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(LIVING_PILOTS) as PilotKey[]).map(key => { const node = LIVING_PILOTS[key]; const Icon = key === "encicar" ? Wrench : Sprout; return <button type="button" key={key} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm" onClick={() => navigate(`/falcon/daily?node=${key}`)}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800"><Icon size={23}/></span><span className="min-w-0 flex-1"><b className="block">{node.name}</b><small className="block text-slate-500">{node.summary}</small><small className="mt-1 block text-slate-400">Perfil en preparación</small></span><ArrowUpRight size={18}/></button>; })}</div></section>;
}
