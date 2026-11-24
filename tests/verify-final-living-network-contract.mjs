import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function loadTs(path) {
  const source = await read(path);
  const transformed = await transformWithEsbuild(source, path, {
    loader: path.endsWith(".tsx") ? "tsx" : "ts",
    format: "esm",
    target: "es2022",
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`
  );
}

const relationships = await loadTs("src/utopy/relationshipProtocol.ts");
const value = await loadTs("src/value/value.engine.ts");
const workActions = await loadTs("src/mt/work.action.ts");
const work = await loadTs("src/mt/Workadapter.ts");
const presentation = await loadTs("src/mt/livePresentation.ts");

// 1. Relación, hilo y cadena conservan identidades diferentes.
const relationshipId = "relationship:test:milk";
const request = relationships.buildRelationshipRequestDV({
  relationshipId,
  actorId: "actor:ana",
  parties: [
    { actorId: "actor:ana", role: "buyer" },
    { nodeId: "node:farm", role: "seller" },
  ],
  purpose: "Abastecimiento de leche",
});
const accepted = relationships.buildRelationshipAcceptedDV({
  request,
  actorId: "actor:farmer",
  actingAsNodeId: "node:farm",
});
const relationView = relationships.deriveRelationshipSnapshot(
  [request, accepted],
  relationshipId,
);
assert.equal(relationView.status, "active");
assert.equal(relationView.bilateral, true);
assert.notEqual(relationshipId, "chain:order:1");
assert.notEqual(relationshipId, "thread:conversation:1");

// 2. Un proveedor habitual propone primero y nunca autoacepta por defecto.
const serviceProposal = relationships.buildServiceRelationshipProposalDV({
  relationshipId: "service.rel:transport",
  consumerNodeId: "node:lapiedra",
  providerNodeId: "node:driver",
  actorId: "actor:lapiedra-controller",
  actingAsNodeId: "node:lapiedra",
  capability: "delivery.local",
  preference: "preferred",
});
const serviceAccepted = relationships.buildServiceRelationshipAcceptedDV({
  proposal: serviceProposal,
  actorId: "actor:driver",
  actingAsNodeId: "node:driver",
});
const preferred = relationships.preferredProvidersFor(
  [serviceProposal, serviceAccepted],
  "node:lapiedra",
  "delivery.local",
);
assert.equal(preferred.length, 1);
assert.equal(preferred[0].service.autoPropose, true);
assert.equal(preferred[0].service.autoAccept, false);

// 3. Ofrecer, comprometer, entregar y verificar son estados distintos.
const need = {
  id: "value.need:tomatoes",
  kind: "value.need",
  attrs: {
    requirements: [
      { key: "tomato", label: "Tomates", kind: "material", amount: 80, unit: "kg" },
    ],
  },
};
const contribution = (id, amount) => ({
  id,
  kind: "value.contribution",
  attrs: {
    needId: need.id,
    capabilityKey: "tomato",
    amount,
    unit: "kg",
    status: "offered",
  },
});
const c30 = contribution("contribution:30", 30);
const c50 = contribution("contribution:50", 50);
const agreement = (id) => ({
  id: `agreement:${id}`,
  kind: "value.agreement",
  attrs: { needId: need.id, contributionId: id, status: "accepted" },
});
let composition = value.computeValueComposition(need, [c30, c50]);
assert.equal(composition.committedCoverage, 0);
assert.equal(composition.verifiedCoverage, 0);
composition = value.computeValueComposition(need, [
  c30,
  c50,
  agreement(c30.id),
  agreement(c50.id),
]);
assert.equal(composition.committedCoverage, 100);
assert.equal(composition.verifiedCoverage, 0);
assert.equal(composition.status, "covered");
const delivered = {
  id: "outcome:30",
  kind: "value.contribution.outcome",
  attrs: { needId: need.id, contributionId: c30.id, status: "delivered" },
};
assert.equal(
  value.computeValueComposition(need, [c30, c50, agreement(c30.id), agreement(c50.id), delivered])
    .verifiedCoverage,
  0,
);
const verified = (id) => ({
  id: `verified:${id}`,
  kind: "value.contribution.verified",
  attrs: { needId: need.id, contributionId: id, status: "verified" },
});
composition = value.computeValueComposition(need, [
  c30,
  c50,
  agreement(c30.id),
  agreement(c50.id),
  delivered,
  verified(c30.id),
]);
assert.equal(composition.requirements[0].verifiedAmount, 30);
assert.equal(composition.fulfilled, false);
composition = value.computeValueComposition(need, [
  c30,
  c50,
  agreement(c30.id),
  agreement(c50.id),
  verified(c30.id),
  verified(c50.id),
]);
assert.equal(composition.fulfilled, true);
assert.equal(composition.status, "fulfilled");

// 4. La cotización conserva relación/cadena/hilo y no impone anticipo.
const quote = workActions.makeWorkQuoteDV({
  workId: "work:furniture:1",
  relationshipId: "relationship:furniture:1",
  chainId: "chain:furniture:1",
  threadId: "thread:furniture:1",
  actorId: "actor:carpenter",
  nodeId: "node:workshop",
  amount: 1_500_000,
  currency: "PYG",
  estimatedDays: 12,
});
assert.equal(quote.attrs.quote.depositPercent, 0);
assert.equal(quote.attrs.relationshipId, "relationship:furniture:1");
assert.equal(quote.attrs.chainId, "chain:furniture:1");
assert.equal(quote.attrs.threadId, "thread:furniture:1");
const quoteCard = work.toWorkCard(quote);
assert.equal(quoteCard.status, "quoted");
assert.equal(quoteCard.relationshipId, "relationship:furniture:1");

// 5. La presentación humana no filtra kinds ni identificadores técnicos.
const human = presentation.humanizeActivityDV({
  id: "work.intent:secret-id",
  kind: "work.intent",
  attrs: { title: "Entregar leche", requesterName: "Ana", domain: "logistics.delivery" },
  meta: { ts: "2026-08-08T13:00:00.000Z", scopes: ["public"] },
});
assert.match(human.title, /Ana necesita ayuda/i);
assert.doesNotMatch(`${human.title} ${human.detail}`, /work\.intent|secret-id/);

// 6. Contrato UI: mapa humano, feed responsive y checkout separado.
const mapSource = await read("src/pages/circularpanel.jsx");
for (const label of [
  "Necesitan",
  "Ofrecen",
  "Trabajo",
  "Entregas",
  "Materiales",
  "Comercios",
  "Financiación",
  "Circular",
  "Espacios",
]) assert.match(mapSource, new RegExp(label));
assert.match(mapSource, /ActivitySheet/);
assert.match(mapSource, /height: min\(58%, 470px\)/);
assert.doesNotMatch(mapSource, /else if \(\/product\|producto\/.*makePoint\("node"/);
assert.doesNotMatch(mapSource, /materialFilter/);

const checkoutSource = await read("src/pages/checkoutmodal.tsx");
assert.match(checkoutSource, /publishAuthorizedDV/);
assert.match(checkoutSource, /status: "sent"/);
assert.doesNotMatch(checkoutSource, /emitAutoSaleDocuments|buildReceiptDV|buildInvoiceDraftDV/);
assert.doesNotMatch(checkoutSource, /emitCreditAccount|emitCreditInstallment/);
assert.match(checkoutSource, /buildCreditRequestDV/);
assert.match(checkoutSource, /publishCreditRequest/);
assert.match(checkoutSource, /verifyCreditOffer/);
assert.doesNotMatch(checkoutSource, /provider:\s*deliveryMode.*falcon/);

const valuePanelSource = await read("src/value/ValueContributionPanel.tsx");
assert.match(valuePanelSource, /SHOW_VALUE_DEMOS = import\.meta\.env\.DEV/);
const falconShellSource = await read("src/components/FalconShell.tsx");
assert.match(falconShellSource, /<FalconDock\s*\/>/);

// 7-10. Identidad, manifiesto, delegación, falsificación y revocación reales.
const session = new Map();
globalThis.sessionStorage = {
  getItem: (key) => session.get(key) ?? null,
  setItem: (key, value) => session.set(key, String(value)),
  removeItem: (key) => session.delete(key),
  clear: () => session.clear(),
};

const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

try {
  const identity = await vite.ssrLoadModule("/src/utopy/identityContext.ts");
  const ownership = await vite.ssrLoadModule("/src/utopy/ownership.ts");
  const authorization = await vite.ssrLoadModule("/src/utopy/authorizedPublish.ts");
  const manifests = await vite.ssrLoadModule("/src/mt/utopy.nodeManifest.ts");

  const firstContext = await identity.resolveCurrentIdentityContext({
    activeActor: { id: "buyer:local", name: "Ana" },
  });
  const secondContext = await identity.resolveCurrentIdentityContext({
    activeActor: { id: "actor:someone-else", name: "Ana" },
  });
  assert.equal(firstContext.actorId, secondContext.actorId);
  assert.match(firstContext.actorId, /^actor:utopy:/);
  assert.doesNotMatch(firstContext.actorId, /buyer:local|actor:someone-else/);
  assert.equal(firstContext.sessionId, secondContext.sessionId);
  assert.notEqual(firstContext.actorId, firstContext.deviceId);

  const nodeId = "node:test:bakery";
  const unsignedManifest = manifests.buildNodeManifestDV({
    nodeId,
    nodeName: "Panadería Viva",
    endpoints: {},
    capabilities: ["commerce.order.receive"],
  });
  assert.equal((await manifests.verifyNodeManifestDV(unsignedManifest)).accepted, false);
  const signedManifest = (
    await authorization.publishAuthorizedDV({
      dv: unsignedManifest,
      allLive: [],
      actingAsNodeId: nodeId,
      requiredAuthority: nodeId,
      allowNodeBootstrap: true,
      localOnly: true,
    })
  ).dv;
  assert.equal(
    (await manifests.verifyNodeManifestDV(signedManifest, [signedManifest])).accepted,
    true,
  );

  // Un segundo dueño representa al empleado; su firma no controla el nodo.
  const employeeOwnership = await vite.ssrLoadModule(
    "/src/utopy/ownership.ts?employee-test",
  );
  const employeeWallet = await employeeOwnership.getWalletStatus();
  const employeeActorId = await identity.deriveActorIdForOwnerDid(
    employeeWallet.ownerDid,
  );
  assert.notEqual(employeeActorId, firstContext.actorId);

  const authDraft = identity.buildNodeAuthorizationDV({
    actorId: employeeActorId,
    nodeId,
    roles: ["cashier"],
    allowedActions: ["market.order.accept"],
    issuedByActorId: firstContext.actorId,
  });
  const signedAuthorization = (
    await authorization.publishAuthorizedDV({
      dv: authDraft,
      allLive: [signedManifest],
      actingAsNodeId: nodeId,
      requiredAuthority: nodeId,
      sensitivity: "sensitive",
      localOnly: true,
    })
  ).dv;
  assert.equal(signedAuthorization.attrs.actorId, employeeActorId);
  assert.equal(
    (await authorization.verifyAuthorizedDV(signedAuthorization, [signedManifest])).accepted,
    true,
  );

  const employeeAction = await employeeOwnership.sealOwnedDV(
    {
      id: "market.order.accept:test",
      kind: "market.order.accept",
      attrs: {
        actorId: employeeActorId,
        actor: { id: employeeActorId, name: "Empleado" },
        issuerActorId: employeeActorId,
        actingAsNodeId: nodeId,
        authority: nodeId,
        participants: [employeeActorId, nodeId],
      },
      meta: {
        issuer: employeeActorId,
        authority: nodeId,
        originNode: nodeId,
        sensitivity: "relationship",
        scopes: ["participants"],
        version: 1,
        nonce: "employee-action-1",
        ts: new Date().toISOString(),
      },
    },
    employeeActorId,
  );
  const liveAuthority = [signedManifest, signedAuthorization, employeeAction];
  assert.equal(
    (await authorization.verifyAuthorizedDV(employeeAction, liveAuthority)).accepted,
    true,
  );

  const forged = structuredClone(employeeAction);
  forged.attrs.actorId = firstContext.actorId;
  assert.equal(
    (await authorization.verifyAuthorizedDV(forged, liveAuthority)).accepted,
    false,
  );

  const revokeDraft = identity.buildNodeAuthorizationRevokedDV({
    authorizationId: signedAuthorization.id,
    actorId: employeeActorId,
    nodeId,
    reason: "Fin del turno",
  });
  const signedRevocation = (
    await authorization.publishAuthorizedDV({
      dv: revokeDraft,
      allLive: [signedManifest, signedAuthorization],
      actingAsNodeId: nodeId,
      requiredAuthority: nodeId,
      sensitivity: "sensitive",
      localOnly: true,
    })
  ).dv;
  assert.equal(
    (
      await authorization.verifyAuthorizedDV(employeeAction, [
        signedManifest,
        signedAuthorization,
        signedRevocation,
        employeeAction,
      ])
    ).accepted,
    false,
  );
} finally {
  await vite.close();
}

console.log(
  JSON.stringify(
    {
      relationship: "bilateral",
      habitualProvider: "propose-not-autoaccept",
      contribution: "committed-vs-verified",
      quote: "separate-and-linked",
      mapFeed: "human-and-private",
      checkout: "sent-before-accepted",
      identity: "actor-device-session-separated",
      manifest: "signed",
      delegation: "verified-and-revocable",
      falconDock: "preserved",
    },
    null,
    2,
  ),
);
