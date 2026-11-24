import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const source = await readFile(new URL('../src/pilots/livingPilots.ts', import.meta.url), 'utf8');
const transformed = await transformWithEsbuild(source, 'livingPilots.ts', { loader: 'ts', format: 'esm', target: 'es2022' });
const config = await transformWithEsbuild(await readFile(new URL('../src/pilots/livingPilotDefinitions.ts', import.meta.url), 'utf8'), 'livingPilotDefinitions.ts', { loader: 'ts', format: 'esm' });
const configUrl = `data:text/javascript;base64,${Buffer.from(config.code).toString('base64')}`;
const code = transformed.code.replaceAll('from "utopy"', `from ${JSON.stringify(import.meta.resolve('utopy'))}`).replaceAll('from "./livingPilotDefinitions"', `from ${JSON.stringify(configUrl)}`);
const pilot = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

assert.equal(pilot.quoteTotal([
  { description: 'Ejemplo ilustrativo: bomba', quantity: 1, unit: 'u', unitPrice: 450000 },
  { description: 'Ejemplo ilustrativo: correa', quantity: 1, unit: 'u', unitPrice: 320000 },
  { description: 'Ejemplo ilustrativo: filtro y aceite', quantity: 1, unit: 'u', unitPrice: 250000 },
  { description: 'Ejemplo ilustrativo: mano de obra', quantity: 1, unit: 'servicio', unitPrice: 350000 },
]), 1370000);
assert.throws(() => pilot.quoteTotal([{ description: 'inválido', quantity: -1, unit: 'u', unitPrice: 100 }]));
const lines = pilot.extractOfferLines(pilot.LIVING_PILOTS['don-mencia'].sample);
assert.equal(lines.length, 2);
assert.deepEqual(lines.map(line => [line.quantity, line.unitPrice, line.unit]), [[40, 5000, 'u'], [20, 8000, 'kg']]);
assert.equal(pilot.quoteTotal(lines), 360000);

for (const key of Object.keys(pilot.LIVING_PILOTS)) {
  const session = await pilot.createPilotDemonstration(key);
  const form = await session.prepare('Ensayo privado', '');
  assert.equal(form.valid, false);
  await assert.rejects(() => session.simulate('Ensayo privado', ''), /detalle/);
  const preview = await session.simulate('Ensayo privado', 'Datos ficticios declarados; ninguna operación real.');
  assert.equal(preview.viable, true, JSON.stringify(preview.blockers));
  await assert.rejects(() => session.advance());
  await assert.rejects(() => session.authorize(false));
  await session.authorize(true);
  for (let i = 0; i < pilot.LIVING_PILOTS[key].steps.length; i++) {
    const result = await session.advance();
    assert.equal(result.completed, i + 1);
    assert.equal(result.evidence.payload.state, 'SUCCEEDED');
  }
  await assert.rejects(() => session.advance());
  const exported = await session.exportProof();
  assert.equal(await pilot.verifyPilotProof(exported.proof), true);
  assert.equal(exported.bundle.simulation, true);
  assert.equal(exported.bundle.passport.facts.length, pilot.LIVING_PILOTS[key].steps.length);
  assert.equal(exported.proof.payload.realOperationPerformed, false);
  const altered = structuredClone(exported.proof); altered.payload.completedSteps = 999;
  assert.equal(await pilot.verifyPilotProof(altered), false);
  await session.revoke();
  const revoked = await pilot.createPilotDemonstration(key);
  await revoked.simulate('Revocación', 'Ensayo privado'); await revoked.authorize(true); await revoked.revoke();
  await assert.rejects(() => revoked.advance());
  console.log(`✓ ${key}: formulario, simulación, consentimiento, recorrido, evidencia firmada, QR portable, revocación`);
}
console.log('✓ presupuesto ilustrativo, oferta estructurada, cantidades fraccionarias y aislamiento sin transportes');
