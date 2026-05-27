import React from "react";
import type { FalconStoreItem } from "../types/falcon.store";

type Props = {
  item: FalconStoreItem | null;
  onClose: () => void;
  onBuyNow: (item: FalconStoreItem) => void;
  onConsult: (item: FalconStoreItem) => void;
};

function formatMoney(value: number | null, currency: string) {
  if (typeof value !== "number") return "Consultar";
  return (
    new Intl.NumberFormat("es-PY").format(value) +
    ` ${currency === "PYG" ? " Gs." : ` ${currency}`}`
  );
}

export default function FalconProductDialog({
  item,
  onClose,
  onBuyNow,
  onConsult,
}: Props) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-h-[320px] bg-gradient-to-br from-cyan-100 via-slate-100 to-violet-100">
            {item.image ? (
              <img
                src={item.image}
                alt={item.title}
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
                  {item.category || "Producto"}
                </div>
                <h2 className="text-2xl font-black text-slate-950">
                  {item.title}
                </h2>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <p className="text-sm leading-7 text-slate-700">
              {item.description || "Producto disponible para continuar compra."}
            </p>

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Precio
              </div>
              <div className="mt-1 text-3xl font-black text-slate-950">
                {formatMoney(item.price, item.currency)}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Disponibilidad
                </div>
                <div className="mt-1 font-semibold text-slate-950">
                  {item.inStock ? "Disponible ahora" : "Disponible a pedido"}
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Atención
                </div>
                <div className="mt-1 font-semibold text-slate-950">
                  {item.sellerName || "Venta verificada"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {item.tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onBuyNow(item)}
                className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-3 text-sm font-bold text-cyan-900 hover:bg-cyan-200"
              >
                Comprar ahora
              </button>

              <button
                onClick={() => onConsult(item)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
              >
                Consultar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}