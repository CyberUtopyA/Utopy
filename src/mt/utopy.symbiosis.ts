// src/mt/utopy.symbiosis.ts
// Lenguaje universal UTOPY:
// dato -> propósito -> capacidad -> reacción -> resultado.
// No conoce nombres de comercios. Lee contratos declarados por cada nodo.

import type {
  DVLike,
  ResonanceCapability,
} from "../utopy/presence/resonance.types";

export type PurposeState =
  | "requested"
  | "offered"
  | "achieved"
  | "failed"
  | "observed";

export type UtopyPurpose = {
  id: string;
  name: string;
  state: PurposeState;
  domains: string[];
  verbs: string[];
  resources: string[];
  subjectId?: string;
  objectId?: string;
  orderId?: string;
  productId?: string;
  status?: string;
};

export type UtopyReactionContract = {
  kind?: string;
  action?: string;
  protocol?: string;
  endpoint?: string;
  requiresConsent?: boolean;
  automatic?: boolean;
};

export type UtopyCapabilityContract = ResonanceCapability & {
  id: string;
  nodeId: string;
  nodeName: string;
  accepts: string[];
  produces: string[];
  surfaces: string[];
  reaction?: UtopyReactionContract;
  sourceDV: DVLike;
};

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

export function normalizeSemantic(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.*:_-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function unique(values: unknown[], max = 48): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(normalizeSemantic)
        .filter(Boolean),
    ),
  ).slice(0, max);
}

function traitsOf(dv: DVLike): string[] {
  return Array.isArray(dv?.traits) ? dv.traits.map(normalizeSemantic) : [];
}

export function nodeIdentityOf(dv: DVLike): string {
  const attrs = dv?.attrs || {};
  return text(
    attrs.node?.id ||
      attrs.nodeId ||
      attrs.actor?.nodeId ||
      attrs.actor?.id ||
      attrs.sellerId ||
      attrs.storeId ||
      attrs.orgId ||
      attrs.productor?.id ||
      dv?.meta?.originNode ||
      dv?.meta?.by ||
      dv?.meta?.authority,
  );
}

export function nodeNameOf(dv: DVLike): string {
  const attrs = dv?.attrs || {};
  return text(
    attrs.node?.name ||
      attrs.nodeName ||
      attrs.actor?.name ||
      attrs.sellerName ||
      attrs.storeName ||
      attrs.orgName ||
      attrs.productor?.nombre ||
      dv?.labels?.[0] ||
      nodeIdentityOf(dv) ||
      "Nodo capaz",
  );
}

function positiveStatus(value: unknown): boolean {
  const status = normalizeSemantic(value);
  return [
    "ok",
    "confirmed",
    "completed",
    "complete",
    "paid",
    "settled",
    "delivered",
    "fulfilled",
    "success",
    "successful",
    "approved",
    "accepted",
    "ready",
    "done",
  ].some((token) => status === token || status.endsWith(`.${token}`));
}

function negativeStatus(value: unknown): boolean {
  const status = normalizeSemantic(value);
  return [
    "failed",
    "rejected",
    "cancelled",
    "canceled",
    "expired",
    "disputed",
    "error",
  ].some((token) => status === token || status.endsWith(`.${token}`));
}

function inferPurposeState(dv: DVLike): PurposeState {
  const attrs = dv?.attrs || {};
  const explicit = normalizeSemantic(
    attrs.purpose?.state || attrs.outcome?.state || attrs.state,
  );
  if (
    ["requested", "offered", "achieved", "failed", "observed"].includes(
      explicit,
    )
  ) {
    return explicit as PurposeState;
  }

  const status = attrs.status || attrs.outcome?.status || attrs.paymentStatus;
  if (positiveStatus(status)) return "achieved";
  if (negativeStatus(status)) return "failed";

  const kind = normalizeSemantic(dv?.kind);
  const mode = normalizeSemantic(attrs.intent?.mode);
  if (
    mode === "need" ||
    mode === "discover" ||
    mode === "produce" ||
    mode === "collaborate" ||
    /(^|.)(intent|request|need|demand)(.|$)/.test(kind)
  ) {
    return "requested";
  }
  if (
    mode === "offer" ||
    /(^|.)(offer|product|producto|catalog|availability)(.|$)/.test(kind)
  ) {
    return "offered";
  }
  if (/(^|.)(outcome|completed|confirmed|paid|delivered)(.|$)/.test(kind)) {
    return "achieved";
  }
  if (/(^|.)(failed|rejected|cancelled|expired)(.|$)/.test(kind)) {
    return "failed";
  }
  return "observed";
}

