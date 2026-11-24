// src/mt/payments/SubscriptionPanel.tsx
// UI mínima para solicitar débito automático sobre una recurrencia real.
// - Lee payment.offer (métodos aceptados)
// - Lee payment.plan.offer (planes del seller)
// - Publica una solicitud; el nodo de pago publica la autorización real.

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import { mtLiveSubscribe } from "./mt.liveStore";
import { usePaymentOffer } from "./resolveOffer";
import type { PaymentMethod } from "./mt.intentpayment";
import {
  buildAutopayAuthorizationRequestDV,
  publishSubscriptionDV,
} from "./mt.subscriptionIntent";
import type { PaymentPlanOfferDV } from "./mt.subscriptionIntent";
import { deriveSubscriptionState, resolveDvThreadId } from "./mt.threadProtocol";

// 👇 usa tu identidad local existente
import { useLocalBuyerIdentity } from "./uselocalbuyerindentity"; // AJUSTA PATH si tu hook está en otro lado

const MOBILE_BP = 600;

const Backdrop = styled.div<{ open: boolean }>`
  position: fixed;
  inset: 0;
  display: ${({ open }) => (open ? "grid" : "none")};
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1200;
  padding: 12px;
`;

const Box = styled.div`
  width: min(560px, 96vw);
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 24px 60px rgba(0,0,0,0.22);
  overflow: hidden;
`;

const Head = styled.div`
  padding: 14px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  font-weight: 950;
`;

const Body = styled.div`
  padding: 14px;
  display: grid;
  gap: 12px;
`;

const Row = styled.div`
  display: grid;
  gap: 6px;
`;

const Sub = styled.div`
  opacity: 0.78;
  font-size: 0.9rem;
`;

const PillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Pill = styled.button<{ active?: boolean }>`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 999px;
  padding: 8px 10px;
  background: ${({ active }) => (active ? "#111" : "#fff")};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  font-weight: 900;
  cursor: pointer;
`;

const Input = styled.input`
  border: 1px solid rgba(0,0,0,0.14);
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 900;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;

  @media (max-width: ${MOBILE_BP}px) {
    flex-direction: column;
  }
`;

const Btn = styled.button<{ tone?: "dark" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.14);
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 950;
  cursor: pointer;

  background: ${({ tone }) => (tone === "dark" ? "#111" : "#fff")};
  color: ${({ tone }) => (tone === "dark" ? "#fff" : "#111")};

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

function isPlanOffer(d: any): d is PaymentPlanOfferDV {
  return safeStr(d?.kind) === "payment.plan.offer";
}

export type SubscriptionPanelProps = {
  open: boolean;
  onClose: () => void;

  sellerId: string;
  sellerName?: string | null;
  threadId?: string | null;
  chainId?: string | null;
  rootDvId?: string | null;
  subscriptionId?: string | null;
  allLive?: any[];

  // opcional: si querés sugerir un monto
  suggestAmount?: number;
  currency?: string; // "PYG"
};

