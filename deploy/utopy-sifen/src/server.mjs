import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.mjs';
import { authenticate, canonical, hash } from './auth.mjs';
import { FiscalRepository } from './fiscal/repository.mjs';
import { validateCommercial } from './fiscal/decimal.mjs';
import { FiscalService } from './fiscal/service.mjs';
import { checkLocalSpec } from './fiscal/spec.mjs';

export function createFiscalServer(config, repository, service = new FiscalService(config,repository)) {
  const key = config.adapterKeyPath ? createPrivateKey(readFileSync(config.adapterKeyPath)) : null;
  const spec = JSON.parse(readFileSync(new URL('../official/sifen-spec.lock.json', import.meta.url), 'utf8'));
  function attest(payload, requestNonce) {
    if (!key) throw new Error('ADAPTER_NOT_CONFIGURED');
    const body = { payload, requestNonce, issuedAt: Date.now(), adapterAuthority: 'utopy.sifen.sidecar/0.1.0' };
    return { ...body, signature: sign('sha256', Buffer.from(canonical(body)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url') };
  }
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin)) { res.writeHead(403); res.end(); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.writeHead(204); res.end(); return;
    }
    const respond = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/ready')) {
      const workerReady=Boolean(service.worker.timer);
      let databaseReady=false;try{repository.db.prepare('SELECT 1').get();databaseReady=true;}catch{}
      let specReady=false;try{specReady=checkLocalSpec().integrity;}catch{}
      let transportReady=false;
      try{const issuers=Object.keys(config.nodes);const checks=await Promise.all(issuers.map(issuer=>service.readiness(issuer)));transportReady=checks.length>0&&checks.every(check=>check.ready);}catch{}
      const ok=workerReady&&databaseReady&&specReady&&transportReady&&Boolean(key);
      respond(req.url==='/ready' && !ok?503:200, { ok,environment: 'test', databaseReady, workerReady, specReady, transportReady, officialVersion: spec.manualVersion,
        configured: Boolean(key), conformanceComplete: spec.conformanceComplete===true, productionEnabled: false }); return;
    }
    if (req.method !== 'POST' || req.url !== '/v1/request') { respond(404, { error: 'NOT_FOUND' }); return; }
    try {
      if (!key) { respond(503, { error: 'ADAPTER_NOT_CONFIGURED' }); return; }
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 250000) throw new Error('REQUEST_TOO_LARGE'); chunks.push(chunk); }
      const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const auth = authenticate(request, config);
      const p = auth.payload;
      repository.consumeNonce(p, hash(p));
      if (p.action === 'settings.read') {
        respond(200, attest({...await service.readiness(p.issuerNodeId),mode:auth.node.mode||'sifen'},p.nonce));return;
      }
      if (p.action === 'document.save') {
        const validation = validateCommercial(p.document);
        if (validation.missingFields.length) { respond(422, attest({ error: 'MISSING_FIELDS', missingFields: validation.missingFields }, p.nonce)); return; }
        repository.saveDraft(p, auth.fiscalSubjectId, auth.keyId);
      } else if (p.action === 'document.submit') {
        // Auth and revision binding are checked before any reservation or network action.
      } else if (!['document.status','document.kude','document.preview'].includes(p.action)) throw new Error('ACTION_NOT_ALLOWED');
      let row = repository.get(p.issuerNodeId, p.commercialDocumentId, p.revision);
      if (!row) { respond(404, attest({ error: 'DOCUMENT_NOT_FOUND' }, p.nonce)); return; }
      if (row.hash !== p.documentHash) throw new Error('REVISION_CONFLICT');
      if(p.action==='document.submit') {
        try{row=await service.issue(row,auth.keyId);}catch(e){respond(409,attest({error:'SIFEN_NOT_READY',missingFields:e.missingFields||['fiscalConfiguration']},p.nonce));return;}
      }
      const projection=service.projection(row);
      if(p.action==='document.kude'||p.action==='document.preview') {
        const pdf=await service.kude(row,p.action==='document.preview');
        respond(200,attest({...projection,download:{mimeType:'application/pdf',filename:'kude-test.pdf',base64:pdf.toString('base64')}},p.nonce));return;
      }
      respond(200, attest(projection, p.nonce));
    } catch (e) {
      const allowed = new Set(['AUTH_INVALID', 'ISSUER_NOT_CONFIGURED', 'DOCUMENT_BINDING_INVALID', 'REPLAY_REJECTED', 'REVISION_CONFLICT', 'ACTION_NOT_ALLOWED', 'REQUEST_TOO_LARGE']);
      const code = allowed.has(e.message) ? e.message : 'REQUEST_REJECTED';
      // No request body, XML, certificate, buyer, RUC or raw exceptions in logs.
      console.warn(JSON.stringify({ event: 'fiscal.request.rejected', code }));
      respond(code === 'REVISION_CONFLICT' ? 409 : 403, { error: code });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const repo = new FiscalRepository(config.dbPath);
  const service=new FiscalService(config,repo);
  const server = createFiscalServer(config, repo,service);
  service.start();
  server.requestTimeout = 15000;
  server.listen(config.port, config.host, () => console.log(JSON.stringify({ event: 'fiscal.started', environment: 'test', transport:config.transport, readinessEndpoint:'/ready',productionEnabled:false })));
  const stop = () => server.close(async () => { await service.stop();repo.close(); process.exit(0); });
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
