import { parseSifenResponse } from './transport.mjs';
const wrap=body=>`<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>${body}</s:Body></s:Envelope>`;
/** Synthetic TEST transport, explicitly tagged by the persisted operation. Never calls DNIT. */
export class MockSifenTransport {
  constructor(scenario='accepted'){this.scenario=scenario;}
  async submit(row){
    if(this.scenario==='timeout')throw new Error('NETWORK_TRANSIENT');
    const raw=wrap(`<rResEnviLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dCodRes>0300</dCodRes><dProtConsLote>${row.id}</dProtConsLote></rResEnviLoteDe>`);
    return {...parseSifenResponse(raw,row.cdc,'submit'),raw};
  }
  async query(row){
    const rejected=this.scenario==='rejected';
    const raw=wrap(`<rResEnviConsLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd"><dFecProc>2026-09-13T12:00:00-03:00</dFecProc><dCodResLot>0362</dCodResLot><gResProcLote><id>${row.cdc}</id><dEstRes>${rejected?'Rechazado':'Aprobado'}</dEstRes><gResProc><dCodRes>${rejected?'9999':'0260'}</dCodRes><dMsgRes>SIMULATION NONTRADABLE</dMsgRes></gResProc></gResProcLote></rResEnviConsLoteDe>`);
    return {...parseSifenResponse(raw,row.cdc,'batch'),raw};
  }
}
