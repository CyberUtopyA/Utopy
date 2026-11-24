import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL("../src/utopy/livingCompositionDiscovery.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const runtimeComposition = new URL("../node_modules/utopy/dist/src/composition/index.js", import.meta.url).href;
const transformed = await transformWithEsbuild(source.replace('"utopy/composition"', JSON.stringify(runtimeComposition)), "livingCompositionDiscovery.ts", { loader: "ts", format: "esm", target: "es2022" });
const discovery = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

const composition = {
  id: "composition:table:1",
  kind: "composition.publish",
  attrs: {
    protocol: "utopy.living-composition/1",
    compositionId: "composition:table:1",
    revision: 1,
    intent: { summary: "Construir una mesa" },
    inputs: { materials: [{ material: "Madera laminada", quantity: 2, unit: "placas" }] },
    requiredCapabilities: [{ code: "fabrication.cnc.cut", traits: ["precision"] }],
    participants: [],
    steps: [{ stepId: "cut", executor: "human", capability: { code: "fabrication.cnc.cut", traits: ["precision"] }, outcomeKind: "part.cut" }],
    conditions: [],
    outcome: { kind: "table.ready", requiredStepIds: ["cut"] },
    authority: "utopy.node.creator",
    authorActorId: "actor:creator",
    createdAt: "2026-09-23T10:00:00.000Z",
    updatedAt: "2026-09-23T10:00:00.000Z",
    authorization: { mode: "explicit-consent", ref: "consent:1" },
    proposalOnly: true,
    authorityRequirements: [{ requirementId: "consent", stepIds: ["cut"], mode: "explicit-consent", permissions: [] }],
    resourceLimits: { allowedCapabilities: ["fabrication.cnc.cut"], maxExecutions: 1, maxDurationMs: 1000, maxOutputBytes: 1000, network: "none", storage: "none" },
    privacy: { visibility: "public", disclose: ["structure"], evidence: "private", inputs: "private" },
    evidenceRequirements: [],
    expectedOutcomes: [{ kind: "table.ready", requiredStepIds: ["cut"] }],
    composedFrom: [],
  },
  meta: { scopes: ["public"], runtimeVerified: true, revision: 1 },
};

const cnc = { id: "capability:cnc:1", kind: "capability.offer", attrs: { nodeId: "utopy.node.workshop", capabilities: [{ code: "fabrication.cnc.cut", traits: ["precision"] }], availability: { availableNow: true } }, meta: { scopes: ["public"] } };
const material = { id: "material:wood:1", kind: "material.offer", attrs: { nodeId: "utopy.node.supplier", material: "Madera laminada", available: true, stockQty: 10 }, meta: { scopes: ["public"] } };

assert.equal(discovery.isPublicLivingComposition(composition), true);
assert.equal(discovery.livingCompositionRequirements(composition).length, 2);
const projected = discovery.projectLivingCompositionDiscovery([composition, cnc, material]);
assert.equal(projected.length, 1);
assert.equal(projected[0].matches.length, 2);
assert.equal(projected[0].missing.length, 0);
assert.equal(projected[0].reusable, true);
assert.match(projected[0].matches.find((match) => match.kind === "capability").label, /^Puede ayudarte con /);

const privateComposition = { ...composition, id: "composition:private", meta: { ...composition.meta, scopes: ["participants"] } };
assert.equal(discovery.isPublicLivingComposition(privateComposition), false);
assert.equal(discovery.projectLivingCompositionDiscovery([privateComposition, cnc]).length, 0);

const noDerivative = { ...composition, id: "composition:no-derivative", attrs: { ...composition.attrs, compositionId: "composition:no-derivative" }, meta: { ...composition.meta, policy: { restrictions: { noDerivative: true } } } };
assert.equal(discovery.projectLivingCompositionDiscovery([noDerivative])[0].reusable, false);

assert.doesNotMatch(source, /decohogar|madefer|lapiedra|if\s*\(\s*node\s*===/i);
assert.doesNotMatch(source, /sendToMarket/i);

console.log("living composition discovery contract: ok");

