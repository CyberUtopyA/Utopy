import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createIdentity,signEnvelope,createEnvelope,AuthorityRegistry} from 'utopy';
import {LivingBookingStore} from '../server/booking/store.mjs';
import {livingBookingHandler} from '../server/booking/http.mjs';
import {runtimeBookingAuthorizer} from '../server/booking/runtime-adapter.mjs';
import {localInstant} from '../src/booking/contracts.mjs';
import {uploadBookingPhoto} from '../server/booking/media.mjs';
const owner=await createIdentity({actorId:'actor:simulation:owner'}),customer=await createIdentity({actorId:'actor:simulation:customer'}),other=await createIdentity({actorId:'actor:simulation:other'});
const authorities=new AuthorityRegistry();for(const i of [owner,customer])authorities.trust(i.actorId,i.keyId,i.publicKeyJwk);
const runtime={authorities};let mandate=true;
const store=new LivingBookingStore(':memory:',{authorize:runtimeBookingAuthorizer({runtime,authorizeNode:({actorId,nodeId})=>mandate&&actorId===owner.actorId&&nodeId==='node:simulation'})});
let uploads=0,providerConfirmed=true;
const server=createServer(livingBookingHandler(store,{uploadMedia:async()=>{uploads++;return {confirmed:providerConfirmed,url:'https://media.example.test/photo.jpg'};}}));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),day=new Date(`${date}T12:00:00Z`).getUTCDay();
const config={schema:'utopy.living-booking/1',simulation:true,nonTradable:true,nodeId:'node:simulation',name:'Prueba aislada',timeZone:'America/Asuncion',confirmation:'approval',slotMinutes:15,presentation:{preset:'standard'},resources:[{id:'pro:1',name:'Profesional ficticio de prueba',kind:'professional',windows:[{day,start:'09:00',end:'12:00'}],blocks:[]}],services:[{id:'service:1',name:'Servicio de prueba',category:'Prueba',description:'',image:'',price:null,currency:'PYG',durationMinutes:60,professionalIds:['pro:1'],resourceIds:[],active:true}],gallery:[]};
const signed=async(identity,payload)=>signEnvelope(await createEnvelope({id:`simulation:request:${crypto.randomUUID()}`,kind:'booking.request',sourceActorId:identity.actorId,authority:identity.actorId,targetNodeId:'node:simulation',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),scopes:['private'],payload}),identity);
const send=async(body,identity)=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...(identity?{proof:await signed(identity,body)}:{})})});return {status:response.status,...await response.json()};};
try{
 const configured=await send({nodeId:'node:simulation',op:'configure',config,version:0},owner);assert.equal(configured.status,200);
 const publicView=await send({nodeId:'node:simulation',op:'catalog'});assert.deepEqual(publicView.result.resources[0].windows,[]);assert.deepEqual(publicView.result.resources[0].blocks,[]);
 // Structural upload fixture, isolated provider stub: no real photos uploaded.
 const image=Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0,0,0,255,217]);
 const upload={nodeId:'node:simulation',op:'media.upload',dataUrl:`data:image/jpeg;base64,${image.toString('base64')}`,mime:'image/jpeg',publicationConsent:true};
 assert.equal((await send(upload,customer)).status,403);assert.equal(uploads,0);
 assert.equal((await send({...upload,publicationConsent:false},owner)).error,'PHOTO_CONSENT_REQUIRED');assert.equal(uploads,0);
 assert.equal((await send({...upload,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='},owner)).error,'INVALID_IMAGE');assert.equal(uploads,0);
 assert.equal((await send(upload,owner)).result.url,'https://media.example.test/photo.jpg');assert.equal(uploads,1);
 const {nodeId:mediaNode,op:mediaOp,...mediaInput}=upload;await assert.rejects(async()=>uploadBookingPhoto(store,undefined,await signed(owner,upload),mediaNode,mediaInput),/MEDIA_NOT_CONFIGURED/);
 providerConfirmed=false;assert.equal((await send(upload,owner)).error,'MEDIA_UNCONFIRMED');providerConfirmed=true;
 const command={op:'create',date,start:localInstant(date,'09:00'),serviceId:'service:1',professionalId:'pro:1'};
 const payload={nodeId:'node:simulation',op:'command',requestKey:'simulation:one',command};
 assert.equal((await send(payload,other)).status,403); // unregistered key, not TOFU
 const response=await send(payload,customer);assert.equal(response.status,200);assert.equal(response.result.booking.status,'requested');
 const retry=await send(payload,customer);assert.equal(retry.result.booking.id,response.result.booking.id);
 const changed={...payload,command:{...command,start:localInstant(date,'10:00')},proof:await signed(customer,payload)};assert.equal((await send(changed)).error,'PROOF_REQUEST_MISMATCH');
 const b=response.result.booking;
 assert.equal((await send({nodeId:'node:simulation',op:'command',requestKey:'simulation:bad',command:{op:'confirm',id:b.id,version:b.version}},customer)).status,403);
 assert.equal((await send({nodeId:'node:simulation',op:'list',admin:true},customer)).status,403);
 mandate=false;assert.equal((await send({nodeId:'node:simulation',op:'configuration'},owner)).status,403);mandate=true;
 const query={nodeId:'node:simulation',op:'list'};const old=await signed(customer,query);authorities.revoke(customer.actorId,customer.keyId);assert.equal((await send({...query,proof:old})).status,403);
 console.log('OK: real HTTP + ES256 Runtime signatures, pinned keys, exact payload binding, customer/admin isolation, mandate/device revocation, private schedule redaction and idempotent retries. Isolated simulation, no live business data.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
