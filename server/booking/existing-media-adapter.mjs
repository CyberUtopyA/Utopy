import {check,safeImage} from '../../src/booking/contracts.mjs';
/** Adapter for the JSON media/upload.php contract already used by Market.
 * Configure only in the private node host. The provider must validate/decode
 * images and store them as non-executable media. Not a new storage engine. */
export function existingMediaUploader({endpoint,headers={}}){
 const url=new URL(endpoint);check(url.protocol==='https:'&&!url.username&&!url.password,'INVALID_MEDIA_ENDPOINT');
 return async({dataUrl,mime,name,nodeId,idempotencyKey,signal})=>{
  const response=await fetch(url,{method:'POST',redirect:'error',signal,headers:{...headers,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({dataUrl,mime,name,nodeId})});
  const result=await response.json().catch(()=>null);check(response.ok&&result?.url,'MEDIA_UNCONFIRMED');
  return {confirmed:true,url:safeImage(result.url)};
 };
}
