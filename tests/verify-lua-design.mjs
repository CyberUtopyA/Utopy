import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithEsbuild} from 'vite';
import {readFile} from 'node:fs/promises';
// Windows junctions can expose AO/Ao and AO/ao as separate ESM caches.
// Resolve component dependencies from the renderer to exercise one real React instance.
const rendererRequire=createRequire(import.meta.resolve('react-dom/server'));
const React=rendererRequire('react');
{
 const compiled=await transformWithEsbuild(await readFile('src/booking/BookingCalendar.tsx','utf8'),'BookingCalendar.tsx',{loader:'tsx',jsx:'automatic'});
 const code=compiled.code.replace(/from ["'](react(?:\/jsx-runtime)?|lucide-react)["']/g,(_,name)=>`from ${JSON.stringify(pathToFileURL(rendererRequire.resolve(name)).href)}`);
 const {default:Calendar}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const html=renderToStaticMarkup(React.createElement(Calendar,{value:'2026-11-19',min:'2026-11-11',onChange:()=>{}}));
 assert.match(html,/noviembre de 2026|noviembre 2026/);assert.match(html,/aria-pressed="true"[^>]*>19/);
 assert.match(html,/Mes siguiente/);assert.match(html,/Calendario de citas/);assert.match(html,/disabled=""/);
 assert.match(html,/Los horarios disponibles se consultan/);
 const range=renderToStaticMarkup(React.createElement(Calendar,{value:'2026-11-19',endValue:'2026-11-23',min:'2026-11-11',onChange:()=>{},onEndChange:()=>{}}));assert.match(range,/lb-in-range/);assert.equal((range.match(/aria-pressed="true"/g)||[]).length,2);
 const fieldCompiled=await transformWithEsbuild(await readFile('src/components/InteractiveField.tsx','utf8'),'InteractiveField.tsx',{loader:'tsx',jsx:'automatic'});
 const fieldCode=fieldCompiled.code.replace(/import\s+["']\.\/interactiveFields.css["'];?/g,'').replace(/from ["'](react(?:\/jsx-runtime)?|lucide-react)["']/g,(_,name)=>`from ${JSON.stringify(pathToFileURL(rendererRequire.resolve(name)).href)}`);
 const {default:Field}=await import(`data:text/javascript;base64,${Buffer.from(fieldCode).toString('base64')}`);
 const fieldHtml=renderToStaticMarkup(React.createElement(Field,{icon:()=>null,title:'Tu nombre',summary:'Nombre conservado',done:true,initialOpen:true},React.createElement('input',{value:'Nombre conservado',readOnly:true})));assert.match(fieldHtml,/aria-expanded="true"/);assert.match(fieldHtml,/value="Nombre conservado"/);assert.match(fieldHtml,/Completado/);
 const source=await readFile('src/booking/BookingExperience.tsx','utf8');
 assert.match(source,/<BookingCalendar/);assert.match(source,/booking.status===.confirmed.\?.¡Tu cita está lista!/);
 assert.match(source,/disabled={!loaded\|\|!service.active\|\|!slot\|\|busy}/);
 const banner=await readFile('src/components/botonintruction.tsx','utf8');assert.match(banner,/pathname/);assert.match(banner,/lua/);
 console.log('OK: actual React calendar render, selected day, disabled past dates, accessible month controls, server-gated booking and status-based confirmation. No browser visual QA claimed.');
}
