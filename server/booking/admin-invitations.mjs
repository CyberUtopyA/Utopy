import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createEnvelope,signEnvelope,verifyEnvelopeSignature} from 'utopy';
import {verifyRuntimeWalletEvidence} from 'utopy/identity/server';
import {isDeepStrictEqual} from 'node:util';
import {check} from '../../src/booking/contracts.mjs';
export const NODE_ADMIN_ACTIONS=['node.workspace.read','booking.manage','booking.configure'];
const hash=text=>createHash('sha256').update(text).digest('hex');
const key=jwk=>JSON.stringify([jwk?.kty,jwk?.crv,jwk?.x,jwk?.y]);
const wallet=dv=>verifyRuntimeWalletEvidence({id:dv?.id,kind:dv?.kind,authority:dv?.meta?.ownership?.ownerDid,sourceActorId:dv?.meta?.ownership?.controllerActorId,createdAt:dv?.meta?.ts,expiresAt:dv?.meta?.expiresAt||(dv?.meta?.ttl_ms?new Date(Date.parse(dv.meta.ts)+Number(dv.meta.ttl_ms)).toISOString():undefined),payload:{schema:'mo.dv/1',dv}});
/** Transactional invitation state in the SAME node database. Keys and manifests belong
 * to the host Runtime; browser invitations never bootstrap trust or transfer ownership. */
