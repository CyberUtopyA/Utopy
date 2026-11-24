import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../official/',import.meta.url);
const lock=JSON.parse(await readFile(new URL('sifen-spec.lock.json',root),'utf8'));
const portal='https://ekuatia.set.gov.py/en/web/e-kuatia/documentacion-tecnica';
const html=await (await fetch(portal)).text();
const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1].replace(/&amp;/g,'&'),portal).href);
const notes=[...new Set(links.filter(u=>/NT_E_KUATIA_\d{3}_MT_V150/i.test(decodeURIComponent(u))))];
const references=[];
for(const sourceUrl of notes) {
  const number=decodeURIComponent(sourceUrl).match(/NT_E_KUATIA_(\d{3})/i)[1];
  const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`NT${number} download failed`);
  const data=Buffer.from(await response.arrayBuffer());
  if(!data.subarray(0,4).equals(Buffer.from('%PDF')))throw new Error(`NT${number} is not PDF`);
  const file=`NT${number}.pdf`;await writeFile(new URL(file,root),data);
  references.push({file,sourceUrl,sha256:createHash('sha256').update(data).digest('hex'),retrievedAt:new Date().toISOString()});
}
const manual=await readFile(new URL('manual-v150.pdf',root));
references.push({file:'manual-v150.pdf',sourceUrl:'https://ekuatia.set.gov.py/documents/20123/420592/Manual%2BT%C3%A9cnico%2BVersi%C3%B3n%2B150.pdf/e706f7c7-6d93-21d4-b45b-5d22d07b2d22?t=1687362295907.pdf',sha256:createHash('sha256').update(manual).digest('hex'),retrievedAt:new Date().toISOString()});
lock.referenceResources=references;
lock.technicalNotesAvailable=notes.map(u=>decodeURIComponent(u).match(/NT_E_KUATIA_(\d{3})/i)[1]).sort();
lock.technicalNotesApplied=[]; // Download is not a conformance review.
await writeFile(new URL('sifen-spec.lock.json',root),JSON.stringify(lock,null,2)+'\n');
console.log(`Pinned ${references.length} references. Manual/NT conformance is not declared.`);
