import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const quick = read("src/components/LivingProfileQuickView.tsx");
const cashier = read("src/pay/LivingCashierPanel.tsx");
const activity = read("src/utopy/livingNodeUX.ts");
const profile = read("src/pages/liveprofile.tsx");
const production = read("src/pages/ProducirPanel.tsx");

assert.match(quick, /mode="quickCollect"/);
assert.match(cashier, /createLivingCharge/);
assert.match(activity, /nodeId.*eventKind.*causal.*bucket/s);
assert.match(profile, /slice\(0, 3\)/);
assert.doesNotMatch([quick, profile].join("\n"), /Puede colaborar/i);
assert.match(production, /Operadores y configuración avanzada/);
assert.match(production, /Destino técnico/);
assert.doesNotMatch(production, />\s*Namespace de destino\s*</);

console.log("✓ Perfil Quick, Caja compartida, capacidades humanas y Activity agrupada verificados");
