import {createHash} from 'node:crypto';
import {check,safeImage} from '../../src/booking/contracts.mjs';
/** Delegates storage to the node's existing media provider; no new file store. */
export async function uploadBookingPhoto(store,uploadMedia,proof,nodeId,input){
 const actor=await store.access(proof,nodeId,'booking.configure',{nodeId,op:'media.upload',...input});
 check(input.publicationConsent===true,'PHOTO_CONSENT_REQUIRED');
 check(typeof uploadMedia==='function','MEDIA_NOT_CONFIGURED');
 check(typeof input.dataUrl==='string'&&input.dataUrl.length<=1050000,'IMAGE_TOO_LARGE');
 const match=/^data:image\/(jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.dataUrl);check(match&&input.mime===`image/${match[1]}`,'INVALID_IMAGE');
 const bytes=Buffer.from(match[2],'base64');check(bytes.length>12&&bytes.length<=768*1024&&bytes.toString('base64')===match[2],'INVALID_IMAGE');
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
 const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length;
 check(match[1]==='jpeg'?jpeg:webp,'INVALID_IMAGE');
 const idempotencyKey=createHash('sha256').update(nodeId).update(bytes).digest('hex');
 const result=await uploadMedia({nodeId,actorId:actor.actorId,bytes,dataUrl:input.dataUrl,mime:input.mime,name:`${idempotencyKey}.${match[1]==='jpeg'?'jpg':'webp'}`,idempotencyKey,signal:AbortSignal.timeout(12000)});
 check(result?.confirmed===true,'MEDIA_UNCONFIRMED');const url=safeImage(result.url);check(url,'MEDIA_UNCONFIRMED');
 await store.access(proof,nodeId,'booking.configure',{nodeId,op:'media.upload',...input});
 store.event(nodeId,'booking.media.upload',actor.actorId,{reference:idempotencyKey,participants:[nodeId]});
 return {url};
}
