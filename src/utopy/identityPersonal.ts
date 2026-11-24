import { publishAuthorizedDV, verifyAuthorizedDV } from "./authorizedPublish";
import { resolveCurrentIdentityContext } from "./identityContext";

export type AdultJurisdiction = { country: string; region?: string; city?: string };
export type PrivateIdentityInput = { firstName: string; lastName: string; document: string; country: string; birthDate: string; address?: string };

const clean = (value: unknown) => String(value || "").trim();
export function adultAgeForJurisdiction(jurisdiction: AdultJurisdiction) {
  const country = clean(jurisdiction.country).toUpperCase();
  if (country === "PY" || country === "PRY" || country === "PARAGUAY") return 18;
  return 18;
}
export function ageOnDate(birthDate: string, at = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day || born.getTime() > at.getTime()) return null;
  let age = at.getUTCFullYear() - year;
  if (at.getUTCMonth() + 1 < month || (at.getUTCMonth() + 1 === month && at.getUTCDate() < day)) age -= 1;
  return age;
}
export function deriveAdultVerification(birthDate: string, jurisdiction: AdultJurisdiction, at = new Date()) {
  const age = ageOnDate(birthDate, at);
  const requiredAge = adultAgeForJurisdiction(jurisdiction);
  return { adultVerified: age != null && age >= requiredAge, validBirthDate: age != null, requiredAge, jurisdiction: { country: clean(jurisdiction.country).toUpperCase(), region: clean(jurisdiction.region), city: clean(jurisdiction.city) }, policy: "utopy.identity.adult/1", evaluatedAt: at.toISOString() };
}

export async function savePrivateLivingIdentity(input: { personal: PrivateIdentityInput; jurisdiction: AdultJurisdiction; allLive: any[]; activeActor?: any }) {
  const context = await resolveCurrentIdentityContext({ allLive: input.allLive, activeActor: input.activeActor });
  const personal = { firstName: clean(input.personal.firstName), lastName: clean(input.personal.lastName), document: clean(input.personal.document), country: clean(input.personal.country).toUpperCase(), birthDate: clean(input.personal.birthDate), address: clean(input.personal.address) };
  if (!personal.firstName || !personal.lastName || !personal.country) throw new Error("Completá nombre, apellido y país.");
  const verification = deriveAdultVerification(personal.birthDate, input.jurisdiction);
  if (!verification.validBirthDate) throw new Error("Ingresá una fecha de nacimiento válida.");
  const privateId = `identity.private.profile:${context.actorId}`;
  const privateResult = await publishAuthorizedDV({ dv: { id: privateId, kind: "identity.private.profile", attrs: { subjectActorId: context.actorId, ...personal, participants: [context.actorId] }, traits: ["identity:private", "identity:personal"], meta: { ns: "utopy:identity", scopes: ["participants"] } }, allLive: input.allLive, activeActor: input.activeActor, action: "identity.private.update", sensitivity: "sensitive" });
  const credentialId = `identity.credential.adult:${context.actorId}:${verification.jurisdiction.country}`;
  const credentialResult = await publishAuthorizedDV({ dv: { id: credentialId, kind: "identity.credential", attrs: { subjectActorId: context.actorId, over18: verification.adultVerified, adultVerified: verification.adultVerified, requiredAge: verification.requiredAge, jurisdiction: verification.jurisdiction, policy: verification.policy, evaluatedAt: verification.evaluatedAt, participants: [context.actorId] }, traits: ["identity:credential", "identity:adult"], meta: { ns: "utopy:identity", scopes: ["participants"] } }, allLive: [...input.allLive, privateResult.dv], activeActor: input.activeActor, action: "identity.adult.derive", sensitivity: "sensitive" });
  return { context, privateDV: privateResult.dv, credentialDV: credentialResult.dv, verification };
}

export function privateLivingIdentity(allLive: any[], actorId: string) {
  return [...(allLive || [])].reverse().find((dv) => dv?.kind === "identity.private.profile" && String(dv?.attrs?.subjectActorId || dv?.attrs?.actorId || "") === actorId) || null;
}

export async function verifyAdultForJurisdiction(allLive: any[], actorId: string, jurisdiction: AdultJurisdiction) {
  const country = clean(jurisdiction.country).toUpperCase();
  const candidates = (allLive || []).filter((dv) => dv?.kind === "identity.credential" && String(dv?.attrs?.subjectActorId || dv?.attrs?.actorId || "") === actorId && dv?.attrs?.adultVerified === true && String(dv?.attrs?.jurisdiction?.country || "").toUpperCase() === country && Number(dv?.attrs?.requiredAge) === adultAgeForJurisdiction(jurisdiction));
  for (const credential of candidates) { const proof = await verifyAuthorizedDV(credential, allLive); if (proof.accepted && proof.proof === "verified") return { verified: true, credentialId: credential.id }; }
  return { verified: false, credentialId: null };
}
