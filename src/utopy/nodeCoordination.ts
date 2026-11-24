import { makeWorkQuoteDV, makeWorkQuoteAcceptedDV, makeWorkExecutionDV, makeWorkOutcomeDV } from '../mt/work.action';
import { makeCircularDeliveryStatusDV, makeCircularDeliveryOfferDV } from '../pages/circula.dv';
import { publishAuthorizedDV, verifyAuthorizedDV } from './authorizedPublish';
import { businessAccess, businessRegistry } from './businessWorkspace';
import { mtLiveSnapshot } from '../mt/mt.liveStore';

// A guarded profile of existing DVs, not another transport, workflow store or payment engine.
export const COORDINATION_SCHEMA='utopy.coordination/1';
export type CoordinationStage='request'|'quote'|'accept'|'start'|'pickup'|'transit'|'deliver'|'confirm'|'settlement'|'cancel'|'incident';
export type CoordinationTerms={subtotal:number;currency:string;feeFixed:number;feeBps:number;etaMinutes:number;distanceKm:number;conditions:string;expiresAt:string};
export type CoordinationParties={requester:string;provider:string;coordinator:string};
export type CoordinationInput={requestId:string;stage:CoordinationStage;byNodeId:string;consent:boolean;expectedHead:string|null;expectedSignature?:string|null;title?:string;parties?:CoordinationParties;terms?:CoordinationTerms;reason?:string;evidenceRef?:string;settlementRef?:string;availabilityRef?:string};
export type CoordinationView={events:any[];head:any|null;stage:CoordinationStage|null;conflict:boolean;rejected:number};
const TRANSITIONS:Record<string,CoordinationStage[]>={empty:['request'],request:['quote','cancel','incident'],quote:['accept','cancel','incident'],accept:['start','cancel','incident'],start:['pickup','cancel','incident'],pickup:['transit','incident'],transit:['deliver','incident'],deliver:['confirm','incident'],confirm:['settlement','incident'],incident:['cancel'],cancel:[],settlement:[]};
const KINDS:Record<CoordinationStage,string>={request:'delivery.request',quote:'work.quote',accept:'work.quote.accepted',start:'work.execution',pickup:'delivery.status',transit:'delivery.status',deliver:'delivery.status',confirm:'delivery.confirm',settlement:'settlement.record',cancel:'work.outcome',incident:'delivery.status'};
const nonempty=(value:unknown)=>typeof value==='string'&&!!value.trim()&&value.length<=500;

export function coordinationFeeBps(value:string){
  const match=/^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if(!match)throw Error('Indicá un porcentaje con hasta dos decimales.');
  const bps=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
  if(bps>10000)throw Error('La comisión porcentual no puede superar el 100%.');
  return bps;
}

export function coordinationPrice(terms:CoordinationTerms){
  for(const value of [terms.subtotal,terms.feeFixed,terms.feeBps])if(!Number.isSafeInteger(value)||value<0)throw Error('Importes enteros no negativos requeridos.');
  if(terms.feeBps>10000||!nonempty(terms.currency)||!nonempty(terms.conditions)||!Number.isFinite(terms.etaMinutes)||terms.etaMinutes<=0||!Number.isFinite(terms.distanceKm)||terms.distanceKm<0)throw Error('Completá moneda, condiciones, distancia y tiempo informado.');
  // Integer, half-up basis-point arithmetic, no floating point percentage drift.
  const fee=Number((BigInt(terms.subtotal)*BigInt(terms.feeBps)+5000n)/10000n)+terms.feeFixed;
  const total=terms.subtotal+fee;
  if(!Number.isSafeInteger(fee)||!Number.isSafeInteger(total))throw Error('Importe fuera de rango.');
  return {subtotal:terms.subtotal,fee,total,currency:terms.currency};
}

