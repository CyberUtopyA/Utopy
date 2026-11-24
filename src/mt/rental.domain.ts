import { publishAuthorizedDV, verifyAuthorizedDV } from "../utopy/authorizedPublish";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { mtLiveSnapshot } from "./mt.liveStore";
import { verifyAdultForJurisdiction } from "../utopy/identityPersonal";

export const RENTAL_STATES = ["AVAILABLE", "HELD", "OCCUPIED", "UNAVAILABLE"] as const;
export type RentalState = (typeof RENTAL_STATES)[number];

const text = (...values: any[]) => values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
const time = (value: any) => { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) ? parsed : 0; };
const revisionOf = (value: any) => Number(value?.attrs?.revision ?? value?.meta?.revision ?? 0) || 0;
const unitIdOf = (value: any) => text(value?.attrs?.unitId, value?.attrs?.roomId, value?.attrs?.id, value?.id);
const propertyIdOf = (value: any) => text(value?.attrs?.propertyId, value?.attrs?.property?.id);

export function isRentalDV(dv: any) {
  return /^rental\./i.test(text(dv?.kind)) || /(?:^|:)rental|alquiler|arrendamiento/i.test([dv?.kind, ...(dv?.traits || [])].join(" "));
}

export function rentalEventsFor(allLive: any[], unitId: string) {
  return (allLive || []).filter((dv) => /^rental\./.test(text(dv?.kind)) && unitIdOf(dv) === unitId)
    .sort((a, b) => revisionOf(a) - revisionOf(b) || time(a?.attrs?.occurredAt || a?.meta?.ts) - time(b?.attrs?.occurredAt || b?.meta?.ts));
}

export function projectRentalUnitState(unit: any, events: any[] = [], now = Date.now()) {
  let state: RentalState = text(unit?.attrs?.state, unit?.state).toUpperCase() as RentalState;
  if (!RENTAL_STATES.includes(state)) state = unit?.attrs?.available === false || unit?.available === false ? "UNAVAILABLE" : "AVAILABLE";
  let revision = revisionOf(unit);
  let activeContractId = "";
  let activeHoldId = "";
  const renewals = new Set<string>();
  for (const event of events) {
    // Catalog offers and identity/renewal proposals do not mutate unit occupancy.
    if (!["rental.hold.created", "rental.hold.released", "rental.hold.expired", "rental.contract.activated", "rental.renewal.activated", "rental.contract.ended", "rental.unit.unavailable", "rental.unit.available"].includes(text(event?.kind))) continue;
    const attrs = event?.attrs || {};
    const eventRevision = revisionOf(event);
    if (eventRevision && eventRevision <= revision) continue;
    const kind = text(event?.kind);
    if (kind === "rental.hold.created" && time(attrs.expiresAt) > now && state === "AVAILABLE") {
      state = "HELD"; activeHoldId = text(attrs.holdId, event.id);
    } else if (kind === "rental.hold.released" || (kind === "rental.hold.expired" && state === "HELD")) {
      state = "AVAILABLE"; activeHoldId = "";
    } else if (kind === "rental.contract.activated") {
      state = "OCCUPIED"; activeContractId = text(attrs.contractId, event.id); activeHoldId = "";
    } else if (kind === "rental.renewal.activated") {
      renewals.add(text(attrs.previousContractId)); state = "OCCUPIED"; activeContractId = text(attrs.contractId, attrs.renewalContractId, event.id);
    } else if (kind === "rental.contract.ended" && text(attrs.contractId) === activeContractId) {
      if (!renewals.has(activeContractId)) { state = attrs.maintenanceRequired ? "UNAVAILABLE" : "AVAILABLE"; activeContractId = ""; }
    } else if (kind === "rental.unit.unavailable") state = "UNAVAILABLE";
    else if (kind === "rental.unit.available" && !activeContractId) state = "AVAILABLE";
    revision = Math.max(revision, eventRevision || revision + 1);
  }
  if (state === "HELD") {
    const hold = events.findLast?.((event) => text(event?.attrs?.holdId, event?.id) === activeHoldId);
    if (!hold || time(hold?.attrs?.expiresAt) <= now) { state = "AVAILABLE"; activeHoldId = ""; }
  }
  return { state, revision, available: state === "AVAILABLE", activeHoldId, activeContractId };
}

