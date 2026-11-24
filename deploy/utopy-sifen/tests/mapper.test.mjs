import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { mapDE, escapeXML } from '../src/fiscal/mapper.mjs';
import { signDE } from '../src/fiscal/signature.mjs';
import { fiscalQR } from '../src/fiscal/qr.mjs';
import { validateOfficialXML } from '../src/fiscal/schema.mjs';
import { fiscalFixture, documentFixture, syntheticCertificate } from './fixtures.mjs';
import { buildCDC } from '../src/fiscal/cdc.mjs';
const reservation = { cdc:buildCDC({documentType:1,ruc:'44444401',rucDV:7,establishment:1,point:1,number:14528,contributorType:2,date:'2026-09-13',emissionType:1,securityCode:'587326098'}),establishment:'001',point:'001',number:14528,signedAt:'2026-09-13T09:35:17' };
test('deterministic mapper refuses missing taxes, currencies and unidentified buyer', () => {
  const d = structuredClone(documentFixture); delete d.lines[0].tax;
  assert(mapDE(d,fiscalFixture,reservation).missingFields.includes('lines.0.explicitTax'));
  assert(mapDE({...documentFixture,currency:'BRL'},fiscalFixture,reservation).missingFields.includes('supportedCurrency.PYG'));
  assert(mapDE(documentFixture,{...fiscalFixture,receiver:{}},reservation).missingFields.length);
  assert.deepEqual(mapDE(documentFixture,fiscalFixture,reservation),mapDE(documentFixture,fiscalFixture,reservation));
});
test('P0 transaction code follows explicit goods/service/mixed lines, not issuer defaults',()=>{
  for(const [line,code] of [[documentFixture.lines[0],'2'],[documentFixture.lines[1],'1']]) {
    const document={...documentFixture,lines:[line],totals:{total:line.total}};
    const result=mapDE(document,fiscalFixture,reservation);
    assert.deepEqual(result.missingFields,[]);
    assert.match(result.unsignedXML,new RegExp(`<iTipTra>${code}</iTipTra>`));
  }
  assert.match(mapDE(documentFixture,fiscalFixture,reservation).unsignedXML,/<iTipTra>3<\/iTipTra>/);
  assert(mapDE({...documentFixture,lines:[{...documentFixture.lines[0],type:'other'}]},fiscalFixture,reservation).missingFields.includes('lines.0.supportedType'));
});
test('mapped DE + XMLDSig + QR validates with pinned official XSD (simulation only)', async () => {
  const model = mapDE(documentFixture,fiscalFixture,reservation);
  assert.deepEqual(model.missingFields,[]);
  const signed = signDE(model.unsignedXML,syntheticCertificate());
  const doc = new DOMParser().parseFromString(signed,'text/xml');
  const digestValue = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','DigestValue')[0].textContent;
  const qr = fiscalQR({cdc:reservation.cdc,issuedAt:reservation.signedAt,recipientType:'dNumIDRec',recipientId:'1234567',total:model.total,vat:model.vat,itemCount:model.itemCount,digestValue,cscId:'0001'},'ABCD0000000000000000000000000000');
  const xml = signed.replace('</rDE>',`<gCamFuFD><dCarQR>${escapeXML(qr)}</dCarQR></gCamFuFD></rDE>`);
  const result = await validateOfficialXML(xml);
  assert.equal(result.valid,true,result.errors.map(e=>e.message).join('\n'));
});
