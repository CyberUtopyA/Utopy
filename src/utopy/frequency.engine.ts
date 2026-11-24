import { mtLiveSubscribe, mtLiveUpsertIfChanged } from "../mt/mt.liveStore";
import { publishAuthorizedDV } from "./authorizedPublish";
import { scoreDVForContext, buildLiveContext } from "../social/liveNetwork.context";
import { MARKET_RUNTIME_FLAGS } from "./runtimeFlags";
import type { AttentionOutcome, FrequencyEvent, FrequencyKind, FrequencyMode } from "./frequency.types";

const PREF_KEY = "utopy.frequency.preferences.v1";
const SEEN_KEY = "utopy.frequency.attention.v1";
const BUDGET_KEY = "utopy.frequency.budget.v1";

function text(...values: unknown[]): string {
  for (const value of values) if (value != null && String(value).trim()) return String(value).trim();
  return "";
}
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function frequencyPreferences(): { mode: FrequencyMode; actorId: string } {
  return read(PREF_KEY, { mode: "soft", actorId: "" });
}
export function setFrequencyPreferences(next: Partial<{ mode: FrequencyMode; actorId: string }>) {
  write(PREF_KEY, { ...frequencyPreferences(), ...next });
}

export function buildFrequencyEvent(input: {
  kind: FrequencyKind;
  reference: any;
  actorId: string;
  frequencyId?: string;
  sequence?: number;
  ttlMs?: number;
  parentFrequencyId?: string;
  hopCount?: number;
  visitedNodes?: string[];
  status?: "active" | "paused" | "resolved" | "expired";
}): FrequencyEvent {
  const now = new Date();
  const reference = input.reference || {};
  const frequencyId = input.frequencyId || `frequency:${crypto.randomUUID()}`;
  const status = input.status || (input.kind === "frequency.resolve" ? "resolved" : input.kind === "frequency.expire" ? "expired" : "active");
  return {
    id: `${input.kind}:${frequencyId}:${input.sequence || 1}`,
    kind: input.kind,
    attrs: {
      frequencyId,
      reference: { id: text(reference.id), kind: text(reference.kind), revision: Number(reference?.meta?.revision || reference?.meta?.version || 1) },
      sequence: Math.max(1, Number(input.sequence || 1)), status,
      rootId: text(reference?.attrs?.rootId, reference?.attrs?.rootDvId, reference.id),
      threadId: text(reference?.attrs?.threadId, reference?.meta?.threadId) || undefined,
      chainId: text(reference?.attrs?.chainId, reference?.meta?.chainId) || undefined,
      parentFrequencyId: input.parentFrequencyId,
      hopCount: Math.max(0, Number(input.hopCount || 0)), maxBranches: 4,
      visitedNodes: Array.from(new Set(input.visitedNodes || [])),
      expiresAt: new Date(now.getTime() + Math.max(10_000, input.ttlMs || 7 * 24 * 60 * 60_000)).toISOString(),
      actorId: input.actorId,
    },
    traits: ["frequency:live", "resonance:frequency"],
    meta: { ns: "utopy:resonance", scopes: ["public"], schema: "utopy.frequency@1", authority: input.actorId, revision: Math.max(1, Number(input.sequence || 1)), updatedAt: now.toISOString(), ttl_ms: input.ttlMs || 7 * 24 * 60 * 60_000 },
  };
}

export async function publishFrequencyEvent(event: FrequencyEvent, allLive: any[] = [], activeActor?: any) {
  const result = await publishAuthorizedDV({ dv: event, allLive, activeActor, action: event.kind });
  mtLiveUpsertIfChanged(result.dv as any);
  return result.dv;
}

export function attentionForDV(dv: any, allLive: any[], actorId: string, mode: FrequencyMode): AttentionOutcome {
  if (mode === "silent" || !dv?.id || !actorId) return "IGNORE";
  if (dv.kind === "frequency.pulse") return "IGNORE";
  if (dv.kind === "frequency.resolve" || dv.kind === "frequency.expire") return "SILENT_FEED";
  const direct = text(dv?.attrs?.targetActorId, dv?.attrs?.toActorId) === actorId;
  const context = buildLiveContext(allLive, actorId);
  const score = scoreDVForContext(dv, context).score;
  if (direct && score >= 100) return mode === "soft" ? "RESONANCE" : "PUSH";
  const threshold = mode === "now" ? 45 : mode === "normal" ? 70 : 95;
  if (score >= threshold + 35) return mode === "soft" ? "RESONANCE" : "PUSH";
  if (score >= threshold) return "RESONANCE";
  return score >= 18 ? "SILENT_FEED" : "IGNORE";
}