export function assertRentalTransition(input: { current: ReturnType<typeof projectRentalUnitState>; expectedRevision: number; next: RentalState }) {
  if (input.current.revision !== input.expectedRevision) throw new Error("La unidad cambió. Actualizá antes de continuar.");
  const allowed: Record<RentalState, RentalState[]> = { AVAILABLE: ["HELD", "UNAVAILABLE"], HELD: ["AVAILABLE", "OCCUPIED"], OCCUPIED: ["OCCUPIED", "AVAILABLE", "UNAVAILABLE"], UNAVAILABLE: ["AVAILABLE"] };
  if (!allowed[input.current.state].includes(input.next)) throw new Error(`Transición de unidad no permitida: ${input.current.state} → ${input.next}.`);
}

export async function verifiedAdultClaim(allLive: any[], actorId: string) {
  const candidates = (allLive || []).filter((dv) => /^(identity\.claim|identity\.credential)/.test(text(dv?.kind)) && text(dv?.attrs?.actorId, dv?.attrs?.subjectActorId) === actorId && dv?.attrs?.over18 === true && (!dv?.attrs?.expiresAt || time(dv.attrs.expiresAt) > Date.now()));
  for (const claim of candidates) {
    const verification = await verifyAuthorizedDV(claim, allLive);
    if (verification.accepted && verification.proof === "verified") return { eligible: true, claimId: claim.id };
  }
  return { eligible: false, claimId: null };
}

export async function requireVerifiedAdult(allLive: any[], activeActor?: any, jurisdiction = { country: "PY", region: "Canindeyú", city: "Salto del Guairá" }) {
  const identity = await resolveCurrentIdentityContext({ allLive, activeActor });
  const adult = await verifyAdultForJurisdiction(allLive, identity.actorId, jurisdiction);
  const eligibility = { eligible: adult.verified, claimId: adult.credentialId };
  if (!eligibility.eligible) throw new Error("La identidad del locatario todavía no acredita la mayoría de edad requerida para esta jurisdicción.");
  return { identity, eligibility };
}

export async function resolveRentalActorRole(allLive: any[], ownerId: string, activeActor?: any) {
  const identity = await resolveCurrentIdentityContext({ allLive, activeActor });
  const owner = (allLive || []).find((dv) => dv?.kind === "skylines.owner.profile" && text(dv?.id, dv?.attrs?.ownerId) === ownerId);
  const admins = Array.isArray(owner?.attrs?.authorizedAdminActorIds) ? owner.attrs.authorizedAdminActorIds.map(String) : [];
  const landlordActorId = text(owner?.attrs?.actorId, owner?.attrs?.issuerActorId);
  const proof = owner ? await verifyAuthorizedDV(owner, allLive) : null;
  const trusted = !!landlordActorId && proof?.accepted && proof.proof === "verified" && proof.actorId === landlordActorId;
  return { identity, role: trusted && identity.actorId === landlordActorId ? "landlord" : trusted && admins.includes(identity.actorId) ? "authorized_admin" : "tenant", landlordActorId } as const;
}

export async function setRentalUnitAvailability(input: {propertyId:string;unitId:string;ownerId:string;expectedRevision:number;available:boolean}) {
  const allLive=mtLiveSnapshot();
  const access=await resolveRentalActorRole(allLive,input.ownerId);
  if (!["landlord","authorized_admin"].includes(access.role)) throw Error("Necesitás autorización verificable del propietario para administrar esta unidad.");
  const property=allLive.find(dv=>dv?.kind==="rental.property"&&text(dv.attrs?.propertyId,dv.id)===input.propertyId);
  if (text(property?.attrs?.ownerId,property?.attrs?.owner_id,property?.attrs?.owner)!==input.ownerId) throw Error("La propiedad no corresponde a este propietario.");
  const propertyProof=await verifyAuthorizedDV(property,allLive);
  if(!propertyProof.accepted||propertyProof.proof!=="verified"||propertyProof.actorId!==access.landlordActorId) throw Error("La propiedad necesita la vinculación firmada de su propietario.");
  const unit=allLive.find(dv=>dv?.kind==="rental.unit"&&unitIdOf(dv)===input.unitId&&propertyIdOf(dv)===input.propertyId);
  if (!unit) throw Error("La unidad no existe en esta propiedad.");
  const current=projectRentalUnitState(unit,rentalEventsFor(allLive,input.unitId));
  // Availability management never releases a hold or an occupied contract.
  if (!["AVAILABLE","UNAVAILABLE"].includes(current.state)) throw Error("La unidad tiene una reserva o contrato activo. Gestioná esa operación primero.");
  assertRentalTransition({current,expectedRevision:input.expectedRevision,next:input.available?"AVAILABLE":"UNAVAILABLE"});
  return publishRentalEvent({kind:input.available?"rental.unit.available":"rental.unit.unavailable",id:`rental.availability:${input.unitId}:${crypto.randomUUID()}`,allLive,attrs:{propertyId:input.propertyId,unitId:input.unitId,revision:current.revision+1,expectedRevision:current.revision,occurredAt:new Date().toISOString()}});
}

