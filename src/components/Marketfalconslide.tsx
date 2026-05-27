import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const LAST_FALCON_ROUTE_KEY = "falcon.last.route.v1";

function isFalconPath(pathname: string) {
  return pathname.startsWith("/falcon");
}

function readLastFalconRoute() {
  try {
    const raw = localStorage.getItem(LAST_FALCON_ROUTE_KEY);
    if (!raw) return "/falcon/store";
    if (!raw.startsWith("/falcon")) return "/falcon/store";
    return raw;
  } catch {
    return "/falcon/store";
  }
}

export default function MarketFalconSwitch() {
  const location = useLocation();
  const navigate = useNavigate();

  const inFalcon = useMemo(
    () => isFalconPath(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (!inFalcon) return;
    try {
      localStorage.setItem(
        LAST_FALCON_ROUTE_KEY,
        `${location.pathname}${location.search || ""}${location.hash || ""}`
      );
    } catch {
      // noop
    }
  }, [inFalcon, location.pathname, location.search, location.hash]);

  function handleToggle() {
    if (inFalcon) {
      navigate("/market");
      return;
    }

    const lastFalcon = readLastFalconRoute();
    navigate(lastFalcon);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={inFalcon ? "Volver a Market" : "Abrir Falcon"}
      className={[
        "fixed right-3 top-1/2 z-[140] -translate-y-1/2 rounded-[22px] border px-3 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300",
        "hover:scale-[1.02] active:scale-[0.98]",
        inFalcon
          ? "border-cyan-300/70 bg-slate-900/90 text-white"
          : "border-white/60 bg-white/78 text-slate-900",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "grid h-10 w-10 place-items-center rounded-2xl text-sm font-black transition-all duration-300",
            inFalcon
              ? "bg-gradient-to-br from-cyan-400 to-violet-500 text-white"
              : "bg-gradient-to-br from-slate-800 to-slate-500 text-white",
          ].join(" ")}
        >
          F
        </div>

        <div className="text-center leading-none">
          <div
            className={[
              "text-[10px] font-black uppercase tracking-[0.26em]",
              inFalcon ? "text-cyan-300" : "text-slate-500",
            ].join(" ")}
          >
            Falcon
          </div>

          <div
            className={[
              "mt-1 text-[11px] font-semibold",
              inFalcon ? "text-white" : "text-slate-700",
            ].join(" ")}
          >
            {inFalcon ? "Market" : "Abrir"}
          </div>
        </div>

        <div
          className={[
            "mt-1 h-6 w-1 rounded-full transition-all duration-300",
            inFalcon ? "bg-cyan-300" : "bg-slate-300",
          ].join(" ")}
        />
      </div>
    </button>
  );
}