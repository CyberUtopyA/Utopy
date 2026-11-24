// src/mt/utopy.networkPublish.ts
// Publicación única y compatible para cualquier Dato Vivo.
// El store local acelera/offline; el evento utopy.emit permite que boot.ts
// lo transporte por Seed/Micelio sin acoplar este módulo a un proveedor.

import { mtLiveUpsert } from "./mt.liveStore";

export type PublishableDV = {
  id: string;
  kind: string;
  attrs?: Record<string, any>;
  traits?: string[];
  meta?: Record<string, any>;
  ts?: string | number;
  [key: string]: any;
};

export type PublishUtopyOptions = {
  transportNamespace?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  auth?: string;
  localOnly?: boolean;
};

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function buildDvUpsertEnvelope(
  dv: PublishableDV,
  options: PublishUtopyOptions = {},
) {
  const ns = text(dv?.meta?.ns || "mt:market");
  const sourceNodeId = text(
    options.sourceNodeId ||
      dv?.attrs?.node?.id ||
      dv?.attrs?.nodeId ||
      dv?.meta?.originNode ||
      dv?.meta?.by ||
      "utopy:web",
  );

  return {
    kind: "dv.upsert",
    dv,
    meta: {
      nodeId: sourceNodeId,
      ts: new Date().toISOString(),
      ns,
      source: sourceNodeId,
      targetNodeId: text(options.targetNodeId || dv?.meta?.targetNodeId) || undefined,
      scopes:
        Array.isArray(dv?.meta?.scopes) && dv.meta.scopes.length
          ? dv.meta.scopes
          : ["public"],
    },
    auth: options.auth || "utopy-resonancia",
    id: sourceNodeId,
    ns: options.transportNamespace || "mt",
  };
}

export function publishUtopyDV(
  dv: PublishableDV,
  options: PublishUtopyOptions = {},
): PublishableDV {
  if (!dv?.id || !dv?.kind) {
    throw new Error("publishUtopyDV requiere un DV con id y kind.");
  }

  mtLiveUpsert(dv as any);
  if (options.localOnly || typeof window === "undefined") return dv;

  const envelope = buildDvUpsertEnvelope(dv, options);
  window.dispatchEvent(new CustomEvent("utopy.emit", { detail: envelope }));
  window.dispatchEvent(new CustomEvent("mt:dv", { detail: { dv } }));
  return dv;
}
