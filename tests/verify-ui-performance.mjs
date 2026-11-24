import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
import {createLatestTask} from '../src/utils/latestTask.mjs';
import {startVisiblePolling} from '../src/utils/visiblePolling.mjs';
function timers(){let sequence=0;const tasks=new Map();return {tasks,setTimer:fn=>{const id=++sequence;tasks.set(id,fn);return id;},clearTimer:id=>tasks.delete(id),async next(){const [id,fn]=tasks.entries().next().value;tasks.delete(id);await fn();}};}
{
 const clock=timers(),seen=[];let release;
 const gate=new Promise(resolve=>release=resolve);
 const work=createLatestTask(async snapshot=>{seen.push(snapshot);if(snapshot===99)await gate;},clock);
 for(let i=0;i<100;i++)work.push(i);assert.equal(clock.tasks.size,1);
 const executing=clock.next();await Promise.resolve();assert.deepEqual(seen,[99]);
 for(let i=100;i<200;i++)work.push(i);assert.equal(clock.tasks.size,0);
 release();await executing;assert.equal(clock.tasks.size,1);await clock.next();assert.deepEqual(seen,[99,199]);
 work.push(200);work.stop();assert.equal(clock.tasks.size,0);work.push(201);assert.equal(clock.tasks.size,0);
 const errors=[];const failing=createLatestTask(async()=>{throw Error('expected fixture');},{...clock,onError:e=>errors.push(e.message)});failing.push(1);await clock.next();assert.deepEqual(errors,['expected fixture']);failing.stop();
}
{
 const clock=timers(),listeners=new Set(),doc={hidden:false,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};let calls=0;
 const stop=startVisiblePolling(()=>calls++,15000,{...clock,documentRef:doc});assert.equal(calls,1);assert.equal(clock.tasks.size,1);
 doc.hidden=true;for(const fn of listeners)fn();assert.equal(clock.tasks.size,0);assert.equal(calls,1);
 doc.hidden=false;for(const fn of listeners)fn();assert.equal(calls,2);assert.equal(clock.tasks.size,1);stop();assert.equal(clock.tasks.size,0);assert.equal(listeners.size,0);
}
{
 // Exercise real frequency code with an isolated existing-store/localStorage adapter.
 const originalWindow=globalThis.window,originalStorage=globalThis.localStorage;
 const storage=new Map([['utopy.frequency.preferences.v1',JSON.stringify({actorId:'actor:fixture',mode:'silent'})]]);let writes=0,receive;
 globalThis.window={dispatchEvent:()=>{}};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>{writes++;storage.set(key,value);}};
 globalThis.__frequencySubscribe=fn=>{receive=fn;fn([]);return()=>{receive=null;};};
 try{
  const compiled=await transformWithEsbuild(readFileSync('src/utopy/frequency.engine.ts','utf8'),'frequency.engine.ts',{loader:'ts'});
  const code='const MARKET_RUNTIME_FLAGS={frequency:true}; const mtLiveSubscribe=globalThis.__frequencySubscribe;\n'+compiled.code.replace(/^import .*;\s*$/gm,'');
  const module=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);const stop=module.startFrequencyEngine();
  for(let i=0;i<100;i++)receive([{id:'unrelated',kind:'fixture',attrs:{},meta:{version:i}}]);assert.equal(writes,0);
  const relevant={id:'direct',kind:'fixture',attrs:{targetActorId:'actor:fixture'},meta:{version:1}};receive([relevant]);assert.equal(writes,1);
  for(let i=0;i<100;i++)receive([relevant]);assert.equal(writes,1);stop();
 }finally{globalThis.window=originalWindow;globalThis.localStorage=originalStorage;delete globalThis.__frequencySubscribe;}
}
const luminance=hex=>{const values=hex.match(/[\da-f]{2}/gi).map(n=>parseInt(n,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
for(const [foreground,background] of [['182237','f8f5ef'],['182237','ffffff'],['594a37','ffffff'],['656875','ffffff'],['fff7e9','182237']]){const [a,b]=[luminance(foreground),luminance(background)].sort((x,y)=>y-x);assert((a+.05)/(b+.05)>=4.5,`${foreground} / ${background} contrast`);}
const manager=readFileSync('src/booking/BookingManager.tsx','utf8');assert.match(manager,/data-preset={draft.presentation\?\.preset}/);
const css=readFileSync('src/booking/bassiEditorial.css','utf8');assert.match(css,/lb-manager\[data-preset="bassi-editorial-salon"\]/);assert(!css.includes('backdrop-filter'));assert.match(css,/lb-editorial-line{display:none}/);
const page=readFileSync('src/pages/BassiPage.tsx','utf8');assert.match(page,/<h1>Bienvenido<\/h1>/);assert(!page.includes('<h1>Bassi Coiffure</h1>'));
const booking=readFileSync('src/booking/BookingExperience.tsx','utf8');assert.match(booking,/lazy\(\(\)=>import\('\.\/BookingManager'\)\)/);assert.match(booking,/if\(manage\|\|!endpoint\|\|inFlight\|\|document.hidden\)return/);
for(const file of ['src/booking/BookingExperience.tsx','src/booking/BookingManager.tsx','src/pages/BassiPage.tsx','src/mt/mt.resonator.ts','src/pages/mercado.tsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:file.endsWith('.tsx')?'tsx':'ts'});
console.log('OK: 100 snapshots -> one pending job; serialized latest rerun, cancellation, visibility resume/cleanup, 200 irrelevant/repeated frequency updates without repeated storage writes, admin palette contrast >=4.5, theme binding and TSX. Not a device FPS or browser visual test.');
