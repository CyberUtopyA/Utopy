import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { DOMParser } from '@xmldom/xmldom';
import { hash } from '../auth.mjs';
const NS='http://ekuatia.set.gov.py/sifen/xsd';
/** Manual v150 13.4: representation of the persisted signed DE, never fiscal authority. */
export async function renderKude(row,{preview=false,simulation=false}={}) {
  if(!preview && row.state!=='ACCEPTED')throw new Error('KUDE_NOT_ACCEPTED');
  if(!row.signed_xml || hash(row.signed_xml)!==row.xml_hash || /<!DOCTYPE|<!ENTITY/i.test(row.signed_xml))throw new Error('KUDE_XML_INTEGRITY');
  const xml=new DOMParser().parseFromString(row.signed_xml,'text/xml');
  const value=(name,node=xml)=>node.getElementsByTagNameNS(NS,name)[0]?.textContent||'';
  const de=xml.getElementsByTagNameNS(NS,'DE');
  if(de.length!==1 || de[0].getAttribute('Id')!==row.cdc)throw new Error('KUDE_DOCUMENT_MISMATCH');
  const qr=value('dCarQR');
  if(!qr.startsWith('https://ekuatia.set.gov.py/consultas-test/qr?'))throw new Error('KUDE_QR_ENVIRONMENT');
  const qrImage=await QRCode.toBuffer(qr,{type:'png',width:300,margin:4,errorCorrectionLevel:'M'});
  const pdf=new PDFDocument({size:'A4',margin:40,bufferPages:true,info:{Title:'KuDE TEST',Author:'UTOPY SIFEN Adapter',CreationDate:new Date(row.created_at),ModDate:new Date(row.created_at)}});
  const chunks=[];const result=new Promise((resolve,reject)=>{pdf.on('data',c=>chunks.push(c));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  const warning=preview?'BORRADOR · SIN VALIDEZ FISCAL':simulation?'SIMULACIÓN · SIN VALIDEZ FISCAL':'SIFEN TEST · SIN VALOR FISCAL REAL';
  function header(){
    pdf.fontSize(11).fillColor('#a00000').text(warning,{align:'center'}).fillColor('#000000');
    pdf.moveDown().fontSize(16).text('KuDE de Factura Electrónica');
    pdf.fontSize(10).text(value('dNomEmi')).text(value('dNomFanEmi'));
    pdf.text(`${value('dDirEmi')} · ${value('dDesCiuEmi')}`).text(`${value('dTelEmi')} · ${value('dEmailE')}`);
    for(const a of Array.from(xml.getElementsByTagNameNS(NS,'gActEco')))pdf.text(value('dDesActEco',a));
    pdf.text(`RUC: ${value('dRucEm')}-${value('dDVEmi')} · Timbrado: ${value('dNumTim')}`);
    pdf.text(`Inicio de vigencia: ${value('dFeIniT')}`);
    pdf.text(`Factura: ${value('dEst')}-${value('dPunExp')}-${value('dNumDoc')}`);
    pdf.text(`Emisión: ${value('dFeEmiDE')} · ${value('dDCondOpe')} · ${value('cMoneOpe')}`);
    pdf.text(`Receptor: ${value('dNomRec')} · ${value('dRucRec')?value('dRucRec')+'-'+value('dDVRec'):value('dNumIDRec')}`);
    pdf.text(`${value('dDirRec')} ${value('dTelRec')} ${value('dEmailRec')}`);
    pdf.text(value('dDesTipTra'));
    const y=pdf.y+8;pdf.image(qrImage,40,y,{width:80,height:80});
    pdf.fontSize(9).text(`CDC: ${row.cdc.match(/.{1,4}/g).join(' ')}`,130,y,{width:415});
    pdf.text('Consulta TEST: https://ekuatia.set.gov.py/consultas-test/',130,pdf.y+4,{width:415});
    pdf.text('La aceptación fiscal y el estado del pago son independientes.',130,pdf.y+4,{width:415});
    pdf.y=y+90;pdf.x=40;
  }
  header();
  for(const item of Array.from(xml.getElementsByTagNameNS(NS,'gCamItem'))) {
    const description=value('dDesProSer',item);
    const height=pdf.heightOfString(description,{width:510})+55;
    if(pdf.y+height>735){pdf.addPage();header();}
    pdf.fontSize(10).text(`${value('dCodInt',item)} · ${description}`);
    pdf.fontSize(9).text(`${value('dCantProSer',item)} ${value('dDesUniMed',item)} × ${value('dPUniProSer',item)} PYG · Descuento: ${value('dDescItem',item)||'0'}`);
    pdf.text(`Importe: ${value('dTotOpeItem',item)} PYG · ${value('dDesAfecIVA',item)} ${value('dTasaIVA',item)}%`).moveDown(0.6);
  }
  if(pdf.y>620){pdf.addPage();header();}
  pdf.moveDown().fontSize(10);
  for(const [label,key] of [['Exentas','dSubExe'],['Exoneradas','dSubExo'],['Subtotal 5%','dSub5'],['Subtotal 10%','dSub10'],['Total operación','dTotOpe'],['Descuento total','dDescTotal'],['Total en guaraníes','dTotGralOpe'],['Liquidación IVA 5%','dIVA5'],['Liquidación IVA 10%','dIVA10'],['Total IVA','dTotIVA']])pdf.text(`${label}: ${value(key)||'0'} PYG`);
  const range=pdf.bufferedPageRange();
  for(let i=0;i<range.count;i++){pdf.switchToPage(i);pdf.fontSize(8).text(`${i+1}/${range.count}`,40,790,{lineBreak:false,align:'center',width:515});}
  pdf.end();return result;
}
