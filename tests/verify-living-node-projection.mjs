import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const builders = await vite.ssrLoadModule("/src/social/liveNetwork.builders.ts");
  const projection = await vite.ssrLoadModule("/src/utopy/livingNodeProjection.ts");
  const node = (nodeId, name, capability) => builders.buildLiveProfileDV({ actorId: `actor:${nodeId}`, nodeId, actorName: name, bio: "Nodo creado desde su Perfil Vivo", capabilities: [builders.capabilityFromHumanText(capability)], availableNow: true, serviceRadiusKm: 20, deliveryRangeKm: 12 });
  const live = [node("node:carpinteria-juan", "Carpintería Juan", "Fabricar muebles"), node("node:madefer", "Madefer", "Proveer materiales"), node("node:peluqueria-luna", "Peluquería Luna", "Cortar cabello")];
  for (const expected of [["node:carpinteria-juan", "Carpintería Juan"], ["node:madefer", "Madefer"], ["node:peluqueria-luna", "Peluquería Luna"]]) {
    const resolved = projection.resolveLivingNode(expected[0], live);
    assert.equal(resolved?.name, expected[1]);
    assert.equal(resolved?.capabilities.length, 1);
    assert.equal(resolved?.availability?.availableNow, true);
  }
  assert.equal(projection.projectLivingNodes(live).length, 3);
  const manifest = { id: "manifest:test", kind: "node.profile", attrs: { nodeId: "utopy.node.example", storeId: "example", handle: "example-live", displayName: "Ejemplo Vivo", avatarRef: "https://example.test/avatar.jpg", capabilities: [] }, meta: { scopes: ["public"], authority: "utopy.node.example" } };
  const product = { id: "product:test", kind: "mt:producto", attrs: { sellerNodeId: "example", sellerName: "Ejemplo Vivo", productId: "test", nombre: "Objeto vivo", stockQty: 1, available: true }, meta: { scopes: ["public"], authority: "example" } };
  const reconciled = projection.resolveLivingNode("example", [manifest, product]);
  assert.equal(reconciled?.nodeId, "utopy.node.example");
  assert.equal(reconciled?.products.length, 1);
  assert.equal(reconciled?.avatarRef, "https://example.test/avatar.jpg");
  console.log("✓ Nodo Vivo nuevo, séptimo nodo y capacidades abiertas verificados sin código comercial");
} finally { await vite.close(); }
