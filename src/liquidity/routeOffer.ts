import { publishAuthorizedDV, verifyAuthorizedDV } from "../utopy/authorizedPublish";

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

export function buildLiquidityRouteOfferDV(input: {
  providerNodeId: string;
  providerNodeName?: string | null;
  routeId?: string | null;
  kind: string;
  label: string;
  description?: string | null;
  currency: string;
  territory?: string | string[] | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  fee?: number | null;
  etaSeconds?: number | null;
  validUntil?: string | null;
  publicDetails?: Record<string, unknown>;
}) {
  const routeId = text(input.routeId) || `route:${input.providerNodeId}:${Date.now()}`;
  const ts = new Date().toISOString();
  return {
    id: `liq.route.offer:${routeId}`,
    kind: "liq.route.offer",
    attrs: {
      routeId,
      providerId: input.providerNodeId,
      nodeId: input.providerNodeId,
      providerName: input.providerNodeName || input.providerNodeId,
      kind: input.kind,
      label: input.label,
      description: input.description || null,
      currency: text(input.currency).toUpperCase(),
      territory: input.territory || null,
      minAmount: Math.max(0, Number(input.minAmount || 0)),
      maxAmount: Math.max(0, Number(input.maxAmount || 0)) || null,
      fee: Math.max(0, Number(input.fee || 0)),
      etaSeconds: input.etaSeconds == null ? null : Math.max(0, Number(input.etaSeconds)),
      requiresExternalSettlement: true,
      requiresMerchantConfirmation: true,
      custody: "none",
      public: input.publicDetails || {},
      validUntil: input.validUntil || null,
      state: "offered",
    },
    traits: ["utopy:liquidity", "liq:route:offer", "custody:none"],
    meta: {
      ns: "mt:liquidity",
      ts,
      updatedAt: ts,
      version: 1,
      scopes: ["public"],
      authority: input.providerNodeId,
      originNode: input.providerNodeId,
      schema: "utopy.liq.route.offer@1",
    },
  };
}

export async function publishLiquidityRouteOffer(input: {
  dv: any;
  nodeId: string;
  activeActor?: any;
  allLive: any[];
}) {
  const manifest = input.allLive.find((candidate) => {
    if (!/node\.manifest$/i.test(text(candidate?.kind))) return false;
    const nodeId = text(candidate?.attrs?.nodeId || candidate?.attrs?.node?.id);
    const capabilities = (candidate?.attrs?.capabilities || []).flatMap((capability: any) =>
      typeof capability === "string" ? [capability] : [capability?.id, ...(capability?.produces || [])],
    ).map(text);
    return nodeId === input.nodeId && capabilities.some((capability: string) =>
      ["liq.route.offer", "liquidity.route.offer", "payment.route.offer"].includes(capability),
    );
  });
  const proof = manifest ? await verifyAuthorizedDV(manifest, input.allLive) : null;
  if (!proof?.accepted || proof.proof !== "verified") {
    throw new Error("El nodo no publicó una capability de rutas firmada.");
  }
  return publishAuthorizedDV({
    dv: input.dv,
    allLive: input.allLive,
    activeActor: input.activeActor,
    actingAsNodeId: input.nodeId,
    requiredAuthority: input.nodeId,
    action: "liq.route.offer",
    sensitivity: "ephemeral",
  });
}
