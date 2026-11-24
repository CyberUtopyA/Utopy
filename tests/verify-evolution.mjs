import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const env = read(".env.utopy.example");
assert.match(env, /VITE_MICELIO_HTTP=/);
assert.match(env, /VITE_SEED_WS=/);
assert.match(env, /VITE_BOOTSTRAP_NODE_SOURCES=\[\]/);
assert.doesNotMatch(env, /decohogar\.utopy/i);
assert.doesNotMatch(env, /lapiedra\.utopy/i);

const discovery = read("src/mt/liveCatalog.sources.ts");
assert.match(discovery, /utopy\.node\.manifest/);
assert.match(discovery, /VITE_BOOTSTRAP_NODE_SOURCES/);
assert.match(discovery, /isActiveManifest/);
assert.match(discovery, /credentials:\s*"omit"/);
assert.match(discovery, /referrerPolicy:\s*"no-referrer"/);
assert.doesNotMatch(discovery, /storeId\s*===\s*["']decohogar/i);
assert.doesNotMatch(discovery, /storeId\s*===\s*["']lapiedra/i);

const manifestRuntime = read("src/mt/utopy.nodeManifest.ts");
assert.match(manifestRuntime, /startNodeManifestHeartbeat/);
assert.match(manifestRuntime, /utopy\.node\.manifest@2/);
assert.match(manifestRuntime, /buildDvUpsertEnvelope/);
assert.match(manifestRuntime, /expiresAt/);

const heartbeat = read("public/utopy-node-heartbeat.js");
assert.match(heartbeat, /data-manifest-url|manifestUrl/);
assert.match(heartbeat, /new WebSocket/);
assert.match(heartbeat, /dv\.upsert/);
assert.doesNotMatch(heartbeat, /private[_-]?key|bancard[_-]?private/i);

const example = JSON.parse(read("NODO-VIVO-EJEMPLO.json"));
assert.equal(example.kind, "utopy.node.manifest");
assert.equal(example.meta.ns, "utopy:nodes");
assert.ok(example.meta.ttl_ms > 0);
assert.equal(example.attrs.discovery.mode, "self-announced");
assert.ok(example.attrs.endpoints.catalog.startsWith("https://"));
assert.ok(example.attrs.capabilities.length >= 2);

for (const rel of [
  "NODOS-REEMPLAZAR/DECOHOGAR/api/catalog-live.php",
  "NODOS-REEMPLAZAR/LAPIEDRA/public/api/catalog-live.php",
]) {
  if (!fs.existsSync(path.join(root, rel))) continue;
  const php = read(rel);
  assert.match(php, /utopy\.node\.manifest@2/);
  assert.match(php, /'ttl_ms'/);
  assert.match(php, /'heartbeatMs'/);
  assert.match(php, /'manifest'=>/);
  assert.match(php, /'catalog'=>/);
}

console.log("OK: 22 contratos de descubrimiento vivo verificados.");
