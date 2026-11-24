import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {check,identifier,iso,validateBookingConfig,candidateSlots,ACTIVE_BOOKING_STATES,publicBookingConfig,BOOKING_FEATURES} from '../../src/booking/contracts.mjs';
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonical(value[key]))])):value);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
/** Node-owned persistent authority boundary. Host injects real Identity/Authority verification. */
export class LivingBookingStore{
 constructor(path,{authorize,now=()=>Date.now()}={}){this.authorize=authorize;this.now=now;this.db=new DatabaseSync(path);this.db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS living_booking_configs(node_id TEXT PRIMARY KEY,version INTEGER NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS living_bookings(id TEXT PRIMARY KEY,node_id TEXT NOT NULL,actor_id TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS living_booking_lookup ON living_bookings(node_id,start,end);
 CREATE TABLE IF NOT EXISTS living_booking_requests(node_id TEXT NOT NULL,actor_id TEXT NOT NULL,request_key TEXT NOT NULL,hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(node_id,actor_id,request_key));
 CREATE TABLE IF NOT EXISTS living_booking_events(sequence INTEGER PRIMARY KEY,node_id TEXT NOT NULL,body TEXT NOT NULL);`);}
 async access(proof,nodeId,action,request){check(identifier(nodeId),'INVALID_NODE');check(typeof this.authorize==='function','IDENTITY_ADAPTER_NOT_CONFIGURED');const context=await this.authorize({proof,nodeId,action,request,now:this.now()});check(context?.verified===true&&identifier(context.actorId)&&context.nodeId===nodeId&&context.allowedActions?.includes(action),'FORBIDDEN');return context;}
 config(nodeId){const row=this.db.prepare('SELECT * FROM living_booking_configs WHERE node_id=?').get(nodeId);check(row,'NODE_NOT_CONFIGURED');return {...JSON.parse(row.body),version:row.version,features:BOOKING_FEATURES};}
 async configure(proof,nodeId,raw,version){const context=await this.access(proof,nodeId,'booking.configure',{nodeId,op:'configure',config:raw,version});const config=validateBookingConfig(raw);check(config.nodeId===nodeId,'NODE_MISMATCH');
  return this.transaction(()=>{const prior=this.db.prepare('SELECT version FROM living_booking_configs WHERE node_id=?').get(nodeId);check((prior?.version||0)===version,'VERSION_CONFLICT');
   // Cannot silently move/block already accepted appointments by editing services.
   const active=this.db.prepare("SELECT body FROM living_bookings WHERE node_id=? AND status IN ('requested','confirmed') AND end>?").all(nodeId,new Date(this.now()).toISOString()).map(row=>JSON.parse(row.body));
   for(const b of active){const s=config.services.find(s=>s.id===b.serviceId);check(s&&s.durationMinutes===(Date.parse(b.end)-Date.parse(b.start))/60000&&s.professionalIds.includes(b.professionalId)&&JSON.stringify([...s.resourceIds].sort())===JSON.stringify(b.resourceIds.filter(id=>id!==b.professionalId).sort()),'ACTIVE_BOOKING_CONFIG_CONFLICT');const existingSchedule={...config,services:config.services.map(service=>service.id===b.serviceId?{...service,active:true,visible:true}:service)};check(candidateSlots(existingSchedule,b.localDate,b.serviceId,b.professionalId,this.now()).some(slot=>slot.start===b.start),'ACTIVE_BOOKING_CONFIG_CONFLICT');}
   const next=version+1;this.db.prepare('INSERT INTO living_booking_configs VALUES(?,?,?) ON CONFLICT(node_id) DO UPDATE SET version=excluded.version,body=excluded.body').run(nodeId,next,JSON.stringify(config));this.event(nodeId,'booking.configuration',context.actorId,{version:next,configurationHash:digest(config)});this.event(nodeId,'booking.catalog',context.actorId,{version:next,catalog:publicBookingConfig({...config,version:next})},{public:true,stateId:`booking.catalog:${nodeId}`,version:next});return {...config,version:next,features:BOOKING_FEATURES};});}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 event(nodeId,kind,actorId,attrs,options={}){const ts=new Date(this.now()).toISOString();const dv={id:options.stateId||`${kind}:${randomUUID()}`,kind,attrs:{...attrs,nodeId,...(!options.public?{actorId}:{})},traits:['utopy:living-booking'],meta:{authority:nodeId,originNode:nodeId,ns:'utopy:booking',version:options.version||1,ts,updatedAt:ts,scopes:[options.public?'public':'participants']}};this.db.prepare('INSERT INTO living_booking_events(node_id,body) VALUES(?,?)').run(nodeId,JSON.stringify(dv));return dv;}
 occupied(nodeId,slot,exclude=''){return this.db.prepare("SELECT body FROM living_bookings WHERE node_id=? AND id<>? AND status IN ('requested','confirmed') AND start<? AND end>?").all(nodeId,exclude,slot.end,slot.start).map(row=>JSON.parse(row.body)).some(b=>b.resourceIds.some(id=>slot.resourceIds.includes(id)));}
 slots(nodeId,date,serviceId,professionalId){const c=this.config(nodeId);check(/^\d{4}-\d{2}-\d{2}$/.test(date),'INVALID_DATE');check(Date.parse(`${date}T00:00:00Z`)<this.now()+366*86400000,'DATE_TOO_FAR');return candidateSlots(c,date,serviceId,professionalId,this.now()).filter(slot=>!this.occupied(nodeId,slot)).map(({resourceIds,...slot})=>slot);}
 async list(proof,nodeId,admin=false){const ctx=await this.access(proof,nodeId,admin?'booking.manage':'booking.self',{nodeId,op:'list',...(admin?{admin:true}:{})});return this.db.prepare(`SELECT body FROM living_bookings WHERE node_id=?${admin?'':' AND actor_id=?'} ORDER BY start`).all(...(admin?[nodeId]:[nodeId,ctx.actorId])).map(row=>JSON.parse(row.body));}
 async command(proof,nodeId,requestKey,command){
  const cmd=structuredClone(command);check(identifier(requestKey),'INVALID_IDEMPOTENCY_KEY');check(['create','reschedule','cancel','confirm','complete','absent'].includes(cmd.op),'INVALID_ACTION');
  const administrative=['confirm','complete','absent'].includes(cmd.op)||cmd.admin===true;
  const ctx=await this.access(proof,nodeId,administrative?'booking.manage':'booking.self',{nodeId,op:'command',requestKey,command:cmd});
  if(cmd.contact!==undefined)check(cmd.contact?.consent===true&&typeof cmd.contact.name==='string'&&cmd.contact.name.length<=120&&typeof cmd.contact.phone==='string'&&cmd.contact.phone.length<=40&&(!cmd.contact.phone||/^\+?[\d ()-]{6,40}$/.test(cmd.contact.phone)),'INVALID_CONTACT');
  if(cmd.notes!==undefined)check(typeof cmd.notes==='string'&&cmd.notes.length<=1000,'INVALID_NOTES');
  return this.transaction(()=>{const hash=digest(cmd);const prior=this.db.prepare('SELECT * FROM living_booking_requests WHERE node_id=? AND actor_id=? AND request_key=?').get(nodeId,ctx.actorId,requestKey);if(prior){check(prior.hash===hash,'IDEMPOTENCY_CONFLICT');return JSON.parse(prior.result);}
   const config=this.config(nodeId);let b=cmd.op==='create'?null:this.db.prepare('SELECT body FROM living_bookings WHERE node_id=? AND id=?').get(nodeId,cmd.id);b=b?JSON.parse(b.body):null;
   if(cmd.op!=='create'){check(b,'BOOKING_NOT_FOUND');check(administrative||b.actorId===ctx.actorId,'FORBIDDEN');check(cmd.version===b.version,'VERSION_CONFLICT');}
   if(['create','reschedule'].includes(cmd.op)){
    if(b)check(ACTIVE_BOOKING_STATES.includes(b.status),'INVALID_TRANSITION');
    const serviceId=b?.serviceId||cmd.serviceId,professionalId=cmd.professionalId||b?.professionalId;
    const slot=candidateSlots(config,cmd.date,serviceId,professionalId,this.now()).find(slot=>slot.start===iso(cmd.start));check(slot,'SLOT_UNAVAILABLE');check(!this.occupied(nodeId,slot,b?.id),'SLOT_OCCUPIED');
    const service=config.services.find(s=>s.id===serviceId);const references=cmd.references||b?.references||[];check(Array.isArray(references)&&references.length<=8&&references.every(id=>config.gallery.some(photo=>photo.id===id&&photo.serviceId===serviceId)),'INVALID_REFERENCE');check(!references.length||service.acceptsReferences,'REFERENCES_NOT_ALLOWED');
    b={...b,id:b?.id||`booking:${randomUUID()}`,nodeId,actorId:b?.actorId||ctx.actorId,serviceId,professionalId,localDate:cmd.date,...slot,references,status:config.confirmation==='automatic'?'confirmed':'requested',price:service.price,currency:service.currency,version:(b?.version||0)+1,updatedAt:new Date(this.now()).toISOString()};
   }else{const next={cancel:'cancelled',confirm:'confirmed',complete:'completed',absent:'absent'}[cmd.op];check(cmd.op==='confirm'?b.status==='requested':cmd.op==='cancel'?ACTIVE_BOOKING_STATES.includes(b.status):b.status==='confirmed','INVALID_TRANSITION');if(['complete','absent'].includes(cmd.op))check(Date.parse(b.end)<=this.now(),'APPOINTMENT_NOT_FINISHED');b={...b,status:next,version:b.version+1,updatedAt:new Date(this.now()).toISOString()};}
   if(cmd.contact!==undefined)b.contact={name:cmd.contact.name.trim(),phone:cmd.contact.phone.trim(),consent:true};if(cmd.notes!==undefined)b.notes=cmd.notes.trim();
   this.db.prepare('INSERT INTO living_bookings VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET start=excluded.start,end=excluded.end,status=excluded.status,version=excluded.version,body=excluded.body').run(b.id,nodeId,b.actorId,b.start,b.end,b.status,b.version,JSON.stringify(b));
   const event=this.event(nodeId,`booking.${cmd.op}`,ctx.actorId,{bookingId:b.id,participants:[b.actorId,nodeId],version:b.version,status:b.status,booking:b});const result={booking:b,event};
   this.db.prepare('INSERT INTO living_booking_requests VALUES(?,?,?,?,?)').run(nodeId,ctx.actorId,requestKey,hash,JSON.stringify(result));return result;
  });
 }
 async history(proof,nodeId){await this.access(proof,nodeId,'booking.manage',{nodeId,op:'history'});return this.db.prepare('SELECT body FROM living_booking_events WHERE node_id=? ORDER BY sequence').all(nodeId).map(row=>JSON.parse(row.body));}
 async exportData(proof,nodeId){
  await this.access(proof,nodeId,'booking.manage',{nodeId,op:'export'});
  return this.transaction(()=>({schema:'utopy.node.booking-export/1',nodeId,exportedAt:new Date(this.now()).toISOString(),doesNotTransferAuthority:true,configuration:this.config(nodeId),bookings:this.db.prepare('SELECT body FROM living_bookings WHERE node_id=? ORDER BY start').all(nodeId).map(row=>JSON.parse(row.body)),events:this.db.prepare('SELECT body FROM living_booking_events WHERE node_id=? ORDER BY sequence').all(nodeId).map(row=>JSON.parse(row.body)),idempotency:this.db.prepare('SELECT actor_id,request_key,hash,result FROM living_booking_requests WHERE node_id=?').all(nodeId)}));
 }
 close(){this.db.close();}
}