export class NodeAdminInvitations{
 constructor(store,{runtime,authorizeNode,getManifest}={}){
  check(runtime?.identity&&!runtime.identity.publicKeyJwk?.d&&typeof authorizeNode==='function'&&typeof getManifest==='function','ADMIN_HOST_NOT_CONFIGURED');
  this.store=store;this.runtime=runtime;this.authorizeNode=authorizeNode;this.getManifest=getManifest;
  store.db.exec(`CREATE TABLE IF NOT EXISTS node_admin_invitations(id TEXT PRIMARY KEY,node_id TEXT NOT NULL,issuer TEXT NOT NULL,issuer_key TEXT,request_id TEXT NOT NULL UNIQUE,token_hash TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,valid_until INTEGER NOT NULL,status TEXT NOT NULL,actor_id TEXT,device_key TEXT,device_jwk TEXT,receipt TEXT);
   CREATE INDEX IF NOT EXISTS node_admin_invitation_actor ON node_admin_invitations(node_id,actor_id);`);
  if(!store.db.prepare('PRAGMA table_info(node_admin_invitations)').all().some(c=>c.name==='issuer_key'))store.db.exec('ALTER TABLE node_admin_invitations ADD COLUMN issuer_key TEXT');
 }
 async manifest(nodeId){
  const manifest=await this.getManifest(nodeId),identity=this.runtime.identity;
  check(manifest?.attrs?.nodeId===nodeId&&manifest.kind==='utopy.node.manifest'&&manifest.meta?.authority===nodeId&&manifest.meta?.scopes?.includes('public')&&!manifest.meta.scopes.some(s=>s!=='public'),'ADMIN_NODE_NOT_CONFIGURED');
  const evidence=wallet(manifest);check(evidence.owner.custody==='device'&&evidence.owner.recovery==='encrypted'&&!['revoked','inactive','disabled'].includes(manifest.attrs.status),'FORBIDDEN');
  if(manifest.meta.ttl_ms)check(Date.parse(manifest.meta.updatedAt||manifest.meta.ts)+Number(manifest.meta.ttl_ms)>this.store.now(),'ADMIN_NODE_NOT_CONFIGURED');
  check(identity.nodeId===nodeId&&manifest.attrs.administration?.keyId===identity.keyId&&key(manifest.attrs.administration.publicKeyJwk)===key(identity.publicKeyJwk)&&isDeepStrictEqual(manifest.attrs.administration.allowedActions,NODE_ADMIN_ACTIONS),'ADMIN_KEY_NOT_AUTHORIZED');
  return {manifest,controller:evidence.actorId};
 }
 async info(nodeId){check(this.runtime.identity.nodeId===nodeId,'ADMIN_NODE_NOT_CONFIGURED');return {available:true,nodeId,keyId:this.runtime.identity.keyId,publicKeyJwk:this.runtime.identity.publicKeyJwk};}
 async issue(proof,nodeId,{expiresAt,validUntil,consent}){
  check(consent===true,'CONSENT_REQUIRED');const request={nodeId,op:'admin.invite',expiresAt,validUntil,consent};
  const ctx=await this.store.access(proof,nodeId,'node.authorization',request);const {controller}=await this.manifest(nodeId);
  check(ctx.actorId===controller,'FORBIDDEN');const now=this.store.now(),expires=Date.parse(expiresAt),until=Date.parse(validUntil);
  check(expires>now&&expires<=now+7*86400000&&until>expires&&until<=now+366*86400000,'INVALID_EXPIRY');
  const token=randomBytes(32).toString('base64url'),id=`node-admin:${randomUUID()}`;
  this.store.transaction(()=>{check(!this.store.db.prepare('SELECT id FROM node_admin_invitations WHERE request_id=?').get(proof.id),'REQUEST_ALREADY_USED');this.store.db.prepare('INSERT INTO node_admin_invitations(id,node_id,issuer,issuer_key,request_id,token_hash,expires,valid_until,status) VALUES(?,?,?,?,?,?,?,?,?)').run(id,nodeId,ctx.actorId,proof.ownership.keyId,proof.id,hash(token),expires,until,'pending');this.store.event(nodeId,'node.admin.invitation.created',ctx.actorId,{invitationId:id,expiresAt,validUntil,authorization:proof});});
  return {id,token,expiresAt,validUntil};
 }
 row(nodeId,id,token){check(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token),'INVITATION_UNAVAILABLE');const row=this.store.db.prepare('SELECT * FROM node_admin_invitations WHERE id=? AND node_id=? AND token_hash=?').get(id,nodeId,hash(token));check(row&&row.status!=='revoked'&&row.expires>this.store.now()&&row.valid_until>this.store.now(),'INVITATION_UNAVAILABLE');return row;}
 async liveIssuer(row){check(await this.authorizeNode({actorId:row.issuer,nodeId:row.node_id,action:'node.authorization',now:this.store.now()})===true,'FORBIDDEN');const {controller}=await this.manifest(row.node_id);check(controller===row.issuer&&row.issuer_key&&this.runtime.authorities.accepts(row.issuer,row.issuer_key,undefined,this.store.now()),'FORBIDDEN');}
 async preview(nodeId,{invitationId,token}){const row=this.row(nodeId,invitationId,token);await this.liveIssuer(row);const {manifest}=await this.manifest(nodeId);return {manifest,allowedActions:NODE_ADMIN_ACTIONS,validUntil:new Date(row.valid_until).toISOString(),claimed:row.status==='accepted'};}
 async accept(nodeId,{invitationId,token,consent},proof){
  check(consent===true,'CONSENT_REQUIRED');const row=this.row(nodeId,invitationId,token);await this.liveIssuer(row);
  check(JSON.stringify(proof||{}).length<=262144&&proof?.meta?.ownership?.rootHistory?.length<=32&&proof?.meta?.ownership?.revocations?.length<=1000,'FORBIDDEN');
  let verified;try{verified=wallet(proof);}catch{throw Error('FORBIDDEN');}
  const actorId=`actor:utopy:${hash(`${verified.did}|utopy.actor|personal`).slice(0,24)}`;
  check(verified.actorId===actorId&&verified.owner.custody==='device'&&verified.owner.recovery==='encrypted','FORBIDDEN');
  const expected={nodeId,op:'admin.accept',invitationId,tokenHash:hash(token),consent:true,actorId};
  check(proof.kind==='node.admin.acceptance'&&isDeepStrictEqual(proof.attrs,expected),'PROOF_REQUEST_MISMATCH');
  const start=Date.parse(proof.meta.ts),end=Date.parse(proof.meta.expiresAt),now=this.store.now();check(start<=now+5000&&end>now&&end>start&&end-start<=120000&&proof.meta.scopes?.length===1&&proof.meta.scopes[0]==='private','FORBIDDEN');
  const device=verified.owner;
  check(!(this.runtime.authorities.records(actorId)||[]).some(record=>record.keyId===device.keyId&&record.status==='revoked'),'FORBIDDEN');
  if(row.status==='accepted'){check(row.actor_id===actorId&&row.device_key===device.keyId&&key(JSON.parse(row.device_jwk))===key(device.publicKeyJwk),'INVITATION_UNAVAILABLE');return this.renew(row);}
  const grant=await signEnvelope(await createEnvelope({id:`node.authorization:${row.id}`,kind:'node.authorization',revision:now,sourceActorId:this.runtime.identity.actorId,sourceNodeId:nodeId,authority:nodeId,scopes:['participants'],participants:[actorId,nodeId],expiresAt:new Date(Math.min(row.valid_until,now+300000)).toISOString(),payload:{authorizationId:`node.authorization:${row.id}`,actorId,nodeId,status:'active',roles:['manager'],allowedActions:NODE_ADMIN_ACTIONS,validUntil:new Date(row.valid_until).toISOString(),invitationId:row.id,consent:{node:true,actor:true},ownerDid:verified.did,deviceKeyId:device.keyId}}),this.runtime.identity);
  const {manifest}=await this.manifest(nodeId);
  await this.liveIssuer(row);
  return this.store.transaction(()=>{const fresh=this.row(nodeId,invitationId,token);check(fresh.status==='pending','INVITATION_UNAVAILABLE');this.store.db.prepare("UPDATE node_admin_invitations SET status='accepted',actor_id=?,device_key=?,device_jwk=?,receipt=? WHERE id=? AND status='pending'").run(actorId,device.keyId,JSON.stringify(device.publicKeyJwk),JSON.stringify(grant),row.id);this.store.event(nodeId,'node.admin.invitation.accepted',actorId,{invitationId:row.id,authorizationId:grant.id,acceptance:proof,authorization:grant,participants:[actorId,nodeId]});return {manifest,grant};});
 }
 async cancel(proof,nodeId,{invitationId,consent}){check(consent===true,'CONSENT_REQUIRED');const ctx=await this.store.access(proof,nodeId,'node.authorization',{nodeId,op:'admin.cancel',invitationId,consent});const {controller}=await this.manifest(nodeId);check(ctx.actorId===controller,'FORBIDDEN');return this.store.transaction(()=>{const row=this.store.db.prepare('SELECT id FROM node_admin_invitations WHERE id=? AND node_id=?').get(invitationId,nodeId);check(row,'INVITATION_UNAVAILABLE');this.store.db.prepare("UPDATE node_admin_invitations SET status='revoked' WHERE id=?").run(invitationId);this.store.event(nodeId,'node.authorization.revoked',ctx.actorId,{invitationId,authorizationId:`node.authorization:${invitationId}`});return {revoked:true};});}
 async list(proof,nodeId){const ctx=await this.store.access(proof,nodeId,'node.authorization',{nodeId,op:'admin.list'});check(ctx.actorId===(await this.manifest(nodeId)).controller,'FORBIDDEN');return this.store.db.prepare('SELECT id,status,expires,valid_until,actor_id FROM node_admin_invitations WHERE node_id=? ORDER BY rowid DESC LIMIT 100').all(nodeId);}
 async renew(row){const prior=JSON.parse(row.receipt),now=this.store.now(),nodeId=row.node_id;const grant=await signEnvelope(await createEnvelope({id:prior.id,kind:prior.kind,revision:now,sourceActorId:prior.sourceActorId,sourceNodeId:nodeId,authority:nodeId,scopes:['participants'],participants:prior.participants,expiresAt:new Date(Math.min(row.valid_until,now+300000)).toISOString(),payload:prior.payload}),this.runtime.identity);return {manifest:(await this.manifest(nodeId)).manifest,grant};}
 async session(proof,nodeId){await this.authorizeRequest({proof,nodeId,action:'booking.manage',request:{nodeId,op:'admin.session'},now:this.store.now()});const row=this.store.db.prepare("SELECT * FROM node_admin_invitations WHERE node_id=? AND actor_id=? AND device_key=? AND status='accepted' AND valid_until>? ORDER BY valid_until DESC LIMIT 1").get(nodeId,proof.sourceActorId,proof.ownership.keyId,this.store.now());check(row,'FORBIDDEN');return this.renew(row);}
 /** Only accepted, unexpired, non-revoked grants authorize their pinned device key.
  * Current host policy is still checked: no privilege expansion or trust-on-first-use. */
 async authorizeRequest({proof,nodeId,action,request,now}){
  check(NODE_ADMIN_ACTIONS.includes(action)&&isDeepStrictEqual(proof?.payload,request)&&proof.kind==='booking.request'&&proof.authority===proof.sourceActorId&&proof.targetNodeId===nodeId,'FORBIDDEN');
  const start=Date.parse(proof.createdAt),end=Date.parse(proof.expiresAt);check(start<=now+5000&&end>now&&end>start&&end-start<=120000,'FORBIDDEN');
  const rows=this.store.db.prepare("SELECT * FROM node_admin_invitations WHERE node_id=? AND actor_id=? AND status='accepted' AND valid_until>?").all(nodeId,proof.sourceActorId,now);
  const known=this.runtime.authorities?.records?.(proof.sourceActorId)||[];
  check(!known.some(record=>record.keyId===proof.ownership?.keyId&&record.status==='revoked'),'FORBIDDEN');
  for(const row of rows){await this.liveIssuer(row);const ok=await verifyEnvelopeSignature(proof,(authority,keyId,jwk)=>authority===row.actor_id&&keyId===row.device_key&&key(jwk)===key(JSON.parse(row.device_jwk)));if(ok){const current=this.store.db.prepare("SELECT id FROM node_admin_invitations WHERE id=? AND status='accepted' AND valid_until>?").get(row.id,this.store.now());check(current,'FORBIDDEN');check(!(this.runtime.authorities.records(row.actor_id)||[]).some(record=>record.keyId===proof.ownership?.keyId&&record.status==='revoked'),'FORBIDDEN');return {verified:true,actorId:row.actor_id,nodeId,allowedActions:[action]};}}
  throw Error('FORBIDDEN');
 }
}
