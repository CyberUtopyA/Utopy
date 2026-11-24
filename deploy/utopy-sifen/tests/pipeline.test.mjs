import test from 'node:test';
import assert from 'node:assert/strict';
import { FiscalRepository } from '../src/fiscal/repository.mjs';
import { FiscalService } from '../src/fiscal/service.mjs';
import { documentFixture,fiscalFixture,syntheticCertificate } from './fixtures.mjs';
import { hash } from '../src/auth.mjs';
import { privateRef } from '../src/fiscal/providers.mjs';
for(const scenario of ['accepted','rejected'])test(`full ${scenario} pipeline: ten issue requests, one CDC, signed XML, private outcome, KuDE gate`,async()=>{
  const repo=new FiscalRepository(':memory:');let at=Date.now()+100;
  const document={...documentFixture,buyerRef:'buyer:test'};
  const config={enabled:true,transport:'mock',mockScenario:scenario,nodes:{[document.issuerNodeId]:{fiscalSubjectId:'subject:test'}},subjects:{'subject:test':{fiscal:fiscalFixture,receivers:{'buyer:test':fiscalFixture.receiver},numbering:{documentType:'1',establishment:'001',point:'001',startNumber:1}}}};
  const certificate=syntheticCertificate();
  const service=new FiscalService(config,repo,{now:()=>at,certificateProvider:{get:()=>certificate},cscProvider:{get:()=>({id:'0001',value:'ABCD0000000000000000000000000000'})}});
  try {
    const p={issuerNodeId:document.issuerNodeId,commercialDocumentId:document.documentId,revision:document.revision,documentHash:hash(document),document};
    const draft=repo.saveDraft(p,'subject:test','device:test');
    const results=await Promise.all(Array.from({length:10},()=>service.issue(draft,'device:test')));
    assert.equal(new Set(results.map(r=>r.cdc)).size,1);
    assert.equal(repo.db.prepare('SELECT count(*) n FROM outbox').get().n,1);
    at=Date.now()+100;await service.worker.tick();
    let row=repo.get(p.issuerNodeId,p.commercialDocumentId,1);assert.equal(row.state,'SIGNED');
    const preview=await service.kude(row,true);assert.equal(preview.subarray(0,4).toString(),'%PDF');
    await assert.rejects(service.kude(row,false),/KUDE_NOT_ACCEPTED/);
    await service.worker.tick();row=repo.get(p.issuerNodeId,p.commercialDocumentId,1);assert.equal(row.state,'PROCESSING');
    at+=600001;await service.worker.tick();row=repo.get(p.issuerNodeId,p.commercialDocumentId,1);
    assert.equal(row.state,scenario.toUpperCase());assert.equal(repo.outcome(row).simulation,true);
    assert.equal(repo.outcome(row).documentHash,p.documentHash);assert.equal(repo.outcome(row).amount,undefined);
    if(scenario==='accepted')assert.equal((await service.kude(row)).subarray(0,4).toString(),'%PDF');
    else await assert.rejects(service.kude(row),/KUDE_NOT_ACCEPTED/);
    assert.deepEqual(JSON.parse(row.snapshot).paymentRefs,[]);
    assert.equal((await service.issue(row,'device:test')).cdc,row.cdc);
  }finally{repo.close();}
});
test('secret references cannot be supplied as traversal or relative paths',()=>{
  assert.throws(()=>privateRef(process.cwd(),'../secret.pem'));
  assert.throws(()=>privateRef(process.cwd(),process.cwd()));
});
