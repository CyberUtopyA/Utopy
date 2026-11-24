# Mi espacio / autonomous business access — 2026-10-19

## Implemented slice, not six deployed businesses

> Superseded commercial surface: the local creation and owner-reconstruction entrypoints below have been removed. See `REAL_NODE_PROVISIONING_AUDIT.md` for the current truthful provisioning boundary and redesigned workspace. Historical contract/test descriptions remain evidence, not production deployment claims.

`/mi-espacio` lists businesses the current cryptographic identity controls or can read under a verified, unexpired authorization. `/n/:slug` exposes the explicitly public projection; `/n/:slug/gestionar` denies access without verified control/delegation. Avatar → Mis negocios opens the selector. The personal panel/CV remains available separately. Legacy `/login` is unchanged.

Six initial presentation/procedure configurations are provided in `src/utopy/businessWorkspace.ts::BUSINESS_CONFIGURATIONS`: Don Mencia, Encicar, René, cellular repairs, hair salon and burger restaurant. The first two reuse `livingPilotDefinitions`. These are NOT six business identities and do not grant installed capabilities. Names/prices/stock/customers/availability are not fabricated. The existing simulation pilots remain simulations.

The explicit preparation form creates a fresh UUID node manifest, signed through `publishAuthorizedDV` using its existing bootstrap path. It has empty capabilities/endpoints and `status: setup`, `setupOnly: true`; nothing accepts orders. It is saved **locally only**, with explicit consent. This does not publish the business to other devices, prove legal ownership of its display name or provide a running autonomous server. The setup announcement expires after 30 days unless legitimately renewed; there is no new heartbeat service.

## Reused contracts / evidence

The creation entry now has no required activity selector. It searches the already verified public registry by name, presentation and declared capabilities (bounded, accent-insensitive lexical matching, not an ecosystem-wide semantic crawler). Results link to the existing public node route and never grant management rights. A separate opt-in form prepares an unclassified node with an optional public `workspaceIntent`; that description is not installed as a capability. Existing configuration keys and saved nodes remain compatible. No separate ecosystem entity, store or authorization model is created. Public Market navigation is unchanged; the optional explore link uses its existing categories route.

- `ownership.ts::getWalletStatus`, `identityContext.ts::resolveCurrentIdentityContext`: device-controlled identity and existing recovery/device controls. No second password/login store.
- `utopy.nodeManifest.ts::buildNodeManifestDV/verifyNodeManifestDV`: canonical manifest format and signature verification. New registry rejects unsigned/invalid/expired manifests and ambiguous slugs/identifiers.
- `identityContext.ts::buildNodeAuthorizationDV/buildNodeAuthorizationRevokedDV`: existing membership/delegation vocabulary; no parallel `node.membership` system.
- `businessWorkspace.ts::businessAccess/validBusinessGrant`: requires verified control or a live grant for the requested action; checks subject, node, not-before, expiry and action. A role string alone grants nothing. Authorization is rechecked on data changes and expiry deadlines; mutation handlers recheck the latest snapshot.
- `BusinessWorkspace.tsx::membership`: only the verified controller can issue/revoke the initial **read-only** workspace authorization. Owner/manager/worker are role labels, not wildcard operational grants. Consent + expiration are required. Membership changes remain local; delivery/acceptance on another device is not claimed.
- `mt.liveStore.ts::mtLiveSetAccessContext`: existing actor/node cache partition, not a second database. This is not server-side ACL enforcement or encryption of localStorage.
- `ProducerQueuePanel`: reused node-scoped, verified work projection; its new optional `readOnly` mode hides commercial-document creation in this workspace, while preserving legacy behavior by default. No invented repair executor. `projectUniversalProduct`: existing public product projection and legacy product routes. Setup-only manifests are excluded from active node projections by `livingNodeProjection.ts::isPublicLivingDV`.
- `LivingAutomationPanel`: existing contextual text/voice procedure interface. Simulation/activation remains unavailable without real executors and an authorized Runtime integration. No new composition engine, FEDA intermediary or LLM dependency.

## Real audit differences from the request's old repository snapshot

The store already has `PUBLIC_STORAGE_KEY`, `privateStorageKey`, `privateCacheDV`, `canAccessEnvelope` and context switching. Identity already has signed authorization and revocation contracts. It would be wrong to replace these based on an outdated claim that the system only has one unprotected localStorage list. However, those mechanisms do not prove that the remote transport/server authorizes every private subscription or mutation.

## Remaining blockers / not implemented

1. Provision real owners, recoverable identities, existing business manifests and per-action operational mandates. No real businesses were enrolled automatically.
2. Verify authenticated per-node read/write subscriptions and durable receipts at the actual transport/server. A frontend guard cannot enforce confidentiality after a remote service has sent private data. No unconditional shared synchronization was enabled.
3. Supply installed commercial executors and declarations to the existing Runtime/LivingComposition adapter. The administrative Living Interface added later persists signed, versioned private query proposals, not executable commercial workflows. See `NODE_LIVING_INTERFACE.md`; its portable projection is exported from Runtime without replacing the existing engine.
4. Implement/adopt atomic authoritative inventory reservations and agenda slot allocation with idempotent commands/conflict resolution. A local form cannot prevent overselling or duplicate bookings across devices.
5. Connect the exact scoped existing order/quote/cash/delivery/notification handlers, including recipient consent and delivery ACK. Do not link a selected business to an unscoped legacy cashier, silently choose another node, mark transfers paid from uploaded proof, or promise push/SMS that has no configured adapter.
6. Only then complete the three commercial demonstrations and extend their capability configuration to the other profiles. None of the six end-to-end commercial journeys has been certified here.

No changes to Runtime, Studio, external repositories, commerce settlement, `createSale`, credit contracts, or existing login/CSRF were made in this increment.

## Validation scope

`node tests/verify-business-workspace.mjs`: all six configurations through the same real local signing/verification path; unsigned/tampered manifest rejection; controller access; invalid/expired/not-yet-valid/revoked grant flags; wrong actor/node/action; roles not granting authority; mixed public/private scope rejection; ambiguous routes; source syntax. Fixtures explicitly mark simulation/nonTradable. Node test environment uses an ephemeral wallet because IndexedDB is absent; it does NOT validate persistent browser login.

Required contract suites and build are run separately. No device visual QA, authenticated cross-device test, real inventory booking, repair, notification, delivery or payment was executed. The repository ESLint configuration currently covers JS/JSX, not TS/TSX; a passing Vite build is not a full TypeScript typecheck. Full lint has existing errors across unrelated files; new/modified JS is checked separately.
