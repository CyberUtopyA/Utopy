import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const domain = await server.ssrLoadModule("/src/mt/rental.domain.ts");
  const unit = { id: "unit:1", kind: "rental.unit", attrs: { unitId: "unit:1", propertyId: "property:1", state: "AVAILABLE", revision: 1 } };
  const hold = { id: "hold:1", kind: "rental.hold.created", attrs: { unitId: "unit:1", holdId: "hold:1", revision: 2, expiresAt: "2099-01-01T00:00:00.000Z", occurredAt: "2026-01-01T00:00:00.000Z" } };
  const occupied = { id: "activation:1", kind: "rental.contract.activated", attrs: { unitId: "unit:1", contractId: "contract:1", revision: 3, occurredAt: "2026-01-02T00:00:00.000Z" } };
  const ended = { id: "ended:1", kind: "rental.contract.ended", attrs: { unitId: "unit:1", contractId: "contract:1", revision: 4, occurredAt: "2026-02-01T00:00:00.000Z" } };
  const renewal = { id: "renewal:1", kind: "rental.renewal.activated", attrs: { unitId: "unit:1", previousContractId: "contract:1", contractId: "contract:2", revision: 4, occurredAt: "2026-01-31T00:00:00.000Z" } };

  assert.equal(domain.projectRentalUnitState(unit, [hold], Date.parse("2026-01-01")).state, "HELD");
  const offer = {id:'offer:1',kind:'rental.offer',attrs:{unitId:'unit:1',price:900000}};
  const pending = {id:'pending:1',kind:'rental.reservation.pending_identity',attrs:{unitId:'unit:1'}};
  const clean = domain.projectRentalUnitState(unit,[offer,pending]);
  assert.equal(clean.revision,1,'Catalog and identity events must not invent occupancy revisions');
  assert.equal(clean.state,'AVAILABLE');
  domain.assertRentalTransition({current:clean,expectedRevision:1,next:'HELD'});
  assert.equal(domain.projectRentalUnitState(unit,[offer,pending,hold],Date.parse('2026-01-01')).revision,2);
  assert.throws(() => domain.assertRentalTransition({ current: { state: "HELD", revision: 2 }, expectedRevision: 1, next: "OCCUPIED" }), /cambió/); // C
  assert.equal(domain.projectRentalUnitState(unit, [hold, occupied], Date.parse("2026-01-03")).state, "OCCUPIED"); // D
  assert.equal(domain.projectRentalUnitState(unit, [hold, occupied, ended], Date.parse("2026-02-02")).state, "AVAILABLE"); // E
  assert.equal(domain.projectRentalUnitState(unit, [hold, occupied, renewal, ended], Date.parse("2026-02-02")).state, "OCCUPIED"); // F

  const arbitrary = domain.projectRentalProperties([{ id: "external:property", kind: "rental.property", attrs: { propertyId: "external:property", name: "Nodo nuevo" } }, { id: "external:unit", kind: "rental.unit", attrs: { propertyId: "external:property", unitId: "external:unit", available: true, revision: 1 } }]);
  assert.equal(arbitrary[0].availableRooms, 1); // H

  const source = fs.readFileSync(new URL("../src/mt/rental.domain.ts", import.meta.url), "utf8");
  const renta = fs.readFileSync(new URL("../src/pages/renta.jsx", import.meta.url), "utf8");
  const contract = fs.readFileSync(new URL("../src/pages/contract.tsx", import.meta.url), "utf8");
  const success = fs.readFileSync(new URL("../src/pages/exito.jsx", import.meta.url), "utf8");
  assert.match(source, /verifyAuthorizedDV/); // A/B: claim firmado, no checkbox
  assert.match(renta + contract + success, /requireVerifiedAdult/g);
  const runtimeFiles = ["../src/mt/skylines.rentals.ts", "../src/pages/falcon.skylines.tsx", "../src/components/mapcomponent.jsx", "../src/pages/renta.jsx"].map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(runtimeFiles, /raw\.githubusercontent\.com|alquileres\.json|owners\.json/); // G
  assert.match(runtimeFiles, /-24\.067593291641767/);
  assert.match(runtimeFiles, /candidate\?\.meta\?\.migration === MIGRATION_VERSION/);
  assert.doesNotMatch(runtimeFiles, /Propietario:.*1\.195\.155/i);
  assert.match(source, /rental\.renewal\.proposed/);
  assert.match(source, /rental\.renewal\.activated/);
  assert.match(source, /reserved_pending_identity/);
  assert.match(source, /resolveRentalActorRole/);
  assert.match(source,/proof\.actorId === landlordActorId/);
  assert.match(source,/propertyProof\.actorId!==access\.landlordActorId/);
  assert.match(source,/\["AVAILABLE","UNAVAILABLE"\]\.includes\(current\.state\)/);
  assert.match(renta,/canManageRental\?<ContractButton/);
  assert.match(renta,/utopy\.wallet\.changed/);
  assert.match(renta,/setRentalUnitAvailability/);
  const rentalPage = fs.readFileSync(new URL("../src/pages/renta.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(rentalPage,/if \(location\.state\?\.room\) return/,'Navigation must not disable live unit updates');
  assert.match(rentalPage,/const pageState = rawRoomState \?/);
  assert.match(rentalPage,/liveRoomNumber = urlRoomNumber \|\| location\.state\?\.room\?\.number/);
  assert.doesNotMatch(rentalPage, /alert\s*\(/);
  assert.match(rentalPage, /skylines\.pendingReservation/);
  assert.match(runtimeFiles, /ensureSkylinesRentalIdentityReady/);
  console.log("✓ Skylines rental A–H: edad, concurrencia, ocupación, renovación, migración y autodiscovery");
} finally {
  await server.close();
}
