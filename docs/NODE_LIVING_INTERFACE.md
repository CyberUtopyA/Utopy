# Interfaz Viva administrativa — 2026-10-19

## Boundary

`/n/:slug/gestionar` → Hoy and the administrative Centro de Producción → Trabajos queue mount `NodeLivingInterface`, after `businessAccess` verifies the selected identity's controller/delegation. Actor/node keys reset component state when switching. Public home, Market feed, header, buyer navigation, checkout and public profile are not redesigned.

`ProductionQueueWorkspace` joins the intent tools and existing `ProducerQueuePanel` inside the same production card. It uses only verified records belonging to that node. An explicitly selected node never falls back to another; without a selection, only a sole authorized node is selected automatically. Missing/ambiguous access preserves the legacy queue with an access link. Delegates retain a read-only queue; no new permission is inferred from a cashier. The wrapper does not change global store context, execute tasks or create another queue. This integration does not hydrate additional remote records or implement remote synchronization.

The portable projection lives in **UTOPY Runtime**, `src/living-space/interface.ts`, exported through `utopy/living-space` and the existing root barrel. It reuses `RuleReasoner`, `projectReasoningForm`, `CompositionInput` and `LocalCapabilitySandbox`; there is no new business workflow engine or identity/store/transport. Other hosts can render the same serializable projection without MS Market, FEDA, Studio, LLM or a central service.

## Implemented

- Private actor/node-scoped intent → actual authorized installed declarations → human task cards → existing LivingFormProjection → canonical CompositionInput.
- Fixed semantic components: diagnosis, catalog, quote, agenda, charge, orders, progress, evidence, outcome and generic form. No arbitrary components, downloaded modules, HTML execution or code generation.
- Text and optional browser dictation, with abort on unmount. Voice may use the browser provider/network and is not advertised as guaranteed offline or continuous conversation.
- Missing/invalid fields, preservation of known zero/false, editable filters, deterministic local correction commands (`buscar …`, `buscá …`, `filtrar por …`). Unknown actions do not become executable capabilities. This is bounded symbolic interpretation, not unrestricted natural-language understanding.
- Six existing business configurations now contain declarative `adminTools` preferences. The same reader host renders them; verified record types can reveal additional relevant readers. Rubro labels never grant permission or install commercial executors.
- The Market adapter installs **real read-only local handlers** over the already authorized records: catalog, orders, work/progress, diagnosis, quotes, agenda, charges, evidence and outcomes. Empty records produce an honest empty state, not fictitious business data. Charge queries do not collect money; agenda queries do not book slots; diagnosis queries do not diagnose devices.
- Three visible actions maximum initially; additional queries and saved procedures are progressive details. The public app does not mount this interface.
- `simulateComposition` performs canonical simulation without executing handlers or publishing events.
- Explicitly reviewed proposals use `LivingCompositionSDK.sign/revise` and `publishAuthorizedDV` into the same private local store. `meta.runtimeEnvelope` retains the canonical signed envelope; the outer compatibility DV remains authorized by the existing identity path. No `runtimeVerified` flag is fabricated. Revisions preserve SDK lineage, with an optimistic prior-envelope conflict check. A proposal-review reference is **not** an execution mandate or independently verified financial consent.
- Saving requires persistent device custody and `composition.publish`, checked again before commit. Read-only operators cannot save merely because their role label says manager. The native reader handler also checks access again when invoked.

## Adoption artifact

Market consumes `vendor/utopy-2.0.0-beta.3-interface-a2e06908.tgz`. It was built from the previously used `symbolic-f67d0aed` artifact, adding only compiled `living-space/interface` JS/types/map, two export lines and documentation. File hashes confirmed that every other pre-existing package file is unchanged. This avoids adopting unrelated dirty Runtime work through public commerce. No npm publication and no new third-party dependency were introduced.

## Still unavailable / must not be claimed

- No six commercial end-to-end journeys, automatic repair/diagnosis, authoritative stock reservation, anti-overlap booking, payment initiation/confirmation, delivery assignment or notification sender was installed by this interface. Real handlers/contracts must be configured before those actions are shown as executable.
- No automatic activation, autonomous code changes, arbitrary action learning or automatic expansion of mandates. Corrections persist only in explicitly reviewed proposal revisions; new canonical dictionary expressions still use the existing signed dictionary consent flow.
- Cross-device authenticated synchronization, delivery ACK, atomic writes/CAS and distributed conflict resolution remain prerequisites for remote commercial operation. Local optimistic detection is not a distributed conflict engine, and localStorage is not a server ACL or encryption boundary.
- Persistent saving, microphone interaction, visual mobile/tablet behavior and real operator onboarding need browser/device verification. Tests use an ephemeral Node wallet and explicitly confirm that saving is rejected there.

## Validation

Runtime: typecheck/build; existing source suite; symbolic/interface tests; identity/trust tests. Consumer: `verify-node-living-interface.mjs`, `verify-business-workspace.mjs`, five required contract suites, production/PWA build and source-transform checks. The new consumer test covers real native reads, foreign-node exclusion, offline projection, unknown tasks, local corrections, canonical simulation/revision, revocation and no implicit publication. Full repo ESLint has pre-existing failures and no TS parser; do not call a Vite build a full Market typecheck.
