import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const daily = read("src/pages/falcondaily.tsx");
assert(!daily.includes("LaPiedraDailySection"), "Falcon Daily todavía importa un nodo específico");
assert(!daily.includes("UtopyPayOperationsPanel"), "Falcon Daily todavía incrusta un Pay especial");

const ingest = read("src/mt/mt.ingest.ts");
for (const key of ["paymentOffers", "loyaltyPrograms", "trustPolicies", "nodeManifests"]) {
  assert(ingest.includes(`"${key}"`), `La ingesta no reconoce ${key}`);
}

const catalog = read("src/mt/liveCatalog.sources.ts");
assert(catalog.includes("normalizeNodeKey"), "No existe normalización universal de identidad");
assert(catalog.includes("utopy.node.manifest"), "No existe descubrimiento por manifiesto");
assert(!catalog.includes("isCatalogItem &&"), "El catálogo sigue restringido solamente a productos");

const resonator = read("src/mt/mt.resonator.ts");
assert(resonator.includes("buildOutcomeReactionProposals"), "El resultado no despierta reacciones");
assert(resonator.includes("projectDVToCapabilityDV"), "Las ofertas no se proyectan universalmente");

const cashier = read("src/mt/CajerosPanel.tsx");
assert(cashier.includes("sellerId={commerceId}"), "Pay Center todavía cobra a nombre del cajero");

const runtime = read("src/mt/utopy.nodeRuntime.ts");
assert(runtime.includes("idempotencyKey"), "El runtime del nodo no protege idempotencia");
assert(runtime.includes("responseAccepted"), "El runtime no respeta consentimiento");

console.log("OK: contrato UTOPY universal verificado.");
