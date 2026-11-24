import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { hash } from '../auth.mjs';
import { resolveSubject } from '../config.mjs';
import { buildCDC,securityCode } from './cdc.mjs';
import { mapDE,escapeXML } from './mapper.mjs';
import { validateOfficialXML } from './schema.mjs';
import { signDE,verifyDE } from './signature.mjs';
import { fiscalQR } from './qr.mjs';
import { FilesystemCertificateProvider,FilesystemCscProvider } from './providers.mjs';
import { SifenTransport } from './transport.mjs';
import { FiscalWorker } from './worker.mjs';
import { fiscalProjection } from './outcome.mjs';
import { renderKude } from './kude.mjs';
import { MockSifenTransport } from './mockTransport.mjs';
import { checkLocalSpec } from './spec.mjs';
import { fiscalDateTime } from './date.mjs';

export class FiscalService {
  constructor(config,repository,{certificateProvider,cscProvider,transportFactory,now=Date.now}={}) {
    this.config=config;this.repo=repository;this.now=now;
    this.certificates=certificateProvider||new FilesystemCertificateProvider(config);
    this.csc=cscProvider||new FilesystemCscProvider(config);
    this.transportFactory=transportFactory||((subject,credentials)=>this.mode()==='mock'?new MockSifenTransport(config.mockScenario):new SifenTransport(subject,credentials));
    this.specHash=hash(readFileSync(new URL('../../official/sifen-spec.lock.json',import.meta.url),'utf8'));
    this.worker=new FiscalWorker(repository,{build:row=>this.build(row),transportFor:row=>this.transport(row),now});
  }
  mode(){return this.config.transport||'dnit-test';}
  async transport(row) {
    const {subject,fiscalSubjectId}=resolveSubject(this.config,row.issuer);
    if(fiscalSubjectId!==row.subject)throw new Error('SUBJECT_MAPPING_CHANGED');
    return this.transportFactory(subject,await this.certificates.get(row.issuer,'mtls'));
  }
  async readiness(issuer) {
    const blockers=[];
    if(!this.config.enabled)blockers.push('TEST_NOT_ENABLED');
    try {
      const spec=checkLocalSpec();
      if(this.mode()==='dnit-test' && !spec.conformanceComplete)blockers.push('SPEC_CONFORMANCE_INCOMPLETE');
      const {subject}=resolveSubject(this.config,issuer);
      if(!subject.numbering || !subject.fiscal)blockers.push('FISCAL_CONFIG_MISSING');
      await this.certificates.get(issuer,'signature');await this.csc.get(issuer);
      if(this.mode()==='dnit-test') {
        const transport=this.transportFactory(subject,await this.certificates.get(issuer,'mtls'));
        for(const kind of ['submit','batch','document'])await transport.client(kind);
      }
    }catch{blockers.push('CERT_CSC_OR_TRANSPORT_NOT_READY');}
    return {ready:!blockers.length,blockers,status:blockers.length?'attention':'ready-test',environment:'test',simulation:this.mode()==='mock',productionEnabled:false};
  }
  async issue(row,keyId) {
    if(row.environment!=='test')throw new Error('ENVIRONMENT_INVALID');
    const {subject,fiscalSubjectId}=resolveSubject(this.config,row.issuer);
    if(row.subject!==fiscalSubjectId)throw new Error('SUBJECT_MAPPING_CHANGED');
    if(row.number!==null)return row;
    const ready=await this.readiness(row.issuer);
    if(!ready.ready)throw new Error('SIFEN_NOT_READY');
    const document=JSON.parse(row.snapshot);
    const receiver=subject.receivers?.[document.buyerRef];
    if(!receiver)throw new Error('RECEIVER_NOT_CONFIGURED');
    // Only mapper input fields are snapshotted: no secret refs, keys or passwords.
    const fiscal=Object.fromEntries(['emitter','operation','timbrado','payment','unitLabels','taxLabels','documentTypeLabel','conditionLabel'].map(key=>[key,subject.fiscal[key]]));
    fiscal.receiver=receiver;
    const numbering=subject.numbering;
    const signedAt=fiscalDateTime(new Date(this.now()).toISOString());
    const makeCDC=number=>buildCDC({documentType:1,ruc:fiscal.emitter.dRucEm,rucDV:fiscal.emitter.dDVEmi,
      establishment:numbering.establishment,point:numbering.point,number,contributorType:fiscal.emitter.iTipCont,
      date:fiscalDateTime(document.issuedAt).slice(0,10),emissionType:1,securityCode:securityCode(number)});
    const validation=mapDE(document,fiscal,{cdc:makeCDC(numbering.startNumber),establishment:numbering.establishment,point:numbering.point,number:numbering.startNumber,signedAt});
    if(validation.missingFields.length)throw Object.assign(new Error('MISSING_FIELDS'),{missingFields:validation.missingFields});
    const reserved=this.repo.reserve(row,numbering,makeCDC,{fiscal,signedAt,specHash:this.specHash,transport:this.mode()});
    this.repo.db.prepare('INSERT INTO audit(document,actor_key,action,at,adapter_version) VALUES(?,?,?,?,?)').run(row.id,keyId,'issue.requested',this.now(),'0.1.0');
    return reserved;
  }
  async build(row) {
    const saved=this.repo.db.prepare('SELECT * FROM fiscal_builds WHERE document=?').get(row.id);
    if(!saved || saved.spec_hash!==this.specHash || saved.transport!==this.mode())throw new Error('BUILD_CONTEXT_CHANGED');
    const document=JSON.parse(row.snapshot),fiscal=JSON.parse(saved.config_snapshot);
    const model=mapDE(document,fiscal,{cdc:row.cdc,establishment:row.establishment,point:row.point,number:row.number,signedAt:saved.signed_at});
    if(model.missingFields.length)throw new Error('MAPPER_INVALID');
    const certificate=await this.certificates.get(row.issuer,'signature');
    let xml=signDE(model.unsignedXML,certificate);
    const dom=new DOMParser().parseFromString(xml,'text/xml');
    const digestValue=dom.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','DigestValue')[0].textContent;
    const csc=await this.csc.get(row.issuer),rec=fiscal.receiver;
    const qr=fiscalQR({cdc:row.cdc,issuedAt:fiscalDateTime(document.issuedAt),recipientType:rec.dRucRec?'dRucRec':'dNumIDRec',recipientId:rec.dRucRec||rec.dNumIDRec,total:model.total,vat:model.vat,itemCount:model.itemCount,digestValue,cscId:csc.id},csc.value);
    xml=xml.replace('</rDE>',`<gCamFuFD><dCarQR>${escapeXML(qr)}</dCarQR></gCamFuFD></rDE>`);
    const validation=await validateOfficialXML(xml);
    this.repo.db.prepare('UPDATE fiscal_builds SET unsigned_xml=?,validation=?,qr=? WHERE document=?').run(model.unsignedXML,JSON.stringify({valid:validation.valid,signatureValid:verifyDE(xml,certificate.cert),specHash:this.specHash}),qr,row.id);
    if(!validation.valid || !verifyDE(xml,certificate.cert))throw new Error('FINAL_XML_INVALID');
    return {xml,hash:hash(xml)};
  }
  projection(row){return {...fiscalProjection(row,this.mode()),outcome:this.repo.outcome(row)};}
  async kude(row,preview=false){return renderKude(row,{preview,simulation:this.mode()==='mock'});}
  start(){this.stopWorker=this.worker.start();}
  async stop(){this.stopWorker?.();while(this.worker.busy)await new Promise(resolve=>setTimeout(resolve,25));}
}
