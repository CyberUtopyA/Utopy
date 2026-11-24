import assert from "node:assert/strict";
import { createServer } from "vite";
import { createIdentity, createEnvelope, signEnvelope } from "utopy";
import { createAuthorityTrustEnvelope, createContextHandoffEnvelope, createContextHandoffAckEnvelope } from "utopy/continuity";
import { createLivingCapabilityEnvelope } from "utopy/living-space";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { MarketAuthorityTrust } = await vite.ssrLoadModule("/src/utopy/runtimeTrust.ts");
  const { LivingSpaceContinuity } = await vite.ssrLoadModule("/src/utopy/livingSpaceContinuity.ts");
  const { rankLivingItems } = await vite.ssrLoadModule("/src/utopy/livingSpaceRelevance.ts");
  const { dvToLivingEnvelope } = await vite.ssrLoadModule("/src/utopy/livingEnvelope.adapter.ts");
  const { livingEnvelopeToDV } = await vite.ssrLoadModule("/src/utopy/livingEnvelope.adapter.ts");
  const { projectVerifiedRuntimeEnvelope } = await vite.ssrLoadModule("/src/utopy/runtimeProjection.security.ts");
  const { interpretSpaceCommand } = await vite.ssrLoadModule("/src/utopy/livingSpaceNavigation.ts");
  const { extractDVsFromFrame } = await vite.ssrLoadModule("/src/mt/mt.ingest.ts");
  const root = await createIdentity({ actorId: "issuer", nodeId: "root" });
  const sender = await createIdentity({ actorId: "person", nodeId: "market" });
  const receiver = await createIdentity({ actorId: "provider", nodeId: "provider-node" });
  const policy = new MarketAuthorityTrust(sender.nodeId, [{ authority: root.nodeId, keyId: root.keyId, publicKeyJwk: root.publicKeyJwk }]);
  const unanchored = new MarketAuthorityTrust(sender.nodeId);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const payload = { protocol: "utopy.authority-trust/1", audience: [sender.nodeId], revision: 1,
    issuedAt: new Date().toISOString(), expiresAt, revokedDeviceIds: [],
    authorities: [sender, receiver].map((identity) => ({ authority: identity.nodeId, status: "active", sourceRefs: [],
      keys: [{ keyId: identity.keyId, publicKeyJwk: identity.publicKeyJwk, status: "active", activeFrom: new Date(0).toISOString(), sourceRefs: [] }] })),
    mandates: [{ mandateId: "mandate", actorId: sender.actorId, nodeId: sender.nodeId, authority: root.nodeId, status: "active",
      allowedActions: ["context.handoff"], expiresAt, sourceRefs: [] }],
  };
  const trust = await createAuthorityTrustEnvelope({ identity: root, payload });
  assert.equal((await unanchored.receiveTrust(trust)).ok, false, "self contained signatures are not trust");
  assert.equal((await policy.receiveTrust(trust)).ok, true);
  assert.equal((await policy.receiveTrust(trust)).ok, false, "trust replay/rollback");
  const wrongAudience = await createAuthorityTrustEnvelope({ identity: root, payload: { ...payload, audience: ["other"], revision: 2 } });
  assert.equal((await policy.receiveTrust(wrongAudience)).ok, false);
  const manifest = { protocol: "utopy.living-capability/1", capability: { code: "design.wood", version: "1", label: "Diseñar en madera",
    traits: ["wood"], lifecycle: { status: "available", updatedAt: new Date().toISOString(), validUntil: expiresAt } },
    accepts: { intentKinds: ["need"], inputSchemas: [], handoffPurposes: ["view"] }, produces: { outcomeKinds: [], evidenceKinds: [] },
    interaction: { text: true, voice: { supported: false }, spatial: { modes: ["2d", "2.5d"] } }, presentation: {}, permissions: [], effects: [],
    privacy: { minimumScope: "public", locationPrecision: "approximate" }, execution: { mode: "manual", confirmation: "always", cancellable: true } };
  const capability = await createLivingCapabilityEnvelope({ identity: receiver, manifest });
  const dvs = [];
  const sent = [];
  const coordinator = new LivingSpaceContinuity(policy, () => dvs, (dv) => dvs.push(dv), (envelope) => sent.push(envelope));
  assert.equal((await coordinator.receive(capability, { actorId: sender.actorId })).ok, true);
  const args = { identity: sender, mandateId: "mandate", capability, context: { subjectRefs: [capability.id] }, returnRef: "https://market.example/market", confirmed: true };
  await assert.rejects(coordinator.request({ ...args, confirmed: false }));
  await assert.rejects(coordinator.request({ ...args, context: { subjectRefs: ["private:unknown"] } }));
  const handoff = await coordinator.request(args);
  assert.equal(sent.length, 1); assert.deepEqual(handoff.payload.delegatedActions, []);
  assert.equal((await coordinator.receive(handoff, { actorId: "other" })).ok, false);
  const receiverCoordinator = new LivingSpaceContinuity(policy, () => [], () => {}, () => {});
  assert.equal((await receiverCoordinator.receive(handoff, { actorId: receiver.actorId, nodeId: receiver.nodeId })).ok, true);
  assert.equal((await receiverCoordinator.receive(handoff, { actorId: receiver.actorId, nodeId: receiver.nodeId })).reason, "handoff-replay");
  const ack = await createContextHandoffAckEnvelope({ identity: receiver, handoff, status: "accepted", acceptedCapabilities: ["design.wood"] });
  const forged = structuredClone(ack); forged.payload.nonce = "0".repeat(32);
  assert.equal((await coordinator.receive(forged, { actorId: sender.actorId })).ok, false);
  assert.equal((await coordinator.receive(ack, { actorId: sender.actorId })).ok, true);
  assert.equal((await coordinator.receive(ack, { actorId: sender.actorId })).reason, "ack-replay");
  const sensitive = await createContextHandoffEnvelope({ identity: sender, audience: { nodeId: receiver.nodeId }, purpose: "execute",
    context: { subjectRefs: [] }, consentRef: "consent:missing", expiresAt });
  assert.equal((await receiverCoordinator.receive(sensitive, { actorId: receiver.actorId, nodeId: receiver.nodeId })).reason, "handoff-consent-revoked");
  const expired = await signEnvelope(await createEnvelope({ kind: "living.capability.manifest", sourceActorId: receiver.actorId, sourceNodeId: receiver.nodeId,
    authority: receiver.nodeId, scopes: ["public"], expiresAt: new Date(Date.now() - 1000).toISOString(), payload: manifest }), receiver);
  assert.equal((await coordinator.receive(expired, { actorId: sender.actorId })).ok, false);
  const revokedPayload = structuredClone(payload); revokedPayload.revision = 2; revokedPayload.authorities[1].keys[0].status = "revoked";
  revokedPayload.authorities[1].keys[0].revokedAt = new Date().toISOString();
  assert.equal((await policy.receiveTrust(await createAuthorityTrustEnvelope({ identity: root, payload: revokedPayload }))).ok, true);
  assert.equal((await coordinator.receive(capability, { actorId: sender.actorId })).ok, false);
  const omitted = structuredClone(revokedPayload); omitted.revision = 3; omitted.authorities = [omitted.authorities[0]];
  assert.equal((await policy.receiveTrust(await createAuthorityTrustEnvelope({ identity: root, payload: omitted }))).ok, true);
  const resurrected = structuredClone(payload); resurrected.revision = 4;
  assert.equal((await policy.receiveTrust(await createAuthorityTrustEnvelope({ identity: root, payload: resurrected }))).ok, false, "omitting a revoked key must not resurrect it later");
  const nested = { ...capability, payload: { dv: { id: "spoof", kind: "market.product", attrs: {} } } };
  assert.deepEqual(extractDVsFromFrame(nested), [nested], "unverified signed payload must never enter through legacy traversal");
  assert.deepEqual(livingEnvelopeToDV({ ...nested, scopes: ["private"], payload: { dv: { id: "legacy", kind: "market.product", meta: { scopes: ["public"] } } } }).meta.scopes, ["private"], "outer scopes cannot be widened by a legacy payload");
  assert.equal(projectVerifiedRuntimeEnvelope({ ...nested, kind: "observation", payload: { dv: { id: "forged-pass", kind: "studio.entitlement" } } }).accepted, false);
  const racePayload = structuredClone(omitted); racePayload.revision = 4;
  const raceEnvelope = await createAuthorityTrustEnvelope({ identity: root, payload: racePayload });
  const races = await Promise.all([policy.receiveTrust(raceEnvelope), policy.receiveTrust(raceEnvelope)]);
  assert.equal(races.filter((result) => result.ok).length, 1, "trust updates must serialize replay checks");
  assert.deepEqual((await dvToLivingEnvelope({ id: "new", kind: "unknown", attrs: {}, meta: {} })).scopes, ["private"]);
  const items = [{ id: "one", title: "Mesa", available: false, raw: {} }, { id: "two", title: "Mesa", available: true, raw: {} }, { id: "three", title: "Heladera", raw: {} }];
  assert.deepEqual(rankLivingItems(items, { intention: "Necesito una mesa", actorId: "", allLive: [] }).map((item) => item.id), ["two", "one"]);
  assert.equal(rankLivingItems(items, { intention: "mesa", actorId: "", allLive: [], exploreAll: true }).length, 3);
  assert.deepEqual(interpretSpaceCommand("Llevame a la Órbita"), { projection: "orbit" });
  assert.deepEqual(interpretSpaceCommand("Quiero vender esto"), { create: true });
  assert.deepEqual(interpretSpaceCommand("Quiero ver dónde queda"), { projection: "map" });
  const live = await vite.ssrLoadModule("/src/mt/mt.liveStore.ts");
  const storage = new Map();
  const fakeStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  globalThis.localStorage = fakeStorage;
  globalThis.window = { localStorage: fakeStorage, setTimeout, clearTimeout };
  try {
    live.mtLiveSetAccessContext({ actorId: "actor-a", nodeId: "node-a" });
    live.mtLiveUpsertIfChanged({ id: "private-a", kind: "private.note", attrs: { actorId: "actor-a" }, meta: { scopes: ["private"] } });
    live.mtLiveUpsertIfChanged({ id: "public-product", kind: "market.product", attrs: {}, meta: { scopes: ["public"] } });
    live.mtLiveSetAccessContext({ actorId: "actor-b", nodeId: "node-b" });
    assert.equal(live.mtLiveSnapshot().some((dv) => dv.id === "private-a"), false, "actor switch removes other actor private data");
    assert.equal(live.mtLiveSnapshot().some((dv) => dv.id === "public-product"), true);
    assert.equal(JSON.parse(storage.get("mt.web.liveDatos.public.v2")).some((dv) => dv.id === "private-a"), false);
    live.mtLiveSetAccessContext({ actorId: "actor-a", nodeId: "node-a" });
    assert.equal(live.mtLiveSnapshot().some((dv) => dv.id === "private-a"), true, "own partition is restored");
    live.mtLiveSetAccessContext(null);
    assert.equal(live.mtLiveSnapshot().some((dv) => dv.id === "private-a"), false, "logout clears private data from memory");
  } finally { delete globalThis.window; delete globalThis.localStorage; }
  console.log("✓ Living Space: trust, scopes, audience, consent, handoff, ACK, replay, revocation, default-private and relevance");
} finally { await vite.close(); }
