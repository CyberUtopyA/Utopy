# SIFEN security boundary

- Private keys, CSC and passwords are referenced by server filesystem paths. None belongs in `VITE_*`, manifests, catalogs, profiles, maps or Git.
- Private config path is `SIFEN_CONFIG_PATH`; each `nodes[nodeId]` names one `fiscalSubjectId` and an explicit `authorizedKeys` allowlist. Entries contain `keyId`, public P-256 JWK, actions, optional expiry/revocation. Register keys through an authenticated administrator process, not self-enrollment from the browser.
- `subjects[subjectId]` owns fiscal config/certificate/CSC/numbering. Nodes representing the same taxpayer share that subject. Different taxpayers must not share refs.
- `SIFEN_ADAPTER_KEY_PATH` references a separate server P-256 signing key for response attestations. It is not the qualified SIFEN RSA certificate. The corresponding **public** JWK is pinned in Market.
- HTTPS is mandatory beyond loopback. CORS only admits explicitly configured exact origins and is not authorization. Every private read/write is signed, scoped and nonce checked. No cookies or ambient credentials.
- Requests bind issuer, action, document ID, revision and SHA-256. Same revision with different content is rejected. Nonce replay is rejected; retry signs a fresh nonce for the same revision. Different devices share server uniqueness constraints.
- Logs contain only fixed event/error codes, never raw errors or fiscal payloads. `/health` has no taxpayer, document or secrets. Fiscal API uses `Cache-Control: no-store`.
- SQLite is a TEST repository. Run with a dedicated restricted service account. On Windows apply restrictive ACLs to config, database/WAL, secrets and backups; Unix file modes alone are not Windows ACL protection. Encrypt volumes/backups. No claim of production durability/compliance is made.
- TLS certificate verification is never disabled. XML rejects DTD/entities. Official schema bytes are SHA-256 checked and imports resolved offline. XMLDSig verifies against the pinned certificate, not an untrusted embedded key. Duplicate DE/signature references are rejected.
- Local certificate checks do not prove qualified PSC trust or DNIT habilitation. That verification is still outstanding. Production stays unconditionally blocked in this P0.
- After a potentially delivered send, the worker persists UNKNOWN before network IO and only reconciles that CDC. It does not create a new CDC or infer rejection from a timeout.
- Legacy fiscal drafts are now private/local-only and cannot generate `fiscal.valid` or reputation increments.

Do not paste production credentials into chat. Provision secret references directly on the intended server using your secure secret-management process.

Certificate/CSC providers enforce absolute references contained within a realpath-resolved subject secretRoot. Signing and mTLS usages are explicit and independently configurable. No key/password/CSC is persisted in fiscal_builds: only mapper configuration and signed document evidence. WSDL imports are checksum-pinned and offline; SOAP requests enforce timeout, no redirects, TLS verification and bounded response sizes. Unknown send results never trigger a new identity or automatic resubmission. Deterministic errors pause; transient reconciliation has bounded retries.

KuDE download is an authenticated signed POST response, not a public file URL. Browser object URLs are short-lived; private XML/receiver data and PDFs are never published to Seed. Fiscal result attestations are cached only in the existing private/local projection after verification of the configured adapter key. The document outcome is not a payment confirmation.

Known remaining blockers: official qualified-PSC chain policy, complete normative validation, verified official WSDL contracts and terminal CDC consultation. `/ready` returns 503 when resources/worker/repository/configuration are not ready; production remains blocked regardless of flags.
