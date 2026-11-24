import {randomBytes,createCipheriv,createDecipheriv,createHash,randomUUID} from 'node:crypto';
import {COMMUNICATION_SCHEMA,COMMUNICATION_CHANNELS,communicationChannel} from '../../src/communication/contracts.mjs';
const check=(value,code)=>{if(!value)throw Error(code);};
/** Optional capability on the existing node host/database. No separate identity,
 * message inbox or daemon. Host injects its real credentials and consent verifier. */
export class NodeCommunication{
 constructor(store,host){
  this.store=store;this.db=store.db;this.host=host;this.now=host.now||Date.now;this.locks=new Map();
  check(Buffer.isBuffer(host.encryptionKey)&&host.encryptionKey.length===32,'COMMUNICATION_ENCRYPTION_KEY_REQUIRED');
  this.db.exec(`CREATE TABLE IF NOT EXISTS communication_connections(node_id TEXT,channel TEXT,revision INTEGER,status TEXT,account TEXT,secret TEXT,PRIMARY KEY(node_id,channel));
   CREATE TABLE IF NOT EXISTS communication_accounts(channel TEXT,external_id TEXT,node_id TEXT,PRIMARY KEY(channel,external_id));
   CREATE TABLE IF NOT EXISTS communication_audit(id TEXT PRIMARY KEY,node_id TEXT,channel TEXT,action TEXT,at INTEGER);
   CREATE TABLE IF NOT EXISTS communication_events(node_id TEXT,channel TEXT,event_id TEXT,body TEXT,state TEXT,PRIMARY KEY(node_id,channel,event_id));
   CREATE TABLE IF NOT EXISTS communication_consents(node_id TEXT,channel TEXT,recipient TEXT,active INTEGER,source_ref TEXT,PRIMARY KEY(node_id,channel,recipient));
   CREATE TABLE IF NOT EXISTS communication_outbox(node_id TEXT,request_key TEXT,channel TEXT,digest TEXT,body TEXT,state TEXT,external_id TEXT,next_at INTEGER,PRIMARY KEY(node_id,request_key));`);
 }
 seal(node,channel,value){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.host.encryptionKey,nonce);cipher.setAAD(Buffer.from(`${COMMUNICATION_SCHEMA}|${node}|${channel}`));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({nonce:nonce.toString('base64'),data:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64')});}
 open(node,channel,value){const row=JSON.parse(value),cipher=createDecipheriv('aes-256-gcm',this.host.encryptionKey,Buffer.from(row.nonce,'base64'));cipher.setAAD(Buffer.from(`${COMMUNICATION_SCHEMA}|${node}|${channel}`));cipher.setAuthTag(Buffer.from(row.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(row.data,'base64')),cipher.final()]).toString('utf8'));}
 row(node,channel){return this.db.prepare('SELECT * FROM communication_connections WHERE node_id=? AND channel=?').get(node,channel);}
 audit(node,channel,action){this.db.prepare('INSERT INTO communication_audit VALUES(?,?,?,?,?)').run(randomUUID(),node,channel,action,this.now());}
 snapshot(node){return {schema:COMMUNICATION_SCHEMA,nodeId:node,automationReady:false,channels:COMMUNICATION_CHANNELS.filter(c=>!['phone','internal'].includes(c.id)).map(c=>{const row=this.row(node,c.id),adapter=this.host.adapters?.[c.id];return {channel:c.id,supported:!!adapter,status:row?.status||'not_configured',revision:row?.revision||0,account:row?JSON.parse(row.account):null,capabilities:adapter?.capabilities||{}};})};}
 async handle(proof,node,op,input){const key=`${node}:${input.channel||''}`,prior=this.locks.get(key)||Promise.resolve();const task=prior.catch(()=>{}).then(()=>this.handleLocked(proof,node,op,input));this.locks.set(key,task);try{return await task;}finally{if(this.locks.get(key)===task)this.locks.delete(key);}}
 async handleLocked(proof,node,op,input){
  await this.store.access(proof,node,op==='communication.send'?'communication.send':'communication.manage',{nodeId:node,op,...input});
  check(!Object.keys(input).some(k=>/token|password|secret|credential/i.test(k)),'SERVER_CREDENTIALS_ONLY');
  if(op==='communication.status')return this.snapshot(node);
  communicationChannel(input.channel);const channel=input.channel,adapter=this.host.adapters?.[channel];check(adapter,'CHANNEL_NOT_INSTALLED');
  if(op==='communication.send')return this.enqueue(node,input);
  check(['communication.connect','communication.verify','communication.disconnect'].includes(op),'INVALID_ACTION');
  const prior=this.row(node,channel);check(Number.isInteger(input.expectedRevision)&&input.expectedRevision===(prior?.revision||0),'VERSION_CONFLICT');
  check(this.db.prepare('SELECT count(*) n FROM communication_audit WHERE node_id=? AND channel=? AND at>?').get(node,channel,this.now()-60000).n<12,'COMMUNICATION_RATE_LIMIT');this.audit(node,channel,op);
  if(op==='communication.connect'){
   check(typeof this.host.credentialsFor==='function','SERVER_CREDENTIALS_REQUIRED');const credentials=await this.host.credentialsFor(node,channel);check(credentials,'SERVER_CREDENTIALS_REQUIRED');
   // Verify provider ownership before changing any remote webhook. One external
   // account cannot be silently attached to a different commercial node.
   const account=await adapter.health(credentials);check(typeof account.id==='string'&&account.id,'INVALID_PROVIDER_IDENTITY');
   this.store.transaction(()=>{const current=this.row(node,channel);check((current?.revision||0)===(prior?.revision||0),'VERSION_CONFLICT');const owner=this.db.prepare('SELECT node_id FROM communication_accounts WHERE channel=? AND external_id=?').get(channel,account.id);check(!owner||owner.node_id===node,'CHANNEL_OWNED_BY_ANOTHER_NODE');this.db.prepare('INSERT OR IGNORE INTO communication_accounts VALUES(?,?,?)').run(channel,account.id,node);});
   const secret={...credentials,webhookSecret:randomBytes(32).toString('hex')};
   await adapter.connect(secret,this.host.webhookUrl?.(node,channel));
   this.store.transaction(()=>{check((this.row(node,channel)?.revision||0)===(prior?.revision||0),'VERSION_CONFLICT');this.db.prepare('INSERT INTO communication_connections VALUES(?,?,?,?,?,?) ON CONFLICT(node_id,channel) DO UPDATE SET revision=excluded.revision,status=excluded.status,account=excluded.account,secret=excluded.secret').run(node,channel,(prior?.revision||0)+1,'connected',JSON.stringify(account),this.seal(node,channel,secret));});
  }else{
   check(prior?.secret,'CHANNEL_NOT_CONNECTED');const secret=this.open(node,channel,prior.secret);
   if(op==='communication.disconnect'){await adapter.disconnect(secret);this.db.prepare('UPDATE communication_connections SET status=?,secret=NULL,revision=revision+1 WHERE node_id=? AND channel=? AND revision=?').run('disconnected',node,channel,prior.revision);this.db.prepare("UPDATE communication_outbox SET state='cancelled' WHERE node_id=? AND channel=? AND state='pending'").run(node,channel);}
   else{try{const account=await adapter.health(secret);this.db.prepare('UPDATE communication_connections SET account=?,status=?,revision=revision+1 WHERE node_id=? AND channel=? AND revision=?').run(JSON.stringify(account),'connected',node,channel,prior.revision);}catch{this.db.prepare('UPDATE communication_connections SET status=?,revision=revision+1 WHERE node_id=? AND channel=? AND revision=?').run('attention',node,channel,prior.revision);throw Error('CHANNEL_REQUIRES_ATTENTION');}}
  }return this.snapshot(node);
 }
 async receive(node,channel,headers,body){
  const connection=this.row(node,channel);check(connection?.status==='connected'&&connection.secret,'CHANNEL_NOT_CONNECTED');const adapter=this.host.adapters[channel],event=adapter.verifyWebhook(this.open(node,channel,connection.secret),headers,body);if(!event)return {accepted:true,ignored:true};
  const inserted=this.db.prepare('INSERT OR IGNORE INTO communication_events VALUES(?,?,?,?,?)').run(node,channel,event.externalEventId,this.seal(node,channel,event),'awaiting_link');if(!inserted.changes)return {accepted:true,duplicate:true};
  if(/^\/stop(?:@\w+)?(?:\s|$)/i.test(event.text.trim()))this.db.prepare('UPDATE communication_consents SET active=0 WHERE node_id=? AND channel=? AND recipient=?').run(node,channel,event.externalConversationId);
  // A provider chat ID is not a UTOPY person. Only the host's verified linking
  // bridge may project into an existing authorized conversation.
  if(typeof this.host.projectInbound==='function'){try{const projection=await this.host.projectInbound({nodeId:node,event,requestKey:`${node}:${channel}:${event.externalEventId}`});if(projection?.verified===true&&projection.threadId)this.db.prepare("UPDATE communication_events SET state='projected' WHERE node_id=? AND channel=? AND event_id=?").run(node,channel,event.externalEventId);}catch{/* durable awaiting_link, never fake successful projection */}}
  this.audit(node,channel,'inbound.accepted');return {accepted:true};
 }
 async recordConsent(node,channel,recipient,evidence){check(typeof this.host.verifyConsent==='function'&&await this.host.verifyConsent({nodeId:node,channel,recipient,evidence})===true,'CONSENT_NOT_VERIFIED');check(typeof evidence?.id==='string'&&evidence.id,'CONSENT_NOT_VERIFIED');this.db.prepare('INSERT INTO communication_consents VALUES(?,?,?,?,?) ON CONFLICT(node_id,channel,recipient) DO UPDATE SET active=excluded.active,source_ref=excluded.source_ref').run(node,channel,recipient,evidence.accepted===true?1:0,evidence.id);}
 async projectPending(limit=25){
  if(typeof this.host.projectInbound!=='function')return 0;
  const rows=this.db.prepare("SELECT * FROM communication_events WHERE state='awaiting_link' LIMIT ?").all(Math.max(1,Math.min(100,limit)));let projected=0;
  for(const row of rows){try{const event=this.open(row.node_id,row.channel,row.body);const result=await this.host.projectInbound({nodeId:row.node_id,event,requestKey:`${row.node_id}:${row.channel}:${row.event_id}`});if(result?.verified===true&&result.threadId){this.db.prepare("UPDATE communication_events SET state='projected' WHERE node_id=? AND channel=? AND event_id=?").run(row.node_id,row.channel,row.event_id);projected++;}}catch{/* Preserve encrypted event for a verified, idempotent host retry. */}}
  return projected;
 }
 async enqueue(node,input){
  const {channel,recipient,text,requestKey,operation}=input;check(typeof requestKey==='string'&&requestKey.length>0&&requestKey.length<=160&&typeof recipient==='string'&&recipient.length<=160&&typeof text==='string'&&text.length>0&&text.length<=4096,'INVALID_MESSAGE');
  check(typeof this.host.verifyOperation==='function'&&await this.host.verifyOperation({nodeId:node,channel,recipient,text,operation})===true,'OPERATION_NOT_VERIFIED');
  check(this.row(node,channel)?.status==='connected','CHANNEL_NOT_CONNECTED');check(this.db.prepare('SELECT active FROM communication_consents WHERE node_id=? AND channel=? AND recipient=?').get(node,channel,recipient)?.active===1,'CONSENT_REQUIRED');
  const digest=createHash('sha256').update(JSON.stringify({channel,recipient,text,operation})).digest('hex'),prior=this.db.prepare('SELECT digest,state FROM communication_outbox WHERE node_id=? AND request_key=?').get(node,requestKey);if(prior){check(prior.digest===digest,'IDEMPOTENCY_CONFLICT');return {state:prior.state,duplicate:true};}
  check(this.db.prepare("SELECT count(*) n FROM communication_outbox WHERE node_id=? AND state='pending'").get(node).n<1000,'QUEUE_LIMIT');this.db.prepare('INSERT INTO communication_outbox VALUES(?,?,?,?,?,?,?,?)').run(node,requestKey,channel,digest,this.seal(node,channel,{recipient,text,operation}),'pending',null,this.now());return {state:'pending'};
 }
 async processOne(){
  const job=this.store.transaction(()=>{const row=this.db.prepare("SELECT * FROM communication_outbox WHERE state='pending' AND next_at<=? ORDER BY next_at LIMIT 1").get(this.now());if(row)this.db.prepare("UPDATE communication_outbox SET state='sending' WHERE node_id=? AND request_key=?").run(row.node_id,row.request_key);return row;});if(!job)return false;
  const update=(state,id=null,next=this.now())=>this.db.prepare('UPDATE communication_outbox SET state=?,external_id=?,next_at=? WHERE node_id=? AND request_key=?').run(state,id,next,job.node_id,job.request_key);
  const connection=this.row(job.node_id,job.channel),message=this.open(job.node_id,job.channel,job.body);
  if(connection?.status!=='connected'||this.db.prepare('SELECT active FROM communication_consents WHERE node_id=? AND channel=? AND recipient=?').get(job.node_id,job.channel,message.recipient)?.active!==1){update('cancelled');return true;}
  if(typeof this.host.verifyOperation!=='function'||await this.host.verifyOperation({nodeId:job.node_id,channel:job.channel,...message})!==true){update('cancelled');return true;}
  try{const result=await this.host.adapters[job.channel].send(this.open(job.node_id,job.channel,connection.secret),message);update('accepted_by_provider',result.externalMessageId);}catch(error){if(error.message==='PROVIDER_RATE_LIMIT')update('pending',null,this.now()+(error.retryAfter||60)*1000);else update('attention');}
  // Unknown provider results and process crashes are NOT automatically retried:
  // Telegram has no caller idempotency key. Reconcile before risking duplicate sends.
  return true;
 }
}
