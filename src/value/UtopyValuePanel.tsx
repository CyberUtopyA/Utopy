import { useState } from "react";
import { useUtopyValue } from "./useUtopyValue";

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function UtopyValuePanel() {
  const [credential, setCredential] = useState("");
  const { programs, trustProofs, programStates } = useUtopyValue(credential);

  return (
    <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
          ✨ Mi valor vivo
        </div>
        <h2 className="mt-1 text-xl font-black">Pasaportes, beneficios y confianza</h2>
        <p className="mt-1 text-sm text-slate-600">
          Escribí el código de tu tarjeta o pasaporte. UTOPY consulta solamente los nodos compatibles.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={credential}
          onChange={(event: any) => setCredential(event.target.value)}
          placeholder="Ej.: FV-DH-... o código viajero"
          className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 outline-none focus:border-emerald-400"
        />
      </div>

      {!programs.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Todavía ningún nodo cercano publicó un programa compatible.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((program) => {
            const state = programStates[program.id];
            const passport = state?.passport || {};
            const current = number(passport.stamps ?? passport.progress ?? 0);
            const target = Math.max(1, number(passport.required ?? program.target));
            const percent = Math.min(100, Math.round((current / target) * 100));

            return (
              <article key={program.id} className="rounded-3xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{program.name}</div>
                    <div className="text-xs text-slate-500">{program.nodeName}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    🎟 {program.unit}
                  </span>
                </div>

                {state?.loading ? (
                  <div className="mt-4 text-sm text-slate-500">Consultando al nodo…</div>
                ) : state?.error ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                    {state.error}
                  </div>
                ) : state?.passport ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>{current} / {target}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </div>
                    {number(passport.rewards_available) > 0 ? (
                      <div className="mt-3 rounded-2xl bg-violet-50 p-3 text-sm font-bold text-violet-800">
                        🎁 Tenés una recompensa disponible
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-500">
                    Ingresá tu código para consultar este nodo.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl bg-slate-950 p-4 text-sm text-white">
        🛡 {trustProofs.length} prueba(s) de confianza relacionadas en este dispositivo.
      </div>
    </section>
  );
}
