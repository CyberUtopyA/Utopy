import {
  ExistingBusTransport,
  NullEnvelopeStore,
  NullPendingQueue,
  createEnvelope,
  createUtopyRuntime,
  signEnvelope,
  type LivingEnvelope,
  type UtopyRuntime,
  type UtopyIdentity,
} from "utopy";
import { mtLiveSubscribe, mtLiveUpsertIfChanged, mtLiveSnapshot, mtLiveGetAccessContext } from "../mt/mt.liveStore";
import { dvToLivingEnvelope, isLivingEnvelope } from "./livingEnvelope.adapter";
import { MARKET_RUNTIME_FLAGS, type MarketRuntimeFlags } from "./runtimeFlags";
import { verifyRuntimeEnvelope } from "./runtimeTrust";
import { projectVerifiedRuntimeEnvelope } from "./runtimeProjection.security";
import { getOrCreateOwnerIdentity } from "./ownership";
import { deriveActorIdForOwnerDid, resolveCurrentIdentityContext } from "./identityContext";
import { canAccessEnvelope } from "utopy/continuity";
import { livingSpaceContinuity } from "./livingSpaceContinuity";

type AdapterOptions = { flags?: Partial<MarketRuntimeFlags> };

export async function runtimeIdentity(): Promise<UtopyIdentity> {
  const owner = await getOrCreateOwnerIdentity();
  return {
    actorId: await deriveActorIdForOwnerDid(owner.did),
    keyId: owner.keyId, publicKey: owner.publicKey,
    privateKey: owner.privateKey, publicKeyJwk: owner.publicKeyJwk,
  };
}

export class MarketRuntimeAdapter {
  private runtime: UtopyRuntime | null = null;
  private stopIncoming: (() => void) | null = null;
  private flags: MarketRuntimeFlags;
  private starting = false;
  private pendingIncoming: LivingEnvelope[] = [];

  constructor(options: AdapterOptions = {}) {
    this.flags = Object.freeze({ ...MARKET_RUNTIME_FLAGS, ...(options.flags || {}) }) as MarketRuntimeFlags;
  }

  async start(): Promise<void> {
    if (!this.flags.runtime || this.runtime || this.starting || typeof window === "undefined") return;
    this.starting = true;
    const incoming = (event: Event) => {
      const envelope = (event as CustomEvent).detail;
      if (!isLivingEnvelope(envelope)) return;
      if (["authority.trust", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(envelope.kind)) {
        void resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() }).then((identity) => livingSpaceContinuity.receive(envelope, mtLiveGetAccessContext() || { actorId: identity.actorId, nodeId: identity.actingAsNodeId || undefined })).catch(() => {});
        return;
      }
      if (this.runtime) void this.runtime.receive(envelope, "existing-bus");
      else if (this.pendingIncoming.length < 500) this.pendingIncoming.push(envelope);
    };
    window.addEventListener("utopy:runtime:incoming", incoming);
    this.stopIncoming = () => window.removeEventListener("utopy:runtime:incoming", incoming);
    const identity = await runtimeIdentity();
    let previous = new Map<string, string>();
    const bridge = new ExistingBusTransport({
      name: "market-existing-micelio",
      kind: "seed",
      subscribe: (receive) => mtLiveSubscribe((all) => {
        const next = new Map<string, string>();
        for (const dv of all) {
          const revision = `${dv?.meta?.revision ?? dv?.meta?.version ?? ""}|${dv?.meta?.updatedAt ?? dv?.meta?.ts ?? ""}`;
          next.set(String(dv.id), revision);
          if (previous.get(String(dv.id)) === revision) continue;
          if (["authority.trust", "living.capability.manifest", "context.handoff", "context.handoff.ack", "composition.publish"].includes(dv.kind)) continue;
          void dvToLivingEnvelope(dv).then((envelope) => receive(envelope));
        }
        previous = next;
      }),
      send: (envelope) => {
        window.dispatchEvent(new CustomEvent("utopy.emit", { detail: envelope }));
      },
    });

    this.runtime = await createUtopyRuntime({
      identity,
      transports: [bridge],
      store: new NullEnvelopeStore(),
      pending: new NullPendingQueue(),
      persistIncoming: false,
      persistOutgoing: false,
      allowUnverifiedObservation: this.flags.mind && this.flags.mindShadow,
      verifyIncoming: async (envelope) => {
        if ((envelope.payload as any)?.dv && !envelope.ownership) return { verified: false, reason: "legacy-observation" };
        const context = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
        if (!canAccessEnvelope(envelope, mtLiveGetAccessContext() || { actorId: context.actorId, nodeId: context.actingAsNodeId || undefined })) return { verified: false, reason: "access-denied" };
        return verifyRuntimeEnvelope(envelope);
      },
      autoAnswerPublicCapabilities: false,
      autoDeriveNeeds: false,
      mindMode: !this.flags.mind ? "off" : this.flags.mindShadow ? "shadow" : "active",
      features: {
        dedupe: true,
        router: true,
        directP2P: false,
        peerReferral: false,
        recursiveResonance: false,
        liquidity: false,
        outcomeLearning: false,
        multimodal: true,
        storeForward: true,
      },
      symbioticMind: {
        autonomy: this.flags.mindSafeAuto ? "SAFE_AUTO" : "SUGGEST",
        flags: {
          enabled: this.flags.mind,
          shadow: this.flags.mindShadow,
          safeAuto: this.flags.mindSafeAuto,
          planner: this.flags.mind,
          recursiveResonance: false,
          composer: this.flags.mind,
          mandates: false,
          outcomeLearning: false,
        },
      },
    });
    this.runtime.onObservation(({ envelope, verified }) => {
      if (!verified) return;
      const projection = projectVerifiedRuntimeEnvelope(envelope);
      if (projection.accepted === true) mtLiveUpsertIfChanged(projection.dv);
      else if (import.meta.env.DEV) console.warn("[utopy.runtime] envelope rejected", projection.reason);
    });
    await this.runtime.start();
    const pending = this.pendingIncoming.splice(0);
    for (const envelope of pending) await this.runtime.receive(envelope, "existing-bus");
    this.starting = false;
  }

  async publish(envelope: LivingEnvelope): Promise<LivingEnvelope> {
    if (!this.runtime) throw new Error("UTOPY Runtime no está activo.");
    return this.runtime.publish(envelope);
  }

  async stop(): Promise<void> {
    this.stopIncoming?.();
    this.stopIncoming = null;
    this.pendingIncoming = [];
    this.starting = false;
    await this.runtime?.stop();
    this.runtime = null;
  }
}

let singleton: MarketRuntimeAdapter | null = null;
export function startMarketRuntimeAdapter(): () => void {
  if (!MARKET_RUNTIME_FLAGS.runtime) return () => {};
  singleton ||= new MarketRuntimeAdapter();
  const current = singleton;
  void current.start().catch(async (error) => {
    console.warn("[utopy.runtime] no pudo iniciar", error);
    await current.stop();
    if (singleton === current) singleton = null;
  });
  return () => { const current = singleton; singleton = null; void current?.stop(); };
}

export async function createSignedMarketEnvelope(kind: string, payload: Record<string, unknown>, scopes: any[] = ["private"]) {
  const identity = await runtimeIdentity();
  const envelope = await createEnvelope({
    id: `${kind}:${crypto.randomUUID()}`,
    kind,
    sourceActorId: identity.actorId,
    sourceNodeId: identity.nodeId,
    authority: identity.actorId,
    scopes,
    payload,
  });
  return signEnvelope(envelope, identity);
}
