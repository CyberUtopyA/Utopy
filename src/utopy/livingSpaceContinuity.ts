import type { LivingEnvelope, UtopyIdentity } from "utopy";
import {
  canAccessEnvelope, createContextHandoffEnvelope, createContextHandoffAckEnvelope,
  verifyContextHandoffEnvelope, verifyContextHandoffAckEnvelope, projectedMandateAllows,
  HandoffReplayGuard, type ContextHandoffEnvelope, type HandoffContext, type EnvelopeAccessContext,
} from "utopy/continuity";
import { verifyLivingCapabilityEnvelope } from "utopy/living-space";
import { verifyCompositionEnvelope } from "utopy/composition";
import { marketAuthorityTrust, type MarketAuthorityTrust } from "./runtimeTrust";
import { mtLiveSnapshot, mtLiveUpsertIfChanged } from "../mt/mt.liveStore";
import { projectVerifiedRuntimeEnvelope } from "./runtimeProjection.security";

/** Protocol adapter, with the existing store and transport injected. No remote executor. */
export class LivingSpaceContinuity {
  private replay = new HandoffReplayGuard();
  constructor(
    readonly trust: MarketAuthorityTrust,
    private readonly snapshot: () => any[] = mtLiveSnapshot,
    private readonly store: (dv: any) => unknown = mtLiveUpsertIfChanged,
    private readonly send: (envelope: LivingEnvelope) => void = (envelope) => {
      window.dispatchEvent(new CustomEvent("utopy.emit", { detail: { kind: "dv.upsert", dv: envelope,
        meta: { scopes: envelope.scopes, targetNodeId: envelope.targetNodeId, nodeId: envelope.sourceNodeId } } }));
    },
  ) {}
  async receive(envelope: LivingEnvelope, context: EnvelopeAccessContext,
    verifyConsent?: (ref: string, handoff: ContextHandoffEnvelope) => boolean | Promise<boolean>) {
    if (envelope.kind === "authority.trust") return this.trust.receiveTrust(envelope);
    if (!canAccessEnvelope(envelope, context)) return { ok: false, reason: "access-denied" };
    let checked;
    if (envelope.kind === "living.capability.manifest") checked = await verifyLivingCapabilityEnvelope(envelope, this.trust.trusted);
    else if (envelope.kind === "composition.publish") checked = await verifyCompositionEnvelope(envelope, this.trust.trusted);
    else if (envelope.kind === "context.handoff") {
      if (!context.nodeId) return { ok: false, reason: "receiver-node-required" };
      checked = await verifyContextHandoffEnvelope(envelope, { receiverNodeId: context.nodeId,
        trusted: this.trust.trusted, replay: this.replay, verifyConsent });
      // Record a nonce per actor/node across reloads, until the signed TTL expires.
      if (checked.ok && !this.rememberNonce(envelope as ContextHandoffEnvelope, context)) return { ok: false, reason: "handoff-replay" };
    } else if (envelope.kind === "context.handoff.ack") {
      const handoff = this.snapshot().find((dv) => dv.id === envelope.respondsTo)?.meta?.runtimeEnvelope as ContextHandoffEnvelope;
      if (!handoff || handoff.sourceActorId !== context.actorId || !handoff.sourceNodeId) return { ok: false, reason: "handoff-missing" };
      if (this.snapshot().some((dv) => dv.kind === "context.handoff.ack" && dv.attrs?.handoffRef === handoff.id)) return { ok: false, reason: "ack-replay" };
      checked = await verifyContextHandoffAckEnvelope(envelope, handoff, { senderNodeId: handoff.sourceNodeId, trusted: this.trust.trusted });
    } else return { ok: false, reason: "unsupported-contract" };
    if (!checked.ok) return checked;
    const projection = projectVerifiedRuntimeEnvelope(envelope);
    if (!projection.accepted) return { ok: false, reason: projection.reason };
    this.store(projection.dv);
    return { ok: true };
  }
  private rememberNonce(envelope: ContextHandoffEnvelope, context: EnvelopeAccessContext) {
    if (typeof sessionStorage === "undefined") return true;
    const key = `utopy.handoff.replay:${encodeURIComponent(context.actorId)}:${encodeURIComponent(context.nodeId || "")}`;
    try {
      const now = Date.now();
      const entries = (JSON.parse(sessionStorage.getItem(key) || "[]") as [string, number][]).filter(([, expiry]) => expiry > now);
      const nonce = `${envelope.authority}|${envelope.payload.nonce}`;
      if (entries.some(([id]) => id === nonce) || entries.length >= 1000) return false;
      entries.push([nonce, Date.parse(envelope.payload.expiresAt)]);
      sessionStorage.setItem(key, JSON.stringify(entries)); return true;
    } catch { return false; }
  }
  async request(input: { identity: UtopyIdentity; mandateId: string; capability: LivingEnvelope;
    context: HandoffContext; returnRef: string; confirmed: boolean }) {
    if (!input.confirmed) throw new Error("Confirmá qué contexto querés compartir.");
    const capability = input.capability;
    const checked = await verifyLivingCapabilityEnvelope(capability, this.trust.trusted);
    if (!checked.ok || !capability.scopes?.includes("public")) throw new Error("La capacidad no está autorizada o ya venció.");
    const manifest = capability.payload as any;
    if (manifest.capability.lifecycle.status !== "available" || !manifest.accepts.handoffPurposes.includes("view")) throw new Error("Este nodo no anuncia continuidad disponible.");
    const trust = this.trust.snapshot;
    if (!trust || !input.identity.nodeId || !projectedMandateAllows(trust.payload, { mandateId: input.mandateId,
      actorId: input.identity.actorId, nodeId: input.identity.nodeId, action: "context.handoff" })) throw new Error("Falta una autorización vigente para continuar desde este nodo.");
    if (!this.trust.trusted(input.identity.nodeId, input.identity.keyId, input.identity.publicKeyJwk)) throw new Error("La clave de este dispositivo todavía no tiene autoridad para ese nodo.");
    // Only canonical PUBLIC references travel; no private text, profile snapshot or geolocation.
    const refs = new Set([...(input.context.subjectRefs || []), input.context.intentRef,
      input.context.identityRef, input.context.nodeRef, input.context.compositionRef, input.context.threadId].filter(Boolean));
    for (const ref of refs) if (!this.snapshot().some((dv) => dv.id === ref && dv.meta?.scopes?.includes("public"))) throw new Error("Este contexto incluye referencias privadas. Compartilas mediante un permiso explícito.");
    const envelope = await createContextHandoffEnvelope({ identity: input.identity,
      audience: { nodeId: capability.authority, capability: manifest.capability.code }, purpose: "view",
      context: input.context, requestedCapabilities: [manifest.capability.code], delegatedActions: [],
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      presentation: { returnRef: input.returnRef, preferredMode: "same-window" } });
    const projection = projectVerifiedRuntimeEnvelope(envelope);
    if (!projection.accepted) throw new Error(projection.reason);
    this.store(projection.dv); this.send(envelope); return envelope;
  }
  async acknowledge(input: { identity: UtopyIdentity; handoff: ContextHandoffEnvelope; confirmed: boolean; mandateId: string }) {
    if (!input.confirmed || !input.identity.nodeId) throw new Error("La continuidad requiere confirmación.");
    const trust = this.trust.snapshot;
    if (!trust || !projectedMandateAllows(trust.payload, { mandateId: input.mandateId, actorId: input.identity.actorId,
      nodeId: input.identity.nodeId, action: "context.handoff.ack" })) throw new Error("No hay mandato vigente.");
    const valid = await verifyContextHandoffEnvelope(input.handoff, { receiverNodeId: input.identity.nodeId, trusted: this.trust.trusted });
    if (!valid.ok || input.handoff.payload.delegatedActions.length || !["view", "consult"].includes(input.handoff.payload.purpose)) throw new Error("Esta solicitud requiere permisos adicionales.");
    if (!this.trust.trusted(input.identity.nodeId, input.identity.keyId, input.identity.publicKeyJwk)) throw new Error("La clave no está autorizada.");
    const ack = await createContextHandoffAckEnvelope({ identity: input.identity, handoff: input.handoff, status: "accepted",
      acceptedCapabilities: [] });
    this.send(ack); return ack;
  }
}
export const livingSpaceContinuity = new LivingSpaceContinuity(marketAuthorityTrust);
