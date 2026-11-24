import { publishUtopyDV, type PublishableDV } from "../mt/utopy.networkPublish";
import { sealOwnedDV, verifyOwnedDV } from "./ownership";
import { verifyPortableNodeDV } from "./portableNodeSignature";
import {
  authorizationAllows,
  deriveActorIdForOwnerDid,
  resolveCurrentIdentityContext,
  type CurrentIdentityContext,
  type IdentitySensitivity,
} from "./identityContext";

const SENSITIVE_KINDS = new Set([
  "agreement.signature",
  "credit.decision",
  "credit.account",
  "identity.link.accepted",
  "identity.link.active",
  "identity.link.challenge",
  "identity.link.proof",
  "identity.link.projection",
  "identity.link.revoke.request",
  "identity.link.revoked",
  "market.order.accept",
  "market.order.cancelled",
  "market.order.received",
  "market.order.reject",
  "liq.lock",
  "liq.unlock",
  "node.authorization",
  "node.authorization.revoked",
  "payment.authorization",
  "payment.autopay.authorization",
  "payment.autopay.revoked",
  "payment.offer",
  "payment.outcome",
  "payment.proof",
  "payment.proof.received",
  "payment.proof.review",
  "payment.proof.rejected",
  "pay.confirmation",
  "refund.request",
  "subscription.accepted",
  "subscription.cancelled",
  "work.agreement",
  "work.outcome",
  "work.outcome.verified",
  "value.redemption.request",
  "value.redemption.outcome",
  "value.right",
  "value.stamp",
]);

const RELATIONSHIP_KINDS = new Set([
  "capability.offer",
  "benefit.acceptance",
  "benefit.program",
  "credit.offer",
  "credit.request",
  "delivery.accepted",
  "delivery.assignment",
  "delivery.delivered",
  "delivery.proposal",
  "delivery.request",
  "delivery.status",
  "market.order.accept",
  "market.order.create",
  "pay.session",
  "relationship.accepted",
  "relationship.request",
  "identity.link.request",
  "resonance.offer",
  "resonance.response",
  "service.relationship.accepted",
  "service.relationship.proposal",
  "supply.agreement",
  "thread.message",
  "trade.message",
  "work.quote",
  "work.quote.accepted",
]);

export type AuthorizedPublishInput = {
  dv: PublishableDV;
  allLive?: any[];
  activeActor?: any | null;
  action?: string | null;
  targetNodeId?: string | null;
  actingAsNodeId?: string | null;
  requiredAuthority?: string | null;
  sensitivity?: IdentitySensitivity;
  allowNodeBootstrap?: boolean;
  localOnly?: boolean;
};

export type AuthorizedPublishResult = {
  dv: PublishableDV;
  context: CurrentIdentityContext;
};

export type AuthorizedVerification = {
  accepted: boolean;
  proof: "verified" | "legacy" | "unverified" | "invalid";
  reason: string;
  authority: string | null;
  actorId: string | null;
  actingAsNodeId: string | null;
};

