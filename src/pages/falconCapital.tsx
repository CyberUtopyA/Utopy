import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import SectionHero from "../components/sectionhero";
import { getFalconSection } from "../utils/falconsection";
import { useFalconCapital } from "../falcon/capital/usefalconcapital";

function fmtMoney(value: number | null, currency = "PYG") {
  if (typeof value !== "number") return "Consultar";
  return (
    new Intl.NumberFormat("es-PY").format(value) +
    ` ${currency === "PYG" ? "Gs." : currency}`
  );
}

function toneBadge(cat: string) {
  const q = String(cat || "").toLowerCase();

  if (q.includes("territ")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (q.includes("negoc")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (q.includes("activo")) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (q.includes("extr")) return "border-violet-200 bg-violet-50 text-violet-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function FalconCapitalPage() {
  const section = getFalconSection("capital");
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
    filteredAssets,
    filteredProjects,
    filteredPacks,
    featuredTerritories,
    featuredProducers,
    usedVehicleCreditAssets,
    usedVehicleCreditPacks,
    creditEligiblePacks,
  } = useFalconCapital(cat);

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow="Falcon Capital"
        title="Capital, expansión y territorios vivos"
        description="Activos, renta, negocios, proyectos y fabricación conectados a territorio, producción y gobernanza local. Incluye usados con crédito UTOPY, liquidity y oportunidades reales del ecosistema."
      />

      <CategoryPills section={section} />

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Activos
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.assets}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Proyectos
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.projects}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Packs
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.packs}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Actores
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.producers}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Territorios
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {summary.territories}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">
                Visibles
              </div>
              <div className="mt-1 text-2xl font-black text-cyan-950">
                {loading ? "..." : summary.visibleAssets + summary.visibleProjects + summary.visiblePacks}
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
                Oportunidades activas
              </div>
              <h2 className="text-2xl font-bold text-slate-950">
                {active.label}
              </h2>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800">
              {loading ? "Sincronizando..." : `${filteredAssets.length} activos`}
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
          ) : filteredAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredAssets.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="h-32 bg-gradient-to-br from-yellow-100 via-cyan-50 to-violet-100">
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
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneBadge(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>

                      {item.available ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Activo
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
                      {item.territoryName ? (
                        <div>
                          Territorio:{" "}
                          <b className="text-slate-700">{item.territoryName}</b>
                        </div>
                      ) : null}

                      {item.producerName ? (
                        <div>
                          Actor:{" "}
                          <b className="text-slate-700">{item.producerName}</b>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Valor
                        </div>
                        <div className="text-lg font-black text-slate-950">
                          {fmtMoney(item.price, item.currency)}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-200"
                      >
                        Ver oportunidad
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              No hay activos visibles para esta categoría todavía.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Fabricación y movilidad
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Packs vivos desde MO
            </h2>
          </div>

          {filteredPacks.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredPacks.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="h-32 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-100">
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
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                        Fabricación
                      </span>

                      {item.creditEligible ? (
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                          Crédito elegible
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>

                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        Dominio: <b className="text-slate-700">{item.domain}</b>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        Publicación: <b className="text-slate-700">{item.publishAs}</b>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        Piezas: <b className="text-slate-700">{item.pieceCount}</b>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        Providers: <b className="text-slate-700">{item.providerCount}</b>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Estimado
                        </div>
                        <div className="text-lg font-black text-slate-950">
                          {fmtMoney(item.estimatedCost, item.estimatedCurrency)}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rounded-2xl border border-violet-300 bg-violet-100 px-4 py-2 text-sm font-bold text-violet-900 transition hover:bg-violet-200"
                      >
                        Ver pack
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Todavía no hay packs de fabricación visibles.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Usados + crédito
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Movilidad y usados con crédito UTOPY
            </h2>
          </div>

          {usedVehicleCreditAssets.length || usedVehicleCreditPacks.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {usedVehicleCreditAssets.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-cyan-100 via-sky-50 to-violet-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Usado + crédito
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>
                    <div className="mt-4 text-lg font-black text-slate-950">
                      {fmtMoney(item.price, item.currency)}
                    </div>
                  </div>
                </article>
              ))}

              {usedVehicleCreditPacks.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                      Pack + crédito
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>
                    <div className="mt-4 text-lg font-black text-slate-950">
                      {fmtMoney(item.estimatedCost, item.estimatedCurrency)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Todavía no hay oportunidades de usados con señales de crédito visibles.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Crédito elegible
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Packs listos para liquidity
            </h2>
          </div>

          {creditEligiblePacks.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {creditEligiblePacks.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-cyan-100 via-sky-50 to-violet-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Crédito elegible
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>
                    <div className="mt-4 text-lg font-black text-slate-950">
                      {fmtMoney(item.estimatedCost, item.estimatedCurrency)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Todavía no hay packs marcados como crédito elegible.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Proyectos
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Proyectos y estructuras de expansión
            </h2>
          </div>

          {filteredProjects.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredProjects.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneBadge(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.subtitle}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              No hay proyectos visibles en este momento.
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
              Territorios que concentran valor real
            </h2>
          </div>

          {featuredTerritories.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredTerritories.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-28 bg-gradient-to-br from-emerald-100 via-cyan-50 to-violet-100">
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
                      Territorio vivo
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
              Todavía no hay territorios visibles en Falcon Capital.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Actores estratégicos
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Producción, operación y alianzas
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
                      Actor estratégico
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
              Todavía no hay actores visibles en Falcon Capital.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Renta
              </div>
              <div className="mt-2 text-lg font-bold text-slate-950">
                Flujo con continuidad
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Activos que sostienen operación y ocupación.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Fabricación
              </div>
              <div className="mt-2 text-lg font-bold text-slate-950">
                Producción conectada
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Packs listos para trabajo, producto y crédito.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">
                Territorio
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-950">
                Gobernanza viva
              </div>
              <p className="mt-2 text-sm text-emerald-900/80">
                Coordinación descentralizada de valor, suelo y comunidad.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">
                Crédito
              </div>
              <div className="mt-2 text-lg font-bold text-cyan-950">
                UTOPY + liquidity
              </div>
              <p className="mt-2 text-sm text-cyan-900/80">
                Compra, cuotas y confianza conectadas al ecosistema.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}