function validEvent(dv:any,prior:any|null,now:number){
  const c=dv?.attrs?.coordination;
  if(c?.schema!==COORDINATION_SCHEMA||!Object.hasOwn(KINDS,c.stage)||dv.kind!==KINDS[c.stage as CoordinationStage]||c.sequence!==(prior?.attrs.coordination.sequence||0)+1||c.previousId!==(prior?.id||null)||c.previousSignature!==(prior?.meta?.ownership?.signature?.value||null))return false;
  if(dv.attrs.simulation!==true||dv.attrs.nonTradable!==true||dv.meta?.scopes?.length!==1||dv.meta.scopes[0]!=='participants'||c.explicitConsent!==true)return false;
  if(!nonempty(c.requestId)||dv.id!==`coordination:${c.requestId}:${c.sequence}`||dv.attrs.workId!==c.requestId||dv.meta.threadId!==c.requestId||dv.attrs.threadId!==c.requestId)return false;
  if(!Number.isFinite(Date.parse(dv.meta.ts))||Date.parse(dv.meta.ts)>now+5000||prior&&Date.parse(dv.meta.ts)<Date.parse(prior.meta.ts))return false;
  if(!TRANSITIONS[prior?.attrs.coordination.stage||'empty']?.includes(c.stage))return false;
  const p=c.parties;
  if(!p||![p.requester,p.provider,p.coordinator].every(nonempty)||p.requester===p.provider)return false;
  if(prior&&JSON.stringify(p)!==JSON.stringify(prior.attrs.coordination.parties))return false;
  const authority=dv.meta?.authority;
  const allowed=c.stage==='request'||c.stage==='accept'||c.stage==='confirm'?[p.requester]:c.stage==='settlement'?[p.coordinator]:['cancel','incident'].includes(c.stage)?[p.requester,p.provider,p.coordinator]:[p.provider];
  if(!allowed.includes(authority)||dv.attrs.actingAsNodeId!==authority)return false;
  if(![p.requester,p.provider,p.coordinator].every(id=>dv.attrs.participants?.includes(id)))return false;
  if(c.stage==='quote'){
    try{const price=coordinationPrice(dv.attrs.coordinationTerms);if(dv.attrs.quote?.amount!==price.total||dv.attrs.quote?.currency!==price.currency||dv.attrs.quote?.conditions!==dv.attrs.coordinationTerms.conditions||JSON.stringify(dv.attrs.price)!==JSON.stringify(price))return false;const expires=Date.parse(dv.attrs.coordinationTerms.expiresAt);if(!Number.isFinite(expires)||expires<=Date.parse(dv.meta.ts))return false;}catch{return false;}
  }
  if(prior?.attrs.coordinationTerms&&JSON.stringify(dv.attrs.coordinationTerms)!==JSON.stringify(prior.attrs.coordinationTerms))return false;
  if(c.stage==='accept'){
    const quote=prior?.attrs.coordinationTerms;
    if(!quote||Date.parse(quote.expiresAt)<=Date.parse(dv.meta.ts)||Date.parse(dv.meta.ts)>now+5000)return false;
    if(dv.attrs.quoteId!==prior.id||dv.attrs.acceptedBy!==p.requester||JSON.stringify(dv.attrs.quote)!==JSON.stringify(prior.attrs.quote)||JSON.stringify(dv.attrs.coordinationTerms)!==JSON.stringify(quote))return false;
  }
  const expectedState=({pickup:'picked_up',transit:'in_transit',deliver:'delivered',incident:'incident'} as Record<string,string>)[c.stage];
  if(expectedState&&dv.attrs.state!==expectedState)return false;
  if(['cancel','incident'].includes(c.stage)&&!nonempty(dv.attrs.reason))return false;
  if(c.stage==='confirm'&&(!nonempty(dv.attrs.evidenceRef)||dv.attrs.evidenceRef!==prior?.id||dv.attrs.decision!=='delivered'||dv.attrs.role!=='buyer'||dv.attrs.by?.id!==p.requester))return false;
  if(c.stage==='settlement'&&(!nonempty(dv.attrs.settlementRef)||dv.attrs.recordOnly!==true||dv.attrs.realMoneyMoved!==false))return false;
  return true;
}

/** Fail closed on conflicting signed branches. Verification supplied by the existing host boundary. */
export async function projectCoordination(allLive:any[],requestId:string,verify=(dv:any)=>verifyAuthorizedDV(dv,allLive),now=Date.now()):Promise<CoordinationView>{
  const candidates=allLive.filter(dv=>dv.attrs?.coordination?.schema===COORDINATION_SCHEMA&&dv.attrs?.coordination?.requestId===requestId);
  const accepted:any[]=[];let rejected=0;
  for(const dv of candidates){const proof=await verify(dv);if(proof.accepted&&proof.proof==='verified')accepted.push(dv);else rejected++;}
  const events:any[]=[];let head:any=null;let conflict=false;
  for(let sequence=1;sequence<=accepted.length;sequence++){
    const choices=accepted.filter(dv=>dv.attrs.coordination.sequence===sequence&&validEvent(dv,head,now));
    const unique=[...new Map(choices.map(dv=>[`${dv.id}:${dv.meta?.ownership?.signature?.value}`,dv])).values()];
    if(unique.length>1){conflict=true;break;}
    if(!unique.length)break;
    head=unique[0];events.push(head);
  }
  return {events,head,stage:head?.attrs.coordination.stage||null,conflict,rejected:rejected+accepted.length-events.length};
}

