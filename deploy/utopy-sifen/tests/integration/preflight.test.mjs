import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { loadConfig } from '../../src/config.mjs';
import { loadCertificate } from '../../src/fiscal/signature.mjs';
import { TEST_WSDL } from '../../src/fiscal/transport.mjs';
test('REAL SIFEN TEST mTLS/WSDL preflight only — does not issue a document', {skip:process.env.SIFEN_TEST_ENABLED!=='true'}, async()=>{
  const config=loadConfig();assert(config.enabled);assert(Object.keys(config.subjects).length,'Missing fiscal subject');
  for(const subject of Object.values(config.subjects)) {
    const credentials=loadCertificate(subject);
    for(const url of Object.values(TEST_WSDL)) {
      const xml=await new Promise((resolve,reject)=>{
        const request=https.get(url,{cert:credentials.cert,key:credentials.privateKey.export({format:'pem',type:'pkcs8'}),minVersion:'TLSv1.2',rejectUnauthorized:true,timeout:30000},res=>{
          if(res.statusCode!==200){res.resume();reject(new Error('WSDL_HTTP_REJECTED'));return;}
          let data='';res.on('data',c=>{data+=c;if(data.length>3000000)request.destroy(new Error('WSDL_TOO_LARGE'));});res.on('end',()=>resolve(data));
        });request.on('timeout',()=>request.destroy(new Error('WSDL_TIMEOUT')));request.on('error',()=>reject(new Error('WSDL_TLS_FAILED')));
      });
      assert.match(xml,/<(?:\w+:)?definitions\b/,'The endpoint did not return WSDL; do not accept BIG-IP HTML');
    }
  }
});
