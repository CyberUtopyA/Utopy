import {resolveCurrentIdentityContext} from './identityContext';
import {createEncryptedRecovery,getWalletStatus} from './ownership';
import {publishAuthorizedDV,verifyAuthorizedDV} from './authorizedPublish';
import {buildLiveProfileDV} from '../social/liveNetwork.builders';
import {mtLiveSnapshot} from '../mt/mt.liveStore';

export function validateSimpleIdentity(input:{name:string;phone:string;email:string;password:string;confirmation:string;consent:boolean}){
 const name=input.name.trim(),phone=input.phone.trim(),email=input.email.trim();
 if(!name||name.length>80)throw Error('Escribí tu nombre (hasta 80 caracteres).');
 if(phone&&!/^\+?[\d ()-]{6,30}$/.test(phone))throw Error('Revisá tu número de teléfono.');
 if(email&&(email.length>254||!/^\S+@\S+\.\S+$/.test(email)))throw Error('Revisá tu correo.');
 if(input.password.length<12)throw Error('Usá una contraseña de al menos 12 caracteres.');
 if(input.password!==input.confirmation)throw Error('Las contraseñas no coinciden.');
 if(!input.consent)throw Error('Confirmá cómo se guardarán tus datos.');
 return {name,phone,email};
}
let saving=false;
export async function prepareSimpleIdentity(input:Parameters<typeof validateSimpleIdentity>[0]){
 const data=validateSimpleIdentity(input);if(saving)throw Error('Tu identidad se está guardando.');saving=true;
 try{
 const wallet=await getWalletStatus();if(wallet.custody!=='device')throw Error('Este navegador no permite guardar tu identidad. Habilitá su almacenamiento antes de continuar.');
 const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});
 // Recovery uses the existing encrypted identity format, never a password/account database.
 const backup=await createEncryptedRecovery(input.password,mtLiveSnapshot());
 const current=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});if(current.actorId!==context.actorId)throw Error('La identidad cambió. Volvé a intentarlo.');
 const all=mtLiveSnapshot(),id=`node.profile:${context.actorId}`,prior=all.find(dv=>dv.id===id);
 if(prior){const proof=await verifyAuthorizedDV(prior,all);if(!proof.accepted||proof.actorId!==context.actorId)throw Error('No se pudo verificar tu perfil anterior.');}
 const raw=buildLiveProfileDV({actorId:context.actorId,actorName:data.name,capabilities:[]});
 const attrs={...raw.attrs,...prior?.attrs,actorName:data.name,title:data.name};
 await publishAuthorizedDV({dv:{...raw,attrs,meta:{...raw.meta,...prior?.meta,version:Number(prior?.meta?.version||0)+1}},allLive:all,actingAsNodeId:null,requiredAuthority:context.actorId,localOnly:true});
 const contactId=`identity.private.profile:${context.actorId}`,previous=all.find(dv=>dv.id===contactId);
 if(previous){const proof=await verifyAuthorizedDV(previous,all);if(!proof.accepted||proof.actorId!==context.actorId)throw Error('No se verificaron tus datos privados anteriores.');}
 await publishAuthorizedDV({dv:{id:contactId,kind:'identity.private.profile',attrs:{...previous?.attrs,subjectActorId:context.actorId,contact:{name:data.name,phone:data.phone,email:data.email,phoneVerified:false,emailVerified:false},participants:[context.actorId]},meta:{...previous?.meta,ns:'utopy:identity',scopes:['private'],version:Number(previous?.meta?.version||0)+1}},allLive:mtLiveSnapshot(),actingAsNodeId:null,requiredAuthority:context.actorId,sensitivity:'sensitive',localOnly:true});
 // Include newly saved contacts and profile in the same portable encrypted backup.
 const completeBackup=await createEncryptedRecovery(input.password,mtLiveSnapshot());
 return {actorId:context.actorId,backup:completeBackup||backup};
 }finally{saving=false;}
}
