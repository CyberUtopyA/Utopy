import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function checkLocalSpec() {
  const root=new URL('../../official/',import.meta.url);
  const lock=JSON.parse(readFileSync(new URL('sifen-spec.lock.json',root),'utf8'));
  const matrix=JSON.parse(readFileSync(new URL('nt-p0-matrix.json',root),'utf8'));
  if (lock.manualVersion!=='150' || !lock.resources?.length || lock.wsdlRefs?.length!==3) throw new Error('SPEC_INVALID');
  const names=new Set(lock.resources.map(r=>r.file));
  for(const resource of [...lock.resources,...(lock.referenceResources||[])]) {
    if(!/^[\w.-]+$/.test(resource.file))throw new Error('SPEC_PATH_INVALID');
    const bytes=readFileSync(new URL(resource.file,root));
    if(createHash('sha256').update(bytes).digest('hex')!==resource.sha256)throw new Error('SPEC_INTEGRITY');
    if(resource.file.endsWith('.xsd'))for(const match of bytes.toString().matchAll(/schemaLocation\s*=\s*["']([^"']+)/g)) {
      const name=new URL(match[1],resource.sourceUrl).pathname.split('/').pop();
      if(!names.has(name))throw new Error('SPEC_IMPORT_MISSING');
    }
  }
  return {integrity:true,conformanceComplete:lock.conformanceComplete===true,wsdlVerified:lock.wsdlVerified===true,ntP0Unreviewed:Number(matrix.unreviewed||0),manualVersion:lock.manualVersion};
}
