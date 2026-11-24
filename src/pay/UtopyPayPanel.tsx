import React, { useEffect, useMemo, useState } from "react";
import {
  confirmUtopyPayParty,
  getUtopyPayView,
  openUtopyPaySession,
  reserveUtopyPayRoute,
  subscribeUtopyPay,
} from "./utopyPay";
import type {
  UtopyPaySessionInput,
  UtopyPayView,
} from "./utopyPay.types";

type Props = {
  input: UtopyPaySessionInput;
  proof?: string;
  onSession?: (view: UtopyPayView) => void;
};

const stateText: Record<string, string> = {
  missing: "Todavía no iniciado",
  open: "Elegí cómo pagar",
  route_reserved: "Método elegido",
  buyer_confirmed: "Esperando al comercio",
  merchant_confirmed: "Esperando al comprador",
  authorized: "Pago autorizado",
  settled: "Pago confirmado",
  expired: "Sesión vencida",
  cancelled: "Cancelado",
  refund_requested: "Reintegro solicitado",
  refunded: "Reintegrado",
};


function routeEmoji(kind: string) {
  if (kind === "interoperable_qr") return "📱";
  if (kind === "bank_transfer") return "🏦";
  if (kind === "cash") return "💵";
  if (kind === "commercial_credit") return "🗓️";
  if (kind === "local_balance" || kind === "refund_credit") return "✨";
  return "💳";
}

function routeDetailLines(details?: Record<string, any>) {
  if (!details) return [];
  const labels: Record<string, string> = {
    bank: "Banco", holder: "Titular", account: "Cuenta", alias: "Alias",
    document: "Documento", pixKey: "Clave PIX", instructions: "Cómo pagar",
    phone: "Teléfono", merchantId: "Comercio",
  };
  return Object.entries(details)
    .filter(([key, value]) => !["checkoutUrl", "sessionEndpoint", "qrPayload"].includes(key) && String(value ?? "").trim())
    .map(([key, value]) => `${labels[key] || key}: ${String(value)}`)
    .slice(0, 5);
}

export default function UtopyPayPanel({ input, proof, onSession }: Props) {
  const [view, setView] = useState<UtopyPayView>(() =>
    input.sessionId ? getUtopyPayView(input.sessionId) : getUtopyPayView(""),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const sessionId = view.session?.attrs.sessionId || input.sessionId || "";
  useEffect(() => {
    if (!sessionId) return;
    return subscribeUtopyPay(sessionId, (next) => {
      setView(next);
      onSession?.(next);
    });
  }, [sessionId, onSession]);

  const selectedRouteId = view.session?.attrs.selectedRouteId || "";
  const amountLabel = useMemo(
    () =>
      `${new Intl.NumberFormat("es-PY", {
        maximumFractionDigits: 2,
      }).format(view.session?.attrs.amount ?? input.amount)} ${
        view.session?.attrs.currency ?? input.currency
      }`,
    [
      input.amount,
      input.currency,
      view.session?.attrs.amount,
      view.session?.attrs.currency,
    ],
  );

  async function run(action: () => Promise<any>) {
    setBusy(true);
    setNotice("");
    try {
      const result = await action();
      const id =
        result?.attrs?.sessionId ||
        result?.session?.attrs?.sessionId ||
        input.sessionId;
      if (id) {
        const next = getUtopyPayView(id);
        setView(next);
        onSession?.(next);
      }
    } catch (error: any) {
      setNotice(error?.message || "No se pudo completar esta acción.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 22,
        color: "#0f172a",
        background:
          "radial-gradient(circle at 0 0, rgba(21,255,0,.13), transparent 42%), linear-gradient(145deg,#fff,#f4faf6)",
        border: "1px solid #dbe7df",
        boxShadow: "0 16px 42px rgba(15,23,42,.07)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".15em",
              color: "#168a2e",
            }}
          >
            UTOPY PAY · MÉTODOS DEL NODO
          </div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950 }}>
            Pagar {amountLabel}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
            Pagás al nodo. UTOPY conserva el acuerdo y su comprobante.
          </div>
        </div>
        <div
          style={{
            alignSelf: "start",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 900,
            color: "#166534",
            background: "#eafaea",
          }}
        >
          {stateText[view.state] || view.state}
        </div>
      </div>

      {!view.session ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => openUtopyPaySession(input))}
          style={{
            border: 0,
            borderRadius: 14,
            padding: "12px 16px",
            fontWeight: 950,
            color: "#052e16",
            background: "#4ade80",
            cursor: "pointer",
          }}
        >
          {busy ? "Preparando…" : "Elegir cómo pagar"}
        </button>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {view.session.attrs.routes.map((route) => {
              const active = route.id === selectedRouteId;
              return (
                <button
                  type="button"
                  key={route.id}
                  disabled={busy || view.authorized}
                  onClick={() =>
                    run(() =>
                      reserveUtopyPayRoute(
                        view.session!.attrs.sessionId,
                        route.id,
                        input.buyer.id,
                      ),
                    )
                  }
                  style={{
                    display: "grid",
                    gap: 3,
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 14,
                    border: active
                      ? "2px solid #4ade80"
                      : "1px solid #dce5df",
                    color: "#0f172a",
                    background: active
                      ? "#ecfdf0"
                      : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <b>{routeEmoji(route.kind)} {route.label}</b>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{route.description}</span>
                  {routeDetailLines(route.publicDetails).map((line) => (
                    <span key={line} style={{ fontSize: 11, color: "#166534" }}>{line}</span>
                  ))}
                  {route.publicDetails?.checkoutUrl ? (
                    <a
                      href={String(route.publicDetails.checkoutUrl)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      style={{ color: "#168a2e", fontSize: 11, fontWeight: 900 }}
                    >
                      Abrir pago seguro ↗
                    </a>
                  ) : null}
                  <span style={{ fontSize: 10, color: "#64748b" }}>
                    {route.fee > 0 ? `Costo informado: ${route.fee} ${route.currency}` : "Sin costo informado por el nodo"}
                  </span>
                </button>
              );
            })}
          </div>

          {view.route && !view.buyerConfirmed && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  confirmUtopyPayParty({
                    sessionId: view.session!.attrs.sessionId,
                    actorId: input.buyer.id,
                    actorName: input.buyer.name,
                    role: "buyer",
                    proof,
                  }),
                )
              }
              style={{
                border: 0,
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 950,
                color: "#052e16",
                background: "#4ade80",
                cursor: "pointer",
              }}
            >
              Confirmé este pago
            </button>
          )}

          <div style={{ fontSize: 12, color: "#64748b" }}>
            {view.buyerConfirmed ? "✓ Comprador confirmó" : "○ Falta comprador"}
            {" · "}
            {view.merchantConfirmed
              ? "✓ Comercio confirmó"
              : "○ Falta comercio"}
            {" · "}
            {view.settled ? "✓ Comprobante final" : "○ Confirmación pendiente"}
          </div>
          <details style={{ fontSize: 11, color: "#94a3b8" }}>
            <summary style={{ cursor: "pointer" }}>Ver referencia UTOPY</summary>
            {view.session.attrs.sessionId}
          </details>
        </>
      )}

      {notice ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#a16207" }}>
          {notice}
        </div>
      ) : null}
    </div>
  );
}
