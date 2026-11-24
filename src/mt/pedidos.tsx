import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import type { MtCajero } from "./mt.cajeroAdapter";
import type { DatoVivo } from "./mt.traitAdapter";
import { mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";
import { emitDeliveryConfirm } from "./deliveryconfirm";
import { spore } from "../utopy/spore.singleton";

const Box = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 12px;
  background: #fff;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.9rem;
`;

const Btn = styled.button<{ tone?: "ok" | "warn" | "ghost" }>`
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  background: ${({ tone }) => (tone === "ok" ? "#111" : "#fff")};
  color: ${({ tone }) => (tone === "ok" ? "#fff" : "#111")};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
`;

const LS_TOKENS = "mt.cajero.deliverTokens.v1";

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function newId(prefix = "dv:") {
  return `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function uniqueStrings(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function resolveOrderId(d: any) {
  return safeStr(d?.attrs?.orderId || d?.id);
}

function resolveOrderThreadId(order: any) {
  return String(
    order?.attrs?.threadId ||
      order?.threadId ||
      order?.meta?.threadId ||
      `order:thread:${resolveOrderId(order)}`
  );
}

function extractCajaId(d: any): string | null {
  return (
    safeStr(d?.attrs?.payment?.cajeroId) ||
    safeStr(d?.attrs?.payment?.recommendedCajeroId) ||
    safeStr(d?.attrs?.cajeroId) ||
    safeStr(d?.meta?.caja?.id) ||
    safeStr(d?.meta?.pay?.recommendedCajeroId) ||
    safeStr(d?.meta?.cajeroId) ||
    null
  );
}

function isOrderEvent(d: DatoVivo) {
  return safeStr(d.kind) === "market.order.event";
}

function isOrder(d: DatoVivo) {
  const k = safeStr((d as any)?.kind).trim();

  if (k === "market.order.create" || k === "market.order") return true;
  if (k.startsWith("market.order.")) return false;

  const hasItems = Array.isArray((d as any)?.attrs?.items);
  const traits = Array.isArray((d as any)?.traits) ? (d as any).traits : [];
  return traits.includes("mt:order") && hasItems;
}

function isProductDV(d: any) {
  const k = safeStr(d?.kind).trim();
  const traits = Array.isArray(d?.traits) ? d.traits : [];
  return k === "producto" || k === "mt.product" || traits.includes("mt:producto");
}

function isOfferDV(d: any) {
  const k = safeStr(d?.kind).trim();
  const traits = Array.isArray(d?.traits) ? d.traits : [];
  return k === "mt:offer" || traits.includes("mt:offer");
}

function getStockFromDV(d: any): number {
  const s = d?.attrs?.stock ?? d?.attrs?.inventory?.stock ?? d?.attrs?.cantidad ?? 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getOfferQty(d: any): number {
  const n = Number(d?.attrs?.cantidad ?? d?.cantidad ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getOrderBoughtQty(orderDv: any): number {
  const items = Array.isArray(orderDv?.attrs?.items) ? orderDv.attrs.items : [];
  if (items.length) {
    const sum = items.reduce((acc: number, it: any) => {
      const q = Number(it?.qty ?? 0);
      return acc + (Number.isFinite(q) ? q : 0);
    }, 0);
    if (sum > 0) return sum;
  }
  const q = Number(orderDv?.attrs?.qty ?? 0);
  return Number.isFinite(q) ? q : 0;
}

function settleOfferQuantity(offer: any, boughtQty: number) {
  const currentQty = Math.max(0, getOfferQty(offer));
  const nextQty = Math.max(0, currentQty - Math.max(0, Number(boughtQty || 0)));
  const completed = nextQty <= 0;
  const now = new Date().toISOString();

  return {
    ...offer,
    cantidad: nextQty,
    attrs: {
      ...(offer?.attrs || {}),
      cantidad: nextQty,
      status: completed ? "completed" : "active",
      completedAt: completed ? now : undefined,
    },
    meta: {
      ...(offer?.meta || {}),
      status: completed ? "completed" : "active",
      ts: now,
      source: "ms.web.cajero.offer.settle",
    },
  };
}

function findOfferForOrder(orderDv: any, all: any[]) {
  const explicitOfferId =
    safeStr(orderDv?.attrs?.fromOfferId) ||
    safeStr(orderDv?.meta?.fromOfferId) ||
    safeStr(orderDv?.meta?.fromOffer) ||
    "";

  if (explicitOfferId) {
    const byId = all.find(
      (d: any) => isOfferDV(d) && String(d?.id) === String(explicitOfferId)
    );
    if (byId) return byId;
  }

  const productId = safeStr(
    orderDv?.attrs?.productId || orderDv?.attrs?.items?.[0]?.productId || ""
  );
  const sellerId = safeStr(orderDv?.attrs?.sellerId);
  const unitPrice = Number(orderDv?.attrs?.price ?? 0);

  const candidates = all
    .filter(isOfferDV)
    .filter((d: any) => safeStr(d?.attrs?.productoId) === productId)
    .filter((d: any) => {
      const productorId =
        safeStr(d?.attrs?.productor?.id) ||
        safeStr(d?.attrs?.sellerId) ||
        safeStr(d?.meta?.sellerId);
      return !sellerId || productorId === sellerId;
    })
    .filter((d: any) => {
      const price = Number(d?.attrs?.precio ?? 0);
      return !Number.isFinite(unitPrice) || unitPrice <= 0 || price === unitPrice;
    })
    .sort((a: any, b: any) => parseTs(b) - parseTs(a));

  return candidates[0] || null;
}

async function publishLiveDV(dv: any) {
  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({
      sym: "🧬",
      say: "dato.upsert",
      with: { dv },
    });
  } catch {}
}

function loadTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_TOKENS);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveTokens(tokens: Record<string, string>) {
  try {
    localStorage.setItem(LS_TOKENS, JSON.stringify(tokens));
  } catch {}
}

function genDeliverToken() {
  const u =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `tk:${u}`;
}
function lastCajeroEvent(orderId: string, all: DatoVivo[]) {
  const evs = all
    .filter(isOrderEvent)
    .filter((e: any) => String(e?.attrs?.orderId) === String(orderId))
    .filter((e: any) => safeStr(e?.attrs?.role) === "cajero")
    .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  return evs[0] as any;
}
function lastDeliveryEventsByRole(orderId: string, all: DatoVivo[]) {
  const evs = all
    .filter(isOrderEvent)
    .filter((e: any) => String(e?.attrs?.orderId) === String(orderId))
    .filter((e: any) => {
      const role = safeStr(e?.attrs?.role);
      return role === "buyer" || role === "seller" || role === "cajero";
    })
    .sort((a: any, b: any) => parseTs(b) - parseTs(a));

  const byRole: Record<string, any> = {};
  for (const e of evs) {
    const role = safeStr(e?.attrs?.role);
    if (!byRole[role]) byRole[role] = e;
  }
  return byRole;
}

function orderStatus(orderId: string, all: DatoVivo[]) {
  const byRole = lastDeliveryEventsByRole(orderId, all);

  const buyer = byRole["buyer"];
  const seller = byRole["seller"];
  const cajero = byRole["cajero"];

  const anyNok = [buyer, seller, cajero].some((x) => x?.attrs?.ok === false);
  if (anyNok) {
    return { label: "Disputa", tone: "warn" as const, done: true };
  }

  const okCount = [buyer, seller, cajero].filter((x) => x?.attrs?.ok === true).length;
  if (okCount >= 2) {
    return { label: "Entregado", tone: "ok" as const, done: true };
  }

  return { label: "Pendiente", tone: "info" as const, done: false };
}
function emitOrderMessage(params: {
  orderId: string;
  threadId: string;
  cajeroId: string;
  cajeroName?: string;
  buyerId?: string;
  sellerId?: string;
  text: string;
  source?: string;
}) {
  mtLiveUpsert({
    id: newId("market.order.message:"),
    kind: "market.order.message",
    attrs: {
      threadId: params.threadId,
      orderId: params.orderId,
      fromActorId: params.cajeroId,
      actorName: params.cajeroName || "Cajero",
      toActorId: params.buyerId || params.sellerId || null,
      buyerId: params.buyerId || null,
      sellerId: params.sellerId || null,
      cajeroId: params.cajeroId,
      participants: uniqueStrings([params.buyerId, params.sellerId, params.cajeroId]),
      text: params.text,
      unreadBy: uniqueStrings([params.buyerId, params.sellerId]),
      status: "sent",
    },
    traits: ["mt:chat", "mt:order.thread"],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      source: params.source || "ms.web.cajero.order.message",
    },
  } as any);
}

type Props = {
  activeCajero: MtCajero | null;
  onOpenThread?: (threadId: string) => void;
};

export default function CajeroPedidosPanel({
  activeCajero,
  onOpenThread,
}: Props) {
  const [allDvs, setAllDvs] = useState<DatoVivo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tokenByOrder, setTokenByOrder] = useState<Record<string, string>>(() =>
    loadTokens()
  );

  useEffect(() => {
    saveTokens(tokenByOrder);
  }, [tokenByOrder]);

  useEffect(() => {
    const unsub = mtLiveSubscribe((all: DatoVivo[]) => {
      setAllDvs(Array.isArray(all) ? all : []);
    });
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  const pedidos = useMemo(() => {
    if (!activeCajero) return [];
    const cajeroId = activeCajero.id;

    return allDvs
      .filter(isOrder)
      .filter((d: any) => extractCajaId(d) === cajeroId)
      .filter((d: any) => {
        const orderId = resolveOrderId(d);
        const st = orderStatus(orderId, allDvs);
        return !st.done;
      })
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [allDvs, activeCajero]);

  useEffect(() => {
    if (!pedidos.length) return;

    let changed = false;
    const next = { ...tokenByOrder };

    for (const d of pedidos as any[]) {
      const orderId = resolveOrderId(d);
      if (!orderId) continue;
      if (next[orderId]) continue;

      const ce = lastCajeroEvent(orderId, allDvs);
      const tk = safeStr(ce?.attrs?.deliverToken).trim();
      if (tk) {
        next[orderId] = tk;
        changed = true;
      }
    }

    if (changed) setTokenByOrder(next);
  }, [pedidos, allDvs, tokenByOrder]);

  const act = async (orderId: string, ok: boolean) => {
    if (!activeCajero) return;

    setBusyId(orderId);
    setMsg(null);

    const deliverToken = ok ? genDeliverToken() : undefined;

    if (ok && deliverToken) {
      setTokenByOrder((p) => ({ ...p, [orderId]: deliverToken }));
    }

    const orderDv: any =
      allDvs.find(
        (x: any) =>
          String(x?.id) === String(orderId) ||
          String(x?.attrs?.orderId) === String(orderId)
      ) || null;

    const threadId = resolveOrderThreadId(orderDv);
    const buyerId = safeStr(orderDv?.attrs?.buyerId ?? orderDv?.attrs?.buyer?.id);
    const sellerId = safeStr(orderDv?.attrs?.sellerId);

    mtLiveUpsert({
      id: `market.order.event:${orderId}:cajero:${Date.now()}`,
      kind: "market.order.event",
      attrs: {
        threadId,
        orderId,
        ok,
        role: "cajero",
        actorId: activeCajero.id,
        actorName: activeCajero.nombre,
        buyerId: buyerId || null,
        sellerId: sellerId || null,
        cajeroId: activeCajero.id,
        participants: uniqueStrings([buyerId, sellerId, activeCajero.id]),
        deliverToken: deliverToken ?? null,
        note: ok ? "Entrega confirmada por cajero" : "Disputa abierta por cajero",
        unreadBy: uniqueStrings([buyerId, sellerId]),
      },
      traits: ["mt:event", ok ? "mt:ok" : "mt:nok", "mt:role.cajero", "mt:order.thread"],
      meta: {
        ns: "mt:market",
        ts: new Date().toISOString(),
        caja: { id: activeCajero.id, nombre: activeCajero.nombre },
        source: "ms.web.cajero.panel",
      },
    } as any);

    emitOrderMessage({
      orderId,
      threadId,
      cajeroId: activeCajero.id,
      cajeroName: activeCajero.nombre,
      buyerId,
      sellerId,
      text: ok
        ? `Confirmé entrega del pedido ${orderId.slice(-6)}.${deliverToken ? ` Código: ${deliverToken}` : ""}`
        : `Abrí disputa para el pedido ${orderId.slice(-6)}.`,
      source: "ms.web.cajero.order.message",
    });

    try {
      await emitDeliveryConfirm({
        orderId,
        role: "cajero",
        ok,
        actorId: activeCajero.id,
        actorName: activeCajero.nombre,
        deliverToken,
        note: ok ? "Entrega confirmada" : "Disputa: problema en entrega",
      });

      if (ok) {
        const items = Array.isArray(orderDv?.attrs?.items) ? orderDv.attrs.items : [];

        for (const it of items) {
          const productId = String(it?.productId ?? "");
          const take = Number(it?.qty ?? 0);
          if (!productId || !Number.isFinite(take) || take <= 0) continue;

          const prodDv: any = allDvs.find(
            (x: any) => isProductDV(x) && String(x?.id) === String(productId)
          );
          if (!prodDv) continue;

          const prevStock = getStockFromDV(prodDv);
          const nextStock = Math.max(0, prevStock - take);

          const updated = {
            ...prodDv,
            id: String(prodDv.id),
            kind: String(prodDv.kind),
            attrs: {
              ...(prodDv.attrs || {}),
              stock: nextStock,
            },
            meta: {
              ...(prodDv.meta || {}),
              ts: new Date().toISOString(),
              status: nextStock <= 0 ? "out_of_stock" : "active",
              hidden: nextStock <= 0,
              source: "ms.web.cajero.stock",
            },
          };

          await publishLiveDV(updated);
        }

        const linkedOffer = findOfferForOrder(orderDv, allDvs);
        if (linkedOffer) {
          const boughtQty = getOrderBoughtQty(orderDv);
          const updatedOffer = settleOfferQuantity(linkedOffer, boughtQty);
          await publishLiveDV(updatedOffer);

          emitOrderMessage({
            orderId,
            threadId,
            cajeroId: activeCajero.id,
            cajeroName: activeCajero.nombre,
            buyerId,
            sellerId,
            text:
              getOfferQty(updatedOffer) <= 0
                ? `La oferta ${safeStr(linkedOffer?.id).slice(-6)} quedó completada y se cerró.`
                : `La oferta ${safeStr(linkedOffer?.id).slice(-6)} fue actualizada. Cantidad restante: ${getOfferQty(updatedOffer)}.`,
            source: "ms.web.cajero.offer.message",
          });

        }
      }

      setMsg(
        ok
          ? `✅ Confirmado ${orderId.slice(-6)} · Código: ${deliverToken ?? ""}`
          : `⚠️ Disputa ${orderId.slice(-6)}`
      );
    } catch (e: any) {
      console.error("[CajeroPedidosPanel] FAIL", e);
      setMsg(e?.message || "No se pudo emitir confirmación/disputa");
    } finally {
      setBusyId(null);
    }
  };

  if (!activeCajero) {
    return (
      <Box>
        <b>Pedidos</b>
        <Subtle>Elegí un cajero para ver pedidos.</Subtle>
      </Box>
    );
  }

  return (
    <Box>
      <Row>
        <b>Pedidos para: {activeCajero.nombre}</b>
        <Subtle>{pedidos.length} pedidos</Subtle>
      </Row>

      {msg && (
        <Subtle style={{ marginTop: 8 }}>
          {msg.includes("Código: tk:") ? (
            <>
              {msg.split("Código:")[0]} Código:
              <code style={{ marginLeft: 6 }}>{msg.split("Código:")[1].trim()}</code>
            </>
          ) : (
            msg
          )}
        </Subtle>
      )}

      <div style={{ height: 10 }} />

      {pedidos.length === 0 ? (
        <Subtle>No hay pedidos pendientes.</Subtle>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {pedidos.map((d: any) => {
            const orderId = resolveOrderId(d);
            const threadId = resolveOrderThreadId(d);
            const st = orderStatus(orderId, allDvs);
            const isBusy = busyId === orderId;
            const token = tokenByOrder[orderId] || "";

            return (
              <div
                key={orderId}
                style={{
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <Row>
                  <div>
                    <b>Pedido</b> <code>{orderId.slice(-6)}</code>
                  </div>
                  <Subtle>
                    {d?.meta?.ts ? new Date(d.meta.ts).toLocaleString() : ""}
                  </Subtle>
                </Row>

                <Subtle style={{ marginTop: 6 }}>
                  Estado:{" "}
                  <b
                    style={{
                      color:
                        st.tone === "ok"
                          ? "green"
                          : st.tone === "warn"
                            ? "orange"
                            : "gray",
                    }}
                  >
                    {st.label}
                  </b>
                </Subtle>

                <Subtle style={{ marginTop: 6 }}>
                  Total: <b>{d?.attrs?.total ?? "—"}</b> · Items:{" "}
                  <b>{Array.isArray(d?.attrs?.items) ? d.attrs.items.length : "—"}</b>
                </Subtle>

                {(safeStr(d?.attrs?.fromOfferId) || safeStr(d?.meta?.fromOfferId)) && (
                  <Subtle style={{ marginTop: 6 }}>
                    Oferta origen:{" "}
                    <code>{safeStr(d?.attrs?.fromOfferId || d?.meta?.fromOfferId).slice(-6)}</code>
                  </Subtle>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Btn
                    type="button"
                    tone="ok"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void act(orderId, true);
                    }}
                  >
                    {isBusy ? "Procesando..." : "Confirmar entrega"}
                  </Btn>

                  <Btn
                    type="button"
                    tone="warn"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void act(orderId, false);
                    }}
                  >
                    {isBusy ? "Procesando..." : "Disputar"}
                  </Btn>

                  <Btn
                    type="button"
                    tone="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenThread?.(threadId);
                    }}
                  >
                    Abrir conversación 💬
                  </Btn>
                </div>

                {token && (
                  <Subtle style={{ marginTop: 8 }}>
                    Código entrega: <code>{token}</code>
                  </Subtle>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Box>
  );
}
