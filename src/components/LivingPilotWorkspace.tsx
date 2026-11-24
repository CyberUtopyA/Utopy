import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import { ArrowLeft, Download, Mic, Plus, ShieldCheck } from "lucide-react";
import { useContextualVoice } from "../utopy/useContextualVoice";
import { LIVING_PILOTS, createPilotDemonstration, extractOfferLines, quoteTotal, verifyPilotProof, type PilotKey, type QuoteLine } from "../pilots/livingPilots";

type Session = Awaited<ReturnType<typeof createPilotDemonstration>>;
const money = (value: number) => `Gs. ${value.toLocaleString("es-PY")}`;

export default function LivingPilotWorkspace({ pilot }: { pilot: PilotKey }) {
  const config = LIVING_PILOTS[pilot];
  const navigate = useNavigate();
  const session = useRef<Session | null>(null);
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [notice, setNotice] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [approved, setApproved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bundle, setBundle] = useState<any>(null);
  const [qr, setQr] = useState("");
  const [proofStatus, setProofStatus] = useState("");
  const voice = useContextualVoice(value => { setText(value); invalidate(); });
  useEffect(() => {
    let disposed = false;
    void createPilotDemonstration(pilot).then(value => { if (disposed) void value.revoke(); else session.current = value; });
    return () => { disposed = true; void session.current?.revoke(); session.current = null; };
  }, [pilot]);
  useEffect(() => {
    const encoded = new URLSearchParams(location.hash.slice(1)).get("demoProof");
    if (!encoded) return;
    if (encoded.length > 12000) { setProofStatus("Constancia demasiado grande."); return; }
    try {
      const proof = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), character => character.charCodeAt(0))));
      void verifyPilotProof(proof).then(valid => setProofStatus(valid ? "Firma e integridad de la demostración verificadas. No acredita una reparación, venta ni pago real; la autoridad del propietario no está verificada." : "No se pudo verificar esta constancia."));
    } catch { setProofStatus("Constancia inválida."); }
  }, []);
  function invalidate() { setReady(false); setApproved(false); setConfirmed(false); setBundle(null); setQr(""); setCompleted(0); void session.current?.revoke(); }
  const act = async (task: (current: Session) => Promise<void>) => {
    if (!session.current || busy) return;
    setBusy(true); setNotice("");
    try { await task(session.current); } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo completar."); } finally { setBusy(false); }
  };
  let total: number | null = null;
  try { if (lines.length) total = quoteTotal(lines); } catch { /* Invalid inputs remain editable. */ }
  const updateLine = (index: number, field: keyof QuoteLine, value: string) => {
    invalidate(); setLines(current => current.map((line, position) => position === index ? { ...line, [field]: field === "quantity" || field === "unitPrice" ? Number(value) : value } : line));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${pilot}-demostracion-firmada.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="mx-auto max-w-4xl space-y-5 pb-12 text-slate-900">
    <button type="button" className="flex min-h-11 items-center gap-2 font-bold" onClick={() => navigate("/falcon/daily")}><ArrowLeft size={18}/> Volver a Daily</button>
    <header className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-5 sm:p-8">
      <span className="text-xs font-bold uppercase tracking-widest text-amber-800">Piloto · demostración local</span>
      <h1 className="mt-2 text-3xl font-black">{config.icon} {config.name}</h1><p className="mt-2 text-slate-600">{config.summary}</p>
      <p className="mt-3 text-sm">Los pasos se ensayan con Runtime y evidencia firmada. No se publican ofertas ni se realizan reparaciones, entregas o cobros reales.</p>
      <div className="mt-4 flex flex-wrap gap-2">{config.modules.map(label => <span key={label} className="rounded-full border bg-white px-3 py-2 text-xs font-bold">{label}</span>)}</div>
      <p className="mt-4 text-xs text-slate-500">Para operar: vincular la Identidad Viva del propietario y sus autorizaciones desde Mi panel. No hay ubicación, horarios, clientes ni propietarios inventados.</p>
    </header>
    {proofStatus ? <div role="status" className="rounded-2xl border bg-white p-5"><ShieldCheck className="mb-2"/>{proofStatus}</div> : null}
    <article className="space-y-4 rounded-[28px] border bg-white p-4 sm:p-7">
      <h2 className="text-xl font-black">Contalo con tus palabras</h2>
      <textarea aria-label="Intención" value={text} onChange={event => { setText(event.target.value); invalidate(); }} rows={3} className="w-full rounded-2xl border p-4 text-base" placeholder={config.sample}/>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={voice.start} className="flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold"><Mic size={18}/>{voice.listening ? "Detener" : "Hablar"}</button>
        <button type="button" className="min-h-11 rounded-xl border px-4 font-bold" onClick={() => { invalidate(); setText(config.sample); if (pilot === "don-mencia") setLines(extractOfferLines(config.sample)); }}>Cargar ejemplo ilustrativo</button>
        <button type="button" className="min-h-11 rounded-xl border px-4 font-bold" onClick={() => { invalidate(); const found = extractOfferLines(text); setLines(found); setNotice(found.length ? "Revisá cantidades y precios. Fecha, disponibilidad e ingredientes requieren confirmación." : "No encontré líneas completas con cantidad y precio. Podés agregarlas manualmente."); }}>Preparar líneas</button>
      </div>
      {voice.notice ? <p role="status" className="text-sm text-slate-600">{voice.notice}</p> : null}
      <p className="text-sm text-slate-600">Podés corregir el texto y cada campo. Las correcciones vuelven a requerir simulación y consentimiento.</p>
      <label className="block text-sm font-bold">Detalle confirmado para el ensayo<textarea value={detail} onChange={event => { setDetail(event.target.value); invalidate(); }} rows={2} className="mt-2 w-full rounded-2xl border p-3 text-base" placeholder="Describí lo que querés ensayar. No lo presentaremos como hecho real."/></label>
      {missing.length ? <p role="status" className="text-sm text-amber-800">Falta: detalle confirmado.</p> : null}
      <button type="button" disabled={busy || !text.trim()} onClick={() => void act(async current => { const form = await current.prepare(text, detail); setMissing(form.missing); setNotice(form.valid ? "Formulario Runtime válido para el ensayo local." : "Completá o corregí el detalle requerido."); })} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-40">Revisar Formulario Vivo</button>
    </article>
    <article className="space-y-3 rounded-[28px] border bg-white p-4 sm:p-7">
      <h2 className="text-xl font-black">{pilot === "encicar" ? "Presupuesto detallado" : "Productos y disponibilidad propuesta"}</h2>
      <p className="text-sm text-slate-500">Valores de demostración editables. No son precios publicados ni existencias confirmadas.</p>
      {lines.map((line, index) => <fieldset key={index} className="grid min-w-0 grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-4">
        <label className="col-span-2 text-xs font-bold sm:col-span-1">Descripción<input aria-label={`Descripción ${index + 1}`} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border p-2 text-base" value={line.description} onChange={event => updateLine(index, "description", event.target.value)}/></label>
        <label className="text-xs font-bold">Cantidad<input type="number" min="0.001" step="any" className="mt-1 min-h-11 w-full rounded-xl border p-2 text-base" value={line.quantity} onChange={event => updateLine(index, "quantity", event.target.value)}/></label>
        <label className="text-xs font-bold">Unidad<input className="mt-1 min-h-11 w-full rounded-xl border p-2 text-base" value={line.unit} onChange={event => updateLine(index, "unit", event.target.value)}/></label>
        <label className="text-xs font-bold">Precio unitario · Gs.<input type="number" min="0" step="1" className="mt-1 min-h-11 w-full rounded-xl border p-2 text-base" value={line.unitPrice} onChange={event => updateLine(index, "unitPrice", event.target.value)}/></label>
        <button type="button" className="min-h-11 text-sm text-rose-700" onClick={() => { invalidate(); setLines(current => current.filter((_, position) => position !== index)); }}>Quitar línea</button>
      </fieldset>)}
      <button type="button" className="flex min-h-11 items-center gap-2 font-bold" onClick={() => { invalidate(); setLines(current => [...current, { description: "", quantity: 1, unit: "u", unitPrice: 0 }]); }}><Plus size={18}/>Agregar repuesto, trabajo o producto</button>
      <p className="flex justify-between gap-3 border-t pt-4 font-black"><span>Total propuesto · demostración</span><span>{total == null ? "Por completar" : money(total)}</span></p>
    </article>
    <article className="space-y-4 rounded-[28px] bg-slate-950 p-5 text-white sm:p-7">
      <h2 className="text-xl font-black">Tu recorrido</h2><ol className="grid gap-2 sm:grid-cols-2">{config.steps.map((step, index) => <li key={step} className={`rounded-xl border p-3 ${index < completed ? "border-emerald-600 text-emerald-300" : "border-slate-700"}`}>{index < completed ? "✓" : index + 1} {step}{index < completed ? " · ensayado" : ""}</li>)}</ol>
      <button type="button" disabled={busy || !text.trim() || completed > 0 || (lines.length > 0 && total == null)} onClick={() => void act(async current => { if (!detail.trim()) { setMissing(["detail"]); throw Error("Completá el detalle confirmado."); } const result = await current.simulate(text, JSON.stringify({ detail, lines, total, currency: "PYG", simulation: true, nonTradable: true })); setReady(result.viable); setApproved(false); setNotice(result.viable ? "Simulación viable. Solo efectos locales de demostración." : "La simulación tiene requisitos pendientes."); })} className="min-h-11 rounded-xl bg-white px-5 font-bold text-slate-950 disabled:opacity-40">Simular con Runtime</button>
      {ready && !approved ? <><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Autorizo únicamente este ensayo local. No autoriza gastos, publicaciones, trabajos ni pagos.</label><button type="button" disabled={!confirmed || busy} onClick={() => void act(async current => { await current.authorize(confirmed); setApproved(true); })} className="min-h-11 rounded-xl bg-amber-300 px-5 font-bold text-slate-950 disabled:opacity-40">Confirmar ensayo</button></> : null}
      {approved && completed < config.steps.length ? <button type="button" disabled={busy} onClick={() => void act(async current => { const result = await current.advance(); setCompleted(result.completed); if (result.done) { const proof = await current.exportProof(); setBundle(proof.bundle); const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(proof.proof)))); setQr(`${location.origin}/falcon/daily?pilot=${pilot}#demoProof=${encodeURIComponent(encoded)}`); } })} className="block min-h-12 w-full rounded-xl bg-emerald-300 px-5 font-black text-slate-950 disabled:opacity-40">Ensayar: {config.steps[completed]}</button> : null}
      {approved ? <button type="button" disabled={busy} className="min-h-11 text-sm underline" onClick={() => { invalidate(); setNotice("Autorización local revocada."); }}>Revocar autorización</button> : null}
      {notice ? <p role="status" aria-live="polite" className="rounded-xl bg-white/10 p-3 text-sm">{notice}</p> : null}
    </article>
    {bundle ? <article className="space-y-3 rounded-[28px] border bg-white p-5"><ShieldCheck/><h2 className="text-xl font-black">Constancia verificable del ensayo</h2><p className="text-sm text-slate-600">Pasaporte Runtime de la demostración. No certifica una reparación ni un cobro real. El QR contiene solo una constancia pública firmada, sin clientes, diagnósticos, precios ni fotografías.</p><div className="w-fit rounded-xl border bg-white p-4"><QRCode value={qr} size={176}/></div><button type="button" onClick={download} className="flex min-h-11 items-center gap-2 font-bold"><Download size={18}/>Descargar evidencia privada y composición</button><p className="text-xs text-slate-500">Guardá el archivo antes de salir: el ensayo no se sincroniza ni conserva en el catálogo comercial.</p></article> : null}
  </section>;
}
