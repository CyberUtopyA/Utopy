import { buildLiquidityTrustDV } from "../liquidity/mt.liquidity";
import {
  buildBenefitAcceptanceDV,
  buildBenefitProgramDV,
  buildValueRightDV,
  buildValueStampDV,
  vaultIdPart,
} from "./vault.builders";
import { nextRightSource, projectLivingVault } from "./vault.engine";
import type { LivingVaultDV } from "./vault.types";

export const LAPIEDRA_DEMO_PROGRAM_ID = "lapiedra-mi-valor-prueba-5";
const LAPIEDRA_NODE_ID = "utopy.node.lapiedra.coffee";
const LAPIEDRA_SELLER_ID = "lapiedra-coffee";

export function buildLaPiedraVaultDemoSeedDVs() {
  const program = buildBenefitProgramDV({
    programId: LAPIEDRA_DEMO_PROGRAM_ID,
    issuerNodeId: LAPIEDRA_SELLER_ID,
    issuerName: "LaPiedra Coffee",
    family: "hospitality.coffee",
    title: "Pasaporte de prueba · 5 sellos",
    description:
      "Prueba aislada de Mi valor. No cambia el programa real de fidelidad de LaPiedra.",
    stampsRequired: 5,
    benefitTitle: "Beneficio LaPiedra disponible",
    benefitDescription:
      "El nodo confirma el beneficio al usarlo. No es dinero ni se transfiere.",
    simulation: true,
  });
  const acceptance = buildBenefitAcceptanceDV({
    acceptanceId: "lapiedra-own-demo-benefit",
    nodeId: LAPIEDRA_NODE_ID,
    nodeName: "LaPiedra Coffee",
    acceptedProgramIds: [LAPIEDRA_DEMO_PROGRAM_ID],
    simulation: true,
  });
  return { program, acceptance, dvs: [program, acceptance] };
}

function demoReceipts(allLive: LivingVaultDV[], actorId: string) {
  return (Array.isArray(allLive) ? allLive : []).filter(
    (dv) =>
      dv?.kind === "pay.receipt" &&
      dv?.meta?.source === "utopy.vault.demo.lapiedra" &&
      String(dv?.attrs?.buyerId || "") === String(actorId),
  );
}

export function buildSimulatedLaPiedraPurchaseDVs(input: {
  actorId: string;
  actorName?: string;
  allLive?: LivingVaultDV[];
}) {
  const all = Array.isArray(input.allLive) ? input.allLive : [];
  const { program, acceptance } = buildLaPiedraVaultDemoSeedDVs();
  const sequence = demoReceipts(all, input.actorId).length + 1;
  const actorKey = vaultIdPart(input.actorId, "actor");
  const sessionId = `pay.session:demo:lapiedra:${actorKey}:${sequence}`;
  const receiptId = `pay.receipt:demo:lapiedra:${actorKey}:${sequence}`;
  const ts = new Date().toISOString();
  const receipt: LivingVaultDV = {
    id: receiptId,
    kind: "pay.receipt",
    attrs: {
      receiptId,
      sessionId,
      orderId: `order:demo:lapiedra:${actorKey}:${sequence}`,
      threadId: `thread:demo:lapiedra:${actorKey}`,
      amount: 29,
      currency: "BRL",
      routeId: "route:simulation",
      routeKind: "external",
      state: "settled",
      buyerId: input.actorId,
      sellerId: LAPIEDRA_SELLER_ID,
      sellerNodeId: LAPIEDRA_NODE_ID,
      concept: "Compra simulada LaPiedra",
      settledAt: ts,
      custody: "simulation_only",
      refundEligible: true,
      simulation: true,
      nonTradable: true,
    },
    traits: [
      "utopy:pay",
      "pay:receipt",
      "pay:settled",
      "escudo:verified",
      "simulation:only",
    ],
    labels: ["Compra simulada LaPiedra"],
    meta: {
      ns: "mt:market",
      scopes: ["private:participants", `actor:${input.actorId}`],
      ts,
      updatedAt: ts,
      version: 1,
      source: "utopy.vault.demo.lapiedra",
      authority: LAPIEDRA_SELLER_ID,
      originNode: LAPIEDRA_NODE_ID,
      threadId: `thread:demo:lapiedra:${actorKey}`,
    },
  };
  const trustBase = buildLiquidityTrustDV({
    actorId: LAPIEDRA_SELLER_ID,
    actorName: "LaPiedra Coffee",
    trustForId: input.actorId,
    trustForName: input.actorName || input.actorId,
    scoreDelta: 0.02,
    reason: "payment.completed.simulation",
    basedOnKind: "pay.receipt",
    basedOnId: receiptId,
    orderId: receipt.attrs?.orderId,
    sessionId,
    threadId: receipt.attrs?.threadId,
    evidence: [receiptId],
  });
  const trust: LivingVaultDV = {
    ...trustBase,
    id: `liq.trust:demo:lapiedra:${actorKey}:${sequence}`,
    attrs: {
      ...(trustBase.attrs || {}),
      simulation: true,
      nonTradable: true,
    },
    meta: {
      ...(trustBase.meta || {}),
      ns: "mt:market",
      scopes: ["private:participants", `actor:${input.actorId}`],
      ts,
      source: "utopy.vault.demo.lapiedra",
      authority: LAPIEDRA_SELLER_ID,
      originNode: LAPIEDRA_NODE_ID,
      respondsTo: receiptId,
    },
  };
  const stamp = buildValueStampDV({
    program,
    receipt,
    actorId: input.actorId,
    actorName: input.actorName,
  });
  const seeds = [program, acceptance].filter(
    (dv) => !all.some((current) => current?.id === dv.id),
  );
  return {
    program,
    acceptance,
    receipt,
    trust,
    stamp,
    dvs: [...seeds, receipt, trust, stamp],
  };
}

export function buildSimulatedLaPiedraCycleDVs(input: {
  actorId: string;
  actorName?: string;
  allLive?: LivingVaultDV[];
  purchases?: number;
}) {
  const pending: LivingVaultDV[] = [];
  let working = [...(input.allLive || [])];
  const before = projectLivingVault(working, input.actorId);
  const existingRight = before.rights.find(
    (item) =>
      item?.dv?.attrs?.programId === LAPIEDRA_DEMO_PROGRAM_ID,
  );
  if (existingRight) {
    return { dvs: pending, allLive: working, right: existingRight.dv };
  }
  const progress = before.progress.find(
    (item) =>
      item?.program?.attrs?.programId === LAPIEDRA_DEMO_PROGRAM_ID,
  );
  const target = Math.max(1, Math.min(5, Number(input.purchases || 5)));
  const missing = Math.max(
    0,
    target - Number(progress?.availableStamps.length || 0),
  );
  for (let index = 0; index < missing; index += 1) {
    const purchase = buildSimulatedLaPiedraPurchaseDVs({
      actorId: input.actorId,
      actorName: input.actorName,
      allLive: working,
    });
    for (const dv of purchase.dvs) {
      if (!working.some((current) => current?.id === dv.id)) {
        working.push(dv);
        pending.push(dv);
      }
    }
  }
  const source = nextRightSource(
    working,
    input.actorId,
    LAPIEDRA_DEMO_PROGRAM_ID,
  );
  let right: LivingVaultDV | null = null;
  if (source) {
    right = buildValueRightDV({
      program: source.program,
      actorId: input.actorId,
      actorName: input.actorName,
      sourceStamps: source.stamps,
    });
    if (!working.some((current) => current?.id === right?.id)) {
      working.push(right);
      pending.push(right);
    }
  }
  return { dvs: pending, allLive: working, right };
}
