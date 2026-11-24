import {buildNodeAuthorizationDV,buildNodeAuthorizationRevokedDV,resolveCurrentIdentityContext,deriveActorIdForOwnerDid} from './identityContext';
import {businessAccess,type BusinessEntry} from './businessWorkspace';
import {publishAuthorizedDV,verifyAuthorizedDV} from './authorizedPublish';
import {verifyOwnedDV} from './ownership';
import {mtLiveSnapshot} from '../mt/mt.liveStore';
import {publishUtopyDV} from '../mt/utopy.networkPublish';
import {sha256} from '../pay/utopyPay.crypto';

export const ADMIN_INVITATION_SCHEMA='utopy.node.admin-invitation/1';
export const ADMIN_ACTIONS=['node.workspace.read','booking.manage','booking.configure'] as const;
const actor=(id:any)=>typeof id==='string'&&/^actor:utopy:[a-z0-9]+$/i.test(id);
const check=(condition:any,message:string)=>{if(!condition)throw Error(message);};
const fingerprint=(value:any)=>sha256(value);
function dates(invitation:any,now=Date.now()){
 const a=invitation.attrs,start=Date.parse(a.issuedAt),end=Date.parse(a.expiresAt),until=Date.parse(a.validUntil);
 check(Number.isFinite(start)&&start<=now+5000&&Number.isFinite(end)&&end>now&&end>start&&end-start<=7*86400000&&Number.isFinite(until)&&until>end&&until<=start+366*86400000,'La invitación venció o tiene fechas inválidas.');
}
export function buildAdminInvitation(entry:BusinessEntry,recipientActorId:string,issuerActorId:string,validUntil:string,now=Date.now()){
 check(actor(recipientActorId)&&actor(issuerActorId)&&recipientActorId!==issuerActorId,'Indicá la identidad UTOPY de la otra persona.');
 const ts=new Date(now).toISOString(),until=Date.parse(validUntil);check(until>now+86400000&&until<=now+366*86400000,'Elegí un vencimiento entre mañana y un año.');
 return {id:`node.admin.invitation:${crypto.randomUUID()}`,kind:'node.admin.invitation',attrs:{schema:ADMIN_INVITATION_SCHEMA,nodeId:entry.nodeId,nodeName:entry.name,manifestId:entry.manifest.id,recipientActorId,issuedByActorId:issuerActorId,issuedAt:ts,expiresAt:new Date(Math.min(now+7*86400000,until-1000)).toISOString(),validUntil:new Date(until).toISOString(),allowedActions:[...ADMIN_ACTIONS],grantsAccess:false,transfersOwnership:false,participants:[issuerActorId,recipientActorId,entry.nodeId]},traits:['utopy:identity','consent:required'],meta:{ns:'utopy:identity',ts,updatedAt:ts,version:1,scopes:['participants'],sensitivity:'sensitive'}};
}
export async function verifyAdminInvitation(bundle:any,recipientActorId:string,expectedIssuer?:string,allLive:any[]=[],now=Date.now()){
 check(bundle?.schema===ADMIN_INVITATION_SCHEMA,'Formato de invitación incompatible.');const {manifest,invitation}=bundle,a=invitation?.attrs;
 check(invitation?.kind==='node.admin.invitation'&&a?.schema===ADMIN_INVITATION_SCHEMA&&a.recipientActorId===recipientActorId&&actor(recipientActorId)&&a.grantsAccess===false&&a.transfersOwnership===false,'Esta invitación no está dirigida a tu identidad.');
 check(JSON.stringify(a.allowedActions)===JSON.stringify(ADMIN_ACTIONS)&&invitation.meta?.scopes?.length===1&&invitation.meta.scopes[0]==='participants','Los permisos de la invitación no son compatibles.');
 check(manifest?.kind==='utopy.node.manifest'&&manifest.attrs?.nodeId===a.nodeId&&manifest.id===a.manifestId&&manifest.meta?.scopes?.includes('public')&&!manifest.meta.scopes.some((s:string)=>['private','participants','custodians'].includes(s)),'El nodo no coincide con la invitación.');
 check(await verifyOwnedDV(manifest),'No se verificó la identidad del nodo.');
 const expires=manifest.meta?.ttl_ms?Date.parse(manifest.meta.updatedAt||manifest.meta.ts)+Number(manifest.meta.ttl_ms):Infinity;
 check((Number.isFinite(expires)||expires===Infinity)&&expires>now&&!['revoked','inactive','disabled'].includes(manifest.attrs.status),'El nodo está inactivo o su identificación venció.');
 const proof=await verifyAuthorizedDV(invitation,[...allLive,manifest]);
 check(proof.accepted&&proof.proof==='verified'&&proof.actingAsNodeId===a.nodeId&&proof.authority===a.nodeId&&invitation.meta.ownership.ownerDid===manifest.meta.ownership.ownerDid,'No se verificó la autoridad de quien invita.');
 const issuer=await deriveActorIdForOwnerDid(manifest.meta.ownership.ownerDid);check(issuer===proof.actorId&&issuer===a.issuedByActorId&&(!expectedIssuer||issuer===expectedIssuer),'El remitente no coincide con la identidad que confirmaste.');dates(invitation,now);
 for(const revocation of allLive.filter(dv=>dv.kind==='node.admin.invitation.revoked'&&dv.attrs?.invitationId===invitation.id))if(revocation.meta?.ownership?.ownerDid===manifest.meta.ownership.ownerDid&&await verifyOwnedDV(revocation))throw Error('La invitación fue cancelada.');
 const existing=allLive.filter(dv=>dv.kind==='utopy.node.manifest'&&dv.attrs?.nodeId===a.nodeId);
 for(const old of existing)if(await verifyOwnedDV(old))check(old.meta.ownership.ownerDid===manifest.meta.ownership.ownerDid,'Este nodo tiene una identidad controladora diferente en tu dispositivo.');
 return {nodeId:a.nodeId,nodeName:a.nodeName,issuerActorId:issuer,validUntil:a.validUntil,invitationHash:await fingerprint(invitation)};
}
export async function createAdminInvitation(entry:BusinessEntry,recipient:string,until:string,consent:boolean){
 check(consent,'Confirmá los permisos y la identidad destinataria.');const all=mtLiveSnapshot(),context=await businessAccess(entry,all,'node.authorization');
 check(context&&context.wallet.custody==='device'&&context.wallet.recoveryReady&&entry.manifest.meta?.ownership?.ownerDid===context.ownerDid,'Sólo la identidad controladora persistente y respaldada puede invitar.');
 const raw=buildAdminInvitation(entry,recipient.trim(),context.actorId,until);
 const invitation=(await publishAuthorizedDV({dv:raw,allLive:all,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'node.authorization',sensitivity:'sensitive',localOnly:true})).dv;
 return {schema:ADMIN_INVITATION_SCHEMA,manifest:entry.manifest,invitation};
}
export async function acceptAdminInvitation(bundle:any,expectedIssuer:string,consent:boolean){
 check(consent&&actor(expectedIssuer),'Confirmá al remitente por otro canal y aceptá los permisos.');const all=mtLiveSnapshot(),context=await resolveCurrentIdentityContext({allLive:all});
 check(context.wallet.custody==='device'&&context.wallet.recoveryReady,'Prepará tu identidad persistente y su respaldo cifrado antes de aceptar.');
 const view=await verifyAdminInvitation(bundle,context.actorId,expectedIssuer,all);const ts=new Date().toISOString();
 const dv={id:`node.admin.acceptance:${bundle.invitation.id}`,kind:'node.admin.acceptance',attrs:{schema:ADMIN_INVITATION_SCHEMA,nodeId:view.nodeId,invitationId:bundle.invitation.id,invitationHash:view.invitationHash,recipientActorId:context.actorId,allowedActions:[...ADMIN_ACTIONS],validUntil:view.validUntil,accepted:true,participants:[context.actorId,view.issuerActorId,view.nodeId]},traits:['utopy:identity','consent:confirmed'],meta:{ns:'utopy:identity',ts,version:1,scopes:['participants'],sensitivity:'sensitive'}};
 const acceptance=(await publishAuthorizedDV({dv,allLive:all,actingAsNodeId:null,requiredAuthority:context.actorId,sensitivity:'sensitive',localOnly:true})).dv;
 await verifyAdminAcceptance({...bundle,acceptance},all);
 return {...bundle,acceptance};
}
export async function verifyAdminAcceptance(bundle:any,allLive:any[]=[],now=Date.now()){
 const recipient=bundle?.invitation?.attrs?.recipientActorId;const view=await verifyAdminInvitation(bundle,recipient,undefined,allLive,now),acceptance=bundle.acceptance,a=acceptance?.attrs;
 check(acceptance?.kind==='node.admin.acceptance'&&a?.accepted===true&&a.nodeId===view.nodeId&&a.recipientActorId===recipient&&a.invitationId===bundle.invitation.id&&a.invitationHash===view.invitationHash&&a.validUntil===view.validUntil&&JSON.stringify(a.allowedActions)===JSON.stringify(ADMIN_ACTIONS),'La aceptación no coincide con la invitación.');
 const proof=await verifyAuthorizedDV(acceptance,allLive);check(proof.accepted&&proof.proof==='verified'&&proof.actorId===recipient&&proof.authority===recipient&&!proof.actingAsNodeId&&acceptance.meta?.scopes?.length===1&&acceptance.meta.scopes[0]==='participants','La aceptación debe estar firmada por la destinataria.');return view;
}
export async function activateAdminInvitation(entry:BusinessEntry,bundle:any,consent:boolean){
 check(consent,'Confirmá la activación después de revisar la aceptación.');const all=mtLiveSnapshot(),context=await businessAccess(entry,all,'node.authorization');
 check(context&&context.wallet.custody==='device'&&entry.manifest.meta?.ownership?.ownerDid===context.ownerDid,'Sólo el controlador del nodo puede activar la administración.');
 const view=await verifyAdminAcceptance(bundle,all);check(view.nodeId===entry.nodeId&&view.issuerActorId===context.actorId,'La aceptación pertenece a otro nodo o administrador.');
 const grantId=`node.authorization:${bundle.invitation.id}`,prior=all.find(dv=>dv.id===grantId);
 if(prior){const proof=await verifyAuthorizedDV(prior,all);check(proof.accepted&&proof.proof==='verified'&&prior.attrs?.acceptanceRef===bundle.acceptance.id&&prior.attrs?.acceptanceHash===await fingerprint(bundle.acceptance),'La autorización existente no es válida.');check(!all.some(dv=>dv.kind==='node.authorization.revoked'&&dv.attrs?.authorizationId===prior.id),'La autorización fue revocada. Prepará una nueva invitación.');return {...bundle,grant:prior};}
 const raw=buildNodeAuthorizationDV({actorId:bundle.invitation.attrs.recipientActorId,nodeId:entry.nodeId,roles:['manager'],allowedActions:[...ADMIN_ACTIONS],capabilities:['living-booking'],validUntil:view.validUntil,issuedByActorId:context.actorId});
 raw.id=grantId;Object.assign(raw.attrs,{authorizationId:grantId,invitationId:bundle.invitation.id,acceptanceRef:bundle.acceptance.id,acceptanceHash:await fingerprint(bundle.acceptance),participants:[context.actorId,bundle.invitation.attrs.recipientActorId,entry.nodeId],consent:{node:true,actor:true,automaticExpansion:false}});
 const grant=(await publishAuthorizedDV({dv:raw,allLive:all,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'node.authorization',sensitivity:'sensitive',localOnly:true})).dv;
 return {...bundle,grant};
}
export async function importAdminGrant(bundle:any,expectedIssuer:string,consent:boolean){
 check(consent&&actor(expectedIssuer),'Confirmá al remitente y la importación de permisos.');const all=mtLiveSnapshot(),context=await resolveCurrentIdentityContext({allLive:all});check(context.wallet.custody==='device','Usá tu identidad persistente.');
 const view=await verifyAdminAcceptance(bundle,all);check(view.issuerActorId===expectedIssuer&&bundle.invitation.attrs.recipientActorId===context.actorId,'La autorización no está dirigida a tu identidad.');
 const grant=bundle.grant,a=grant?.attrs;check(grant?.kind==='node.authorization'&&grant.id===`node.authorization:${bundle.invitation.id}`&&a.actorId===context.actorId&&a.nodeId===view.nodeId&&a.validUntil===view.validUntil&&a.invitationId===bundle.invitation.id&&a.acceptanceRef===bundle.acceptance.id&&a.acceptanceHash===await fingerprint(bundle.acceptance)&&JSON.stringify(a.allowedActions)===JSON.stringify(ADMIN_ACTIONS),'La autorización no coincide con los permisos aceptados.');
 const proof=await verifyAuthorizedDV(grant,[...all,bundle.manifest]);check(proof.accepted&&proof.proof==='verified'&&grant.meta?.ownership?.ownerDid===bundle.manifest.meta.ownership.ownerDid,'La autorización no está firmada por el controlador del nodo.');
 for(const dv of [bundle.manifest,bundle.invitation,bundle.acceptance,grant]){const old=all.find(item=>item.id===dv.id);check(!old||await fingerprint(old)===await fingerprint(dv),'Ya existe otra versión. Sincronizá con el nodo antes de importar.');}
 for(const dv of [bundle.manifest,bundle.invitation,bundle.acceptance,grant])publishUtopyDV(dv,{localOnly:true});return view;
}
export async function revokeAdminGrant(entry:BusinessEntry,grant:any,consent:boolean){
 check(consent,'Confirmá la revocación.');const all=mtLiveSnapshot(),context=await businessAccess(entry,all,'node.authorization');check(context&&entry.manifest.meta.ownership.ownerDid===context.ownerDid&&grant.attrs?.nodeId===entry.nodeId,'Sólo el controlador de este nodo puede revocar permisos.');
 return (await publishAuthorizedDV({dv:buildNodeAuthorizationRevokedDV({authorizationId:grant.id,actorId:grant.attrs.actorId,nodeId:entry.nodeId}),allLive:all,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'node.authorization.revoked',sensitivity:'sensitive',localOnly:true})).dv;
}
