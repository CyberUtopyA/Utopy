export type ResumeExperience = { id: string; role: string; organization: string; period: string; description: string };
export type ResumeHighlight = { id: string; title: string; url: string; kind: "video" | "image" | "link"; description: string };
export type LivingResume = { headline: string; summary: string; skills: string[]; experiences: ResumeExperience[]; highlights: ResumeHighlight[]; languages: string[]; public: boolean };
const text = (value: unknown) => String(value ?? "").trim();
const bounded = (value: unknown, max = 1000) => text(value).slice(0, max);
export function resumeLink(value: unknown) {
  try { const url = new URL(text(value)); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export const emptyLivingResume = (): LivingResume => ({ headline: "", summary: "", skills: [], experiences: [], highlights: [], languages: [], public: false });
export function normalizeLivingResume(input: Partial<LivingResume>): LivingResume {
  const list = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(item => bounded(item, 100)).filter(Boolean))].slice(0, 40) : [];
  return {
    headline: bounded(input.headline, 160), summary: bounded(input.summary, 3000), skills: list(input.skills), languages: list(input.languages), public: input.public === true,
    experiences: (Array.isArray(input.experiences) ? input.experiences : []).filter(item => item && typeof item === "object").slice(0, 30).map((item, index) => ({ id: bounded(item.id, 100) || `experience-${index}`, role: bounded(item.role, 160), organization: bounded(item.organization, 160), period: bounded(item.period, 100), description: bounded(item.description, 2000) })),
    highlights: (Array.isArray(input.highlights) ? input.highlights : []).filter(item => item && typeof item === "object").slice(0, 30).map((item, index) => ({ id: bounded(item.id, 100) || `highlight-${index}`, title: bounded(item.title, 160), url: resumeLink(item.url), kind: item.kind === "video" || item.kind === "image" ? item.kind : "link", description: bounded(item.description, 1000) })),
  };
}
export function buildLivingResumeDV(actorId: string, input: LivingResume) {
  if (!text(actorId)) throw Error("Primero completá tu Identidad Viva.");
  const resume = normalizeLivingResume(input);
  if (!resume.headline) throw Error("Escribí una presentación breve para tu currículum.");
  if (resume.highlights.some(item => !item.title || !item.url)) throw Error("Cada destacado necesita título y un enlace HTTPS válido.");
  return { id: `living.resume:${actorId}`, kind: "living.resume", attrs: { actorId, ownerActorId: actorId, participants: [actorId], resume, selfDeclared: true, publicConsent: resume.public }, traits: ["identity:portfolio", "resume:self-declared"], meta: { ns: "utopy:identity", scopes: [resume.public ? "public" : "private"], updatedAt: new Date().toISOString() } };
}
export function projectLivingResume(allLive: any[], actorId: string, viewerActorId = ""): LivingResume | null {
  if (!text(actorId)) return null;
  const latest = allLive.filter(dv => dv?.id === `living.resume:${actorId}` && dv?.kind === "living.resume" && dv?.attrs?.actorId === actorId)
    .sort((a, b) => Number(b.meta?.version ?? b.meta?.revision ?? 0) - Number(a.meta?.version ?? a.meta?.revision ?? 0) || Date.parse(b.meta?.updatedAt || "") - Date.parse(a.meta?.updatedAt || ""))[0];
  if (!latest) return null;
  const scopes = Array.isArray(latest.meta?.scopes) ? latest.meta.scopes : [];
  if (actorId !== viewerActorId && (!scopes.includes("public") || scopes.some((scope: string) => ["private", "participants", "custodians"].includes(scope)) || latest.attrs?.publicConsent !== true || latest.meta?.policy?.restrictions?.noShare)) return null;
  return normalizeLivingResume(latest.attrs.resume || {});
}
