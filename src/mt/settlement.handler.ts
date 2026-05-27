// src/mt/settlement.handler.ts
// Settlement / Cajero Automático (UTOPY)
// - escucha intents "market.order.create" (o DV kind "market.order")
// - decide si paga directo o manda a cajero/negociación
// - publica: payment.intent + payment.receipt
// - (opcional) emite sem.dv.outcome (si tu spore soporta outcome)

// ⚠️ Este archivo NO toca UI. Es puro “nodo”.
// Lo podés usar desde donde conectás el spore / escuchás intents.

import { spore } from "../utopy/spore.singleton";
import type { DatoVivo, MtProduct } from "./mt.traitAdapter";

// Si tenés un fetch al Micelio para traer product por id, enchufalo acá.
// Por ahora: intent trae product opcional, o fallback a “no directo”.
type MarketOrderCreate = {
  sym?: string;
  say: "market.order.create";
  with: {
    orderId?: string;
    productId: string;
    qty: number;
    price: number;
    buyer?: { id: string; name?: string };
    // 👇 si el checkout ya mandó payment elegido
    payment?: any;
    // 👇 opcional: mandar product completo en intent para evitar fetch
    product?: MtProduct;
    meta?: any;
  };
};

type PaymentIntentDV = {
  id: string;
  kind: "payment.intent";
  traits: string[];
  attrs: {
    orderId: string;
    rail: string; // "evm:bsc"
    amount: string;
    currency?: string; // "BNB"/"USDT"/"PYG"...
    recipient: string; // "evm:0x..."
    split?: { to: string; bps: number }[];
    escrow?: "none" | "delivery" | "multisig";
    expiresAt?: string;
  };
  meta?: any;
};

type PaymentReceiptDV = {
  id: string;
  kind: "payment.receipt";
  traits: string[];
  attrs: {
    orderId: string;
    rail: string;
    txHash?: string;
    amount: string;
    recipient: string;
    status: "paid" | "failed" | "pending";
    ts: string;
  };
  meta?: any;
};

