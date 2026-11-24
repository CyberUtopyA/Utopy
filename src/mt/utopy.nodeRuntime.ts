// src/mt/utopy.nodeRuntime.ts
// Ejecución distribuida: cada nodo registra solamente sus propias capacidades.
// UTOPY propone; el nodo decide, ejecuta y publica el resultado.

import { mtLiveSnapshot, mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";
import { nodeIdentityOf, normalizeSemantic } from "./utopy.symbiosis";

export type NodeReactionContext = {
  proposal: any;
  input: any | null;
  idempotencyKey: string;
  nodeId: string;
};

export type NodeReactionResult = {
  kind?: string;
  status?: string;
  attrs?: Record<string, any>;
  traits?: string[];
  meta?: Record<string, any>;
};

export type NodeCapabilityHandler = (
  context: NodeReactionContext,
) => NodeReactionResult | void | Promise<NodeReactionResult | void>;

export type NodeRuntimeOptions = {
  nodeId: string;
  handlers: Record<string, NodeCapabilityHandler>;
  publishDV?: (dv: any) => void | Promise<void>;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function key(value: unknown): string {
  return normalizeSemantic(value).replace(/^utopy\.node\./, "").replace(/[^a-z0-9]/g, "");
}

function responseAccepted(proposal: any, all: any[]): boolean {
  if (proposal?.attrs?.security?.requiresConsent === false) return true;
  return all.some((dv) => {
    if (!["utopy.reaction.accepted", "resonance.response"].includes(String(dv?.kind))) {
      return false;
    }
    const respondsTo = text(dv?.meta?.respondsTo || dv?.attrs?.proposalRef?.id);
    const status = normalizeSemantic(dv?.attrs?.status || "accepted");
    return respondsTo === proposal.id && ["accepted", "approved", "confirmed"].includes(status);
  });
}

function handlerKeys(proposal: any): string[] {
  return [
    proposal?.attrs?.capabilityRef?.capabilityId,
    proposal?.attrs?.action?.kind,
    proposal?.attrs?.action?.action,
    ...(Array.isArray(proposal?.attrs?.produces) ? proposal.attrs.produces : []),
    "*",
  ]
    .map(normalizeSemantic)
    .filter(Boolean);
}

export function acceptReactionProposal(proposalId: string, actorId: string) {
  const now = new Date().toISOString();
  return mtLiveUpsert({
    id: `utopy.reaction.accepted:${proposalId}:${actorId}`,
    kind: "utopy.reaction.accepted",
    traits: ["sem.dv.answer", "consent.explicit"],
    attrs: {
      status: "accepted",
      actorId,
      proposalRef: { id: proposalId },
    },
    meta: {
      ns: "utopy:resonance",
      ts: now,
      updatedAt: now,
      respondsTo: proposalId,
      by: actorId,
      scopes: ["participants"],
    },
  } as any);
}

export function startNodeCapabilityRuntime(options: NodeRuntimeOptions): () => void {
  const nodeId = text(options.nodeId);
  if (!nodeId) throw new Error("startNodeCapabilityRuntime requiere nodeId.");
  const publish = options.publishDV || ((dv: any) => mtLiveUpsert(dv));
  const running = new Set<string>();
  let stopped = false;

  const reconcile = async (all: any[]) => {
    if (stopped) return;
    const byId = new Map(all.filter((dv) => dv?.id).map((dv) => [String(dv.id), dv]));
    const proposals = all.filter((dv) => {
      if (dv?.kind !== "utopy.reaction.proposal") return false;
      const target = dv?.attrs?.targetNode?.id || nodeIdentityOf(dv);
      return key(target) === key(nodeId);
    });

    for (const proposal of proposals) {
      const idempotencyKey = text(
        proposal?.attrs?.action?.idempotencyKey || proposal?.meta?.idempotencyKey || proposal.id,
      );
      const outcomeId = `utopy.reaction.outcome:${idempotencyKey}`;
      if (byId.has(outcomeId) || running.has(idempotencyKey)) continue;
      if (!responseAccepted(proposal, all)) continue;

      const handlerKey = handlerKeys(proposal).find((candidate) => options.handlers[candidate]);
      const handler = handlerKey ? options.handlers[handlerKey] : undefined;
      if (!handler) continue;

      running.add(idempotencyKey);
      try {
        const inputId = text(proposal?.attrs?.inputRef?.id);
        const result = await handler({
          proposal,
          input: inputId ? byId.get(inputId) || null : null,
          idempotencyKey,
          nodeId,
        });
        const now = new Date().toISOString();
        const status = text(result?.status || "completed");
        await publish({
          id: outcomeId,
          kind: result?.kind || "utopy.reaction.outcome",
          traits: [
            "sem.dv.outcome",
            "utopy.reaction.outcome",
            ...(result?.traits || []),
          ],
          attrs: {
            status,
            nodeId,
            proposalRef: { id: proposal.id },
            inputRef: proposal?.attrs?.inputRef,
            capabilityRef: proposal?.attrs?.capabilityRef,
            idempotencyKey,
            ...(result?.attrs || {}),
          },
          meta: {
            ns: "utopy:resonance",
            ts: now,
            updatedAt: now,
            by: nodeId,
            originNode: nodeId,
            respondsTo: proposal.id,
            scopes: ["participants"],
            idempotencyKey,
            ...(result?.meta || {}),
          },
        });
      } catch (error) {
        const now = new Date().toISOString();
        await publish({
          id: outcomeId,
          kind: "utopy.reaction.outcome",
          traits: ["sem.dv.outcome", "utopy.reaction.failed"],
          attrs: {
            status: "failed",
            nodeId,
            proposalRef: { id: proposal.id },
            idempotencyKey,
            message: String((error as any)?.message || error || "La capacidad falló."),
          },
          meta: {
            ns: "utopy:resonance",
            ts: now,
            updatedAt: now,
            by: nodeId,
            originNode: nodeId,
            respondsTo: proposal.id,
            scopes: ["participants"],
            idempotencyKey,
          },
        });
      } finally {
        running.delete(idempotencyKey);
      }
    }
  };

  const unsubscribe = mtLiveSubscribe((all) => void reconcile(all as any[]));
  void reconcile(mtLiveSnapshot() as any[]);
  return () => {
    stopped = true;
    unsubscribe();
    running.clear();
  };
}
