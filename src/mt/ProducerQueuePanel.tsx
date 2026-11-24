import React, { useMemo } from "react";
import WorkCommercialDocument from "../fiscal/WorkCommercialDocument";
import {
  aggregateWorkCards,
  collectWorkCards,
  humanWorkDomain,
  isWorkAssignedTo,
  workDomainIcon,
  type WorkAggregate,
} from "./Workadapter";

type Props = {
  allLive: any[];
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  hideOpen?: boolean;
  readOnly?: boolean;
  onOpenThread?: (threadId: string) => void;
};

function labelForStatus(status: WorkAggregate["status"]) {
  if (status === "planned") return "Planeado";
  if (status === "quoted") return "Cotizado";
  if (status === "in_progress") return "En curso";
  if (status === "awaiting_confirmation") return "Esperando confirmación";
  if (status === "done") return "Terminado";
  if (status === "cancelled") return "Cancelado";
  return "Abierto";
}

export default function ProducerQueuePanel({
  allLive,
  actorId,
  nodeId,
  orgId,
  territoryId,
  onOpenThread,
  readOnly = false,
}: Props) {
  const items = useMemo(() => {
    const aggregates = aggregateWorkCards(
      collectWorkCards(allLive, { actorId, nodeId, orgId, territoryId }),
    );
    return aggregates.filter(
      (item) =>
        item.status !== "open" &&
        Boolean(item.plan || item.execution || item.outcome || item.pack) &&
        isWorkAssignedTo(item, { actorId, nodeId, orgId }),
    );
  }, [allLive, actorId, nodeId, orgId, territoryId]);

  const grouped = useMemo(
    () => ({
      planned: items.filter((item) =>
        ["planned", "quoted"].includes(item.status),
      ),
      inProgress: items.filter((item) =>
        ["in_progress", "awaiting_confirmation"].includes(item.status),
      ),
      done: items.filter((item) => item.status === "done"),
    }),
    [items],
  );

  const column = (title: string, list: WorkAggregate[], tone: string) => (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18,
        background: "#fff",
        padding: 12,
        minHeight: 160,
        display: "grid",
        alignContent: "start",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b>{title}</b>
        <span
          style={{
            minWidth: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: tone,
            fontSize: 12,
            fontWeight: 950,
          }}
        >
          {list.length}
        </span>
      </div>

      {!list.length ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>Sin elementos</div>
      ) : (
        list.map((item) => (
          <div
            key={item.workId}
            style={{
              border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 14,
              padding: 10,
              background: item.technicalOnly
                ? "linear-gradient(180deg,#fff,#f7f3ff)"
                : "#fafafa",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 900 }}>
              {workDomainIcon(item.domain)} {item.title}
            </div>
            <div style={{ fontSize: 12, opacity: 0.68 }}>
              {humanWorkDomain(item.domain)} · {labelForStatus(item.status)}
            </div>
            {item.technicalOnly ? (
              <div style={{ fontSize: 11, opacity: 0.58 }}>
                🧩 Preparación técnica enlazada al mismo trabajo
              </div>
            ) : null}
            {!readOnly && item.status === "done" && (nodeId || actorId) ? <WorkCommercialDocument workId={item.workId} issuerNodeId={nodeId || actorId!} source={item.outcome?.source} /> : null}
            {item.threadId && onOpenThread ? (
              <button
                type="button"
                onClick={() => onOpenThread(item.threadId!)}
                style={{
                  justifySelf: "start",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 10,
                  padding: "7px 10px",
                  background: "#fff",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                Ver progreso
              </button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
      }}
    >
      {column("Planeados", grouped.planned, "rgba(138,43,226,0.14)")}
      {column("En curso", grouped.inProgress, "rgba(0,180,255,0.14)")}
      {column("Terminados", grouped.done, "rgba(30,200,120,0.14)")}
    </div>
  );
}
