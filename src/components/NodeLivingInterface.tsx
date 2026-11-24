import { useEffect, useRef, useState } from 'react';
import type { JsonValue, LivingInterfaceProjection } from 'utopy';
import { projectAdminInterface, queryAdminRecords, adminRecordTitle, saveAdminProcedure, simulateAdminInterface } from '../utopy/adminInterfaceAdapter';
import type { BusinessEntry } from '../utopy/businessWorkspace';
import './nodeLivingInterface.css';

/** Admin-only consumer. UTOPY owns projection/contracts; this component owns rendering, not authority. */
export default function NodeLivingInterface({entry,records,actorId,canConfigure=false}:{entry:BusinessEntry;records:any[];actorId:string;canConfigure?:boolean}) {
  const [text,setText]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [inputs,setInputs]=useState<Record<string,JsonValue>>({});
  const [projection,setProjection]=useState<LivingInterfaceProjection|null>(null);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [review,setReview]=useState(false);
  const [consent,setConsent]=useState(false);
  const [listening,setListening]=useState(false);
  const [prior,setPrior]=useState<any>(null);
  const [simulation,setSimulation]=useState<string>('');
  const requestId=useRef(`admin-intent:${crypto.randomUUID()}`);
  const speech=useRef<any>(null);
  const running=useRef(false);
  const lastSelected=useRef<string|null>(null);
  useEffect(()=>()=>{speech.current?.abort();},[]);
  useEffect(()=>{
    let active=true;
    setReview(false);setConsent(false);setSimulation('');setProjection(null);
    void projectAdminInterface(entry,records,text,selected,inputs,requestId.current).then(value=>{if(active)setProjection(value);}).catch(error=>{if(active)setNotice(error.message || 'No pudimos verificar el acceso.');});
    return ()=>{active=false;};
  },[entry,records,text,selected,inputs,actorId]);
  const choose=(capability:string,label:string)=>{lastSelected.current=capability;setPrior(null);setSelected(capability);setText(label);setInputs({});setNotice('');};
  const interpret=()=>{
    const correction=text.match(/^(?:busc[aá]|buscar|filtrar por)\s+(.+)$/i);
    if(correction && lastSelected.current){setSelected(lastSelected.current);setInputs(value=>({...value,query:correction[1].slice(0,120)}));setNotice('Actualicé el filtro. Revisalo antes de guardar.');}
    else {setSelected(null);setInputs({});setNotice('La interpretación usa reglas locales y capacidades instaladas.');}
  };
  const listen=()=>{
    const Speech=(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!Speech){setNotice('Este navegador no admite dictado. Podés escribir.');return;}
    speech.current?.abort();const recognition=new Speech();speech.current=recognition;recognition.lang='es-PY';recognition.interimResults=false;
    recognition.onresult=(event:any)=>{setText(event.results?.[0]?.[0]?.transcript || '');setSelected(null);setInputs({});};
    recognition.onerror=()=>{setListening(false);setNotice('No pudimos escuchar. Podés escribir.');};recognition.onend=()=>setListening(false);
    try{setListening(true);recognition.start();}catch{setListening(false);setNotice('Revisá el permiso del micrófono.');}
  };
  const run=async(operation:()=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);try{await operation();}catch(error:any){setNotice(error.message || 'No pudimos completar la revisión.');}finally{running.current=false;setBusy(false);}};
  const form=projection?.form;
  const ready=Boolean(form?.valid && projection?.blockers.length===0);
  const values=Object.fromEntries((form?.fields || []).filter(field=>field.known && field.value!==undefined).map(field=>[field.name,field.value!]));
  const rows=projection?.selected ? queryAdminRecords(records,projection.selected,values,entry.nodeId) : [];
  const procedures=records.filter(dv=>dv.kind==='composition.publish' && dv.meta?.runtimeEnvelope?.sourceActorId===actorId && dv.attrs?.proposalOnly===true && dv.attrs?.nodeId===entry.nodeId);
  const updateInput=(name:string,value:JsonValue|undefined)=>setInputs(current=>{const next={...current};if(value===undefined)delete next[name];else next[name]=value;return next;});
  return <section className="unli" aria-label="Interfaz Viva del nodo">
    <header><small>Tu espacio, a tu manera</small><h2>¿Qué necesitás hacer?</h2><p>Consultá tu negocio y prepará formas de trabajar. Nada se cobra, publica o activa automáticamente.</p></header>
    <form className="unli-intent" onSubmit={event=>{event.preventDefault();interpret();}}>
      <label htmlFor="node-admin-intent">Contalo con tus palabras</label><textarea id="node-admin-intent" maxLength={500} value={text} onChange={event=>{setText(event.target.value);setSelected(null);}} placeholder="Por ejemplo: ver mis pedidos o consultar presupuestos"/>
      <div className="unli-actions"><button className="utopy-button" type="button" onClick={listen} disabled={listening}>{listening?'Escuchando…':'Hablar'}</button><button className="utopy-button" data-primary type="submit">Entender mi intención</button></div>
      <small>Texto y dictado usan el mismo flujo. El micrófono depende del navegador y puede utilizar su servicio de voz.</small>
    </form>
    {notice && <p className="utopy-notice" role="status">{notice}</p>}
    {prior && <p>Estás adaptando tu procedimiento, versión {prior.attrs?.revision}. Guardar conserva el vínculo con esa versión.</p>}
    <div className="unli-cards">{projection?.cards.slice(0,3).map(card=><button type="button" key={card.capability} aria-pressed={projection.selected===card.capability} onClick={()=>choose(card.capability,card.label)}><span>{card.label}</span><small>Consulta privada →</small></button>)}</div>
    {!!projection && !projection.cards.length && <p>No hay herramientas instaladas y autorizadas para esta identidad. No se inventaron capacidades.</p>}
    {!!projection && projection.cards.length>3 && <details><summary>Más herramientas de consulta</summary><div className="unli-cards">{projection.cards.slice(3).map(card=><button type="button" key={card.capability} onClick={()=>choose(card.capability,card.label)}>{card.label}</button>)}</div></details>}
    {text && projection && !projection.selected && <p className="unli-help">Elegí qué herramienta necesitás. Si pediste reparar, reservar, cobrar o enviar un aviso, hace falta instalar y autorizar esa capacidad; una consulta no realiza esas acciones.</p>}
    {form && <section className="unli-form"><h3>{projection?.cards.find(card=>card.capability===projection.selected)?.label}</h3>
      <p className="unli-help">Solo se aplica el filtro que ves abajo. Esta herramienta no cambia estados, fechas, precios ni plazos.</p>
      {form.fields.map(field=><label className="utopy-field" key={`${field.capability}:${field.name}`}>{projection?.fieldLabels[field.name] || field.name}{field.required?' *':''}
        {field.schema?.enum ? <select className="utopy-input" value={String(inputs[field.name] ?? field.value ?? '')} onChange={event=>updateInput(field.name,field.schema?.enum?.find(value=>String(value)===event.target.value))}><option value="">Elegí una opción</option>{field.schema.enum.map(value=><option key={JSON.stringify(value)} value={String(value)}>{String(value)}</option>)}</select>
        : field.schema?.type==='boolean' ? <select className="utopy-input" value={inputs[field.name]===undefined?'':String(inputs[field.name])} onChange={event=>updateInput(field.name,event.target.value===''?undefined:event.target.value==='true')}><option value="">Sin completar</option><option value="true">Sí</option><option value="false">No</option></select>
        : ['object','array'].includes(field.schema?.type || '') ? <textarea className="utopy-input" value={typeof inputs[field.name]==='string'?String(inputs[field.name]):JSON.stringify(inputs[field.name] ?? field.value ?? '')} onChange={event=>{try{updateInput(field.name,JSON.parse(event.target.value));}catch{updateInput(field.name,event.target.value);}}}/>
        : <input className="utopy-input" maxLength={field.schema?.maxLength || 500} type={['integer','number'].includes(field.schema?.type || '')?'number':'text'} value={String(inputs[field.name] ?? field.value ?? '')} onChange={event=>updateInput(field.name,event.target.value===''?undefined:['integer','number'].includes(field.schema?.type || '')?Number(event.target.value):event.target.value)}/>}
        {!field.valid && <small>Revisá este dato antes de continuar.</small>}</label>)}
      <p>{rows.length ? `${rows.length} registros disponibles para tu consulta.`:'No hay registros que coincidan. No se crearon resultados de ejemplo.'}</p>
      {!!rows.length && <ul className="unli-records">{rows.map(dv=><li key={dv.id}>{adminRecordTitle(dv)}</li>)}</ul>}
      <div className="unli-actions">{canConfigure && <button className="utopy-button" disabled={!ready || busy} onClick={()=>setReview(true)}>Revisar procedimiento</button>}<button className="utopy-button" disabled={!ready || busy} onClick={()=>void run(async()=>{const result=await simulateAdminInterface(entry,records,projection!);setSimulation(result.viable?'La consulta local es viable. No se ejecutó ningún paso ni se modificaron datos.':'La simulación encontró bloqueos. No se habilitó ejecución.');})}>Simular consulta</button></div>
      {simulation && <p role="status">{simulation}</p>}
    </section>}
    {canConfigure && review && projection && ready && <section className="unli-review"><h3>Antes de guardar</h3><p>Se guardará una propuesta privada y versionada para esta consulta. No es un mandato de ejecución ni activa una automatización.</p><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> Revisé estos datos y autorizo guardar la propuesta local.</label><button className="utopy-button" data-primary disabled={busy || !consent} onClick={()=>void run(async()=>{await saveAdminProcedure(entry,projection,prior);setReview(false);setConsent(false);setNotice('Propuesta firmada guardada en este dispositivo. No está activa ni tiene sincronización remota confirmada.');})}>{prior?'Guardar nueva versión':'Guardar propuesta revisada'}</button></section>}
    {!!procedures.length && <details><summary>Mis procedimientos guardados</summary><div className="unli-cards">{procedures.map(dv=><button type="button" key={dv.id} onClick={()=>{lastSelected.current=dv.attrs?.requiredCapabilities?.[0]?.code || null;setPrior(dv);setText(dv.attrs?.intent?.summary || '');setSelected(dv.attrs?.requiredCapabilities?.[0]?.code || null);setInputs(dv.attrs?.inputs || {});}}><span>{dv.attrs?.intent?.summary || 'Consulta guardada'}</span><small>Versión {dv.attrs?.revision} · propuesta privada</small></button>)}</div><button className="utopy-button" onClick={()=>{lastSelected.current=null;setPrior(null);setSelected(null);setText('');setInputs({});}}>Preparar una nueva</button></details>}
  </section>;
}
