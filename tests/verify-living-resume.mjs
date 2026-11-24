import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer, transformWithEsbuild } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { emptyLivingResume, buildLivingResumeDV, projectLivingResume, resumeLink } = await server.ssrLoadModule("/src/social/livingResume.ts");
  const actor = "actor:resume-test";
  const input = { ...emptyLivingResume(), headline: "Deportista y estudiante", skills: ["Pase", "Pase"], experiences: [{ id: "team", role: "Mediocampista", organization: "Equipo de ejemplo", period: "2024", description: "Experiencia ilustrativa" }], highlights: [{ id: "play", title: "Jugadas", kind: "video", url: "https://example.com/video.mp4", description: "Ejemplo" }] };
  const privateDV = buildLivingResumeDV(actor, input);
  assert.deepEqual(privateDV.meta.scopes, ["private"]);
  assert.equal(projectLivingResume([privateDV], actor), null);
  assert.equal(projectLivingResume([privateDV], actor, actor).experiences[0].role, "Mediocampista");
  assert.equal(projectLivingResume([privateDV], "other", actor), null);
  const publicDV = buildLivingResumeDV(actor, { ...input, public: true });
  publicDV.meta.version = 1;
  assert.equal(publicDV.id, privateDV.id);
  assert.equal(projectLivingResume([publicDV], actor).highlights[0].kind, "video");
  assert.deepEqual(projectLivingResume([publicDV], actor).skills, ["Pase"]);
  privateDV.meta.version = 2;
  assert.equal(projectLivingResume([publicDV, privateDV], actor), null);
  assert.equal(projectLivingResume([{ ...publicDV, attrs: { ...publicDV.attrs, publicConsent: false } }], actor), null);
  assert.equal(projectLivingResume([{ ...publicDV, meta: { ...publicDV.meta, policy: { restrictions: { noShare: true } } } }], actor), null);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:pass@example.com"]) assert.equal(resumeLink(url), "");
  assert.throws(() => buildLivingResumeDV(actor, { ...input, highlights: [{ ...input.highlights[0], url: "javascript:alert(1)" }] }));
  assert.equal(publicDV.attrs.selfDeclared, true);
  const editor = fs.readFileSync("src/components/LivingResume.tsx", "utf8");
  assert.match(editor, /localOnly: !draft.public/);
  assert.match(editor, /requiredAuthority: actorId/);
  assert.match(editor, /draftActor.current !== actorId/);
  const network = fs.readFileSync("src/social/LiveNetworkPanel.tsx", "utf8");
  assert.match(network, /if \(initialView\) \{ setView\(initialView\); return; \}/);
  for (const file of ["src/components/LivingResume.tsx", "src/social/livingResume.ts", "src/social/LiveNetworkPanel.tsx", "src/components/LivingNodePanel.tsx", "src/components/LivingProfileQuickView.tsx", "src/pages/liveprofile.tsx", "src/pages/circularpanel.jsx"]) {
    await transformWithEsbuild(fs.readFileSync(file, "utf8"), file, { loader: file.endsWith(".jsx") ? "jsx" : file.endsWith(".tsx") ? "tsx" : "ts" });
  }
  console.log("✓ Currículum: privacidad, consentimiento, aislamiento, enlaces, experiencia y sintaxis; prioridad de vistas verificada.");
} finally { await server.close(); }
