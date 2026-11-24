import { validateLivingComposition } from "utopy/composition";

export type CompositionRequirement = {
  id: string;
  kind: "capability" | "material" | "resource";
  code: string;
  label: string;
  traits: string[];
  stepIds: string[];
  quantity: number | null;
  unit: string;
};

export type CompositionCandidateMatch = {
  id: string;
  kind: CompositionRequirement["kind"];
  requirement: CompositionRequirement;
  candidate: any;
  label: string;
  score: number;
};

export type PublicLivingComposition = {
  id: string;
  compositionId: string;
  revision: number;
  summary: string;
  reusable: boolean;
  requirements: CompositionRequirement[];
  matches: CompositionCandidateMatch[];
  missing: CompositionRequirement[];
  source: any;
};

const text = (...values: unknown[]) => {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
};
const list = (value: unknown): any[] => Array.isArray(value) ? value : value == null ? [] : [value];
const normalize = (value: unknown) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const unique = (values: unknown[]) => Array.from(new Set(values.map(text).filter(Boolean)));

const HUMAN_WORDS: Record<string, string> = {
  assembly: "armado", build: "construcción", casting: "fundición", cnc: "CNC",
  cut: "corte", cutting: "corte", deliver: "entrega", delivery: "entrega",
  design: "diseño", energy: "energía", fabrication: "fabricación", install: "instalación",
  machine: "máquina", material: "material", polish: "pulido", printing: "impresión",
  repair: "reparación", resource: "recurso", transport: "transporte", welding: "soldadura",
  wood: "madera",
};

