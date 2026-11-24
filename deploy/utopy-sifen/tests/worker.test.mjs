import test from 'node:test';
import assert from 'node:assert/strict';
import { FiscalRepository } from '../src/fiscal/repository.mjs';
import { FiscalWorker } from '../src/fiscal/worker.mjs';
import { parseSifenResponse } from '../src/fiscal/transport.mjs';
import { documentFixture } from './fixtures.mjs';
import { hash } from '../src/auth.mjs';
const cdc='01444444017001001001452822017012515873260988';
const envelope=body=>`<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>${body}</s:Body></s:Envelope>`;
const batch=(status,id=cdc)=>envelope(`<rResEnviConsLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dFecProc>2026-09-13T09:00:00-03:00</dFecProc><dCodResLot>0362</dCodResLot><gResProcLote><id>${id}</id><dEstRes>${status}</dEstRes><gResProc><dCodRes>${status==='Rechazado'?'9999':'0260'}</dCodRes><dMsgRes>SIMULATION</dMsgRes></gResProc></gResProcLote></rResEnviConsLoteDe>`);
test('SOAP responses: accepted/rejected/processing/malformed/wrong CDC are distinguished',()=>{
  assert.equal(parseSifenResponse(batch('Aprobado'),cdc,'batch').state,'ACCEPTED');
  assert.equal(parseSifenResponse(batch('Rechazado'),cdc,'batch').state,'REJECTED');
  assert.equal(parseSifenResponse(envelope('<rResEnviConsLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dCodResLot>0361</dCodResLot></rResEnviConsLoteDe>'),cdc,'batch').state,'PROCESSING');
  assert.throws(()=>parseSifenResponse('<html>BIG-IP</html>',cdc,'submit'));
  assert.throws(()=>parseSifenResponse(batch('Aprobado','another-cdc'),cdc,'batch'));
});
test('siConsDE accepts only 0422 with a matching returned DE, never a bare code',()=>{
  const reply=content=>envelope(`<rEnviConsDeResponse xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dFecProc>2026-09-13T09:00:00-03:00</dFecProc><dCodRes>0422</dCodRes>${content===null?'':`<xContenDE>${content}</xContenDE>`}</rEnviConsDeResponse>`);
  const returned=`&lt;rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd"&gt;&lt;DE Id="${cdc}"/&gt;&lt;/rDE&gt;`;
  assert.equal(parseSifenResponse(reply(returned),cdc,'document').state,'ACCEPTED');
  assert.throws(()=>parseSifenResponse(reply(null),cdc,'document'));
  assert.throws(()=>parseSifenResponse(reply(returned.replace(cdc,'0'.repeat(cdc.length))),cdc,'document'));
});
for(const fault of ['timeout','TLS error'])test(`${fault}: worker only queries after uncertain send and keeps original CDC`,async()=>{
  const repo=new FiscalRepository(':memory:'); let now=Date.now(),sends=0,queries=0;
  try {
    const p={issuerNodeId:documentFixture.issuerNodeId,commercialDocumentId:documentFixture.documentId,revision:1,documentHash:hash(documentFixture),document:documentFixture};
    let row=repo.saveDraft(p,'subject','test-key');row=repo.reserve(row,{documentType:'1',establishment:'001',point:'001',startNumber:1},()=>cdc);now=Date.now()+10;
    const transport={submit:async()=>{sends++;throw new Error(fault);},query:async()=>{queries++;return{...parseSifenResponse(batch('Aprobado'),cdc,'batch'),raw:batch('Aprobado')};}};
    const worker=new FiscalWorker(repo,{now:()=>now,build:async()=>({xml:'SIMULATION ONLY',hash:'simulated'}),transportFor:async()=>transport});
    await worker.tick();await worker.tick();
    assert.equal(repo.get(p.issuerNodeId,p.commercialDocumentId,1).state,'UNKNOWN');
    await worker.tick();assert.equal(queries,0);
    now+=600001;await worker.tick();
    const final=repo.get(p.issuerNodeId,p.commercialDocumentId,1);
    assert.equal(final.state,'ACCEPTED');assert.equal(final.cdc,cdc);assert.equal(sends,1);assert.equal(queries,1);
    await worker.tick();assert.equal(sends,1);
  }finally{repo.close();}
});
