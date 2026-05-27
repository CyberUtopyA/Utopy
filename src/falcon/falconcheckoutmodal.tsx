import React, { useEffect, useMemo, useState } from "react";
import type { DVLike } from "./liquidity/mt.liquidity";
import type { FalconStoreItem } from "../types/falcon.store";
import FalconLiquidityPanel from "./liquiditypanel";
import {
  buildFalconBuyOrderDV,
  buildFalconCheckoutLiquidityDVs,
  compactProductLabel,
  num,
  pickFalconCurrency,
  resolveFalconBuyerId,
  resolveFalconSellerId,
  resolveFalconSellerName,
  resolveFalconThreadId,
  summarizeFalconLiquidity,
} from "./falconliquidity";
import { falconLiveSubscribe, falconLiveUpsert } from "./falconlive";
type Props = {
  open: boolean;
  product: FalconStoreItem | any | null;
  buyerId?: string | null;
  buyerName?: string | null;
  onClose: () => void;
  onDone?: (payload?: {
    orderId: string;
    threadId: string;
    total: number;
    usedLiquidity: boolean;
    dvIds: string[];
  }) => void;
};

function readLocalBuyer() {
  try {
    const raw =
      localStorage.getItem("falcon.buyer") ||
      localStorage.getItem("mt.actor") ||
      "";
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: parsed?.id || null,
      name: parsed?.name || null,
      phone: parsed?.phone || "",
    };
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return Math.round(Number(n || 0)).toLocaleString("es-PY");
}

