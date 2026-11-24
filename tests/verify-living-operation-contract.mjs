import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function loadTs(path) {
  const source = await read(path);
  const transformed = await transformWithEsbuild(source, path, {
    loader: "ts",
    format: "esm",
    target: "es2022",
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`
  );
}

const protocol = await loadTs("src/mt/mt.threadProtocol.ts");
const work = await loadTs("src/mt/Workadapter.ts");

const threadId = "thread:milk:weekly";
const buyerId = "actor:buyer";
const sellerId = "actor:producer";
const driverId = "actor:driver";
const at = (minute) => `2026-08-08T13:${String(minute).padStart(2, "0")}:00.000Z`;
const dv = (id, kind, attrs = {}, minute = 0) => ({
  id,
  kind,
  attrs: {
    threadId,
    chainId: threadId,
    participants: [buyerId, sellerId],
    ...attrs,
  },
  meta: { ns: "mt:market", ts: at(minute), threadId, chainId: threadId },
});

const recurrentIntent = dv(
  "work.intent:milk",
  "work.intent",
  {
    title: "Necesito 10 litros de leche cada lunes",
    text: "Necesito 10 litros de leche cada lunes",
    requesterId: buyerId,
    fromActorId: buyerId,
    fromActorName: "Ana",
    status: "open",
  },
  1,
);

// A. Un deseo recurrente no es una suscripción.
const desireOnly = protocol.deriveSubscriptionState([recurrentIntent], buyerId);
assert.equal(desireOnly.exists, false);
assert.equal(desireOnly.canCancel, false);
assert.equal(desireOnly.autopay.canRevoke, false);

const subscriptionActive = dv(
  "subscription.active:milk",
  "subscription.active",
  {
    subscriptionId: "subscription:milk",
    title: "Leche semanal",
    status: "active",
    buyerId,
    sellerId,
    nextOccurrence: "2026-08-10T08:00:00.000Z",
  },
  5,
);

// B. Una recurrencia manual se administra sin inventar autopay.
const manual = protocol.deriveSubscriptionState(
  [recurrentIntent, subscriptionActive],
  buyerId,
);
assert.equal(manual.status, "active");
assert.equal(manual.canCancel, true);
assert.equal(manual.autopay.status, "none");
assert.equal(manual.autopay.canRevoke, false);
assert.equal(
  protocol.deriveThreadState([recurrentIntent, subscriptionActive], buyerId)
    .primaryAction,
  "manage_recurrence",
);

const authorization = dv(
  "payment.autopay.authorization:milk",
  "payment.autopay.authorization",
  {
    subscriptionId: "subscription:milk",
    authorizationId: "autopay:milk",
    status: "active",
    buyerId,
    sellerId,
  },
  6,
);

// C. Solo una autorización real habilita su desactivación.
const automatic = protocol.deriveSubscriptionState(
  [recurrentIntent, subscriptionActive, authorization],
  buyerId,
);
assert.equal(automatic.autopay.status, "active");
assert.equal(automatic.autopay.canRevoke, true);

const revokeRequest = dv(
  "payment.autopay.revoke.request:milk",
  "payment.autopay.revoke.request",
  {
    subscriptionId: "subscription:milk",
    authorizationId: "autopay:milk",
    status: "requested",
    actorId: buyerId,
  },
  7,
);
const requested = protocol.deriveSubscriptionState(
  [recurrentIntent, subscriptionActive, authorization, revokeRequest],
  buyerId,
);
assert.equal(requested.autopay.status, "active");
assert.equal(requested.autopay.pendingRevoke, true);

const revoked = dv(
  "payment.autopay.revoked:milk",
  "payment.autopay.revoked",
  {
    subscriptionId: "subscription:milk",
    authorizationId: "autopay:milk",
    status: "revoked",
    authority: "node:payment",
  },
  8,
);

// D. El outcome revocado desactiva la acción y no cancela la recurrencia.
const afterRevoke = protocol.deriveSubscriptionState(
  [recurrentIntent, subscriptionActive, authorization, revokeRequest, revoked],
  buyerId,
);
assert.equal(afterRevoke.status, "active");
assert.equal(afterRevoke.autopay.status, "revoked");
assert.equal(afterRevoke.autopay.canRevoke, false);

// E. El estado se reconstruye solamente desde los mismos DVs serializados.
assert.deepEqual(
  protocol.deriveSubscriptionState(
    JSON.parse(
      JSON.stringify([
        recurrentIntent,
        subscriptionActive,
        authorization,
        revokeRequest,
        revoked,
      ]),
    ),
    buyerId,
  ),
  afterRevoke,
);

const delivery = dv(
  "delivery.status:milk",
  "delivery.status",
  {
    state: "delivered",
    buyerId,
    driverId,
    assignedToActorId: driverId,
    domain: "logistics.delivery",
  },
  12,
);

// F. Dos actores ven acciones diferentes según su relación con el hilo.
const buyerState = protocol.deriveThreadState(
  [recurrentIntent, delivery],
  buyerId,
);
const driverState = protocol.deriveThreadState(
  [recurrentIntent, delivery],
  driverId,
);
assert.equal(buyerState.primaryAction, "confirm_received");
assert.equal(buyerState.primaryEnabled, true);
assert.equal(driverState.role, "driver");
assert.equal(driverState.primaryEnabled, false);

// G. Responder conserva exactamente el mismo hilo.
const response = protocol.buildThreadActionDV({
  kind: "trade.message",
  threadId,
  chainId: threadId,
  rootDvId: recurrentIntent.id,
  parentDvId: delivery.id,
  responseToId: delivery.id,
  text: "Recibido",
  fromActorId: buyerId,
  toActorId: driverId,
  participants: [buyerId, driverId],
});
assert.equal(protocol.resolveDvThreadId(response), threadId);

// H. Un evento conversacional no reemplaza el tema raíz.
const onTheWayMessage = dv(
  "trade.message:on-way",
  "trade.message",
  {
    text: "Voy en camino 🚚",
    fromActorId: driverId,
    rootDvId: recurrentIntent.id,
  },
  10,
);
const title = protocol.resolveHumanThreadTitle(
  [recurrentIntent, onTheWayMessage],
  [recurrentIntent, onTheWayMessage],
);
assert.doesNotMatch(title, /voy en camino|conversaci[oó]n sobre/i);
assert.match(title, /leche/i);

// I. Los timestamps se presentan humanamente.
assert.equal(
  protocol.formatHumanThreadTime(at(10), Date.parse("2026-08-08T14:00:00.000Z")),
  `Hoy · ${new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at(10)))}`,
);
assert.doesNotMatch(protocol.formatHumanThreadTime(at(10)), /^\d{4}-/);

// Capacidad real antes de tomar un trabajo.
const workAggregate = work.aggregateWorkCards([
  work.toWorkCard({
    ...recurrentIntent,
    attrs: {
      ...recurrentIntent.attrs,
      workId: "work:delivery:milk",
      domain: "logistics.delivery",
      requestedCapabilities: ["Transportar y entregar pedidos"],
      quantity: 1,
    },
  }),
].filter(Boolean))[0];
const capability = {
  id: "capability:driver",
  kind: "capability.offer",
  attrs: {
    actorId: driverId,
    capabilities: ["Transportar y entregar pedidos"],
    availability: { status: "available" },
  },
  traits: ["resonance:capable", "work:domain:logistics.delivery"],
  meta: { ts: at(2) },
};
assert.equal(
  work.deriveWorkEligibility([capability], workAggregate, {
    actorId: driverId,
  }).eligible,
  true,
);
assert.equal(
  work.deriveWorkEligibility([capability], workAggregate, {
    actorId: "actor:unrelated",
  }).eligible,
  false,
);

// J. La UI principal no conserva las acciones/afirmaciones falsas anteriores.
const inboxSource = await read("src/mt/tradeinboxPanel.tsx");
const workInboxSource = await read("src/mt/workinboxpanel.tsx");
const queueSource = await read("src/mt/ProducerQueuePanel.tsx");
const checkoutSource = await read("src/pages/checkoutmodal.tsx");
const subscriptionPanelSource = await read("src/mt/SubscriptionPanel.tsx");
const ordersSource = await read("src/mt/pedidos.tsx");
assert.doesNotMatch(inboxSource, /El débito automático fue cancelado/);
assert.doesNotMatch(inboxSource, />Cancelar suscripción</);
assert.doesNotMatch(inboxSource, /paymentStatus:\s*["']paid["']/);
assert.doesNotMatch(inboxSource, /safeStr\(m\?\.meta\?\.ts \|\| ""\)/);
assert.match(workInboxSource, /eligibility\.eligible/);
assert.doesNotMatch(workInboxSource, /Tomar acción/);
assert.match(queueSource, /item\.status !== "open"/);
assert.doesNotMatch(checkoutSource, /emitMandateCreate/);
assert.match(checkoutSource, /buildSubscriptionEventDV\("subscription\.proposal"/);
assert.match(subscriptionPanelSource, /buildAutopayAuthorizationRequestDV/);
assert.doesNotMatch(subscriptionPanelSource, /Débito automático activado/);
assert.doesNotMatch(ordersSource, /buildMandateCancelDV|cancelado automáticamente/);

console.log(
  JSON.stringify(
    {
      desireIsSubscription: desireOnly.exists,
      manualAutopay: manual.autopay.status,
      activeAutopay: automatic.autopay.status,
      revokeRequestChangesOutcome: requested.autopay.status !== "active",
      revokedAutopay: afterRevoke.autopay.status,
      buyerAction: buyerState.primaryAction,
      driverActionEnabled: driverState.primaryEnabled,
      threadIdPreserved: protocol.resolveDvThreadId(response) === threadId,
      title,
      eligibleDriver: true,
      unrelatedActorEligible: false,
    },
    null,
    2,
  ),
);
