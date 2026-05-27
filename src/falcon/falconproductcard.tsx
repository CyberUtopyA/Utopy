import React from "react";
import { FalconStoreItem } from "../types/falcon.store";

type Props = {
  item: FalconStoreItem;
  onOpen: (item: FalconStoreItem) => void;
};

function formatMoney(value: number | null, currency: string) {
  if (typeof value !== "number") return "Consultar";
  return (
    new Intl.NumberFormat("es-PY").format(value) +
    ` ${currency === "PYG" ? " Gs." : ` ${currency}`}`
  );
}

export default function FalconProductCard({ item, onOpen }: Props) {
  return (
    <article className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-xl transition duration-200 hover:-translate-y-1 hover:border-cyan-300">
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-cyan-100 via-slate-100 to-violet-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-center text-slate-500">
            <div>
              <div className="text-4xl">✦</div>
              <div className="mt-2 text-sm">Sin imagen</div>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-700">
          {item.category}
        </div>

        {item.featured && (
          <div className="absolute right-4 top-4 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-700">
            Destacado
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950">
            {item.title}
          </h3>
          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {item.inStock ? "Disponible" : "A pedido"}
          </div>
        </div>

        <p className="line-clamp-3 min-h-[60px] text-sm leading-6 text-slate-700">
          {item.description || "Producto seleccionado para compra simple."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Precio
            </div>
            <div className="text-xl font-black text-slate-950">
              {formatMoney(item.price, item.currency)}
            </div>
          </div>

          <button
            onClick={() => onOpen(item)}
            className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-200"
          >
            Ver producto
          </button>
        </div>

        {item.sellerName && (
          <div className="mt-4 border-t border-slate-200 pt-3 text-xs font-medium text-slate-600">
            Vendedor: {item.sellerName}
          </div>
        )}
      </div>
    </article>
  );
}