const uid = (p = "dv:") =>
  `${p}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return undefined;
  }
}

function clamp01(n: any) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function sumBps(split?: { to: string; bps: number }[]) {
  return (split || []).reduce((a, s) => a + (Number(s?.bps) || 0), 0);
}

// ✅ Reglas de decisión “UTOPY”
function chooseMode(product: MtProduct | undefined, paymentFromCheckout: any) {
  const payMeta = (product?.meta as any)?.pay || {};
  const mode = paymentFromCheckout?.type || payMeta?.mode || "cajero"; // cajero/direct/hybrid/crypto
  const negotiate = paymentFromCheckout?.negotiate ?? payMeta?.negotiate ?? true;

  // “crypto” es un modo de checkout (wallet del comprador). Settlement no lo hace.
  if (mode === "crypto") return { mode: "crypto", negotiate };

  // direct/hybrid/cajero
  const m = mode === "direct" || mode === "hybrid" ? mode : "cajero";
  return { mode: m, negotiate: !!negotiate };
}

// ✅ valida recipient + split
function validateDirectPay(product: MtProduct | undefined, paymentFromCheckout: any) {
  const payMeta = (product?.meta as any)?.pay || {};
  const recipient = paymentFromCheckout?.recipient || payMeta?.recipient;
  const split = paymentFromCheckout?.split || payMeta?.split;
  const escrow = paymentFromCheckout?.escrow || payMeta?.escrow || "none";

  if (!recipient || typeof recipient !== "string") return { ok: false, reason: "Sin recipient" };

  if (split && Array.isArray(split)) {
    const s = sumBps(split);
    // permitimos <= 10000; si es menor, el resto va al recipient
    if (s > 10000) return { ok: false, reason: "Split > 100%" };
  }

  return { ok: true, recipient, split, escrow };
}

// ✅ “trust/consenso” simple: si hay conflicto semántico fuerte, evitamos directo.
// (si tu adapter ya mete meta.sem.conflict al producto, úsalo)
function safeToAutoSettle(product?: MtProduct) {
  const sem = (product?.meta as any)?.sem;
  if (sem?.conflict) return { ok: false, reason: "Conflicto semántico" };

  // si querés, podés exigir score mínimo:
  // const score = sem?.chosen?.score ?? 0;
  // if (score < 0.55) return { ok: false, reason: "Score bajo" };

  return { ok: true };
}

/**
 * 🔌 Hook principal:
 * Llamalo una vez al arrancar tu app/nodo web (cuando spore esté listo).
 *
 * Ejemplo:
 *   import { startSettlementHandlers } from "./mt/settlement.handler";
 *   startSettlementHandlers();
 */
export function startSettlementHandlers() {
  if (!spore) {
    console.warn("[settlement] spore no disponible");
    return () => {};
  }

  // 1) Listener: intent market.order.create
  const off = spore.on?.("intent", async (msg: any) => {
    const say = msg?.payload?.say ?? msg?.say;
    if (say !== "market.order.create") return;

    const payload = (msg?.payload || msg) as MarketOrderCreate;
    const w = payload?.with;
    if (!w?.productId) return;

    try {
      await handleMarketOrderCreate(payload);
    } catch (e) {
      console.error("[settlement] handle error:", e);
    }
  });

  // 2) opcional: también escuchar DV kind "market.order" si te llega así
  const offDv = spore.on?.("dv", async (dv: any) => {
    if (dv?.kind !== "market.order") return;
    try {
      await handleMarketOrderDV(dv);
    } catch (e) {
      console.error("[settlement] dv handle error:", e);
    }
  });

  return () => {
    try { off?.(); } catch {}
    try { offDv?.(); } catch {}
  };
}

async function handleMarketOrderCreate(intent: MarketOrderCreate) {
  const w = intent.with;

  const orderId = w.orderId || uid("order:");
  const qty = Number(w.qty || 0);
  const unitPrice = Number(w.price || 0);
  const amount = String(Math.max(0, qty * unitPrice));

  // product (ideal) o undefined
  const product = w.product;

  const decision = chooseMode(product, w.payment);
  const safety = safeToAutoSettle(product);

  // Si es crypto: el comprador paga con wallet, acá no hacemos settlement.
  if (decision.mode === "crypto") {
    console.log("[settlement] crypto checkout, no auto-pay");
    return;
  }

  // Si negociación activa o hay conflicto semántico → cajero/humano
  if (decision.negotiate || !safety.ok) {
    console.log("[settlement] requiere cajero/negociación:", safety.reason || "negotiate");
    // Podés emitir una “task” al cajero:
    await spore.sayIntent?.({
      sym: "🧾",
      say: "cajero.task.create",
      with: {
        orderId,
        productId: w.productId,
        qty,
        unitPrice,
        amount,
        reason: safety.ok ? "negotiate" : safety.reason,
      },
    });
    return;
  }

  // Direct o Hybrid: intentamos pago directo si hay recipient válido
  if (decision.mode === "direct" || decision.mode === "hybrid") {
    const v = validateDirectPay(product, w.payment);
    if (!v.ok) {
      console.log("[settlement] no direct:", v.reason, "→ cajero");
      await spore.sayIntent?.({
        sym: "🧾",
        say: "cajero.task.create",
        with: { orderId, amount, reason: v.reason },
      });
      return;
    }

    // ✅ Publicar payment.intent
    const payIntent: PaymentIntentDV = {
      id: uid("pay:intent:"),
      kind: "payment.intent",
      traits: ["mt:settlement", "mt:payment"],
      attrs: {
        orderId,
        rail: "evm:bsc",
        amount,
        currency: w.payment?.symbol || (product?.meta as any)?.token?.symbol || "BNB",
        recipient: v.recipient!,
        split: v.split,
        escrow: v.escrow,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      meta: {
        ns: "mt:settlement",
        ts: nowIso(),
      },
    };

    await publishDV(payIntent);

    // ✅ Ejecutar pago (stub: enchufá tu signer/relayer/escrow)
    // IMPORTANT: sin pasarela centralizada = puede ser:
    // - “relayer comunitario” (nodo) que firma y paga
    // - escrow/multisig que libera con confirmación de entrega
    const receipt = await performDirectPayment(payIntent);

    await publishDV(receipt);

    // (opcional) outcome hacia la red
    await spore.sayIntent?.({
      sym: "✅",
      say: "sem.dv.outcome",
      with: {
        target: { kind: "market.order", id: orderId },
        outcome: receipt.attrs.status === "paid" ? "paid" : "failed",
        effects: { receiptId: receipt.id },
        confidence: receipt.attrs.status === "paid" ? 0.85 : 0.4,
      },
    });

    return;
  }

  // Fallback: cajero
  await spore.sayIntent?.({
    sym: "🧾",
    say: "cajero.task.create",
    with: { orderId, amount, reason: "mode=cajero" },
  });
}

async function handleMarketOrderDV(dv: any) {
  // Si te llegan orders como DV directos, los convertís a forma intent
  const attrs = dv?.attrs || {};
  const orderId = dv.id || uid("order:");
  const productId = String(attrs.productId || attrs.productoId || "");
  const qty = Number(attrs.qty || attrs.cantidad || 0);
  const price = Number(attrs.unitPrice || attrs.price || 0);
  const payment = attrs.payment;

  if (!productId) return;

  await handleMarketOrderCreate({
    say: "market.order.create",
    with: { orderId, productId, qty, price, payment },
  });
}

// ---- publicación DV (usa sayIntent dv.upsert o tu publishDatoVivo si querés)
async function publishDV(dv: any) {
  // 1) intent estándar (compat con tu seed)
  await spore.sayIntent?.({
    sym: "🌱",
    say: "dv.upsert",
    with: { dv },
  });
}

// ---- Stub pago directo (enchufable)
async function performDirectPayment(pi: PaymentIntentDV): Promise<PaymentReceiptDV> {
  // Acá va tu implementación real.
  // Por ahora: simulación “paid” sin txHash.
  const ok = true;

  return {
    id: uid("pay:receipt:"),
    kind: "payment.receipt",
    traits: ["mt:settlement", "mt:payment"],
    attrs: {
      orderId: pi.attrs.orderId,
      rail: pi.attrs.rail,
      amount: pi.attrs.amount,
      recipient: pi.attrs.recipient,
      status: ok ? "paid" : "failed",
      ts: nowIso() || new Date().toISOString(),
      txHash: ok ? "0xSIMULATED" : undefined,
    },
    meta: {
      ns: "mt:settlement",
      ts: nowIso(),
      from: "settlement.node",
    },
  };
}
