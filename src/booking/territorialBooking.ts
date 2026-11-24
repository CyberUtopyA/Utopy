import {bookingEndpoint,bookingRequest} from './client';
import {businessPath,type BusinessEntry} from '../utopy/businessWorkspace';
/** Read-only adapter of the existing public catalog. Never derives free slots
 * from schedules, imports private contacts or creates another booking store. */
export function projectTerritorialBooking(entry:BusinessEntry,catalog:any){
 if(catalog?.schema!=='utopy.living-booking/1'||catalog.nodeId!==entry.nodeId||!Array.isArray(catalog.services)||catalog.services.length>100)throw Error('El catálogo no corresponde a este nodo.');
 return catalog.services.filter((s:any)=>s.visible!==false&&typeof s.id==='string'&&typeof s.name==='string').map((s:any)=>({id:`${entry.nodeId}:${s.id}`,title:s.name,seller:entry.name,sellerNodeId:entry.nodeId,category:String(s.category||'Servicios'),catalogCategory:String(s.category||''),price:s.price===null?'Consultar precio':typeof s.price==='number'?new Intl.NumberFormat('es-PY',{style:'currency',currency:['PYG','USD','BRL'].includes(s.currency)?s.currency:'PYG'}).format(s.price/(s.currency==='PYG'?1:100)):'Consultar precio',image:s.image||'',viewKind:'booking',bookable:s.active===true&&Number(s.durationMinutes)>0&&Array.isArray(s.professionalIds)&&s.professionalIds.length>0,entry,serviceId:s.id,raw:entry.manifest,territorySource:entry.manifest,href:`${businessPath(entry)}?service=${encodeURIComponent(s.id)}&from=mt`}));
}
export async function loadTerritorialBookingCatalog(entries:BusinessEntry[],request=bookingRequest,endpointFor=bookingEndpoint){
 const rows:any[]=[],issues:{nodeId:string;name:string;message:string}[]=[];let cursor=0;
 const eligible=entries.filter(entry=>entry.manifest.attrs?.simulation!==true&&!entry.manifest.attrs?.demonstrationSet&&(entry.manifest.attrs?.booking||entry.manifest.attrs?.capabilities?.some((c:any)=>(typeof c==='string'?c:c.id)==='living-booking')));
 await Promise.all(Array.from({length:Math.min(2,eligible.length)},async()=>{while(cursor<eligible.length){const entry=eligible[cursor++],endpoint=endpointFor(entry);if(!endpoint){issues.push({nodeId:entry.nodeId,name:entry.name,message:'Agenda sin conexión pública configurada.'});continue;}try{rows.push(...projectTerritorialBooking(entry,await request(endpoint,entry.nodeId,'catalog')));}catch{issues.push({nodeId:entry.nodeId,name:entry.name,message:'No se pudo consultar su agenda. No se confirma disponibilidad.'});}}}));
 return {rows,issues};
}
