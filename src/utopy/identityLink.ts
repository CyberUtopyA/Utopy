import { publishAuthorizedDV } from "./authorizedPublish";
import { createRelationshipId } from "./relationshipProtocol";

export type IdentityLinkStatus =
  | "requested"
  | "challenged"
  | "proved"
  | "accepted"
  | "active"
  | "revoke_requested"
  | "revoked";

export type IdentityLinkProjection = {
  relationshipId: string;
  linkId: string | null;
  actorId: string;
  nodeId: string;
  nodeName: string;
  status: IdentityLinkStatus;
  profileVerified: boolean;
  loyalty: Record<string, any> | null;
  finance: Record<string, any> | null;
  benefit: Record<string, any> | null;
  proof: "verified" | "pending" | "legacy";
  events: any[];
};

function text(...values: any[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function uid(prefix: string) {
  const value = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${value}`;
}

function privateMeta(input: {
  relationshipId: string;
  authority: string;
  targetNodeId?: string | null;
  respondsTo?: string | null;
}) {
  const ts = new Date().toISOString();
  return {
    ns: "utopy:identity",
    ts,
    updatedAt: ts,
    version: 1,
    relationshipId: input.relationshipId,
    scopes: ["participants"],
    sensitivity: "sensitive",
    authority: input.authority,
    targetNodeId: input.targetNodeId || undefined,
    respondsTo: input.respondsTo || undefined,
    portable: true,
    schema: "utopy.identity.link@1",
  };
}

export function buildIdentityLinkRequestDV(input: {
  actorId: string;
  actorName?: string | null;
  nodeId: string;
  nodeName?: string | null;
  relationshipId?: string | null;
  purpose?: string | null;
}) {
  const relationshipId = input.relationshipId || createRelationshipId("identity.rel");
  const requestId = uid("identity.link.request");
  return {
    id: requestId,
    kind: "identity.link.request",
    attrs: {
      requestId,
      relationshipId,
      buyerActorId: input.actorId,
      actorId: input.actorId,
      actorName: input.actorName || null,
      nodeId: input.nodeId,
      nodeName: input.nodeName || input.nodeId,
      purpose: input.purpose || "Continuidad con el nodo",
      status: "requested",
      challengeRequired: true,
      automaticMatching: false,
      customerIdShared: false,
      consent: { actor: true, node: false },
      participants: [input.actorId, input.nodeId],
    },
    traits: ["utopy:identity", "identity:link", "consent:required"],
    meta: privateMeta({
      relationshipId,
      authority: input.actorId,
      targetNodeId: input.nodeId,
    }),
  };
}

export function buildIdentityLinkChallengeDV(input: {
  request: any;
  nodeId: string;
  nodeName?: string | null;
  challenge: string;
  methods?: string[];
  expiresAt: string;
}) {
  const request = input.request?.attrs || {};
  if (input.request?.kind !== "identity.link.request") {
    throw new Error("La vinculación necesita una solicitud válida.");
  }
  if (text(request.nodeId) !== text(input.nodeId)) {
    throw new Error("El challenge no corresponde a este nodo.");
  }
  return {
    id: uid("identity.link.challenge"),
    kind: "identity.link.challenge",
    attrs: {
      challengeId: uid("challenge"),
      requestId: input.request.id,
      relationshipId: request.relationshipId,
      buyerActorId: request.buyerActorId,
      nodeId: input.nodeId,
      nodeName: input.nodeName || input.nodeId,
      challenge: input.challenge,
      methods: input.methods || ["node_defined"],
      expiresAt: input.expiresAt,
      status: "challenged",
      participants: [request.buyerActorId, input.nodeId],
    },
    traits: ["utopy:identity", "identity:link:challenge", "consent:progressive"],
    meta: privateMeta({
      relationshipId: request.relationshipId,
      authority: input.nodeId,
      targetNodeId: request.buyerActorId,
      respondsTo: input.request.id,
    }),
  };
}

export function buildIdentityLinkProofDV(input: {
  challenge: any;
  actorId: string;
  proofMethod: string;
  proofRef: string;
}) {
  const challenge = input.challenge?.attrs || {};
  if (input.challenge?.kind !== "identity.link.challenge") {
    throw new Error("La prueba necesita un challenge del nodo.");
  }
  if (text(challenge.buyerActorId) !== text(input.actorId)) {
    throw new Error("El challenge pertenece a otra identidad.");
  }
  if (Date.parse(String(challenge.expiresAt || "")) <= Date.now()) {
    throw new Error("El challenge de vinculación venció.");
  }
  return {
    id: uid("identity.link.proof"),
    kind: "identity.link.proof",
    attrs: {
      challengeId: challenge.challengeId,
      requestId: challenge.requestId,
      relationshipId: challenge.relationshipId,
      buyerActorId: input.actorId,
      nodeId: challenge.nodeId,
      proofMethod: input.proofMethod,
      proofRef: input.proofRef,
      rawIdentityDataIncluded: false,
      status: "proved",
      participants: [input.actorId, challenge.nodeId],
    },
    traits: ["utopy:identity", "identity:link:proof", "privacy:minimized"],
    meta: privateMeta({
      relationshipId: challenge.relationshipId,
      authority: input.actorId,
      targetNodeId: challenge.nodeId,
      respondsTo: input.challenge.id,
    }),
  };
}

export function buildIdentityLinkAcceptedDV(input: {
  proof: any;
  nodeId: string;
  nodeName?: string | null;
  linkId?: string | null;
}) {
  const proof = input.proof?.attrs || {};
  if (input.proof?.kind !== "identity.link.proof") {
    throw new Error("La aceptación necesita una prueba de vinculación.");
  }
  if (text(proof.nodeId) !== text(input.nodeId)) {
    throw new Error("La prueba no está dirigida a este nodo.");
  }
  const linkId = input.linkId || uid(`link:${input.nodeId.replace(/[^a-z0-9.-]/gi, "-")}`);
  return {
    id: uid("identity.link.accepted"),
    kind: "identity.link.accepted",
    attrs: {
      linkId,
      requestId: proof.requestId,
      proofId: input.proof.id,
      relationshipId: proof.relationshipId,
      buyerActorId: proof.buyerActorId,
      nodeId: input.nodeId,
      nodeName: input.nodeName || input.nodeId,
      status: "accepted",
      customerIdShared: false,
      nodeScoped: true,
      consent: { actor: true, node: true },
      participants: [proof.buyerActorId, input.nodeId],
    },
    traits: ["utopy:identity", "identity:link:accepted", "privacy:node-scoped"],
    meta: privateMeta({
      relationshipId: proof.relationshipId,
      authority: input.nodeId,
      targetNodeId: proof.buyerActorId,
      respondsTo: input.proof.id,
    }),
  };
}

export function buildIdentityLinkActiveDV(input: {
  accepted: any;
  nodeId: string;
  projection?: {
    profileVerified?: boolean;
    loyalty?: Record<string, any> | null;
    finance?: Record<string, any> | null;
    benefit?: Record<string, any> | null;
  };
}) {
  const accepted = input.accepted?.attrs || {};
  if (input.accepted?.kind !== "identity.link.accepted" || text(accepted.nodeId) !== text(input.nodeId)) {
    throw new Error("No existe una vinculación aceptada por este nodo.");
  }
  return {
    id: `identity.link.active:${accepted.linkId}`,
    kind: "identity.link.active",
    attrs: {
      linkId: accepted.linkId,
      relationshipId: accepted.relationshipId,
      buyerActorId: accepted.buyerActorId,
      nodeId: input.nodeId,
      nodeName: accepted.nodeName || input.nodeId,
      status: "active",
      profileVerified: input.projection?.profileVerified === true,
      loyalty: input.projection?.loyalty || null,
      finance: input.projection?.finance || null,
      benefit: input.projection?.benefit || null,
      customerIdShared: false,
      participants: [accepted.buyerActorId, input.nodeId],
    },
    traits: ["utopy:identity", "identity:link:active", "privacy:minimized"],
    meta: privateMeta({
      relationshipId: accepted.relationshipId,
      authority: input.nodeId,
      targetNodeId: accepted.buyerActorId,
      respondsTo: input.accepted.id,
    }),
  };
}

export function buildIdentityLinkRevokeRequestDV(input: {
  link: any;
  actorId: string;
  reason?: string | null;
}) {
  const link = input.link?.attrs || {};
  if (text(link.buyerActorId) !== text(input.actorId)) {
    throw new Error("Solo la identidad vinculada puede solicitar la desconexión.");
  }
  return {
    id: uid("identity.link.revoke.request"),
    kind: "identity.link.revoke.request",
    attrs: {
      linkId: link.linkId,
      relationshipId: link.relationshipId,
      buyerActorId: input.actorId,
      nodeId: link.nodeId,
      reason: input.reason || null,
      status: "revoke_requested",
      deleteNodeHistory: false,
      participants: [input.actorId, link.nodeId],
    },
    traits: ["utopy:identity", "identity:link:revoke", "consent:withdrawn"],
    meta: privateMeta({
      relationshipId: link.relationshipId,
      authority: input.actorId,
      targetNodeId: link.nodeId,
      respondsTo: input.link.id,
    }),
  };
}

export function buildIdentityLinkRevokedDV(input: {
  request: any;
  nodeId: string;
  reason?: string | null;
}) {
  const request = input.request?.attrs || {};
  if (input.request?.kind !== "identity.link.revoke.request" || text(request.nodeId) !== text(input.nodeId)) {
    throw new Error("La revocación no corresponde a este nodo.");
  }
  return {
    id: `identity.link.revoked:${request.linkId}`,
    kind: "identity.link.revoked",
    attrs: {
      linkId: request.linkId,
      relationshipId: request.relationshipId,
      buyerActorId: request.buyerActorId,
      nodeId: input.nodeId,
      status: "revoked",
      reason: input.reason || request.reason || null,
      customerRecordDeleted: false,
      revokedAt: new Date().toISOString(),
      participants: [request.buyerActorId, input.nodeId],
    },
    traits: ["utopy:identity", "identity:link:revoked", "consent:withdrawn"],
    meta: privateMeta({
      relationshipId: request.relationshipId,
      authority: input.nodeId,
      targetNodeId: request.buyerActorId,
      respondsTo: input.request.id,
    }),
  };
}

function structurallyNodeSigned(dv: any, nodeId: string) {
  return Boolean(
    dv?.meta?.ownership?.signature?.value &&
      text(dv?.meta?.authority) === nodeId &&
      text(dv?.attrs?.actingAsNodeId) === nodeId,
  );
}

export function projectIdentityLinks(
  allLive: any[],
  actorId: string,
  verifiedIds?: Set<string>,
): IdentityLinkProjection[] {
  const all = Array.isArray(allLive) ? allLive : [];
  const relevant = all.filter((dv) => {
    if (!String(dv?.kind || "").startsWith("identity.link.")) return false;
    return text(dv?.attrs?.buyerActorId, dv?.attrs?.actorId) === actorId;
  });
  const relationshipIds = Array.from(new Set(relevant.map((dv) => text(dv?.attrs?.relationshipId)).filter(Boolean)));
  return relationshipIds.map((relationshipId) => {
    const events = relevant
      .filter((dv) => text(dv?.attrs?.relationshipId) === relationshipId)
      .sort((a, b) => Date.parse(text(a?.meta?.ts)) - Date.parse(text(b?.meta?.ts)));
    const latest = events[events.length - 1];
    const active = [...events].reverse().find((dv) => dv?.kind === "identity.link.active");
    const accepted = [...events].reverse().find((dv) => dv?.kind === "identity.link.accepted");
    const request = events.find((dv) => dv?.kind === "identity.link.request");
    const source = active || accepted || latest || request;
    const attrs = source?.attrs || {};
    const nodeId = text(attrs.nodeId, request?.attrs?.nodeId);
    const revoked = latest?.kind === "identity.link.revoked";
    const nodeProof = active || accepted;
    const verified = Boolean(
      nodeProof &&
      structurallyNodeSigned(nodeProof, nodeId) &&
      (!verifiedIds || verifiedIds.has(String(nodeProof?.id || ""))),
    );
    const status = (revoked
      ? "revoked"
      : verified && active
        ? "active"
        : verified && accepted
          ? "accepted"
          : text(latest?.attrs?.status) || "requested") as IdentityLinkStatus;
    return {
      relationshipId,
      linkId: verified ? text(active?.attrs?.linkId, accepted?.attrs?.linkId) || null : null,
      actorId,
      nodeId,
      nodeName: text(attrs.nodeName, request?.attrs?.nodeName, nodeId),
      status,
      profileVerified: verified && active?.attrs?.profileVerified === true,
      loyalty: verified ? active?.attrs?.loyalty || null : null,
      finance: verified ? active?.attrs?.finance || null : null,
      benefit: verified ? active?.attrs?.benefit || null : null,
      proof: verified ? "verified" : events.some((event) => event?.meta?.ownership?.signature?.value) ? "pending" : "legacy",
      events,
    };
  });
}

export function publishIdentityLinkActorDV(input: {
  dv: any;
  allLive?: any[];
  activeActor?: any;
  targetNodeId: string;
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    targetNodeId: input.targetNodeId,
    sensitivity: "sensitive",
  });
}

export function publishIdentityLinkNodeDV(input: {
  dv: any;
  allLive?: any[];
  activeActor?: any;
  nodeId: string;
  targetActorId?: string | null;
}) {
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.nodeId,
    requiredAuthority: input.nodeId,
    targetNodeId: input.targetActorId || null,
    sensitivity: "sensitive",
  });
}
