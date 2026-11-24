import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkLocalSpec } from '../src/fiscal/spec.mjs';
const root = fileURLToPath(new URL('../official/', import.meta.url));
const lockPath = path.join(root, 'sifen-spec.lock.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const base = 'https://ekuatia.set.gov.py/sifen/xsd/';
async function download(url) {
  // The official portal and /sifen static resources use different upstreams;
  // avoid retaining an upstream connection across resource families.
  const response = await fetch(url, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Resource HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
if (process.argv[2] === 'import-consde') {
  // Incremental official schema import; preserve the existing manual/NT lock.
  const file='WS_SiConsDE_v141.xsd',sourceUrl=base+file;
  const data=await download(sourceUrl),xml=data.toString('utf8');
  if(!/<(?:\w+:)?schema\b/.test(xml))throw new Error('Official resource is not XSD');
  const imports=[...xml.matchAll(/schemaLocation\s*=\s*["']([^"']+)/g)].map(m=>new URL(m[1],sourceUrl).href.replace(/^http:/,'https:'));
  const lock=JSON.parse(await readFile(lockPath,'utf8'));
  if(imports.some(url=>!lock.resources.some(resource=>resource.sourceUrl===url)))throw new Error('SPEC_IMPORT_MISSING');
  await writeFile(path.join(root,file),data);
  lock.resources=lock.resources.filter(resource=>resource.file!==file);
  lock.resources.push({file,sourceUrl,sha256:sha(data),retrievedAt:new Date().toISOString(),imports,namespace:xml.match(/targetNamespace\s*=\s*["']([^"']+)/)?.[1]||null});
  await writeFile(lockPath,JSON.stringify(lock,null,2)+'\n');
  console.log('Pinned official siConsDE schema. WSDL verification remains separate.');
} else if (process.argv[2] === 'import') {
  // Explicit development operation. Never invoked at startup or by check.
  await mkdir(root, { recursive: true });
  const queue = ['siRecepDE_v150.xsd', 'WS_SiRecepLoteDE_v141.xsd', 'WS_SiConsLote_v141.xsd', 'WS_SiConsDTE.xsd'].map(n => base + n);
  const resources = [];
  const seen = new Set();
  while (queue.length) {
    const sourceUrl = queue.shift();
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const url = new URL(sourceUrl);
    if (url.hostname !== 'ekuatia.set.gov.py' || !url.pathname.startsWith('/sifen/xsd/')) throw new Error('Unexpected schema origin');
    const data = await download(sourceUrl);
    const xml = data.toString('utf8');
    if (!/<(?:\w+:)?schema\b/.test(xml)) throw new Error('Official resource is not XSD');
    const file = path.basename(url.pathname);
    await writeFile(path.join(root, file), data);
    const imports = [...xml.matchAll(/schemaLocation\s*=\s*["']([^"']+)/g)].map(m => new URL(m[1], sourceUrl).href.replace(/^http:/, 'https:'));
    queue.push(...imports);
    resources.push({ file, sourceUrl, sha256: sha(data), retrievedAt: new Date().toISOString(), imports,
      namespace: xml.match(/targetNamespace\s*=\s*["']([^"']+)/)?.[1] || null });
  }
  await writeFile(lockPath, JSON.stringify({ manualVersion: '150', technicalNotesReviewed: [], technicalNotesApplied: [],
    conformanceComplete: false, wsdlVerified: false, resources,
    manualUrl: 'https://ekuatia.set.gov.py/en/web/e-kuatia/documentacion-tecnica',
    wsdlRefs: ['https://sifen-test.set.gov.py/de/ws/async/recibe-lote.wsdl?wsdl', 'https://sifen-test.set.gov.py/de/ws/consultas/consulta-lote.wsdl?wsdl', 'https://sifen-test.set.gov.py/de/ws/consultas/consulta.wsdl?wsdl'] }, null, 2) + '\n');
  console.log(`Imported ${resources.length} official schemas. Conformance remains blocked.`);
} else {
  checkLocalSpec();
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  let changed = false;
  for (const r of [...lock.resources, ...(lock.referenceResources || [])]) {
    try {
      if (sha(await readFile(path.join(root, r.file))) !== r.sha256 || (process.argv.includes('--remote') && sha(await download(r.sourceUrl)) !== r.sha256)) {
        changed = true; console.error(`Resource changed: ${r.file}`);
      }
    } catch { changed = true; console.error(`Could not verify official resource: ${r.file}`); }
  }
  process.exitCode = changed ? 1 : 0;
  console.log(changed ? 'Review required; nothing updated.' : 'Pinned resource integrity OK. Fiscal conformance and unprovisioned WSDL remain separate checks. Use --remote for explicit online comparison.');
}
