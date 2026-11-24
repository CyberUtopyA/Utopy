import { useEffect, useRef, useState } from 'react';
import { availableCoordinationNodes, commitCoordination, coordinationPrice, coordinationFeeBps, projectCoordination, publishCoordinationAvailability, type CoordinationStage, type CoordinationTerms, type CoordinationView } from '../utopy/nodeCoordination';
import type { BusinessEntry } from '../utopy/businessWorkspace';

const LABELS:Record<CoordinationStage,string>={request:'Solicitud',quote:'Cotización',accept:'Aceptada',start:'En preparación de retiro',pickup:'Retirado',transit:'En camino',deliver:'Entrega declarada',confirm:'Recepción confirmada',settlement:'Liquidación registrada · simulada',cancel:'Cancelada',incident:'Incidencia · requiere revisión'};
const NEXT:Partial<Record<CoordinationStage,CoordinationStage>>={request:'quote',quote:'accept',accept:'start',start:'pickup',pickup:'transit',transit:'deliver',deliver:'confirm',confirm:'settlement'};
const ACTIONS:Partial<Record<CoordinationStage,string>>={quote:'Presentar cotización',accept:'Aceptar precio y comisión',start:'Iniciar retiro',pickup:'Confirmar retiro',transit:'Marcar en camino',deliver:'Declarar entrega',confirm:'Confirmar recepción',settlement:'Registrar liquidación simulada'};
const empty:CoordinationView={events:[],head:null,stage:null,conflict:false,rejected:0};
const numeric=(value:string)=>value.trim()===''?NaN:Number(value);

