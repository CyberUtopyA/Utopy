import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
import {jsPDF} from 'jspdf';
import {buildRentalContractDraft} from '../src/utils/rentalProperty.js';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const save=jsPDF.API.save;
jsPDF.API.save=function(){mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/km2-contract-fixture.pdf',Buffer.from(this.output('arraybuffer')));return this;};
try{
 const {KM2_CONTRACT_DEFAULTS:terms}=await vite.ssrLoadModule('/src/mt/skylines.contractPreset.ts');
 const pdf=await vite.ssrLoadModule('/src/utils/contrato.ts');
 for(const number of [5,6]){
 const draft=buildRentalContractDraft({property:{id:'fixture:property',city:'Simulación',address:'Dirección de prueba'},room:{id:`fixture:${number}`,number,price:number===5?800000:900000,contractPrice:number===5?750000:850000,contractDefaults:terms},owner:{nombreCompleto:'Locador de prueba',documento:'000000'}});
 assert.equal(draft.parteActual,'arrendatario');assert.equal(draft.inmueble.numeroUnidad,String(number));assert.equal(draft.contrato.canon,number===5?'750000':'850000');assert.equal(draft.contrato.deposito,'500000');assert.equal(draft.contrato.diaVencimiento,'5');assert.equal(draft.arrendatario.nombreCompleto,'');assert.equal(draft.contrato.inicio,'');assert.equal(draft.contrato.fin,undefined);
 const normalized=pdf.buildDraftFromInputs({ownerRaw:draft.arrendador,tenant:{nombreCompleto:'Inquilino de prueba',documento:'000001',domicilio:'Sin dirección real'},property:{tipo:'pieza',numeroUnidad:number,direccion:'Dirección de prueba',ciudad:'Simulación'},contrato:{...draft.contrato,inicio:'2030-01-01',fin:'2030-07-01'}});
 assert.match(normalized.contrato.regimenMora,/5%/);assert.match(normalized.contrato.preaviso,/sin multa ni penalidad/);assert.match(normalized.contrato.condicionesGarantia,/no será exigida/);
 await pdf.generateContractPDFFromDraftWithQR({...normalized,simulation:true,nonTradable:true},'https://example.invalid/contratos/acceso/fixture');
 }
 const seed=readFileSync('src/mt/skylines.rentals.ts','utf8');assert.match(seed,/if\(!unit\|\|unit.attrs\?\.contractDefaults\)continue/);
 assert.doesNotMatch(readFileSync('src/mt/skylines.contractPreset.ts','utf8'),/Cardozo|Kauan|firmaDataUrl|2025-|2026-/);
 for(const file of ['src/pages/renta.jsx','src/pages/payment.jsx','src/pages/contract.tsx','src/mt/skylines.rentals.ts'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:file.endsWith('.jsx')?'jsx':'tsx'});
 console.log('OK: units 5/6 preserve current rent, blank tenant/dates, prepared terms survive normalization, real PDF generated, no tenant/signature copied, JSX/TSX. Production authority remains required.');
}finally{jsPDF.API.save=save;await vite.close();}
