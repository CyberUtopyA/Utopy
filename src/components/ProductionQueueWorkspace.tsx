import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { businessRegistry, isCommercialWorkspaceEntry, businessAccess, verifiedBusinessRecords, validBusinessGrant, type BusinessEntry } from '../utopy/businessWorkspace';
import type { CurrentIdentityContext } from '../utopy/identityContext';
import ProducerQueuePanel from '../mt/ProducerQueuePanel';
const NodeLivingInterface=lazy(()=>import('./NodeLivingInterface'));
const AvailabilityControl=lazy(()=>import('./CapabilityAvailabilityControl'));

type Props={allLive:any[];preferredNodeId?:string|null;legacyQueue:ReactNode;onOpenThread:(threadId:string)=>void};
/** One production queue, with an optional verified node interface; legacy is an explicit fallback. */
export default function ProductionQueueWorkspace({allLive,preferredNodeId,legacyQueue,onOpenThread}:Props) {
  const [resolved,setResolved]=useState<{entry:BusinessEntry;context:CurrentIdentityContext;records:any[]}|null>(null);
  const [checking,setChecking]=useState(true);
  const [clock,setClock]=useState(0);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;setChecking(true);setResolved(null);
    void (async()=>{
      const registry=(await businessRegistry(allLive)).filter(isCommercialWorkspaceEntry);
      let entry:BusinessEntry|undefined;
      let context:CurrentIdentityContext|null=null;
      if(preferredNodeId){
        entry=registry.find(item=>item.nodeId===preferredNodeId);
        if(entry)context=await businessAccess(entry,allLive);
      }else{
        const available=(await Promise.all(registry.map(async item=>{const access=await businessAccess(item,allLive);return access?{entry:item,context:access}:null;}))).filter(Boolean);
        if(available.length===1){entry=available[0]!.entry;context=available[0]!.context;}
      }
      if(!entry || !context){if(active)setMessage(preferredNodeId?'El nodo actual no tiene acceso verificable a la Interfaz Viva. La operación anterior se conserva.':'Elegí el nodo que administrás para usar la Interfaz Viva. Tu cola actual sigue disponible.');return;}
      const records=await verifiedBusinessRecords(entry,allLive,context);
      if(active){setResolved({entry,context,records});setMessage('');}
    })().catch(()=>{if(active)setMessage('No pudimos verificar el nodo. No se habilitaron herramientas nuevas.');}).finally(()=>{if(active)setChecking(false);});
    return()=>{active=false;};
  },[allLive,preferredNodeId,clock]);
  useEffect(()=>{
    if(!resolved)return;
    const now=Date.now();
    const dates=resolved.context.authorizations.filter(grant=>grant.nodeId===resolved.entry.nodeId).map(grant=>Date.parse(grant.validUntil || ''));
    const meta=resolved.entry.manifest.meta;
    if(meta?.ttl_ms)dates.push(Date.parse(meta.updatedAt || meta.ts)+Number(meta.ttl_ms));
    const next=Math.min(...dates.filter(time=>Number.isFinite(time)&&time>now));
    if(!Number.isFinite(next))return;
    const timer=window.setTimeout(()=>setClock(value=>value+1),Math.min(next-now+1,2_147_483_647));
    return()=>window.clearTimeout(timer);
  },[resolved]);
  if(checking)return <p role="status">Preparando tu cola y verificando el nodo…</p>;
  if(!resolved)return <><div className="utopy-notice" style={{marginBottom:16}}><p>{message}</p><Link className="utopy-button" to="/mi-espacio">Elegir mi negocio</Link></div>{legacyQueue}</>;
  const {entry,context,records}=resolved;
  const controller=entry.manifest.meta?.ownership?.ownerDid===context.ownerDid;
  const canConfigure=controller || context.authorizations.some(grant=>validBusinessGrant(grant,entry.nodeId,context.actorId,'composition.publish'));
  return <div style={{display:'grid',gap:20,minWidth:0}}>
    <Suspense fallback={null}><AvailabilityControl key={`presence:${context.actorId}:${entry.nodeId}`} entry={entry} allLive={allLive}/></Suspense>
    <div><small className="utopy-muted">Producción de</small><h3 style={{margin:'4px 0'}}>{entry.name}</h3><p className="utopy-muted">La intención y la cola usan el mismo nodo y sus registros verificados.</p></div>
    <Suspense fallback={<p role="status">Abriendo las herramientas de tu nodo…</p>}><NodeLivingInterface key={`${context.actorId}:${entry.nodeId}`} entry={entry} records={records} actorId={context.actorId} canConfigure={canConfigure}/></Suspense>
    <section aria-label="Cola de trabajo del nodo"><h3>Cola de trabajo</h3><p className="utopy-muted">Planeados, en curso y terminados. Los estados no cambian por interpretar una frase.</p><ProducerQueuePanel allLive={records} actorId={context.actorId} actorName={context.displayName} nodeId={entry.nodeId} hideOpen readOnly={!controller} onOpenThread={onOpenThread}/></section>
  </div>;
}
