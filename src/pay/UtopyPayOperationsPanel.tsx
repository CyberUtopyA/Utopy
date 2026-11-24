import React, { useEffect, useMemo, useState } from "react";
import { mtLiveSubscribe } from "../mt/mt.liveStore";
import {
  confirmUtopyPayParty,
  getUtopyPayView,
  startUtopyPayRuntime,
} from "./utopyPay";

const env = (import.meta as any)?.env || {};

export default function UtopyPayOperationsPanel() {
  const [all, setAll] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const operatorNodeId = String(env.VITE_UTOPY_NODE_ID || "").trim();
  const operatorMode =
    String(env.VITE_UTOPY_PAY_OPERATOR || "").toLowerCase() === "true";

  useEffect(() => {
    const stopRuntime = startUtopyPayRuntime();
    const stopStore = mtLiveSubscribe((items: any[]) => setAll(items || []));
    return () => {
      stopStore();
      stopRuntime();
    };
  }, []);

  const sessions = useMemo(
    () =>
      all
        .filter((dv) => dv?.kind === "pay.session")
        .map((dv) => getUtopyPayView(String(dv?.attrs?.sessionId), all))
        .filter((view) => view.session)
        .sort(
          (a, b) =>
            Date.parse(String(b.session?.attrs?.createdAt || "")) -
            Date.parse(String(a.session?.attrs?.createdAt || "")),
        )
        .slice(0, 12),
    [all],
  );

  async function merchantConfirm(sessionId: string, sellerId: string) {
    setBusyId(sessionId);
    setNotice("");
    try {
      await confirmUtopyPayParty({
        sessionId,
        actorId: sellerId,
        actorName: "Operador del nodo",
        role: "merchant",
        actingAsNodeId: sellerId,
        allLive: all,
      });
      setNotice("Cobro confirmado y firmado por el nodo.");
    } catch (error: any) {
      setNotice(error?.message || "No se pudo confirmar el cobro.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <div className="rounded-[30px] border border-emerald-200 bg-[#07110c] p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,.14)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">
              UTOPY Pay Libre · Malla de Liquidez Viva
            </div>
            <h2 className="mt-1 text-2xl font-black">
              Pagos que habilitan pedidos y entregas
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Una sola sesión conecta importe, ruta, firmas, comprobante,
              reintegro y la entrega Falcon. Ninguna entrega se libera antes
              del cobro confirmado.
            </p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
            {sessions.length} sesión(es)
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.length ? (
            sessions.map((view) => {
              const session = view.session!;
              const canOperate =
                operatorMode ||
                (!!operatorNodeId &&
                  [session.attrs.seller.id, session.attrs.seller.nodeId].includes(
                    operatorNodeId,
                  ));
              return (
                <article
                  key={session.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-xs font-black uppercase tracking-[.15em] text-emerald-300">
                    {view.state}
                  </div>
                  <div className="mt-1 text-lg font-black">
                    {session.attrs.amount.toLocaleString("es-PY")}{" "}
                    {session.attrs.currency}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {session.attrs.concept}
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    {view.buyerConfirmed ? "✓ comprador" : "○ comprador"} ·{" "}
                    {view.merchantConfirmed ? "✓ comercio" : "○ comercio"} ·{" "}
                    {view.settled ? "✓ liquidado" : "○ pendiente"}
                  </div>
                  {canOperate &&
                  view.route &&
                  !view.merchantConfirmed &&
                  !view.expired ? (
                    <button
                      type="button"
                      disabled={busyId === session.attrs.sessionId}
                      onClick={() =>
                        merchantConfirm(
                          session.attrs.sessionId,
                          session.attrs.seller.nodeId || session.attrs.seller.id,
                        )
                      }
                      className="mt-4 w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-emerald-950 disabled:opacity-50"
                    >
                      Confirmar cobro del nodo
                    </button>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              Todavía no hay Pagos Vivos. Aparecerán al iniciar un checkout en
              MS Market.
            </div>
          )}
        </div>
        {notice ? (
          <div className="mt-4 text-sm font-bold text-amber-300">{notice}</div>
        ) : null}
      </div>
    </section>
  );
}
