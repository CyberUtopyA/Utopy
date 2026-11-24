import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
const vite=await createServer({configFile:false,cacheDir:'node_modules/.vite-product-reality-test',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const reality=await vite.ssrLoadModule('/src/mt/productReality.ts');
 const projection=await vite.ssrLoadModule('/src/mt/universalProduct.ts');
 const input={id:'fixture:quantity',kind:'mt.product',attrs:{title:'Lote ficticio de prueba',sellerNodeId:'node:simulation',sellerName:'Fixture no comercial',price:156250,currency:'PYG',available:false,status:'quote_only',saleEnabled:false,availabilityStatus:'consult',simulation:true,nonTradable:true,measurements:[{key:'Largo',value:'2.5',unit:'m',basis:'declarado',origin:'manual'},{key:'Ancho',value:'20',unit:'cm',basis:'declarado',origin:'manual'},{key:'Espesor',value:'2.5',unit:'cm',basis:'estimado',origin:'camera'}],images:['https://example.com/actual-image.jpg','https://example.com/other-image.jpg'],videoUrl:'https://example.com/actual-video.mp4',glbUrl:'https://example.com/published.glb'}};
 const view=reality.projectProductReality(input);assert.equal(view.measurements.length,3);assert.equal(view.measurements[2].basis,'estimado');assert.equal(view.images.length,2);assert.equal(view.videos.length,1);assert.equal(view.modelUrl,'https://example.com/published.glb');assert.equal(view.consultationOnly,true);
 const product=projection.projectUniversalProduct(input);assert.equal(product.finalPrice,156250);assert.equal(product.available,false);assert.equal(product.stock,null);
 assert.equal(reality.projectProductReality({attrs:{dimensions:{w:20,h:30,d:40}}}).measurements.length,0,'never guess units from bare dimensions');
 assert.equal(reality.projectProductReality({attrs:{dimensions:{unit:'cm',w:20,h:30,d:40}}}).measurements.length,3);
 assert.equal(reality.projectProductReality({attrs:{measurements:[{key:'bad',value:'NaN',unit:'cm'},{key:'bad',value:'2',unit:'unknown'}]}}).measurements.length,0);
 for(const url of ['javascript:alert(1)','data:model/gltf-binary;base64,AAAA','https://user:pass@example.com/model.glb','https://127.0.0.1/model.glb','https://10.0.0.1/model.glb','https://172.16.0.1/model.glb','https://device.local/model.glb'])assert.equal(reality.safeRealityUrl(url),'');
 assert.equal(reality.safeRealityUrl('/models/published.glb','http://localhost:5173'),'http://localhost:5173/models/published.glb');
 assert.equal(reality.projectProductReality({attrs:{modelUrl:'https://example.com/image.jpg?name=.glb'}}).modelUrl,'');
 assert.equal(reality.projectProductReality({attrs:{}}).availabilityKnown,false,'missing availability is not InStock');
 assert.equal(reality.projectProductReality({attrs:{stock:5,available:false}}).availabilityKnown,false,'conflicting inventory declarations require consultation');
 assert.equal(reality.projectProductReality({attrs:{stock:5,available:true}}).availabilityKnown,true);
 const ui=readFileSync('src/components/UniversalProductDialog.tsx','utf8');assert.match(ui,/<ProductRealityPanel/);assert.match(ui,/!reality.availabilityKnown \? undefined/);assert.doesNotMatch(ui,/\{product.seller\} ✓/);
 for(const file of ['src/components/ProductRealityPanel.tsx','src/components/UniversalProductDialog.tsx','src/mt/productReality.ts'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
 console.log('OK: published-only media/GLB/video/dimensions; explicit units and provenance; safe URLs; no guessed measurements or verification badge; consultation-only product stays unavailable for checkout; TSX transforms. Actual device video/GLB/AR and visual mobile QA not exercised.');
}finally{await vite.close();}
