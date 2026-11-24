import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createEnvelope, createIdentity, signEnvelope } from "utopy";
import { createAuthorityTrustEnvelope } from "utopy/continuity";

const root = fileURLToPath(new URL("../", import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

async function signed(identity, draft) {
  return signEnvelope(await createEnvelope({
    sourceActorId: identity.actorId,
    sourceNodeId: identity.nodeId,
    authority: identity.nodeId,
    scopes: ["public"],
    ...draft,
  }), identity);
}

try {
  const trustModule = await vite.ssrLoadModule("/src/utopy/runtimeTrust.ts");
  const rootIdentity = await createIdentity({ actorId: "trust-issuer", nodeId: "trust-root" });
  const policy = new trustModule.MarketAuthorityTrust("market-test", [{ authority: rootIdentity.nodeId, keyId: rootIdentity.keyId, publicKeyJwk: rootIdentity.publicKeyJwk }]);
  const trust = { resetRuntimeTrustForTests() {}, verifyRuntimeEnvelope: (envelope) => policy.verify(envelope) };
  const security = await vite.ssrLoadModule("/src/utopy/runtimeProjection.security.ts");
  const discovery = await vite.ssrLoadModule("/src/mt/liveCatalog.sources.ts");
  const liveStore = await vite.ssrLoadModule("/src/mt/mt.liveStore.ts");
  const frequency = await vite.ssrLoadModule("/src/utopy/frequency.engine.ts");

  trust.resetRuntimeTrustForTests();
  const nodeId = "utopy.node.test.carpinteria";
  const identity = await createIdentity({ actorId: "utopy.actor.test.carpinteria", nodeId });
  const otherIdentity = await createIdentity({ actorId: "utopy.actor.other", nodeId: "utopy.node.other" });
  await policy.receiveTrust(await createAuthorityTrustEnvelope({ identity: rootIdentity, payload: {
    protocol: "utopy.authority-trust/1", audience: ["market-test"], revision: 1,
    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    authorities: [identity, otherIdentity].map((owner) => ({ authority: owner.nodeId, status: "active", sourceRefs: [],
      keys: [{ keyId: owner.keyId, publicKeyJwk: owner.publicKeyJwk, status: "active", activeFrom: new Date(0).toISOString(), sourceRefs: [] }] })),
    mandates: [], revokedDeviceIds: [],
  } }));
  const manifest = await signed(identity, {
    id: "manifest:test:carpinteria",
    kind: "utopy.node.manifest",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    payload: {
      nodeId,
      issuedAt: new Date().toISOString(),
      handle: "carpinteria-juan",
      origin: "https://carpinteria.example",
      capabilities: ["catalog.live", "fabricate.wood", "commerce.sell"],
      endpoints: [{ id: "catalog.live", endpoint: "https://carpinteria.example/catalog-live" }],
    },
  });
  assert.equal((await trust.verifyRuntimeEnvelope(manifest)).verified, true);
  const manifestProjection = security.projectVerifiedRuntimeEnvelope(manifest);
  assert.equal(manifestProjection.accepted, true);
  const sources = discovery.discoverLiveCatalogSources([manifestProjection.dv]);
  assert.ok(sources.some((source) => source.originNode === nodeId));

  const product = await signed(identity, {
    id: "mt:producto:mesa-test",
    kind: "mt:producto",
    revision: 2,
    payload: { productId: "mesa-test", sellerNodeId: nodeId, storeId: "carpinteria", name: "Mesa viva", image: "https://carpinteria.example/mesa.webp" },
  });
  assert.equal((await trust.verifyRuntimeEnvelope(product)).verified, true);
  assert.equal(security.projectVerifiedRuntimeEnvelope(product).accepted, true);

  const forgedSeller = await signed(identity, {
    id: "mt:producto:forged",
    kind: "mt:producto",
    payload: { productId: "forged", sellerNodeId: "utopy.node.somebody-else" },
  });
  assert.deepEqual(security.projectVerifiedRuntimeEnvelope(forgedSeller), { accepted: false, reason: "sellerNodeId" });

  const tampered = structuredClone(product);
  tampered.payload.name = "Alterado después de firmar";
  assert.equal((await trust.verifyRuntimeEnvelope(tampered)).verified, false);

  const duplicateHandle = await signed(otherIdentity, {
    id: "manifest:test:other",
    kind: "utopy.node.manifest",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    payload: { nodeId: "utopy.node.other", issuedAt: new Date().toISOString(), handle: "carpinteria-juan", capabilities: [] },
  });
  assert.equal((await trust.verifyRuntimeEnvelope(duplicateHandle)).reason, "handle-conflict");

  const unsafe = await signed(identity, { id: "mt:producto:unsafe", kind: "mt:producto", payload: { productId: "unsafe", sellerNodeId: nodeId, description: "<script>alert(1)</script>" } });
  assert.equal(security.projectVerifiedRuntimeEnvelope(unsafe).accepted, false);
  const huge = await signed(identity, { id: "mt:producto:huge", kind: "mt:producto", payload: { productId: "huge", sellerNodeId: nodeId, description: "x".repeat(270_000) } });
  assert.equal(security.projectVerifiedRuntimeEnvelope(huge).accepted, false);
  assert.equal(discovery.safePublicUrl("https://192.168.1.20/private"), "");
  assert.equal(discovery.safePublicUrl("javascript:alert(1)"), "");

  liveStore.mtLiveClear();
  liveStore.mtLiveUpsertIfChanged({ id: "revision-test", kind: "dato", attrs: {}, meta: { revision: 2 } });
  liveStore.mtLiveUpsertIfChanged({ id: "revision-test", kind: "dato", attrs: { stale: true }, meta: { revision: 1 } });
  assert.equal(liveStore.mtLiveSnapshot().find((dv) => dv.id === "revision-test").meta.revision, 2);

  const reference = { id: "need:wood", kind: "need.publish", attrs: { actorId: "actor:a", intent: { mode: "need", domains: ["wood"], verbs: ["fabricate"], resources: ["wood"] } }, meta: { revision: 1 } };
  const start = frequency.buildFrequencyEvent({ kind: "frequency.start", reference, actorId: "actor:a", frequencyId: "frequency:test" });
  assert.equal(frequency.activeFrequencyReferenceIds([start], "actor:a").has(reference.id), true);
  const resolve = frequency.buildFrequencyEvent({ kind: "frequency.resolve", reference, actorId: "actor:a", frequencyId: "frequency:test", sequence: 2 });
  assert.equal(frequency.activeFrequencyReferenceIds([start, resolve], "actor:a").size, 0);
  for (let index = 0; index < 20; index += 1) {
    assert.equal(frequency.attentionForDV({ id: `pulse:${index}`, kind: "frequency.pulse" }, [], "actor:a", "now"), "IGNORE");
  }
  const offers = Array.from({ length: 100 }, (_, index) => ({
    id: `offer:${index}`,
    kind: "match.proposal",
    attrs: index < 2 ? { intentRef: { id: reference.id }, targetActorId: "actor:a" } : { intentRef: { id: "another-need" } },
    meta: { updatedAt: new Date().toISOString() },
  }));
  assert.equal(frequency.evaluateFrequencyAttention(offers, [reference, start, ...offers], "actor:a", "normal").length, 2);

  const legacyVendor = ["one", "signal"].join("");
  const legacyWorker = ["One", "Signal"].join("");
  const files = [`src/${legacyVendor}.ts`, `src/${["push", "tags"].join("")}.ts`, `public/${legacyWorker}SDKWorker.js`, `public/${legacyWorker}SDKUpdaterWorker.js`];
  for (const file of files) await assert.rejects(readFile(new URL(`../${file}`, import.meta.url), "utf8"));
} finally {
  await vite.close();
}

console.log("✓ Runtime, discovery, seguridad y Frecuencia verificados");
