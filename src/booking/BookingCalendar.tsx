import {useEffect,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
export default function BookingCalendar({value,min,onChange,endValue='',onEndChange}:{value:string;min:string;onChange:(date:string)=>void;endValue?:string;onEndChange?:(date:string)=>void}){
 const [month,setMonth]=useState(value.slice(0,7));
 const [rangePending,setRangePending]=useState(false);
 useEffect(()=>setRangePending(false),[Boolean(onEndChange)]);
 useEffect(()=>setMonth(value.slice(0,7)),[value]);
 const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1)),days=new Date(Date.UTC(year,m,0)).getUTCDate();
 const offset=(first.getUTCDay()+6)%7;
 const move=(delta:number)=>{const date=new Date(Date.UTC(year,m-1+delta,1));setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`);};
 return <section className="lb-calendar" aria-label="Calendario de citas">
  <h2><CalendarDays size={20} strokeWidth={1.5}/> Seleccioná una fecha</h2>
  <div className="lb-month"><button type="button" aria-label="Mes anterior" disabled={month<=min.slice(0,7)} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><strong aria-live="polite">{new Intl.DateTimeFormat('es-PY',{month:'long',year:'numeric',timeZone:'UTC'}).format(first)}</strong><button type="button" aria-label="Mes siguiente" onClick={()=>move(1)}><ChevronRight size={18}/></button></div>
  <div className="lb-weekdays" aria-hidden="true">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(day=><span key={day}>{day}</span>)}</div>
  <div className="lb-days" role="group" aria-label="Elegir día">{Array.from({length:offset},(_,i)=><span key={`empty:${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;return <button type="button" key={date} disabled={date<min} className={endValue&&date>value&&date<endValue?'lb-in-range':''} aria-label={new Intl.DateTimeFormat('es-PY',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))} aria-pressed={date===value||date===endValue} onClick={()=>{if(!onEndChange){onChange(date);return;}if(!rangePending){onChange(date);onEndChange('');setRangePending(true);}else if(date>=value){onEndChange(date);setRangePending(false);}else onChange(date);}}>{i+1}</button>;})}</div>
  <details><summary>Elegir fecha con teclado</summary><input aria-label="Fecha de la cita" type="date" min={min} value={value} onChange={e=>{if(e.target.value&&e.target.value>=min)onChange(e.target.value);}}/></details>
  <small>Los horarios disponibles se consultan al seleccionar el día.</small>
 </section>;
}
