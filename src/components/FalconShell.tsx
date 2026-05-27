import { Outlet } from "react-router-dom";
import FalconDock from "./FalconDock";

export default function FalconShell() {
  return (
    <div className="min-h-screen bg-falcon-grid text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent" />
      </div>

      <header className="fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-lg font-black text-white">
                F
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-cyan-300/80">
                  Falcon
                </div>
                <div className="text-lg font-bold">
                  Store · Skylines · Daily · Capital
                </div>
              </div>
            </div>
          </div>

          <div className="hidden rounded-3xl border border-white/10 bg-slate-950/45 px-4 py-3 text-right text-sm text-white/60 backdrop-blur-xl md:block">
            <div className="font-semibold text-white/80">
              Frontend curado de MS Market
            </div>
            <div>Nodo comercial conectado a UTOPY / DV</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-3 pb-36 pt-24 md:px-6">
        <Outlet />
      </main>

      <FalconDock />
    </div>
  );
}