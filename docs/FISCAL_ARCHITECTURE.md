# Fiscal adapter boundary

Status: partial P0 implementation; **not ready for real issuance or production**.

Market adapts commercial evidence into `CommercialDocument` without changing legacy DVs. A document is a revisioned snapshot, with decimal strings and source references. A quote, receipt, document, tax approval and payment remain separate facts.

`src/fiscal/fiscalClient.ts` signs private requests with the existing device ECDSA key. The sidecar pins authorized device public keys to issuer nodes and actions. A caller cannot select another taxpayer's configuration. Requests carry document hash/revision, nonce, timestamp and private scope. The public adapter key must be provisioned separately in Market; it is not trusted merely because a server returns it.

The independent `deploy/utopy-sifen` package uses Node.js and SQLite WAL/FULL transactions for TEST. Draft saving, revision conflict checking and private status retrieval are wired to the HTTP API. Fiscal numbering is shared by fiscal subject/environment/document type/establishment/point, not by node. Reservation and outbox insertion are atomic. No fiscal ledger lives in mt.liveStore.

Implemented components: limited invoice mapper, decimal validation, CDC, XMLDSig/local verification, official XSD closure validation, QR, leased outbox worker, SOAP response parsing and private KuDE. The HTTP server now starts the worker. `document.submit` reserves the existing revision once and queues it; configuration and TEST conformance gates are checked before reservation. Mock accepted/rejected pipelines pass. `/health` and `/ready` expose repository, worker, resource integrity and transport readiness without taxpayer details.

The immutable build context stores fiscal mapper input, signedAt, spec hash and transport; retries do not regenerate timestamps or fiscal identities. Terminal outcomes are persisted privately. A verified adapter HTTP attestation is archived in the existing local liveStore through authorizedPublish, with private scopes and localOnly; the actor archives evidence, never impersonates DNIT. InvoiceCenter and Works reuse the same document panel for explicit submission/status/KuDE. No automatic emission occurs on work completion.

Outstanding: cumulative NT conformance, official tables, broader receiver/discount/rounding validation, qualified PSC trust-chain policy, actual WSDL inspection, CDC returned-DTE/protocol validation, complete KuDE compliance review and browser end-to-end verification. Offline WSDL import pinning is implemented and tested with a synthetic contract, not falsely reported as official verification. The real issue/query integration command exists but has not run. Fiscal events remain unsupported; no cancellation button is exposed.

DE ≠ accepted DTE. An accepted TEST document has no fiscal validity. Invoice ≠ payment. KuDE ≠ authoritative DTE. UTOPY ECDSA ≠ fiscal RSA XMLDSig. Node identity ≠ fiscal taxpayer. e-Kuatia ≠ e-Kuatia’i.

No Seed, Caddy, vendor backend, purchase protocol, FalconDock or Core Runtime changes.
