import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
const folder=await mkdtemp(path.join(os.tmpdir(),'utopy-fiscal-test-'));
const outfile=path.join(folder,'commercial.mjs');
try {
  await build({stdin:{contents:'export * from "./src/commercial/commercialDocument.ts";export * from "./src/commercial/commercialDocument.adapters.ts";',resolveDir:process.cwd()},outfile,bundle:true,format:'esm',platform:'node'});
  const {adaptCommercialDocument,commercialDocumentHash}=await import(pathToFileURL(outfile).href);
  for(const kind of ['sale.receipt','market.invoice.draft','market.order.create','work.outcome','work.quote.accepted']) {
    const dv={id:`simulation:${kind}`,kind,meta:{version:1,ts:'2026-09-13T12:00:00Z'},attrs:{sellerNodeId:'simulation:issuer',currency:'PYG',total:'275000',items:[{name:'Mano de obra',qty:'1',unitPrice:'180000',total:'180000',type:'labor'},{name:'Materiales',qty:'1',unitPrice:'95000',total:'95000',type:'material'}],simulation:true,nonTradable:true}};
    const adapted=adaptCommercialDocument(dv);
    assert.deepEqual(adapted.missingFields,[]);assert.equal(adapted.document.lines[0].tax,undefined);
    assert.equal(adapted.document.totals.total,'275000');assert.equal(dv.kind,kind);
    assert.equal(await commercialDocumentHash(adapted.document),await commercialDocumentHash({...adapted.document}));
    assert.notEqual(await commercialDocumentHash(adapted.document),await commercialDocumentHash({...adapted.document,revision:2}));
  }
  const incomplete=adaptCommercialDocument({id:'simulation:missing',kind:'sale.receipt',attrs:{}});
  assert(incomplete.missingFields.includes('currency'));assert(incomplete.missingFields.includes('lines'));
  console.log('OK: commercial adapters, no inferred taxes, stable hashes and missing fields.');
}finally{await unlink(outfile).catch(()=>{});await rmdir(folder);}
