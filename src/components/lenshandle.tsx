import React from "react";

export type FalconLensSection = "store" | "skylines" | "daily" | "capital";

type Props = {
  open: boolean;
  section: FalconLensSection;
  onToggle: () => void;
};

const LABELS: Record<FalconLensSection, string> = {
  store: "Store",
  skylines: "Skylines",
  daily: "Daily",
  capital: "Capital",
};

export default function LensHandle({ open, section, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Cerrar Falcon" : "Abrir secciones Falcon"}
      className={[
        "fixed right-3 top-1/2 z-[120] -translate-y-1/2 rounded-[22px] border px-3 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300",
        open
          ? "border-cyan-300/70 bg-slate-900/90 text-white"
          : "border-white/50 bg-white/72 text-slate-900 hover:bg-white/90",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "grid h-10 w-10 place-items-center rounded-2xl text-sm font-black transition-all duration-300",
            open
              ? "bg-gradient-to-br from-cyan-400 to-violet-500 text-white"
              : "bg-gradient-to-br from-slate-700 to-slate-500 text-white",
          ].join(" ")}
        >
          F
        </div>

        <div className="text-center leading-none">
          <div
            className={[
              "text-[10px] font-black uppercase tracking-[0.26em]",
              open ? "text-cyan-300" : "text-slate-500",
            ].join(" ")}
          >
            Falcon
          </div>
          <div
            className={[
              "mt-1 text-[11px] font-semibold",
              open ? "text-white" : "text-slate-700",
            ].join(" ")}
          >
            {LABELS[section]}
          </div>
        </div>
      </div>
    </button>
  );
}