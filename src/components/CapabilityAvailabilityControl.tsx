import { useRef, useState } from 'react';
import { businessAccess, type BusinessEntry } from '../utopy/businessWorkspace';
import { publishAuthorizedDV } from '../utopy/authorizedPublish';
import { mtLiveSnapshot } from '../mt/mt.liveStore';
import { buildCapabilityPresence, presenceId, type PresenceStatus } from '../utopy/capabilityPresence';
import { useCapabilityPresence } from '../utopy/useCapabilityPresence';

/** Presence is advisory; it does not install delivery, alter active orders or accept a mission. */
export default function CapabilityAvailabilityControl({entry,allLive}:{entry:BusinessEntry;allLive:any[]}) {
  const presence=useCapabilityPresence(allLive);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const [selectedCapability,setSelectedCapability]=useState('');
  const lock=useRef(false);
  const announced=entry.manifest.attrs?.capabilities || [];
  const declaredCapabilities=['commerce.orders','delivery.offer'].filter(id=>announced.some((value:any)=>(typeof value==='string'?value:value?.id)===id));
  const capability=declaredCapabilities.includes(selectedCapability)?selectedCapability:declaredCapabilities[0]||'commerce.orders';
  const delivery=capability==='delivery.offer';
  const declared=announced.some((value:any)=>(typeof value==='string'?value:value?.id)===capability);
  const state=presence(entry.nodeId,capability);
  const change=async(status:PresenceStatus)=>{
    if(lock.current||!consent)return;
    lock.current=true;setBusy(true);setNotice('');
    try {
      if(!declared)throw Error('El nodo no anunció esta capacidad.');
      const current=mtLiveSnapshot();
      const context=await businessAccess(entry,current,'capability.offer');
      if(!context)throw Error('Tu identidad no tiene permiso para cambiar esta disponibilidad.');
      const id=presenceId(entry.nodeId,capability);
      const version=1+Math.max(0,...current.filter(dv=>dv.id===id).map(dv=>Number(dv.meta?.version)||0));
      const dv=buildCapabilityPresence(entry.nodeId,capability,status,version,consent);
      await publishAuthorizedDV({dv,allLive:current,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'capability.offer',sensitivity:'relationship'});
      setConsent(false);setNotice('Anuncio firmado y publicado por el canal existente. No modifica pedidos activos ni confirma aceptación en el servidor del comercio.');
    }catch(error:any){setNotice(error?.message||'No se pudo cambiar la disponibilidad.');}
    finally{lock.current=false;setBusy(false);}
  };
  if(!declared)return null;
  return <section className="utopy-card ub-form" aria-label="Disponibilidad de nuevas solicitudes"><h3>{delivery?'¿Querés recibir propuestas de entrega?':'¿Estás recibiendo solicitudes?'}</h3>{declaredCapabilities.length>1&&<label>Actividad<select className="utopy-input" value={capability} disabled={busy} onChange={event=>{setSelectedCapability(event.target.value);setConsent(false);}}><option value="commerce.orders">Recibir pedidos</option><option value="delivery.offer">Recibir propuestas de entrega</option></select></label>}<p role="status">{state.label}</p><small>El anuncio activo vence en 15 minutos. Descansar no cancela trabajos existentes; volver a recibir requiere una acción tuya. Es un anuncio, no una garantía de stock ni de aceptación.</small><label><input type="checkbox" checked={consent} disabled={busy} onChange={event=>setConsent(event.target.checked)}/> Autorizo publicar este cambio de disponibilidad.</label><div className="ub-ecosystem-actions"><button className="utopy-button" disabled={busy||!consent} onClick={()=>void change('available')}>{delivery?'Disponible':'Estoy atendiendo'}</button><button className="utopy-button" disabled={busy||!consent} onClick={()=>void change('busy')}>Capacidad limitada</button><button className="utopy-button" disabled={busy||!consent} onClick={()=>void change('resting')}>Descansar</button></div>{notice&&<p role="status">{notice}</p>}</section>;
}
