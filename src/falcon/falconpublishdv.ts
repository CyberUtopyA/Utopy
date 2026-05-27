
import type { FalconStoreItem } from "../types/falcon.store";
import { falconLiveUpsert } from "./falconlive";

const MICELIO_HTTP =
  (import.meta as any)?.env?.VITE_MICELIO_HTTP ||
  "https://seed.mterra.space/micelio";

function uid(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function tryPostMicelio(dv: any) {
  try {
    await fetch(`${String(MICELIO_HTTP).replace(/\/$/, "")}/dv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dv),
    });
  } catch (err) {
    console.warn("[FalconPublisher] No se pudo publicar DV en Micelio", err);
  }
}

async function publishDV(dv: any) {
  try {
    falconLiveUpsert(dv);
  } catch (err) {
    console.warn("[FalconPublisher] falconLiveUpsert falló", err);
  }

  try {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail: {
          say: "dv.upsert",
          dv,
        },
      })
    );
  } catch (err) {
    console.warn("[FalconPublisher] utopy.emit falló", err);
  }

  await tryPostMicelio(dv);
}

export async function publishFalconConsultDV(
  item: FalconStoreItem,
  input: {
    name: string;
    phone: string;
    message: string;
  }
) {
  const dv = {
    id: uid("falcon.consult"),
    kind: "trade.intent.consult",
    attrs: {
      productId: item.id,
      title: item.title,
      name: input.name,
      phone: input.phone,
      message: input.message,
      sellerId: item.sellerId || null,
      sellerName: item.sellerName || null,
      sourceNode: "falcon",
      image: item.image || null,
      category: item.category || null,
      currency: item.currency || "PYG",
    },
    traits: ["trade:consult", "falcon:lead", "mt:market"],
    meta: {
      ns: "mt:market",
      scopes: ["public"],
      ts: new Date().toISOString(),
      source: "falcon.consult.modal",
    },
  };

  await publishDV(dv);
  return dv;
}

export async function publishFalconBuyIntentDV(
  item: FalconStoreItem,
  input: {
    buyerName: string;
    buyerPhone: string;
    qty: number;
  }
) {
  const dv = {
    id: uid("falcon.buy.intent"),
    kind: "trade.intent.buy",
    attrs: {
      productId: item.id,
      title: item.title,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      qty: Math.max(1, Number(input.qty || 1)),
      price: item.price ?? null,
      currency: item.currency || "PYG",
      sellerId: item.sellerId || null,
      sellerName: item.sellerName || null,
      sourceNode: "falcon",
      image: item.image || null,
      category: item.category || null,
    },
    traits: ["trade:buy", "falcon:checkout", "mt:market"],
    meta: {
      ns: "mt:market",
      scopes: ["public"],
      ts: new Date().toISOString(),
      source: "falcon.buy.intent",
    },
  };

  await publishDV(dv);
  return dv;
}