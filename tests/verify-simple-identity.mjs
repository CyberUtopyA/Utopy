import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const mod=await vite.ssrLoadModule('/src/utopy/simpleIdentity.ts');
 const valid={name:'Ana',phone:'',email:'',password:'long secret 1234',confirmation:'long secret 1234',consent:true};
 assert.deepEqual(mod.validateSimpleIdentity(valid),{name:'Ana',phone:'',email:''});
 for(const bad of [{name:''},{phone:'not a number'},{email:'bad'},{password:'short'},{confirmation:'different'},{consent:false}])assert.throws(()=>mod.validateSimpleIdentity({...valid,...bad}));
 await assert.rejects(()=>mod.prepareSimpleIdentity(valid),/almacenamiento/,'ephemeral identities cannot complete signup');
 const source=readFileSync('src/utopy/simpleIdentity.ts','utf8');
 assert.match(source,/createEncryptedRecovery/);assert.match(source,/scopes:\['private'\]/);assert.match(source,/phoneVerified:false,emailVerified:false/);
 assert.doesNotMatch(source,/node\.authorization|localStorage|fetch\(/);
 for(const file of ['src/utopy/simpleIdentity.ts','src/components/SimpleIdentitySignup.tsx','src/pages/LuaPage.tsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
 console.log('OK: optional contacts, input/consent checks, persistent identity gate, existing recovery, private contacts, no grants or remote login claims. Browser persistence/restore requires device QA.');
}finally{await vite.close();}