export async function createPendingIdentityReservation(input: { propertyId: string; unitId: string; allLive?: any[]; activeActor?: any; minutes?: number }) {
  const allLive = input.allLive || mtLiveSnapshot();
  const identity = await resolveCurrentIdentityContext({ allLive, activeActor: input.activeActor });
  const reservationId = `rental.reservation:${input.unitId}:${identity.actorId}`;
  const expiresAt = new Date(Date.now() + (input.minutes || 20) * 60_000).toISOString();
  const existing = allLive.find((dv) => dv?.id === reservationId && time(dv?.attrs?.expiresAt) > Date.now());
  if (existing) return { dv: existing, context: identity } as any;
  return publishRentalEvent({ kind: "rental.reservation.pending_identity", id: reservationId, allLive, activeActor: input.activeActor, attrs: { reservationId, propertyId: input.propertyId, unitId: input.unitId, actorId: identity.actorId, status: "reserved_pending_identity", occurredAt: new Date().toISOString(), expiresAt } });
}

async function publishRentalEvent(input: { kind: string; id: string; attrs: any; allLive?: any[]; activeActor?: any; sensitivity?: "relationship" | "sensitive" }) {
  const allLive = input.allLive || mtLiveSnapshot();
  return publishAuthorizedDV({ dv: { id: input.id, kind: input.kind, attrs: input.attrs, traits: ["rental:event", "skylines:rental"], meta: { ns: "skylines:rental", scopes: ["participants"] } }, allLive, activeActor: input.activeActor, action: input.kind, sensitivity: input.sensitivity || "relationship" });
}

export async function createRentalHold(input: { propertyId: string; unitId: string; expectedRevision: number; allLive?: any[]; activeActor?: any; minutes?: number }) {
  const allLive = input.allLive || mtLiveSnapshot();
  const unit = allLive.find((dv) => /^rental\.unit$/.test(text(dv?.kind)) && unitIdOf(dv) === input.unitId);
  if (!unit) throw new Error("La unidad viva no está disponible.");
  const current = projectRentalUnitState(unit, rentalEventsFor(allLive, input.unitId));
  assertRentalTransition({ current, expectedRevision: input.expectedRevision, next: "HELD" });
  const identity = await resolveCurrentIdentityContext({ allLive, activeActor: input.activeActor });
  const holdId = `rental.hold:${input.unitId}:${identity.actorId}`;
  const existing = allLive.find((dv) => dv?.id === holdId && time(dv?.attrs?.expiresAt) > Date.now());
  if (existing) return { dv: existing, context: identity } as any;
  return publishRentalEvent({ kind: "rental.hold.created", id: holdId, allLive, activeActor: input.activeActor, attrs: { holdId, propertyId: input.propertyId, unitId: input.unitId, holderActorId: identity.actorId, revision: current.revision + 1, expectedRevision: current.revision, occurredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + (input.minutes || 20) * 60_000).toISOString() } });
}

export async function activateRentalContract(input: { propertyId: string; unitId: string; holdId: string; contractId: string; tenantActorId: string; expectedRevision: number; periodStart?: string; periodEnd?: string; allLive?: any[]; activeActor?: any }) {
  const allLive = input.allLive || mtLiveSnapshot();
  const adult = await verifyAdultForJurisdiction(allLive, input.tenantActorId, { country: "PY", region: "Canindeyú", city: "Salto del Guairá" });
  if (!adult.verified) throw new Error("La identidad vinculada al locatario no acredita la mayoría de edad requerida.");
  const unit = allLive.find((dv) => /^rental\.unit$/.test(text(dv?.kind)) && unitIdOf(dv) === input.unitId);
  if (!unit) throw new Error("La unidad viva no existe.");
  const current = projectRentalUnitState(unit, rentalEventsFor(allLive, input.unitId));
  assertRentalTransition({ current, expectedRevision: input.expectedRevision, next: "OCCUPIED" });
  if (current.state !== "HELD" || current.activeHoldId !== input.holdId) throw new Error("La reserva ya no pertenece a este contrato.");
  const duplicate = allLive.find((dv) => dv?.kind === "rental.contract.activated" && text(dv?.attrs?.contractId) === input.contractId);
  if (duplicate) return duplicate;
  return publishRentalEvent({ kind: "rental.contract.activated", id: `rental.contract.activated:${input.contractId}`, allLive, activeActor: input.activeActor, sensitivity: "sensitive", attrs: { contractId: input.contractId, propertyId: input.propertyId, unitId: input.unitId, holdId: input.holdId, tenantActorId: input.tenantActorId, adultClaimId: adult.credentialId, revision: current.revision + 1, expectedRevision: current.revision, periodStart: input.periodStart || null, periodEnd: input.periodEnd || null, occurredAt: new Date().toISOString() } });
}

