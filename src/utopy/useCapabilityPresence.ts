import { useEffect, useState } from 'react';
import { verifyAuthorizedDV } from './authorizedPublish';
import { PRESENCE_SCHEMA, projectCapabilityPresence } from './capabilityPresence';
import { mtLiveSnapshot, mtLiveSubscribe } from '../mt/mt.liveStore';
export function useCapabilityPresence(allLive:any[]) {
  const [proof,setProof]=useState<{source:any[];verified:Set<any>}>({source:[],verified:new Set()});
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{let active=true;void Promise.all(allLive.filter(dv=>dv.kind==='capability.offer'&&dv.attrs?.presence?.schema===PRESENCE_SCHEMA).map(async dv=>{
    try {const result=await verifyAuthorizedDV(dv,allLive);return result.accepted&&result.proof==='verified'?dv:null;}catch{return null;}
  })).then(items=>{if(active)setProof({source:allLive,verified:new Set(items.filter(Boolean))});});return()=>{active=false;};},[allLive]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15_000);return()=>window.clearInterval(timer);},[]);
  const verified=proof.source===allLive?proof.verified:new Set<any>();
  return (nodeId:string,capability='commerce.orders')=>{
    const checking=proof.source!==allLive && allLive.some(dv=>dv.kind==='capability.offer'&&dv.attrs?.nodeId===nodeId&&dv.attrs?.presence?.schema===PRESENCE_SCHEMA&&dv.attrs.presence.capability===capability);
    const result=projectCapabilityPresence(allLive,verified,nodeId,capability,now);
    return {...result,checking,label:checking?'Verificando disponibilidad…':result.label};
  };
}
export function useNodeOrderPresence(nodeId:string, active=true) {
  const [records,setRecords]=useState<any[]>(mtLiveSnapshot);
  useEffect(()=>{if(!active)return;setRecords(mtLiveSnapshot());return mtLiveSubscribe(setRecords);},[active]);
  const select=useCapabilityPresence(records);
  return select(active?nodeId:'');
}
