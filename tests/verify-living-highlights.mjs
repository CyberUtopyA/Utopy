import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
try {
  const { projectLivingHighlights: project, emptyHighlightPreferences: prefs, highlightSession, publicHighlightEvidence, readHighlightPreferences, writeHighlightPreferences } = await server.ssrLoadModule("/src/social/livingHighlights.ts");
  const now = Date.parse("2026-09-07T12:02:00Z"); const createdAt = "2026-09-07T12:00:00Z";
  const profile = (id, name) => ({ id: `profile:${id}`, kind: "node.profile", attrs: { nodeId: `utopy.node.${id}`, storeId: id, handle: id, name, avatar: "https://example.test/avatar.jpg", aliases: [id] }, meta: { scopes: ["public"], updatedAt: createdAt, version: 1 } });
  const product = (node, i, extra = {}) => ({ id: `product:${node}:${i}`, kind: "mt:producto", attrs: { sellerNodeId: `utopy.node.${node}`, productId: `p:${i}`, title: `Pieza ${i}`, image: "https://example.test/product.jpg", stockQty: 1, available: true, createdAt, ...extra }, meta: { scopes: ["public"], updatedAt: createdAt, version: 1 } });
  const luveau = [profile("luveau", "LUVÉAU"), ...Array.from({ length: 5 }, (_, i) => product("luveau", i, { collection: "DROP 002" }))];
  const deco = [profile("decohogar", "DecoHogar"), ...Array.from({ length: 20 }, (_, i) => product("decohogar", i))];
  check("LUVÉAU: 5 piezas, un highlight y un nodo", () => { const h = project(luveau, { now }); assert.equal(h.length, 1); assert.match(h[0].title, /DROP 002/); assert.equal(h[0].sourceRefs.length, 5); });
  check("DecoHogar: 20 productos, una novedad", () => { const h = project(deco, { now }); assert.equal(h.length, 1); assert.equal(h[0].summary, "20 productos"); });
  check("Dedupe transportes", () => assert.equal(project([...deco, ...deco], { now })[0].sourceRefs.length, 20));
  check("Privado y noShare nunca generan novedades", () => { for (const change of [{ meta: { scopes: ["private"] } }, { policy: { restrictions: { noShare: true } } }, { policy: { restrictions: { noLocationDisclosure: true } } }]) assert.equal(project([deco[0], { ...deco[1], ...change }], { now }).length, 0); });
  check("Revocación de visibilidad prevalece sobre copia pública anterior", () => assert.equal(project([deco[0], deco[1], { ...deco[1], meta: { scopes: ["private"], version: 2, updatedAt: createdAt } }], { now }).length, 0));
  check("Frecuencia, heartbeat y sincronización no crean novedades", () => { for (const kind of ["frequency.pulse", "node.heartbeat", "catalog.sync", "presence.public"]) assert.equal(project([deco[0], { ...deco[1], kind }], { now }).length, 0); });
  const availability = { id: "availability:juan", kind: "capability.availability", attrs: { nodeId: "utopy.node.juan", title: "Lugar para dos trabajos", available: true, expiresAt: "2026-09-08T00:00:00Z" }, meta: { scopes: ["public"], updatedAt: createdAt, version: 1 } };
  check("Disponibilidad temporal desaparece al vencer", () => { const data = [profile("juan", "Juan"), availability]; assert.equal(project(data, { now }).length, 1); assert.equal(project(data, { now: now + 86400_000 }).length, 0); });
  check("Stock cero tiene autoridad aunque available siga true", () => assert.equal(project([deco[0], product("decohogar", 0, { stockQty: 0 })], { now }).length, 0));
  check("Misma revisión técnica no vuelve a encender aro", () => { const one = project(deco, { now })[0]; const sync = deco.map((d) => ({ ...d, meta: { ...d.meta, version: 2, updatedAt: "2026-09-07T12:01:00Z" } })); assert.equal(project(sync, { now })[0].highlightId, one.highlightId); });
  check("Nuevo contenido cambia identidad semántica del highlight", () => { const one = project(deco, { now })[0]; const changed = deco.map((d, i) => i === 1 ? { ...d, attrs: { ...d.attrs, image: "https://example.test/new.jpg" } } : d); assert.notEqual(project(changed, { now })[0].highlightId, one.highlightId); });
  check("Silenciar/menos es preferencia privada", () => assert.equal(project(deco, { now, preferences: { ...prefs(), mutedNodes: ["utopy.node.decohogar"] } }).length, 0));
  check("Sesión finita de máximo 15", () => { const h = project(deco, { now })[0]; const many = Array.from({ length: 30 }, (_, i) => ({ ...h, highlightId: `h:${i}` })); assert.equal(highlightSession(many, prefs()).length, 15); });
  check("Seen separado por actor y persistente offline", () => { const memory = new Map(); globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }; writeHighlightPreferences("alice", { ...prefs(), seen: { hello: now } }); assert.equal(readHighlightPreferences("alice").seen.hello, now); assert.equal(readHighlightPreferences("bob").seen.hello, undefined); delete globalThis.localStorage; });
  check("Outcome requiere consentimiento explícito", () => { const base = { ...deco[1], kind: "work.outcome" }; assert.equal(project([deco[0], base], { now }).length, 0); const h = project([deco[0], { ...base, attrs: { ...base.attrs, highlight: { consent: true, confirmed: true, visibility: "public", title: "Terminamos un mueble" }, customerName: "PRIVADO" } }], { now }); assert.equal(h.length, 1); assert.ok(!JSON.stringify(h).includes("PRIVADO")); });
  check("Participantes sin scope público no pasan", () => assert.equal(publicHighlightEvidence({ ...deco[1], participants: ["actor:1"], meta: {} }), false));
  const need = { id: "need:test", kind: "resonance.signal", attrs: { nodeId: "utopy.node.juan", text: "Necesito una entrega mañana", createdAt }, meta: { scopes: ["public"], updatedAt: createdAt, version: 1 } };
  check("Necesidades públicas se unifican en historias con su texto real", () => { const h = project([profile("juan", "Juan"), need], { now }); assert.equal(h.length, 1); assert.equal(h[0].kind, "opportunity"); assert.equal(h[0].title, need.attrs.text); assert.deepEqual(h[0].sourceRefs, [need.id]); });
  check("Necesidades privadas no aparecen en historias", () => assert.equal(project([profile("juan", "Juan"), { ...need, meta: { ...need.meta, scopes: ["private"] } }], { now }).length, 0));
  check("Corregir la necesidad actualiza su historia", () => { const first = project([profile("juan", "Juan"), need], { now })[0]; const changed = project([profile("juan", "Juan"), { ...need, attrs: { ...need.attrs, text: "Necesito una entrega hoy" }, meta: { ...need.meta, version: 2 } }], { now })[0]; assert.notEqual(first.highlightId, changed.highlightId); });
  console.log(`${passed} pruebas de Novedades Vivas aprobadas`);
} finally { await server.close(); }
