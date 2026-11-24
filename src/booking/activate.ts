import {buildOwnerNodeManifest} from '../utopy/nodeOwnerOnboarding';
import {mtLiveSnapshot} from '../mt/mt.liveStore';
import {publishAuthorizedDV,verifyAuthorizedDV} from '../utopy/authorizedPublish';
import {resolveCurrentIdentityContext} from '../utopy/identityContext';
import {businessAccess,type BusinessEntry} from '../utopy/businessWorkspace';
import {luaBookingPreset} from './lua.preset';
import {bassiBookingPreset} from './bassi.preset';
let creating=false;
export async function createBookingNode(name:string,lua:boolean,consent:boolean,template='standard'){
 if(creating)throw Error('Ya se está preparando el nodo.');creating=true;
 try{
  if(!consent)throw Error('Confirmá que administrás este negocio y autorizás su presentación.');
  const all=mtLiveSnapshot(),identity=await resolveCurrentIdentityContext({allLive:all});
  if(identity.wallet.custody!=='device'||!identity.wallet.recoveryReady)throw Error('Primero prepará tu identidad persistente y su respaldo cifrado desde Mi identidad.');
  const bassi=template==='bassi-editorial-salon';
  const key=lua?'lua-editorial-spa':bassi&&name.trim()==='Bassi Coiffure'?'bassi-commercial':`booking:${name.trim().toLowerCase()}`;
  const prior=all.find(dv=>dv.kind==='utopy.node.manifest'&&dv.attrs?.bookingPreparationKey===key&&dv.meta?.ownership?.ownerDid===identity.ownerDid);
  if(prior){const proof=await verifyAuthorizedDV(prior,all);if(!proof.accepted||proof.proof!=='verified')throw Error('La preparación anterior no se pudo verificar.');return prior;}
  const manifest=buildOwnerNodeManifest({name:lua?'LUA Centro Estético y Spa':name,purpose:'Servicios y citas con disponibilidad verificada',configuration:null},'');
  const nodeId=manifest.attrs.nodeId;
  const booking=lua?luaBookingPreset(nodeId):bassi?bassiBookingPreset(nodeId,name):{schema:'utopy.living-booking/1',nodeId,name,confirmation:'approval',slotMinutes:15,timeZone:'America/Asuncion',services:[],resources:[],presentation:{preset:'standard',logo:'',hero:''},gallery:[]};
  manifest.attrs={...manifest.attrs,booking,bookingPreparationKey:key,presentationPreset:booking.presentation.preset,category:lua?'Salud y belleza':undefined};
  return (await publishAuthorizedDV({dv:manifest,allLive:all,actingAsNodeId:nodeId,requiredAuthority:nodeId,allowNodeBootstrap:true,localOnly:true})).dv;
 }finally{creating=false;}
}
export async function connectBookingNode(entry:BusinessEntry,endpoint:string,consent:boolean){
 if(!consent)throw Error('Confirmá la conexión con el servidor de este nodo.');
 const url=new URL(endpoint,window.location.origin);if(url.protocol!=='https:'&&url.origin!==window.location.origin)throw Error('Usá HTTPS para el servidor del nodo.');if(url.username||url.password)throw Error('No incluyas credenciales en la URL.');
 const all=mtLiveSnapshot();if(!await businessAccess(entry,all,'node.manifest'))throw Error('No tenés permiso para conectar esta capacidad.');
 const latest=all.find(dv=>dv.id===entry.manifest.id);if(latest!==entry.manifest)throw Error('El nodo cambió. Volvé a abrir su configuración.');
 const {ownership:_,...meta}=entry.manifest.meta;
 const capabilities=[...(entry.manifest.attrs.capabilities||[]).filter((c:any)=>(typeof c==='string'?c:c.id)!=='living-booking'),{id:'living-booking',accepts:['booking.request'],produces:['booking.create','booking.confirm','booking.cancel','booking.reschedule'],verbs:['agendar','reservar']}];
 const ts=new Date().toISOString();const dv={...entry.manifest,attrs:{...entry.manifest.attrs,capabilities,endpoints:{...entry.manifest.attrs.endpoints,livingBooking:url.href}},meta:{...meta,version:Number(meta.version||1)+1,updatedAt:ts}};
 return (await publishAuthorizedDV({dv,allLive:all,actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'node.manifest',localOnly:true})).dv;
}