/** Same administrative surface for any opted-in demo node; never an obligatory dispatcher. */
export default function NodeCoordinationPanel({entry,allLive,registry}:{entry:BusinessEntry;allLive:any[];registry:BusinessEntry[]}){
  const demos=registry.filter(item=>item.manifest.attrs?.simulation===true);
  const [requester,setRequester]=useState('');const [provider,setProvider]=useState(entry.nodeId);
  const [availability,setAvailability]=useState<Array<{nodeId:string;name:string;offer:any}>>([]);
  const [requestId,setRequestId]=useState('');const [view,setView]=useState<CoordinationView>(empty);
  const [title,setTitle]=useState('');const [consent,setConsent]=useState(false);
  const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const running=useRef(false);
  const [terms,setTerms]=useState({subtotal:'',feeFixed:'',feePercent:'',currency:'PYG',etaMinutes:'',distanceKm:'',conditions:'',expiresAt:''});
  const [reason,setReason]=useState('');const [settlementRef,setSettlementRef]=useState('');
  const [clock,setClock]=useState(0);
  const operations=[...new Set(allLive.filter(dv=>dv.attrs?.coordination?.stage==='request'&&Object.values(dv.attrs.coordination.parties||{}).includes(entry.nodeId)).map(dv=>dv.attrs.coordination.requestId))] as string[];
  useEffect(()=>{let active=true;void availableCoordinationNodes(allLive).then(value=>{if(active)setAvailability(value);}).catch(()=>{if(active)setAvailability([]);});return()=>{active=false;};},[allLive,clock]);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(value=>value+1),30000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{let active=true;setView(empty);if(requestId)void projectCoordination(allLive,requestId).then(value=>{if(active)setView(value);}).catch(()=>{if(active)setNotice('No pudimos verificar la operación.');});return()=>{active=false;};},[allLive,requestId,clock]);
  useEffect(()=>setConsent(false),[requestId,view.head?.id]);
  useEffect(()=>setConsent(false),[requester,provider,title]);
  const run=async(task:()=>Promise<unknown>)=>{if(running.current)return;running.current=true;setBusy(true);setNotice('');try{await task();setConsent(false);}catch(error:any){setNotice(error?.message||'No se pudo completar la acción.');}finally{running.current=false;setBusy(false);}};
  const parsedTerms=():CoordinationTerms=>({subtotal:numeric(terms.subtotal),feeFixed:numeric(terms.feeFixed),feeBps:coordinationFeeBps(terms.feePercent),currency:terms.currency.trim(),etaMinutes:numeric(terms.etaMinutes),distanceKm:numeric(terms.distanceKm),conditions:terms.conditions.trim(),expiresAt:terms.expiresAt?new Date(terms.expiresAt).toISOString():''});
  let preview='Completá los importes; indicá 0 si no hay comisión.';
  try{const p=coordinationPrice(parsedTerms());preview=`Servicio ${p.subtotal.toLocaleString('es-PY')} + comisión ${p.fee.toLocaleString('es-PY')} = ${p.total.toLocaleString('es-PY')} ${p.currency}`;}catch{/* No inferred prices. */}
  const next=view.stage?NEXT[view.stage]:null;
  const parties=view.head?.attrs.coordination.parties;
  const nextNode=next==='accept'||next==='confirm'?parties?.requester:next==='settlement'?parties?.coordinator:parties?.provider;
  const nameOf=(id:string)=>registry.find(item=>item.nodeId===id)?.name||'Nodo participante';
  const advance=(stage:CoordinationStage)=>run(async()=>{
    const id=requestId||crypto.randomUUID();
    const selectedOffer=availability.find(item=>item.nodeId===provider);
    await commitCoordination({requestId:id,stage,byNodeId:stage==='request'?requester:['cancel','incident'].includes(stage)?entry.nodeId:nextNode,
      consent,expectedHead:view.head?.id||null,expectedSignature:view.head?.meta?.ownership?.signature?.value||null,title:title.trim(),parties:{requester,provider,coordinator:entry.nodeId},availabilityRef:selectedOffer?.offer.id,
      ...(stage==='quote'?{terms:parsedTerms()}:{}),reason:reason.trim(),evidenceRef:stage==='confirm'?view.head?.id:undefined,settlementRef:settlementRef.trim()});
    setRequestId(id);setNotice('Evento firmado y guardado localmente. No se realizó un envío ni un pago real.');
  });
  if(entry.manifest.attrs?.simulation!==true)return <section className="utopy-card"><h2>Coordinar con otros nodos</h2><p>La operación real requiere capacidades instaladas, autorizaciones y transporte privado confirmado. Esta herramienta no simula esos requisitos.</p></section>;
  return <section className="utopy-card ub-form" aria-labelledby="coordination-title">
    <div><small>Demostración local · sin dinero real</small><h2 id="coordination-title">Una entrega, nodos que colaboran</h2><p>Probá el recorrido por pasos. Cada acción indica qué nodo la firma; necesitás permiso para representarlo. No son repartidores ni negocios reales conectados.</p></div>
    {notice&&<p className="utopy-notice" role="status">{notice}</p>}
    <label className="utopy-field">Operación<select className="utopy-input" value={requestId} onChange={event=>setRequestId(event.target.value)}><option value="">Nueva solicitud de demostración</option>{operations.map(id=><option key={id} value={id}>{allLive.find(dv=>dv.attrs?.coordination?.requestId===id)?.attrs?.title||'Entrega de prueba'} · {id.slice(-6)}</option>)}</select></label>
    <details><summary>Disponibilidad voluntaria de prueba</summary><div className="ub-form">
      <label className="utopy-field">Nodo que ofrece entregas<select className="utopy-input" value={provider} onChange={event=>setProvider(event.target.value)}>{demos.map(item=><option key={item.nodeId} value={item.nodeId}>{item.name}</option>)}</select></label>
      <p>El anuncio dura 15 minutos y no incluye ubicación exacta, precio ni asignación automática.</p><div className="ub-ecosystem-actions"><button className="utopy-button" disabled={busy||!consent} onClick={()=>void run(async()=>{await publishCoordinationAvailability(provider,consent,true);setNotice('Disponibilidad de demostración anunciada localmente.');})}>Anunciar disponibilidad</button><button className="utopy-button" disabled={busy||!consent} onClick={()=>void run(()=>publishCoordinationAvailability(provider,consent,false))}>Retirar anuncio</button></div>
    </div></details>
    {!requestId?<>
      <label className="utopy-field">¿Qué hay que entregar?<input className="utopy-input" maxLength={150} value={title} onChange={event=>setTitle(event.target.value)} placeholder="Describí una entrega ficticia"/></label>
      <label className="utopy-field">Nodo solicitante<select className="utopy-input" value={requester} onChange={event=>setRequester(event.target.value)}><option value="">Elegir nodo</option>{demos.filter(item=>item.nodeId!==provider).map(item=><option key={item.nodeId} value={item.nodeId}>{item.name}</option>)}</select></label>
      <label className="utopy-field">Proveedor disponible<select className="utopy-input" value={provider} onChange={event=>setProvider(event.target.value)}><option value="">Elegir anuncio vigente</option>{availability.filter(item=>item.nodeId!==requester).map(item=><option key={item.nodeId} value={item.nodeId}>{item.name} · demostración</option>)}</select></label>
      <p>Coordinación: {entry.name}. Este nodo no es intermediario obligatorio de otras operaciones.</p>
      <button className="utopy-button" data-primary disabled={busy||!consent||!requester||!title.trim()||!availability.some(item=>item.nodeId===provider)} onClick={()=>void advance('request')}>Crear solicitud simulada</button>
    </>:<>
      {view.conflict&&<p role="alert">Hay versiones en conflicto. Se bloquearon las acciones; no se eligió una versión automáticamente.</p>}
      <ol className="ub-coordination-timeline">{view.events.map(event=><li key={event.id}><b>{LABELS[event.attrs.coordination.stage as CoordinationStage]}</b><span>{nameOf(event.meta.authority)}</span></li>)}</ol>
      {view.head?.attrs.coordinationTerms&&<div className="ub-empty"><b>Condiciones revisadas</b><p>{(()=>{const price=coordinationPrice(view.head.attrs.coordinationTerms);return `${price.subtotal.toLocaleString('es-PY')} + ${price.fee.toLocaleString('es-PY')} de comisión = ${price.total.toLocaleString('es-PY')} ${price.currency}`;})()}</p><p>{view.head.attrs.coordinationTerms.conditions}</p><small>{view.head.attrs.coordinationTerms.etaMinutes} min y {view.head.attrs.coordinationTerms.distanceKm} km informados; no calculados por GPS. La comisión corresponde a {nameOf(parties.coordinator)}. No implica un cobro.</small></div>}
      {next==='quote'&&<fieldset className="ub-form"><legend>Precio y condiciones de demostración</legend><div className="ub-grid">{[['subtotal','Servicio'],['feeFixed','Comisión fija'],['feePercent','Comisión %'],['etaMinutes','Tiempo estimado · min'],['distanceKm','Distancia informada · km']].map(([key,label])=><label className="utopy-field" key={key}>{label}<input className="utopy-input" type="number" min="0" step={key==='feePercent'||key==='distanceKm'?'0.01':'1'} value={terms[key as keyof typeof terms]} onChange={event=>{setConsent(false);setTerms(value=>({...value,[key]:event.target.value}));}}/></label>)}</div>
        <label className="utopy-field">Moneda<input className="utopy-input" value={terms.currency} maxLength={12} onChange={event=>{setConsent(false);setTerms(value=>({...value,currency:event.target.value}));}}/></label>
        <label className="utopy-field">Válida hasta<input className="utopy-input" type="datetime-local" value={terms.expiresAt} onChange={event=>{setConsent(false);setTerms(value=>({...value,expiresAt:event.target.value}));}}/></label>
        <label className="utopy-field">Condiciones<input className="utopy-input" maxLength={500} value={terms.conditions} onChange={event=>{setConsent(false);setTerms(value=>({...value,conditions:event.target.value}));}}/></label><p>{preview}</p>
      </fieldset>}
      {next==='settlement'&&<label className="utopy-field">Referencia del comprobante simulado<input className="utopy-input" maxLength={200} value={settlementRef} onChange={event=>{setConsent(false);setSettlementRef(event.target.value);}} placeholder="Referencia de prueba, no un pago real"/></label>}
      {next&&!view.conflict&&<div><p>Próxima firma: <b>{nameOf(nextNode)}</b>. Se comprueba el permiso al confirmar.</p><button className="utopy-button" data-primary disabled={busy||!consent} onClick={()=>void advance(next)}>{ACTIONS[next]}</button></div>}
      {view.stage&&!['cancel','settlement'].includes(view.stage)&&!view.conflict&&<details><summary>Cancelar o informar una incidencia</summary><label className="utopy-field">Motivo<input className="utopy-input" maxLength={500} value={reason} onChange={event=>{setConsent(false);setReason(event.target.value);}}/></label><div className="ub-ecosystem-actions">{['request','quote','accept','start','incident'].includes(view.stage)&&<button className="utopy-button" disabled={busy||!consent||!reason.trim()} onClick={()=>void advance('cancel')}>Rechazar / cancelar</button>}{view.stage!=='incident'&&<button className="utopy-button" disabled={busy||!consent||!reason.trim()} onClick={()=>void advance('incident')}>Pausar por incidencia</button>}</div><p>Luego del retiro, informá una incidencia: no se supone devolución, reembolso ni cancelación resuelta.</p></details>}
    </>}
    <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> Revisé los datos y autorizo únicamente la próxima acción de demostración. No autorizo un cobro ni una operación real.</label>
  </section>;
}
