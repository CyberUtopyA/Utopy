import forge from 'node-forge';
import { createPrivateKey } from 'node:crypto';
export function syntheticCertificate() {
  const pair = forge.pki.rsa.generateKeyPair(2048), cert = forge.pki.createCertificate();
  cert.publicKey = pair.publicKey; cert.serialNumber = '02';
  cert.validity.notBefore = new Date(Date.now() - 10000); cert.validity.notAfter = new Date(Date.now() + 86400000);
  cert.setSubject([{ name: 'commonName', value: 'TEST ONLY NONTRADABLE' }]); cert.setIssuer(cert.subject.attributes);
  cert.sign(pair.privateKey, forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(cert), privateKey: createPrivateKey(forge.pki.privateKeyToPem(pair.privateKey)) };
}
export const fiscalFixture = {
  emitter: { dRucEm:'44444401',dDVEmi:'7',iTipCont:'2',dNomEmi:'EMISOR SIMULACION',dDirEmi:'DIRECCION DE PRUEBAS',dNumCas:'1',cDepEmi:'1',dDesDepEmi:'CAPITAL',cCiuEmi:'1',dDesCiuEmi:'ASUNCION (DISTRITO)',dTelEmi:'021123456',dEmailE:'test@example.invalid',gActEco:[{cActEco:'47190',dDesActEco:'ACTIVIDAD DE PRUEBAS'}] },
  receiver: { iNatRec:'2',iTiOpe:'2',cPaisRec:'PRY',dDesPaisRe:'Paraguay',iTipIDRec:'1',dDTipIDRec:'Cédula paraguaya',dNumIDRec:'1234567',dNomRec:'RECEPTOR DE PRUEBAS' },
  operation: { iTipTra:'3',dDesTipTra:'Mixto (Venta de mercadería y servicios)',iTImp:'1',dDesTImp:'IVA',dDesMoneOpe:'Guarani',iIndPres:'2',dDesIndPres:'Operación electrónica' },
  timbrado: { dNumTim:'12345678',dFeIniT:'2026-01-01' }, payment: { iTiPago:'1',dDesTiPag:'Efectivo' },
  unitLabels: { '77':'UNI' }, taxLabels: { '1':'Gravado IVA' }, documentTypeLabel:'Factura electrónica',conditionLabel:'Contado',
};
export const documentFixture = {
  documentId:'test:work:1',revision:1,issuerNodeId:'test:issuer',authority:'test:issuer',issuedAt:'2026-09-13T09:35:17-03:00',currency:'PYG',
  commercialCondition:{type:'cash'},sourceRefs:[{id:'test:work',kind:'work.outcome'}],paymentRefs:[],simulation:true,nonTradable:true,
  lines:[{lineId:'labor',type:'labor',description:'Instalación de 2 tomacorrientes',quantity:'1',unitPrice:'180000',total:'180000',unitCode:'77',tax:{affectation:'1',proportion:'100',rate:'10'}},
    {lineId:'material',type:'material',description:'Materiales de prueba',quantity:'1',unitPrice:'95000',total:'95000',unitCode:'77',tax:{affectation:'1',proportion:'100',rate:'10'}}],
  totals:{total:'275000'},
};