export function activeFrequencyReferenceIds(all: any[], actorId: string): Set<string> {
  const latest = new Map<string, any>();
  for (const dv of all) {
    if (!String(dv?.kind || "").startsWith("frequency.")) continue;
    if (text(dv?.attrs?.actorId) !== actorId) continue;
    const id = text(dv?.attrs?.frequencyId);
    if (!id) continue;
    const current = latest.get(id);
    if (!current || Number(dv?.attrs?.sequence || 0) > Number(current?.attrs?.sequence || 0)) latest.set(id, dv);
  }
  return new Set(Array.from(latest.values())
    .filter((event) => event?.attrs?.status === "active")
    .map((event) => text(event?.attrs?.reference?.id))
    .filter(Boolean));
}

export function relatesToActiveFrequency(dv: any, references: Set<string>, actorId: string): boolean {
  if (text(dv?.attrs?.targetActorId, dv?.attrs?.toActorId) === actorId) return true;
  const ids = [dv?.attrs?.intentRef?.id, dv?.attrs?.reference?.id, dv?.attrs?.rootId, dv?.meta?.respondsTo]
    .map((value) => text(value)).filter(Boolean);
  return ids.some((id) => references.has(id));
}

export function evaluateFrequencyAttention(items: any[], all: any[], actorId: string, mode: FrequencyMode) {
  const references = activeFrequencyReferenceIds(all, actorId);
  return items
    .filter((dv) => relatesToActiveFrequency(dv, references, actorId))
    .map((dv) => ({ dv, outcome: attentionForDV(dv, all, actorId, mode) }))
    .filter((decision) => decision.outcome !== "IGNORE");
}

function applyAttentionBudget(decisions: Array<{ dv: any; outcome: AttentionOutcome }>, mode: FrequencyMode) {
  const now = Date.now();
  const state = read<{ windowStartedAt: number; pushes: number }>(BUDGET_KEY, { windowStartedAt: now, pushes: 0 });
  const windowMs = mode === "now" ? 60 * 60_000 : 4 * 60 * 60_000;
  if (now - state.windowStartedAt >= windowMs) { state.windowStartedAt = now; state.pushes = 0; }
  const allowance = mode === "now" ? 3 : mode === "normal" ? 1 : 0;
  let resonances = 0;
  const limited = decisions.map((decision) => {
    let outcome = decision.outcome;
    if (outcome === "PUSH" && state.pushes >= allowance) outcome = "RESONANCE";
    if (outcome === "PUSH") state.pushes += 1;
    if (outcome === "RESONANCE" || outcome === "PUSH") {
      resonances += 1;
      if (resonances > 3) outcome = "SILENT_FEED";
    }
    return { ...decision, outcome };
  });
  write(BUDGET_KEY, state);
  return { decisions: limited, summary: resonances > 1 ? `Hay ${resonances} cosas que resuenan con vos.` : "" };
}

export function startFrequencyEngine(): () => void {
  if (!MARKET_RUNTIME_FLAGS.frequency || typeof window === "undefined") return () => {};
  let initialized = false;
  let previous = new Map<string, string>();
  return mtLiveSubscribe((all) => {
    const prefs = frequencyPreferences();
    const references = activeFrequencyReferenceIds(all, prefs.actorId);
    const seen = read<Record<string, number>>(SEEN_KEY, {});
    const next = new Map<string, string>();
    const decisions: Array<{ dv: any; outcome: AttentionOutcome }> = [];
    let seenChanged = false;
    for (const dv of all) {
      const revision = `${dv?.meta?.revision ?? dv?.meta?.version ?? ""}|${dv?.meta?.updatedAt ?? dv?.meta?.ts ?? ""}`;
      next.set(String(dv.id), revision);
      if (!initialized || previous.get(String(dv.id)) === revision || seen[`${dv.id}|${revision}`]) continue;
      if (!relatesToActiveFrequency(dv, references, prefs.actorId)) continue;
      const outcome = attentionForDV(dv, all, prefs.actorId, prefs.mode);
      seen[`${dv.id}|${revision}`] = Date.now();
      seenChanged = true;
      if (outcome !== "IGNORE") decisions.push({ dv, outcome });
    }
    initialized = true;
    previous = next;
    if (seenChanged) {
      const compact = Object.fromEntries(Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 1000));
      write(SEEN_KEY, compact);
    }
    if (decisions.length) window.dispatchEvent(new CustomEvent("utopy:frequency:attention", { detail: applyAttentionBudget(decisions, prefs.mode) }));
  });
}