export function buildCoordinationEvent(input:CoordinationInput,view:CoordinationView,actorId:string,now=Date.now()){
  if(!nonempty(input.requestId)||!nonempty(actorId)||!Object.hasOwn(KINDS,input.stage))throw Error('Solicitud o acción inválida.');
  if(input.consent!==true||view.conflict||input.expectedHead!==(view.head?.id||null)||(input.expectedSignature||null)!==(view.head?.meta?.ownership?.signature?.value||null))throw Error('Revisá el consentimiento y la versión actual de la operación.');
  const prior=view.head;
  const parties=prior?.attrs.coordination.parties||input.parties;
  if(!parties)throw Error('Elegí los nodos participantes.');
  const sequence=(prior?.attrs.coordination.sequence||0)+1;
  const root=`coordination:${input.requestId}:1`;
  const common={workId:input.requestId,threadId:input.requestId,chainId:input.requestId,rootDvId:root,parentDvId:prior?.id||null,actorId,nodeId:input.byNodeId,existingParticipants:Object.values(parties) as string[],title:input.title||'Entrega de demostración',domain:'logistics.delivery'};
  let dv:any={kind:KINDS[input.stage],attrs:{},traits:['utopy:chain'],meta:{}};
  if(input.stage==='quote'){
    if(!input.terms)throw Error('Faltan las condiciones de la cotización.');
    const price=coordinationPrice(input.terms);
    if(Date.parse(input.terms.expiresAt)<=now||!Number.isFinite(Date.parse(input.terms.expiresAt)))throw Error('Indicá un vencimiento futuro.');
    dv=makeWorkQuoteDV({...common,amount:price.total,currency:price.currency,estimatedDays:1,conditions:input.terms.conditions});
    delete dv.attrs.quote.estimatedDays;
    delete dv.attrs.quote.depositPercent;delete dv.attrs.quote.depositAmount;
    dv.attrs.coordinationTerms={...input.terms};dv.attrs.price=price;
  }else if(input.stage==='accept')dv=makeWorkQuoteAcceptedDV({...common,quote:prior,acceptedBy:input.byNodeId});
  else if(input.stage==='start')dv=makeWorkExecutionDV(common);
  else if(input.stage==='cancel')dv=makeWorkOutcomeDV({...common,result:'cancelled'});
  else if(['pickup','transit','deliver'].includes(input.stage))dv=makeCircularDeliveryStatusDV({...common,assignmentId:root,deliveryIntentId:root,state:({pickup:'picked_up',transit:'in_transit',deliver:'delivered'} as any)[input.stage]});
  const ts=new Date(now).toISOString();
  const terms=input.stage==='quote'?dv.attrs.coordinationTerms:prior?.attrs.coordinationTerms;
  const event={...dv,id:`coordination:${input.requestId}:${sequence}`,kind:KINDS[input.stage],attrs:{...dv.attrs,...common,
    actorId,actingAsNodeId:input.byNodeId,nodeId:input.byNodeId,requesterId:parties.requester,pickupNodeId:parties.requester,
    providerNodeId:parties.provider,coordinatorNodeId:parties.coordinator,participants:[...new Set(Object.values(parties))],
    ...(input.stage==='request'?{requestedCapabilities:['delivery.offer'],status:'open',availabilityRef:input.availabilityRef||null,security:{automaticAssignment:false,exactDestinationPublic:false}}:{}),
    ...(input.stage==='confirm'?{decision:'delivered',role:'buyer',by:{id:input.byNodeId},proofId:input.evidenceRef}:{}),
    ...(input.stage==='incident'?{state:'incident',status:'attention_required'}:{}),
    ...(terms?{coordinationTerms:terms}:{}),reason:input.reason||null,evidenceRef:input.evidenceRef||null,
    ...(input.stage==='settlement'?{settlementRef:input.settlementRef,recordOnly:true,realMoneyMoved:false,price:coordinationPrice(terms)}:{}),
    simulation:true,nonTradable:true,coordination:{schema:COORDINATION_SCHEMA,requestId:input.requestId,sequence,stage:input.stage,previousId:prior?.id||null,previousSignature:prior?.meta?.ownership?.signature?.value||null,parties,explicitConsent:true}},
    meta:{...dv.meta,ns:'mt:market',ts,updatedAt:ts,version:1,scopes:['participants'],authority:input.byNodeId,originNode:input.byNodeId,threadId:input.requestId,chainId:input.requestId,rootDvId:root,parentDvId:prior?.id||null,source:'utopy.coordination.demo',schema:COORDINATION_SCHEMA,sensitivity:'sensitive'}};
  if(!validEvent(event,prior,now))throw Error('Acción no permitida para ese nodo o estado.');
  return event;
}

