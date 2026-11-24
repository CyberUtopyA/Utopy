import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';

/** Offline closure: imports may resolve only to individually pinned operator-provisioned resources. */
export function pinnedWsdl(contract) {
  const resources = [contract, ...(contract.imports || [])];
  const byURL = new Map(), byPath = new Map();
  for (const resource of resources) {
    const source = new URL(resource.sourceUrl);
    if (source.protocol !== 'https:' || !['sifen-test.set.gov.py', 'ekuatia.set.gov.py'].includes(source.hostname)) throw new Error('WSDL_ORIGIN_INVALID');
    const local = realpathSync(resource.path), bytes = readFileSync(local);
    if (bytes.length > 3000000 || createHash('sha256').update(bytes).digest('hex') !== resource.sha256) throw new Error('WSDL_INTEGRITY');
    const xml = bytes.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('WSDL_UNSAFE');
    let invalid = false;
    const dom = new DOMParser({ errorHandler: { warning(){}, error(){invalid=true;}, fatalError(){invalid=true;} } }).parseFromString(xml,'text/xml');
    if (invalid || !['definitions','schema'].includes(dom.documentElement.localName)) throw new Error('WSDL_INTEGRITY');
    if (byURL.has(source.href) || byPath.has(local)) throw new Error('WSDL_DUPLICATE_RESOURCE');
    const entry = { source:source.href, local, dom };
    byURL.set(source.href,entry); byPath.set(local,entry);
  }
  for (const entry of byURL.values()) for (const element of Array.from(entry.dom.getElementsByTagName('*'))) {
    if (!['import','include','redefine'].includes(element.localName)) continue;
    const location = element.getAttribute('schemaLocation') || element.getAttribute('location');
    if (location && !byURL.has(new URL(location,entry.source).href.replace(/^http:/,'https:'))) throw new Error('WSDL_IMPORT_NOT_PINNED');
  }
  const root = byPath.get(realpathSync(contract.path));
  if (root.dom.documentElement.namespaceURI !== 'http://schemas.xmlsoap.org/wsdl/') throw new Error('WSDL_INTEGRITY');
  const addresses = Array.from(root.dom.getElementsByTagNameNS('http://schemas.xmlsoap.org/wsdl/soap12/','address'));
  if (!addresses.length || addresses.some(e => {const u=new URL(e.getAttribute('location'));return u.protocol!=='https:'||u.hostname!=='sifen-test.set.gov.py';})) throw new Error('WSDL_ENDPOINT_INVALID');
  return { path:root.local, overrideImportLocation(_resolved,parent,location) {
    let source;
    try { source=byPath.get(realpathSync(parent))?.source; } catch {}
    if (!source) throw new Error('WSDL_IMPORT_PARENT_INVALID');
    const pinned = byURL.get(new URL(location,source).href.replace(/^http:/,'https:'));
    if (!pinned) throw new Error('WSDL_IMPORT_NOT_PINNED');
    return pinned.local;
  }};
}
