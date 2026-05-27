import type { PresenceScanInput, PresenceSignal } from "./presence.types";
import { makePresenceId } from "./presence.id";

export function buildPresenceSignal(input: PresenceScanInput): PresenceSignal {
  const ts = new Date().toISOString();

  return {
    id: input.id || makePresenceId("presence"),
    nodeId: input.nodeId || undefined,
    ns: input.ns || "utopy:presence",
    kind: input.kind || "custom",
    title: input.title || "Presencia viva",
    subtitle: input.subtitle || "",
    description: input.description || "",
    strength: input.strength ?? 0.8,
    distanceLabel: input.distanceLabel || "cerca",
    image: input.image || null,
    actorId: input.actorId || null,
    productId: input.productId || null,
    offerId: input.offerId || null,
    orderId: input.orderId || null,
    threadId: input.threadId || null,
    sceneId: input.sceneId || null,
    invoiceId: input.invoiceId || null,
    receiptId: input.receiptId || null,
    actions: input.actions || [],
    meta: input.meta || {},
    ts,
  };
}

export function buildPresenceDV(signal: PresenceSignal) {
  return {
    id: `utopy.presence.signal:${signal.id}`,
    kind: "utopy.presence.signal",
    attrs: {
      signal,
    },
    traits: ["utopy:presence", "utopy:interaction.passive"],
    meta: {
      ns: signal.ns || "utopy:presence",
      ts: signal.ts || new Date().toISOString(),
      source: "utopy.presence.core",
      scopes: ["public"],
      ttl_ms: 1000 * 30,
    },
  };
}