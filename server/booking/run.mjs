import {createServer} from 'node:http';
import {resolve,dirname,isAbsolute} from 'node:path';
import {realpath} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {LivingBookingStore} from './store.mjs';
import {livingBookingHandler} from './http.mjs';
import {runtimeBookingAuthorizer} from './runtime-adapter.mjs';
import {NodeAdminInvitations} from './admin-invitations.mjs';
import {NodeCommunication} from './communication.mjs';
import {telegramCommunicationAdapter} from './communication-telegram.mjs';
import {communicationWebhook} from './communication-webhook.mjs';

// Explicit deployment configuration, never frontend env, shared credentials or an auto-trusted identity.
const modulePath=process.env.UTOPY_BOOKING_HOST_MODULE;
if(!modulePath)throw Error('UTOPY_BOOKING_HOST_MODULE_REQUIRED: conectá el Runtime y verificador de mandatos del nodo.');
const host=await import(pathToFileURL(resolve(modulePath)).href);
if(!host.runtime?.authorities||typeof host.authorizeNode!=='function')throw Error('INVALID_RUNTIME_HOST');
if(!process.env.UTOPY_BOOKING_DB)throw Error('UTOPY_BOOKING_DB_REQUIRED: usá una ruta privada, fuera de public y dist.');
const dbPath=resolve(process.env.UTOPY_BOOKING_DB);
if(!isAbsolute(process.env.UTOPY_BOOKING_DB))throw Error('PRIVATE_ABSOLUTE_DB_PATH_REQUIRED');
const dbParent=await realpath(dirname(dbPath));let dbTarget;
try{dbTarget=await realpath(dbPath);}catch(error){if(error.code!=='ENOENT')throw error;dbTarget=dbParent;}
if([dbPath,dbParent,dbTarget].some(path=>path.split(/[\\/]/).some(part=>['public','dist','public_html','htdocs','www'].includes(part.toLowerCase()))))throw Error('PRIVATE_DB_PATH_REQUIRED');
const primaryAuthorizer=runtimeBookingAuthorizer(host);let adminInvitations;
const store=new LivingBookingStore(dbPath,{authorize:async input=>{try{return await primaryAuthorizer(input);}catch(error){if(!adminInvitations||error.message!=='FORBIDDEN')throw error;return adminInvitations.authorizeRequest(input);}}});
if(typeof host.getManifest==='function')adminInvitations=new NodeAdminInvitations(store,host);
const port=Number(process.env.UTOPY_BOOKING_PORT||8787);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
const communication=host.communication?new NodeCommunication(store,{...host.communication,adapters:{telegram:telegramCommunicationAdapter(),...host.communication.adapters}}):null;
const bookingHandler=livingBookingHandler(store,{uploadMedia:host.uploadMedia,adminInvitations,communication});
const webhookHandler=communication?communicationWebhook(communication):null;
const server=createServer((request,response)=>{if(request.url?.startsWith('/api/communication/webhook/')){if(webhookHandler)return webhookHandler(request,response);response.statusCode=503;response.end('Communication not configured');return;}return bookingHandler(request,response);});server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`Living Booking: http://127.0.0.1:${port} (publicar únicamente detrás del proxy HTTPS del nodo)`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});});
