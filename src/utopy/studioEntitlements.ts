const text = (value: unknown) => String(value || "").trim();
const studioAuthority = text(import.meta.env.VITE_UTOPY_STUDIO_NODE_ID) || "utopy.node.foundation";
export function isTrustedStudioDV(dv: any) {
  return dv?.meta?.runtimeVerified === true && text(dv?.meta?.runtimeAuthority || dv?.meta?.authority) === studioAuthority;
}
export function activeEntitlementDVs(allLive: any[], actorId: string, authorizedNodeIds: string[] = [], now = Date.now()) {
  if (!actorId) return [];
  const latest = new Map<string, any>();
  for (const dv of allLive) {
    if (!/^(?:studio\.entitlement|subscription\.entitlement|subscription\.active)$/.test(text(dv?.kind))) continue;
    const prior = latest.get(dv.id);
    if (!prior || Number(dv?.meta?.runtimeRevision || dv?.meta?.revision || dv?.attrs?.revision || 0) >= Number(prior?.meta?.runtimeRevision || prior?.meta?.revision || prior?.attrs?.revision || 0)) latest.set(dv.id, dv);
  }
  return [...latest.values()].filter((dv) => {
    const attrs = dv.attrs || {};
    const owner = text(attrs.subjectActorId || attrs.actorId || attrs.ownerActorId || attrs.buyerActorId);
    const nodeId = text(attrs.nodeId || attrs.targetNodeId);
    const expires = Date.parse(text(attrs.validUntil || attrs.expiresAt));
    return isTrustedStudioDV(dv) && attrs.status === "active" && Number.isFinite(expires) && expires > now
      && (owner === actorId || (!!nodeId && authorizedNodeIds.includes(nodeId)));
  });
}
export function humanEntitlementLabel(value: unknown, fallback: string) {
  const label = text(value);
  return !label || /(?:actor:|did:|utopy\.|namespace|sourceRef)|^[a-z]+(?:\.[a-z]+)+$/i.test(label) ? fallback : label.slice(0, 120);
}
/** UI eligibility only. Studio must still authorize edits on its own server. */
export function canPersonalizeProfile(allLive: any[], actorId: string, nodeId = "", now = Date.now()) {
  return activeEntitlementDVs(allLive, actorId, [], now).some(dv => {
    const subject = text(dv?.attrs?.nodeId || dv?.attrs?.targetNodeId);
    return nodeId ? !subject || subject === nodeId : !subject;
  });
}
