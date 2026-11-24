import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pinnedWsdl } from '../src/fiscal/wsdl.mjs';
import { parseSifenResponse } from '../src/fiscal/transport.mjs';
import { decimal,validateCommercial } from '../src/fiscal/decimal.mjs';
import { checkLocalSpec } from '../src/fiscal/spec.mjs';
import { fiscalErrorClass } from '../src/fiscal/errors.mjs';
import { documentFixture } from './fixtures.mjs';
import { fiscalDateTime } from '../src/fiscal/date.mjs';

test('WSDL closure pins every import; rejects changed bytes and missing dependencies (synthetic contract)',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'sifen-wsdl-'));
  const wsdl='<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:s="http://schemas.xmlsoap.org/wsdl/soap12/"><import namespace="urn:test" location="types.xsd"/><service name="Test"><port name="Test"><s:address location="https://sifen-test.set.gov.py/test"/></port></service></definitions>';
  const xsd='<schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:test"/>';
  const resource=(file,xml)=>{const local=path.join(dir,file);writeFileSync(local,xml);return {path:local,sourceUrl:'https://sifen-test.set.gov.py/'+file,sha256:createHash('sha256').update(xml).digest('hex')};};
  const root=resource('test.wsdl',wsdl),dep=resource('types.xsd',xsd);
  try {
    assert.throws(()=>pinnedWsdl(root),/IMPORT_NOT_PINNED/);
    const closure=pinnedWsdl({...root,imports:[dep]});
    assert.equal(closure.overrideImportLocation('',root.path,'types.xsd'),dep.path);
    assert.throws(()=>closure.overrideImportLocation('',root.path,'https://attacker.invalid/evil.xsd'));
    writeFileSync(dep.path,xsd+' ');assert.throws(()=>pinnedWsdl({...root,imports:[dep]}),/INTEGRITY/);
  }finally{unlinkSync(root.path);unlinkSync(dep.path);rmdirSync(dir);}
});
test('SOAP rejects XXE and oversized responses before business interpretation',()=>{
  assert.throws(()=>parseSifenResponse('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]><x/>','1','submit'));
  assert.throws(()=>parseSifenResponse('x'.repeat(3000001),'1','submit'));
});
test('decimal fixtures 1, 10, 100, 275000, fractional quantities and precision limits',()=>{
  for(const amount of ['1','10','100','275000']) {
    const d={...documentFixture,lines:[{...documentFixture.lines[0],quantity:'1',unitPrice:amount,total:amount}],totals:{total:amount}};
    assert.deepEqual(validateCommercial(d).missingFields,[]);
  }
  const d={...documentFixture,lines:[{...documentFixture.lines[0],quantity:'0.25',unitPrice:'100',total:'25'}],totals:{total:'25'}};
  assert.deepEqual(validateCommercial(d).missingFields,[]);
  assert.equal(decimal('0.00000001').toFixed(),'0.00000001');assert.throws(()=>decimal('0.000000001'));
});
test('local spec integrity and deterministic-error classification do not claim conformance',()=>{
  assert.equal(checkLocalSpec().integrity,true);
  assert.equal(fiscalErrorClass(new Error('FINAL_XML_INVALID')),'INVALID_XML');
  assert.equal(fiscalErrorClass(new Error('CERT_EXPIRED')),'CERT_ERROR');
  assert.equal(fiscalErrorClass(new Error('AUTH_ERROR')),'AUTH_ERROR');
  assert.equal(fiscalErrorClass(new Error('SIFEN_TRANSPORT_UNKNOWN')),'NETWORK_TRANSIENT');
});
test('UTC commercial timestamp, DE and CDC use the same Paraguay calendar date',()=>{
  assert.equal(fiscalDateTime('2026-09-13T01:00:00Z'),'2026-09-12T22:00:00');
  assert.equal(fiscalDateTime('2026-09-12T22:00:00-03:00'),'2026-09-12T22:00:00');
  assert.throws(()=>fiscalDateTime('2026-09-12T22:00:00'));
});
