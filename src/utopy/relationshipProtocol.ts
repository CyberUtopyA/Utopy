export type RelationshipParty = {
  actorId?: string | null;
  nodeId?: string | null;
  role?: string | null;
};

export type RelationshipStatus =
  | "requested"
  | "accepted"
  | "active"
  | "paused"
  | "ended";

export type RelationshipSnapshot = {
  relationshipId: string;
  parties: RelationshipParty[];
  purpose: string;
  status: RelationshipStatus;
  scopes: string[];
  privacyScopes: string[];
  acceptedPartyIds: string[];
  bilateral: boolean;
  service: {
    capability: string | null;
    consumerNodeId: string | null;
    providerNodeId: string | null;
    preference: "preferred" | "normal";
    autoPropose: boolean;
    autoAccept: boolean;
    available: boolean;
  } | null;
  events: any[];
};

function text(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function unique(values: any[]): string[] {
  return Array.from(
    new Set(values.flat(4).map((value) => text(value)).filter(Boolean)),
  );
}

function time(dv: any) {
  const raw = dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.updatedAt || dv?.attrs?.ts;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function partyId(party: RelationshipParty) {
  return text(party.nodeId, party.actorId);
}

function relationshipIdOf(dv: any) {
  return text(dv?.attrs?.relationshipId, dv?.meta?.relationshipId);
}

function eventId(prefix: string) {
  return `${prefix}:${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}:${Math.random().toString(36).slice(2)}`
  }`;
}

function baseRelationshipDV(input: {
  kind: string;
  relationshipId: string;
  parties: RelationshipParty[];
  actorId: string;
  actingAsNodeId?: string | null;
  purpose: string;
  scopes?: string[];
  privacyScopes?: string[];
  status: RelationshipStatus;
  ttlMs?: number | null;
  attrs?: Record<string, any>;
}) {
  const ts = new Date().toISOString();
  const participants = unique([
    input.parties.flatMap((party) => [party.actorId, party.nodeId]),
    input.actorId,
    input.actingAsNodeId,
  ]);
  return {
    id: eventId(input.kind),
    kind: input.kind,
    attrs: {
      relationshipId: input.relationshipId,
      parties: input.parties,
      purpose: input.purpose,
      scopes: unique([input.scopes || ["message"]]),
      privacyScopes: unique([input.privacyScopes || ["participants"]]),
      actorId: input.actorId,
      actingAsNodeId: input.actingAsNodeId || null,
      participants,
      status: input.status,
      consent: { explicit: true, automaticExpansion: false },
      ...(input.attrs || {}),
    },
    traits: ["utopy:relationship", `relationship:${input.status}`, "consent:required"],
    meta: {
      ns: "utopy:relationship",
      ts,
      updatedAt: ts,
      version: 1,
      relationshipId: input.relationshipId,
      scopes: ["participants"],
      authority: input.actingAsNodeId || input.actorId,
      originNode: input.actingAsNodeId || undefined,
      ttl_ms: input.ttlMs || undefined,
      schema: "utopy.relationship@1",
      sensitivity: "relationship",
    },
  };
}

export function createRelationshipId(prefix = "rel") {
  return `${prefix}:${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}:${Math.random().toString(36).slice(2)}`
  }`;
}

export function buildRelationshipRequestDV(input: {
  relationshipId?: string | null;
  parties: RelationshipParty[];
  actorId: string;
  actingAsNodeId?: string | null;
  purpose: string;
  scopes?: string[];
  privacyScopes?: string[];
  ttlMs?: number | null;
}) {
  return baseRelationshipDV({
    ...input,
    kind: "relationship.request",
    relationshipId: input.relationshipId || createRelationshipId(),
    status: "requested",
  });
}

export function buildRelationshipAcceptedDV(input: {
  request: any;
  actorId: string;
  actingAsNodeId?: string | null;
}) {
  const attrs = input.request?.attrs || {};
  const relationshipId = relationshipIdOf(input.request);
  if (!relationshipId) throw new Error("La solicitud no contiene relationshipId.");
  return baseRelationshipDV({
    kind: "relationship.accepted",
    relationshipId,
    parties: Array.isArray(attrs.parties) ? attrs.parties : [],
    actorId: input.actorId,
    actingAsNodeId: input.actingAsNodeId,
    purpose: text(attrs.purpose) || "relación",
    scopes: attrs.scopes,
    privacyScopes: attrs.privacyScopes,
    status: "accepted",
    attrs: { respondsTo: input.request.id },
  });
}

export function buildRelationshipStatusDV(input: {
  relationshipId: string;
  parties: RelationshipParty[];
  actorId: string;
  actingAsNodeId?: string | null;
  purpose: string;
  status: "paused" | "ended";
  scopes?: string[];
  reason?: string | null;
}) {
  return baseRelationshipDV({
    ...input,
    kind: `relationship.${input.status}`,
    privacyScopes: ["participants"],
    attrs: { reason: input.reason || null },
  });
}

export function buildServiceRelationshipProposalDV(input: {
  relationshipId?: string | null;
  consumerNodeId: string;
  providerNodeId: string;
  actorId: string;
  actingAsNodeId?: string | null;
  capability: string;
  territory?: string | null;
  conditions?: Record<string, any> | null;
  preference?: "preferred" | "normal";
  autoPropose?: boolean;
  autoAccept?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}) {
  const relationshipId = input.relationshipId || createRelationshipId("service.rel");
  return baseRelationshipDV({
    kind: "service.relationship.proposal",
    relationshipId,
    parties: [
      { nodeId: input.consumerNodeId, role: "consumer" },
      { nodeId: input.providerNodeId, role: "provider" },
    ],
    actorId: input.actorId,
    actingAsNodeId: input.actingAsNodeId,
    purpose: input.capability,
    scopes: ["message", "availability", "operation.proposal"],
    privacyScopes: ["participants"],
    status: "requested",
    attrs: {
      consumerNodeId: input.consumerNodeId,
      providerNodeId: input.providerNodeId,
      capability: input.capability,
      territory: input.territory || null,
      conditions: input.conditions || null,
      preference: input.preference || "preferred",
      autoPropose: input.autoPropose !== false,
      autoAccept: input.autoAccept === true,
      validFrom: input.validFrom || new Date().toISOString(),
      validUntil: input.validUntil || null,
    },
  });
}

export function buildServiceRelationshipAcceptedDV(input: {
  proposal: any;
  actorId: string;
  actingAsNodeId?: string | null;
}) {
  const attrs = input.proposal?.attrs || {};
  return baseRelationshipDV({
    kind: "service.relationship.accepted",
    relationshipId: relationshipIdOf(input.proposal),
    parties: Array.isArray(attrs.parties) ? attrs.parties : [],
    actorId: input.actorId,
    actingAsNodeId: input.actingAsNodeId,
    purpose: text(attrs.capability, attrs.purpose) || "servicio habitual",
    scopes: attrs.scopes,
    privacyScopes: attrs.privacyScopes,
    status: "accepted",
    attrs: {
      respondsTo: input.proposal.id,
      consumerNodeId: attrs.consumerNodeId,
      providerNodeId: attrs.providerNodeId,
      capability: attrs.capability,
      preference: attrs.preference || "preferred",
      autoPropose: attrs.autoPropose !== false,
      autoAccept: attrs.autoAccept === true,
      validFrom: attrs.validFrom || null,
      validUntil: attrs.validUntil || null,
    },
  });
}

export function deriveRelationshipSnapshot(
  allLive: any[],
  relationshipId: string,
): RelationshipSnapshot | null {
  const events = (Array.isArray(allLive) ? allLive : [])
    .filter((dv) => relationshipIdOf(dv) === relationshipId)
    .sort((a, b) => time(a) - time(b));
  if (!events.length) return null;
  const root = events.find((dv) =>
    ["relationship.request", "service.relationship.proposal"].includes(dv.kind),
  ) || events[0];
  const attrs = root?.attrs || {};
  const parties = (Array.isArray(attrs.parties) ? attrs.parties : []) as RelationshipParty[];
  const acceptedPartyIds = unique(
    events
      .filter((dv) => /relationship\.accepted$/.test(String(dv?.kind || "")))
      .map((dv) => text(dv?.attrs?.actingAsNodeId, dv?.attrs?.actorId)),
  );
  const requester = text(root?.attrs?.actingAsNodeId, root?.attrs?.actorId);
  const consented = new Set([requester, ...acceptedPartyIds].filter(Boolean));
  const bilateral = parties.length >= 2 && parties.every((party) => consented.has(partyId(party)));
  const latest = events[events.length - 1];
  let status: RelationshipStatus = bilateral ? "active" : acceptedPartyIds.length ? "accepted" : "requested";
  if (/\.paused$/.test(latest.kind)) status = "paused";
  if (/\.ended$/.test(latest.kind)) status = "ended";

  const serviceRoot = events.find((dv) => dv.kind === "service.relationship.proposal");
  return {
    relationshipId,
    parties,
    purpose: text(attrs.purpose, attrs.capability) || "relación",
    status,
    scopes: unique([attrs.scopes || []]),
    privacyScopes: unique([attrs.privacyScopes || []]),
    acceptedPartyIds,
    bilateral,
    service: serviceRoot
      ? {
          capability: text(serviceRoot?.attrs?.capability) || null,
          consumerNodeId: text(serviceRoot?.attrs?.consumerNodeId) || null,
          providerNodeId: text(serviceRoot?.attrs?.providerNodeId) || null,
          preference: serviceRoot?.attrs?.preference === "normal" ? "normal" : "preferred",
          autoPropose: serviceRoot?.attrs?.autoPropose !== false,
          autoAccept: serviceRoot?.attrs?.autoAccept === true,
          available: status === "active" && serviceRoot?.attrs?.availability?.available !== false,
        }
      : null,
    events,
  };
}

export function collectRelationshipSnapshots(allLive: any[]) {
  const ids = unique((Array.isArray(allLive) ? allLive : []).map(relationshipIdOf));
  return ids
    .map((id) => deriveRelationshipSnapshot(allLive, id))
    .filter(Boolean) as RelationshipSnapshot[];
}

export function preferredProvidersFor(
  allLive: any[],
  consumerNodeId: string,
  capability: string,
) {
  return collectRelationshipSnapshots(allLive).filter(
    (relationship) =>
      relationship.status === "active" &&
      relationship.service?.consumerNodeId === consumerNodeId &&
      relationship.service?.capability === capability &&
      relationship.service?.preference === "preferred" &&
      relationship.service?.autoPropose === true,
  );
}
