# SIFEN TEST integration status

The full P0 acceptance checklist is **not complete**. Market continues to operate without any fiscal certificate.

## Official references and verification

- [DNIT technical portal](https://ekuatia.set.gov.py/en/web/e-kuatia/documentacion-tecnica): Manual v150 and NT001–NT027 are downloaded and SHA-256 pinned. Downloading is not equivalent to applying/reviewing all notes; `technicalNotesApplied` is intentionally empty.
- [Official schema directory](https://ekuatia.set.gov.py/sifen/xsd/): the main v150 DE schema plus recursive imports/includes are stored unchanged. Generated/signed TEST XML is validated against these local resources with libxml2 WASM. The separately advertised RAR contains an older schema lacking targetNamespace and referencing a missing `xsi.xsd`; it is retained for provenance, **not used as the v150 validator**.
- [DNIT check-digit algorithm](https://www.dnit.gov.py/documents/20123/224893/D%C3%ADgito%2BVerificador.pdf/fb9f86c8-245d-9dad-2dc1-ac3b3dc307a7?t=1683354226554.pdf): module 11, alphanumeric substitution. Official CDC known vector tested.
- [DNIT libraries page](https://ekuatia.set.gov.py/en/web/e-kuatia/librerias) was inspected; the returned page does not expose downloadable library links. Crypto/XML use maintained MIT-licensed `xml-crypto`, `xmldom`, `decimal.js`, `soap` and `xmllint-wasm` rather than custom cryptographic primitives. Their use is not DNIT certification.
- Real TEST WSDL retrieval from this environment returned HTTP 200 containing **BIG-IP logout HTML**, not WSDL. The real preflight suite rejects that response. No successful SIFEN submission has occurred.

## Supported offline mapper subset

Invoice, PYG, cash condition (cash/transfer), explicitly supplied fully taxable IVA 5%/10%, identified receiver, product/service/labor/material/transport lines. No discounts, advances, other regimes or currencies are silently mapped. Missing/unsupported inputs return `missingFields`. The line tax settings are explicit test fixture inputs, never inferred from the seller's profession.

## Tests

From `deploy/utopy-sifen`: `npm ci`, `npm test`, `npm run fiscal:check-spec`.
From Market: `node tests/verify-fiscal-contract.mjs`, `node tests/verify-contract.mjs`, `pnpm run build`.

`npm run test:sifen:integration` includes mTLS/WSDL preflight and a full submission/query test. It is skipped by default. The full test additionally requires `SIFEN_ALLOW_TEST_SUBMIT=true`; it uses the same service/worker and demands individual acceptance. No real DNIT test has passed or been attempted with credentials. The local mock suite covers accepted/rejected outcomes, KuDE gating, ten concurrent issuance requests, timeout reconciliation and security cases.

## Required for a real test

1. Exact issuerNodeId(s), fiscalSubjectId and permissioned device public keyId/JWK/actions.
2. Real TEST-enabled taxpayer RUC/DV, legal name, taxpayer type, address, official geography/activity codes, phone/email, habilitation, test timbrado/start date, establishment, expedition point and unused initial number coordinated across all emitting systems.
3. Qualified RSA certificate chain and matching private key as server refs; encrypted-key password ref; expected certificate subject serial/RUC and trusted PSC policy.
4. TEST IdCSC and CSC through a server secret ref, never frontend/chat/Git.
5. Private identified receiver details, actual commercial line quantities/prices, official units, explicit tax treatment, commercial/payment condition and agreed dates.
6. Reachable TEST WSDL and imports via the authorized mTLS connection, saved/pinned contracts and verified service/port/operation metadata.
7. Deployment origin, private database directory, restricted service identity, public Market origins and separate adapter response-key public JWK.

Credentials alone do not complete the remaining code: normative conformance, official tables, discount/receiver rules and terminal CDC consultation remain incomplete. The new service intentionally blocks real TEST submission until conformance is completed; changing lock flags is not a substitute.

## Exact configuration / references

Process environment: `SIFEN_ENV=test`, `SIFEN_TEST_ENABLED=true`, `SIFEN_PRODUCTION_ENABLED=false`, `SIFEN_TRANSPORT=mock|dnit-test`, `SIFEN_CONFIG_PATH`, `FISCAL_DB_PATH`, `SIFEN_HOST`, `SIFEN_PORT`, `SIFEN_ALLOWED_ORIGINS`, `SIFEN_ADAPTER_KEY_PATH`. CLI additionally uses `SIFEN_TEST_ISSUER`, `SIFEN_TEST_FIXTURE_PATH`, `SIFEN_TEST_ARTIFACT_DIR`; real integration requires `SIFEN_ALLOW_TEST_SUBMIT=true`.

Private `subjects[fiscalSubjectId]`:

- `secretRoot`: absolute, protected taxpayer-specific directory.
- `certificateRef`, `privateKeyRef`, optional `passwordRef`: absolute files inside secretRoot. `ruc`, `certificateSubjectSerial`: exact authorized certificate identity.
- `cscId`: four digits; `cscRef`: file containing the TEST CSC, never its content in frontend/config/Git.
- Optional `mtls`: separate certificateRef/privateKeyRef/passwordRef/certificateSubjectSerial overrides, under the same protected root. Optional `tlsCARef` is a trusted CA file, never `rejectUnauthorized:false`.
- `numbering`: `documentType:"1"`, `establishment`, `point` (three digits), `startNumber` (unused integer).
- `receivers`: private lookup keyed by CommercialDocument.buyerRef. Identified receiver data uses the official fields, not data published in Market.
- `fiscal.emitter`: dRucEm, dDVEmi, iTipCont, dNomEmi, dDirEmi, dNumCas, cDepEmi, dDesDepEmi, cCiuEmi, dDesCiuEmi, dTelEmi, dEmailE, gActEco[{cActEco,dDesActEco}].
- `fiscal.operation`: iTipTra, dDesTipTra, iTImp, dDesTImp, dDesMoneOpe, iIndPres, dDesIndPres. `timbrado`: dNumTim, dFeIniT. `payment`: iTiPago, dDesTiPag. Explicit official unitLabels/taxLabels/documentTypeLabel/conditionLabel are required by the restricted mapper.
- `wsdl.submit`, `wsdl.batch`, `wsdl.document`: `path`, `sourceUrl`, `sha256`, `service`, `port`, `operation`, `imports:[{path,sourceUrl,sha256}]`. Provision real official files and the complete closure, never the synthetic test contract.

See [sidecar runbook](../deploy/utopy-sifen/README.md) for install/migration/preflight/dry-run/submission commands and [support matrix](../deploy/utopy-sifen/official/p0-support.json) for unsupported scenarios. `fiscal:check-spec` now checks offline integrity; use `--remote` explicitly to compare downloads.