function purposeNameFromKind(kind: string, state: PurposeState): string {
  const normalized = normalizeSemantic(kind || "dato");
  if (state === "requested") {
    return normalized
      .replace(/(^|.)(intent|request|need|demand)(.|$)/g, ".")
      .replace(/^\.|\.$/g, "") || "purpose.requested";
  }
  if (state === "offered") {
    return normalized
      .replace(/(^|.)(offer|catalog)(.|$)/g, ".")
      .replace(/^\.|\.$/g, "") || "purpose.offered";
  }
  return normalized || "purpose.observed";
}

export function readPurpose(dv: DVLike): UtopyPurpose | null {
  if (!dv?.id || !dv?.kind) return null;
  const attrs = dv.attrs || {};
  const explicit = attrs.purpose;
  const state = inferPurposeState(dv);
  const explicitName =
    typeof explicit === "string"
      ? explicit
      : explicit?.name || explicit?.type || explicit?.goal || explicit?.id;
  const name = normalizeSemantic(
    explicitName ||
      attrs.intent?.purpose ||
      attrs.outcome?.purpose ||
      purposeNameFromKind(dv.kind, state),
  );

  const domains = unique([
    explicit?.domains,
    attrs.intent?.domains,
    attrs.domain,
    attrs.category,
    attrs.categoria,
    attrs.service,
    attrs.role,
    traitsOf(dv).filter((trait) =>
      /domain|cat|food|commerce|payment|loyalty|trust|delivery|inventory|work/.test(
        trait,
      ),
    ),
    normalizeSemantic(dv.kind).split(".").slice(0, -1),
  ]);

  const verbs = unique([
    explicit?.verbs,
    attrs.intent?.verbs,
    attrs.action?.type,
    attrs.action,
    attrs.operation,
    state === "requested" ? ["request", "discover"] : [],
    state === "offered" ? ["offer", "supply"] : [],
    state === "achieved" ? ["complete", "confirm"] : [],
  ]);

  const resources = unique([
    explicit?.resources,
    attrs.intent?.resources,
    attrs.productId,
    attrs.productoId,
    attrs.materialKey,
    attrs.materialName,
    attrs.productName,
    attrs.productoNombre,
    attrs.title,
    attrs.name,
    attrs.nombre,
    dv.labels,
  ]);

  return {
    id: text(explicit?.id || `purpose:${dv.id}`),
    name: name || "purpose.observed",
    state,
    domains,
    verbs,
    resources,
    subjectId: text(
      explicit?.subjectId || attrs.buyerId || attrs.customerId || attrs.actorId,
    ) || undefined,
    objectId: text(
      explicit?.objectId || attrs.sellerId || attrs.storeId || attrs.nodeId,
    ) || undefined,
    orderId: text(attrs.orderId || attrs.externalOrderId) || undefined,
    productId: text(attrs.productId || attrs.productoId) || undefined,
    status: text(attrs.status || attrs.outcome?.status || attrs.paymentStatus) ||
      undefined,
  };
}

function normalizeReaction(value: any): UtopyReactionContract | undefined {
  if (!value || typeof value !== "object") return undefined;
  return {
    kind: text(value.kind) || undefined,
    action: text(value.action || value.type) || undefined,
    protocol: text(value.protocol) || undefined,
    endpoint: text(value.endpoint || value.url) || undefined,
    requiresConsent: value.requiresConsent !== false,
    automatic: value.automatic === true,
  };
}

