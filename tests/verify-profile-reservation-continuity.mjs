import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer, transformWithEsbuild } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const profile = await server.ssrLoadModule("/src/social/liveProfile.ts");
  const offer = (title, kind = "mt:offer") => ({ kind, attrs: { title }, meta: { scopes: ["public"] } });
  for (const title of ["vos", "voz", "Resultado vivo", "actor:utopy:123", "capability.actor.123"]) assert.equal(profile.publicProfileOfferTitle(offer(title)), "");
  assert.equal(profile.publicProfileOfferTitle(offer("Reparación de muebles")), "Reparación de muebles");
  assert.equal(profile.publicProfileOfferTitle(offer("Puede reparar", "capability.offer")), "");
  assert.equal(profile.publicProfileOfferTitle({ ...offer("Servicio"), meta: { scopes: ["participants"] } }), "");
  const { canPersonalizeProfile } = await server.ssrLoadModule("/src/utopy/studioEntitlements.ts");
  const pass = { id: "pass", kind: "studio.entitlement", attrs: { actorId: "alice", nodeId: "my-node", status: "active", validUntil: "2099-01-01" }, meta: { runtimeVerified: true, runtimeAuthority: "utopy.node.foundation" } };
  assert.equal(canPersonalizeProfile([], "alice", "my-node"), false);
  assert.equal(canPersonalizeProfile([pass], "alice", "my-node"), true);
  assert.equal(canPersonalizeProfile([pass], "bob", "my-node"), false);
  assert.equal(canPersonalizeProfile([pass], "alice", "other-node"), false);
  assert.equal(canPersonalizeProfile([{ ...pass, meta: {} }], "alice", "my-node"), false);
  assert.equal(canPersonalizeProfile([{ ...pass, attrs: { ...pass.attrs, validUntil: "2020-01-01" } }], "alice", "my-node"), false);
  const { rentalIdentityFields, verifiedRentalIdentityFields } = await server.ssrLoadModule("/src/mt/rentalIdentity.ts");
  assert.deepEqual(rentalIdentityFields({ firstName: " Ana ", lastName: " Pérez ", document: " 123 ", address: " Calle de ejemplo ", birthDate: "2000-01-01" }), { name: "Ana Pérez", document: "123", address: "Calle de ejemplo" });
  assert.equal(await verifiedRentalIdentityFields([], "alice"), null);
  const rental = fs.readFileSync("src/pages/renta.jsx", "utf8");
  assert.match(rental, /onPrivateIdentitySaved=/); assert.match(rental, /await prefillPrivateIdentity\(\)/); assert.doesNotMatch(rental, /saveTenantLocal/);
  const full = fs.readFileSync("src/pages/liveprofile.tsx", "utf8");
  assert.match(full, /variant="avatar"/); assert.match(full, /Crear mi currículum completo/);
  for (const file of ["src/pages/renta.jsx", "src/pages/liveprofile.tsx", "src/components/LivingHighlights.tsx", "src/components/LivingProfileQuickView.tsx", "src/social/LiveNetworkPanel.tsx", "src/social/liveProfile.ts", "src/mt/rentalIdentity.ts", "src/utopy/studioEntitlements.ts"]) await transformWithEsbuild(fs.readFileSync(file, "utf8"), file, { loader: file.endsWith("jsx") ? "jsx" : "tsx" });
  console.log("✓ Perfil limpio, Pass por sujeto/autoridad/vigencia, novedades en avatar, currículum, prefill privado y continuidad de reserva; sin cobros ni firmas de contrato automáticas.");
} finally { await server.close(); }