function text(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function unique(values: any[]) {
  return Array.from(new Set(values.flat(3).map((value) => text(value)).filter(Boolean)));
}

export function sensitivityForDV(dv: any): IdentitySensitivity {
  const kind = text(dv?.kind).toLowerCase();
  if (SENSITIVE_KINDS.has(kind)) return "sensitive";
  if (RELATIONSHIP_KINDS.has(kind) || /^relationship\.|^service\.relationship\./.test(kind)) {
    return "relationship";
  }
  return "ephemeral";
}

function nextVersion(dv: any, allLive: any[]) {
  const previous = allLive
    .filter((candidate) => String(candidate?.id || "") === String(dv?.id || ""))
    .reduce((max, candidate) => Math.max(max, Number(candidate?.meta?.version || 0)), 0);
  return Math.max(previous + 1, Number(dv?.meta?.version || 1));
}

function nonce() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function activeAuthorization(
  context: CurrentIdentityContext,
  nodeId: string,
  action?: string | null,
) {
  return context.authorizations.find(
    (authorization) =>
      authorization.nodeId === nodeId && authorizationAllows(authorization, action),
  );
}

export async function publishAuthorizedDV(
  input: AuthorizedPublishInput,
): Promise<AuthorizedPublishResult> {
  if (!input.dv?.id || !input.dv?.kind) {
    throw new Error("La acción no contiene un Dato Vivo válido.");
  }
  const allLive = Array.isArray(input.allLive) ? input.allLive : [];
  const requestedNodeId = text(input.actingAsNodeId) || null;
  const context = await resolveCurrentIdentityContext({
    allLive,
    activeActor: input.activeActor,
    actingAsNodeId: requestedNodeId,
    action: input.action || input.dv.kind,
  });
  const bootstrapNode =
    input.allowNodeBootstrap === true &&
    input.dv.kind === "utopy.node.manifest" &&
    requestedNodeId === text(input.dv?.attrs?.nodeId, input.dv?.attrs?.node?.id);
  const actingAsNodeId = context.actingAsNodeId || (bootstrapNode ? requestedNodeId : null);

  if (requestedNodeId && !actingAsNodeId) {
    throw new Error(
      `Tu identidad no tiene una delegación vigente para actuar por ${requestedNodeId}.`,
    );
  }
  if (
    requestedNodeId &&
    !bootstrapNode &&
    !activeAuthorization(context, requestedNodeId, input.action || input.dv.kind) &&
    context.actingAsNodeId !== requestedNodeId
  ) {
    throw new Error("La delegación no permite realizar esta acción.");
  }

  const authority = actingAsNodeId || context.actorId;
  const requiredAuthority = text(input.requiredAuthority);
  if (requiredAuthority && requiredAuthority !== authority) {
    throw new Error("La identidad activa no controla la autoridad requerida.");
  }

  const sensitivity = input.sensitivity || sensitivityForDV(input.dv);
  const now = new Date().toISOString();
  const originalAttrs = input.dv.attrs || {};
  const originalMeta = input.dv.meta || {};
  const preservesSubjectActor = [
    "node.authorization",
    "node.authorization.revoked",
    "value.right",
    "value.stamp",
    "value.redemption.outcome",
  ].includes(String(input.dv.kind));
  const participants = unique([
    originalAttrs.participants || [],
    preservesSubjectActor ? originalAttrs.actorId : null,
    context.actorId,
    input.targetNodeId,
    actingAsNodeId,
  ]);
  const defaultScopes = sensitivity === "ephemeral" ? ["public"] : ["participants"];
  const scopes = unique([originalMeta.scopes?.length ? originalMeta.scopes : defaultScopes]);
  if (
    sensitivity === "sensitive" &&
    scopes.includes("public") &&
    input.dv.kind !== "utopy.node.manifest"
  ) {
    throw new Error("Una acción sensible no puede publicarse con alcance público.");
  }

  const prepared: PublishableDV = {
    ...input.dv,
    attrs: {
      ...originalAttrs,
      actorId: preservesSubjectActor
        ? text(originalAttrs.actorId, originalAttrs.subject?.actorId)
        : context.actorId,
      issuerActorId: context.actorId,
      actorName: text(originalAttrs.actorName, context.displayName),
      actor: {
        ...(originalAttrs.actor || {}),
        id: context.actorId,
        name: text(originalAttrs.actor?.name, originalAttrs.actorName, context.displayName),
      },
      actingAsNodeId,
      targetNodeId: text(input.targetNodeId, originalAttrs.targetNodeId) || null,
      participants,
      authority,
      identityContext: {
        actorId: context.actorId,
        actingAsNodeId,
        sessionId: context.sessionId,
      },
    },
    meta: {
      ...originalMeta,
      ts: originalMeta.ts || now,
      updatedAt: now,
      version: nextVersion(input.dv, allLive),
      nonce: originalMeta.nonce || nonce(),
      scopes,
      authority,
      originNode: actingAsNodeId || text(originalMeta.originNode) || undefined,
      targetNodeId: text(input.targetNodeId, originalMeta.targetNodeId) || undefined,
      sensitivity,
      issuer: context.actorId,
      portable: originalMeta.portable !== false,
    },
  };
  const signed = await sealOwnedDV(prepared, context.actorId);
  publishUtopyDV(signed, {
    sourceNodeId: actingAsNodeId || context.nodeId || context.actorId,
    targetNodeId: text(input.targetNodeId) || undefined,
    localOnly: input.localOnly,
  });
  return { dv: signed, context };
}

export function routeActionToNode(input: {
  dv: PublishableDV;
  targetNodeId: string;
  sourceNodeId?: string | null;
  localOnly?: boolean;
}) {
  if (!input.targetNodeId) throw new Error("La acción no tiene nodo de destino.");
  return publishUtopyDV(input.dv, {
    sourceNodeId: text(input.sourceNodeId, input.dv?.meta?.originNode) || undefined,
    targetNodeId: input.targetNodeId,
    localOnly: input.localOnly,
  });
}

function latestVersionIsCurrent(dv: any, allLive: any[]) {
  const version = Number(dv?.meta?.version || 0);
  const newer = allLive.some(
    (candidate) =>
      candidate !== dv &&
      String(candidate?.id || "") === String(dv?.id || "") &&
      Number(candidate?.meta?.version || 0) > version,
  );
  return !newer;
}

function allowedByAuthorizationDV(dv: any, action: string) {
  const allowed = unique([
    dv?.attrs?.allowedActions || [],
    dv?.attrs?.actions || [],
    dv?.attrs?.capabilities || [],
  ]).map((value) => value.toLowerCase());
  const wanted = action.toLowerCase();
  return allowed.some(
    (value) =>
      value === "*" ||
      value === wanted ||
      (value.endsWith(".*") && wanted.startsWith(value.slice(0, -1))),
  );
}

async function verifyRemoteDelegation(
  actorId: string,
  nodeId: string,
  action: string,
  allLive: any[],
) {
  const authorizations = allLive.filter(
    (candidate) =>
      candidate?.kind === "node.authorization" &&
      text(candidate?.attrs?.actorId, candidate?.attrs?.subject?.actorId) === actorId &&
      text(candidate?.attrs?.nodeId, candidate?.attrs?.actingAsNodeId) === nodeId &&
      allowedByAuthorizationDV(candidate, action),
  );
  for (const authorization of authorizations) {
    if (!(await verifyOwnedDV(authorization))) continue;
    const controllerDid = text(authorization?.meta?.ownership?.ownerDid);
    const revocations = allLive.filter(
      (candidate) =>
        candidate?.kind === "node.authorization.revoked" &&
        text(
          candidate?.attrs?.authorizationId,
          candidate?.attrs?.revokes,
          candidate?.meta?.respondsTo,
        ) === String(authorization?.id || "") &&
        text(candidate?.meta?.ownership?.ownerDid) === controllerDid,
    );
    let revoked = false;
    for (const revocation of revocations) {
      if (await verifyOwnedDV(revocation)) {
        revoked = true;
        break;
      }
    }
    if (revoked) continue;
    const manifest = allLive.find(
      (candidate) =>
        /node\.manifest$/i.test(String(candidate?.kind || "")) &&
        text(candidate?.attrs?.nodeId, candidate?.attrs?.node?.id) === nodeId &&
        text(candidate?.meta?.ownership?.ownerDid) === controllerDid,
    );
    if (manifest && (await verifyOwnedDV(manifest))) return true;
  }
  return false;
}

async function verifyRemoteController(
  ownerDid: string,
  nodeId: string,
  allLive: any[],
) {
  const manifests = allLive.filter(
    (candidate) =>
      /node\.manifest$/i.test(String(candidate?.kind || "")) &&
      text(candidate?.attrs?.nodeId, candidate?.attrs?.node?.id) === nodeId &&
      text(candidate?.meta?.ownership?.ownerDid) === ownerDid,
  );
  for (const manifest of manifests) {
    if (await verifyOwnedDV(manifest)) return true;
  }
  return false;
}

export async function verifyAuthorizedDV(
  dv: any,
  allLive: any[] = [],
): Promise<AuthorizedVerification> {
  const sensitivity = (dv?.meta?.sensitivity || sensitivityForDV(dv)) as IdentitySensitivity;
  const authority = text(dv?.meta?.authority, dv?.attrs?.authority) || null;
  const actorId = text(
    dv?.meta?.issuer,
    dv?.attrs?.issuerActorId,
    dv?.attrs?.actor?.id,
    dv?.attrs?.actorId,
  ) || null;
  const actingAsNodeId = text(dv?.attrs?.actingAsNodeId) || null;
  const hasProof = Boolean(dv?.meta?.ownership?.signature?.value);

  if (!hasProof) {
    const publicLegacy =
      sensitivity === "ephemeral" &&
      (dv?.meta?.scopes || ["public"]).includes("public");
    return {
      accepted: publicLegacy,
      proof: publicLegacy ? "legacy" : "unverified",
      reason: publicLegacy
        ? "Dato público histórico; visible sin autoridad operativa."
        : "La acción requiere una prueba verificable.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  const portableNodeProof =
    /^ed25519$/i.test(text(dv?.meta?.ownership?.signature?.alg)) &&
    text(dv?.meta?.ownership?.protocol) === "utopy.node.signature/1";
  if (portableNodeProof) {
    if (!(await verifyPortableNodeDV(dv))) {
      return {
        accepted: false,
        proof: "invalid",
        reason: "La firma portable o la identidad pÃºblica del nodo no son vÃ¡lidas.",
        authority,
        actorId,
        actingAsNodeId,
      };
    }
    if (!latestVersionIsCurrent(dv, allLive)) {
      return {
        accepted: false,
        proof: "invalid",
        reason: "Existe una versiÃ³n posterior de esta acciÃ³n.",
        authority,
        actorId,
        actingAsNodeId,
      };
    }
    return {
      accepted: true,
      proof: "verified",
      reason: "Firma portable Ed25519 e identidad canÃ³nica del nodo comprobables.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  if (!(await verifyOwnedDV(dv))) {
    return {
      accepted: false,
      proof: "invalid",
      reason: "La firma o el dispositivo emisor no son válidos.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  const proofOwnerDid = text(dv?.meta?.ownership?.ownerDid);
  const expectedActorId = proofOwnerDid
    ? await deriveActorIdForOwnerDid(proofOwnerDid)
    : "";
  if (actorId && expectedActorId && actorId !== expectedActorId) {
    const readableLegacy = sensitivity === "ephemeral";
    return {
      accepted: readableLegacy,
      proof: readableLegacy ? "legacy" : "invalid",
      reason: readableLegacy
        ? "Firma histórica legible, sin autoridad operativa sobre el actor declarado."
        : "El actor declarado no corresponde a la identidad que firmó la acción.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  if (!latestVersionIsCurrent(dv, allLive)) {
    return {
      accepted: false,
      proof: "invalid",
      reason: "Existe una versión posterior de esta acción.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  if (actingAsNodeId && authority !== actingAsNodeId) {
    return {
      accepted: false,
      proof: "invalid",
      reason: "La autoridad no coincide con el nodo representado.",
      authority,
      actorId,
      actingAsNodeId,
    };
  }
  if (actingAsNodeId && dv.kind !== "utopy.node.manifest") {
    const controlledBySigner = await verifyRemoteController(
      proofOwnerDid,
      actingAsNodeId,
      allLive,
    );
    if (
      !controlledBySigner &&
      (!actorId ||
        !(await verifyRemoteDelegation(actorId, actingAsNodeId, dv.kind, allLive)))
    ) {
      return {
        accepted: false,
        proof: "invalid",
        reason: "La delegación del actor no está vigente.",
        authority,
        actorId,
        actingAsNodeId,
      };
    }
  }
  return {
    accepted: true,
    proof: "verified",
    reason: "Firma, dispositivo y autoridad comprobables.",
    authority,
    actorId,
    actingAsNodeId,
  };
}
