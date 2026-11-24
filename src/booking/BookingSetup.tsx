import {useState} from 'react';
import {Link} from 'react-router-dom';
import {createBookingNode,connectBookingNode} from './activate';
import {BOOKING_PRESENTATION_TEMPLATES} from './presentationTemplates.mjs';
export default function BookingSetup({entry,initialTemplate='',initialName=''}:{entry?:any;initialTemplate?:string;initialName?:string}){
 const [template,setTemplate]=useState(initialTemplate||'lua-editorial-spa'),[name,setName]=useState(initialName);
 const [endpoint,setEndpoint]=useState(entry?.manifest.attrs?.endpoints?.livingBooking||''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[created,setCreated]=useState<any>(null);
 const lua=template==='lua-editorial-spa';
 const save=async()=>{if(busy)return;setBusy(true);setNotice('');try{
  const result=entry?await connectBookingNode(entry,endpoint,consent):await createBookingNode(name,lua,consent,template);
  setCreated(result);setConsent(false);setNotice(entry?'Conexión firmada. La disponibilidad se comprobará en el servidor del nodo.':'Identidad comercial guardada y firmada en este dispositivo. Aún no hay disponibilidad publicada ni servidor conectado.');
 }catch(error:any){setNotice(error.message);}finally{setBusy(false);}};
 return <section className="utopy-card ub-form"><h2>{entry?'Activar agendamiento':'Preparar un nodo con agenda'}</h2><p>Servicios y turnos con tus propios datos y permisos.</p>
  {entry?<label>Endpoint del servidor de este nodo<input type="url" className="utopy-input" value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="https://tu-nodo/…"/></label>:<>
   <label>Presentación<select className="utopy-input" value={template} onChange={e=>setTemplate(e.target.value)}><option value="lua-editorial-spa">LUA Centro Estético y Spa</option><option value="standard">Mi propio nodo</option>{Object.values(BOOKING_PRESENTATION_TEMPLATES).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   {!lua?<label>Nombre real<input className="utopy-input" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>:null}
  </>}
  <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Administro este nodo y autorizo guardar esta configuración.</label>
  <button type="button" className="utopy-button" disabled={busy||!consent||!!entry&&!endpoint||!entry&&!lua&&name.trim().length<2} onClick={()=>void save()}>{busy?'Guardando…':entry?'Conectar capacidad':'Crear identidad comercial'}</button>
  {notice?<p role="status">{notice}</p>:null}{created?<Link className="utopy-button" to={`/n/${encodeURIComponent(created.attrs.slug)}/gestionar`}>Abrir gestión del nodo</Link>:null}
 </section>;
}
