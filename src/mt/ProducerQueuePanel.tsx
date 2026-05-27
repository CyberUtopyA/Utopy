import React, { useMemo } from "react";
import {
  aggregateWorkCards,
  collectWorkCards,
  type WorkAggregate,
} from "./Workadapter";

type Props = {
  allLive: any[];
  actorId?: string | null;
  actorName?: string | null;
  nodeId?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
};

function toneForStatus(status: WorkAggregate["status"]) {
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
      return "Abierto";
    case "planned":
      return "Planeado";
    case "quoted":
      return "Cotizado";
    case "in_progress":
      return "En curso";
    case "done":
      return "Terminado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export default function ProducerQueuePanel({
  allLive,
  actorId,
  nodeId,
  orgId,
  territoryId,
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

  const grouped = useMemo(() => {
    return {
      open: items.filter((x) => x.status === "open"),
      planned: items.filter((x) => x.status === "planned" || x.status === "quoted"),
      inProgress: items.filter((x) => x.status === "in_progress"),
      done: items.filter((x) => x.status === "done"),
    };
  }, [items]);

  const column = (title: string, list: WorkAggregate[], tone: string) => (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 18,
        background: "#fff",
        padding: 12,
        display: "grid",
        gap: 10,
        minHeight: 180,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <b>{title}</b>
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            padding: "4px 8px",
            borderRadius: 999,
            background: tone,
          }}
        >
          {list.length}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: 260,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {!list.length ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>Sin items</div>
        ) : (
          list.map((it) => {
            const isPack = !!it.base && it.base.kind === "mo.fabrication.pack";

            return (
              <div
                key={it.workId}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 10,
                  background: isPack
                    ? "linear-gradient(180deg, #fff 0%, #f7f3ff 100%)"
                    : "#fafafa",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 800 }}>{it.title}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  {it.domain}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {labelForStatus(it.status)}
                  {it.quantity != null ? ` · qty ${it.quantity}` : ""}
                  {it.materialCount != null ? ` · ${it.materialCount}` : ""}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {it.orgId ? `org ${it.orgId}` : ""}
                  {it.orgId && it.territoryId ? " · " : ""}
                  {it.territoryId ? `territorio ${it.territoryId}` : ""}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>🏭 Cola productiva</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Estado real del trabajo filtrado por actor, nodo, organización y territorio.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {column("Abiertos", grouped.open, "rgba(255,255,255,0.08)")}
        {column("Planeados", grouped.planned, "rgba(138,43,226,0.14)")}
        {column("En curso", grouped.inProgress, "rgba(0,180,255,0.16)")}
        {column("Terminados", grouped.done, "rgba(30,200,120,0.16)")}
      </div>
    </div>
  );
}