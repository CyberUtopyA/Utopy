import {bookingPresentationTemplate} from './presentationTemplates.mjs';
export const BOOKING_CAPABILITY='living-booking';
export const BOOKING_ZONE='America/Asuncion';
export const BOOKING_FEATURES=Object.freeze({dailyHours:true,serviceFields:true,scheduleBreaks:true});
export const ACTIVE_BOOKING_STATES=['requested','confirmed'];
export function check(value,message){if(!value)throw Error(message);}
export const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9:._-]{1,160}$/.test(value);
export function iso(value){check(typeof value==='string'&&Number.isFinite(Date.parse(value)),'INVALID_DATE');return new Date(value).toISOString();}
export function safeImage(value){if(!value)return '';const url=new URL(value);check(url.protocol==='https:'&&!url.username&&!url.password,'INVALID_IMAGE');return url.href;}
export function validateTimeWindows(windows,weekly=false){
 check(Array.isArray(windows),'INVALID_SCHEDULE');
 for(const w of windows){check((!weekly||Number.isInteger(w.day)&&w.day>=0&&w.day<=6)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(w.end)&&w.start<w.end,'INVALID_WINDOW');
  check(w.breaks===undefined||Array.isArray(w.breaks)&&w.breaks.length<=720,'INVALID_BREAK');
  const breaks=[...(w.breaks||[])].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  for(let i=0;i<breaks.length;i++){const b=breaks[i];check(/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end)&&b.start<b.end&&b.start>=w.start&&b.end<=w.end,'INVALID_BREAK');check(!i||breaks[i-1].end<=b.start,'OVERLAPPING_BREAK');}
 }
 const sorted=[...windows].sort((a,b)=>(weekly?a.day-b.day:0)||a.start.localeCompare(b.start));
 for(let i=1;i<sorted.length;i++)check((weekly&&sorted[i-1].day!==sorted[i].day)||sorted[i-1].end<=sorted[i].start,'OVERLAPPING_WINDOW');
 return windows;
}
export function validateBookingConfig(raw){
 const c=structuredClone(raw);
 check(c?.schema==='utopy.living-booking/1'&&identifier(c.nodeId),'INVALID_CONFIG');
 check(c.timeZone===BOOKING_ZONE&&['approval','automatic'].includes(c.confirmation),'INVALID_POLICY');
 check(Array.isArray(c.services)&&c.services.length<=100&&Array.isArray(c.resources)&&c.resources.length<=50,'CONFIG_LIMIT');
 check(Number.isInteger(c.slotMinutes)&&c.slotMinutes>=5&&c.slotMinutes<=120,'INVALID_SLOT_STEP');
 const ids=new Set();for(const r of c.resources){check(identifier(r.id)&&!ids.has(r.id)&&typeof r.name==='string'&&r.name.length<=100&&['professional','shared'].includes(r.kind),'INVALID_RESOURCE');ids.add(r.id);
  check(Array.isArray(r.windows)&&r.windows.length<=700&&Array.isArray(r.blocks)&&r.blocks.length<=500,'INVALID_SCHEDULE');
  validateTimeWindows(r.windows,true);
  for(const b of r.blocks)check(Date.parse(iso(b.start))<Date.parse(iso(b.end)),'INVALID_BLOCK');
  r.dateOverrides=r.dateOverrides||[];check(Array.isArray(r.dateOverrides)&&r.dateOverrides.length<=366,'INVALID_DAILY_SCHEDULE');
  const dates=new Set();for(const override of r.dateOverrides){check(/^\d{4}-\d{2}-\d{2}$/.test(override.date)&&!dates.has(override.date)&&Array.isArray(override.windows)&&override.windows.length<=100,'INVALID_DAILY_SCHEDULE');dates.add(override.date);localInstant(override.date,'12:00');validateTimeWindows(override.windows);}
 }
 const services=new Set();for(const s of c.services){check(identifier(s.id)&&!services.has(s.id)&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=160&&typeof s.description==='string'&&s.description.length<=1000,'INVALID_SERVICE');services.add(s.id);
  check(typeof s.active==='boolean'&&['PYG','USD','BRL'].includes(s.currency),'INVALID_SERVICE');
  check(s.price===null||Number.isSafeInteger(s.price)&&s.price>=0,'INVALID_PRICE_MINOR');
  check(s.durationMinutes===null||Number.isInteger(s.durationMinutes)&&s.durationMinutes>=5&&s.durationMinutes<=480,'INVALID_DURATION');
  check(Array.isArray(s.professionalIds)&&Array.isArray(s.resourceIds)&&[...s.professionalIds,...s.resourceIds].every(id=>ids.has(id)),'UNKNOWN_RESOURCE');
  check(s.professionalIds.every(id=>c.resources.find(r=>r.id===id).kind==='professional'),'INVALID_PROFESSIONAL');
  check(s.resourceIds.every(id=>c.resources.find(r=>r.id===id).kind==='shared'),'INVALID_SHARED_RESOURCE');
  check(!s.active||s.durationMinutes!==null&&s.professionalIds.length>0,'INCOMPLETE_SERVICE');s.image=safeImage(s.image);
  check(s.visible===undefined||typeof s.visible==='boolean','INVALID_SERVICE');s.extraFields=s.extraFields||[];check(Array.isArray(s.extraFields)&&s.extraFields.length<=20,'SERVICE_FIELDS_LIMIT');s.extraFields=s.extraFields.filter(f=>f?.label!==''||f?.value!=='');for(const f of s.extraFields)check(typeof f?.label==='string'&&f.label.trim().length>0&&f.label.length<=80&&typeof f.value==='string'&&f.value.length<=1000,'INVALID_SERVICE_FIELD');
 }
 c.presentation=c.presentation||{};
 for(const field of ['logo','hero'])c.presentation[field]=safeImage(c.presentation[field]);
 check(!c.presentation.address||typeof c.presentation.address==='string'&&c.presentation.address.length<=300,'INVALID_ADDRESS');
 for(const key of ['tagline','instagram'])check(!c.presentation[key]||typeof c.presentation[key]==='string'&&c.presentation[key].length<=200,'INVALID_PRESENTATION');
 check(typeof c.name==='string'&&c.name.length>1&&c.name.length<=100,'INVALID_NAME');
 c.gallery=c.gallery||[];check(Array.isArray(c.gallery)&&c.gallery.length<=100,'GALLERY_LIMIT');
 for(const photo of c.gallery){check(identifier(photo.id)&&photo.publicConsent===true&&services.has(photo.serviceId)&&typeof photo.title==='string'&&photo.title.length<=120,'INVALID_GALLERY');photo.image=safeImage(photo.image);check(photo.image,'IMAGE_REQUIRED');}
 check(['lua-editorial-spa','standard'].includes(c.presentation.preset||'standard')||bookingPresentationTemplate(c.presentation.preset),'INVALID_PRESET');
 return c;
}
export function localParts(value){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BOOKING_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));return Object.fromEntries(parts.map(p=>[p.type,p.value]));}
/** Whitelist projection: schedules, blocks and arbitrary private config fields never leave the node. */
export function publicBookingConfig(c){
 const p=c.presentation||{};
 return {schema:c.schema,nodeId:c.nodeId,name:c.name,version:c.version,timeZone:c.timeZone,confirmation:c.confirmation,slotMinutes:c.slotMinutes,features:BOOKING_FEATURES,
  presentation:Object.fromEntries(['preset','tagline','logo','hero','address','instagram'].filter(key=>p[key]!==undefined).map(key=>[key,p[key]])),
  resources:c.resources.filter(r=>r.kind==='professional').map(r=>({id:r.id,name:r.name,kind:r.kind,windows:[],blocks:[]})),
  services:c.services.filter(s=>s.visible!==false).map(s=>({id:s.id,name:s.name,category:s.category,description:s.description,image:s.image,price:s.price,currency:s.currency,durationMinutes:s.durationMinutes,active:s.active,professionalIds:s.professionalIds,resourceIds:[],acceptsReferences:s.acceptsReferences===true,extraFields:s.extraFields||[]})),
  gallery:c.gallery.filter(p=>c.services.some(s=>s.id===p.serviceId&&s.visible!==false)).map(p=>({id:p.id,title:p.title,image:p.image,serviceId:p.serviceId,publicConsent:true}))};
}
/** Resolve local wall time through IANA rules, never a hardcoded UTC offset. */
export function localInstant(date,time){
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time),'INVALID_LOCAL_DATE');
 const desired=Date.parse(`${date}T${time}:00Z`);check(Number.isFinite(desired),'INVALID_LOCAL_DATE');let value=desired;
 for(let i=0;i<3;i++){const p=localParts(value);value+=desired-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}
 const p=localParts(value);check(`${p.year}-${p.month}-${p.day}`===date&&`${p.hour}:${p.minute}`===time,'INVALID_LOCAL_DATE');return new Date(value).toISOString();
}
export function candidateSlots(c,date,serviceId,professionalId,now=Date.now()){
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(`${date}T12:00:00Z`))&&Date.parse(`${date}T00:00:00Z`)<now+366*86400000,'INVALID_DATE');
 const service=c.services.find(s=>s.id===serviceId&&s.active&&s.visible!==false);check(service&&service.professionalIds.includes(professionalId),'SERVICE_UNAVAILABLE');
 const day=new Date(`${date}T12:00:00Z`).getUTCDay(),resources=[...new Set([professionalId,...service.resourceIds])].map(id=>c.resources.find(r=>r.id===id));
 check(resources.every(Boolean),'RESOURCE_UNAVAILABLE');const result=[];
 for(let minute=0;minute<1440;minute+=c.slotMinutes){const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;const endMinute=minute+service.durationMinutes;if(endMinute>1440)continue;
  const finish=`${String(Math.floor(endMinute/60)).padStart(2,'0')}:${String(endMinute%60).padStart(2,'0')}`;
  if(!resources.every(r=>{const override=r.dateOverrides?.find(o=>o.date===date);const windows=override?override.windows:r.windows.filter(w=>w.day===day);return windows.some(w=>w.start<=time&&w.end>=finish&&!(w.breaks||[]).some(b=>b.start<finish&&b.end>time));}))continue;
  const start=localInstant(date,time),end=new Date(Date.parse(start)+service.durationMinutes*60000).toISOString();
  if(Date.parse(start)<=now||resources.some(r=>r.blocks.some(b=>Date.parse(b.start)<Date.parse(end)&&Date.parse(b.end)>Date.parse(start))))continue;
  result.push({start,end,label:time,resourceIds:resources.map(r=>r.id)});
 }return result;
}
export function bookingCalendar(booking,config){
 const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,'\\$&').replace(/\r/g,'');
 const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UTOPY//Living Booking//ES','BEGIN:VEVENT',`UID:${escape(booking.id)}@utopy`,`SEQUENCE:${booking.version||0}`, `DTSTAMP:${stamp(booking.updatedAt)}`,`DTSTART:${stamp(booking.start)}`,`DTEND:${stamp(booking.end)}`,`SUMMARY:${escape(config.services.find(s=>s.id===booking.serviceId)?.name)}`,`LOCATION:${escape(config.presentation.address)}`,`STATUS:${booking.status==='cancelled'?'CANCELLED':booking.status==='confirmed'?'CONFIRMED':'TENTATIVE'}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
