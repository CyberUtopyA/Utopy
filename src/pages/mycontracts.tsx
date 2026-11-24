import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPrivateContract, freezePrivateContract, listMyPrivateContracts, type PrivateContract } from "../mt/contract.private";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { proposeRentalRenewal, respondRentalRenewal } from "../mt/rental.domain";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { formatRentalMoney } from "../utils/rentalProperty";

export function MyContractsContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PrivateContract[]>([]);
  const [error, setError] = useState("");
  const [live, setLive] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [actorId, setActorId] = useState("");
  const [renewing, setRenewing] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void listMyPrivateContracts().then(setItems).catch(() => setError("No se pudieron abrir tus contratos.")); void resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() }).then((identity) => setActorId(identity.actorId)).catch(() => {}); return mtLiveSubscribe((next) => setLive(next as any[])); }, []);
  const eventsByContract = useMemo(() => new Map(items.map((item) => [item.contractId, live.filter((dv) => String(dv?.attrs?.contractId || dv?.attrs?.previousContractId || "") === item.contractId)])), [items, live]);
  const propose = async (item: PrivateContract) => { if (!start || !end || end <= start) { setError("Elegí una nueva vigencia válida."); return; } try { setBusy(true); setError(""); await proposeRentalRenewal({ propertyId: item.propertyId, unitId: item.roomId, previousContractId: item.contractId, periodStart: start, periodEnd: end, terms: { canon: item.document?.contrato?.canon, moneda: item.document?.contrato?.moneda }, allLive: live }); setRenewing(""); } catch (cause: any) { setError(cause?.message || "No se pudo proponer la renovación."); } finally { setBusy(false); } };
  const answer = async (item: PrivateContract, proposal: any, accept: boolean) => { const role = actorId === item.landlordActorId ? "owner" : actorId === item.tenantActorId ? "tenant" : null; if (!role) return; try { setBusy(true); setError(""); const result = await respondRentalRenewal({ renewalId: proposal.id, role, accept, allLive: live }); if (result?.dv?.kind === "rental.renewal.activated") { const contractId = String(result.dv.attrs?.contractId || ""); const document = { ...item.document, contrato: { ...(item.document?.contrato || {}), inicio: proposal.attrs?.periodStart, fin: proposal.attrs?.periodEnd }, renewal: { previousContractId: item.contractId, renewalId: proposal.id } }; await createPrivateContract({ contractId, state: "active", ownerId: item.ownerId, propertyId: item.propertyId, roomId: item.roomId, landlordActorId: item.landlordActorId, tenantActorId: item.tenantActorId, authorizedAdminActorIds: item.authorizedAdminActorIds, document }); await freezePrivateContract(contractId, "active"); setItems(await listMyPrivateContracts()); } } catch (cause: any) { setError(cause?.message || "No se pudo responder a la renovación."); } finally { setBusy(false); } };
  return <div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/80 bg-white/95 p-6 text-slate-950 shadow-[0_24px_80px_rgba(40,50,90,.2)] backdrop-blur-xl sm:p-8">
    <div>
      <span className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Falcon Skylines · privado</span>
      <div className="flex items-start justify-between gap-3"><h1 className="mt-2 text-3xl font-black tracking-tight">Mis contratos</h1>{onClose ? <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow"><X size={20}/></button> : null}</div>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={16}/>Solo ves documentos donde tu Identidad Viva participa.</p>
      {error ? <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
      <div className="mt-7 grid gap-4 sm:grid-cols-2">{items.map((item) => {
        const events = eventsByContract.get(item.contractId) || [];
        const proposals = events.filter((dv) => dv?.kind === "rental.renewal.proposed");
        const payments = events.filter((dv) => /payment|receipt|cuota/.test(String(dv?.kind || "")));
        return <article key={item.contractId} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><FileText className="text-cyan-700"/><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item.state === "active" ? "Activo" : item.state.replaceAll("_", " ")}</span></div>
        <h2 className="mt-4 text-lg font-black">{item.document?.property?.name || item.document?.inmueble?.nombre || "Contrato de alquiler"}</h2>
        <p className="mt-1 text-sm text-slate-500">Unidad {item.document?.property?.roomId || item.roomId}</p>
        <strong className="mt-4 block">{formatRentalMoney(item.document?.contrato?.canon, item.document?.contrato?.moneda)}</strong>
        <p className="mt-1 text-xs text-slate-400">{item.document?.contrato?.inicio || "Inicio por definir"} · {item.document?.contrato?.fin || "Vencimiento por definir"}</p>
        <p className="mt-3 text-xs text-slate-500">{payments.length ? `${payments.length} pagos o recibos` : "Sin pagos registrados"} · {proposals.length ? "Renovación en curso" : "Sin renovación pendiente"}</p>
        <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigate(`/contratos/${encodeURIComponent(item.contractId)}`)} className="min-h-11 rounded-2xl bg-slate-950 px-4 font-black text-white">Ver documento</button>{item.state === "active" ? <button type="button" onClick={() => { setRenewing(item.contractId); setStart(item.document?.contrato?.fin || ""); setEnd(""); }} className="flex min-h-11 items-center gap-1 rounded-2xl border border-indigo-200 px-4 text-sm font-black text-indigo-700"><RefreshCw size={15}/>Renovar</button> : null}</div>
        {renewing === item.contractId ? <div className="mt-4 grid gap-2 rounded-2xl bg-indigo-50 p-3"><strong className="text-xs">Nueva vigencia</strong><div className="grid grid-cols-2 gap-2"><label className="text-xs">Desde<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-xl border p-2"/></label><label className="text-xs">Hasta<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-xl border p-2"/></label></div><button type="button" disabled={busy} onClick={() => void propose(item)} className="min-h-10 rounded-xl bg-indigo-600 text-xs font-black text-white disabled:opacity-50">Enviar propuesta</button></div> : null}
        {proposals.map((proposal) => { const role = actorId === item.landlordActorId ? "owner" : actorId === item.tenantActorId ? "tenant" : null; const decision = role && live.find((dv) => dv?.id === `${proposal.id}:consent:${role}`); return <div key={proposal.id} className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs"><strong>Renovación · {proposal.attrs?.periodStart} a {proposal.attrs?.periodEnd}</strong>{decision ? <p className="mt-1 text-slate-500">Tu respuesta: {decision.attrs?.consent ? "aceptada" : "rechazada"}</p> : role ? <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => void answer(item, proposal, true)} className="rounded-full bg-emerald-100 px-3 py-2 font-black text-emerald-800">Aceptar</button><button type="button" disabled={busy} onClick={() => void answer(item, proposal, false)} className="rounded-full bg-white px-3 py-2 font-black">No aceptar</button></div> : null}</div>; })}
      </article>;
      })}</div>
      {!error && !items.length ? <p className="mt-8 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Todavía no tenés contratos vinculados a esta identidad.</p> : null}
    </div>
  </div>;
}

export default function MyContractsPage() { return <main className="mx-auto min-h-[70vh] max-w-5xl px-3 py-8"><MyContractsContent/></main>; }
