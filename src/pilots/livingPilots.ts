import {
  createIdentity, createUtopyRuntime, createEnvelope, signEnvelope, verifyEnvelopeSignature,
  MemoryEnvelopeStore, NullPendingQueue, LocalCapabilitySandbox, LivingCompositionEngine,
  createCompositionAuthorizationEnvelope, projectReasoningForm, RuleReasoner, buildPassport,
  type CompositionInput, type CompositionEnvelope, type CapabilityExecutionDeclaration,
  type LivingEnvelope, type JsonValue,
} from "utopy";

import { LIVING_PILOTS, type PilotKey } from "./livingPilotDefinitions";
export { LIVING_PILOTS, type PilotKey } from "./livingPilotDefinitions";
export type QuoteLine = { description: string; quantity: number; unit: string; unitPrice: number };

export function quoteTotal(lines: QuoteLine[]) {
  if (lines.some(line => !line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0)) throw Error("Revisá descripción, cantidad y precio.");
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) throw Error("Importe fuera de rango.");
  return total;
}

/** Draft extraction only: preserves unrecognized text for human clarification. */
export function extractOfferLines(text: string): QuoteLine[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s+(?:(kilos?|kg|unidades?)\s+de\s+)?(.+?)\s+a\s+(\d+(?:\.\d{3})*(?:,\d+)?)(?=\s|$)/gi)].map(match => ({
    description: match[3].trim(), quantity: Number(match[1].replace(",", ".")),
    unit: /kilo|kg/i.test(match[2] || "") ? "kg" : "u",
    unitPrice: Number(match[4].replace(/\./g, "").replace(",", ".")),
  }));
}

export function pilotDeclaration(code: string): CapabilityExecutionDeclaration {
  return {
    code: `demo.${code}`, inputs: ["detail"], inputSchemas: { detail: { type: "string", minLength: 3, required: true } },
    outputs: ["simulation.evidence"], effects: [], permissions: ["pilot.simulate"],
    network: { required: false }, storage: { required: false },
    limits: { maxDurationMs: 1000, maxOutputBytes: 4096 }, reversibility: "irreversible",
    risks: ["Demostración local: no realiza trabajos, entregas ni cobros reales."],
  };
}

