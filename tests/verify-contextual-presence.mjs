import assert from 'node:assert/strict';
import {createServer,transformWithEsbuild} from 'vite';
import {readFile} from 'node:fs/promises';
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try {
 const {buildCapabilityPresence:build,projectCapabilityPresence:project}=await server.ssrLoadModule('/src/utopy/capabilityPresence.ts');
 const {rankContextualFeed:rank}=await server.ssrLoadModule('/src/utopy/contextualFeed.ts');
 const now=Date.parse('2026-10-24T12:00:00Z');
 const active=build('node:fixture','commerce.orders','available',1,true,now);
 assert.throws(()=>build('node:fixture','commerce.orders','available',1,false,now));
 assert.throws(()=>build('node:fixture','payment.offer','available',1,true,now));
 const read=(all,verified,t=now)=>project(all,new Set(verified),'node:fixture','commerce.orders',t);
 assert.equal(read([active],[]).status,'unknown');
 assert.equal(read([active],[active]).status,'available');
 assert.equal(read([active],[active],now+16*60_000).status,'unknown');
 const pause=build('node:fixture','commerce.orders','resting',2,true,now+1000);
 assert.equal(read([active,pause],[active,pause],now+1001).status,'resting');
 assert.equal(read([active,pause],[active,pause],now+30*86400_000).status,'resting','manual stop never automatically reopens');
 const resume=build('node:fixture','commerce.orders','available',3,true,now+2000);
 assert.equal(read([active,pause,resume],[active,pause,resume],now+2001).status,'available');
 const conflict={...resume,attrs:{...resume.attrs,presence:{...resume.attrs.presence,status:'busy'}}};
 assert.equal(read([resume,conflict],[resume,conflict],now+2001).status,'unknown');
 const swapped={...active,attrs:{...active.attrs,presence:{...active.attrs.presence,status:'paused'}}};
 assert.equal(read([swapped],[active]).status,'unknown','a verified id cannot authorize a replaced object');
 const privateState={...active,meta:{...active.meta,scopes:['public','participants']}};
 assert.equal(read([privateState],[privateState]).status,'unknown');
 const wrong={...active,meta:{...active.meta,authority:'node:other'}};
 assert.equal(read([wrong],[wrong]).status,'unknown');
 const unknown=nodeId=>({nodeId,capability:'commerce.orders',status:'unknown',label:'Consultar disponibilidad',source:null});
 const items=[{id:'cold',title:'Jugo frío',sellerNodeId:'node:a',raw:{}},{id:'hot',title:'Café caliente',sellerNodeId:'node:b',raw:{}},{id:'hot2',title:'Sopa caliente',sellerNodeId:'node:b',raw:{}}];
 const input={intention:'',allLive:[],actorId:'actor:fixture',personalized:true,presence:unknown,now};
 const weather={temperature:10,code:3,source:'https://api.open-meteo.com/v1/forecast',updatedAt:now,expiresAt:now+25*60_000};
 assert.equal(rank(items,{...input,weather})[0].item.id,'hot');
 assert.equal(rank(items,{...input,weather:{...weather,temperature:32}})[0].item.id,'cold');
 assert.equal(rank(items,{...input,weather:{...weather,expiresAt:now-1}})[0].item.id,'cold','expired weather is ignored');
 assert.equal(rank(items,{...input,weather,personalized:false})[0].item.id,'cold');
 assert.ok(rank(items,{...input,weather,hiddenIds:['hot']}).every(entry=>entry.item.id!=='hot'));
 assert.equal(rank(items,{...input,intention:'café',personalized:false})[0].item.id,'hot','explicit search survives personalization opt-out');
 assert.ok(rank(items,{...input,weather}).every(entry=>entry.reasons.length));
 for(const file of ['src/components/CapabilityAvailabilityControl.tsx','src/components/UnifiedLivingMarket.tsx','src/pages/checkoutmodal.tsx','src/components/UniversalProductDialog.tsx','src/pages/BusinessWorkspace.tsx','src/components/ProductionQueueWorkspace.tsx','src/pages/useCircularAtmosphere.ts','src/utopy/useCapabilityPresence.ts']){
  const source=await readFile(new URL(`../${file}`,import.meta.url),'utf8');await transformWithEsbuild(source,file,{loader:file.endsWith('.tsx')?'tsx':'ts'});
 }
 console.log('OK: exact-object verified presence, TTL, manual pause latch, conflicts, privacy; contextual weather TTL/consent, search opt-out, explanations, hide; TSX. No dispatch, PIN verification, PASS consumption or real money claimed.');
}finally{await server.close();}
