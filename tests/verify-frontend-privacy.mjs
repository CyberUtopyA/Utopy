import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { frontendPrivacyGuard } from '../frontendPrivacyGuard.js';
const guards = [frontendPrivacyGuard];
for (const root of process.argv.slice(2)) {
  const source = readFileSync(resolve(root,'frontendPrivacyGuard.ts'),'utf8');
  const result = await transformWithEsbuild(source,'guard.ts',{loader:'ts',format:'esm'});
  guards.push((await import('data:text/javascript;base64,' + Buffer.from(result.code).toString('base64'))).frontendPrivacyGuard);
}
for (const makeGuard of guards) {
  const guard = makeGuard();
  for (const hook of ['configureServer','configurePreviewServer']) {
    let middleware;
    guard[hook]({middlewares:{use(fn){middleware=fn;}}});
    for (const url of ['/.env','/.env.local?raw','/.git/config','/.utopy-private/events.json','/api/data/page-drafts.json','/api/_tpago.php','/secret.key','/%2eenv','/%2eutopy-private/nodes.json']) {
      let next = false, ended = false;
      const response = { statusCode:200,setHeader(){},end(){ended=true;} };
      middleware({url},response,()=>{next=true;});
      assert.equal(response.statusCode,404,url); assert.ok(ended && !next,url);
    }
    let allowed = false;
    middleware({url:'/media/photo.png'},{},()=>{allowed=true;}); assert.ok(allowed);
    if (hook === 'configurePreviewServer') {
      const response = {statusCode:200,setHeader(){},end(){}};
      middleware({url:'/api/node-live.php'},response,()=>assert.fail('Preview must not serve PHP source'));
      assert.equal(response.statusCode,404);
    }
  }
  assert.throws(()=>guard.configResolved({env:{VITE_API_SECRET:'fixture-not-real'},publicDir:false}),/Server credential/);
  const directory = mkdtempSync(join(tmpdir(),'utopy-privacy-'));
  try {
    mkdirSync(join(directory,'api/data'),{recursive:true});
    writeFileSync(join(directory,'api/data/page-drafts.json'),'{}');
    assert.throws(()=>guard.configResolved({env:{},publicDir:directory}),/Private file/);
  } finally { rmSync(directory,{recursive:true}); }
}
console.log(`OK: ${guards.length} repositories: private URLs blocked, public assets allowed, secret env rejected, public runtime state rejected. No credential values logged.`);
