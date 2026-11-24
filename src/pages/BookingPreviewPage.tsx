import {useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {CalendarDays,Scissors,UsersRound,Clock,RotateCcw,FlaskConical,Check} from 'lucide-react';
import {bookingPreviewConfig} from '../booking/previewConfig';
import {candidateSlots,localParts,validateBookingConfig} from '../booking/contracts.mjs';
import WeeklyScheduleEditor from '../booking/WeeklyScheduleEditor';
import ServiceCatalogEditor from '../booking/ServiceCatalogEditor';
import BookingResources from '../booking/BookingResources';
import BookingCalendar from '../booking/BookingCalendar';
import luaLogo from '../assets/lua-logo-display.png';
import bassiLogo from '../assets/bassi-logo-display.png';
import '../booking/booking.css';
import '../booking/bookingPremium.css';
import '../booking/bassiEditorial.css';
import '../booking/luaAppearance.css';
import '../booking/bookingPreview.css';

function PreviewWorkspace({brand}:{brand:string}){
 const [draft,setDraft]=useState<any>(()=>bookingPreviewConfig(brand)),[tab,setTab]=useState('schedule'),[notice,setNotice]=useState('');
 const today=()=>{const p=localParts(new Date());return `${p.year}-${p.month}-${p.day}`;};
 const [date,setDate]=useState(today);
 const change=(next:any)=>{setDraft(next);setNotice('');};
 const slots=useMemo(()=>{try{const c=validateBookingConfig(draft),service=c.services.find((s:any)=>s.active);return service?candidateSlots(c,date,service.id,service.professionalIds[0]):[];}catch{return [];}},[draft,date]);
 return <section className="living-booking lb-manager booking-preview" data-preset={draft.presentation.preset}>
  <header className="booking-preview-brand"><img src={brand==='bassi'?bassiLogo:luaLogo} alt={brand==='bassi'?'Bassi':'LUA'}/><h1>Probá tu gestión</h1><p>Servicios, horarios y equipo, en un solo lugar.</p></header>
  <aside className="booking-preview-notice"><FlaskConical size={22}/><div><b>Vista de prueba · datos de ejemplo</b><p>Podés editar sin afectar ningún negocio. Todo se reinicia al salir o recargar.</p></div></aside>
  <nav className="lb-categories" aria-label="Secciones de la prueba">{[['schedule','Horarios',Clock],['services','Servicios',Scissors],['team','Equipo',UsersRound],['agenda','Agenda',CalendarDays]].map(([id,title,Icon]:any)=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={18}/>{title}</button>)}</nav>
  {tab==='schedule'?<WeeklyScheduleEditor draft={draft} onChange={change}/>:null}
  {tab==='services'?<ServiceCatalogEditor draft={draft} onChange={change} entry={null} endpoint="" mediaEnabled={false}/>:null}
  {tab==='team'?<BookingResources draft={draft} onChange={change}/>:null}
  {tab==='agenda'?<><BookingCalendar value={date} min={today()} onChange={setDate}/><h2>Ejemplo de disponibilidad</h2><p>Calculada con los horarios de esta prueba, no con citas reales.</p><div className="lb-slots">{slots.map((slot:any)=><span className="booking-preview-slot" key={slot.start}>{slot.label}</span>)}</div>{!slots.length?<p>No hay horarios en este ejemplo para la fecha elegida.</p>:null}</>:null}
  <div className="lb-actions booking-preview-actions"><button className="lb-primary" type="button" onClick={()=>{try{validateBookingConfig(draft);setNotice('Cambios válidos en esta prueba. No se guardó nada en producción.');}catch{setNotice('Revisá horarios, servicios y asignaciones antes de continuar.');}}}><Check size={18}/>Probar cambios</button><button type="button" onClick={()=>{setDraft(bookingPreviewConfig(brand));setNotice('Vista restablecida con datos de ejemplo.');}}><RotateCcw size={18}/>Restablecer</button></div>
  {notice?<p role="status" className="lb-notice">{notice}</p>:null}
  <footer><Link to={brand==='bassi'?'/bassi/gestionar':'/lua/gestionar'}>Salir y abrir gestión real · requiere acceso</Link></footer>
 </section>;
}
export default function BookingPreviewPage(){
 const [query,setQuery]=useSearchParams(),brand=query.get('marca')==='bassi'?'bassi':'lua';
 return <main className="booking-preview-page"><nav className="booking-preview-switch" aria-label="Elegir diseño">{[['lua','LUA'],['bassi','Bassi']].map(([id,title])=><button key={id} type="button" aria-pressed={brand===id} onClick={()=>setQuery({marca:id})}>{title}</button>)}</nav><PreviewWorkspace key={brand} brand={brand}/></main>;
}
