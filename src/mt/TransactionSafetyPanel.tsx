// src/mt/TransactionSafetyPanel.tsx
// Protección visible del pedido: progreso, entrega, disputa y reembolso.

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { mtLiveUpsert } from "./mt.liveStore";
import { publishDatoVivo } from "./seedbus";
import {
  exportOwnedData,
  getOrCreateOwnerIdentity,
  sealOwnedDV,
} from "../utopy/ownership";
import WalletPanel from "../utopy/WalletPanel";
import {
  buildTransactionEventDV,
  canTransition,
  reduceTransaction,
  type FundsMode,
  type TransactionActorRole,
  type TransactionState,
} from "./mt.transactionProtocol";

type Props = {
  threadId: string;
  orderId?: string | null;
  chainId?: string | null;
  items: any[];
  actorId: string;
  actorName?: string | null;
  actorRole: TransactionActorRole;
  counterpartyId?: string | null;
  participants?: string[];
  amount?: number | null;
  currency?: string;
  fundsMode?: FundsMode;
  refundRailConnected?: boolean;
};

const Shell = styled.div`
  border: 1px solid rgba(17, 143, 58, 0.2);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 11px;
  background: linear-gradient(145deg, #f7fff8, #ffffff);
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const Status = styled.span<{ $paused?: boolean; $safe?: boolean }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 950;
  border: 1px solid rgba(0, 0, 0, 0.09);
  background: ${({ $paused, $safe }) =>
    $paused
      ? "rgba(245,158,11,0.15)"
      : $safe
        ? "rgba(34,197,94,0.14)"
        : "rgba(59,130,246,0.10)"};
`;

const Track = styled.div`
  height: 13px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
`;

const Fill = styled.div<{ $progress: number; $paused?: boolean }>`
  width: ${({ $progress }) => Math.max(2, Math.min(100, $progress))}%;
  height: 100%;
  border-radius: inherit;
  background: ${({ $paused }) =>
    $paused
      ? "linear-gradient(90deg,#f59e0b,#f97316)"
      : "linear-gradient(90deg,#16a34a,#35ff52)"};
  transition: width 0.35s ease;
`;

const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
  font-size: 10px;
  opacity: 0.72;
  text-align: center;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

