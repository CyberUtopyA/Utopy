export function fiscalProjection(row, transport='dnit-test') {
  return {
    commercialDocumentId:row.document_id,revision:row.revision,documentHash:row.hash,
    issuerNodeId:row.issuer,environment:row.environment,state:row.state,cdc:row.cdc||undefined,
    resultCode:row.result_code||undefined,responseRef:row.response_ref?`private:fiscal-response:${row.response_ref}`:undefined,
    processedAt:new Date(row.updated_at).toISOString(),sourceRefs:JSON.parse(row.snapshot).sourceRefs||[],
    adapterAuthority:'utopy.sifen.sidecar/0.1.0',kudeAvailable:row.state==='ACCEPTED',simulation:transport==='mock',nonTradable:true,
  };
}
export function persistFiscalOutcome(repo,id) {
  const row=repo.db.prepare('SELECT * FROM documents WHERE id=?').get(id);
  if(!row || !['ACCEPTED','REJECTED'].includes(row.state) || !row.response_ref)return;
  const build=repo.db.prepare('SELECT transport FROM fiscal_builds WHERE document=?').get(id);
  const payload=fiscalProjection(row,build?.transport||'mock');
  const kind=`fiscal.document.${row.state.toLowerCase()}`;
  repo.db.prepare('INSERT INTO fiscal_outcomes(document,kind,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(document) DO NOTHING').run(id,kind,JSON.stringify(payload),Date.now());
}