export async function proposeRentalRenewal(input: { propertyId: string; unitId: string; previousContractId: string; periodStart: string; periodEnd: string; terms: any; allLive?: any[]; activeActor?: any }) {
  const allLive = input.allLive || mtLiveSnapshot();
  await requireVerifiedAdult(allLive, input.activeActor);
  const id = `rental.renewal:${input.previousContractId}:${input.periodStart}`;
  const existing = allLive.find((dv) => dv?.id === id);
  if (existing) return existing;
  return publishRentalEvent({ kind: "rental.renewal.proposed", id, allLive, activeActor: input.activeActor, attrs: { renewalId: id, propertyId: input.propertyId, unitId: input.unitId, previousContractId: input.previousContractId, periodStart: input.periodStart, periodEnd: input.periodEnd, terms: input.terms, ownerConsent: false, tenantConsent: false, occurredAt: new Date().toISOString() } });
}

export async function respondRentalRenewal(input: { renewalId: string; role: "owner" | "tenant"; accept: boolean; allLive?: any[]; activeActor?: any }) {
  const allLive = input.allLive || mtLiveSnapshot();
  if (input.role === "tenant" && input.accept) await requireVerifiedAdult(allLive, input.activeActor);
  const proposal = [...allLive].reverse().find((dv) => dv?.id === input.renewalId);
  if (!proposal) throw new Error("La propuesta de renovación no existe.");
  const decisionId = `${input.renewalId}:consent:${input.role}`;
  const attrs = { ...(proposal.attrs || {}), renewalId: input.renewalId, role: input.role, consent: input.accept, decision: input.accept ? "accepted" : "declined", occurredAt: new Date().toISOString() };
  const decision = await publishRentalEvent({ kind: input.accept ? "rental.renewal.accepted" : "rental.renewal.declined", id: decisionId, allLive, activeActor: input.activeActor, attrs });
  if (!input.accept) return decision;
  const otherRole = input.role === "owner" ? "tenant" : "owner";
  const otherAccepted = allLive.some((dv) => dv?.id === `${input.renewalId}:consent:${otherRole}` && dv?.kind === "rental.renewal.accepted" && dv?.attrs?.consent === true);
  if (!otherAccepted) return decision;
  const activatedId = `${input.renewalId}:activated`;
  const duplicate = allLive.find((dv) => dv?.id === activatedId);
  if (duplicate) return duplicate;
  return publishRentalEvent({ kind: "rental.renewal.activated", id: activatedId, allLive: [...allLive, decision.dv], activeActor: input.activeActor, sensitivity: "sensitive", attrs: { ...proposal.attrs, renewalId: input.renewalId, renewalContractId: `rental.contract:${input.renewalId}`, contractId: `rental.contract:${input.renewalId}`, occurredAt: new Date().toISOString() } });
}

export function projectRentalProperties(allLive: any[]) {
  const properties = (allLive || []).filter((dv) => /^rental\.property$|^mt:property\.rental$/.test(text(dv?.kind)));
  const units = (allLive || []).filter((dv) => /^rental\.unit$/.test(text(dv?.kind)));
  return properties.map((property) => {
    const attrs = property.attrs || {};
    const rooms = units.filter((unit) => propertyIdOf(unit) === text(attrs.propertyId, property.id)).map((unit) => {
      const state = projectRentalUnitState(unit, rentalEventsFor(allLive, unitIdOf(unit)));
      return { ...(unit.attrs || {}), id: unitIdOf(unit), available: state.available, state: state.state, revision: state.revision };
    });
    const legacyRooms = rooms.length ? rooms : (attrs.rooms || []).map((room: any) => ({ ...room, state: room.available === false ? "UNAVAILABLE" : "AVAILABLE" }));
    return { ...attrs, id: text(attrs.propertyId, property.id), rooms: legacyRooms, availableRooms: legacyRooms.filter((room: any) => room.available).length };
  });
}
