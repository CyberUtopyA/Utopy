import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { createServer } from "vite";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const contracts = await server.ssrLoadModule("/src/mt/contract.private.ts");
  const record = { landlordActorId: "actor:landlord", tenantActorId: "actor:tenant", authorizedAdminActorIds: ["actor:admin"] };
  assert.equal(contracts.contractAllows(record, "actor:landlord"), true);
  assert.equal(contracts.contractAllows(record, "actor:tenant"), true);
  assert.equal(contracts.contractAllows(record, "actor:admin"), true);
  assert.equal(contracts.contractAllows(record, "actor:third-party"), false);
  const one = await contracts.contractIntegrity({ contrato: { canon: 800000, moneda: "PYG" }, version: 1 });
  const changed = await contracts.contractIntegrity({ contrato: { canon: 800001, moneda: "PYG" }, version: 1 });
  assert.notEqual(one, changed);

  const migration = fs.readFileSync(new URL("../src/mt/skylines.rentals.ts", import.meta.url), "utf8");
  assert.match(migration, /82fcaaee-ac3a-4d08-86f8-9ccc950e4f28/);
  assert.match(migration, /1\.195\.155/);
  assert.match(migration, /Santa Teresa/);
  const pdf = fs.readFileSync(new URL("../src/utils/contrato.ts", import.meta.url), "utf8");
  assert.match(pdf, /secureShareLink \|\| buildShareLink/);
  assert.match(pdf, /REPARACIONES Y MANTENIMIENTO|Reparaciones y mantenimiento/);
  assert.doesNotMatch(fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), /contrato.*documento|contrato.*cedula/i);
  console.log("✓ Contratos privados: autorización, integridad, identidad Eduardo y QR seguro verificados");
} finally { await server.close(); }
