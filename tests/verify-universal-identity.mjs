import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer,transformWithEsbuild} from 'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 // Independent module instances represent independent browser stores. No real
 // accounts, credentials, backend or production identities are used here.
 const first=await vite.ssrLoadModule('/src/utopy/ownership.ts?universal-device-a');
 const concurrent=await Promise.all(Array.from({length:25},()=>first.getWalletStatus()));
 assert.equal(new Set(concurrent.map(x=>x.ownerDid)).size,1);
 assert.equal(new Set(concurrent.map(x=>x.deviceId)).size,1);
 const password='fixture-only-never-real-identity';
 const backup=JSON.parse(await (await first.createEncryptedRecovery(password)).text());
 const second=await vite.ssrLoadModule('/src/utopy/ownership.ts?universal-device-b');
 const unrelated=await second.getWalletStatus();assert.notEqual(unrelated.ownerDid,concurrent[0].ownerDid);
 await assert.rejects(()=>second.restoreEncryptedRecovery(backup,'incorrect-fixture-password','Device B'),/incorrecta|modificado/);
 assert.equal((await second.getWalletStatus()).ownerDid,unrelated.ownerDid,'Failed proof must preserve existing identity');
 const recovered=await second.restoreEncryptedRecovery(backup,password,'Device B');
 assert.equal(recovered.ownerDid,concurrent[0].ownerDid);
 assert.notEqual(recovered.deviceId,concurrent[0].deviceId);
 const identity=await vite.ssrLoadModule('/src/utopy/identityContext.ts');
 assert.equal(await identity.deriveActorIdForOwnerDid(recovered.ownerDid),await identity.deriveActorIdForOwnerDid(concurrent[0].ownerDid));
 const contexts=await Promise.all(['lua','bassi','falcon','market','fundacion'].map(contextKey=>identity.resolveCurrentIdentityContext({contextKey})));
 assert.equal(new Set(contexts.map(x=>x.actorId)).size,1,'Node context cannot create another person');
 assert(contexts.every(x=>x.identityPersistence==='ephemeral'),'Unpersisted test wallets must not claim persistent registration');
 const source=readFileSync('src/utopy/ownership.ts','utf8');assert.match(source,/utopy\.wallet\.primary\.initialize/);assert.match(source,/if\(stored\)throw/);
 for(const file of ['src/utopy/ownership.ts','src/utopy/identityContext.ts','src/pages/IdentitySessionSigner.tsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
 console.log('OK: 25 concurrent calls use one identity; encrypted recovery preserves DID/actor with a new device; wrong password preserves identity; node contexts do not fork person; ephemeral state explicit. No backend registration, real Android/desktop or multi-origin session validation claimed.');
}finally{await vite.close();}
