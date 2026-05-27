import { spore } from "../utopy/spore.singleton";
import { mtLiveUpsert } from "./mt.liveStore";

export type DeliveryRole = "buyer" | "seller" | "cajero";

export async function emitDeliveryConfirm(params: {
  orderId: string;
  role: DeliveryRole;
  ok: boolean;
  actorId?: string;
  actorName?: string;
  deliverToken?: string;
  note?: string;
}) {
  const { orderId, role, ok, actorId, actorName, deliverToken, note } = params;

  // ✅ IMPORTANTE: usar el kind que tus paneles ya consumen
  const dv = {
    id: `market.order.event:${orderId}:${role}:${Date.now()}`,
    kind: "market.order.event",
    attrs: {
      orderId,
      role,
      ok,
      actorId: actorId ?? null,
      actorName: actorName ?? null,
      deliverToken: deliverToken ?? null,
      note: note ?? null,
      ts: new Date().toISOString(),
    },
    traits: [
      "mt:event",
      ok ? "mt:ok" : "mt:nok",
      `mt:role.${role}`,
      "mt:order.event",
    ],
    meta: {
      ns: "mt:market",
      ts: new Date().toISOString(),
      actor: actorId ?? role,
      source: "ms.web.deliveryconfirm",
    },
  };

  // 1) enviar a la red UTOPY
  try {
    await spore?.sayIntent({
      sym: "📦",
      // ✅ también conviene mantener un say estándar que el seed ya acepte
      // si tu red ya usa "dato.upsert", podés cambiar SOLO esta línea a "dato.upsert"
      say: "market.order.event",
      with: dv,
    });
  } catch {}

  // 2) actualizar local inmediato (UI instantánea)
  mtLiveUpsert(dv as any);

  return dv;
}