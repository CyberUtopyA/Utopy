export function fiscalErrorClass(error) {
  const code=String(error?.message||'');
  if(/AUTH|UNAUTHORIZED/.test(code))return 'AUTH_ERROR';
  if(/CERT|SECRET_REF|CSC|SUBJECT_MAPPING/.test(code))return 'CERT_ERROR';
  if(/SIGNATURE|SIGNING/.test(code))return 'SIGNATURE_ERROR';
  if(/XML|MAPPER|SPEC|WSDL|BUILD_CONTEXT|BATCH_TOO_LARGE/.test(code))return 'INVALID_XML';
  return 'NETWORK_TRANSIENT';
}
