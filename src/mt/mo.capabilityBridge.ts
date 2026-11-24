import type { LivingNodeProjection } from "../utopy/livingNodeProjection";
import { mtLiveUpsertIfChanged } from "./mt.liveStore";

export function openMOWithLivingNode(node: LivingNodeProjection, returnTo: string) {
  const ts = new Date().toISOString();
  const context = {
    id: `mo.create.context:${node.id}:${Date.now()}`,
    kind: "mo.create.context",
    attrs: {
      nodeId: node.nodeId || node.id,
      actorId: node.actorId || null,
      capabilityContext: node.capabilities.map((capability) => ({ id: capability.id, label: capability.label, verbs: capability.verbs, resources: capability.resources })),
      territory: node.territory || null,
      candidateOnly: true,
      returnTo,
    },
    traits: ["mo:create", "capability:context", "candidate:not-bound"],
    meta: { ns: "mo", scopes: ["public"], ts, updatedAt: ts, originNode: node.nodeId || undefined },
  };
  mtLiveUpsertIfChanged(context as any);
  const detail = { ns: "mt", say: "action.run", payload: { kind: "action.run", action: "mo.create.with.capability", input: { contextDvId: context.id, nodeId: context.attrs.nodeId, capabilities: context.attrs.capabilityContext, candidateOnly: true, returnTo } } };
  window.dispatchEvent(new CustomEvent("utopy.emit", { detail }));
  window.dispatchEvent(new CustomEvent("utopy:mo:open", { detail: detail.payload }));
  return context;
}
