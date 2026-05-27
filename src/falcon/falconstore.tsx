import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import { getFalconSection } from "../utils/falconsection";
import { useFalconStorefront } from "../falcon/usefalconstorefront";
import FalconProductCard from "../falcon/falconproductcard";
import FalconCollectionRail from "../falcon/falconcollectionrail";
import FalconProductDialog from "../falcon/falconproductdialog";
import FalconCheckoutModal from "../falcon/falconcheckoutmodal";
import FalconConsultModal from "../falcon/falconconsultmodal";
import type { FalconStoreItem } from "../types/falcon.store";

export default function FalconStorePage() {
  const section = getFalconSection("store");
  const [params] = useSearchParams();
  const cat = params.get("cat") || section.categories[0].id;

  const { filtered, collections, loading, error } = useFalconStorefront(cat);

  const [selectedItem, setSelectedItem] = useState<FalconStoreItem | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<FalconStoreItem | null>(null);
  const [consultItem, setConsultItem] = useState<FalconStoreItem | null>(null);

  const heroCount = useMemo(() => filtered.length, [filtered]);

  function handleOpenProduct(product: FalconStoreItem) {
    setSelectedItem(product);
  }

  function handleBuyNow(product: FalconStoreItem) {
    setSelectedItem(null);
    setCheckoutItem(product);
  }

  function handleConsult(product: FalconStoreItem) {
    setSelectedItem(null);
    setConsultItem(product);
  }

  return (
    <div className="space-y-6">
      {/* HERO LIMPIO */}
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[34px] border border-slate-200 bg-white px-6 py-8 shadow-[0_25px_60px_rgba(15,23,42,0.10)] md:px-8 md:py-10">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-cyan-300 bg-cyan-50 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-800">
              Falcon Store
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
              Comprá mejor,
              <span className="block text-slate-700">
                con una selección más clara
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Productos seleccionados, simples de ver y listos para consultar o comprar.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Catálogo
                </div>
                <div className="mt-1 text-lg font-black text-slate-950">
                  {heroCount}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Estilo
                </div>
                <div className="mt-1 text-lg font-black text-slate-950">
                  Curado
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Flujo
                </div>
                <div className="mt-1 text-lg font-black text-slate-950">
                  Comprar ahora
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <CategoryPills section={section} />

      {/* CATÁLOGO PRINCIPAL */}
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Catálogo visible
              </div>
              <h2 className="text-2xl font-bold text-slate-950">
                {cat === "destacados" ? "Productos destacados" : cat}
              </h2>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800">
              {loading ? "Cargando..." : `${filtered.length} productos`}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[350px] animate-pulse rounded-[26px] border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item: FalconStoreItem) => (
                <FalconProductCard
                  key={item.id}
                  item={item}
                  onOpen={handleOpenProduct}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              No hay productos para esta categoría todavía.
            </div>
          )}
        </div>
      </section>

      {/* COLECCIONES */}
      {collections.map((collection) => (
        <FalconCollectionRail
          key={collection.key}
          collection={collection}
          onOpen={handleOpenProduct}
        />
      ))}

      <FalconProductDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onBuyNow={handleBuyNow}
        onConsult={handleConsult}
      />

      <FalconCheckoutModal
        open={!!checkoutItem}
        product={checkoutItem}
        onClose={() => setCheckoutItem(null)}
        onDone={() => {
          setCheckoutItem(null);
        }}
      />

      <FalconConsultModal
        item={consultItem}
        onClose={() => setConsultItem(null)}
      />
    </div>
  );
}