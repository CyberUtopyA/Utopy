import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FALCON_SECTIONS, FalconSection } from "../utils/falconsection";

function normalizeFalconPath(path: string) {
  if (!path) return "/falcon/store";
  if (path.startsWith("/falcon/")) return path;
  if (path.startsWith("/")) return `/falcon${path}`;
  return `/falcon/${path}`;
}

function sectionFromPath(pathname: string) {
  if (pathname.startsWith("/falcon/skylines")) return "skylines";
  if (pathname.startsWith("/falcon/daily")) return "daily";
  if (pathname.startsWith("/falcon/capital")) return "capital";
  return "store";
}

const HOLD_MS = 520;
const MOVE_TOLERANCE = 12;

export default function FalconDock() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = useMemo(
    () => sectionFromPath(location.pathname),
    [location.pathname]
  );

  const [openSection, setOpenSection] = useState<FalconSection | null>(null);
  const [holdingKey, setHoldingKey] = useState<string | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const movedRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const resetHoldVisual = () => {
    setHoldingKey(null);
  };

  const startPress = (
    event: React.PointerEvent<HTMLButtonElement>,
    section: FalconSection
  ) => {
    clearPressTimer();

    pointerDownRef.current = true;
    movedRef.current = false;
    longPressTriggeredRef.current = false;
    startPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    setHoldingKey(section.key);

    pressTimerRef.current = window.setTimeout(() => {
      if (!pointerDownRef.current || movedRef.current) return;

      longPressTriggeredRef.current = true;
      setOpenSection(section);
      resetHoldVisual();

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    }, HOLD_MS);
  };

  const endPress = () => {
    pointerDownRef.current = false;
    clearPressTimer();
    resetHoldVisual();
    startPointRef.current = null;
  };

  const cancelPress = () => {
    pointerDownRef.current = false;
    movedRef.current = true;
    clearPressTimer();
    resetHoldVisual();
    startPointRef.current = null;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDownRef.current || !startPointRef.current) return;

    const dx = Math.abs(event.clientX - startPointRef.current.x);
    const dy = Math.abs(event.clientY - startPointRef.current.y);

    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
      cancelPress();
    }
  };

  const handleClick = (section: FalconSection) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    navigate(normalizeFalconPath(section.path));
  };

  return (
    <>
      <style>
        {`
          @keyframes falconHoldFill {
            0% {
              transform: scaleX(0);
              opacity: 0.25;
            }
            45% {
              opacity: 0.8;
            }
            100% {
              transform: scaleX(1);
              opacity: 1;
            }
          }

          @keyframes falconHoldGlow {
            0% {
              box-shadow:
                0 0 0 rgba(34, 211, 238, 0),
                0 0 0 rgba(168, 85, 247, 0);
            }
            50% {
              box-shadow:
                0 0 22px rgba(34, 211, 238, 0.38),
                0 0 42px rgba(168, 85, 247, 0.22);
            }
            100% {
              box-shadow:
                0 0 30px rgba(34, 211, 238, 0.50),
                0 0 58px rgba(168, 85, 247, 0.32);
            }
          }

          @keyframes falconCategoryRise {
            0% {
              transform: translate(-50%, 18px) scale(0.97);
              opacity: 0;
              filter: blur(8px);
            }
            100% {
              transform: translate(-50%, 0) scale(1);
              opacity: 1;
              filter: blur(0);
            }
          }

          .falcon-hold-fill {
            transform-origin: left center;
            animation: falconHoldFill ${HOLD_MS}ms linear forwards;
          }

          .falcon-hold-glow {
            animation: falconHoldGlow ${HOLD_MS}ms ease-out forwards;
          }

          .falcon-category-rise {
            animation: falconCategoryRise 220ms ease-out both;
          }
        `}
      </style>

      {openSection && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div
            className="pointer-events-auto absolute inset-0 bg-black/45 backdrop-blur-[3px]"
            onClick={() => setOpenSection(null)}
          />

          <div className="falcon-category-rise pointer-events-auto absolute bottom-28 left-1/2 w-[min(94vw,980px)]">
            <div className="overflow-hidden rounded-[30px] border border-cyan-300/20 bg-slate-950/88 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute -right-16 top-0 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
              </div>

              <div className="relative z-10 mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">
                    Categorías
                  </p>
                  <h3 className="text-xl font-black text-white">
                    {openSection.icon} {openSection.label}
                  </h3>
                  <p className="text-sm text-white/60">
                    {openSection.subtitle}
                  </p>
                </div>

                <button
                  onClick={() => setOpenSection(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Cerrar
                </button>
              </div>

              <div className="relative z-10 no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
                {openSection.categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      navigate(
                        `${normalizeFalconPath(openSection.path)}?cat=${cat.id}`
                      );
                      setOpenSection(null);
                    }}
                    className="group min-w-[220px] snap-start overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:from-cyan-400/15 hover:to-violet-400/10"
                  >
                    <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
                      {openSection.label}
                    </div>

                    <h4 className="text-lg font-black text-white">
                      {cat.label}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-white/65">
                      {cat.description}
                    </p>

                    <span className="mt-5 inline-flex text-sm font-bold text-cyan-300">
                      Abrir categoría →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2">
        <div className="bg-transparent px-2 py-2">
          <div className="mb-2 text-center text-[10px] uppercase tracking-[0.3em] text-slate-300">
            Tap = entrar · Mantener = categorías
          </div>

          <div className="flex items-center gap-3">
            {FALCON_SECTIONS.map((section) => {
              const active = activeKey === section.key;
              const holding = holdingKey === section.key;

              return (
                <button
                  key={section.key}
                  onPointerDown={(event) => startPress(event, section)}
                  onPointerUp={endPress}
                  onPointerCancel={cancelPress}
                  onPointerLeave={cancelPress}
                  onPointerMove={handlePointerMove}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => handleClick(section)}
                  className={[
                    "group relative flex h-16 w-16 select-none flex-col items-center justify-center overflow-hidden rounded-2xl border text-center shadow-lg backdrop-blur-xl transition",
                    "touch-manipulation",
                    active
                      ? "border-cyan-300/45 bg-cyan-400/20 text-white"
                      : "border-white/15 bg-slate-900/60 text-slate-100 hover:bg-slate-800/70 hover:text-white",
                    holding ? "scale-[1.04] border-cyan-300/60 falcon-hold-glow" : "",
                  ].join(" ")}
                >
                  {holding && (
                    <>
                      <span className="falcon-hold-fill pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-cyan-400/45 via-fuchsia-400/35 to-violet-500/40" />

                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.35),transparent_45%)]" />

                      <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-violet-300" />
                    </>
                  )}

                  <span
                    className={[
                      "relative z-10 text-lg transition",
                      holding ? "scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]" : "",
                    ].join(" ")}
                  >
                    {section.icon}
                  </span>

                  <span className="relative z-10 mt-1 text-[11px] font-black text-inherit">
                    {section.label}
                  </span>

                  {holding && (
                    <span className="pointer-events-none absolute -top-1 right-1 z-10 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,1)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}