const committing=new Set<string>();
export async function commitCoordination(input:CoordinationInput){
  if(committing.has(input.requestId))throw Error('Esta operación ya tiene una acción en curso.');
  committing.add(input.requestId);
  try{return await commit(input);}finally{committing.delete(input.requestId);}
}
async function commit(input:CoordinationInput){
  const allLive=mtLiveSnapshot();
  const view=await projectCoordination(allLive,input.requestId);
  const registry=await businessRegistry(allLive);
  const entry=registry.find(item=>item.nodeId===input.byNodeId);
  if(!entry||entry.manifest.attrs?.simulation!==true)throw Error('Este recorrido solo está habilitado para nodos de demostración.');
  const context=await businessAccess(entry,allLive,KINDS[input.stage]);
  if(!context||context.wallet.custody!=='device')throw Error('Se requiere control o permiso vigente y una identidad persistente.');
  const parties=view.head?.attrs.coordination.parties||input.parties;
  if(!parties||!Object.values(parties).every(id=>registry.some(item=>item.nodeId===id&&item.manifest.attrs?.simulation===true)))throw Error('Todos los participantes deben ser nodos de demostración verificables.');
  if(input.stage==='request'&&!(await availableCoordinationNodes(allLive)).some(item=>item.nodeId===parties.provider&&item.offer.id===input.availabilityRef))throw Error('El nodo proveedor no anunció disponibilidad vigente.');
  const event=buildCoordinationEvent(input,view,context.actorId);
  // Optimistic local conflict check; not a cross-device transaction/CAS guarantee.
  const latest=await projectCoordination(mtLiveSnapshot(),input.requestId);
  if(latest.conflict||latest.head?.id!==view.head?.id||latest.head?.meta?.ownership?.signature?.value!==view.head?.meta?.ownership?.signature?.value||mtLiveSnapshot().some(dv=>dv.id===event.id))throw Error('La operación cambió. Actualizá antes de reintentar.');
  return (await publishAuthorizedDV({dv:event,allLive:mtLiveSnapshot(),actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,sensitivity:'sensitive',localOnly:true})).dv;
}

/** Explicit opt-in using the existing capability.offer, never inferred from a business name. */
export async function publishCoordinationAvailability(nodeId:string,consent:boolean,available:boolean){
  const allLive=mtLiveSnapshot();const entry=(await businessRegistry(allLive)).find(item=>item.nodeId===nodeId);
  if(!consent||!entry||entry.manifest.attrs?.simulation!==true)throw Error('Solo una demostración autorizada puede anunciar disponibilidad de prueba.');
  const context=await businessAccess(entry,allLive,'capability.offer');
  if(!context||context.wallet.custody!=='device')throw Error('No tenés autorización persistente para este nodo.');
  const dv=makeCircularDeliveryOfferDV({nodeId,actorId:context.actorId,deliveryIntentId:'',title:'Disponibilidad de entrega · demostración',scopes:['public']});
  // No invented prices, radius or delivery estimates from legacy defaults.
  delete (dv.attrs as any).delivery;delete (dv.attrs.capabilities[0] as any).serviceRadiusKm;
  const expiresAt=new Date(Date.now()+15*60000).toISOString();
  return (await publishAuthorizedDV({dv:{...dv,id:`coordination.availability:${nodeId}`,attrs:{...dv.attrs,nodeId,setupOnly:true,simulation:true,nonTradable:true,
    capabilities:[{id:'delivery.offer',description:'Entrega de demostración, no servicio real'}],availability:{status:available?'available':'withdrawn',expiresAt,explicitConsent:true}},
    meta:{...dv.meta,ttl_ms:15*60000,source:'utopy.coordination.demo',scopes:['public']}},allLive,actingAsNodeId:nodeId,requiredAuthority:nodeId,localOnly:true})).dv;
}

export async function availableCoordinationNodes(allLive:any[],now=Date.now()){
  const registry=await businessRegistry(allLive);const results:Array<{nodeId:string;name:string;offer:any}>=[];
  for(const entry of registry){
    if(entry.manifest.attrs?.simulation!==true)continue;
    const offers=allLive.filter(dv=>dv.id===`coordination.availability:${entry.nodeId}`).sort((a,b)=>Number(b.meta?.version)-Number(a.meta?.version));
    const offer=offers[0];const availability=offer?.attrs?.availability;
    if(!offer||availability?.status!=='available'||availability.explicitConsent!==true||Date.parse(availability.expiresAt)<=now||!Number.isFinite(Date.parse(availability.expiresAt))||offer.attrs.simulation!==true||offer.attrs.nonTradable!==true||offer.meta?.authority!==entry.nodeId||offer.kind!=='capability.offer'||offer.meta?.scopes?.length!==1||offer.meta.scopes[0]!=='public'||!offer.attrs.capabilities?.some((cap:any)=>cap.id==='delivery.offer'))continue;
    const proof=await verifyAuthorizedDV(offer,allLive);
    if(proof.accepted&&proof.proof==='verified')results.push({nodeId:entry.nodeId,name:entry.name,offer});
  }
  return results;
}