function normalizeCapability(
  raw: any,
  sourceDV: DVLike,
  index: number,
): UtopyCapabilityContract | null {
  if (!raw) return null;
  const value = typeof raw === "string" ? { id: raw, produces: [raw] } : raw;
  if (!value || typeof value !== "object") return null;

  const nodeId = text(value.nodeId || nodeIdentityOf(sourceDV));
  const nodeName = text(value.nodeName || nodeNameOf(sourceDV));
  const id = text(value.id || value.name || `capability:${sourceDV.id}:${index}`);
  const domains = unique([
    value.domains,
    value.domain,
    sourceDV.attrs?.domain,
    sourceDV.attrs?.category,
  ]);
  const verbs = unique([value.verbs, value.actions, value.action]);
  const resources = unique([value.resources, value.resource]);
  const accepts = unique([
    value.accepts,
    value.observes,
    value.respondsTo,
    value.inputs,
  ]);
  const produces = unique([
    value.produces,
    value.outputs,
    value.result,
    typeof raw === "string" ? raw : null,
  ]);
  const surfaces = unique([
    value.surfaces,
    value.surface,
    sourceDV.attrs?.surfaces,
    sourceDV.meta?.surfaces,
  ]);

  if (!id || (!domains.length && !accepts.length && !produces.length)) {
    return null;
  }

  return {
    id,
    nodeId,
    nodeName,
    domains: domains.length ? domains : ["utopy.general"],
    verbs,
    resources,
    accepts,
    produces,
    surfaces,
    quantities: Array.isArray(value.quantities) ? value.quantities : undefined,
    availability: value.availability,
    serviceRadiusKm: Number.isFinite(Number(value.serviceRadiusKm))
      ? Number(value.serviceRadiusKm)
      : undefined,
    constraints:
      value.constraints && typeof value.constraints === "object"
        ? value.constraints
        : undefined,
    reaction: normalizeReaction(value.reaction || value.execute || value.action),
    sourceDV,
  };
}

function implicitCapabilityValues(dv: DVLike): any[] {
  const attrs = dv.attrs || {};
  const kind = normalizeSemantic(dv.kind);
  const values: any[] = [];

  if (kind === "loyalty.program" || traitsOf(dv).includes("loyalty.program")) {
    values.push({
      id: `cap:loyalty:${dv.id}`,
      domains: ["loyalty", "relationship.value"],
      accepts:
        attrs.observes || attrs.accepts || [
          "commerce.purchase.completed",
          "payment.confirmed",
        ],
      produces:
        attrs.produces || ["loyalty.progress", "loyalty.reward.available"],
      surfaces: ["profile", "value"],
      reaction:
        attrs.reaction || {
          kind: "loyalty.progress.intent",
          action: "observe_outcome",
          requiresConsent: false,
        },
    });
  }

  if (kind === "payment.offer" || traitsOf(dv).includes("payment.offer")) {
    values.push({
      id: `cap:payment:${dv.id}`,
      domains: ["payment", "commerce"],
      accepts: attrs.accepts || ["payment.requested", "commerce.checkout.requested"],
      produces: attrs.produces || ["payment.session", "payment.outcome"],
      surfaces: ["market", "checkout", "pay"],
      reaction: attrs.reaction,
    });
  }

  if (
    kind === "trust.policy" ||
    kind === "trust.capability" ||
    traitsOf(dv).some((trait) => trait.startsWith("trust."))
  ) {
    values.push({
      id: `cap:trust:${dv.id}`,
      domains: ["trust", "relationship.proof"],
      accepts:
        attrs.observes || attrs.accepts || [
          "*.completed",
          "*.confirmed",
          "*.delivered",
          "*.failed",
        ],
      produces: attrs.produces || ["trust.proof"],
      surfaces: ["profile", "trust"],
      reaction:
        attrs.reaction || {
          kind: "trust.observe.intent",
          action: "observe_outcome",
          requiresConsent: false,
        },
    });
  }

  return values;
}

export function readCapabilityContracts(dv: DVLike): UtopyCapabilityContract[] {
  if (!dv?.id || !dv?.kind) return [];
  const attrs = dv.attrs || {};
  const rawValues = [
    ...(Array.isArray(attrs.capabilities) ? attrs.capabilities : []),
    ...(attrs.capability ? [attrs.capability] : []),
    ...implicitCapabilityValues(dv),
  ];

  return rawValues
    .map((value, index) => normalizeCapability(value, dv, index))
    .filter((value): value is UtopyCapabilityContract => Boolean(value));
}

function isOfferLike(dv: DVLike): boolean {
  const purpose = readPurpose(dv);
  if (!purpose || purpose.state !== "offered") return false;
  const kind = normalizeSemantic(dv.kind);
  return ![
    "capability.offer",
    "match.proposal",
    "utopy.reaction.proposal",
  ].includes(kind);
}

