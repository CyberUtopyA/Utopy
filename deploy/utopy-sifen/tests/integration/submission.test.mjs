import test from 'node:test';
import assert from 'node:assert/strict';
import { runTestFlow } from '../../scripts/test-flow.mjs';
test('REAL DNIT TEST: submit fixture, query individual outcome and expose KuDE', {
  skip:process.env.SIFEN_TEST_ENABLED!=='true'||process.env.SIFEN_ALLOW_TEST_SUBMIT!=='true',
  timeout:24*60*60*1000+60000,
},async()=>{
  const result=await runTestFlow('submit-fixture',process.env,['--allow-test-submit']);
  assert.equal(result.environment,'test');assert.equal(result.simulation,false);
  assert.equal(result.state,'ACCEPTED',`DNIT result: ${result.resultCode||result.state}`);
  assert.equal(result.kudeAvailable,true);assert(result.outcome?.responseRef);
});
