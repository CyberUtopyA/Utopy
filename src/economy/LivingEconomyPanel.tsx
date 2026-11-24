import { useEffect, useRef, useState } from 'react';
import { verifyAuthorizedDV } from '../utopy/authorizedPublish';
import { useContextualVoice } from '../utopy/useContextualVoice';
import { projectLivingEconomy } from './utopy.economy';
import { privateEconomicRecord } from './utopy.node-adapter';
import './livingEconomy.css';
const KINDS=new Set(['market.order.create','market.order.received','market.order.accept','market.order.reject','market.order.cancelled','credit.decision','finance.decision','payment.offer','payment.outcome']);
const money=(amount:number,currency:string)=>new Intl.NumberFormat('es-PY',{style:'currency',currency}).format(amount);
export default function LivingEconomyPanel({allLive,actorId,onMethods}:{allLive:any[];actorId:string;onMethods:()=>void}) {
  const [proof,setProof]=useState<{source:any[];actorId:string;verified:Set<any>}>({source:[],actorId:'',verified:new Set()});
  const [failed,setFailed]=useState(false),[query,setQuery]=useState(''),[answer,setAnswer]=useState(''),[asking,setAsking]=useState(false);
  const activity=useRef<HTMLDivElement>(null),revision=useRef(0);
  const voice=useContextualVoice(setQuery);
  useEffect(()=>{let active=true;revision.current++;setAnswer('');setAsking(false);setFailed(false);void Promise.all(allLive.filter(dv=>KINDS.has(dv.kind)&&privateEconomicRecord(dv)).map(async dv=>{
    const result=await verifyAuthorizedDV(dv,allLive);return result.accepted&&result.proof==='verified'?dv:null;
  })).then(items=>{if(active)setProof({source:allLive,actorId,verified:new Set(items.filter(Boolean))});}).catch(()=>{if(active){setFailed(true);setProof({source:allLive,actorId,verified:new Set()});}});return()=>{active=false;revision.current++;};},[allLive,actorId]);
  const checking=proof.source!==allLive||proof.actorId!==actorId;
  const economy=projectLivingEconomy(allLive,actorId,checking?new Set():proof.verified);
  const ask=async()=>{
    const current=++revision.current;setAsking(true);setAnswer('');
    try{const {explainLivingEconomy}=await import('./utopy.economy-interface');const result=await explainLivingEconomy(query,economy,allLive);if(current===revision.current)setAnswer(result.explanation);}
    catch{if(current===revision.current)setAnswer('No pudimos verificar esta consulta. Volvé a abrir Mi Valor.');}
    finally{if(current===revision.current)setAsking(false);}
  };
  return <section className="living-economy" aria-label="Mi economía">
    <header><small>Mi economía</small><h2>Tu economía, clara.</h2></header>
    <div className="living-economy-amounts"><div><span>Disponible para retirar</span><strong>Sin proveedor</strong></div><div><span>En liquidación</span><strong>Sin evidencia de proveedor</strong></div></div>
    <p className="living-economy-note">Los comercios cobran directamente. Un pago registrado no es dinero custodiado por Market. No hay cuenta financiera conectada.</p>
    <nav aria-label="Acciones económicas"><button type="button" disabled title="Requiere proveedor financiero autorizado">Retirar</button><button type="button" disabled title="Requiere proveedor financiero autorizado">Enviar</button><button type="button" onClick={()=>{activity.current?.scrollIntoView({block:'nearest',behavior:'auto'});activity.current?.focus({preventScroll:true});}}>Movimientos</button></nav>
    <button type="button" className="living-economy-link" onClick={onMethods}>Mis tarjetas de fidelidad · no son cuentas de pago</button>
    <div ref={activity} tabIndex={-1}><h3>Mis pagos y pendientes</h3>
      {checking?<p role="status">Verificando tus operaciones…</p>:failed?<p role="alert">No pudimos verificar la actividad. No se calculó ningún saldo.</p>:<>
        <p>{economy.registered.length} registrados · {economy.pending.length} pendientes · {economy.failed.length} fallidos</p>
        {economy.movements.length?economy.movements.slice(0,12).map(movement=><article key={movement.id}><div><b>{movement.label}</b><small>{movement.paidAmount!==null?'Declaración firmada del comercio · no es evidencia bancaria':'No confirma recepción de dinero'} · no retirable</small>{movement.paidAmount!==null&&movement.paidAmount!==movement.amount?<small>Total del pedido: {money(movement.amount,movement.currency)} · pago parcial</small>:null}</div><strong>{money(movement.paidAmount??movement.amount,movement.currency)}</strong></article>):<p>No hay pagos privados verificables para esta identidad.</p>}
      </>}
    </div>
    {!checking&&economy.movements.some(movement=>movement.reviewRequired)?<p role="alert">Hay un pedido cerrado con pago registrado. Revisá sus comprobantes con el comercio: no se supone una devolución automática.</p>:null}
    <form onSubmit={event=>{event.preventDefault();if(query.trim()&&!checking&&!failed&&!asking)void ask();}}>
      <label htmlFor="economy-question">Consultá sobre tus operaciones</label>
      <input id="economy-question" maxLength={500} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Por ejemplo: pagos pendientes"/>
      <div className="living-economy-query"><button type="button" onClick={voice.start}>{voice.listening?'Detener voz':'Usar voz'}</button><button type="submit" disabled={checking||failed||asking||!query.trim()}>{asking?'Consultando…':'Consultar'}</button></div>
      {voice.notice?<p role="status">{voice.notice}</p>:null}{answer?<p role="status">{answer}</p>:null}
      <small>Consulta local sin LLM ni acciones automáticas. La voz puede usar el servicio de tu navegador.</small>
    </form>
    <details><summary>Relaciones y límites</summary><p>{economy.connections.length} comercio(s) con operaciones privadas verificadas. Cada uno conserva sus fondos y permisos.</p><p>Ingresos del negocio, cobros por recibir y obligaciones entre participantes requieren acceso autorizado al nodo; no se deducen de tus compras. Vincular una tarjeta no habilita retiros. No se simulan repartos, liquidaciones ni devoluciones bancarias.</p></details>
  </section>;
}
