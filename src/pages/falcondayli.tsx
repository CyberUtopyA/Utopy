import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import SectionHero from "../components/sectionhero";
import { getFalconSection } from "../utils/falconsection";
import { useFalconDayli } from "./usefalcondayli";

function fmtMoney(value: number | null, currency = "PYG") {
  if (typeof value !== "number") return "Consultar";
  return (
    new Intl.NumberFormat("es-PY").format(value) +
    ` ${currency === "PYG" ? "Gs." : currency}`
  );
}

export default function FalconDailyPage() {
  const section = getFalconSection("daily");
  const [params] = useSearchParams();
  const cat = params.get("cat") ?? section.categories[0].id;

  const active = useMemo(
    () => section.categories.find((c) => c.id === cat) ?? section.categories[0],
    [cat, section]
  );

  const {
    loading,
    error,
    summary,
    filteredFoods,
    featuredTerritories,
    featuredProducers,
  } = useFalconDayli(cat);

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow="Falcon Daily"
        title="La capa viva de abastecimiento territorial"
        description="Comida, super, farmacia, combos y compras recurrentes conectadas a territorios, productores y oferta viva. Falcon Daily no es solo delivery: es una interfaz simple para consumo diario, abastecimiento local y producción descentralizada."
      />

      <CategoryPills section={section} />

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Territorios
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.territories}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Productores
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.producers}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Productos vivos
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.foods}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">
                Visibles ahora
              </div>
              <div className="mt-1 text-2xl font-black text-cyan-950">
                {loading ? "..." : summary.visible}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Categoría activa
            </div>
            <div className="mt-1 text-xl font-bold text-slate-950">
              {active.label}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {active.description}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl">
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Oferta viva
              </div>
              <h2 className="text-2xl font-bold text-slate-950">
                {active.label}
              </h2>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800">
              {loading ? "Sincronizando..." : `${filteredFoods.length} visibles`}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[320px] animate-pulse rounded-[24px] border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : filteredFoods.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredFoods.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="h-32 bg-gradient-to-br from-emerald-100 via-cyan-50 to-violet-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                        {item.category}
                      </span>

                      {item.available ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Disponible
                        </span>
                      ) : null}

                      {item.tags.includes("mt:recurrente") || item.category === "recurrente" ? (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                          Recurrente
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>

                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>

                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      {item.producerName ? (
                        <div>
                          Productor:{" "}
                          <b className="text-slate-700">{item.producerName}</b>
                        </div>
                      ) : null}

                      {item.territoryName ? (
                        <div>
                          Territorio:{" "}
                          <b className="text-slate-700">{item.territoryName}</b>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Precio
                        </div>
                        <div className="text-lg font-black text-slate-950">
                          {fmtMoney(item.price, item.currency)}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-200"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              No hay oferta viva para esta categoría todavía.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Territorios vivos
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Red territorial activa
            </h2>
          </div>

          {featuredTerritories.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredTerritories.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-lime-100 via-emerald-50 to-cyan-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Territorio
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>

                    {item.location ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Ubicación:{" "}
                        <b className="text-slate-700">{item.location}</b>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Todavía no hay territorios visibles en Falcon Dayli.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Productores
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Producción descentralizada activa
            </h2>
          </div>

          {featuredProducers.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducers.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Productor
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>

                    {item.territoryName ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Territorio:{" "}
                        <b className="text-slate-700">{item.territoryName}</b>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Todavía no hay productores visibles en Falcon Dayli.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}