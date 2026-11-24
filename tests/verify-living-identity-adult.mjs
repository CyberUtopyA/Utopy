import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const identity = await server.ssrLoadModule("/src/utopy/identityPersonal.ts");
  assert.equal(identity.adultAgeForJurisdiction({ country: "PY" }), 18);
  assert.equal(identity.deriveAdultVerification("2000-08-24", { country: "PY" }, new Date("2026-08-24T12:00:00Z")).adultVerified, true);
  assert.equal(identity.deriveAdultVerification("2008-08-25", { country: "PY" }, new Date("2026-08-24T12:00:00Z")).adultVerified, false);
  assert.equal(identity.deriveAdultVerification("fecha-inválida", { country: "PY" }).validBirthDate, false);
  const source = fs.readFileSync(new URL("../src/utopy/identityPersonal.ts", import.meta.url), "utf8");
  assert.match(source, /identity\.private\.profile/);
  assert.match(source, /identity\.credential/);
  assert.match(source, /scopes: \["participants"\]/);
  const publicProfile = fs.readFileSync(new URL("../src/social/liveProfile.ts", import.meta.url), "utf8");
  assert.match(publicProfile, /participant\|relationship/);
  const rental = fs.readFileSync(new URL("../src/pages/renta.jsx", import.meta.url), "utf8");
  assert.match(rental, /skylines\.pendingReservation/);
  assert.match(rental, /initialProfileSection="private"/);
  assert.match(rental, /onPrivateIdentitySaved=/);
  assert.doesNotMatch(rental, /alert\s*\(/);
  console.log("✓ Identidad Viva: policy PY, privacidad, persistencia y retorno a Skylines verificados");
} finally { await server.close(); }
