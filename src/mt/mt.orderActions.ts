// src/mt/mt.orderActions.ts
import type { MtProduct } from "./mt.traitAdapter";
import { publishDatoVivo } from "./seedbus";
import { mtLiveUpsert } from "./mt.liveStore";
import { spore } from "../utopy/spore.singleton";

type LockPayload = {
  orderId: string;
  amount: number;
  currency: { type: "fiat" | "crypto"; symbol?: string; chain?: string; token?: any };
  buyerId: string;
  sellerId?: string;
  cajeroId?: string | null;
  meta?: any;
};

const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export async function createOrderAndLock(args: {
  product: MtProduct;
  qty: number;
  unitPrice: number;
  buyerId: string;
  cajeroId?: string | null;
  payMethod: "cajero" | "crypto";
}) {
  const orderId = createId("mt:order:");
  const total = Math.max(1, args.qty) * Number(args.unitPrice || 0);

  // 1) Intent (ya lo tenías) — sirve para UX y nodos
  await spore?.sayIntent({
    sym: "🛒",
    say: "market.order.create",
    with: {
      orderId,
      productId: args.product.id,
      qty: args.qty,
      price: args.unitPrice,
      total,
      buyer: { id: args.buyerId },
      payment:
        args.payMethod === "cajero"
          ? { type: "cajero", cajeroId: args.cajeroId ?? null }
          : { type: "crypto", chain: "bsc", token: args.product.meta?.token ?? null },
      meta: { ns: args.product.meta?.ns },
    },
  });

  // 2) DV "market.order" (verdad viva)
  const orderDV = {
    id: orderId,
    kind: "market.order",
    traits: ["mt:order", "mt:escrow"],
    attrs: {
      orderId,
      productId: args.product.id,
      qty: args.qty,
      unitPrice: args.unitPrice,
      total,
      buyerId: args.buyerId,
      sellerId: args.product.productor?.id,
      cajeroId: args.cajeroId ?? null,
      territoryId: args.product.meta?.territorioId ?? args.product.meta?.territoryId ?? undefined,
    },
    meta: {
      ns: args.product.meta?.ns ?? "mt:market",
      ts: new Date().toISOString(),
    },
  };

  mtLiveUpsert(orderDV as any);
  try {
    await publishDatoVivo(orderDV as any);
  } catch {}

  // 3) DV "payment.lock" (bloqueo lógico; el settlement node lo ejecuta si aplica)
  const lock: LockPayload = {
    orderId,
    amount: total,
    currency:
      args.payMethod === "cajero"
        ? { type: "fiat", symbol: "PYG" }
        : { type: "crypto", chain: "bsc", symbol: args.product.meta?.token?.symbol ?? "BNB", token: args.product.meta?.token ?? null },
    buyerId: args.buyerId,
    sellerId: args.product.productor?.id,
    cajeroId: args.cajeroId ?? null,
    meta: { ns: args.product.meta?.ns },
  };

  const lockDV = {
    id: createId("mt:lock:"),
    kind: "payment.lock",
    traits: ["mt:escrow.lock", "mt:order"],
    attrs: lock,
    meta: {
      ns: args.product.meta?.ns ?? "mt:market",
      ts: new Date().toISOString(),
    },
  };

  mtLiveUpsert(lockDV as any);
  try {
    await publishDatoVivo(lockDV as any);
  } catch {}

  // 4) Intent “escrow.lock” (opcional, útil para settlement node)
  await spore?.sayIntent({
    sym: "🔒",
    say: "mt.escrow.lock",
    with: lock,
  });

  return { orderId };
}