// ============================================
// FILE: src/mt/work.publish.ts
// Publicación real de DV laborales usando el mismo patrón
// que OfferActionModal / mt.consult
// ============================================

import { mtLiveUpsert } from "./mt.liveStore";

function nowIso() {
  return new Date().toISOString();
}

export async function publishWorkDV(dv: any) {
  // optimista local
  mtLiveUpsert(dv as any);

  const upsertEnvelope = {
    kind: "dv.upsert",
    dv,
    meta: {
      nodeId: "ms:web",
      ts: nowIso(),
      ns: String(dv?.meta?.ns || "mt:market"),
      source: "ms:web",
      scopes:
        Array.isArray(dv?.meta?.scopes) && dv.meta.scopes.length
          ? dv.meta.scopes
          : ["public"],
    },
    auth: "utopy-resonancia",
    id: "ms:web",
    ns: "mt",
  };

  console.log("[MS] publishWorkDV dispatch", upsertEnvelope);

  try {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail: upsertEnvelope,
      })
    );
  } catch (e) {
    console.warn("[MS] publishWorkDV utopy.emit fail", e);
  }

  return dv;
}