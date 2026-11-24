import {Suspense,lazy,useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {mtLiveSnapshot,mtLiveSubscribe} from '../mt/mt.liveStore';
import {businessAccess,businessRegistry,type BusinessEntry} from '../utopy/businessWorkspace';
import {acquireLiveSymbiosis} from '../utopy/liveSymbiosis.singleton';
import {fetchRemoteNode,refreshRemoteAdmin} from '../booking/adminClient';
import BookingExperience from '../booking/BookingExperience';
const BookingSetup=lazy(()=>import('../booking/BookingSetup'));
import {bassiBookingPreset} from '../booking/bassi.preset';
import bassiHero from '../assets/bassi-hero-941.jpg';
import bassiHeroMobile from '../assets/bassi-hero-640.jpg';
import bassiLogo from '../assets/bassi-logo-display.png';
import '../booking/bassiEditorial.css';
const Signup=lazy(()=>import('../components/SimpleIdentitySignup'));
export default function BassiPage({manage=false}:{manage?:boolean}){
 const [all,setAll]=useState<any[]>(mtLiveSnapshot),[nodeId,setNodeId]=useState(''),[entry,setEntry]=useState<BusinessEntry|null>(null),[authorized,setAuthorized]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;const stop=mtLiveSubscribe(setAll);let release=()=>{};try{release=acquireLiveSymbiosis();}catch{}void fetch('/bassi-node.json',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const value=await r.json();if(active&&typeof value.nodeId==='string')setNodeId(value.nodeId);}).catch(()=>{});return()=>{active=false;stop();release();};},[]);
 useEffect(()=>{if(nodeId)void fetchRemoteNode(nodeId).catch(()=>setError('No pudimos conectar el nodo. Reintentá más tarde.'));},[nodeId]);
 useEffect(()=>{let active=true;void(async()=>{const entries=await businessRegistry(all);let selected=nodeId?entries.find(e=>e.nodeId===nodeId):null;
  if(!nodeId){const own=(await Promise.all(entries.filter(e=>e.manifest.attrs.bookingPreparationKey==='bassi-commercial').map(async e=>await businessAccess(e,all)?e:null))).filter(Boolean) as BusinessEntry[];if(own.length===1)selected=own[0];}
  const access=selected?await businessAccess(selected,all):null;if(active){setEntry(selected||null);setAuthorized(!!access);}
 })().catch(()=>{if(active)setError('No se pudo verificar el acceso.');});return()=>{active=false;};},[all,nodeId]);
 useEffect(()=>{if(manage&&entry?.manifest.attrs.administration)void refreshRemoteAdmin(entry).catch(()=>{});},[manage,entry?.nodeId]);
 if(manage&&entry&&authorized)return <Navigate replace to={`/n/${encodeURIComponent(entry.slug)}/gestionar`}/>;
 if(manage)return <main className="living-booking bassi-entry"><header className="bassi-management-brand"><img src={bassiLogo} alt="Bassi"/><h1>Bienvenido</h1><p>Todo tu salón, en un solo lugar.</p></header>{error?<p role="status">{error}</p>:null}<Suspense fallback={<p>Abriendo identidad…</p>}><Signup/></Suspense>{!nodeId&&!entry?<Suspense fallback={<p role="status">Abriendo configuración…</p>}><BookingSetup initialTemplate="bassi-editorial-salon" initialName="Bassi Coiffure"/></Suspense>:<p>Ingresá con tu identidad autorizada o aceptá la invitación privada del responsable.</p>}<Link to="/mi-espacio">Mis espacios</Link> · <Link to="/bassi">Volver al salón</Link></main>;
 const presentation={nodeId:'',name:'Bassi Coiffure',manifest:{attrs:{booking:bassiBookingPreset('')}}};
 return <main className="bassi-direct">{error?<p role="status">{error}</p>:null}<BookingExperience key={entry?.nodeId||'bassi-presentation'} entry={entry||presentation} heroFallback={bassiHero} heroSrcSetFallback={`${bassiHeroMobile} 640w, ${bassiHero} 941w`} logoFallback={bassiLogo} heroBrand manageHref="/bassi/gestionar"/></main>;
}
