import {sealOwnedDV,getWalletStatus} from '../utopy/ownership';
import {resolveCurrentIdentityContext} from '../utopy/identityContext';
import {mtLiveSnapshot} from '../mt/mt.liveStore';
import {publishUtopyDV} from '../mt/utopy.networkPublish';
import {verifyAdminReceipt} from '../utopy/adminReceipt';
import {bookingRequest} from './client';
import {verifyNodeManifestDV} from '../mt/utopy.nodeManifest';
export async function fetchRemoteNode(nodeId:string){const result=await unsignedAdmin({nodeId,op:'admin.manifest'}),all=mtLiveSnapshot();const proof=await verifyNodeManifestDV(result.manifest,all);if(!proof.accepted||proof.proof!=='verified'||result.manifest.attrs.nodeId!==nodeId)throw Error('No se verificó el negocio.');const old=all.find(dv=>dv.id===result.manifest.id);if(old&&(Number(old.meta?.version)>Number(result.manifest.meta.version)||old.meta?.ownership?.ownerDid!==result.manifest.meta.ownership.ownerDid))throw Error('La identidad del negocio cambió. Sincronizá antes de continuar.');publishUtopyDV(result.manifest,{localOnly:true});return result.manifest;}
export async function adminPreview(nodeId:string,invitationId:string,token:string){const result=await unsignedAdmin({nodeId,op:'admin.preview',invitationId,token});const proof=await verifyNodeManifestDV(result.manifest,mtLiveSnapshot());if(!proof.accepted||proof.proof!=='verified'||result.manifest.attrs.nodeId!==nodeId)throw Error('No se verificó el negocio de esta invitación.');return result;}
async function unsignedAdmin(input:any){const response=await fetch('/api/living-booking',{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||result.ok!==true)throw Error(result.error==='INVITATION_UNAVAILABLE'?'La invitación venció, se canceló o ya fue utilizada.':'No se pudo verificar la invitación con el servidor del nodo.');return result.result;}
export async function importRemoteAdmin(result:any){
 const all=mtLiveSnapshot(),context=await resolveCurrentIdentityContext({allLive:all});
 const grant=await verifyAdminReceipt(result.manifest,result.grant,context.actorId,all);if(!grant)throw Error('No se verificó el permiso emitido por el nodo.');
 const known=all.find(dv=>dv.id===result.manifest.id);if(known&&Number(known.meta?.version)>Number(result.manifest.meta?.version))throw Error('Hay una versión más reciente del negocio. Actualizá antes de continuar.');
 if(known&&known.meta?.ownership?.ownerDid!==result.manifest.meta?.ownership?.ownerDid)throw Error('La identidad controladora no coincide con el negocio guardado.');
 publishUtopyDV(result.manifest,{localOnly:true});
 publishUtopyDV({id:result.grant.id,kind:'node.authorization.receipt',attrs:{nodeId:grant.nodeId,actorId:grant.actorId,envelope:result.grant,participants:[grant.actorId,grant.nodeId]},meta:{ns:'utopy:identity',authority:grant.nodeId,originNode:grant.nodeId,version:result.grant.revision,ts:result.grant.createdAt,updatedAt:result.grant.createdAt,scopes:['private']}},{localOnly:true});
 return grant;
}
export async function acceptRemoteAdmin(nodeId:string,invitationId:string,token:string,consent:boolean){
 if(!consent)throw Error('Confirmá que querés administrar este negocio.');const wallet=await getWalletStatus();if(wallet.custody!=='device'||!wallet.recoveryReady)throw Error('Guardá primero tu Identidad Viva y su respaldo.');
 const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()}),ts=new Date().toISOString();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const tokenHash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
 const proof=await sealOwnedDV({id:`node.admin.acceptance:${crypto.randomUUID()}`,kind:'node.admin.acceptance',attrs:{nodeId,op:'admin.accept',invitationId,tokenHash,consent:true,actorId:context.actorId},meta:{ts,expiresAt:new Date(Date.now()+60000).toISOString(),scopes:['private']}},context.actorId);
 const result=await unsignedAdmin({nodeId,op:'admin.accept',invitationId,token,consent:true,proof});if(result.manifest?.attrs?.nodeId!==nodeId||result.grant?.payload?.invitationId!==invitationId)throw Error('La respuesta pertenece a otra invitación.');await importRemoteAdmin(result);return result;
}
export async function refreshRemoteAdmin(entry:any){const endpoint=entry?.manifest?.attrs?.endpoints?.livingBooking;if(!endpoint)return;const result=await bookingRequest(endpoint,entry.nodeId,'admin.session',{},true);await importRemoteAdmin(result);}
