import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { resolveSubject } from '../config.mjs';
import { loadCertificate } from './signature.mjs';
export function privateRef(root, ref) {
  if(!root || !ref || !path.isAbsolute(ref)) throw new Error('SECRET_REF_INVALID');
  const base=realpathSync(root), target=realpathSync(ref), relative=path.relative(base,target);
  if(!relative || relative==='..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)) throw new Error('SECRET_REF_OUTSIDE_ROOT');
  return target;
}
export class FiscalCertificateProvider { get(){throw new Error('CERT_PROVIDER_NOT_IMPLEMENTED');} }
export class FilesystemCertificateProvider extends FiscalCertificateProvider {
  constructor(config){super();this.config=config;}
  get(issuerNodeId,usage='signature') {
    const {subject}=resolveSubject(this.config,issuerNodeId);
    const fields=usage==='mtls' && subject.mtls?{...subject,...subject.mtls}:subject;
    const checked={...fields};
    for(const f of ['certificateRef','privateKeyRef','passwordRef'])if(fields[f])checked[f]=privateRef(subject.secretRoot,fields[f]);
    return loadCertificate(checked);
  }
}
export class FiscalCscProvider { get(){throw new Error('CSC_PROVIDER_NOT_IMPLEMENTED');} }
export class FilesystemCscProvider extends FiscalCscProvider {
  constructor(config){super();this.config=config;}
  get(issuerNodeId) {
    const {subject}=resolveSubject(this.config,issuerNodeId);
    const csc=readFileSync(privateRef(subject.secretRoot,subject.cscRef),'utf8').trim();
    if(!/^\d{4}$/.test(subject.cscId||'') || !/^[A-Za-z0-9]{32}$/.test(csc))throw new Error('CSC_INVALID');
    return {id:subject.cscId,value:csc};
  }
}
