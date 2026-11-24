import { privateLivingIdentity } from "../utopy/identityPersonal";
import { verifyAuthorizedDV } from "../utopy/authorizedPublish";
export function rentalIdentityFields(attrs: any) {
  return { name: [attrs?.firstName, attrs?.lastName].map(value => String(value || "").trim()).filter(Boolean).join(" "), document: String(attrs?.document || "").trim(), address: String(attrs?.address || "").trim() };
}
export async function verifiedRentalIdentityFields(allLive: any[], actorId: string) {
  const dv = privateLivingIdentity(allLive, actorId);
  if (!dv) return null;
  const proof = await verifyAuthorizedDV(dv, allLive);
  return proof.accepted && proof.proof === "verified" ? rentalIdentityFields(dv.attrs) : null;
}
