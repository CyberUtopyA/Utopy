import {readFile,realpath} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createUtopyRuntime,importIdentity,NullEnvelopeStore,NullPendingQueue,createEnvelope,signEnvelope,verifyEnvelopeSignature} from 'utopy';
import {verifyRuntimeWalletEvidence} from 'utopy/identity/server';
import {check} from '../../src/booking/contracts.mjs';
export async function privatePath(path){check(typeof path==='string'&&isAbsolute(path),'PRIVATE_ABSOLUTE_PATH_REQUIRED');const declared=resolve(path),actual=await realpath(declared);check(![declared,actual].some(value=>value.split(/[\\/]/).some(p=>['public_html','public','dist','htdocs','www'].includes(p.toLowerCase()))),'PRIVATE_PATH_REQUIRED');return actual;}
/** Explicit file provisioning for a node without a pre-existing host module.
 * These are local operator-installed files, never a public bootstrap endpoint. */
export async function createNodeBookingHost({identityFile,manifestFile}){
 const raw=JSON.parse(await readFile(await privatePath(identityFile),'utf8'));
 check(raw.publicKeyJwk&&!raw.publicKeyJwk.d&&raw.privateKeyJwk,'INVALID_SERVER_KEY');
 const identity=await importIdentity(raw);
 const runtime=await createUtopyRuntime({identity,transports:[],store:new NullEnvelopeStore(),pending:new NullPendingQueue(),persistIncoming:false,persistOutgoing:false,autoAnswerPublicCapabilities:false});
 const keyCheck=await signEnvelope(await createEnvelope({kind:'node.key.check',sourceActorId:identity.actorId,sourceNodeId:identity.nodeId,authority:identity.nodeId,scopes:['private'],payload:{purpose:'private-host-key-validation'}}),identity);
 check(await verifyEnvelopeSignature(keyCheck,(authority,keyId,jwk)=>runtime.authorities.accepts(authority,keyId,jwk)),'SERVER_KEY_PAIR_MISMATCH');
 let ownerDid=null,lastVersion=0,lastKey=null,lastFingerprint=null;
 const getManifest=async nodeId=>{
  const manifest=JSON.parse(await readFile(await privatePath(manifestFile),'utf8')),m=manifest.meta;
  const evidence=verifyRuntimeWalletEvidence({id:manifest.id,kind:manifest.kind,authority:m?.ownership?.ownerDid,sourceActorId:m?.ownership?.controllerActorId,createdAt:m?.ts,expiresAt:m?.expiresAt||(m?.ttl_ms?new Date(Date.parse(m.ts)+Number(m.ttl_ms)).toISOString():undefined),payload:{schema:'mo.dv/1',dv:manifest}});
  const derived=`actor:utopy:${createHash('sha256').update(`${evidence.did}|utopy.actor|personal`).digest('hex').slice(0,24)}`;
  check(manifest.kind==='utopy.node.manifest'&&manifest.attrs.nodeId===identity.nodeId&&m.authority===nodeId&&nodeId===identity.nodeId&&evidence.actorId===derived&&m.scopes?.length===1&&m.scopes[0]==='public','INVALID_NODE_MANIFEST');
  const fingerprint=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  check((!ownerDid||evidence.did===ownerDid)&&Number(m.version)>=lastVersion&&(!lastFingerprint||Number(m.version)>lastVersion||lastFingerprint===fingerprint),'MANIFEST_ROLLBACK_OR_CONTROLLER_CHANGE');
  const until=m.ttl_ms?Date.parse(m.updatedAt||m.ts)+Number(m.ttl_ms):Infinity;
  check(until>Date.now()&&!['revoked','disabled','inactive'].includes(manifest.attrs.status),'NODE_INACTIVE');
  ownerDid=evidence.did;lastVersion=Number(m.version);lastFingerprint=fingerprint;
  if(lastKey&&lastKey!==evidence.owner.keyId)runtime.authorities.revoke(derived,lastKey);
  for(const revoked of evidence.owner.revocations){if(revoked.deviceId===evidence.owner.deviceId)throw Error('REVOKED_CONTROLLER_DEVICE');}
  runtime.authorities.trust(derived,evidence.owner.keyId,evidence.owner.publicKeyJwk);lastKey=evidence.owner.keyId;
  return manifest;
 };
 await getManifest(identity.nodeId);
 const authorizeNode=async({actorId,nodeId,action,proof})=>{
  if(nodeId!==identity.nodeId||!['node.authorization','booking.manage','booking.configure'].includes(action))return false;
  const manifest=await getManifest(nodeId),owner=manifest.meta.ownership;
  return actorId===owner.controllerActorId&&(!proof||proof.ownership?.keyId===owner.keyId);
 };
 return {runtime,getManifest,authorizeNode};
}
