import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { publicGeoPoint, canRelate, distanceKmBetween } = await server.ssrLoadModule("/src/utopy/territorialCompatibility.ts");
  const publicNode = { kind: "node.profile", attrs: { publicLocation: true, geo: { lat: -24.06763, lng: -54.31014 }, ranges: { deliveryRangeKm: 20 } } };
  const privatePerson = { kind: "person.profile", attrs: { geo: { lat: -24.06763, lng: -54.31014 } } };
  const privateSignal = { kind: "resonance.intent", attrs: { geo: { lat: -24.06763, lng: -54.31014 }, privacyPolicies: ["noLocationDisclosure"] } };
  assert.deepEqual(publicGeoPoint(publicNode), { lat: -24.07, lng: -54.31, precision: "approximate" });
  assert.equal(publicGeoPoint(privatePerson), null);
  assert.equal(publicGeoPoint(privateSignal), null);
  const user = { attrs: { geo: { lat: -24, lng: -54 } } };
  const delivery = { attrs: { geo: { lat: -24.108, lng: -54 }, ranges: { deliveryRangeKm: 20 } } };
  assert.equal(canRelate({ need: user, capability: delivery, action: "physical_product" }).recommended, true);
  assert.ok(distanceKmBetween(user, delivery) > 10);
  console.log("✓ Geografía compartida, ubicación pública aproximada y alcance territorial verificados");
} finally { await server.close(); }
