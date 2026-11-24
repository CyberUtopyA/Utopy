import { Money, decimal, validateCommercial } from './decimal.mjs';
import { validCDC } from './cdc.mjs';
import { fiscalDateTime } from './date.mjs';
const NS = 'http://ekuatia.set.gov.py/sifen/xsd';
export const escapeXML = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const tag = (name, value) => `<${name}>${escapeXML(value)}</${name}>`;
const group = (name, body) => `<${name}>${body}</${name}>`;
const ordered = (object, keys) => keys.filter(k => object[k] !== undefined).map(k => tag(k, object[k])).join('');
const emitterFields = ['dRucEm','dDVEmi','iTipCont','dNomEmi','dDirEmi','dNumCas','cDepEmi','dDesDepEmi','cCiuEmi','dDesCiuEmi','dTelEmi','dEmailE'];
const receiverFields = ['iNatRec','iTiOpe','cPaisRec','dDesPaisRe','iTiContRec','dRucRec','dDVRec','iTipIDRec','dDTipIDRec','dNumIDRec','dNomRec'];

/** P0 restricted deterministic mapping: invoice, PYG, cash, explicit full taxable IVA 5/10.
 * Other regimes return missingFields; never reinterpret a profession as a tax treatment.
 * Fiscal data/official labels are explicit server-side configuration, not UI copy or secrets.
 */
