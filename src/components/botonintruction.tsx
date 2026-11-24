import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export default function BotonIntruction() {
  const { pathname } = useLocation();
  const DISMISS_KEY = "utopy.market.installDismissedAt";
  const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [showInstallNotice, setShowInstallNotice] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();

    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);

    const nav = window.navigator as Navigator & {
      standalone?: boolean;
    };

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;

    setIsIOS(ios);
    setIsInstalled(standalone);

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (!standalone && (!dismissedAt || Date.now() - dismissedAt > DISMISS_FOR_MS)) {
      const timer = window.setTimeout(() => {
        setShowInstallNotice(true);
      }, 2500);

      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const installEvent = event as BeforeInstallPromptEvent;

      setDeferredPrompt(installEvent);
      setShowInstallNotice(true);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallNotice(false);
      setShowModal(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowModal(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    setShowModal(true);
  };

  const dismiss = () => {
    setShowInstallNotice(false);
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  if (isInstalled || /^\/(?:lua|bassi|prueba)(?:\/|$)/i.test(pathname)) return null;

  return (
    <>
      {showInstallNotice && (
        <div className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] left-3 right-3 z-[9999] mx-auto max-w-sm animate-[slideDown_.35s_ease-out] md:bottom-5 md:left-auto md:right-5">
          <div className="rounded-2xl border border-white/20 bg-black/85 p-2.5 text-white shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-lg text-black shadow-lg">
                📲
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-black leading-tight">
                  Instalá MS Market
                </div>

                <div className="mt-0.5 text-xs leading-snug text-zinc-300">
                  Usalo como app desde tu pantalla principal.
                </div>
              </div>

              <button
                onClick={handleInstall}
                className="shrink-0 rounded-full bg-lime-400 px-3 py-2 text-xs font-black text-black active:scale-95"
              >
                Instalar
              </button>

              <button
                onClick={dismiss}
                className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-sm font-black text-white"
              >
                ×
              </button>
            </div>
          </div>

          <style>
            {`
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-20px) scale(.96);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}
          </style>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-lime-400 bg-zinc-950 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Instalar MS Market</h2>
                <p className="text-xs text-zinc-400">
                  Agregalo como app en tu celular.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-full bg-white px-3 py-1 font-black text-black"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  1. Abrí esta página en <b>Safari</b>.
                </div>

                <div className="rounded-2xl bg-zinc-900 p-3">
                  2. Tocá el botón <b>Compartir</b> ⬆️ abajo en Safari.
                </div>

                <div className="rounded-2xl bg-zinc-900 p-3">
                  3. Bajá y tocá <b>Agregar a pantalla de inicio</b>.
                </div>

                <div className="rounded-2xl bg-lime-400 p-3 font-black text-black">
                  4. Tocá <b>Agregar</b> y listo ✅
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  En Android, abrí desde <b>Chrome</b>.
                </div>

                <div className="rounded-2xl bg-zinc-900 p-3">
                  Tocá el menú <b>⋮</b> y elegí{" "}
                  <b>Agregar a pantalla principal</b>.
                </div>

                <div className="rounded-2xl bg-lime-400 p-3 font-black text-black">
                  Después se abrirá como app normal ✅
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
