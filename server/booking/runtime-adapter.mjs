import {verifyEnvelopeSignature,createEnvelope} from 'utopy';
import {check} from '../../src/booking/contracts.mjs';
import {isDeepStrictEqual} from 'node:util';
/** Host uses its existing, CURRENT authority registry and mandate verifier. No TOFU. */
export function runtimeBookingAuthorizer({runtime,authorizeNode}){
 return async({proof,nodeId,action,request,now})=>{
  check(runtime&&proof?.kind==='booking.request'&&proof.authority===proof.sourceActorId&&proof.targetNodeId===nodeId&&proof.payload?.nodeId===nodeId,'FORBIDDEN');
  check(request&&isDeepStrictEqual(proof.payload,request),'PROOF_REQUEST_MISMATCH');
  const start=Date.parse(proof.createdAt),end=Date.parse(proof.expiresAt);
  check(Number.isFinite(start)&&Number.isFinite(end)&&start<=now+5000&&end>now&&end-start>0&&end-start<=120000,'FORBIDDEN');
  const verified=await verifyEnvelopeSignature(proof,(authority,key,jwk)=>runtime.authorities.accepts(authority,key,jwk,now));check(verified,'FORBIDDEN');
  if(action!=='booking.self')check(typeof authorizeNode==='function'&&await authorizeNode({actorId:proof.sourceActorId,nodeId,action,proof,now})===true,'FORBIDDEN');
  return {verified:true,actorId:proof.sourceActorId,nodeId,allowedActions:[action]};
 };
}
/** Existing Runtime/bus is the publisher; SQL holds the transactional node facts.
 * Stable event IDs make retries safe. Host persists the returned cursor only on success. */
export async function publishBookingEvents(store,runtime,nodeId,after=0){
 check(runtime.identity.nodeId===nodeId,'WRONG_NODE_RUNTIME');let cursor=after;
 for(const row of store.db.prepare('SELECT sequence,body FROM living_booking_events WHERE node_id=? AND sequence>? ORDER BY sequence').all(nodeId,after)){
  const dv=JSON.parse(row.body);const e=await createEnvelope({id:dv.id,revision:dv.meta.version,kind:dv.kind,sourceActorId:runtime.identity.actorId,sourceNodeId:nodeId,authority:nodeId,scopes:dv.meta.scopes,...(dv.meta.scopes.includes('public')?{}:{participants:dv.attrs.participants||[nodeId]}),createdAt:dv.meta.ts,payload:dv.attrs});
  await runtime.publish(e);cursor=row.sequence;
 }return cursor;
}
