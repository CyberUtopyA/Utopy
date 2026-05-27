import React, { useMemo } from "react";
import {
  aggregateWorkCards,
  collectWorkCards,
  type WorkAggregate,
} from "./Workadapter";
import { makeWorkExecutionDV, makeWorkOutcomeDV } from "./work.action";
import { publishWorkDV } from "./work.publish";

type Props = {
  allLive: any[];
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  onOpenThread?: (threadId: string) => void;
};

function badgeColor(status: WorkAggregate["status"]) {
  switch (status) {
    case "planned":
      return "rgba(138,43,226,0.14)";
    case "quoted":
      return "rgba(255,190,120,0.16)";
    case "in_progress":
      return "rgba(0,180,255,0.16)";
    case "done":
      return "rgba(30,200,120,0.16)";
    case "cancelled":
      return "rgba(255,80,80,0.14)";
    case "open":
    default:
      return "rgba(255,255,255,0.08)";
  }
}

function labelForStatus(status: WorkAggregate["status"]) {
  switch (status) {
    case "open":
      return "abierto";
    case "planned":
      return "planeado";
    case "quoted":
      return "cotizado";
    case "in_progress":
      return "en curso";
    case "done":
      return "finalizado";
    case "cancelled":
      return "cancelado";
    default:
      return status;
  }
}

export default function WorkInboxPanel({
  allLive,
  actorId,
  actorName,
  nodeId,
  orgId,
  territoryId,
  onOpenThread,
}: Props) {
  const items = useMemo(() => {
    const cards = collectWorkCards(allLive, {
      actorId,
      nodeId,
      orgId,
      territoryId,
    });
    return aggregateWorkCards(cards);
  }, [allLive, actorId, nodeId, orgId, territoryId]);

  const takeWork = async (it: WorkAggregate) => {
    const dv = makeWorkExecutionDV({
      workId: it.workId,
      title: `Tomado: ${it.title}`,
      threadId: it.threadId,
      chainId: it.chainId,
      actorId,
      actorName,
      nodeId,
      orgId,
      territoryId,
      domain: it.domain,
      existingParticipants: it.participants || [],
      unreadBy: it.unreadBy || [],
    });

    await publishWorkDV(dv);
  };

  const finishWork = async (it: WorkAggregate) => {
    const dv = makeWorkOutcomeDV({
      workId: it.workId,
      title: `Finalizado: ${it.title}`,
      threadId: it.threadId,
      chainId: it.chainId,
      actorId,
      actorName,
      nodeId,
      orgId,
      territoryId,
      domain: it.domain,
      result: "done",
      existingParticipants: it.participants || [],
      unreadBy: it.unreadBy || [],
    });

    await publishWorkDV(dv);
  };

  const cancelWork = async (it: WorkAggregate) => {
    const dv = makeWorkOutcomeDV({
      workId: it.workId,
      title: `Cancelado: ${it.title}`,
      threadId: it.threadId,
      chainId: it.chainId,
      actorId,
      actorName,
      nodeId,
      orgId,
      territoryId,
      domain: it.domain,
      result: "cancelled",
      existingParticipants: it.participants || [],
      unreadBy: it.unreadBy || [],
    });

    await publishWorkDV(dv);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 20,
        background: "#fff",
        padding: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>🧰 Inbox laboral</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Trabajo vivo filtrado por actor, nodo, organización y territorio.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          maxHeight: 420,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {!items.length ? (
          <div style={{ fontSize: 13, opacity: 0.72 }}>
            Aún no hay trabajo asignado o visible.
          </div>
        ) : (
          items.map((it) => {
            const isPack = !!it.base && it.base.kind === "mo.fabrication.pack";

            return (
              <div
                key={it.workId}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  padding: 12,
                  background: isPack
                    ? "linear-gradient(180deg, #fff 0%, #f7f3ff 100%)"
                    : "linear-gradient(180deg, #fff 0%, #fafafa 100%)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{it.title}</div>
                    {it.subtitle ? (
                      <div style={{ fontSize: 13, opacity: 0.75 }}>{it.subtitle}</div>
                    ) : null}
                  </div>

                  <span
                    style={{
                      alignSelf: "start",
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: badgeColor(it.status),
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {labelForStatus(it.status)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 12,
                    opacity: 0.78,
                  }}
                >
                  <span>dominio: <b>{it.domain}</b></span>
                  {it.quantity != null ? <span>cantidad: <b>{it.quantity}</b></span> : null}
                  {it.materialCount != null ? <span>materiales/piezas: <b>{it.materialCount}</b></span> : null}
                  {it.orgId ? <span>org: <b>{it.orgId}</b></span> : null}
                  {it.territoryId ? <span>territorio: <b>{it.territoryId}</b></span> : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {it.threadId ? (
                    <button
                      onClick={() => onOpenThread?.(it.threadId!)}
                      style={{
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Abrir hilo
                    </button>
                  ) : null}

                  {(it.status === "planned" || it.status === "open") ? (
                    <button
                      onClick={() => takeWork(it)}
                      style={{
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: "rgba(59,130,246,0.10)",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Tomar trabajo
                    </button>
                  ) : null}

                  {it.status === "in_progress" ? (
                    <>
                      <button
                        onClick={() => finishWork(it)}
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: "rgba(34,197,94,0.12)",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        Marcar terminado
                      </button>

                      <button
                        onClick={() => cancelWork(it)}
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: "rgba(239,68,68,0.10)",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        Cancelar trabajo
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}