async function tryPostMicelio(dv: DVLike) {
  const base = (import.meta as any)?.env?.VITE_MICELIO_HTTP as string | undefined;
  if (!base) return;

  try {
    await fetch(`${String(base).replace(/\/$/, "")}/dv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dv),
    });
  } catch (err) {
    console.warn("[Falcon] No se pudo publicar DV en Micelio", err);
  }
}

async function publishDV(dv: DVLike) {
  try {
    falconLiveUpsert(dv as any);
  } catch (err) {
    console.warn("[Falcon] falconLiveUpsert falló", err);
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
    console.warn("[Falcon] utopy.emit falló", err);
  }

  await tryPostMicelio(dv);
}

export default function FalconCheckoutModal({
  open,
  product,
  buyerId,
  buyerName,
  onClose,
  onDone,
}: Props) {
  const [allDvs, setAllDvs] = useState<DVLike[]>([]);
  const localBuyer = useMemo(() => readLocalBuyer(), []);
  const cleanBuyerId = useMemo(
    () => resolveFalconBuyerId(buyerId || localBuyer?.id, buyerName || localBuyer?.name),
    [buyerId, buyerName, localBuyer]
  );
  const cleanBuyerName = useMemo(
    () => String(buyerName || localBuyer?.name || "Comprador"),
    [buyerName, localBuyer]
  );

  const sellerId = useMemo(
    () => (product ? resolveFalconSellerId(product) : "seller:unknown"),
    [product]
  );
  const sellerName = useMemo(
    () => (product ? resolveFalconSellerName(product) : "Vendedor"),
    [product]
  );
  const threadId = useMemo(
    () => (product ? resolveFalconThreadId(product, cleanBuyerId) : ""),
    [product, cleanBuyerId]
  );

  const unitPrice = useMemo(
    () => num(product?.price ?? product?.precio, 0),
    [product]
  );
  const currency = useMemo(
    () => pickFalconCurrency(product, "PYG"),
    [product]
  );

  const [qty, setQty] = useState(1);
  const [name, setName] = useState(cleanBuyerName);
  const [phone, setPhone] = useState(String(localBuyer?.phone || ""));
  const [note, setNote] = useState("");
  const [useLiquidity, setUseLiquidity] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => Math.max(1, qty) * unitPrice, [qty, unitPrice]);

  const liq = useMemo(
    () =>
      summarizeFalconLiquidity({
        actorId: cleanBuyerId,
        currency,
        dvs: allDvs,
      }),
    [cleanBuyerId, currency, allDvs]
  );

  useEffect(() => {
    if (!open) return;
    const unsub = falconLiveSubscribe((all: any[]) =>
      setAllDvs(Array.isArray(all) ? (all as DVLike[]) : [])
    );
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(cleanBuyerName);
  }, [open, cleanBuyerName]);

  if (!open || !product) return null;

  const canUseLiquidity = liq.summary.spendable > 0;
  const willUseLiquidity = useLiquidity && canUseLiquidity && liq.summary.spendable >= total;

  async function confirmBuy() {
    setBusy(true);
    setMsg(null);

    try {
      try {
        localStorage.setItem(
          "falcon.buyer",
          JSON.stringify({
            id: cleanBuyerId,
            name,
            phone,
          })
        );
      } catch {}

      const orderDV = buildFalconBuyOrderDV({
        product,
        buyerId: cleanBuyerId,
        buyerName: name,
        sellerId,
        sellerName,
        qty,
        unitPrice,
        total,
        currency,
        threadId,
      });

      await publishDV(orderDV);

      const liqDVs = buildFalconCheckoutLiquidityDVs({
        product,
        buyerId: cleanBuyerId,
        buyerName: name,
        sellerId,
        sellerName,
        qty,
        unitPrice,
        total,
        currency,
        threadId,
        orderId: orderDV.id,
        useBuyerLiquidity: willUseLiquidity,
      });

      for (const dv of liqDVs.allDvs) {
        await publishDV(dv);
      }

      const eventDV: DVLike = {
        id: `falcon.order.event:${orderDV.id}:${Date.now()}`,
        kind: "market.order.event",
        attrs: {
          orderId: orderDV.id,
          threadId,
          buyerId: cleanBuyerId,
          buyerName: name,
          sellerId,
          sellerName,
          type: "checkout.created",
          text: willUseLiquidity
            ? `Compra creada por ${fmt(total)} ${currency} usando liquidez disponible`
            : `Compra creada por ${fmt(total)} ${currency}`,
          phone: phone || null,
          note: note || null,
          unreadBy: [sellerId, cleanBuyerId].filter(Boolean),
        },
        traits: ["mt:market", "mt:thread", "falcon:checkout"],
        meta: {
          ns: product?.meta?.ns ?? "mt:market",
          scopes: ["public"],
          ts: new Date().toISOString(),
          source: "falcon.checkout.event",
        },
      };

        await publishDV(eventDV);

      setMsg("Compra enviada correctamente.");

      const payload = {
        orderId: orderDV.id,
        threadId,
        total,
        usedLiquidity: willUseLiquidity,
        dvIds: [orderDV.id, ...liqDVs.allDvs.map((d) => d.id), eventDV.id],
      };

      onDone?.(payload);

      setTimeout(() => {
        onClose();
      }, 250);
    } catch (err: any) {
      setMsg(err?.message || "No se pudo completar la compra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
        <div className="grid lg:grid-cols-[1.02fr_0.98fr]">
          <div className="min-h-[320px] bg-gradient-to-br from-cyan-100 via-slate-100 to-violet-100">
            {product?.image ? (
              <img
                src={product.image}
                alt={compactProductLabel(product)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full min-h-[320px] place-items-center text-slate-500">
                Sin imagen
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-700">
                  Comprar ahora
                </div>
                <h2 className="text-2xl font-black text-slate-950">
                  {compactProductLabel(product)}
                </h2>
                <div className="mt-2 text-sm text-slate-600">
                  Vendedor: {sellerName}
                </div>
              </div>

              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Precio
                </div>
                <div className="mt-1 text-xl font-black text-slate-950">
                  {fmt(unitPrice)} {currency}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Cantidad
                </div>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, num(e.target.value, 1)))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none"
                />
              </div>

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">
                  Total
                </div>
                <div className="mt-1 text-xl font-black text-cyan-950">
                  {fmt(total)} {currency}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none"
              />

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Tu teléfono"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none"
              />
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para la compra"
              className="mt-3 min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none"
            />

            <div className="mt-4">
              <FalconLiquidityPanel
                actorId={cleanBuyerId}
                actorName={name || cleanBuyerName}
                allDvs={allDvs}
                defaultCurrency={currency}
                threadId={threadId}
                onUseInCheckout={(payload) => {
                  setUseLiquidity(true);
                  setMsg(
                    `Liquidez detectada: ${fmt(payload.spendable)} ${payload.currency} · confianza ${Math.round(
                      payload.trustScore * 100
                    )}%`
                  );
                }}
                onOpenWallet={() => {
                  setMsg("Saldo y detalle cargados para esta compra.");
                }}
              />
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={useLiquidity}
                onChange={(e) => setUseLiquidity(e.target.checked)}
                disabled={!canUseLiquidity}
              />
              Usar saldo disponible en esta compra
            </label>

            {useLiquidity && !willUseLiquidity ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Tu saldo usable no alcanza para cubrir el total completo.
              </div>
            ) : null}

            {msg ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {msg}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={confirmBuy}
                disabled={busy || !name.trim()}
                className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-3 text-sm font-bold text-cyan-900 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Confirmando..." : "Confirmar compra"}
              </button>

              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}