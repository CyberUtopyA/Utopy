import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, resolveSubject } from '../src/config.mjs';
import { hash } from '../src/auth.mjs';
import { FiscalRepository } from '../src/fiscal/repository.mjs';
import { FiscalService } from '../src/fiscal/service.mjs';
import { checkLocalSpec } from '../src/fiscal/spec.mjs';

export async function runTestFlow(command,env=process.env,args=process.argv) {
  const config=loadConfig(env),issuer=env.SIFEN_TEST_ISSUER;
  if(!issuer)throw new Error('SIFEN_TEST_ISSUER_REQUIRED');
  const {fiscalSubjectId}=resolveSubject(config,issuer);
  // Dry run is isolated in memory: it cannot leave a queued submission for a running worker.
  const repo=new FiscalRepository(command==='build-document'?':memory:':config.dbPath);
  const service=new FiscalService(config,repo);
  try {
    const spec=checkLocalSpec(),ready=await service.readiness(issuer);
    console.log(JSON.stringify({environment:'test',transport:config.transport,spec,readiness:ready}));
    if(command==='preflight')return ready;
    if(!['build-document','submit-fixture'].includes(command))throw new Error('COMMAND_INVALID');
    if(!ready.ready)throw new Error('PREFLIGHT_NOT_READY');
    if(command==='submit-fixture' && (config.transport!=='dnit-test'||!args.includes('--allow-test-submit')))throw new Error('EXPLICIT_TEST_SUBMISSION_FLAG_REQUIRED');
    if(!env.SIFEN_TEST_FIXTURE_PATH)throw new Error('SIFEN_TEST_FIXTURE_PATH_REQUIRED');
    const document=JSON.parse(readFileSync(env.SIFEN_TEST_FIXTURE_PATH,'utf8'));
    if(document.issuerNodeId!==issuer||document.authority!==issuer||document.simulation!==true||document.nonTradable!==true)throw new Error('EXPLICIT_TEST_FIXTURE_REQUIRED');
    const p={issuerNodeId:issuer,commercialDocumentId:document.documentId,revision:document.revision,documentHash:hash(document),document};
    const draft=repo.saveDraft(p,fiscalSubjectId,'server:test-operator');
    let row=await service.issue(draft,'server:test-operator');
    if(row.state==='DRAFT')await service.worker.tick();
    row=repo.get(issuer,document.documentId,document.revision);
    if(!row.signed_xml)throw new Error('DOCUMENT_BUILD_FAILED');
    const build=repo.db.prepare('SELECT validation FROM fiscal_builds WHERE document=?').get(row.id);
    if(command==='build-document') {
      if(!env.SIFEN_TEST_ARTIFACT_DIR)throw new Error('PRIVATE_ARTIFACT_DIRECTORY_REQUIRED');
      const directory=path.resolve(env.SIFEN_TEST_ARTIFACT_DIR,`dryrun-${Date.now()}`);mkdirSync(directory,{recursive:true,mode:0o700});
      for(const [name,contents] of [['commercial.json',JSON.stringify(document,null,2)],['signed.xml',row.signed_xml],['validation.json',build.validation],['cdc.txt',row.cdc],['preview.pdf',await service.kude(row,true)]])writeFileSync(path.join(directory,name),contents,{mode:0o600,flag:'wx'});
      console.log(JSON.stringify({dryRun:true,sent:false,artifactDirectory:directory}));return {state:row.state,sent:false};
    }
    console.log(JSON.stringify({issuer,environment:'TEST',documentType:'1',number:row.number,cdc:row.cdc,amount:document.totals.total,receiverRef:document.buyerRef}));
    // Submit once, persist the receipt/uncertain state, and let the existing
    // server worker reconcile in the background. A CLI timeout never resends a CDC.
    if(row.state==='SIGNED')await service.worker.tick();
    row=repo.get(issuer,document.documentId,document.revision);
    const result=service.projection(row);
    console.log(JSON.stringify({state:result.state,resultCode:result.resultCode,kudeAvailable:result.kudeAvailable,
      reconciliation:'existing-server-worker',secondCDC:false}));
    return result;
  }finally{await service.stop();repo.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await runTestFlow(process.argv[2]);if(result.ready===false||result.state==='UNKNOWN')process.exitCode=1;}
  catch(error){console.error(JSON.stringify({error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'TEST_FLOW_FAILED'}));process.exitCode=1;}
}
