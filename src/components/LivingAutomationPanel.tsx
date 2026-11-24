import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { ArrowDown, ArrowUp, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
type HumanStep = { id: string; label: string; capabilityCode: string; condition?: string };

type Capability = { id?: string; code?: string; label?: string; name?: string; description?: string };
type Props = { node: any; actorId: string; suggestions: string[]; allLive: any[]; onClose: () => void; initialIntent?:string; initialTrigger?:string };
const human = (value: unknown) => String(value || "").trim();
const technical = (value: string) => /^(?:actor:|did:|utopy\.|[a-z]+\.[a-z]+|[a-z]+:[^\s]+$)/i.test(value);
const newStep = (label: string, capabilityCode = "") : HumanStep => ({ id: `step:${crypto.randomUUID()}`, label, capabilityCode });

export default function LivingAutomationPanel({ node, actorId, suggestions, allLive, onClose,initialIntent='',initialTrigger='' }: Props) {
  const [intent, setIntent] = useState(initialIntent);
  const [trigger, setTrigger] = useState(initialTrigger);
  const [steps, setSteps] = useState<HumanStep[]>([]);
  const [draftStep, setDraftStep] = useState("");
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const capabilities = useMemo(() => (Array.isArray(node?.capabilities) ? node.capabilities : []).map((item: Capability) => ({
    code: human(item.code || item.id), label: human(item.label || item.name || item.description),
  })).filter((item: { code: string; label: string }) => item.code && item.label && !technical(item.label)), [node]);
  const compositions = useMemo(() => allLive.filter((dv) => /composition\.(?:publish|propose|revise|fork)/.test(human(dv?.kind))
    && dv?.meta?.runtimeVerified === true && (dv?.payload || dv?.attrs)?.authority === node?.nodeId)
    .sort((a, b) => Number(b?.payload?.revision || 0) - Number(a?.payload?.revision || 0)), [allLive, node?.nodeId]);
  const ready = !!actorId && !!node?.nodeId && !!intent.trim() && !!trigger.trim() && steps.length > 0 && steps.every((step) => step.capabilityCode);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  const listen = () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { setNotice("La voz no está disponible en este navegador. Podés escribirlo."); return; }
    const recognition = new Speech(); recognition.lang = "es-PY"; recognition.interimResults = false;
    recognition.onresult = (event: any) => { setIntent((current) => [current, event.results?.[0]?.[0]?.transcript].filter(Boolean).join(" ")); setListening(false); };
    recognition.onerror = () => { setListening(false); setNotice("No pudimos escuchar. Podés escribirlo."); };
    recognition.onend = () => setListening(false);
    setListening(true); recognition.start();
  };
  const add = (label: string, code = "") => { if (!label.trim()) return; setSteps((current) => [...current, newStep(label.trim(), code)]); setDraftStep(""); };
  const move = (index: number, offset: number) => setSteps((current) => {
    const next = [...current]; const target = index + offset;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const reuse = (dv: any) => {
    const payload = dv.payload || dv.attrs;
    setIntent(human(payload?.intent?.summary));
    setTrigger(human(payload?.inputs?.trigger));
    setSteps((payload?.steps || []).map((step: any) => newStep(human(step?.inputs?.description) || "Paso", human(step?.capability?.code))));
    setNotice("Esta es una adaptación privada. La versión original no cambia.");
  };
  return <Overlay onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <Dialog role="dialog" aria-modal="true" aria-label="Automatizar con UTOPÝ">
      <Header><span><Sparkles size={20} /> Crear una forma de hacerlo</span><button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></Header>
      <Intro>Contale a UTOPÝ qué querés que pase. Primero lo vemos juntos; nada se activa sin permisos.</Intro>
      <Label>¿Qué querés hacer?</Label>
      <TextArea value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="Cuando me compren y tenga stock, avisame, prepará el pedido y preguntá si necesita entrega." />
      <SmallButton type="button" onClick={listen} disabled={listening}><Mic size={17} /> {listening ? "Escuchando…" : "Hablar"}</SmallButton>
      {!!suggestions.length && <><Label>Ideas para tu Nodo</Label><Chips>{suggestions.slice(0, 6).map((label) => <button type="button" key={label} onClick={() => setIntent(label)}>{label}</button>)}</Chips></>}
      <Sequence><Label>Cuando</Label><Input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="Por ejemplo: recibo un pedido" />
        <Label>Hacer</Label>
        {steps.map((step, index) => <Step key={step.id}><b>{index + 1}</b><div><Input aria-label={`Paso ${index + 1}`} value={step.label} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, label: event.target.value } : item))} /><select aria-label={`Capacidad para el paso ${index + 1}`} value={step.capabilityCode} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, capabilityCode: event.target.value } : item))}><option value="">Elegí una capacidad del Nodo</option>{capabilities.map((capability: { code: string; label: string }) => <option key={capability.code} value={capability.code}>{capability.label}</option>)}</select><Input aria-label={`Condición del paso ${index + 1}`} placeholder="Condición opcional" value={step.condition || ""} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, condition: event.target.value } : item))} /></div><Controls><button type="button" disabled={!index} onClick={() => move(index, -1)} aria-label="Subir paso"><ArrowUp size={16} /></button><button type="button" disabled={index === steps.length - 1} onClick={() => move(index, 1)} aria-label="Bajar paso"><ArrowDown size={16} /></button><button type="button" onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} aria-label="Quitar paso"><Trash2 size={16} /></button></Controls></Step>)}
        <AddRow><Input value={draftStep} onChange={(event) => setDraftStep(event.target.value)} placeholder="Agregar un paso" onKeyDown={(event) => { if (event.key === "Enter") add(draftStep); }} /><SmallButton type="button" onClick={() => add(draftStep)}><Plus size={16} /> Agregar</SmallButton></AddRow>
        {!!capabilities.length && <Chips>{capabilities.slice(0, 8).map((capability: { code: string; label: string }) => <button type="button" key={capability.code} onClick={() => add(capability.label, capability.code)}>{capability.label}</button>)}</Chips>}
      </Sequence>
      {compositions.length > 0 && <><Label>Formas existentes</Label><Chips>{compositions.slice(0, 5).map((dv) => <button type="button" key={dv.id} onClick={() => reuse(dv)}>{human((dv.payload || dv.attrs)?.intent?.summary) || "Forma guardada"} · versión {(dv.payload || dv.attrs)?.revision}</button>)}</Chips></>}
      <Result><b>Vista previa privada</b><p>{ready ? `${trigger} → ${steps.map((step) => step.label).join(" → ")}` : "Contá cuándo sucede y elegí los pasos de tu Nodo."}</p><strong>Los contratos ya están disponibles. Para simular necesitás capacidades instaladas y un ejecutor autorizado; para activar, una revisión firmada y un mandato vigente.</strong></Result>
      {notice && <Notice>{notice}</Notice>}
      <Footer><SmallButton type="button" disabled title="No hay un ejecutor de capacidades instalado para esta secuencia">Simular</SmallButton><Primary type="button" disabled title="La activación requiere Composition DV firmada y autorización verificable del Nodo">Activar</Primary></Footer>
    </Dialog>
  </Overlay>;
}

