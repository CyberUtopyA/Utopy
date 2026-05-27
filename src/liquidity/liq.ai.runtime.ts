import type { DVLike } from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";
import { emitTrustSignal } from "./mt.trust.engine";
import { emitFiscalDocument } from "./liq.fiscal.bridge";

const now = () => Date.now();
const id = (p: string) => `${p}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
const num = (v: any, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;

let booted = false;
const seen = new Set<string>();

function buildAiDecisionDV(input: {
  decision: "issue" | "lock" | "release" | "refund" | "credit.line" | "alert" | "fiscal";
  confidence?: number;
  reason: string;
  source: DVLike;
  effects?: Record<string, any>;
}) {
  return {
    id: id("liq.ai.decision"),
    kind: "liq.ai.decision",
    ts: now(),
    traits: ["mt:liquidity", "mt:ai", "mt:economic.engine"],
    labels: ["Decisión económica IA"],
    meta: {
      ns: "mt:liquidity",
      scopes: input.source.meta?.scopes || ["public"],
      schema: "utopy.liq.ai.decision.v1",
      by: "liq.ai.runtime",
    },
    attrs: {
      decision: input.decision,
      confidence: num(input.confidence, 0.7),
      reason: input.reason,
      source: {
        kind: input.source.kind,
        id: input.source.id,
      },
      effects: input.effects || {},
    },
  } satisfies DVLike;
}

export function ingestEconomicDV(dv: DVLike | null | undefined) {
  if (!dv?.id || seen.has(dv.id)) return;
  seen.add(dv.id);

  const a = dv.attrs || {};

  if (dv.kind === "payment.session.status") {
    const status = String(a.status || "").toLowerCase();

    if (["paid", "accepted", "settled", "confirmed"].includes(status)) {
      emitTrustSignal({
        actorId: a.sellerId || a.assignment?.sellerId || "seller:unknown",
        targetId: a.buyerId || a.assignment?.buyerId,
        signalType: "payment.completed",
        weight: 0.75,
        reason: "Pago completado",
        sourceKind: dv.kind,
        sourceId: dv.id,
        threadId: a.threadId,
        orderId: a.orderId,
      });

      emitFiscalDocument({
        docType: "receipt",
        actorId: a.sellerId || "seller:unknown",
        sellerId: a.sellerId,
        buyerId: a.buyerId,
        amount: num(a.amount),
        currency: a.currency || "PYG",
        legalStatus: "draft",
        orderId: a.orderId,
        sessionId: a.sessionId,
        threadId: a.threadId,
        reason: "Pago confirmado, recibo fiscal borrador",
      });

      emitUtopyDV(
        buildAiDecisionDV({
          decision: "fiscal",
          confidence: 0.78,
          reason: "Pago aceptado: crear documento fiscal y actualizar trust",
          source: dv,
        }),
        "mt"
      );
    }

    if (["failed", "rejected", "disputed"].includes(status)) {
      emitTrustSignal({
        actorId: a.sellerId || a.buyerId || "actor:unknown",
        targetId: a.buyerId,
        signalType: "payment.failed",
        weight: 0.8,
        reason: "Pago fallido o disputado",
        sourceKind: dv.kind,
        sourceId: dv.id,
        threadId: a.threadId,
        orderId: a.orderId,
      });

      emitUtopyDV(
        buildAiDecisionDV({
          decision: "alert",
          confidence: 0.82,
          reason: "Pago fallido/disputado: elevar alerta de riesgo",
          source: dv,
        }),
        "mt"
      );
    }
  }

  if (dv.kind === "mt.fulfillment" || dv.kind === "work.outcome") {
    const ok = String(a.status || a.result || "").toLowerCase();
    const fulfilled = ["done", "fulfilled", "completed", "ok", "success"].includes(ok);

    emitTrustSignal({
      actorId: a.sellerId || a.workerId || a.actorId || "actor:unknown",
      targetId: a.buyerId || a.clientId,
      signalType: fulfilled ? "work.fulfilled" : "work.disputed",
      weight: fulfilled ? 0.9 : 0.85,
      reason: fulfilled ? "Trabajo cumplido" : "Trabajo con disputa",
      sourceKind: dv.kind,
      sourceId: dv.id,
      threadId: a.threadId,
      orderId: a.orderId,
    });

    emitUtopyDV(
      buildAiDecisionDV({
        decision: fulfilled ? "release" : "alert",
        confidence: fulfilled ? 0.84 : 0.78,
        reason: fulfilled ? "Fulfillment correcto: sugerir liberar escrow" : "Fulfillment problemático",
        source: dv,
      }),
      "mt"
    );
  }
}

export function bootLiqAiRuntime() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const listener = (ev: Event) => {
    const e = ev as CustomEvent<any>;
    const dv = e.detail?.dv || e.detail?.payload || e.detail?.detail?.payload;
    ingestEconomicDV(dv);
  };

  window.addEventListener("mt:dv", listener as EventListener);
  window.addEventListener("utopy:dv", listener as EventListener);
  window.addEventListener("utopy.incoming", listener as EventListener);
}