export function humanCompositionTerm(value: unknown, fallback = "esta parte") {
  const raw = text(value);
  if (!raw) return fallback;
  if (!/^[a-z0-9]+(?:[._:/-][a-z0-9]+)+$/i.test(raw)) return raw;
  const words = raw.split(/[._:/-]+/).filter((word) => !/^(capability|operation|service|v\d+|utopy)$/i.test(word));
  const label = words.map((word) => HUMAN_WORDS[word.toLowerCase()] || word).join(" ").replace(/\s+/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : fallback;
}

function scopesOf(dv: any) {
  return unique([...list(dv?.scopes), ...list(dv?.meta?.scopes), ...list(dv?.attrs?.scopes)]).map((value) => value.toLowerCase());
}

function payloadOf(dv: any) {
  if (dv?.kind !== "composition.publish") return null;
  if (dv?.meta?.runtimeEnvelope?.payload?.protocol === "utopy.living-composition/1") return dv.meta.runtimeEnvelope.payload;
  if (dv?.attrs?.protocol === "utopy.living-composition/1") return dv.attrs;
  if (dv?.payload?.protocol === "utopy.living-composition/1") return dv.payload;
  return null;
}

function verifiedProjection(dv: any) {
  return dv?.meta?.runtimeVerified === true || dv?.runtimeVerified === true;
}

function validShape(payload: any) {
  return validateLivingComposition(payload).ok;
}

export function isPublicLivingComposition(dv: any) {
  const payload = payloadOf(dv);
  if (!payload || !verifiedProjection(dv) || !validShape(payload)) return false;
  const scopes = scopesOf(dv);
  if (!scopes.includes("public") || scopes.some((scope) => /private|participant|custodian/.test(scope))) return false;
  return dv?.meta?.policy?.restrictions?.noShare !== true && dv?.policy?.restrictions?.noShare !== true;
}

function concreteParticipant(payload: any, participantId: unknown) {
  if (!participantId) return false;
  const participant = list(payload?.participants).find((item) => text(item?.participantId) === text(participantId));
  return Boolean(participant && !["manual", "future-capability"].includes(text(participant.kind)) && text(participant.ref, participant.authority));
}

function resourceEntries(value: unknown, path: string[] = [], output: CompositionRequirement[] = [], seen = new Set<object>()) {
  if (value == null || output.length >= 80) return output;
  const pathKey = normalize(path.join("."));
  const pathKind = /material|ingredient|component|supply|insumo/.test(pathKey) ? "material" : /resource|recurso/.test(pathKey) ? "resource" : null;
  if ((typeof value === "string" || typeof value === "number") && pathKind) {
    const code = text(value);
    if (code) output.push({ id: `${pathKind}:${normalize(code)}`, kind: pathKind, code, label: humanCompositionTerm(code, pathKind === "material" ? "Material" : "Recurso"), traits: [], stepIds: [], quantity: null, unit: "" });
    return output;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return output;
    seen.add(value as object);
  }
  if (Array.isArray(value)) {
    value.forEach((item) => resourceEntries(item, path, output, seen));
    return output;
  }
  if (typeof value !== "object") return output;
  const object = value as Record<string, any>;
  const declaredKind = normalize(object.kind || object.type || object.category);
  const resourceKind = /material|ingredient|component|supply|insumo/.test(`${pathKey}.${declaredKind}`) ? "material" : /resource|recurso/.test(`${pathKey}.${declaredKind}`) ? "resource" : null;
  const code = text(object.material, object.resource, object.code, object.key, object.label, object.name, object.title);
  const status = normalize(object.status || object.state);
  const explicitlyPresent = /available|provided|owned|resolved|complete/.test(status) || object.available === true || object.resolved === true;
  if (resourceKind && code && !explicitlyPresent) {
    const quantity = Number(object.quantity ?? object.amount ?? object.qty);
    output.push({
      id: `${resourceKind}:${normalize(code)}`,
      kind: resourceKind,
      code,
      label: humanCompositionTerm(object.label || object.name || code, resourceKind === "material" ? "Material" : "Recurso"),
      traits: unique(list(object.traits)),
      stepIds: unique(list(object.stepIds || object.stepId)),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      unit: text(object.unit),
    });
    // Quantity, unit and label describe this requirement; they are not
    // additional material requirements of their own.
    return output;
  }
  for (const [key, child] of Object.entries(object)) resourceEntries(child, [...path, key], output, seen);
  return output;
}

export function livingCompositionRequirements(dv: any): CompositionRequirement[] {
  const payload = payloadOf(dv);
  if (!payload || !validShape(payload)) return [];
  const requirements: CompositionRequirement[] = [];
  for (const step of payload.steps) {
    if (step?.capability?.required === false || concreteParticipant(payload, step.participantId)) continue;
    const code = text(step.capability.code);
    const key = normalize(code);
    const current = requirements.find((item) => item.kind === "capability" && normalize(item.code) === key);
    if (current) current.stepIds = unique([...current.stepIds, step.stepId]);
    else requirements.push({ id: `capability:${key}`, kind: "capability", code, label: humanCompositionTerm(code), traits: unique(list(step.capability.traits)), stepIds: [text(step.stepId)], quantity: null, unit: "" });
  }
  requirements.push(...resourceEntries(payload.inputs));
  const deduped = new Map<string, CompositionRequirement>();
  for (const requirement of requirements) {
    const key = `${requirement.kind}:${normalize(requirement.code)}`;
    const previous = deduped.get(key);
    if (previous) previous.stepIds = unique([...previous.stepIds, ...requirement.stepIds]);
    else deduped.set(key, requirement);
  }
  return [...deduped.values()];
}

function capabilityEntries(dv: any) {
  const attrs = dv?.attrs || {};
  const raw = [...list(attrs.capabilities), ...list(attrs.capability), ...(/capability|work\.cell|service\.offer/.test(text(dv?.kind).toLowerCase()) ? [attrs] : [])];
  return raw.map((item: any) => typeof item === "string" ? { code: item, traits: [] } : {
    code: text(item?.code, item?.id, item?.key, item?.capability),
    traits: unique(list(item?.traits)),
  }).filter((item) => item.code);
}

function materialEntries(dv: any) {
  const attrs = dv?.attrs || {};
  return unique([
    attrs.material, attrs.materialKey, attrs.materialName, attrs.resource, attrs.resourceKey,
    attrs.productName, attrs.name, attrs.title,
    ...list(attrs.materials).flatMap((item: any) => typeof item === "string" ? [item] : [item?.material, item?.key, item?.label, item?.name]),
    ...list(attrs.resources).flatMap((item: any) => typeof item === "string" ? [item] : [item?.resource, item?.key, item?.label, item?.name]),
    ...list(attrs.capabilities).flatMap((item: any) => [...list(item?.resources), ...list(item?.accepts)]),
  ]);
}

function available(dv: any) {
  const attrs = dv?.attrs || {};
  const status = normalize(attrs.status || attrs.availability?.status);
  const stock = Number(attrs.stockQty ?? attrs.stock);
  return attrs.available !== false && attrs.availability?.availableNow !== false && !/offline|closed|expired|unavailable|cancel/.test(status) && (!Number.isFinite(stock) || stock > 0);
}

function publicCandidate(dv: any) {
  const scopes = scopesOf(dv);
  return !scopes.some((scope) => /private|participant|custodian/.test(scope)) && (scopes.includes("public") || /offer|product|producto|material|resource|capability|work\.cell|manifest|profile/.test(text(dv?.kind).toLowerCase()));
}

function semanticTokens(value: unknown) {
  return new Set(normalize(value).split(".").filter((part) => part.length > 2));
}

function semanticScore(wanted: unknown, offered: unknown) {
  const a = semanticTokens(wanted); const b = semanticTokens(offered);
  if (!a.size || !b.size) return 0;
  let overlap = 0; a.forEach((token) => { if (b.has(token)) overlap += 1; });
  return overlap / Math.max(1, a.size);
}

export function matchLivingCompositionCandidates(compositionDV: any, allLive: any[]): CompositionCandidateMatch[] {
  if (!isPublicLivingComposition(compositionDV)) return [];
  const requirements = livingCompositionRequirements(compositionDV);
  const candidates = (allLive || []).filter((dv) => dv?.id && dv.id !== compositionDV.id && !payloadOf(dv) && publicCandidate(dv) && available(dv));
  const matches: CompositionCandidateMatch[] = [];
  for (const requirement of requirements) {
    for (const candidate of candidates) {
      if (requirement.kind === "capability") {
        for (const offered of capabilityEntries(candidate)) {
          const exact = normalize(offered.code) === normalize(requirement.code);
          const traits = requirement.traits.every((trait) => offered.traits.map(normalize).includes(normalize(trait)));
          if (!exact || !traits) continue;
          matches.push({ id: `${requirement.id}:${candidate.id}`, kind: "capability", requirement, candidate, label: `Puede ayudarte con ${requirement.label.toLocaleLowerCase("es")}`, score: 1 });
          break;
        }
      } else {
        const scores = materialEntries(candidate).map((offered) => semanticScore(requirement.code, offered));
        const score = scores.length ? Math.max(...scores) : 0;
        if (score < 0.66) continue;
        matches.push({ id: `${requirement.id}:${candidate.id}`, kind: requirement.kind, requirement, candidate, label: `Tiene ${requirement.label.toLocaleLowerCase("es")}`, score });
      }
    }
  }
  return [...new Map(matches.sort((a, b) => b.score - a.score).map((match) => [match.id, match])).values()];
}

export function compositionAsDiscoveryIntent(dv: any) {
  const payload = payloadOf(dv);
  if (!payload || !validShape(payload)) return dv;
  const requirements = livingCompositionRequirements(dv);
  const inputs = payload.intent?.inputs || {};
  return {
    ...dv,
    attrs: {
      ...(dv.attrs || {}),
      title: payload.intent.summary,
      description: "Una forma viva de coordinar capacidades y recursos.",
      territoryId: text(inputs.territoryId, inputs.territory, inputs.zone, dv?.attrs?.territoryId),
      intent: {
        mode: "need",
        domains: unique(requirements.filter((item) => item.kind === "capability").map((item) => item.code)),
        verbs: ["contribute", "provide", "collaborate"],
        resources: unique(requirements.map((item) => item.code)),
      },
      requestedCapabilities: requirements.filter((item) => item.kind === "capability").map((item) => item.code),
      materialRequirements: requirements.filter((item) => item.kind !== "capability").map((item) => ({ material: item.code, quantity: item.quantity, unit: item.unit })),
    },
  };
}

export function projectLivingCompositionDiscovery(allLive: any[]): PublicLivingComposition[] {
  const latest = new Map<string, any>();
  for (const dv of allLive || []) {
    if (!isPublicLivingComposition(dv)) continue;
    const payload = payloadOf(dv)!;
    const previous = latest.get(payload.compositionId);
    if (!previous || Number(payloadOf(previous)?.revision || 0) < Number(payload.revision)) latest.set(payload.compositionId, dv);
  }
  return [...latest.values()].map((source) => {
    const payload = payloadOf(source)!;
    const requirements = livingCompositionRequirements(source);
    const matches = matchLivingCompositionCandidates(source, allLive);
    const matched = new Set(matches.map((match) => match.requirement.id));
    const policy = source?.meta?.policy || source?.policy || {};
    return {
      id: text(source.id),
      compositionId: payload.compositionId,
      revision: Number(payload.revision),
      summary: payload.intent.summary,
      reusable: policy?.restrictions?.noDerivative !== true,
      requirements,
      matches,
      missing: requirements.filter((requirement) => !matched.has(requirement.id)),
      source,
    };
  });
}
