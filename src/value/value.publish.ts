import { publishAuthorizedDV } from "../utopy/authorizedPublish";

type ValuePublishOptions = {
  allLive?: any[];
  activeActor?: any | null;
  actingAsNodeId?: string | null;
  targetNodeId?: string | null;
};

export async function publishValueDV(dv: any, options: ValuePublishOptions = {}) {
  const result = await publishAuthorizedDV({
    dv,
    allLive: options.allLive,
    activeActor: options.activeActor,
    actingAsNodeId: options.actingAsNodeId,
    targetNodeId: options.targetNodeId,
    sensitivity:
      dv?.kind === "value.contribution.verified" ? "sensitive" : "relationship",
  });
  return result.dv;
}

export async function publishValueDVs(dvs: any[], options: ValuePublishOptions = {}) {
  const published: any[] = [];
  for (const dv of Array.isArray(dvs) ? dvs : []) {
    published.push(await publishValueDV(dv, options));
  }
  return published;
}
