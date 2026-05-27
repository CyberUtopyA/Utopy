import React from "react";

type Props = {
  total: number;
};

export default function FalconStoreHero({ total }: Props) {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white/95 p-6 shadow-2xl md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr]">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Falcon Store
            </div>

            <h1 className="max-w-4xl text-3xl font-black leading-tight text-slate-950 md:text-5xl">
              Comprá mejor, con una selección más clara
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 md:text-base">
              Una experiencia más simple, más bonita y más directa para encontrar
              productos, consultar y continuar compra sin ruido.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Productos
                </div>
                <div className="mt-1 text-2xl font-black text-slate-950">{total}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Estilo
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  Curado y seleccionado
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Compra
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  Simple y directa
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Selección
              </div>
              <h3 className="mt-2 text-xl font-bold text-slate-950">
                Lo mejor, más ordenado
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Productos más atractivos, más claros y listos para comprar o consultar.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Continuidad
              </div>
              <h3 className="mt-2 text-xl font-bold text-slate-950">
                Seguí la compra sin fricción
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Tocás, consultás o comprás, y la red continúa el flujo sin mostrar complejidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}