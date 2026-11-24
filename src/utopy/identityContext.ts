import {
  getWalletStatus,
  verifyOwnedDV,
  type WalletStatus,
} from "./ownership";

export type IdentitySensitivity = "ephemeral" | "relationship" | "sensitive";

export type IdentityAuthorization = {
  id: string;
  actorId: string;
  nodeId: string;
  roles: string[];
  allowedActions: string[];
  capabilities: string[];
  scopes: string[];
  validFrom: string | null;
  validUntil: string | null;
  status: "active" | "revoked" | "expired" | "legacy" | "unverified";
  verified: boolean;
  legacy: boolean;
  dv: any;
};

export type CurrentIdentityContext = {
  identityPersistence: "device" | "ephemeral";
  ownerDid: string;
  actorId: string;
  displayName: string;
  deviceId: string;
  cajeroId: string | null;
  sessionId: string;
  nodeId: string | null;
  actingAsNodeId: string | null;
  authority: string;
  authorizations: IdentityAuthorization[];
  capabilities: string[];
  territory: string | null;
  scopes: string[];
  wallet: WalletStatus;
};

export type ResolveIdentityInput = {
  allLive?: any[];
  activeActor?: any | null;
  actingAsNodeId?: string | null;
  action?: string | null;
  contextKey?: string | null;
};

const LOCAL_ACTOR_IDS = new Set([
  "actor:local",
  "buyer:local",
  "buyer:guest",
  "buyer:anon",
  "buyer:anon:boot",
  "local-node",
]);

function text(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function strings(values: any[]): string[] {
  return Array.from(
    new Set(values.flat(4).map((value) => text(value)).filter(Boolean)),
  );
}

function timestamp(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPlaceholderActor(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    LOCAL_ACTOR_IDS.has(normalized) ||
    normalized.startsWith("buyer:anon:") ||
    normalized.startsWith("actor:demo") ||
    normalized.startsWith("buyer:demo")
  );
}

function fallbackHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

async function privateActorId(ownerDid: string, contextKey: string) {
  const material = `${ownerDid}|utopy.actor|${contextKey || "personal"}`;
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(material),
    );
    const short = Array.from(new Uint8Array(digest).slice(0, 12))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `actor:utopy:${short}`;
  } catch {
    return `actor:utopy:${fallbackHash(material)}`;
  }
}

export async function deriveActorIdForOwnerDid(
  ownerDid: string,
  contextKey = "personal",
) {
  if (!ownerDid) throw new Error("No se puede derivar un actor sin ownerDid.");
  return privateActorId(ownerDid, contextKey);
}

function sessionIdentity(): string {
  const key = "utopy.identity.session.v1";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `session:${
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}:${Math.random().toString(36).slice(2)}`
    }`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `session:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }
}

function rawActorId(activeActor: any) {
  return text(
    activeActor?.actorId,
    activeActor?.attrs?.actorId,
    activeActor?.meta?.actorId,
    activeActor?.actor?.id,
    activeActor?.id,
  );
}

function rawNodeId(activeActor: any, allLive: any[]) {
  const direct = text(
    activeActor?.nodeId,
    activeActor?.attrs?.nodeId,
    activeActor?.meta?.nodeId,
    activeActor?.meta?.originNode,
    activeActor?.node?.id,
  );
  if (direct) return direct;

  const cajeroId = text(activeActor?.cajeroId, activeActor?.id);
  if (!cajeroId) return "";
  const source = allLive.find((dv) => String(dv?.id || "") === cajeroId);
  return text(
    source?.attrs?.nodeId,
    source?.attrs?.node?.id,
    source?.meta?.nodeId,
    source?.meta?.originNode,
  );
}

function actionMatches(granted: string, requested: string) {
  const grant = granted.trim().toLowerCase();
  const action = requested.trim().toLowerCase();
  if (!grant || !action) return false;
  if (grant === "*" || grant === action) return true;
  return grant.endsWith(".*") && action.startsWith(grant.slice(0, -1));
}

async function isAuthorizationRevoked(
  authorizationId: string,
  controllerDid: string,
  allLive: any[],
) {
  const candidates = allLive.filter(
    (dv) =>
      String(dv?.kind || "") === "node.authorization.revoked" &&
      text(dv?.attrs?.authorizationId, dv?.attrs?.revokes, dv?.meta?.respondsTo) ===
        authorizationId,
  );
  for (const candidate of candidates) {
    if (text(candidate?.meta?.ownership?.ownerDid) !== controllerDid) continue;
    if (await verifyOwnedDV(candidate)) return true;
  }
  return false;
}

