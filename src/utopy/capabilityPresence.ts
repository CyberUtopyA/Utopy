export const PRESENCE_SCHEMA = 'utopy.capability-presence/1';
export type PresenceStatus = 'available' | 'busy' | 'paused' | 'resting';
export type CapabilityPresence = { nodeId:string; capability:string; status:PresenceStatus|'unknown'; label:string; source:any|null };
export const presenceId = (nodeId:string, capability:string) => `capability-presence:${encodeURIComponent(nodeId)}:${encodeURIComponent(capability)}`;
const PUBLIC = (dv:any) => dv.meta?.scopes?.length===1 && dv.meta.scopes[0]==='public';

/** Verification is bound to the exact DV object, never just a reusable id. */
export function projectCapabilityPresence(all:any[], verified:Set<any>, nodeId:string, capability:string, now=Date.now()):CapabilityPresence {
  const unknown:CapabilityPresence={nodeId,capability,status:'unknown',label:'Consultar disponibilidad',source:null};
  const candidates=all.filter(dv=>verified.has(dv) && dv.id===presenceId(nodeId,capability) && dv.kind==='capability.offer'
    && dv.attrs?.presence?.schema===PRESENCE_SCHEMA && dv.attrs.nodeId===nodeId && dv.attrs.presence.capability===capability
    && dv.meta?.authority===nodeId && PUBLIC(dv) && dv.attrs?.simulation!==true);
  candidates.sort((a,b)=>Number(b.meta.version)-Number(a.meta.version));
  const latest=candidates[0];
  if(!latest || candidates.some(dv=>dv!==latest && dv.meta.version===latest.meta.version))return unknown;
  const a=latest.attrs.presence;
  const time=Date.parse(latest.meta.updatedAt || latest.meta.ts);
  if(!Number.isSafeInteger(latest.meta.version)||latest.meta.version<1||!Number.isFinite(time)||time>now+5000||!['available','busy','paused','resting'].includes(a.status)||a.explicitConsent!==true)return unknown;
  // Manual stops latch until a newer authorized announcement. Expiry never reopens a node.
  if(['paused','resting'].includes(a.status)) return {...unknown,status:a.status,label:'Por el momento no recibe nuevas solicitudes',source:latest};
  const expires=Date.parse(a.expiresAt);
  if(!Number.isFinite(expires)||expires<=now||expires<=time||expires-time>15*60_000)return unknown;
  return {...unknown,status:a.status,label:a.status==='busy'?'Con capacidad limitada':capability==='delivery.offer'?'Disponible para propuestas':'Atendiendo ahora',source:latest};
}

export function buildCapabilityPresence(nodeId:string, capability:string, status:PresenceStatus, version:number, consent:boolean, now=Date.now()) {
  if(!consent||!nodeId||!['commerce.orders','delivery.offer'].includes(capability)||!['available','busy','paused','resting'].includes(status)||!Number.isSafeInteger(version)||version<1)throw Error('Revisá y autorizá el cambio de disponibilidad.');
  const ts=new Date(now).toISOString();
  const stopped=['paused','resting'].includes(status);
  const expiresAt=stopped?null:new Date(now+15*60_000).toISOString();
  return {id:presenceId(nodeId,capability),kind:'capability.offer',attrs:{nodeId,title:capability==='delivery.offer'?'Propuestas de entrega':'Recibir pedidos',status:stopped?'closed':status,expiresAt,capabilities:[{id:capability}],presence:{schema:PRESENCE_SCHEMA,capability,status,explicitConsent:true,expiresAt}},traits:['utopy:capability-presence'],meta:{ns:'mt:market',authority:nodeId,originNode:nodeId,scopes:['public'],version,ts,updatedAt:ts}};
}
