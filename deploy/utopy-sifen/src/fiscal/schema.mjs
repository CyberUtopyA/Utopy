import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateXML } from 'xmllint-wasm';
import { createHash } from 'node:crypto';
const root = new URL('../../official/', import.meta.url);
export async function validateOfficialXML(xml) {
  if (typeof xml !== 'string' || xml.length > 2000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML_UNSAFE');
  const lock = JSON.parse(await readFile(new URL('sifen-spec.lock.json', root), 'utf8'));
  const schemas = await Promise.all(lock.resources.map(async r => {
    const bytes = await readFile(new URL(r.file, root));
    if (createHash('sha256').update(bytes).digest('hex') !== r.sha256) throw new Error('SPEC_INTEGRITY');
    // Resolve pinned imports in WASM memory only; the official files remain byte-identical on disk.
    const contents = bytes.toString('utf8').replace(/schemaLocation\s*=\s*(["'])(.*?)\1/g,
      (_, quote, location) => `schemaLocation=${quote}${path.posix.basename(location)}${quote}`);
    return { fileName: r.file, contents };
  }));
  return validateXML({ xml: [{ fileName: 'document.xml', contents: xml }],
    schema: [schemas.find(s => s.fileName === 'siRecepDE_v150.xsd')], preload: schemas });
}