export function mapDE(document, fiscal, reservation) {
  const { missingFields } = validateCommercial(document);
  let issuedAt;
  try{issuedAt=fiscalDateTime(document?.issuedAt);}catch{missingFields.push('issuedAt.explicitTimezone');}
  const requireFields = (object, keys, prefix) => keys.forEach(k => { if (object?.[k] === undefined || object[k] === '') missingFields.push(`${prefix}.${k}`); });
  requireFields(fiscal?.emitter, [...emitterFields, 'gActEco'], 'emitter');
  requireFields(fiscal?.receiver, ['iNatRec','iTiOpe','cPaisRec','dDesPaisRe','dNomRec'], 'receiver');
  requireFields(fiscal?.operation, ['iTImp','dDesTImp','dDesMoneOpe','iIndPres','dDesIndPres'], 'operation');
  requireFields(fiscal?.timbrado, ['dNumTim','dFeIniT'], 'timbrado');
  requireFields(fiscal?.payment, ['iTiPago','dDesTiPag'], 'payment');
  requireFields(fiscal, ['documentTypeLabel','conditionLabel'], 'fiscal');
  if (!fiscal?.taxLabels?.['1']) missingFields.push('fiscal.taxLabels.1');
  if (!Array.isArray(fiscal?.emitter?.gActEco) || !fiscal.emitter.gActEco.length) missingFields.push('emitter.gActEco');
  if (!validCDC(reservation?.cdc || '')) missingFields.push('reservation.cdc');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(reservation?.signedAt || '')) missingFields.push('reservation.signedAt');
  if (document?.currency !== 'PYG') missingFields.push('supportedCurrency.PYG');
  if (document?.commercialCondition?.type !== 'cash') missingFields.push('supportedCondition.cash');
  if (!['1','9'].includes(String(fiscal?.payment?.iTiPago))) missingFields.push('supportedPayment.cashOrTransfer');
  if (document?.commercialCondition?.paymentMethod && document.commercialCondition.paymentMethod !== String(fiscal?.payment?.iTiPago)) missingFields.push('payment.documentBinding');
  if (fiscal?.operation?.iTImp !== '1') missingFields.push('supportedTax.IVA');
  const rec = fiscal?.receiver;
  if (rec?.iNatRec === '1') requireFields(rec, ['iTiContRec','dRucRec','dDVRec'], 'receiver');
  else if (rec?.iNatRec === '2') requireFields(rec, ['iTipIDRec','dDTipIDRec','dNumIDRec'], 'receiver');
  else missingFields.push('receiver.iNatRec');
  // No innominado support in P0; never guess NT024/NT027 conditions.
  if (rec?.iTipIDRec === '5') missingFields.push('receiver.identified');
  if (document?.totals?.discount && document.totals.discount !== '0') missingFields.push('supportedDiscountMapping');
  (document?.lines || []).forEach((line, i) => {
    if (!['product','material','service','labor','transport'].includes(line.type)) missingFields.push(`lines.${i}.supportedType`);
    if (!line.unitCode || !fiscal?.unitLabels?.[line.unitCode]) missingFields.push(`lines.${i}.unitCode`);
    if (line.tax?.affectation !== '1' || line.tax?.proportion !== '100' || !['5','10'].includes(line.tax?.rate)) missingFields.push(`lines.${i}.explicitTax`);
  });
  if (missingFields.length) return { missingFields: [...new Set(missingFields)] };
  const goods=document.lines.some(line=>['product','material'].includes(line.type));
  const services=document.lines.some(line=>['service','labor','transport'].includes(line.type));
  const transaction=goods&&services ? ['3','Mixto (Venta de mercadería y servicios)']
    : goods ? ['1','Venta de mercadería'] : ['2','Prestación de servicios'];
  const cdc = reservation.cdc;
  if (cdc.slice(2,10) !== String(fiscal.emitter.dRucEm).padStart(8,'0') || cdc[10] !== String(fiscal.emitter.dDVEmi)
    || cdc.slice(11,14) !== reservation.establishment || cdc.slice(14,17) !== reservation.point
    || cdc.slice(17,24) !== String(reservation.number).padStart(7,'0') || cdc.slice(25,33) !== issuedAt.slice(0,10).replace(/-/g,'')) return { missingFields: ['reservation.documentBinding'] };
  const totals = { '5': { gross: new Money(0), base: new Money(0), vat: new Money(0) }, '10': { gross: new Money(0), base: new Money(0), vat: new Money(0) } };
  const items = document.lines.map((line, i) => {
    const rate = line.tax.rate, gross = decimal(line.total);
    const base = gross.mul(100).div(new Money(100).plus(rate)).toDecimalPlaces(8);
    const vat = base.mul(rate).div(100).toDecimalPlaces(8);
    totals[rate].gross = totals[rate].gross.plus(gross); totals[rate].base = totals[rate].base.plus(base); totals[rate].vat = totals[rate].vat.plus(vat);
    const description = (i === 0 ? 'DOCUMENTO ELECTRÓNICO SIN VALOR COMERCIAL NI FISCAL - GENERADO EN AMBIENTE DE PRUEBA. ' : '') + line.description;
    return group('gCamItem', tag('dCodInt', line.productId || line.lineId) + tag('dDesProSer', description)
      + tag('cUniMed', line.unitCode) + tag('dDesUniMed', fiscal.unitLabels[line.unitCode]) + tag('dCantProSer', line.quantity)
      + group('gValorItem', tag('dPUniProSer', line.unitPrice) + tag('dTotBruOpeItem', line.total) + group('gValorRestaItem', tag('dTotOpeItem', line.total)))
      + group('gCamIVA', tag('iAfecIVA','1') + tag('dDesAfecIVA',fiscal.taxLabels?.['1'] || '') + tag('dPropIVA','100') + tag('dTasaIVA',rate)
        + tag('dBasGravIVA',base.toFixed()) + tag('dLiqIVAItem',vat.toFixed()) + tag('dBasExe','0')));
  }).join('');
  const total = document.totals.total, vat = totals['5'].vat.plus(totals['10'].vat).toFixed();
  const sumXML = tag('dSubExe','0') + tag('dSubExo','0') + tag('dSub5',totals['5'].gross.toFixed()) + tag('dSub10',totals['10'].gross.toFixed())
    + tag('dTotOpe',total) + ['dTotDesc','dTotDescGlotem','dTotAntItem','dTotAnt','dPorcDescTotal','dDescTotal','dAnticipo','dRedon'].map(k => tag(k,'0')).join('')
    + tag('dTotGralOpe',total) + tag('dIVA5',totals['5'].vat.toFixed()) + tag('dIVA10',totals['10'].vat.toFixed())
    + tag('dLiqTotIVA5','0') + tag('dLiqTotIVA10','0') + tag('dTotIVA',vat)
    + tag('dBaseGrav5',totals['5'].base.toFixed()) + tag('dBaseGrav10',totals['10'].base.toFixed()) + tag('dTBasGraIVA',totals['5'].base.plus(totals['10'].base).toFixed());
  const emitter = ordered(fiscal.emitter, emitterFields) + fiscal.emitter.gActEco.map(a => group('gActEco', ordered(a,['cActEco','dDesActEco']))).join('');
  const operation = tag('iTipTra',transaction[0]) + tag('dDesTipTra',transaction[1])
    + ordered(fiscal.operation,['iTImp','dDesTImp']) + tag('cMoneOpe',document.currency) + tag('dDesMoneOpe',fiscal.operation.dDesMoneOpe);
  const body = tag('dDVId',cdc.slice(-1)) + tag('dFecFirma',reservation.signedAt) + tag('dSisFact','1')
    + group('gOpeDE',tag('iTipEmi','1') + tag('dDesTipEmi','Normal') + tag('dCodSeg',cdc.slice(34,43)))
    + group('gTimb',tag('iTiDE','1') + tag('dDesTiDE',fiscal.documentTypeLabel) + tag('dNumTim',fiscal.timbrado.dNumTim)
      + tag('dEst',reservation.establishment) + tag('dPunExp',reservation.point) + tag('dNumDoc',String(reservation.number).padStart(7,'0')) + tag('dFeIniT',fiscal.timbrado.dFeIniT))
    + group('gDatGralOpe',tag('dFeEmiDE',issuedAt) + group('gOpeCom',operation) + group('gEmis',emitter) + group('gDatRec',ordered(rec,receiverFields)))
    + group('gDtipDE',group('gCamFE',ordered(fiscal.operation,['iIndPres','dDesIndPres']))
      + group('gCamCond',tag('iCondOpe','1') + tag('dDCondOpe',fiscal.conditionLabel)
        + group('gPaConEIni',ordered(fiscal.payment,['iTiPago','dDesTiPag']) + tag('dMonTiPag',total) + tag('cMoneTiPag',document.currency) + tag('dDMoneTiPag',fiscal.operation.dDesMoneOpe))) + items)
    + group('gTotSub',sumXML);
  return { missingFields: [], unsignedXML: `<rDE xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NS} siRecepDE_v150.xsd"><dVerFor>150</dVerFor><DE Id="${cdc}">${body}</DE></rDE>`,
    total, vat, itemCount: document.lines.length };
}
