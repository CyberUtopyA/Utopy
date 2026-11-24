# UTOPY SIFEN sidecar — TEST, partial P0

Independent deployment unit. It does not import Market, React or the universal Runtime. **The mock issuance pipeline is connected. Real DNIT submission remains blocked by incomplete normative conformance; this is not a production release.**

## Run

Use a supported Node release with `node:sqlite` (Node 22.13+; current Node 23.1 requires the included experimental flag).

```
npm ci
npm test
npm start
```

With no config/certificate, `/health` works, private operations return not configured and Market continues normally. Set environment variables through your process manager; `.env.example` is documentation and is not loaded automatically.

The private API is `POST /v1/request`. Its body is `{payload,keyId,signature}`; payload uses `utopy.fiscal.request/1`, `private:fiscal`, issuerNodeId, action, nonce, timestamp and document identity/hash/revision. Sign canonical recursively sorted JSON with ECDSA P-256 SHA-256, P1363/base64url. Wired actions: `settings.read`, `document.save`, `document.status`, `document.submit`, `document.preview`, `document.kude`. The private config must explicitly grant each action to the pinned key for that issuer. The server starts the existing durable worker; it runs without Market open.

`SIFEN_CONFIG_PATH` JSON structure: `nodes` maps exact node IDs to `{fiscalSubjectId,authorizedKeys:[{keyId,publicKeyJwk,actions,expiresAt?,revoked?}],mode?}`; `subjects` maps taxpayer IDs to their own server-only fiscal configuration. Exact configuration fields are listed in `../../docs/SIFEN.md`. Certificate and CSC providers resolve only references inside the subject's `secretRoot`, including symlink resolution. Never put secret contents in this JSON or Git.

Market needs only public `VITE_SIFEN_SIDECAR_URL` and `VITE_SIFEN_ADAPTER_PUBLIC_JWK`. The latter corresponds to the private P-256 key at `SIFEN_ADAPTER_KEY_PATH`. Configure these through deployment, not by editing secret values into source.

## Official resource lock

`official/sifen-spec.lock.json` records schema resources, Manual v150 and 27 notes with retrieval times/URLs/checksums. `npm run fiscal:check-spec` checks local bytes and XSD closure offline. Add `-- --remote` for an explicit remote comparison. It does not equate integrity with conformity: official table consolidation and real WSDL verification remain pending. `official/p0-support.json` is the machine-readable support matrix. No network request runs during Market's build.

## Persistence / migration / backup

The repository uses SQLite WAL, synchronous FULL, immediate transactions and unique constraints. Bootstrap applies idempotent `migrations/001.sql` and `002.sql`; existing documents are preserved. `npm run fiscal:preflight` opens/migrates the repository without reserving a number or issuing. Numbering/reservation tests include rollback and same-taxpayer multi-node behavior. Run one service instance on a local protected disk, not a shared network drive. A future production repository must preserve the same transactional invariants.

## Controlled TEST workflow

From the repository root, after `npm ci` inside this sidecar:

```text
pnpm fiscal:check-spec
pnpm fiscal:preflight
pnpm sifen:test:build-document
pnpm sifen:test:submit-fixture --allow-test-submit
pnpm test:sifen:integration
```

Set process environment (not a browser): `SIFEN_CONFIG_PATH`, `FISCAL_DB_PATH`, `SIFEN_TEST_ISSUER`, `SIFEN_TEST_FIXTURE_PATH`, `SIFEN_TEST_ARTIFACT_DIR`, `SIFEN_ENV=test`, `SIFEN_TEST_ENABLED=true`. Choose `SIFEN_TRANSPORT=mock` for simulation or `dnit-test` for the real endpoint. Production is always blocked.

Dry-run uses an in-memory repository and writes private snapshot/XML/validation/CDC/preview artifacts, never leaves a send job in the active repository. Its provisional number must not be treated as a real reservation or sent manually. The submit command uses the configured persistent repository, explicit simulation/nonTradable fixture and flag, prints the authorized TEST summary, then sends and reconciles the same CDC. Re-running it preserves document identity. Queries obey the worker's ten-minute minimum; the command stops after 24 hours without inventing acceptance.

The integration suite is skipped by default. Submission additionally requires `SIFEN_ALLOW_TEST_SUBMIT=true`; it now invokes the issue/query pipeline, not only WSDL preflight. It has not been executed against DNIT. Preflight currently reports the normative blocker; do not flip conformance flags to bypass unfinished implementation.

KuDE is regenerated from persisted signed XML, available privately through authenticated actions. Before acceptance only the watermarked preview is available; rejected documents cannot download a definitive KuDE. Every TEST/mock PDF remains visibly without real fiscal value. Payments are not changed.

For a coherent backup, use SQLite's online backup API or stop the service, checkpoint WAL, then copy the database. Do not copy the main file alone while WAL writes are active. Encrypt backups, restrict restore permissions and regularly test restoration. Retention must be configured according to the taxpayer's applicable DNIT obligations; this package invents no retention duration and deletes no fiscal history automatically.

No production activation path exists yet. `SIFEN_PRODUCTION_ENABLED=true` fails startup. Detailed architecture/security/status live in the repository's `docs/FISCAL_ARCHITECTURE.md`, `docs/SIFEN.md`, `docs/SIFEN_SECURITY.md` and must accompany an operational handoff.
