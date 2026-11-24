import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const vite=await createServer({configFile:false,resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const m=await vite.ssrLoadModule('/src/utopy/livingExplorer.ts');
 const fixtures=[{id:'food',seller:'Cocina A',sellerNodeId:'node:a',title:'Plato publicado',category:'comida',raw:{attrs:{category:'Platos'}}},{id:'food2',seller:'Cocina A',sellerNodeId:'node:a',title:'Otro plato',category:'comida',raw:{attrs:{category:'Platos'}}},{id:'home',seller:'Vivienda B',sellerNodeId:'node:b',title:'Unidad publicada',category:'rental property',raw:{attrs:{category:'Alquiler'}}},{id:'work',seller:'Taller C',title:'Reparación',category:'servicio',raw:{attrs:{category:'Reparaciones'}}},{id:'sale',seller:'Comercio D',title:'Artículo',category:'ropa',financeAvailable:true,raw:{attrs:{category:'Ropa'}}}];
 assert.deepEqual(m.explorerModules,['Comer','Comprar','Vivir','Servicios','Financiar']);
 assert.equal(m.explorerItems(fixtures,'Comer','Platos').length,2);assert.equal(m.explorerItems(fixtures,'Vivir','Platos').length,0);assert.equal(m.explorerItems(fixtures,'Servicios').length,1);assert.equal(m.explorerItems(fixtures,'Financiar').length,1);assert.equal(m.explorerItems(fixtures,'Comprar').length,1);
 assert.equal(m.explorerItems(fixtures,'Comer','__all__').length,2);assert.equal(m.explorerItems(fixtures,'Comer','','inexistente').length,0);assert.equal(m.explorerItems([...fixtures,fixtures[0]],'Comer').length,2);
 const nodes=m.explorerNodes(m.explorerItems(fixtures,'Comer'),[{id:'manifest',kind:'utopy.node.manifest',attrs:{nodeId:'node:a',logo:'https://example.invalid/logo.png'},meta:{scopes:['public']}}]);assert.equal(nodes.length,1);assert.equal(nodes[0].items.length,2);assert.match(nodes[0].logo,/logo.png/);
 assert.equal(m.explorerNodes(fixtures.slice(0,1),[{kind:'utopy.node.manifest',attrs:{nodeId:'node:a',logo:'https://example.invalid/private.png'},meta:{scopes:['private']}}])[0].logo,'');
 assert.equal(m.explorerNodes([{...fixtures[0],seller:'Mismo nombre'},{...fixtures[0],id:'other',seller:'Mismo nombre',sellerNodeId:'node:other'}],[]).length,2,'Names never merge different nodes');
 assert.equal(m.explorerNodes([{id:'no-node',seller:'No identity published'}],[]).length,0,'Never fabricate node identities from names');
 // Bundle only the test renderer; keep React/ReactDOM in one native Node module
 // graph (Vite SSR + pnpm can otherwise create separate React dispatchers).
 const require=createRequire(import.meta.url);
 const {build}=createRequire(require.resolve('vite'))('esbuild');
 const rendererRequire=createRequire(require.resolve('react-dom/server'));
 await build({entryPoints:['tests/fixtures/explorer-render.tsx'],outfile:'tmp/explorer-qa-render.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',logLevel:'silent',plugins:[{name:'one-test-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:rendererRequire.resolve(args.path),external:true}));b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
 const {renderExplorer,renderCanvas}=require(resolve('tmp/explorer-qa-render.cjs'));
 const base={items:fixtures,allLive:[],onChange:()=>{},onOpenNode:()=>{},onOpenItem:()=>{}};
 const initial=renderExplorer(base);assert(!initial.includes('Cocina A'));assert(!initial.includes('Plato publicado'));
 const categories=renderExplorer({...base,module:'Comer'});assert(categories.includes('Platos'));assert(!categories.includes('Vivienda B'));assert(!categories.includes('Cocina A'));
 const result=renderExplorer({...base,module:'Comer',category:'Platos'});assert(result.includes('Cocina A'));assert(result.includes('<details>'));assert(!result.includes('Vivienda B'));
 const fixture={arrendador:{nombreCompleto:'Locador fixture',documento:'123456',domicilio:'Domicilio fixture'},arrendatario:{nombreCompleto:'Inquilino fixture',documento:'654321',domicilio:'Domicilio de prueba'},inmueble:{tipo:'pieza',numeroUnidad:'5',direccion:'Dirección fixture',ciudad:'Simulación'},contrato:{inicio:'2030-01-01',plazoMeses:'6',moneda:'PYG',canon:'100',diaVencimiento:'5'}};
 const original=JSON.stringify(fixture);const rendered=renderCanvas({data:fixture,onChange:()=>{}});assert.equal(JSON.stringify(fixture),original);assert(rendered.includes('Locador fixture'));assert(rendered.includes('654321'));assert(!rendered.includes('UTOPYCAMPO'));assert(!rendered.includes('990000'));assert(rendered.includes('Reparaciones y mantenimiento'));
 for(const file of ['src/components/LivingExplorer.tsx','src/components/UnifiedLivingMarket.tsx','src/components/ContractCanvas.tsx','src/pages/contract.tsx','src/pages/mercado.tsx','src/components/sidebar.jsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:file.endsWith('.jsx')?'jsx':'tsx'});
 const unified=readFileSync('src/components/UnifiedLivingMarket.tsx','utf8');assert.match(unified,/<LivingExplorer/);assert.doesNotMatch(unified,/<nav className="ulm-quick-nav"|<div className="ulm-filters"/);
 const shelf=readFileSync('src/components/LivingExplorer.tsx','utf8');assert.match(shelf,/onChange\(label,''\)/);assert.match(shelf,/<details>/);assert.match(shelf,/catalogStatus/);
 const canvas=readFileSync('src/components/ContractCanvas.tsx','utf8');assert.match(canvas,/buildContractText/);assert.match(canvas,/structuredClone\(data\)/);assert.doesNotMatch(canvas,/dangerouslySetInnerHTML|contentEditable|fetch\(|publishAuthorized|createPrivateContract/);
 const sidebar=readFileSync('src/components/sidebar.jsx','utf8');assert.match(sidebar,/navigate\("\/market\?account=1"\)/);assert.doesNotMatch(sidebar,/navigate\("\/login"\)/);
 console.log('OK: module/category/query matching, real node grouping, dedup, public logos, no fabricated categories/businesses, inline options, sidebar account route, same contract text engine and TSX. Visual/mobile/browser validation pending.');
}finally{await vite.close();}
