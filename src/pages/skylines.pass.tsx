import { useMemo, useState } from "react";
import { BellRing, CalendarClock, FileText, ReceiptText, RefreshCw, ShieldCheck, X } from "lucide-react";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { activeEntitlementDVs } from "../utopy/studioEntitlements";

const text = (value: unknown) => String(value || "").trim();

export default function SkylinesPassPanel({ open, onClose, onOpenContracts, properties, allLive, activeActor, studioPassUrl = "" }: { open: boolean; onClose: () => void; onOpenContracts: () => void; properties: any[]; allLive: any[]; activeActor?: any; studioPassUrl?: string }) {
  const [propertyId, setPropertyId] = useState("");
  const [reminders, setReminders] = useState("5,1,0");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedId = propertyId || text(properties[0]?.id);
  const related = useMemo(() => allLive.filter((dv) => text(dv?.attrs?.propertyId) === selectedId), [allLive, selectedId]);
  const metrics = useMemo(() => ({ contracts: related.filter((dv) => /contract|agreement/.test(text(dv?.kind))).length, payments: related.filter((dv) => /payment|receipt|cuota/.test(text(dv?.kind))).length, renewals: related.filter((dv) => /renew/.test(text(dv?.kind))).length }), [related]);
  const grant = useMemo(() => activeEntitlementDVs(allLive, text(activeActor?.actorId || activeActor?.id)).find((dv) => /^skylines[.-]pass$/.test(text(dv?.attrs?.productKey || dv?.attrs?.entitlementKey))), [allLive, activeActor]);
  const entitled = !!grant;
  if (!open) return null;
  const activate = async () => {
    if (!entitled) { setNotice("Primero contratá Skylines Pass en Studio."); return; }
    if (grant?.kind === "studio.entitlement") {
      const manage = text(grant?.attrs?.links?.managePass);
      if (!/^https:\/\//i.test(manage)) { setNotice("Studio todavía no anunció el enlace para gestionar tu Pass."); return; }
      const target = new URL(manage); target.searchParams.set("nodeId", text(grant.attrs.nodeId)); target.searchParams.set("returnTo", window.location.href);
      window.open(target.href, "_blank", "noopener,noreferrer"); return;
    }
    if (!selectedId) { setNotice("Primero publicá o seleccioná una propiedad."); return; }
    const days = reminders.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
    const id = `skylines.pass.policy:${selectedId}`;
    try { setSaving(true); const result = await publishAuthorizedDV({ dv: { id, kind: "rental.automation.policy", attrs: { propertyId: selectedId, state: "active", contractAutomation: true, monthlySchedule: true, paymentTracking: true, receiptTracking: true, availabilitySync: true, renewalTracking: true, reminderDays: days }, traits: ["skylines:pass", "rental:automation"], meta: { ns: "skylines:private", scopes: ["participants"] } }, allLive, activeActor, action: "skylines.pass.activate", sensitivity: "relationship" }); setNotice(result.dv ? "Skylines Pass activo para esta propiedad." : ""); } catch (error: any) { setNotice(error?.message || "No se pudo activar la automatización."); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[10050] grid place-items-center bg-indigo-950/20 p-3 backdrop-blur-md" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-cyan-200/60 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,.18),transparent_38%),rgba(255,255,255,.97)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:p-8"><header className="flex justify-between gap-4"><div><span className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">✦ Skylines Pass</span><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Tu propiedad funcionando sola.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Automatización de contratos, pagos y recordatorios.</p></div><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow"><X/></button></header>
    <label className="mt-6 grid gap-2 text-xs font-black text-slate-600">Propiedad<select value={selectedId} onChange={(event)=>setPropertyId(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">{properties.map((property)=><option key={property.id} value={property.id}>{property.name || property.title || "Propiedad"}</option>)}</select></label>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{[[FileText,"Contratos automáticos","Datos conocidos → revisar → firmar / imprimir"],[CalendarClock,"Gestión mensual","Cuotas, vencimientos, depósito y renovación"],[ReceiptText,"Cobros y recibos","Pago y comprobante vinculados al contrato"],[BellRing,"Recordatorios vivos","Avisos antes y después del vencimiento"],[RefreshCw,"Disponibilidad","La unidad sigue el resultado real del alquiler"],[ShieldCheck,"Historial privado","Inquilino, documentos y pagos por propiedad"]].map(([Icon,title,copy]:any)=><div key={title} className="rounded-[22px] border border-slate-200/70 bg-white/80 p-4 shadow-sm"><Icon size={20} className="text-cyan-700"/><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{copy}</span></div>)}</div>
    <div className="mt-5 grid grid-cols-3 gap-2">{[["Contratos",metrics.contracts],["Pagos/recibos",metrics.payments],["Renovaciones",metrics.renewals]].map(([label,value])=><div key={label} className="rounded-2xl bg-slate-950 p-3 text-white"><span className="block text-[10px] font-bold text-white/55">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>)}</div>
    <label className="mt-5 grid gap-2 text-xs font-black text-slate-600">Recordar antes del vencimiento · días<input value={reminders} onChange={(event)=>setReminders(event.target.value)} placeholder="5, 1, 0" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"/></label>
    <p className="mt-5 text-sm font-bold text-slate-600">{entitled ? "✓ Pass activo para tu Identidad Viva" : "Pass todavía no activo"}</p>
    <div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={onOpenContracts} className="min-h-12 min-w-0 rounded-full border border-slate-200 bg-white px-5 text-sm font-black">Mis contratos</button><button onClick={() => studioPassUrl ? window.open(studioPassUrl, "_blank", "noopener,noreferrer") : setNotice("Studio todavía no anunció el enlace para contratar Skylines Pass.")} className="min-h-12 min-w-0 rounded-full border border-cyan-200 bg-cyan-50 px-5 text-sm font-black text-cyan-900">Contratar Pass</button>{entitled ? <button onClick={activate} disabled={saving} className="min-h-12 min-w-0 rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">{saving?"Guardando…":grant?.kind === "studio.entitlement" ? "Gestionar automatizaciones" : "Activar automatización"}</button> : null}</div>
    {notice?<p className="mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-900">{notice}</p>:null}
  </section></div>;
}