async function authorizationFromDV(
  dv: any,
  allLive: any[],
): Promise<IdentityAuthorization[]> {
  const kind = String(dv?.kind || "").toLowerCase();
  if (kind === "node.authorization") {
    const attrs = dv?.attrs || {};
    const actorId = text(attrs.actorId, attrs.subject?.actorId);
    const nodeId = text(attrs.nodeId, attrs.actingAsNodeId, dv?.meta?.authority);
    if (!actorId || !nodeId) return [];
    const signatureVerified = await verifyOwnedDV(dv);
    const controllerDid = text(dv?.meta?.ownership?.ownerDid);
    const controllerManifests = allLive.filter(
      (candidate) =>
        /node\.manifest$/i.test(String(candidate?.kind || "")) &&
        text(candidate?.attrs?.nodeId, candidate?.attrs?.node?.id) === nodeId &&
        text(candidate?.meta?.ownership?.ownerDid) === controllerDid,
    );
    const controllerVerified = controllerManifests.length
      ? await verifyOwnedDV(controllerManifests[0])
      : false;
    const verified = signatureVerified && controllerVerified;
    const validUntil = text(attrs.validUntil) || null;
    const expired = Boolean(validUntil && timestamp(validUntil) <= Date.now());
    const authorizationId = String(dv.id || attrs.authorizationId || "");
    const isRevoked = await isAuthorizationRevoked(
      authorizationId,
      controllerDid,
      allLive,
    );
    return [
      {
        id: authorizationId,
        actorId,
        nodeId,
        roles: strings([attrs.roles || []]),
        allowedActions: strings([
          attrs.allowedActions || attrs.actions || attrs.capabilities || [],
        ]),
        capabilities: strings([attrs.capabilities || []]),
        scopes: strings([attrs.scopes || dv?.meta?.scopes || []]),
        validFrom: text(attrs.validFrom) || null,
        validUntil,
        status: isRevoked
          ? "revoked"
          : expired
            ? "expired"
            : verified
              ? "active"
              : "unverified",
        verified,
        legacy: false,
        dv,
      },
    ];
  }

  if (kind === "mt:cajero.auth") {
    const attrs = dv?.attrs || {};
    return (Array.isArray(attrs.grants) ? attrs.grants : [])
      .map((grant: any) => {
        const actorId = text(grant?.actorId);
        const nodeId = text(
          attrs.nodeId,
          attrs.orgId,
          dv?.meta?.originNode,
          dv?.meta?.authority,
        );
        if (!actorId || !nodeId) return null;
        return {
          id: `${String(dv.id || "legacy")}:${actorId}`,
          actorId,
          nodeId,
          roles: strings([grant?.roles || []]),
          allowedActions: strings([grant?.allowedActions || grant?.roles || []]),
          capabilities: [],
          scopes: strings([attrs.scope || dv?.meta?.scopes || []]),
          validFrom: null,
          validUntil: null,
          status: "legacy" as const,
          verified: false,
          legacy: true,
          dv,
        };
      })
      .filter(Boolean) as IdentityAuthorization[];
  }

  return [];
}

async function collectAuthorizations(allLive: any[]) {
  const candidates = allLive.filter((dv) =>
    ["node.authorization", "mt:cajero.auth"].includes(
      String(dv?.kind || "").toLowerCase(),
    ),
  );
  return (await Promise.all(candidates.map((dv) => authorizationFromDV(dv, allLive))))
    .flat()
    .sort((a, b) => timestamp(b.dv?.meta?.ts) - timestamp(a.dv?.meta?.ts));
}

async function controlsNode(
  nodeId: string,
  ownerDid: string,
  allLive: any[],
) {
  const manifests = allLive
    .filter((dv) => {
      if (!/node\.manifest$/i.test(String(dv?.kind || ""))) return false;
      return (
        text(dv?.attrs?.nodeId, dv?.attrs?.node?.id) === nodeId &&
        dv?.meta?.ownership?.ownerDid === ownerDid
      );
    })
    .sort((a, b) => timestamp(b?.meta?.updatedAt || b?.meta?.ts) - timestamp(a?.meta?.updatedAt || a?.meta?.ts));
  return manifests[0] ? verifyOwnedDV(manifests[0]) : false;
}

export function authorizationAllows(
  authorization: IdentityAuthorization,
  action?: string | null,
) {
  if (!authorization.verified || authorization.status !== "active") return false;
  if (!action) return true;
  return authorization.allowedActions.some((allowed) =>
    actionMatches(allowed, action),
  );
}

