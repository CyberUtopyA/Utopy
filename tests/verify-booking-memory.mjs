import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const originalWindow=globalThis.window,originalStorage=globalThis.localStorage;
try{
 const {bookingContactUpdate}=await vite.ssrLoadModule('/src/booking/rememberedContact.ts');
 const actor='actor:simulation:customer',prior={id:`identity.private.profile:${actor}`,kind:'identity.private.profile',attrs:{actorId:actor,subjectActorId:actor,document:'PRIVATE-FIXTURE',country:'PY',contact:{name:'Before',phone:'+595 981 123456',email:'fixture@example.invalid',phoneVerified:true},participants:[actor]},meta:{version:4,ns:'utopy:identity',scopes:['private'],authority:actor,originNode:'node:fixture'}};
 const input={name:' Ana Fixture ',phone:'+595 981 123456',consent:true};
 const update=bookingContactUpdate(prior,actor,input);
 assert.equal(update.id,prior.id);assert.equal(update.meta.version,5);assert.equal(update.meta.originNode,prior.meta.originNode);assert.equal(update.meta.authority,prior.meta.authority);assert.equal(update.attrs.document,prior.attrs.document);assert.equal(update.attrs.contact.email,prior.attrs.contact.email);assert.equal(update.attrs.contact.phoneVerified,true);assert.deepEqual(update.meta.scopes,['private']);assert.equal(update.attrs.bookingAutofill.enabled,true);
 assert.equal(bookingContactUpdate(prior,actor,{...input,phone:'+595 981 654321'}).attrs.contact.phoneVerified,false);
 for(const invalid of [{consent:false},{name:''},{phone:'not a phone'},{phone:'1'.repeat(41)}])assert.throws(()=>bookingContactUpdate(prior,actor,{...input,...invalid}));
 assert.throws(()=>bookingContactUpdate(prior,'actor:simulation:other',input));
 const disabled=bookingContactUpdate(update,actor,{name:'',phone:'',consent:true,enabled:false});assert.equal(disabled.attrs.bookingAutofill.enabled,false);assert.deepEqual(disabled.attrs.contact,update.attrs.contact);assert.equal(disabled.attrs.document,prior.attrs.document);
 const entries=new Map(),storage={getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value)};
 globalThis.localStorage=storage;globalThis.window={localStorage:storage,setTimeout,clearTimeout,requestAnimationFrame:fn=>setTimeout(fn,0)};
 const store=await vite.ssrLoadModule('/src/mt/mt.liveStore.ts');store.mtLiveSetAccessContext({actorId:actor});
 store.mtLiveUpsert({...update,attrs:{...update.attrs,simulation:true,nonTradable:true}});assert.equal(store.mtLivePersistCurrent(),true);await new Promise(resolve=>setTimeout(resolve,260));
 const publicCache=entries.get('mt.web.liveDatos.public.v2')||'';assert(!publicCache.includes(input.phone));
 const privateKey=`mt.web.liveDatos.private.v2:${encodeURIComponent(actor)}:personal`;assert(entries.get(privateKey).includes(input.phone));
 store.mtLiveSetAccessContext({actorId:'actor:simulation:other'});assert(!JSON.stringify(store.mtLiveSnapshot()).includes(input.phone));
 store.mtLiveSetAccessContext({actorId:actor});assert.equal(store.mtLiveSnapshot().find(dv=>dv.id===update.id).attrs.contact.name,'Ana Fixture');
 const reloaded=await vite.ssrLoadModule('/src/mt/mt.liveStore.ts?memory-reload');reloaded.mtLiveSetAccessContext({actorId:actor});assert.equal(reloaded.mtLiveSnapshot().find(dv=>dv.id===update.id).attrs.contact.phone,input.phone);
 const originalSet=storage.setItem,originalWarn=console.warn;storage.setItem=()=>{throw Error('quota fixture');};console.warn=()=>{};try{assert.equal(reloaded.mtLivePersistCurrent(),false);}finally{storage.setItem=originalSet;console.warn=originalWarn;}
 const source=readFileSync('src/booking/rememberedContact.ts','utf8');assert.match(source,/proof.proof!=='verified'/);assert.match(source,/custody!=='device'/);assert.match(source,/localOnly:true/);assert.doesNotMatch(source,/fetch\(|localStorage\.setItem|node\.authorization/);
 const ui=readFileSync('src/booking/BookingExperience.tsx','utf8');assert.match(ui,/utopy.wallet.changed/);assert.match(ui,/setContactConsent\(false\)/);assert.match(ui,/Recordar mis datos/);assert.match(ui,/Tus datos están listos/);assert.match(ui,/No autocompletar/);
 await transformWithEsbuild(ui,'BookingExperience.tsx',{loader:'tsx'});
 console.log('OK: consent/validation, stable private identity merge, verification guards, actual shared-store persistence/reload, public-cache exclusion, actor isolation, opt-out without identity deletion and TSX. Simulated private fixtures; device/browser flow not exercised.');
}finally{globalThis.window=originalWindow;globalThis.localStorage=originalStorage;await vite.close();}
