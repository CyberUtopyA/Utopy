import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
import {validateBookingConfig,candidateSlots} from '../src/booking/contracts.mjs';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const {bookingPreviewConfig}=await vite.ssrLoadModule('/src/booking/previewConfig.ts');
 for(const brand of ['lua','bassi']){const config=bookingPreviewConfig(brand);assert(config.nodeId.startsWith('preview:booking:'));assert.equal(config.simulation,true);assert.equal(config.nonTradable,true);assert(config.services.every(s=>s.price===null&&s.image===''));assert.equal(config.resources[0].name,'Profesional de ejemplo');assert.equal(config.resources.length,1);validateBookingConfig(config);const slots=candidateSlots(config,'2030-01-08',config.services[0].id,config.resources[0].id,Date.parse('2030-01-01T00:00:00Z'));assert(slots.some(s=>s.label==='09:00'));assert(!slots.some(s=>s.label==='12:00'));config.services[0].name='Changed only here';assert.notEqual(bookingPreviewConfig(brand).services[0].name,config.services[0].name);}
 const page=readFileSync('src/pages/BookingPreviewPage.tsx','utf8');assert.match(page,/Vista de prueba · datos de ejemplo/);assert.match(page,/mediaEnabled={false}/);assert.match(page,/Todo se reinicia al salir o recargar/);assert.doesNotMatch(page,/bookingRequest|publishAuthorized|mtLive|localStorage|sessionStorage|fetch\(/);
 const editor=readFileSync('src/booking/ServiceCatalogEditor.tsx','utf8');assert.match(editor,/mediaEnabled=true/);assert.match(editor,/mediaEnabled\?<BookingPhotoPicker/);assert.match(editor,/disabled={!mediaEnabled}/);
 const app=readFileSync('src/App.jsx','utf8');assert.match(app,/path="\/prueba"/);assert.match(app,/if\(previewRoute\)return/);
 for(const file of ['src/pages/BookingPreviewPage.tsx','src/booking/ServiceCatalogEditor.tsx','src/App.jsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:file.endsWith('.jsx')?'jsx':'tsx'});
 console.log('OK: preview fixture isolation/reset, shared config/slot validation, explicit simulation labels, no preview publish/storage/API paths, media disabled, guarded bootstrap and TSX. Browser visual flow not claimed.');
}finally{await vite.close();}
