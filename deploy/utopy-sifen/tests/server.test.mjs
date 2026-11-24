import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync,sign,verify,randomUUID } from 'node:crypto';
import { mkdtempSync,writeFileSync,unlinkSync,rmdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFiscalServer } from '../src/server.mjs';
import { FiscalRepository } from '../src/fiscal/repository.mjs';
import { canonical,hash } from '../src/auth.mjs';
import { documentFixture } from './fixtures.mjs';
test('private HTTP API verifies request/response, saves once, rejects replay and disables issuance',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'utopy-fiscal-http-'));
  const keyFile=path.join(dir,'ephemeral-test.key');
  const keys=generateKeyPairSync('ec',{namedCurve:'P-256'});
  writeFileSync(keyFile,keys.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  const repo=new FiscalRepository(':memory:');
  const config={adapterKeyPath:keyFile,origins:['https://market.example.invalid'],nodes:{[documentFixture.issuerNodeId]:{fiscalSubjectId:'test',authorizedKeys:[{keyId:'test',publicKeyJwk:keys.publicKey.export({format:'jwk'}),actions:['document.save','document.status','document.submit']}]}},subjects:{test:{}}};
  const server=createFiscalServer(config,repo);
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${server.address().port}`;
    const payload={protocol:'utopy.fiscal.request/1',scope:'private:fiscal',action:'document.save',issuerNodeId:documentFixture.issuerNodeId,nonce:randomUUID(),timestamp:Date.now(),commercialDocumentId:documentFixture.documentId,revision:1,documentHash:hash(documentFixture),document:documentFixture};
    const request=p=>({payload:p,keyId:'test',signature:sign('sha256',Buffer.from(canonical(p)),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')});
    const post=p=>fetch(url+'/v1/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request(p))});
    const response=await post(payload);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const {signature,...attestation}=await response.json();
    assert(verify('sha256',Buffer.from(canonical(attestation)),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
    assert.equal(attestation.payload.state,'DRAFT');assert.equal((await post(payload)).status,403);
    assert.equal((await post({...payload,nonce:randomUUID()})).status,200);
    assert.equal(repo.db.prepare('SELECT count(*) n FROM documents').get().n,1);
    assert.equal((await post({...payload,nonce:randomUUID(),action:'document.submit'})).status,409);
    const health=await(await fetch(url+'/health')).json();assert.equal(health.workerReady,false);assert.equal(health.productionEnabled,false);
    assert.equal(JSON.stringify(health).includes('44444401'),false);
  }finally{
    await new Promise(resolve=>server.close(resolve));repo.close();unlinkSync(keyFile);rmdirSync(dir);
  }
});
