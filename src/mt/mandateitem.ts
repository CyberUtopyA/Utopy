// src/mt/mt.mandateIntent.ts
import { spore } from "../utopy/spore.singleton";
import { mtLiveUpsert } from "./mt.liveStore";

export type MandateInterval = "daily" | "weekly" | "monthly" | "yearly";

export type MandateCreateDV = {
  id: string;
  kind: "payment.mandate.create";
  traits: string[];
  attrs: {
    ns?: string | null;

    sellerId: string;
    sellerName?: string | null;

    buyerId: string;
    buyerName?: string | null;

    // reglas
    interval: MandateInterval;
    every: number;          // cada 1 mes, cada 2 semanas, etc.
    amountMax: number;      // monto máximo permitido por periodo
    currency?: string | null;

    // opcional: asociar a producto/servicio
    productId?: string | null;

    note?: string | null;

    // estado inicial
    active: boolean;
  };
  meta: { ns: string; ts: string; actor?: string; source?: string };
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export async function emitMandateCreate(params: {
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName?: string;

  amountMax: number;
  currency?: string;

  interval: MandateInterval;
  every: number;

  productId?: any;
  ns?: string;
  note?: string;
  source?: string;
}) {
  const ns = params.ns ?? "mt:market";

  const dv: MandateCreateDV = {
    id: `payment.mandate:${params.buyerId}:${params.sellerId}:${uid()}`,
    kind: "payment.mandate.create",
    traits: ["mt:payment.mandate", "mt:market"],
    attrs: {
      ns,
      sellerId: String(params.sellerId),
      sellerName: params.sellerName ?? null,

      buyerId: String(params.buyerId),
      buyerName: params.buyerName ?? null,

      amountMax: Number(params.amountMax || 0),
      currency: params.currency ?? "PYG",

      interval: params.interval,
      every: Math.max(1, Number(params.every || 1)),

      productId: params.productId != null ? String(params.productId) : null,
      note: params.note ?? null,

      active: true,
    },
    meta: { ns, ts: new Date().toISOString(), actor: params.buyerId, source: params.source ?? "ms.web.checkout.mandate" },
  };

  // local
  mtLiveUpsert(dv as any);

  // red / persistencia (mismo patrón que tu offer)
  try {
    await spore?.sayIntent({
      sym: "🧬",
      say: "dato.upsert",
      with: { dv },
    });
  } catch {}

  // señal opcional
  try {
    await spore?.sayIntent({
      sym: "🔁",
      say: "payment.mandate.create",
      with: dv,
    });
  } catch {}

  return dv;
}