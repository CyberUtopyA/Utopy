// ============================================
// FILE: src/work/work.builders.ts
// Builders DV para work.cell / work.intent / work.plan
// ============================================

import type { WorkCell, WorkIntent, WorkPlan } from "./work.schema";


function newId(prefix = "dv:work:") {
  return `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function buildWorkCellDV(cell: WorkCell) {
  return {
    id: newId("work.cell:"),
    kind: "work.cell",
    attrs: cell,
    traits: [
      "work:cell",
      `work:kind:${cell.kind}`,
      ...cell.domains.map((d) => `work:domain:${d}`),
    ],
    meta: {
      ns: "work:cell",
      ts: nowIso(),
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 30,
      source: cell.meta?.source || "work.builders",
    },
  };
}

export function buildWorkIntentDV(intent: WorkIntent) {
  return {
    id: newId("work.intent:"),
    kind: "work.intent",
    attrs: intent,
    traits: [
      "work:intent",
      `work:domain:${intent.domain}`,
      `work:status:${intent.status}`,
      ...intent.requestedCapabilities.map((c) => `work:req:${c}`),
    ],
    meta: {
      ns: "work:intent",
      ts: nowIso(),
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 7,
      source: "work.builders",
    },
  };
}

export function buildWorkPlanDV(plan: WorkPlan) {
  return {
    id: newId("work.plan:"),
    kind: "work.plan",
    attrs: plan,
    traits: [
      "work:plan",
      `work:domain:${plan.domain}`,
      `work:status:${plan.status}`,
      ...plan.steps.map((s) => `work:step:${s.kind}`),
    ],
    meta: {
      ns: "work:plan",
      ts: nowIso(),
      scopes: ["public"],
      ttl_ms: 1000 * 60 * 60 * 24 * 30,
      source: "work.builders",
    },
  };
}