export async function resolveCurrentIdentityContext(
  input: ResolveIdentityInput = {},
): Promise<CurrentIdentityContext> {
  const allLive = Array.isArray(input.allLive) ? input.allLive : [];
  const wallet = await getWalletStatus();
  const candidateActorId = rawActorId(input.activeActor);
  const derivedActorId = await privateActorId(
    wallet.ownerDid,
    "personal",
  );
  // El cajero o un objeto de UI puede sugerir un actor, pero no puede cambiar
  // la identidad controlada por la clave del dispositivo. Las identidades
  // heredadas quedan como alias de presentación, nunca como autoridad.
  const actorId =
    !isPlaceholderActor(candidateActorId) && candidateActorId === derivedActorId
      ? candidateActorId
      : derivedActorId;
  const displayName = text(
    input.activeActor?.displayName,
    input.activeActor?.nombre,
    input.activeActor?.name,
    input.activeActor?.actorName,
    "Vos",
  );
  const nodeId = rawNodeId(input.activeActor, allLive) || null;
  const requestedNodeId = text(input.actingAsNodeId) || null;
  const authorizations = await collectAuthorizations(allLive);
  const relevant = requestedNodeId
    ? authorizations.find(
        (authorization) =>
          authorization.actorId === actorId &&
          authorization.nodeId === requestedNodeId &&
          authorizationAllows(authorization, input.action),
      )
    : null;
  const isController = requestedNodeId
    ? await controlsNode(requestedNodeId, wallet.ownerDid, allLive)
    : false;
  const actingAsNodeId = relevant || isController ? requestedNodeId : null;

  const identityValues = new Set(
    [actorId, nodeId, actingAsNodeId].filter(Boolean).map(String),
  );
  const related = allLive.filter((dv) =>
    [
      dv?.attrs?.actorId,
      dv?.attrs?.nodeId,
      dv?.attrs?.node?.id,
      dv?.meta?.originNode,
    ].some((value) => identityValues.has(String(value || ""))),
  );
  const capabilities = strings(
    related.flatMap((dv) => [
      dv?.attrs?.capabilities || [],
      dv?.attrs?.capabilityLabels || [],
      dv?.attrs?.provides || [],
    ]),
  );

  return {
    identityPersistence: wallet.custody === "device" ? "device" : "ephemeral",
    ownerDid: wallet.ownerDid,
    actorId,
    displayName,
    deviceId: wallet.deviceId,
    cajeroId:
      text(input.activeActor?.cajeroId) ||
      (/^mt:cajero:/i.test(text(input.activeActor?.id))
        ? text(input.activeActor?.id)
        : null),
    sessionId: sessionIdentity(),
    nodeId,
    actingAsNodeId,
    authority: actingAsNodeId || actorId,
    authorizations: authorizations.filter(
      (authorization) => authorization.actorId === actorId,
    ),
    capabilities,
    territory:
      text(
        input.activeActor?.territoryId,
        input.activeActor?.territorioId,
        input.activeActor?.attrs?.territoryId,
      ) || null,
    scopes: strings(
      related.flatMap((dv) => dv?.meta?.scopes || dv?.attrs?.scopes || []),
    ),
    wallet,
  };
}

export function buildNodeAuthorizationDV(input: {
  actorId: string;
  nodeId: string;
  roles?: string[];
  allowedActions: string[];
  capabilities?: string[];
  scopes?: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  issuedByActorId?: string | null;
}) {
  const ts = new Date().toISOString();
  const authorizationId = `node.authorization:${input.nodeId}:${input.actorId}:${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now()
  }`;
  return {
    id: authorizationId,
    kind: "node.authorization",
    attrs: {
      authorizationId,
      actorId: input.actorId,
      nodeId: input.nodeId,
      actingAsNodeId: input.nodeId,
      roles: strings([input.roles || []]),
      allowedActions: strings([input.allowedActions]),
      capabilities: strings([input.capabilities || []]),
      scopes: strings([input.scopes || ["participants"]]),
      status: "active",
      validFrom: input.validFrom || ts,
      validUntil: input.validUntil || null,
      issuedByActorId: input.issuedByActorId || null,
      consent: {
        node: true,
        actor: false,
        exercisedBySignedAction: true,
        automaticExpansion: false,
      },
    },
    traits: ["utopy:identity", "node:authorization", "consent:confirmed"],
    meta: {
      ns: "utopy:identity",
      ts,
      updatedAt: ts,
      version: 1,
      scopes: ["participants"],
      authority: input.nodeId,
      originNode: input.nodeId,
      schema: "utopy.node.authorization@1",
    },
  };
}

export function buildNodeAuthorizationRevokedDV(input: {
  authorizationId: string;
  actorId: string;
  nodeId: string;
  reason?: string | null;
}) {
  const ts = new Date().toISOString();
  return {
    id: `node.authorization.revoked:${input.authorizationId}:${Date.now()}`,
    kind: "node.authorization.revoked",
    attrs: {
      authorizationId: input.authorizationId,
      actorId: input.actorId,
      nodeId: input.nodeId,
      status: "revoked",
      reason: input.reason || null,
      revokedAt: ts,
    },
    traits: ["utopy:identity", "node:authorization:revoked"],
    meta: {
      ns: "utopy:identity",
      ts,
      updatedAt: ts,
      version: 1,
      scopes: ["participants"],
      authority: input.nodeId,
      originNode: input.nodeId,
      respondsTo: input.authorizationId,
      schema: "utopy.node.authorization.revoked@1",
    },
  };
}
