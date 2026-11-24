// src/mt/payments/ChargesList.tsx
// Lista mínima de autorizaciones y cobros. No infiere suscripciones.
// - Lee payment.mandate / payment.charge / payment.charge.accept

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { mtLiveSubscribe } from "./mt.liveStore";
import { emitPaymentChargeAccept } from "./mt.subscriptionIntent";

// 👇 identidad local (ajusta path)
import { useLocalBuyerIdentity } from "./uselocalbuyerindentity";

const Box = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 12px;
  background: #fff;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
`;

const Sub = styled.div`
  opacity: 0.75;
  font-size: 0.9rem;
`;

const Card = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 10px;
  background: #fff;
`;

const Btn = styled.button<{ tone?: "ok" | "warn" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.14);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 950;

  background: ${({ tone }) => (tone === "ok" ? "#111" : "#fff")};
  color: ${({ tone }) => (tone === "ok" ? "#fff" : "#111")};

  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
`;

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}
function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

export default function ChargesList() {
  const { buyerId } = useLocalBuyerIdentity();

  const [all, setAll] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = mtLiveSubscribe((xs: any[]) => setAll(Array.isArray(xs) ? xs : []));
    return () => {
      try { unsub?.(); } catch {}
    };
  }, []);

  const mandates = useMemo(() => {
    return all
      .filter((d: any) => safeStr(d?.kind) === "payment.mandate")
      .filter((d: any) => safeStr(d?.attrs?.buyerId) === safeStr(buyerId))
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [all, buyerId]);

  const charges = useMemo(() => {
    return all
      .filter((d: any) => safeStr(d?.kind) === "payment.charge")
      .filter((d: any) => safeStr(d?.attrs?.buyerId) === safeStr(buyerId))
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [all, buyerId]);

  const chargeAccepts = useMemo(() => {
    return all
      .filter((d: any) => safeStr(d?.kind) === "payment.charge.accept")
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [all]);

  const lastAcceptForCharge = (chargeId: string) => {
    const xs = chargeAccepts.filter((d: any) => safeStr(d?.attrs?.chargeId) === safeStr(chargeId));
    return xs[0] || null;
  };

  const act = async (chargeId: string, mandateId: string, ok: boolean) => {
    try {
      setBusyId(chargeId);
      await emitPaymentChargeAccept({
        chargeId,
        mandateId,
        ok,
        actorId: buyerId,
        note: ok ? "Acepto el cobro" : "Rechazo el cobro",
        ns: "mt:market",
        source: "ms.web.charges",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Row>
        <b>Débitos automáticos</b>
        <Sub>{mandates.length} autorizaciones</Sub>
      </Row>

      <div style={{ height: 10 }} />

      {mandates.length === 0 ? (
        <Sub>No tenés pagos automáticos activos.</Sub>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {mandates.map((m: any) => (
            <Card key={m.id}>
              <Row>
                <div style={{ fontWeight: 950 }}>
                  {m?.attrs?.label || "Pago automático"}
                </div>
                <Sub>{m?.attrs?.active ? "Activo" : "Pausado"}</Sub>
              </Row>
              <Sub>
                Vendedor: <b>{m?.attrs?.sellerName || "Participante"}</b> ·
                Máximo: <b>{Math.round(Number(m?.attrs?.amountMax || 0)).toLocaleString("es-PY")} {m?.attrs?.currency || "PYG"}</b>
              </Sub>
              <Sub>
                Frecuencia: <b>{m?.attrs?.interval}</b> cada <b>{m?.attrs?.every || 1}</b>
              </Sub>
            </Card>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />

      <Row>
        <b>Cobros</b>
        <Sub>{charges.length} pendientes</Sub>
      </Row>

      <div style={{ height: 10 }} />

      {charges.length === 0 ? (
        <Sub>No hay cobros todavía.</Sub>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {charges.map((c: any) => {
            const chargeId = safeStr(c?.id);
            const accept = lastAcceptForCharge(chargeId);
            const isBusy = busyId === chargeId;

            const status =
              accept == null ? "Pendiente" : accept?.attrs?.ok ? "Aceptado" : "Rechazado";

            return (
              <Card key={chargeId}>
                <Row>
                  <div style={{ fontWeight: 950 }}>
                    {Math.round(Number(c?.attrs?.amount || 0)).toLocaleString("es-PY")}{" "}
                    {c?.attrs?.currency || "PYG"}
                  </div>
                  <Sub>{status}</Sub>
                </Row>
                <Sub>
                  Vence: {c?.attrs?.dueTs ? new Date(c.attrs.dueTs).toLocaleString() : "—"}
                </Sub>

                {accept == null && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn tone="ok" disabled={isBusy} onClick={() => void act(chargeId, c?.attrs?.mandateId, true)}>
                      {isBusy ? "..." : "Aceptar"}
                    </Btn>
                    <Btn tone="warn" disabled={isBusy} onClick={() => void act(chargeId, c?.attrs?.mandateId, false)}>
                      {isBusy ? "..." : "Rechazar"}
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Box>
  );
}
