import {
  publishAuthorizedDV,
  type AuthorizedPublishResult,
} from "../utopy/authorizedPublish";

export type VaultPublishOptions = {
  allLive?: any[];
  activeActor?: any | null;
  targetNodeId?: string | null;
  actingAsNodeId?: string | null;
  localOnly?: boolean;
};

const NODE_ISSUED_KINDS = new Set([
  "benefit.program",
  "benefit.acceptance",
  "value.stamp",
  "value.right",
  "value.redemption.outcome",
]);

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function issuerNodeFor(dv: any) {
  if (!NODE_ISSUED_KINDS.has(String(dv?.kind || ""))) return "";
  return text(
    dv?.attrs?.acceptingNodeId ||
      dv?.attrs?.issuerNodeId ||
      dv?.attrs?.nodeId ||
      dv?.meta?.authority ||
      dv?.meta?.originNode,
  );
}

export function publishVaultDV(
  dv: any,
  options: VaultPublishOptions = {},
): Promise<AuthorizedPublishResult> {
  const issuerNodeId = text(options.actingAsNodeId) || issuerNodeFor(dv);
  return publishAuthorizedDV({
    dv,
    allLive: options.allLive,
    activeActor: options.activeActor,
    targetNodeId: text(options.targetNodeId || dv?.meta?.targetNodeId) || null,
    actingAsNodeId: issuerNodeId || null,
    requiredAuthority: issuerNodeId || null,
    sensitivity: dv?.kind === "benefit.program" || dv?.kind === "benefit.acceptance"
      ? "relationship"
      : "sensitive",
    localOnly: options.localOnly,
  });
}

export async function publishVaultDVs(
  dvs: any[],
  options: VaultPublishOptions = {},
) {
  const published: any[] = [];
  for (const dv of Array.isArray(dvs) ? dvs : []) {
    published.push((await publishVaultDV(dv, options)).dv);
  }
  return published;
}
