import { isPublicLivingDV, projectLivingNodes, resolveLivingNode } from "../utopy/livingNodeProjection";

export type LiveProfile = {
  id: string;
  actorId: string;
  nodeId: string;
  handle: string;
  name: string;
  avatar: string;
  bio: string;
  collection: string;
  territory: string;
  verified: boolean;
  products: any[];
  offers: any[];
  capabilities: any[];
  activity: any[];
  presence: { territory: string; lat: number | null; lng: number | null } | null;
  source: any;
  sourceRefs?: string[];
  nodeIds?: string[];
};

const clean = (value: unknown) => String(value || "").trim();
export function publicProfileOfferTitle(dv: any) {
  if (!isPublicProfileDV(dv) || /capability|payment|credit|outcome|mandate|authority|receipt/i.test(clean(dv?.kind))) return "";
  return [dv?.attrs?.title, dv?.attrs?.name, dv?.attrs?.nombre, dv?.title, dv?.name, dv?.attrs?.text, dv?.attrs?.description].map(clean).find(value => value && !/^(vos|voz|resultado vivo|oferta|capacidad|persona)$/i.test(value) && !/(actor:|did:|utopy[.:]|urn:|node:|sourceRef|threadId)/i.test(value) && !/^[a-z]+(?:[._:-][a-z0-9]+)+$/i.test(value)) || "";
}
function currentUnique(items: any[]) {
  const result = new Map<string, any>();
  items.forEach((item, index) => { const key = clean(item?.id) || `item:${index}`; const prior = result.get(key); if (!prior || Number(item?.meta?.version || 0) >= Number(prior?.meta?.version || 0)) result.set(key, item); });
  return [...result.values()];
}
const technicalIdentity = /^(?:actor:|did:|utopy\.node\.|node:|mt:|urn:)|(?:sourceRef|threadId|namespace)/i;
const humanName = (value: unknown, fallback = "Persona") => {
  const candidate = clean(value);
  return candidate && !technicalIdentity.test(candidate) ? candidate : fallback;
};

function mergeIdentityProfiles(profiles: LiveProfile[]) {
  const groups = new Map<string, LiveProfile[]>();
  for (const profile of profiles) {
    const key = clean(profile.actorId) || `node:${clean(profile.nodeId || profile.id)}`;
    groups.set(key, [...(groups.get(key) || []), profile]);
  }
  return [...groups.values()].map((related) => {
    const identityProfile = related.find((profile) => /profile/i.test(clean(profile.source?.kind)));
    const canonical = identityProfile || related[0];
    const named = related.find((profile) => humanName(profile.name, "") !== "") || canonical;
    const pictured = related.find((profile) => clean(profile.avatar)) || canonical;
    const representsPerson = Boolean(clean(canonical.actorId));
    return {
      ...canonical,
      name: representsPerson ? humanName(identityProfile?.name) : humanName(named?.name),
      avatar: representsPerson ? clean(identityProfile?.avatar) : clean(pictured?.avatar),
      verified: related.some((profile) => profile.verified),
      products: currentUnique(related.flatMap((profile) => profile.products || [])),
      offers: currentUnique(related.flatMap((profile) => profile.offers || [])).filter(publicProfileOfferTitle),
      capabilities: related.flatMap((profile) => profile.capabilities || []),
      activity: related.flatMap((profile) => profile.activity || []),
      sourceRefs: [...new Set(related.flatMap((profile) => [clean(profile.source?.id), ...(profile.sourceRefs || [])]).filter(Boolean))],
      nodeIds: [...new Set(related.map((profile) => clean(profile.nodeId)).filter(Boolean))],
    };
  });
}

export function isPublicProfileDV(dv: any) {
  const declared = (Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes : [dv?.meta?.scope]).map(String).map((scope) => scope.toLowerCase());
  if (declared.some((scope) => /participant|relationship/.test(scope))) return false;
  return isPublicLivingDV(dv);
}

export function projectLiveProfiles(allLive: any[]): LiveProfile[] {
  const projected = projectLivingNodes(allLive).map((node): LiveProfile => ({
    id: node.id, actorId: node.actorId, nodeId: node.nodeId, handle: node.handle,
    name: humanName(node.name), avatar: node.avatarRef, bio: node.bio, collection: "",
    territory: node.territory, verified: node.verified, products: node.products,
    offers: node.offers, capabilities: node.capabilities.map((capability) => capability.source),
    activity: node.activity, presence: node.presence, source: node.source,
  }));
  return mergeIdentityProfiles(projected);
}

export function projectLiveProfile(allLive: any[], identity: string) {
  const node = resolveLivingNode(identity, allLive);
  const wanted = clean(identity);
  const actorId = clean(node?.actorId);
  const nodeId = clean(node?.nodeId);
  const resolvedId = clean(node?.id);
  return projectLiveProfiles(allLive).find((profile) =>
    (actorId && clean(profile.actorId) === actorId) ||
    clean(profile.id) === wanted || clean(profile.id) === resolvedId ||
    clean(profile.handle) === wanted || clean(profile.nodeId) === wanted ||
    (nodeId && (clean(profile.nodeId) === nodeId || (profile.nodeIds || []).includes(nodeId))) ||
    (profile.nodeIds || []).includes(wanted),
  ) || null;
}

export function resolveLivingIdentity(identity: unknown, allLive: any[]): LiveProfile {
  const ref = typeof identity === "object" && identity
    ? clean((identity as any).actorId || (identity as any).nodeId || (identity as any).id)
    : clean(identity);
  return (ref ? projectLiveProfile(allLive, ref) : null) || {
    id: "profile-vivo", actorId: ref, nodeId: "", handle: "perfil-vivo",
    name: "Persona", avatar: "", bio: "", collection: "", territory: "",
    verified: false, products: [], offers: [], capabilities: [], activity: [],
    presence: null, source: null, sourceRefs: [], nodeIds: [],
  };
}

export function profileSearchDV(profile: LiveProfile) {
  return { id: `live.profile:${profile.id}`, kind: "live.profile", attrs: { handle: profile.handle, displayName: profile.name, avatar: profile.avatar, bio: profile.bio, territoryName: profile.territory, actorId: profile.actorId, nodeId: profile.nodeId, verified: profile.verified }, labels: [profile.name, profile.handle, profile.territory], meta: { scopes: ["public"], authority: profile.nodeId || profile.actorId }, __profile: profile };
}