const Button = styled.button<{ $danger?: boolean; $primary?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 11px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  color: ${({ $danger }) => ($danger ? "#991b1b" : "#07110a")};
  background: ${({ $danger, $primary }) =>
    $danger ? "#fff1f2" : $primary ? "#27ef4b" : "#fff"};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const Notice = styled.div<{ $warn?: boolean }>`
  border-radius: 12px;
  padding: 9px 10px;
  font-size: 12px;
  line-height: 1.4;
  background: ${({ $warn }) =>
    $warn ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.10)"};
  border: 1px solid
    ${({ $warn }) =>
      $warn ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.18)"};
`;

const STEP_LABELS = ["Acuerdo", "Protección", "Fabricación", "Entrega", "Confirmado"];

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

export default function TransactionSafetyPanel({
  threadId,
  orderId = null,
  chainId = null,
  items,
  actorId,
  actorName = "Actor local",
  actorRole,
  counterpartyId = null,
  participants = [],
  amount = null,
  currency = "PYG",
  fundsMode = "none",
  refundRailConnected = false,
}: Props) {
  const [sending, setSending] = useState(false);
  const [localEvents, setLocalEvents] = useState<any[]>([]);
  const [ownerDid, setOwnerDid] = useState("");
  useEffect(() => {
    void getOrCreateOwnerIdentity().then((identity) => setOwnerDid(identity.did));
  }, []);
  useEffect(() => {
    const receiveReplica = (event: Event) => {
      const dv = (event as CustomEvent)?.detail?.dv;
      if (dv) mtLiveUpsert(dv);
    };
    window.addEventListener("utopy.replica.incoming", receiveReplica);
    return () => window.removeEventListener("utopy.replica.incoming", receiveReplica);
  }, []);
  const protection = useMemo(
    () => ({
      fundsMode,
      refundRailConnected,
      paymentRail: refundRailConnected ? "cajero" : null,
    }),
    [fundsMode, refundRailConnected]
  );
  const snapshot = useMemo(
    () => reduceTransaction([...(items || []), ...localEvents], protection),
    [items, localEvents, protection]
  );

  const publishState = async (
    state: TransactionState,
    reason?: string | null,
    evidenceRefs: string[] = []
  ) => {
    if (sending) return;
    const permission = canTransition(snapshot.state, state, actorRole);
    if (!permission.ok) {
      alert(permission.reason || "Cambio no permitido.");
      return;
    }
    setSending(true);
    try {
      const event = buildTransactionEventDV({
        threadId,
        orderId,
        chainId,
        state,
        previousState: snapshot.state,
        actorId,
        actorName,
        actorRole,
        toActorId: counterpartyId,
        participants: uniq([...participants, actorId, counterpartyId]),
        reason,
        amount,
        currency,
        protection,
        evidenceRefs,
      });
      const signed = await sealOwnedDV(event, actorId);
      mtLiveUpsert(signed);
      setLocalEvents((current) => [...current, signed]);
      try {
        await publishDatoVivo(signed);
      } catch (error) {
        console.warn("[UTOPY Protección] publicación por seedbus falló", error);
        window.dispatchEvent(
          new CustomEvent("utopy.emit", {
            detail: { ns: "mt", say: "dv.upsert", dv: signed },
          })
        );
      }
    } finally {
      setSending(false);
    }
  };

  const requestRefund = async () => {
    const reason = prompt(
      "Motivo del reembolso:",
      "El pedido no puede continuar en las condiciones acordadas."
    );
    if (!reason?.trim()) return;
    await publishState("refund_requested", reason);
  };

  const openDispute = async () => {
    const reason = prompt(
      "Explica qué necesita revisión:",
      "Necesito que el Cajero revise este pedido antes de continuar."
    );
    if (!reason?.trim()) return;
    await publishState("disputed", reason);
  };

  const askEvidenceAndPublish = async (state: TransactionState, label: string) => {
    const reference = prompt(
      `${label}. Referencia o comprobante opcional:`,
      ""
    );
    await publishState(state, label, reference?.trim() ? [reference.trim()] : []);
  };

  const can = (next: TransactionState) =>
    !sending && canTransition(snapshot.state, next, actorRole).ok;

  const downloadMyData = async () => {
    const blob = await exportOwnedData([...(items || []), ...localEvents]);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `utopy-datos-${threadId.replace(/[^a-z0-9_-]+/gi, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const publishWalletEvent = async (dv: any) => {
    mtLiveUpsert(dv);
    try {
      await publishDatoVivo(dv);
    } catch {
      window.dispatchEvent(new CustomEvent("utopy.emit", {
        detail: { ns: "mt", say: "dv.upsert", dv },
      }));
    }
  };

  return (
    <Shell>
      <Row>
        <div>
          <div style={{ fontWeight: 950 }}>🛡️ Pedido protegido</div>
          <div style={{ opacity: 0.68, fontSize: 12 }}>
            Historial firmado · sin cambios automáticos
          </div>
        </div>
        <Status $paused={snapshot.paused} $safe={snapshot.refundGuaranteed}>
          {snapshot.paused ? "⏸ " : ""}
          {snapshot.label} · {snapshot.progress}%
        </Status>
      </Row>

      <div>
        <Track>
          <Fill $progress={snapshot.progress} $paused={snapshot.paused} />
        </Track>
        <Steps>
          {STEP_LABELS.map((label) => <span key={label}>{label}</span>)}
        </Steps>
      </div>

      {snapshot.refundGuaranteed ? (
        <Notice>
          ✅ Fondos en custodia y canal de reembolso conectado. La liberación
          necesita confirmación.
        </Notice>
      ) : (
        <Notice $warn>
          ⚠️ El hilo y las pruebas están protegidos, pero el dinero todavía no
          está garantizado por custodia. El Cajero debe confirmar cualquier
          devolución real.
        </Notice>
      )}

      <Actions>
        {actorRole === "buyer" ? (
          <>
            <Button $primary disabled={!can("accepted")} onClick={() => publishState("accepted", "Acepto las condiciones del pedido")}>Aceptar pedido</Button>
            <Button $primary disabled={!can("completed")} onClick={() => publishState("completed", "Entrega revisada y confirmada")}>Confirmar entrega</Button>
            <Button disabled={!can("cancelled")} onClick={() => publishState("cancelled", "Pedido cancelado antes de comenzar la fabricación")}>Cancelar pedido</Button>
            <Button $danger disabled={!can("refund_requested")} onClick={requestRefund}>Solicitar reembolso</Button>
            <Button $danger disabled={!can("disputed")} onClick={openDispute}>Abrir revisión</Button>
          </>
        ) : null}

        {actorRole === "seller" || actorRole === "provider" ? (
          <>
            <Button $primary disabled={!can("in_production")} onClick={() => publishState("in_production", "Comenzó la fabricación")}>Iniciar fabricación</Button>
            <Button $primary disabled={!can("ready")} onClick={() => publishState("ready", "Producción terminada y lista")}>Marcar listo</Button>
            <Button disabled={!can("in_transit")} onClick={() => publishState("in_transit", "Pedido en camino")}>En camino</Button>
            <Button disabled={!can("delivered")} onClick={() => publishState("delivered", "Entrega realizada; pendiente de confirmación")}>Informar entrega</Button>
            <Button $danger disabled={!can("refund_approved")} onClick={() => publishState("refund_approved", "El proveedor aprueba la devolución")}>Aprobar reembolso</Button>
            <Button $danger disabled={!can("disputed")} onClick={openDispute}>Abrir revisión</Button>
          </>
        ) : null}

        {actorRole === "cajero" ? (
          <>
            <Button $primary disabled={!can("funds_held")} onClick={() => publishState("funds_held", "Fondos confirmados en custodia")}>Confirmar custodia</Button>
            <Button $danger disabled={!can("refunded") || !refundRailConnected} onClick={() => askEvidenceAndPublish("refunded", "Reembolso ejecutado por el medio de pago")}>Confirmar reembolso</Button>
            <Button disabled={!can("resolved")} onClick={() => askEvidenceAndPublish("resolved", "Caso revisado y resuelto")}>Resolver revisión</Button>
          </>
        ) : null}

        <Button onClick={downloadMyData}>⬇️ Descargar mis DV</Button>
      </Actions>

      <div style={{ fontSize: 11, opacity: 0.64 }}>
        {snapshot.history.length} evento(s) verificable(s) · identidad: {ownerDid ? `${ownerDid.slice(0, 24)}…` : "creando…"}
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>🔐 Billetera de identidad y datos</summary>
        <div style={{ marginTop: 9 }}>
          <WalletPanel compact onPublish={publishWalletEvent} />
        </div>
      </details>
    </Shell>
  );
}
