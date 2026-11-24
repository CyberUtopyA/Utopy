import { buildNodeManifestDV } from '../mt/utopy.nodeManifest';
import { mtLiveSnapshot } from '../mt/mt.liveStore';
import { publishAuthorizedDV, verifyAuthorizedDV } from './authorizedPublish';
import { resolveCurrentIdentityContext } from './identityContext';
import { BUSINESS_CONFIGURATIONS, type BusinessConfigurationKey } from './businessWorkspace';

export const NODE_SETUP_SCHEMA='utopy.node.setup/1';
export type NodeSetup={name:string;purpose:string;configuration:BusinessConfigurationKey|null};
const actor=(value:unknown)=>typeof value==='string'&&/^actor:utopy:[a-z0-9]+$/i.test(value);
const cleanSetup=(value:any):NodeSetup=>{
  if(typeof value?.name!=='string'||value.name.trim().length<2||value.name.length>100||typeof value.purpose!=='string'||value.purpose.length>500)throw Error('Nombre o presentación inválidos.');
  const configuration=value.configuration==null?null:Object.hasOwn(BUSINESS_CONFIGURATIONS,value.configuration)?value.configuration:null;
  return {name:value.name.trim(),purpose:value.purpose.trim(),configuration};
};

/** Addressed preparation, not a bearer credential, ownership transfer, grant or account. */
export function buildNodeSetupInvitation(setup:NodeSetup,recipientActorId:string,issuerActorId:string,now=Date.now()){
  if(!actor(recipientActorId)||!actor(issuerActorId)||recipientActorId===issuerActorId)throw Error('Indicá la identidad UTOPY del otro propietario.');
  const ts=new Date(now).toISOString();
  return {id:`node.setup.invitation:${crypto.randomUUID()}`,kind:'node.setup.invitation',
    attrs:{schema:NODE_SETUP_SCHEMA,setup:cleanSetup(setup),recipientActorId,actorId:issuerActorId,
      issuedAt:ts,expiresAt:new Date(now+7*86400000).toISOString(),grantsAccess:false,transfersOwnership:false},traits:['utopy:node:setup'],
    meta:{ns:'utopy:nodes',ts,updatedAt:ts,version:1,scopes:['private'],sensitivity:'sensitive',schema:NODE_SETUP_SCHEMA}};
}

export async function verifyNodeSetupInvitation(dv:any,recipientActorId:string,now=Date.now()){
  if(dv?.kind!=='node.setup.invitation'||dv.attrs?.schema!==NODE_SETUP_SCHEMA||!actor(recipientActorId)||dv.attrs.recipientActorId!==recipientActorId||dv.attrs.grantsAccess!==false||dv.attrs.transfersOwnership!==false||dv.attrs.actingAsNodeId||dv.meta?.scopes?.length!==1||dv.meta.scopes[0]!=='private')throw Error('Esta preparación no está dirigida a tu identidad o no es compatible.');
  const start=Date.parse(dv.attrs.issuedAt),end=Date.parse(dv.attrs.expiresAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now+5000||end<=now||end<=start||end-start>7*86400000)throw Error('La preparación venció o tiene fechas inválidas.');
  const proof=await verifyAuthorizedDV(dv,[]);
  if(!proof.accepted||proof.proof!=='verified'||proof.actorId===recipientActorId||proof.actorId!==dv.attrs.actorId)throw Error('No se pudo verificar la firma de quien preparó este espacio.');
  return {setup:cleanSetup(dv.attrs.setup),issuerActorId:proof.actorId,ownerDid:dv.meta.ownership.ownerDid,expiresAt:dv.attrs.expiresAt};
}

export async function createNodeSetupInvitation(setup:NodeSetup,recipientActorId:string,consent:boolean){
  if(!consent)throw Error('Confirmá los datos y el destinatario antes de preparar la invitación.');
  const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});
  if(context.wallet.custody!=='device')throw Error('Necesitás una identidad persistente.');
  return (await publishAuthorizedDV({dv:buildNodeSetupInvitation(setup,recipientActorId.trim(),context.actorId),allLive:mtLiveSnapshot(),sensitivity:'sensitive',localOnly:true})).dv;
}

export function buildOwnerNodeManifest(setup:NodeSetup,invitationId:string){
  const safe=cleanSetup(setup),nodeId=`utopy.node.${crypto.randomUUID()}`;
  return buildNodeManifestDV({nodeId,nodeName:safe.name,capabilities:[],endpoints:{},ttlMs:30*86400000,
    extraAttrs:{slug:nodeId,status:'setup',setupOnly:true,workspaceIntent:safe.purpose,businessConfiguration:safe.configuration,
      onboardingInvitationId:invitationId,productionReady:false}});
}

let accepting=false;
/** Creates a fresh sovereign node. It deliberately cannot claim, promote or transfer a demo/existing ID. */
export async function acceptNodeSetupInvitation(dv:any,expectedIssuerActorId:string,consent:boolean){
  if(accepting)throw Error('Ya se está preparando tu nodo.');
  accepting=true;
  try{
    if(!consent)throw Error('Revisá la preparación y confirmá que querés crear tu propio nodo.');
    const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});
    if(context.wallet.custody!=='device'||!context.wallet.recoveryReady)throw Error('Primero prepará tu identidad persistente y su respaldo cifrado. Nunca compartas ese respaldo ni su contraseña.');
    const verified=await verifyNodeSetupInvitation(dv,context.actorId);
    if(verified.issuerActorId!==expectedIssuerActorId.trim())throw Error('El remitente no coincide con la identidad que confirmaste por otro canal.');
    const prior=mtLiveSnapshot().find(item=>item.kind==='utopy.node.manifest'&&item.attrs?.onboardingInvitationId===dv.id);
    if(prior){
      const proof=await verifyAuthorizedDV(prior,mtLiveSnapshot());
      if(prior.meta?.ownership?.ownerDid!==context.ownerDid||!proof.accepted||proof.proof!=='verified')throw Error('Hay una preparación previa en conflicto. No se reemplazó.');
      return prior;
    }
    const manifest=buildOwnerNodeManifest(verified.setup,dv.id);
    return (await publishAuthorizedDV({dv:manifest,allLive:mtLiveSnapshot(),actingAsNodeId:manifest.attrs.nodeId,requiredAuthority:manifest.attrs.nodeId,allowNodeBootstrap:true,localOnly:true})).dv;
  }finally{accepting=false;}
}
