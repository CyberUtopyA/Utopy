import {mtLiveSnapshot,mtLiveGetAccessContext,mtLiveSetAccessContext,mtLivePersistCurrent} from '../mt/mt.liveStore';
import {resolveCurrentIdentityContext} from '../utopy/identityContext';
import {publishAuthorizedDV,verifyAuthorizedDV} from '../utopy/authorizedPublish';

/** Update the existing private identity, never a public profile or parallel contact store. */
export function bookingContactUpdate(previous:any,actorId:string,input:{name:string;phone:string;consent:boolean;enabled?:boolean}){
 if(!input.consent)throw Error('Confirmá que querés recordar estos datos en este navegador.');
 if(previous&&(previous.id!==`identity.private.profile:${actorId}`||String(previous.attrs?.subjectActorId||previous.attrs?.actorId)!==actorId))throw Error('Los datos pertenecen a otra identidad.');
 const enabled=input.enabled!==false,name=input.name.trim(),phone=input.phone.trim();
 if(enabled&&(!name||name.length>120||phone.length>40||phone&&!/^\+?[\d ()-]{6,40}$/.test(phone)))throw Error('Revisá tu nombre y teléfono.');
 const at=new Date().toISOString(),priorContact=previous?.attrs?.contact||{};
 return {id:`identity.private.profile:${actorId}`,kind:'identity.private.profile',
  attrs:{...previous?.attrs,actorId,subjectActorId:actorId,participants:[actorId],
   contact:enabled?{...priorContact,name,phone,...(phone!==priorContact.phone?{phoneVerified:false}:{})}:priorContact,
   bookingAutofill:{enabled,consentAt:at,scope:'device'}},
  traits:previous?.traits||['identity:private','identity:personal'],
  meta:{...previous?.meta,ns:previous?.meta?.ns||'utopy:identity',scopes:['private'],version:Number(previous?.meta?.version||0)+1,updatedAt:at}};
}
async function personalContext(){
 const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});
 const access=mtLiveGetAccessContext();
 if(access?.actorId!==context.actorId||access?.nodeId)mtLiveSetAccessContext({actorId:context.actorId});
 const all=mtLiveSnapshot(),previous=all.find(dv=>dv.id===`identity.private.profile:${context.actorId}`);
 if(previous){const proof=await verifyAuthorizedDV(previous,all);if(!proof.accepted||proof.proof!=='verified'||proof.actorId!==context.actorId)throw Error('No pudimos verificar tus datos privados.');}
 return {context,all,previous};
}
export async function loadBookingContact(){
 const {context,previous}=await personalContext();
 if(!previous||previous.attrs.bookingAutofill?.enabled===false)return {actorId:context.actorId,name:'',phone:''};
 const contact=previous.attrs.contact||{};
 return {actorId:context.actorId,name:String(contact.name||[previous.attrs.firstName,previous.attrs.lastName].filter(Boolean).join(' ')).slice(0,120),phone:String(contact.phone||'').slice(0,40)};
}
export async function rememberBookingContact(input:Parameters<typeof bookingContactUpdate>[2]){
 const {context,all,previous}=await personalContext();
 if(context.wallet.custody!=='device')throw Error('Este navegador no permite guardar tu identidad. No se recordaron datos.');
 const dv=bookingContactUpdate(previous,context.actorId,input);
 if(mtLiveSnapshot().find(item=>item.id===dv.id)!==previous)throw Error('Tus datos cambiaron. Volvé a intentarlo.');
 await publishAuthorizedDV({dv,allLive:all,actingAsNodeId:null,requiredAuthority:context.actorId,action:'identity.private.update',sensitivity:'sensitive',localOnly:true});
 if(mtLiveGetAccessContext()?.actorId!==context.actorId||!mtLivePersistCurrent())throw Error('No pudimos conservar los datos en este navegador. No borres tu identidad; revisá el almacenamiento disponible.');
 return {name:input.name.trim(),phone:input.phone.trim(),enabled:input.enabled!==false};
}
