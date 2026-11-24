import {bookingRequest} from '../booking/client';
import {businessAccess,type BusinessEntry} from '../utopy/businessWorkspace';
import {verifyAuthorizedDV,publishAuthorizedDV} from '../utopy/authorizedPublish';
import {COMMUNICATION_SCHEMA,internationalPhone} from './contracts.mjs';
export function communicationEndpoint(entry:BusinessEntry){const raw=entry.manifest.attrs?.endpoints?.communication;if(!raw)return '';try{const url=new URL(raw,window.location.origin);return !url.username&&!url.password&&(url.protocol==='https:'||url.origin===window.location.origin)?url.href:'';}catch{return '';}}
export const communicationRequest=(entry:BusinessEntry,op:string,input:any={})=>bookingRequest(communicationEndpoint(entry),entry.nodeId,`communication.${op}`,input,true);
export async function phoneSettings(entry:BusinessEntry,allLive:any[]){const record=allLive.find(dv=>dv.id===`communication.settings:${entry.nodeId}:phone`);if(!record)return null;const proof=await verifyAuthorizedDV(record,allLive);return proof.accepted&&proof.proof==='verified'&&proof.authority===entry.nodeId?record:null;}
export async function savePhoneSettings(entry:BusinessEntry,allLive:any[],value:string,enabled:boolean,consent:boolean){
 if(!consent)throw Error('Confirmá este cambio de contacto.');const access=await businessAccess(entry,allLive,'communication.manage');if(!access)throw Error('Tu identidad no puede configurar la comunicación de este nodo.');const prior=await phoneSettings(entry,allLive);const phone=enabled?internationalPhone(value):prior?.attrs?.phone||'';
 return publishAuthorizedDV({dv:{id:`communication.settings:${entry.nodeId}:phone`,kind:'communication.settings',attrs:{schema:COMMUNICATION_SCHEMA,nodeId:entry.nodeId,channel:'phone',phone,enabled,providerVerified:false,automatedCalls:false,consent:true,participants:[entry.nodeId,access.actorId]},traits:['communication:phone'],meta:{...prior?.meta,ns:'utopy:communication',scopes:['participants'],version:Number(prior?.meta?.version||0)+1,updatedAt:new Date().toISOString()}},allLive,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'communication.manage',sensitivity:'sensitive'});
}