/** Uses Runtime's engine. No production handler, real identity, transport or trade store. */
export async function createPilotDemonstration(key: PilotKey) {
  const config = LIVING_PILOTS[key];
  const sessionId = crypto.randomUUID();
  const identity = await createIdentity({ actorId: `simulation:${sessionId}`, nodeId: `simulation:node:${sessionId}` });
  const store = new MemoryEnvelopeStore();
  const runtime = await createUtopyRuntime({ identity, transports: [], store, pending: new NullPendingQueue(), features: { router: false } });
  const trust = (authority: string, keyId: string, jwk: JsonWebKey) => runtime.authorities.accepts(authority, keyId, jwk);
  runtime.authorities.trust(identity.nodeId!, identity.keyId, identity.publicKeyJwk);
  const consentRefs = new Set<string>();
  const declarations = config.capabilities.map(pilotDeclaration);
  const sandbox = new LocalCapabilitySandbox();
  for (const declaration of declarations) sandbox.register(declaration, {
    execute: async (inputs, context) => {
      const evidence = await runtime.recordLocal(await createEnvelope({
        id: `simulation.evidence:${context.executionId}`, kind: "simulation.evidence",
        sourceActorId: identity.actorId, sourceNodeId: identity.nodeId, authority: identity.nodeId!, scopes: ["private"],
        payload: { simulation: true, nonTradable: true, capability: declaration.code, detail: inputs.detail, realOperationPerformed: false },
      }));
      return { status: "succeeded", evidenceRefs: [evidence.id], output: { simulation: true, nonTradable: true, realOperationPerformed: false } };
    },
  });
  const engine = new LivingCompositionEngine(runtime, sandbox, undefined, {
    trust,
    verifyAuthorization: ref => consentRefs.has(ref.ref),
    verifyEvidence: async ref => { const dv = await store.get(ref); return !!dv && await verifyEnvelopeSignature(dv, trust); },
    verifyCondition: async () => false,
    verifyDependency: async (_step, ref) => { const dv = await store.get(ref); return !!dv && dv.kind === "composition.outcome" && await verifyEnvelopeSignature(dv, trust); },
    allowStep: async (_step, effects, permissions) => effects.length === 0 && permissions.every(permission => permission === "pilot.simulate"),
  });
  let composition: CompositionEnvelope | undefined;
  let executed = 0;
  const reasoner = new RuleReasoner();
  const prepare = async (text: string, detail: string) => {
    const code = declarations[0].code;
    const source = await createEnvelope({ id: `simulation.intent:${sessionId}`, kind: "intention.publish", authority: identity.nodeId!, sourceActorId: identity.actorId, sourceNodeId: identity.nodeId,
      scopes: ["private"], payload: { text, requiredCapabilities: [code], inputs: { detail }, simulation: true, nonTradable: true } });
    const context = { actorId: identity.actorId, nodeId: identity.nodeId, capabilities: declarations.map(item => item.code), declarations, dictionary: {} };
    const meaning = await reasoner.interpret(source, context);
    return projectReasoningForm(source, meaning, context);
  };
  return {
    prepare,
    async simulate(text: string, detail: string) {
      if (composition) await engine.deactivate(composition.payload.compositionId, composition.payload.revision);
      executed = 0;
      const form = await prepare(text, detail);
      if (!form.valid) throw Error("Completá el detalle antes de simular.");
      const steps = declarations.map((declaration, index) => ({ stepId: `step-${index + 1}`, capability: { code: declaration.code }, participantId: "demo", executor: "node-capability" as const,
        dependsOn: index ? [`step-${index}`] : [], inputs: { detail }, outcomeKind: "simulation.outcome" }));
      const input: CompositionInput = {
        intent: { summary: text }, inputs: { simulation: true, nonTradable: true }, requiredCapabilities: declarations.map(item => ({ code: item.code })),
        participants: [{ participantId: "demo", kind: "node", ref: identity.nodeId, authority: identity.nodeId, capabilities: declarations.map(item => item.code) }], steps, conditions: [],
        outcome: { kind: "simulation.outcome", requiredStepIds: steps.map(step => step.stepId) },
        authorityRequirements: [{ requirementId: "demo-consent", stepIds: steps.map(step => step.stepId), mode: "explicit-consent", authority: identity.nodeId, permissions: ["pilot.simulate"] }],
        resourceLimits: { allowedCapabilities: declarations.map(item => item.code), maxExecutions: steps.length, maxDurationMs: 60_000, maxOutputBytes: 65536, network: "none", storage: "none" },
        privacy: { visibility: "private", disclose: ["structure"], evidence: "private", inputs: "private" }, evidenceRequirements: [], expectedOutcomes: [{ kind: "simulation.outcome", requiredStepIds: steps.map(step => step.stepId) }], composedFrom: [],
      };
      // Signing a proposal is not execution authorization. Approval is a separate call.
      composition = await runtime.sdk.composition.sign(input, { mode: "explicit-consent", ref: `simulation:proposal:${sessionId}` });
      await engine.save(composition);
      return engine.simulate(composition);
    },
    async authorize(confirmed: boolean) {
      if (!confirmed || !composition) throw Error("Confirmá el ensayo y simulá primero.");
      const ref = `simulation:consent:${crypto.randomUUID()}`;
      consentRefs.add(ref);
      const authorization = await createCompositionAuthorizationEnvelope(runtime, composition, { stepIds: composition.payload.steps.map(step => step.stepId), allowedCapabilities: declarations.map(item => item.code), limits: composition.payload.resourceLimits,
        authorization: { mode: "explicit-consent", ref }, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
      await engine.activate(composition, authorization);
    },
    async advance() {
      if (!composition || executed >= config.steps.length) throw Error("No hay un próximo paso preparado.");
      const outcomes = await store.list(dv => dv.kind === "composition.outcome");
      const dependencies: Record<string, string> = {};
      for (const outcome of outcomes) dependencies[String((outcome.payload as any).stepId)] = outcome.id;
      const result = await engine.executeStep(composition.payload.compositionId, composition.payload.revision, `step-${executed + 1}`, { dependencyOutcomeRefs: dependencies });
      if (result.payload.state !== "SUCCEEDED") throw Error("El ensayo no completó este paso.");
      executed++;
      return { completed: executed, evidence: result, done: executed === config.steps.length };
    },
    async revoke() { consentRefs.clear(); if (composition) await engine.deactivate(composition.payload.compositionId, composition.payload.revision); },
    async exportProof() {
      if (!composition || executed !== config.steps.length) throw Error("Terminá el ensayo antes de generar su constancia.");
      const documents = await store.list();
      const checked = await Promise.all(documents.map(dv => verifyEnvelopeSignature(dv, trust)));
      if (checked.some(valid => !valid)) throw Error("Hay evidencia con firma inválida.");
      const outcomes = documents.filter(dv => dv.kind === "composition.outcome");
      const passport = buildPassport({ subjectId: composition.id, outcomes });
      const proof = await signEnvelope(await createEnvelope({ id: `simulation.proof:${sessionId}`, kind: "simulation.proof", authority: identity.nodeId!, sourceActorId: identity.actorId, sourceNodeId: identity.nodeId,
        scopes: ["public"], payload: { simulation: true, nonTradable: true, realOperationPerformed: false, completedSteps: executed, compositionHash: composition.contentHash } }), identity);
      return { proof, bundle: { simulation: true, nonTradable: true, composition, passport, documents, proof } };
    },
  };
}

export async function verifyPilotProof(value: unknown) {
  const dv = value as LivingEnvelope<Record<string, JsonValue>>;
  if (dv?.kind !== "simulation.proof" || dv.payload?.simulation !== true || dv.payload?.realOperationPerformed !== false) return false;
  // Integrity only. A demo's ephemeral signing key never grants owner authority.
  return verifyEnvelopeSignature(dv, (_authority, keyId, jwk) => keyId === dv.ownership?.keyId && jwk.x === dv.ownership?.publicKeyJwk.x && jwk.y === dv.ownership?.publicKeyJwk.y);
}
