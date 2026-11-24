import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, transformWithEsbuild } from 'vite';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const server = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try {
  const workspace = await server.ssrLoadModule('/src/utopy/businessWorkspace.ts');
  const manifests = await server.ssrLoadModule('/src/mt/utopy.nodeManifest.ts');
  const publishing = await server.ssrLoadModule('/src/utopy/authorizedPublish.ts');
  const identity = await server.ssrLoadModule('/src/utopy/identityContext.ts');
  const owner = await identity.resolveCurrentIdentityContext({allLive:[]});
  const projection = await server.ssrLoadModule('/src/utopy/livingNodeProjection.ts');
  assert.equal(projection.isPublicLivingDV({kind:'utopy.node.manifest',attrs:{setupOnly:true},meta:{scopes:['public']}}),false,'setup is not an active public node');
  const records = [];
  assert.equal(Object.keys(workspace.BUSINESS_CONFIGURATIONS).length,6);
  for (const key of Object.keys(workspace.BUSINESS_CONFIGURATIONS)) {
    const nodeId=`node:simulation:${key}`;
    const manifest = manifests.buildNodeManifestDV({nodeId,nodeName:key,endpoints:{},capabilities:[],ttlMs:3600000,extraAttrs:{slug:key,businessConfiguration:key,status:'setup',simulation:true,nonTradable:true}});
    assert.equal((await workspace.businessRegistry([manifest])).length,0,'unsigned manifest cannot register');
    const {dv} = await publishing.publishAuthorizedDV({dv:manifest,allLive:[],actingAsNodeId:nodeId,allowNodeBootstrap:true,localOnly:true});
    records.push(dv);
  }
  const registry = await workspace.businessRegistry(records);
  assert.equal(registry.length,6,'all configurations use the same real signing/verifying path');
  for (const entry of registry) {
    assert.equal((await workspace.businessAccess(entry,records))?.actorId,owner.actorId);
    assert.equal((await workspace.businessAccess({...entry,manifest:{...entry.manifest,attrs:{...entry.manifest.attrs,nodeName:'tampered'}}},records)),null);
    assert.equal(workspace.belongsToBusiness({attrs:{targetNodeId:entry.nodeId}},entry.nodeId),false);
    assert.equal(workspace.belongsToBusiness({meta:{originNode:entry.nodeId}},entry.nodeId),true);
  }
  assert.equal(workspace.explicitPublic({meta:{scopes:['public','participants']}}),false);
  assert.equal(workspace.explicitPublic({meta:{}}),false);
  const now=Date.now();
  const grant={verified:true,status:'active',actorId:'alice',nodeId:'a',allowedActions:['node.workspace.read'],validUntil:new Date(now+60000).toISOString()};
  assert.equal(workspace.validBusinessGrant(grant,'a','alice','node.workspace.read',now),true);
  for(const bad of [{verified:false},{status:'revoked'},{actorId:'bob'},{nodeId:'b'},{validUntil:'invalid'},{validUntil:new Date(now).toISOString()},{validFrom:new Date(now+60000).toISOString()},{allowedActions:[],roles:['owner']}]) assert.equal(workspace.validBusinessGrant({...grant,...bad},'a','alice','node.workspace.read',now),false);
  assert.equal(workspace.validBusinessGrant(grant,'a','alice','payment.confirm',now),false);
  const duplicate={...records[0],id:'duplicate',attrs:{...records[0].attrs,nodeId:'other'}};
  const accept=async()=>({accepted:true,proof:'verified'});
  assert.equal((await workspace.businessRegistry([records[0],duplicate],accept)).length,0,'ambiguous slugs fail closed');
  const expired={...records[0],meta:{...records[0].meta,ts:'2000-01-01',updatedAt:'2000-01-01',ttl_ms:1000}};
  assert.equal((await workspace.businessRegistry([expired],accept)).length,0);
  const page=readFileSync('src/pages/BusinessWorkspace.tsx','utf8');
  const discoverable=[{nodeId:'a',name:'Espacio abierto',manifest:{attrs:{capabilities:[{id:'repair.phone',description:'Reparación de teléfonos'}]}},configuration:null}];
  assert.equal(workspace.searchBusinessEcosystem(discoverable,'reparacion teléfonos').length,1);
  assert.equal(workspace.searchBusinessEcosystem(discoverable,'no-existe').length,0);
  assert.equal(workspace.searchBusinessEcosystem(discoverable,' ').length,0);
  assert.match(page,/Crear nodo/);
  assert.doesNotMatch(page,/Tipo de actividad|setTemplate|businessConfiguration:template/);
  assert.doesNotMatch(page,/buildNodeManifestDV|installNodeDemonstrations|NodeOwnerOnboarding|NodeCoordinationPanel/,'do not disguise local bootstrap or reconstruction as productive provisioning');
  assert.match(page,/filter\(isCommercialWorkspaceEntry\)/);
  assert.equal(workspace.isCommercialWorkspaceEntry({manifest:{attrs:{simulation:true}}}),false);
  assert.equal(workspace.isCommercialWorkspaceEntry({manifest:{attrs:{demonstrationSet:'fixture'}}}),false);
  assert.equal(workspace.isCommercialWorkspaceEntry({manifest:{attrs:{setupOnly:true}}}),true,'a real operational preparation state is not a simulation');
  assert.match(page,/localOnly:true/); assert.match(page,/mtLiveSetAccessContext/); assert.doesNotMatch(page,/localStorage\.setItem/);
  assert.match(page,/businessAccess\(entry,mtLiveSnapshot\(\),'node.authorization'\)/);
  assert.match(page,/allowedActions:\['node.workspace.read'\]/);
  assert.match(page,/current.wallet.custody !== 'device'/,'delegation still requires persistent custody');
  assert.match(page,/<Queue[^>]*readOnly/);
  assert.match(readFileSync('src/mt/ProducerQueuePanel.tsx','utf8'),/!readOnly && item.status === "done"/);
  for (const file of ['src/pages/BusinessWorkspace.tsx','src/utopy/businessWorkspace.ts','src/App.jsx']) await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:file.endsWith('.jsx')?'jsx':'tsx'});
  console.log('OK: six configurations, real signed local manifests, tamper rejection, no role auto-authority, scopes, expiration, revocation flags, node isolation, ambiguous routes and syntax. No real trade, remote sync or browser UX exercised.');
} finally { await server.close(); }
