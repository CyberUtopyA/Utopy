import {lazy,Suspense,useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {mtLiveSnapshot,mtLiveSubscribe} from '../mt/mt.liveStore';
import {businessAccess,businessRegistry,type BusinessEntry} from '../utopy/businessWorkspace';
import {acquireLiveSymbiosis} from '../utopy/liveSymbiosis.singleton';
import BookingExperience from '../booking/BookingExperience';
import {luaBookingPreset} from '../booking/lua.preset';
import luaHero from '../assets/lua-hero-1200.jpg';
import luaHeroMobile from '../assets/lua-hero-720.jpg';
import luaLogo from '../assets/lua-logo-display.png';
import {refreshRemoteAdmin,fetchRemoteNode} from '../booking/adminClient';
const Wallet=lazy(()=>import('../utopy/WalletPanel'));
const SimpleIdentitySignup=lazy(()=>import('../components/SimpleIdentitySignup'));

/** Public alias, not a second node, automatic owner grant or trust by business name. */
export default function LuaPage({manage=false}:{manage?:boolean}){
 const [all,setAll]=useState<any[]>(mtLiveSnapshot),[nodeId,setNodeId]=useState(''),[entry,setEntry]=useState<BusinessEntry|null>(null),[checking,setChecking]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 useEffect(()=>{if(nodeId)void fetchRemoteNode(nodeId).catch(()=>{});},[nodeId]);
 useEffect(()=>{if(manage&&entry?.manifest.attrs.administration)void refreshRemoteAdmin(entry).catch(()=>{});},[manage,entry?.nodeId]);
 useEffect(()=>{let release=()=>{};try{release=acquireLiveSymbiosis();}catch{console.warn('[LUA] Red no disponible; se mantiene la presentación.');}const stop=mtLiveSubscribe(setAll);let active=true;void fetch('/lua-node.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{if(active&&typeof value?.nodeId==='string')setNodeId(value.nodeId);}).catch(()=>{});return()=>{active=false;stop();release();};},[]);
 useEffect(()=>{let active=true;void(async()=>{
  const entries=await businessRegistry(all);let selected:BusinessEntry|null=null;
  if(nodeId)selected=entries.find(item=>item.nodeId===nodeId)||null;
  else{const own=(await Promise.all(entries.filter(item=>item.manifest.attrs?.bookingPreparationKey==='lua-editorial-spa').map(async item=>await businessAccess(item,all)?item:null))).filter(Boolean) as BusinessEntry[];if(own.length===1)selected=own[0];}
  const access=selected?await businessAccess(selected,all):null;
  if(active){setEntry(selected);setAuthorized(Boolean(access));setChecking(false);}
 })().catch(()=>{if(active){setEntry(null);setChecking(false);}});return()=>{active=false;};},[all,nodeId]);
 if(checking)return <p role="status">Abriendo LUA…</p>;
 if(manage)return entry&&authorized?<Navigate replace to={`/n/${encodeURIComponent(entry.slug)}/gestionar`}/>:<main className="living-booking ub-workspace utopy-ui" data-preset="lua-editorial-spa"><header className="lb-entry-brand"><img src={luaLogo} alt="LUA Centro Estético y Spa"/><small>Tu espacio de gestión</small></header><Suspense fallback={<p>Abriendo identidad…</p>}><SimpleIdentitySignup/></Suspense><div className="lb-entry-actions"><Link to="/mi-espacio">Mi espacio</Link><details><summary>Ya tengo mi identidad</summary><p>Si tenés un respaldo, restauralo con tu contraseña. No compartas el respaldo ni la contraseña. Esto no concede permisos sobre LUA.</p><Suspense fallback={<p>Abriendo identidad…</p>}><Wallet compact/></Suspense></details><Link to="/lua">Volver a LUA</Link></div><details className="lb-entry-help"><summary>Ayuda con el acceso</summary><p>La gestión estará disponible cuando este enlace esté conectado al nodo y su responsable autorice tu identidad.</p></details></main>;
 const presentation={nodeId:'',name:'LUA Centro Estético y Spa',manifest:{attrs:{booking:luaBookingPreset('')}}};
 return <main className="lua-direct"><BookingExperience key={entry?.nodeId||'lua-presentation'} entry={entry||presentation} heroFallback={luaHero} heroSrcSetFallback={`${luaHeroMobile} 720w, ${luaHero} 1200w`} logoFallback={luaLogo} heroBrand manageHref="/lua/gestionar"/><footer style={{textAlign:'center',padding:'18px'}}><Link to="/lua/gestionar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:44,padding:'10px 24px',borderRadius:24,background:'#655040',color:'#fff',textDecoration:'none',fontWeight:600}}>Gestionar LUA</Link>{!entry?<p>Presentación de LUA. Las reservas se habilitarán cuando el nodo conecte su agenda.</p>:null}</footer></main>;
}
