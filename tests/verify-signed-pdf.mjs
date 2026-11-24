import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
import {jsPDF} from 'jspdf';
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const original=jsPDF.API.save;
let generated=0;
jsPDF.API.save=function(name){assert(name.endsWith('.pdf'));const bytes=this.output('arraybuffer');assert(bytes.byteLength>1000);assert(this.output().startsWith('%PDF-'));assert(this.getNumberOfPages()>=2);generated++;return this;};
try{
 const {generateContractPDFFromDraftWithQR}=await server.ssrLoadModule('/src/utils/contrato.ts');
 const draft={simulation:true,nonTradable:true,arrendador:{nombreCompleto:'Locador de prueba',documento:'SIMULACION',domicilio:'Sin direccion real'},arrendatario:{nombreCompleto:'Locatario de prueba',documento:'SIMULACION',domicilio:'Sin direccion real'},inmueble:{tipo:'Unidad de prueba',direccion:'Simulacion',ciudad:'Simulacion'},contrato:{inicio:'2030-01-01',fin:'2030-07-01',plazoMeses:6,moneda:'PYG',canon:100},firmas:{signedAt:'2030-01-01T00:00:00Z'}};
 const result=await generateContractPDFFromDraftWithQR(draft,'https://example.invalid/contratos/acceso/simulation');
 assert.equal(result.blob.type,'application/pdf');assert(result.blob.size>1000);assert(result.fileName.endsWith('.pdf'));
 await generateContractPDFFromDraftWithQR({...draft,pagare:{enabled:true,monto:100}},'https://example.invalid/contratos/acceso/simulation');
 assert.equal(generated,2);
 const source=readFileSync('src/pages/exito.jsx','utf8');
 assert.match(source,/pdfInFlight\.current/);assert.match(source,/finally/);assert.match(source,/Tu firma sigue cargada/);assert.doesNotMatch(source,/setStatus\("Error al generar el PDF firmado/);assert.match(source,/verifyAdultForJurisdiction/);
 assert.match(source,/shareRentalPDF/);assert.match(source,/Mis contratos y renovaciones/);
 const delivery=readFileSync('src/utils/rentalDelivery.ts','utf8');assert.match(delivery,/navigator\.canShare/);assert.match(delivery,/navigator\.share/);assert.doesNotMatch(delivery,/fetch\(|localStorage|access_token/);
 await transformWithEsbuild(readFileSync('src/pages/privatecontract.tsx','utf8'),'src/pages/privatecontract.tsx',{loader:'tsx'});
 await transformWithEsbuild(source,'src/pages/exito.jsx',{loader:'jsx'});
 console.log('OK: real PDF bytes and QR, optional pagare, stage-specific errors, submit guard and JSX. Browser download, uploaded signature and identity flow not verified.');
}finally{jsPDF.API.save=original;await server.close();}
