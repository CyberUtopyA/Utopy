import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, transformWithEsbuild } from 'vite';

const wrapper=readFileSync('src/components/ProductionQueueWorkspace.tsx','utf8');
const market=readFileSync('src/pages/mercado.tsx','utf8');
assert.match(wrapper,/if\(preferredNodeId\)[\s\S]*?registry\.find\(item=>item\.nodeId===preferredNodeId\)/);
assert.match(wrapper,/available\.length===1/,'ambiguous nodes must not be auto-selected');
assert.match(wrapper,/verifiedBusinessRecords\(entry,allLive,context\)/);
assert.match(wrapper,/if\(!resolved\)return[\s\S]*?\{legacyQueue\}/);
assert.equal((wrapper.match(/<ProducerQueuePanel /g)||[]).length,1);
assert.match(wrapper,/readOnly=\{!controller\}/);
assert.doesNotMatch(wrapper,/mtLiveSetAccessContext|mtLiveEmit|\.execute\(/);
assert.match(market,/produceView === "trabajos"[\s\S]*?<ProductionQueueWorkspace/);
for(const file of ['src/components/ProductionQueueWorkspace.tsx','src/pages/mercado.tsx']){
  await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
}
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
  const {verifiedBusinessRecords}=await vite.ssrLoadModule('/src/utopy/businessWorkspace.ts');
  assert.deepEqual(await verifiedBusinessRecords({nodeId:'one'},[{id:'unverified',attrs:{nodeId:'one'}}],{actingAsNodeId:'two',actorId:'actor'}),[]);
  assert.deepEqual(await verifiedBusinessRecords({nodeId:'one'},[
    {id:'foreign',attrs:{nodeId:'two'}},
    {id:'private-outsider',attrs:{nodeId:'one',actorId:'other'},meta:{scopes:['private']}},
  ],{actingAsNodeId:'one',actorId:'actor'}),[]);
  console.log('OK: administrative queue integration, exact node selection, ambiguity fallback, no implicit execution/context mutation, isolated records and TSX transforms. Browser layout not exercised.');
}finally{await vite.close();}
