import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const vite = await createServer({
  root: fileURLToPath(root),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
const cycleProtocol = await vite.ssrLoadModule("/src/mt/mt.checkoutPurchaseCycle.ts");
const now = Date.parse("2026-08-09T15:00:00.000Z");

function orderFor(sellerNodeId) {
  return {
    id: `market.order:buyer:test:${sellerNodeId}`,
    kind: "market.order.create",
    attrs: {
      orderId: `market.order:buyer:test:${sellerNodeId}`,
      threadId: `thread:${sellerNodeId}`,
      chainId: `chain:${sellerNodeId}`,
      buyerId: "actor:buyer:test",
      buyerActorId: "actor:buyer:test",
      sellerNodeId,
      targetNodeId: sellerNodeId,
      total: 500,
      currency: "BRL",
      status: "sent",
    },
    meta: { ts: "2026-08-09T14:59:00.000Z" },
  };
}

function nodeEvent(order, kind, suffix, extra = {}, responseNodeId) {
  const sellerNodeId = responseNodeId || order.attrs.sellerNodeId;
  return {
    id: `${kind}:${suffix}:${sellerNodeId}`,
    kind,
    authority: sellerNodeId,
    sourceNodeId: sellerNodeId,
    attrs: {
      orderId: order.attrs.orderId,
      threadId: order.attrs.threadId,
      chainId: order.attrs.chainId,
      buyerActorId: order.attrs.buyerActorId,
      sellerNodeId,
      actingAsNodeId: sellerNodeId,
      targetNodeId: order.attrs.buyerActorId,
      ...extra,
    },
    meta: {
      ts: `2026-08-09T15:00:${suffix}.000Z`,
      authority: sellerNodeId,
      targetNodeId: order.attrs.buyerActorId,
    },
  };
}

function buyerProof(order, suffix, proofRef) {
  return {
    id: `payment.proof:${suffix}:${order.attrs.sellerNodeId}`,
    kind: "payment.proof",
    attrs: {
      proofRef,
      orderId: order.attrs.orderId,
      threadId: order.attrs.threadId,
      chainId: order.attrs.chainId,
      buyerActorId: order.attrs.buyerActorId,
      sellerNodeId: order.attrs.sellerNodeId,
      targetNodeId: order.attrs.sellerNodeId,
      submittedAt: `2026-08-09T15:00:${suffix}.000Z`,
    },
    meta: {
      ts: `2026-08-09T15:00:${suffix}.000Z`,
      authority: order.attrs.buyerActorId,
      targetNodeId: order.attrs.sellerNodeId,
    },
  };
}

function proveUniversalCycle(sellerNodeId, destinationValue, responseNodeId) {
  const order = orderFor(sellerNodeId);
  const received = nodeEvent(order, "market.order.received", "01", {}, responseNodeId);
  const unrelatedOffer = nodeEvent(order, "payment.offer", "02", {
    amount: 999,
    currency: "BRL",
    expiresAt: "2026-08-09T16:00:00.000Z",
    methods: [{ method: "transfer", destination: { label: "Alias", value: "wrong" } }],
  }, responseNodeId);
  const offer = nodeEvent(order, "payment.offer", "03", {
    amount: 500,
    currency: "BRL",
    expiresAt: "2026-08-09T16:00:00.000Z",
    methods: [
      {
        method: "transfer",
        label: "Transferencia",
        destination: { label: "Alias", value: destinationValue },
      },
    ],
    proofUpload: {
      endpoint: `https://${sellerNodeId.replace(/[^a-z0-9]/gi, "-")}.test/private/proof`,
      challenge: "challenge-for-this-order",
    },
  }, responseNodeId);
  const firstProof = buyerProof(order, "04", "proof_ref_first");
  const rejected = nodeEvent(order, "payment.proof.rejected", "05", {
    reasonCode: "unreadable",
  }, responseNodeId);
  const secondProof = buyerProof(order, "06", "proof_ref_second");
  const review = nodeEvent(order, "payment.proof.review", "07", {}, responseNodeId);
  const outcome = nodeEvent(order, "payment.outcome", "08", {
    amount: 500,
    currency: "BRL",
    status: "paid",
  }, responseNodeId);
  const accepted = nodeEvent(order, "market.order.accept", "09", {}, responseNodeId);
  const verified = new Set([
    received,
    unrelatedOffer,
    offer,
    firstProof,
    rejected,
    secondProof,
    review,
    outcome,
    accepted,
  ].map((dv) => dv.id));
  const project = (allLive) =>
    cycleProtocol.projectCheckoutPurchaseCycle({ order, allLive, verifiedIds: verified, now });

  assert.equal(project([]).state, "sent");
  assert.equal(project([received]).state, "received");
  assert.equal(project([received, unrelatedOffer]).state, "received");
  const offered = project([received, unrelatedOffer, offer]);
  assert.equal(offered.state, "awaiting_payment");
  assert.equal(offered.paymentMethods[0].destination.value, destinationValue);
  assert.equal(
    cycleProtocol.resolvePrivatePaymentProofRoute({ offer })?.endpoint,
    offer.attrs.proofUpload.endpoint,
  );
  assert.equal(project([received, offer, firstProof]).state, "proof_submitted");
  assert.equal(project([received, offer, firstProof, rejected]).state, "proof_rejected");
  assert.equal(
    project([received, offer, firstProof, rejected, secondProof]).state,
    "proof_submitted",
  );
  assert.equal(
    project([received, offer, firstProof, rejected, secondProof, review]).state,
    "payment_review",
  );
  assert.equal(
    project([received, offer, secondProof, review, outcome]).state,
    "payment_confirmed",
  );
  assert.equal(
    project([received, offer, secondProof, review, outcome, accepted]).state,
    "accepted",
  );
}

proveUniversalCycle("utopy.node.alpha", "alpha-payment-reference");
proveUniversalCycle("utopy.node.test", "different-payment-reference");
proveUniversalCycle("decohogar", "canonical-node-reference", "utopy.node.decohogar");

{
  const order = orderFor("shop-one");
  const received = nodeEvent(order, "market.order.received", "10", {}, "utopy.node.other");
  const cycle = cycleProtocol.projectCheckoutPurchaseCycle({
    order,
    allLive: [received],
    verifiedIds: new Set([received.id]),
    now,
  });
  assert.equal(cycle.state, "sent", "aliases arbitrarios no deben correlacionarse");
}

const proofDv = cycleProtocol.buildPrivatePaymentProofDV({
  proofRef: "private_ref_82",
  orderId: "order:fixture",
  threadId: "thread:fixture",
  chainId: "chain:fixture",
  buyerActorId: "actor:buyer:test",
  sellerNodeId: "utopy.node.test",
  submittedAt: "2026-08-09T15:10:00.000Z",
});
assert.deepEqual(Object.keys(proofDv.attrs).sort(), [
  "buyerActorId",
  "chainId",
  "orderId",
  "proofRef",
  "sellerNodeId",
  "submittedAt",
  "threadId",
]);
assert.equal(JSON.stringify(proofDv).includes("private/proof"), false);

const checkoutSource = await read("src/pages/checkoutmodal.tsx");
const protocolSource = await read("src/mt/mt.checkoutPurchaseCycle.ts");
const liveStoreSource = await read("src/mt/mt.liveStore.ts");
const combined = `${checkoutSource}\n${protocolSource}`;

assert.doesNotMatch(combined, /7636446/);
assert.doesNotMatch(combined, /DecoHogar/i);
assert.match(checkoutSource, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(checkoutSource, /capture="environment"/);
assert.match(checkoutSource, /proofRef,/);
assert.doesNotMatch(checkoutSource, /proof:\s*\{\s*type:\s*"image"|readAsDataURL/);
assert.doesNotMatch(protocolSource, /base64|blobUrl|publicUrl|localStorage/);
assert.doesNotMatch(liveStoreSource, /FileReader|readAsDataURL|payment proof upload/i);
assert.match(protocolSource, /form\.append\("file", input\.file/);
assert.match(protocolSource, /form\.append\("orderId", input\.orderId\)/);
assert.match(protocolSource, /form\.append\("buyerActorId", input\.buyerActorId\)/);
assert.match(protocolSource, /PAYMENT_PROOF_MAX_BYTES = 5 \* 1024 \* 1024/);

console.log(
  JSON.stringify(
    {
      orderStates: "sent-to-accepted-with-separate-authorities",
      offerScope: "exact-order-and-value",
      privateUpload: "direct-endpoint-to-proofRef",
      universalNodes: 2,
      hardcodedSeller: false,
    },
    null,
    2,
  ),
);

await vite.close();
