import { publishAuthorizedDV } from "../utopy/authorizedPublish";

type PublishOptions = {
  allLive?: any[];
  activeActor?: any | null;
  targetNodeId?: string | null;
};

export async function publishLiveNetworkDV(dv: any, options: PublishOptions = {}) {
  const result = await publishAuthorizedDV({
    dv,
    allLive: options.allLive,
    activeActor: options.activeActor,
    action: dv?.kind,
    actingAsNodeId: options.activeActor?.nodeId || null,
    targetNodeId: options.targetNodeId || dv?.attrs?.targetNodeId || null,
  });
  return result.dv;
}

export async function publishLiveNetworkMany(dvs: any[], options: PublishOptions = {}) {
  const published: any[] = [];
  for (const dv of dvs) {
    published.push(await publishLiveNetworkDV(dv, options));
  }
  return published;
}