export default function SubscriptionPanel(props: SubscriptionPanelProps) {
  const {
    open,
    onClose,
    sellerId,
    sellerName,
    threadId = null,
    chainId = null,
    rootDvId = null,
    subscriptionId = null,
    allLive: externalAll = null,
    suggestAmount,
    currency = "PYG",
  } = props;

  const { buyerId, name: buyerName } = useLocalBuyerIdentity();

  // 1) métodos aceptados (payment.offer)
  const { offer } = usePaymentOffer({ sellerId });

  // 2) planes del seller (payment.plan.offer)
  const [localAll, setLocalAll] = useState<any[]>([]);
  useEffect(() => {
    if (externalAll) return;
    const unsub = mtLiveSubscribe((xs: any[]) =>
      setLocalAll(Array.isArray(xs) ? xs : []),
    );
    return () => {
      try { unsub?.(); } catch {}
    };
  }, [externalAll]);
  const all = externalAll || localAll;

  const plans = useMemo(() => {
    const arr = all
      .filter(isPlanOffer)
      .filter((d) => safeStr(d?.attrs?.sellerId) === safeStr(sellerId))
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
    return arr;
  }, [all, sellerId]);

  const recurrence = useMemo(() => {
    if (!threadId) return deriveSubscriptionState([], buyerId);
    return deriveSubscriptionState(
      all.filter((dv) => resolveDvThreadId(dv, all) === threadId),
      buyerId,
    );
  }, [all, buyerId, threadId]);

  // estado UI
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | null>(null);
  const [interval, setPlanInterval] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [every, setEvery] = useState<number>(1);
  const [amountMax, setAmountMax] = useState<number>(Math.max(0, Number(suggestAmount || 0)));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // si hay planes, auto-seleccionar el más nuevo para sugerir config
  useEffect(() => {
    if (!open) return;
    const p = plans[0];
    if (p) {
      const a = Number(p?.attrs?.amount ?? 0);
      const i = safeStr(p?.attrs?.interval) as any;
      const e = Number(p?.attrs?.every ?? 1);

      if (a > 0) setAmountMax(a);
      if (i === "weekly" || i === "daily" || i === "monthly") setPlanInterval(i);
      if (Number.isFinite(e) && e > 0) setEvery(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plans.length]);

  const accepted = offer?.accepted || [];
  const canCreate =
    !!buyerId &&
    !!sellerId &&
    !!threadId &&
    recurrence.status === "active" &&
    recurrence.autopay.status !== "active" &&
    amountMax > 0;

  const createMandate = async () => {
    try {
      setBusy(true);
      setMsg(null);

      if (!buyerId) throw new Error("No hay buyerId (identidad local).");
      if (!sellerId) throw new Error("No hay sellerId.");
      if (!amountMax || amountMax <= 0) throw new Error("Monto máximo inválido.");

      if (!threadId || recurrence.status !== "active") {
        throw new Error("Primero debe existir un acuerdo recurrente activo.");
      }

      await publishSubscriptionDV(
        buildAutopayAuthorizationRequestDV({
          threadId,
          chainId,
          rootDvId,
          parentDvId: recurrence.evidence.subscription?.id || null,
          subscriptionId:
            subscriptionId || recurrence.subscriptionId || null,
          actorId: buyerId,
          actorName: buyerName ?? null,
          participants: [buyerId, sellerId],
          sellerId,
          buyerId,
          interval,
          every,
          amountMax,
          currency,
          chosen: chosenMethod ?? null,
          reason: `Solicitado para el plan ${plans?.[0]?.attrs?.planId || "acordado"}`,
        }),
      );

      setMsg("Solicitud enviada. Se activará cuando el nodo de pago confirme.");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo crear el débito automático.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop open={open} onClick={onClose}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Head>
          <div>Débito automático</div>
          <Btn tone="ghost" onClick={onClose} disabled={busy}>Cerrar</Btn>
        </Head>

        <Body>
          <Row>
            <Sub>
              Vendedor/Caja: <b>{sellerName || offer?.sellerName || sellerId}</b>
            </Sub>
            {offer?.text ? <Sub>{offer.text}</Sub> : null}
          </Row>

          {recurrence.status !== "active" ? (
            <Row>
              <Sub>
                El pago automático solo puede solicitarse después de aceptar un
                abastecimiento recurrente. Una necesidad semanal todavía no es
                una suscripción.
              </Sub>
            </Row>
          ) : recurrence.autopay.status === "active" ? (
            <Row>
              <Sub><b>Pago automático activo.</b> Existe una autorización confirmada.</Sub>
            </Row>
          ) : null}

          {/* Planes del vendedor (si existen) */}
          {plans.length > 0 && (
            <Row>
              <div style={{ fontWeight: 950 }}>Planes disponibles</div>
              <PillRow>
                {plans.slice(0, 6).map((p: any) => {
                  const label = safeStr(p?.attrs?.label || "Plan");
                  const amt = Number(p?.attrs?.amount ?? 0);
                  const cur = safeStr(p?.attrs?.currency || currency);
                  return (
                    <Pill
                      key={p.id}
                      onClick={() => {
                        const i = safeStr(p?.attrs?.interval) as any;
                        const e = Number(p?.attrs?.every ?? 1);
                        if (i === "weekly" || i === "daily" || i === "monthly") setPlanInterval(i);
                        if (Number.isFinite(e) && e > 0) setEvery(e);
                        if (amt > 0) setAmountMax(amt);
                      }}
                    >
                      {label} · {Math.round(amt).toLocaleString("es-PY")} {cur}
                    </Pill>
                  );
                })}
              </PillRow>
            </Row>
          )}

          {/* Intervalo */}
          <Row>
            <div style={{ fontWeight: 950 }}>Frecuencia</div>
            <PillRow>
              <Pill active={interval === "monthly"} onClick={() => setPlanInterval("monthly")}>Mensual</Pill>
              <Pill active={interval === "weekly"} onClick={() => setPlanInterval("weekly")}>Semanal</Pill>
              <Pill active={interval === "daily"} onClick={() => setPlanInterval("daily")}>Diario</Pill>
            </PillRow>

            <Sub>Cada</Sub>
            <Input
              type="number"
              min={1}
              value={every}
              onChange={(e) => setEvery(Math.max(1, Number(e.target.value || 1)))}
            />
          </Row>

          {/* Monto max */}
          <Row>
            <div style={{ fontWeight: 950 }}>Monto máximo por ciclo</div>
            <Input
              type="number"
              min={0}
              value={amountMax}
              onChange={(e) => setAmountMax(Math.max(0, Number(e.target.value || 0)))}
              placeholder={`Ej: 150000 ${currency}`}
            />
            <Sub>Moneda: <b>{currency}</b></Sub>
          </Row>

          {/* Método elegido (opcional) */}
          <Row>
            <div style={{ fontWeight: 950 }}>Método de pago (opcional)</div>
            {accepted.length === 0 ? (
              <Sub>No hay PaymentOffer publicado para este vendedor/caja aún.</Sub>
            ) : (
              <PillRow>
                {accepted.slice(0, 8).map((m: any, idx: number) => {
                  const label = safeStr(m?.label || m?.channel || `Metodo ${idx + 1}`);
                  const addr = safeStr(m?.address || m?.link || "");
                  const active = chosenMethod?.channel === m?.channel && safeStr(chosenMethod?.address) === safeStr(m?.address);
                  return (
                    <Pill
                      key={`${label}-${idx}`}
                      active={active}
                      onClick={() => setChosenMethod(m)}
                      title={addr}
                    >
                      {label}
                    </Pill>
                  );
                })}
              </PillRow>
            )}
            <Sub style={{ opacity: 0.7 }}>
              Tip: si dejás vacío, el vendedor/caja decide cómo cobrarte.
            </Sub>
          </Row>

          {msg ? <Sub><b>{msg}</b></Sub> : null}

          <BtnRow>
            <Btn tone="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
            <Btn tone="dark" onClick={() => void createMandate()} disabled={busy || !canCreate}>
              {busy ? "Enviando..." : "Solicitar pago automático"}
            </Btn>
          </BtnRow>
        </Body>
      </Box>
    </Backdrop>
  );
}