export function projectDVToCapabilityDV(dv: DVLike): DVLike | null {
  if (!isOfferLike(dv)) return null;

  const purpose = readPurpose(dv);
  if (!purpose) return null;
  const attrs = dv.attrs || {};
  const nodeId = nodeIdentityOf(dv) || `node:source:${dv.id}`;
  const nodeName = nodeNameOf(dv);
  const quantity = Number(
    attrs.stock ?? attrs.stockQty ?? attrs.quantity ?? attrs.cantidad,
  );
  const unit = text(attrs.unit || attrs.unidad || "u");
  const accepts = unique([
    attrs.accepts,
    purpose.name.replace(/\.offered$/, ".requested"),
    purpose.domains.map((domain) => `${domain}.requested`),
  ]);
  const produces = unique([
    attrs.produces,
    purpose.name,
    purpose.domains.map((domain) => `${domain}.outcome`),
  ]);

  const capability: ResonanceCapability & Record<string, any> = {
    id: `cap:${dv.id}`,
    domains: purpose.domains.length ? purpose.domains : ["market.offer"],
    verbs: unique([purpose.verbs, "offer", "supply"]),
    resources: purpose.resources.length
      ? purpose.resources
      : [text(attrs.title || attrs.name || dv.kind)],
    accepts,
    quantities:
      Number.isFinite(quantity) && quantity > 0
        ? [
            {
              resource: purpose.resources[0] || text(attrs.title || dv.kind),
              max: quantity,
              unit,
            },
          ]
        : undefined,
    serviceRadiusKm: Math.max(0, Number(attrs.serviceRadiusKm || 50)),
  };

  const now = Date.now();
  return {
    id: `capability.projected:${dv.id}`,
    kind: "capability.offer",
    ts: now,
    traits: [
      "sem.dv.read",
      "capability.offer",
      "resonance.capable",
      "utopy.projected",
      "consent.required",
    ],
    meta: {
      ns: "utopy:resonance",
      ts: new Date(now).toISOString(),
      updatedAt:
        dv.meta?.updatedAt || dv.attrs?.updatedAt || dv.meta?.ts || dv.ts,
      schema: "utopy.capability.projected@2",
      scopes: dv.meta?.scopes || ["local", "market"],
      by: nodeId,
      originNode: nodeId,
      authority: dv.meta?.authority || nodeId,
      ttl_ms: Math.min(
        Math.max(Number(dv.meta?.ttl_ms || 24 * 60 * 60_000), 60_000),
        7 * 24 * 60 * 60_000,
      ),
      portable: true,
      respondsTo: dv.id,
    },
    attrs: {
      node: { id: nodeId, name: nodeName },
      capabilities: [
        {
          ...capability,
          produces,
          surfaces: unique([
            attrs.surfaces,
            dv.meta?.surfaces,
            "market",
          ]),
        },
      ],
      geo: attrs.geo || attrs.location,
      purpose,
      source: {
        dvId: dv.id,
        kind: dv.kind,
        version:
          dv.meta?.updatedAt ||
          dv.attrs?.updatedAt ||
          dv.meta?.version ||
          dv.attrs?.version ||
          dv.meta?.ts ||
          dv.id,
      },
      offerRef: {
        id: dv.id,
        kind: dv.kind,
        threadId: attrs.threadId || dv.meta?.threadId,
      },
      action: {
        type: "open_offer",
        offerId: dv.id,
        threadId: attrs.threadId || dv.meta?.threadId,
      },
      security: {
        requiresConsent: true,
        automaticActions: false,
      },
    },
    labels: unique([nodeName, attrs.title, attrs.name, dv.labels], 3),
  };
}

function semanticTokens(value: string): string[] {
  return normalizeSemantic(value)
    .split(/[.:_\-]+/)
    .filter(Boolean);
}

