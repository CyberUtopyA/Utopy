import {verifyEnvelopeSignature} from 'utopy';
import {verifyNodeManifestDV} from '../mt/utopy.nodeManifest';
export const REMOTE_ADMIN_ACTIONS=['node.workspace.read','booking.manage','booking.configure'];
const key=(jwk:any)=>JSON.stringify([jwk?.kty,jwk?.crv,jwk?.x,jwk?.y]);
/** The node's controller explicitly pins the issuing Runtime key in its signed manifest. */
export async function verifyAdminReceipt(manifest:any,grant:any,actorId:string,allLive:any[]=[],now=Date.now()){
 const verified=await verifyNodeManifestDV(manifest,allLive);if(!verified.accepted||verified.proof!=='verified')return null;
 const nodeId=manifest.attrs?.nodeId,a=grant?.payload,anchor=manifest.attrs?.administration;
 const manifestExpires=manifest.meta?.ttl_ms?Date.parse(manifest.meta.updatedAt||manifest.meta.ts)+Number(manifest.meta.ttl_ms):Infinity;
 if((!Number.isFinite(manifestExpires)&&manifestExpires!==Infinity)||manifestExpires<=now||['revoked','inactive','disabled'].includes(manifest.attrs.status))return null;
 if(!anchor||JSON.stringify(anchor.allowedActions)!==JSON.stringify(REMOTE_ADMIN_ACTIONS)||grant?.kind!=='node.authorization'||grant.authority!==nodeId||grant.sourceNodeId!==nodeId||a?.nodeId!==nodeId||a.actorId!==actorId||a.status!=='active'||a.consent?.actor!==true||a.consent?.node!==true||JSON.stringify(a.allowedActions)!==JSON.stringify(REMOTE_ADMIN_ACTIONS))return null;
 if(grant.id!==a.authorizationId||grant.id!==`node.authorization:${a.invitationId}`||grant.scopes?.length!==1||grant.scopes[0]!=='participants'||!grant.participants?.includes(actorId))return null;
 const start=Date.parse(grant.createdAt),end=Date.parse(grant.expiresAt),until=Date.parse(a.validUntil);
 if(!(start<=now+5000&&end>now&&end>start&&end-start<=300000&&until>=end))return null;
 const valid=await verifyEnvelopeSignature(grant,(authority:string,keyId:string,jwk:any)=>authority===nodeId&&keyId===anchor.keyId&&key(jwk)===key(anchor.publicKeyJwk));
 return valid?{id:grant.id,verified:true,actorId,nodeId,status:'active' as const,roles:['manager'],allowedActions:REMOTE_ADMIN_ACTIONS,capabilities:['living-booking'],scopes:['participants'],validFrom:grant.createdAt,validUntil:grant.expiresAt,legacy:false,dv:grant}:null;
}
