import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer,transformWithEsbuild} from 'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true,include:[]}});
const originalReader=globalThis.FileReader,originalFetch=globalThis.fetch;let network=0;
try{
 globalThis.FileReader=class {readAsDataURL(){this.result='data:image/jpeg;base64,c2ltdWxhdGlvbg==';this.onload();}};
 globalThis.fetch=async()=>{network++;return {ok:true,json:async()=>({url:'https://media.example.test/legacy.jpg'})};};
 const {uploadConversationReferences}=await vite.ssrLoadModule('/src/components/ConversationReferences.tsx');
 const file=new File(['simulation non-tradable fixture'],'simulation.jpg',{type:'image/jpeg'});
 const custom=await uploadConversationReferences([file],{upload:async(f,data)=>{assert.equal(f,file);assert.match(data,/^data:image\/jpeg/);return {url:'https://media.example.test/node.jpg'};}});
 assert.equal(custom[0].url,'https://media.example.test/node.jpg');assert.equal(network,0);
 assert.equal((await uploadConversationReferences([file]))[0].url,'https://media.example.test/legacy.jpg');assert.equal(network,1);
 await assert.rejects(()=>uploadConversationReferences([new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})]));
 await assert.rejects(()=>uploadConversationReferences([file],{upload:async()=>({url:'javascript:bad'})}));
 for(const path of ['src/booking/BookingPhotoPicker.tsx','src/booking/ServiceCatalogEditor.tsx','src/booking/BookingManager.tsx','src/media/imageCompression.ts','src/components/ConversationReferences.tsx'])await transformWithEsbuild(await readFile(path,'utf8'),path,{loader:path.endsWith('.tsx')?'tsx':'ts'});
 const picker=await readFile('src/booking/BookingPhotoPicker.tsx','utf8');assert.match(picker,/type="file"/);assert.doesNotMatch(picker,/capture=/);assert.match(picker,/businessAccess/);assert.match(picker,/publicationConsent:true/);assert.match(picker,/URL.revokeObjectURL/);assert.match(picker,/latestUploaded.current/);
 const publication=await readFile('src/pages/ProducirPanel.tsx','utf8');assert.match(publication,/import { compressImageFile } from '..\/media\/imageCompression'/);assert.doesNotMatch(publication,/async function compressImageFile/);
 console.log('OK: gallery picker contract, optional authorized transport, unchanged legacy transport, rejected types/URLs, shared compressor and TSX. Mocked uploads only; mobile gallery/codec/provider QA remains.');
}finally{globalThis.FileReader=originalReader;globalThis.fetch=originalFetch;await vite.close();}
