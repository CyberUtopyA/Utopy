# Frontend credential review — 2026-10-16

## Scope and result

Local MS Market (`AO/Ao`), Falcon MO (`mo/Mo`) and Fundación Studio (`LyV/lyv`): source, public assets, root environment files, Vite configuration and available production output. Additional heuristic scans: FEDA, GE, MT (`mt` and `mercadoTierraNode`), Falcon/FB and Runtime. No provider secret, embedded private PEM/JWK, or privileged/session JWT was detected by the checked patterns. This is not proof that no possible secret exists. Git history, provider dashboards, deployed servers, browser storage and remote node responses were not audited.

Public verification keys are not secrets. Market/MO device signing keys are generated locally; a non-extractable CryptoKey is not a shared credential embedded in the application. Same-origin malicious scripts/XSS could still invoke signing operations; this change is not an XSS audit.

FEDA exposes an `anon`-type browser key; it was not classified as a privileged server key by the JWT scan. Browser keys require correct server/database authorization and RLS; those remote policies were not inspected. MT's server environment includes authentication configuration without a `VITE_` prefix; its presence on the server is not evidence of a frontend leak.

## Concrete findings and changes

- Market and Studio `.env` files contained public configuration, not detected secrets, but were tracked/staged. Removed them from the Git index while retaining the local files. Added ignore rules in all three repositories. This does not erase previous Git history.
- Studio `public/api/data/page-drafts.json` and `page-published.json` were copied as public assets. Apache `.htaccess` does not protect static Vite hosting. Moved both local files, without changing their contents (SHA-256 checked), to `.utopy-private/editor/`. `_utopy_helpers.php::utopy_data_dir()` now defaults there. `UTOPY_DATA_DIR` remains supported.
- `frontendPrivacyGuard` in each repository blocks private URL paths in dev/preview; rejects public runtime JSON, key containers, environment files and symlinks before asset copying; rejects sensitive server-credential names exposed via Vite env. Studio's real `/api` proxy remains; ordinary PHP requests are not replaced with a mock backend. Market's existing dev `node-live.php` handler remains. Preview cannot execute PHP and therefore rejects PHP source requests.
- No identity, Runtime, transport, payment credentials or authorization semantics changed. No provider tokens were revoked, no keys rotated and no production deployment performed.

## Re-run

From Market:

```powershell
node tests/audit-frontend-secrets.mjs . C:/Users/derli/Desktop/mo/Mo C:/Users/derli/Desktop/LyV/lyv
node tests/verify-frontend-privacy.mjs C:/Users/derli/Desktop/mo/Mo C:/Users/derli/Desktop/LyV/lyv
```

The scanner redacts all matches. It is heuristic, does not inspect every possible obfuscation, and is not a dependency-vulnerability audit. Middleware tests cover blocked paths, safe assets, preview PHP rejection, secret env rejection and public-state rejection in all three implementations.

## Deployment order / remaining obligations

1. Before deploying Studio's changed storage default, preserve the server's existing editor state and move it to a private writable directory; set `UTOPY_DATA_DIR` to its absolute path. Do not deploy with an empty private directory over a live editor without migrating its existing files.
2. Deploy the rebuilt output using the existing PHP-capable server. Do not serve `dist/api/*.php` from a generic static host. Configure equivalent deny rules in the actual web server; Vite middleware is not a production firewall.
3. Remove old `api/data/*.json` from the deployed document root after migration and verify that HTTP access is denied; purge any existing CDN caches. Local rebuilds do not remove historical remote copies.
4. Never supply private credentials with `VITE_` prefixes. Provider secrets stay in server environment/secret storage. Browser-facing service keys must have provider-side origin/API restrictions.
5. Market still uses Vite 6.0.0. Upgrade and test the dev-tool chain against current advisories separately; do not expose the development server to the Internet. The new middleware is defense-in-depth, not a substitute for patched dependencies.
6. If a secret is found in historical commits or deployed files, revoke/rotate it at the provider; deleting the source is insufficient. None was found in the current audited files, so no speculative rotation was performed.

Validation: heuristic scans, all-three middleware tests, all-three builds passed. PHP was unavailable in this environment, so PHP lint/domain execution for the storage-path edit could not run. No real payment or publication was executed.
