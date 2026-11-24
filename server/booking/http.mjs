import {check,identifier,publicBookingConfig} from '../../src/booking/contracts.mjs';
import {isDeepStrictEqual} from 'node:util';
import {uploadBookingPhoto} from './media.mjs';
/** Mount inside an existing node server. No insecure default identity or CORS wildcard. */
export function livingBookingHandler(store,{uploadMedia,adminInvitations,communication}={}){return async(request,response)=>{
 response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
 try{
  check(request.method==='POST','METHOD_NOT_ALLOWED');check(String(request.headers['content-type']||'').startsWith('application/json'),'JSON_REQUIRED');
  const chunks=[];let size=0;for await(const chunk of request){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;check(size<=3*1024*1024,'REQUEST_TOO_LARGE');chunks.push(bytes);}const body=Buffer.concat(chunks).toString('utf8');
  const {op,nodeId,proof,...input}=JSON.parse(body);check(identifier(nodeId),'INVALID_NODE');check(typeof op==='string'&&op.length<50,'INVALID_ACTION');let result;
  if(!['catalog','slots','admin.info','admin.manifest','admin.preview','admin.accept'].includes(op))check(isDeepStrictEqual(proof?.payload,{nodeId,op,...input}),'PROOF_REQUEST_MISMATCH');
  if(op.startsWith('communication.')){check(communication,'COMMUNICATION_NOT_CONFIGURED');result=await communication.handle(proof,nodeId,op,input);}
  else if(op.startsWith('admin.')){
   check(adminInvitations,'ADMIN_HOST_NOT_CONFIGURED');
   if(op==='admin.info')result=await adminInvitations.info(nodeId);
   else if(op==='admin.manifest')result={manifest:(await adminInvitations.manifest(nodeId)).manifest};
   else if(op==='admin.invite')result=await adminInvitations.issue(proof,nodeId,input);
   else if(op==='admin.preview')result=await adminInvitations.preview(nodeId,input);
   else if(op==='admin.accept')result=await adminInvitations.accept(nodeId,input,proof);
   else if(op==='admin.cancel')result=await adminInvitations.cancel(proof,nodeId,input);
   else if(op==='admin.list')result=await adminInvitations.list(proof,nodeId);
   else if(op==='admin.session')result=await adminInvitations.session(proof,nodeId);
   else throw Error('INVALID_ACTION');
  }
  else if(op==='catalog')result=publicBookingConfig(store.config(nodeId));
  else if(op==='configuration'){await store.access(proof,nodeId,'booking.configure',{nodeId,op});result=store.config(nodeId);}
  else if(op==='slots')result=store.slots(nodeId,input.date,input.serviceId,input.professionalId);
  else if(op==='list')result=await store.list(proof,nodeId,input.admin===true);
  else if(op==='configure')result=await store.configure(proof,nodeId,input.config,input.version);
  else if(op==='history')result=await store.history(proof,nodeId);
  else if(op==='export')result=await store.exportData(proof,nodeId);
  else if(op==='command')result=await store.command(proof,nodeId,input.requestKey,input.command);
  else if(op==='media.upload')result=await uploadBookingPhoto(store,uploadMedia,proof,nodeId,input);
  else throw Error('INVALID_ACTION');
  response.statusCode=200;response.end(JSON.stringify({ok:true,result}));
 }catch(error){const code=/^[A-Z_]{1,80}$/.test(String(error.message))?String(error.message):'INTERNAL_ERROR';response.statusCode=code==='INTERNAL_ERROR'?500:code==='FORBIDDEN'?403:/CONFLICT|OCCUPIED/.test(code)?409:/NOT_CONFIGURED/.test(code)?503:400;response.end(JSON.stringify({ok:false,error:code}));}
};}
