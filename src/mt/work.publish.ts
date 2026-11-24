// src/mt/work.publish.ts
// Publicación única firmada sobre el liveStore y transporte existentes.

import { publishAuthorizedDV } from "../utopy/authorizedPublish";

export async function publishWorkDV(
  dv: any,
  options: {
    allLive?: any[];
    activeActor?: any | null;
    actingAsNodeId?: string | null;
    targetNodeId?: string | null;
  } = {},
) {
  if (!dv?.id || !dv?.kind) {
    throw new Error("El trabajo necesita id y kind antes de publicarse.");
  }

  const now = new Date().toISOString();
  const finalDV = {
    ...dv,
    meta: {
      ...(dv.meta || {}),
      ns: dv?.meta?.ns || "mt:market",
      ts: dv?.meta?.ts || now,
      updatedAt: now,
      scopes:
        Array.isArray(dv?.meta?.scopes) && dv.meta.scopes.length
          ? dv.meta.scopes
          : ["participants"],
      source: dv?.meta?.source || "ms.market.work.publish",
    },
  };

  const result = await publishAuthorizedDV({
    dv: finalDV,
    allLive: options.allLive,
    activeActor: options.activeActor,
    actingAsNodeId: options.actingAsNodeId,
    targetNodeId: options.targetNodeId,
    sensitivity:
      dv?.kind === "work.outcome" || dv?.kind === "work.quote.accepted"
        ? "sensitive"
        : "relationship",
  });

  return result.dv;
}
