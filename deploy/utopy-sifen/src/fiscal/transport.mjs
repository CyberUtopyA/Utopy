import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClientAsync } from 'soap';
import { zipSync, strToU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import { pinnedWsdl } from './wsdl.mjs';
const NS = 'http://ekuatia.set.gov.py/sifen/xsd';
const SOAP = 'http://www.w3.org/2003/05/soap-envelope';
export const TEST_WSDL = Object.freeze({
  submit: 'https://sifen-test.set.gov.py/de/ws/async/recibe-lote.wsdl?wsdl',
  batch: 'https://sifen-test.set.gov.py/de/ws/consultas/consulta-lote.wsdl?wsdl',
  document: 'https://sifen-test.set.gov.py/de/ws/consultas/consulta.wsdl?wsdl',
});
function parse(xml) {
  if (typeof xml !== 'string' || xml.length > 3000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RESPONSE_MALFORMED');
  let error = false;
  const d = new DOMParser({errorHandler:{warning(){},error(){error=true;},fatalError(){error=true;}}}).parseFromString(xml,'text/xml');
  if (error || d.documentElement.namespaceURI !== SOAP || d.getElementsByTagNameNS(SOAP,'Fault').length) throw new Error('RESPONSE_MALFORMED');
  return d;
}
const one = (node, name) => { const a=node.getElementsByTagNameNS(NS,name); return a.length===1 ? a[0].textContent.trim() : null; };
export function parseSifenResponse(raw, cdc, operation) {
  const doc = parse(raw);
  if (operation === 'submit') {
    const roots=doc.getElementsByTagNameNS(NS,'rResEnviLoteDe'); if(roots.length!==1) throw new Error('RESPONSE_MALFORMED');
    const code=one(roots[0],'dCodRes'), batchId=one(roots[0],'dProtConsLote');
    if(code==='0300' && /^\d{1,28}$/.test(batchId||'')) return {state:'PROCESSING',code,batchId};
    // A batch rejection is not a fiscal rejection of this DE. Do not blindly resubmit.
    return {state:'UNKNOWN',code:code||'UNRECOGNIZED'};
  }
  const roots=doc.getElementsByTagNameNS(NS,'rResEnviConsLoteDe');
  if(roots.length===1) {
    const code=one(roots[0],'dCodResLot');
    if(code==='0361') return {state:'PROCESSING',code};
    if(code!=='0362') return {state:'UNKNOWN',code:code||'UNRECOGNIZED'};
    const matches=Array.from(roots[0].getElementsByTagNameNS(NS,'gResProcLote')).filter(n=>one(n,'id')===cdc);
    if(matches.length!==1) throw new Error('RESPONSE_CDC_MISMATCH');
    const status=one(matches[0],'dEstRes'), codes=Array.from(matches[0].getElementsByTagNameNS(NS,'dCodRes')).map(n=>n.textContent.trim());
    if(!codes.length || codes.some(c=>!/^\d{4}$/.test(c))) throw new Error('RESPONSE_MALFORMED');
    if(['Aprobado','Aprobado con observación'].includes(status)) return {state:'ACCEPTED',code:codes.join(','),processedAt:one(roots[0],'dFecProc')};
    if(status==='Rechazado') return {state:'REJECTED',code:codes.join(','),processedAt:one(roots[0],'dFecProc')};
  }
  if(operation==='document') {
    const responses=doc.getElementsByTagNameNS(NS,'rEnviConsDeResponse');
    if(responses.length!==1)throw new Error('RESPONSE_MALFORMED');
    const code=one(responses[0],'dCodRes');
    if(code==='0420')return {state:'UNKNOWN',code};
    if(code==='0422') {
      const content=one(responses[0],'xContenDE');
      if(!content || content.length>2500000 || /<!DOCTYPE|<!ENTITY/i.test(content))throw new Error('RESPONSE_MALFORMED');
      let invalid=false;
      const de=new DOMParser({errorHandler:{warning(){},error(){invalid=true;},fatalError(){invalid=true;}}}).parseFromString(content,'text/xml');
      const documents=de.getElementsByTagNameNS(NS,'DE');
      if(invalid || documents.length!==1 || documents[0].getAttribute('Id')!==cdc)throw new Error('RESPONSE_CDC_MISMATCH');
      return {state:'ACCEPTED',code,processedAt:one(responses[0],'dFecProc')};
    }
    return {state:'UNKNOWN',code:code||'RECONCILIATION_REQUIRED'};
  }
  // HTTP 200 or a bare status code never grants fiscal validity.
  return {state:'UNKNOWN',code:'RECONCILIATION_REQUIRED'};
}

/** Uses only operator-pinned official WSDL after mTLS retrieval/inspection, never a guessed SOAP envelope. */
export class SifenTransport {
  constructor(subject, credentials) { this.subject=subject;this.credentials=credentials;this.clients=new Map(); }
  async client(kind) {
    if(this.clients.has(kind)) return this.clients.get(kind);
    const contract=this.subject.wsdl?.[kind];
    if(!contract?.path || !contract.sha256 || !contract.service || !contract.port || !contract.operation) throw new Error('WSDL_NOT_CONFIGURED');
    const bytes=readFileSync(contract.path);
    if(createHash('sha256').update(bytes).digest('hex')!==contract.sha256 || !/<(?:\w+:)?definitions\b/.test(bytes.toString())) throw new Error('WSDL_INTEGRITY');
    const wsdl=bytes.toString('utf8');
    if(/<!DOCTYPE|<!ENTITY/i.test(wsdl)) throw new Error('WSDL_UNSAFE');
    const closure=pinnedWsdl(contract);
    const addresses=[...wsdl.matchAll(/<(?:\w+:)?address\b[^>]*location=["']([^"']+)/g)].map(m=>new URL(m[1]));
    if(!addresses.length || addresses.some(u=>u.protocol!=='https:'||u.hostname!=='sifen-test.set.gov.py')) throw new Error('WSDL_ENDPOINT_INVALID');
    const agent=new https.Agent({cert:this.credentials.cert,key:this.credentials.privateKey.export({type:'pkcs8',format:'pem'}),
      minVersion:'TLSv1.2',rejectUnauthorized:true,keepAlive:true,
      ...(this.subject.tlsCARef?{ca:readFileSync(this.subject.tlsCARef)}:{})});
    const client=await createClientAsync(closure.path,{forceSoap12Headers:true,disableCache:true,wsdl_options:{overrideImportLocation:closure.overrideImportLocation,httpsAgent:agent,timeout:30000,maxRedirects:0,maxContentLength:3000000,maxBodyLength:3000000}});
    const port=client[contract.service]?.[contract.port];
    if(typeof port?.[contract.operation]!=='function') throw new Error('WSDL_OPERATION_MISMATCH');
    const entry={port,operation:contract.operation,agent};this.clients.set(kind,entry);return entry;
  }
  async call(kind,args) {
    const {port,operation,agent}=await this.client(kind);
    return new Promise((resolve,reject)=>port[operation](args,(error,result,raw)=>{
      if(error) { reject(new Error([401,403].includes(error.response?.status)?'AUTH_ERROR':'SIFEN_TRANSPORT_UNKNOWN'));return; } resolve(raw);
    },{httpsAgent:agent,timeout:30000,maxRedirects:0,maxContentLength:3000000,maxBodyLength:3000000}));
  }
  async submit(row) {
    const xml=`<rLoteDE>${row.signed_xml}</rLoteDE>`;
    const zip=zipSync({'lote.xml':strToU8(xml)});
    if(zip.length>1000000) throw new Error('BATCH_TOO_LARGE');
    const raw=await this.call('submit',{dId:String(row.id),xDE:Buffer.from(zip).toString('base64')});
    return {...parseSifenResponse(raw,row.cdc,'submit'),raw};
  }
  async query(row) {
    // Official batch schema permits dCDC when the submission response was lost.
    const raw=await this.call('batch',{dId:String(row.id),...(row.batch_id?{dProtConsLote:row.batch_id}:{dCDC:row.cdc})});
    const result=parseSifenResponse(raw,row.cdc,'batch');
    if(result.state==='UNKNOWN') {
      const document=await this.consultDE(row);
      if(document.state==='ACCEPTED')return document;
    }
    return {...result,raw};
  }
  async consultDE(row) {
    const raw=await this.call('document',{dId:String(row.id),dCDC:row.cdc});
    return {...parseSifenResponse(raw,row.cdc,'document'),raw};
  }
}