export function purposePatternMatches(pattern: string, purpose: UtopyPurpose): boolean {
  const normalizedPattern = normalizeSemantic(pattern);
  if (!normalizedPattern) return false;

  const outcomeAliases = unique([
    purpose.name,
    purpose.name.replace(/\.outcome$/, ".completed"),
    purpose.name.replace(/\.outcome$/, ".confirmed"),
    purpose.name.replace(/\.outcome$/, ".failed"),
    purpose.domains.map((domain) => `${domain}.${purpose.state}`),
    purpose.status
      ? purpose.domains.map((domain) => `${domain}.${purpose.status}`)
      : [],
    purpose.status ? `${purpose.name}.${purpose.status}` : "",
  ]);
  const candidates = unique([
    purpose.name,
    outcomeAliases,
    purpose.domains,
    purpose.verbs,
    purpose.resources,
    purpose.status,
  ]);

  if (normalizedPattern === "*") return true;
  if (normalizedPattern.includes("*")) {
    const expression = new RegExp(
      `^${normalizedPattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    );
    return candidates.some((candidate) => expression.test(candidate));
  }

  if (candidates.includes(normalizedPattern)) return true;
  const wanted = new Set(semanticTokens(normalizedPattern));
  return candidates.some((candidate) => {
    const got = new Set(semanticTokens(candidate));
    if (!wanted.size || !got.size) return false;
    let overlap = 0;
    wanted.forEach((token) => {
      if (got.has(token)) overlap += 1;
    });
    return overlap / Math.min(wanted.size, got.size) >= 0.66;
  });
}

export function isOutcomeDV(dv: DVLike): boolean {
  const kind = normalizeSemantic(dv?.kind);
  const traits = traitsOf(dv);
  if (kind.startsWith("utopy.reaction.") || traits.includes("utopy.reaction.outcome")) {
    return false;
  }
  const purpose = readPurpose(dv);
  return Boolean(
    purpose && (purpose.state === "achieved" || purpose.state === "failed"),
  );
}

function reactionIdempotencyKey(
  outcome: DVLike,
  purpose: UtopyPurpose,
  capability: UtopyCapabilityContract,
): string {
  const attrs = outcome.attrs || {};
  const orderId = purpose.orderId || text(attrs.orderId) || outcome.id;
  const productId =
    purpose.productId || text(attrs.productId || attrs.productoId) || "all";
  return normalizeSemantic(
    `${capability.nodeId}:${capability.id}:${orderId}:${productId}:${purpose.name}`,
  );
}

export function buildOutcomeReactionProposals(
  outcome: DVLike,
  snapshot: DVLike[],
): DVLike[] {
  const purpose = readPurpose(outcome);
  if (!purpose || !isOutcomeDV(outcome)) return [];

  const existingIds = new Set(
    snapshot
      .filter((dv) => dv?.id)
      .map((dv) => text(dv.id)),
  );
  const proposals: DVLike[] = [];

  for (const capabilityDV of snapshot) {
    for (const capability of readCapabilityContracts(capabilityDV)) {
      if (!capability.accepts.length) continue;
      if (
        !capability.accepts.some((pattern) =>
          purposePatternMatches(pattern, purpose),
        )
      ) {
        continue;
      }

      const id = `utopy.reaction.proposal:${outcome.id}:${capabilityDV.id}:${capability.id}`;
      if (existingIds.has(id)) continue;
      const now = Date.now();
      const requiresConsent = capability.reaction?.requiresConsent !== false;
      const idempotencyKey = reactionIdempotencyKey(
        outcome,
        purpose,
        capability,
      );

      proposals.push({
        id,
        kind: "utopy.reaction.proposal",
        ts: now,
        traits: [
          "sem.dv.answer",
          "utopy.reaction",
          `purpose.${purpose.state}`,
          requiresConsent ? "consent.required" : "consent.predeclared",
          "execution.node-owned",
        ],
        meta: {
          ns: "utopy:resonance",
          ts: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
          schema: "utopy.reaction.proposal@1",
          scopes: ["participants"],
          ttl_ms: 24 * 60 * 60_000,
          by: "utopy.symbiosis",
          originNode: capability.nodeId,
          respondsTo: outcome.id,
          portable: true,
          idempotencyKey,
        },
        attrs: {
          status: "proposed",
          purpose,
          inputRef: { id: outcome.id, kind: outcome.kind },
          targetNode: {
            id: capability.nodeId,
            name: capability.nodeName,
          },
          capabilityRef: {
            id: capabilityDV.id,
            kind: capabilityDV.kind,
            capabilityId: capability.id,
          },
          produces: capability.produces,
          action: {
            kind:
              capability.reaction?.kind ||
              capability.produces[0] ||
              "utopy.action.intent",
            action:
              capability.reaction?.action || "react_to_compatible_purpose",
            protocol: capability.reaction?.protocol,
            endpoint: capability.reaction?.endpoint,
            idempotencyKey,
          },
          security: {
            requiresConsent,
            automaticActions: false,
            executableBy: capability.nodeId,
          },
        },
        labels: [
          `✨ ${capability.nodeName} puede reaccionar`,
          purpose.name,
        ],
      });
    }
  }

  return proposals;
}

export function capabilityNamesForSurface(
  dv: DVLike,
  surface: string,
): string[] {
  const target = normalizeSemantic(surface);
  return unique(
    readCapabilityContracts(dv)
      .filter(
        (capability) =>
          !capability.surfaces.length ||
          capability.surfaces.includes(target) ||
          capability.surfaces.includes("*"),
      )
      .flatMap((capability) => [
        capability.id,
        capability.produces,
        capability.domains,
      ]),
  );
}