const Overlay = styled.div`position:fixed;inset:0;z-index:15000;display:grid;place-items:center;padding:16px;background:rgba(35,41,66,.2);backdrop-filter:blur(14px)`;
const Dialog = styled.section`width:min(760px,100%);max-height:94dvh;overflow:auto;padding:24px;border-radius:30px;border:1px solid #fff;background:linear-gradient(145deg,#fffefa,#f0edff);box-shadow:0 26px 75px #29345133;color:#19243e;@media(max-width:640px){align-self:end;width:calc(100% + 32px);max-height:95dvh;margin:-16px;border-radius:27px 27px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom))}`;
const Header = styled.header`display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:20px;font-weight:850;span{display:flex;align-items:center;gap:10px}button{width:38px;height:38px;border:1px solid #e3e4ef;border-radius:50%;background:#fff;display:grid;place-items:center}`;
const Intro = styled.p`color:#69738b;font-size:14px;line-height:1.5`;
const Label = styled.h3`font-size:14px;margin:20px 0 9px`;
const TextArea = styled.textarea`width:100%;min-height:108px;resize:vertical;padding:16px;border:1px solid #dfe3ef;border-radius:19px;background:#fff;font:inherit;box-sizing:border-box`;
const Input = styled.input`width:100%;min-height:42px;padding:9px 12px;border:1px solid #e0e3ed;border-radius:13px;background:#fff;font:inherit;box-sizing:border-box`;
const SmallButton = styled.button`min-height:42px;padding:9px 14px;border:1px solid #dfe1ec;border-radius:14px;background:#fff;color:#263458;font-weight:750;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;&:disabled{opacity:.5;cursor:not-allowed}`;
const Chips = styled.div`display:flex;gap:7px;overflow:auto;padding-bottom:3px;button{flex:none;border:1px solid #e0e1ed;border-radius:999px;background:#fff;padding:9px 13px;color:#44517b;font-weight:700}`;
const Sequence = styled.div`margin-top:20px;padding:18px;border:1px solid #e6e5f4;border-radius:23px;background:#ffffffb8;h3:first-child{margin-top:0}`;
const Step = styled.div`display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:start;margin:9px 0;padding:11px;border-radius:17px;background:#f4f2ff;b{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#dddcff;color:#5359ad}div{display:grid;gap:7px}select{max-width:100%;min-height:36px;border:1px solid #e0e3ed;border-radius:11px;background:#fff;color:#58627f}`;
const Controls = styled.aside`display:flex;gap:2px;button{width:29px;height:29px;border:0;border-radius:9px;background:#fff;color:#68718a;display:grid;place-items:center;&:disabled{opacity:.35}}@media(max-width:500px){display:grid}`;
const AddRow = styled.div`display:flex;gap:7px;margin:11px 0`;
const Result = styled.div`margin-top:18px;padding:16px;border-radius:18px;background:#eef3ff;color:#38466b;display:grid;gap:6px;p{margin:0}span{font-size:12px}strong{font-size:12px;color:#71578b}`;
const Notice = styled.p`padding:10px 12px;background:#fff5df;border-radius:12px;color:#79551f;font-size:13px`;
const Footer = styled.footer`display:flex;justify-content:flex-end;gap:9px;margin-top:20px`;
const Primary = styled(SmallButton)`background:#5e5dcf;color:white;border-color:#5e5dcf`;
