import React, { useMemo, useState } from "react";
import {
  aggregateWorkCards,
  collectWorkCards,
  deriveWorkEligibility,
  humanWorkDomain,
  workDomainIcon,
  type WorkAggregate,
} from "./Workadapter";
import {
  makeWorkPlanDV,
  makeWorkQuoteAcceptedDV,
  makeWorkQuoteDV,
} from "./work.action";
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
  if (status === "quoted") return "rgba(255,190,120,0.18)";
  if (status === "planned") return "rgba(138,43,226,0.14)";
  if (status === "in_progress") return "rgba(0,180,255,0.16)";
  if (status === "done") return "rgba(30,200,120,0.16)";
  if (status === "cancelled") return "rgba(255,80,80,0.14)";
  return "rgba(59,130,246,0.10)";
}

function labelForStatus(status: WorkAggregate["status"]) {
  if (status === "open") return "disponible";
  if (status === "planned") return "con plan";
  if (status === "quoted") return "cotizado";
  if (status === "in_progress") return "en curso";
  if (status === "done") return "terminado";
  if (status === "cancelled") return "cancelado";
  return status;
}

function relationArgs(it: WorkAggregate) {
  return {
    workId: it.workId,
    relationshipId: it.relationshipId,
    designId: it.designId,
    threadId: it.threadId,
    chainId: it.chainId,
    rootDvId: it.rootDvId,
    parentDvId:
      it.execution?.id || it.plan?.id || it.base?.id || it.pack?.id || null,
    sourceRefs: it.events.map((event) => ({ id: event.id, kind: event.kind })),
  };
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
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDays, setQuoteDays] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [quoteConditions, setQuoteConditions] = useState("");
  const items = useMemo(() => {
    const cards = collectWorkCards(allLive, {
      actorId,
      nodeId,
      orgId,
      territoryId,
    });

    return aggregateWorkCards(cards)
      .filter(
        (item) =>
          ["open", "quoted"].includes(item.status) && item.actionable && !item.technicalOnly,
      )
      .map((work) => ({
        work,
        eligibility: deriveWorkEligibility(allLive, work, {
          actorId,
          nodeId,
          orgId,
          territoryId,
        }),
      }));
  }, [allLive, actorId, nodeId, orgId, territoryId]);

  const takeWork = async (it: WorkAggregate) => {
    const eligibility = deriveWorkEligibility(allLive, it, {
      actorId,
      nodeId,
      orgId,
      territoryId,
    });
    if (!eligibility.eligible) return;
    await publishWorkDV(
      makeWorkPlanDV({
        ...relationArgs(it),
        title: it.title,
        actorId,
        actorName,
        nodeId,
        orgId,
        territoryId,
        domain: it.domain,
        existingParticipants: it.participants || [],
        unreadBy: it.unreadBy || [],
      }),
      {
        allLive,
        activeActor: { id: actorId, actorId, name: actorName },
        actingAsNodeId: nodeId || null,
        targetNodeId: it.sourceNodeId || null,
      },
    );
  };

  const needsQuote = (work: WorkAggregate) =>
    /fabric|manufact|carp|wood|mueble|design|build/i.test(
      `${work.domain} ${(work.requiredCapabilities || []).join(" ")}`,
    );

  const sendQuote = async (work: WorkAggregate) => {
    const amount = Number(quoteAmount);
    const estimatedDays = Number(quoteDays);
    const deposit = depositPercent.trim() ? Number(depositPercent) : 0;
    if (!actorId || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(estimatedDays) || estimatedDays <= 0) return;
    await publishWorkDV(
      makeWorkQuoteDV({
        ...relationArgs(work),
        title: work.title,
        actorId,
        actorName,
        nodeId,
        orgId,
        territoryId,
        domain: work.domain,
        existingParticipants: work.participants || [],
        unreadBy: work.unreadBy || [],
        amount,
        currency: "PYG",
        estimatedDays,
        depositPercent: Number.isFinite(deposit) ? deposit : 0,
        conditions: quoteConditions,
      }),
      {
        allLive,
        activeActor: { id: actorId, actorId, name: actorName },
        actingAsNodeId: nodeId || null,
        targetNodeId: work.sourceNodeId || null,
      },
    );
    setQuotingId(null);
    setQuoteAmount("");
    setQuoteDays("");
    setDepositPercent("");
    setQuoteConditions("");
  };

  const isRequester = (work: WorkAggregate) =>
    Boolean(
      actorId &&
        (work.base?.actorId === actorId ||
          (nodeId && work.base?.sourceNodeId === nodeId)),
    );

  const acceptQuote = async (work: WorkAggregate) => {
    const quote = work.quote?.source;
    if (!quote || !actorId || !isRequester(work)) return;
    await publishWorkDV(
      makeWorkQuoteAcceptedDV({
        ...relationArgs(work),
        quote,
        acceptedBy: actorId,
        actorId,
        actorName,
        nodeId,
        orgId,
        territoryId,
        domain: work.domain,
        existingParticipants: work.participants || [],
        unreadBy: work.unreadBy || [],
      }),
      {
        allLive,
        activeActor: { id: actorId, actorId, name: actorName },
        actingAsNodeId: nodeId || null,
        targetNodeId: String(quote?.attrs?.providerNodeId || quote?.meta?.originNode || "") || null,
      },
    );
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!items.length ? (
        <div
          style={{
            border: "1px dashed rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(0,0,0,0.02)",
            fontSize: 13,
            opacity: 0.72,
          }}
        >
          No hay acciones pendientes. Los packs técnicos quedan en la cola y no
          se repiten como solicitudes.
        </div>
      ) : (
        items.map(({ work: it, eligibility }) => (
          <div
            key={it.workId}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 16,
              padding: 12,
              background: "linear-gradient(180deg,#fff,#fafafa)",
              display: "grid",
              gap: 9,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950 }}>
                  {workDomainIcon(it.domain)} {it.title}
                </div>
                {it.subtitle ? (
                  <div style={{ marginTop: 3, fontSize: 12, opacity: 0.68 }}>
                    {it.subtitle}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  alignSelf: "start",
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: badgeColor(it.status),
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {labelForStatus(it.status)}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={pillStyle}>{humanWorkDomain(it.domain)}</span>
              {it.territoryId && territoryId === it.territoryId ? (
                <span style={pillStyle}>Cerca</span>
              ) : null}
              {it.quantity != null ? (
                <span style={pillStyle}>
                  {it.quantity} {it.quantity === 1 ? "pedido" : "pedidos"}
                </span>
              ) : null}
              {it.status === "quoted" && it.budget != null ? (
                <span style={pillStyle}>{Number(it.budget).toLocaleString("es-PY")} PYG</span>
              ) : null}
              {it.materialCount != null ? (
                <span style={pillStyle}>🪵 {it.materialCount} insumos</span>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {it.threadId ? (
                <button style={buttonStyle} onClick={() => onOpenThread?.(it.threadId!)}>
                  Ver
                </button>
              ) : null}

              {it.status === "quoted" && isRequester(it) ? (
                <button
                  style={{ ...buttonStyle, background: "rgba(34,197,94,.14)" }}
                  onClick={() => acceptQuote(it)}
                >
                  Aceptar cotización
                </button>
              ) : it.status === "open" && eligibility.eligible ? (
                <button
                  style={{ ...buttonStyle, background: "rgba(59,130,246,0.12)" }}
                  onClick={() => needsQuote(it) ? setQuotingId(it.workId) : takeWork(it)}
                >
                  {workDomainIcon(it.domain)} {needsQuote(it) ? "Enviar cotización" : "Tomar trabajo"}
                </button>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.68 }}>
                  {it.status === "quoted" ? "Cotización enviada; espera respuesta" : eligibility.reason}
                </span>
              )}
            </div>
            {it.status === "open" && eligibility.eligible && needsQuote(it) && quotingId === it.workId ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 7, padding: 9, borderRadius: 14, background: "rgba(59,130,246,.06)" }}>
                <input aria-label="Precio de la cotización" inputMode="decimal" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} placeholder="Precio PYG" style={inputStyle} />
                <input aria-label="Días estimados" inputMode="numeric" value={quoteDays} onChange={(event) => setQuoteDays(event.target.value)} placeholder="Días" style={inputStyle} />
                <input aria-label="Anticipo opcional" inputMode="decimal" value={depositPercent} onChange={(event) => setDepositPercent(event.target.value)} placeholder="Anticipo % (opcional)" style={inputStyle} />
                <input aria-label="Condiciones de la cotización" value={quoteConditions} onChange={(event) => setQuoteConditions(event.target.value)} placeholder="Condiciones o materiales incluidos" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
                <button style={{ ...buttonStyle, gridColumn: "1 / -1", background: "#111827", color: "#fff" }} onClick={() => sendQuote(it)} disabled={!quoteAmount || !quoteDays}>Enviar propuesta</button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.045)",
  fontSize: 11,
  fontWeight: 800,
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: "9px 11px",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid rgba(0,0,0,.1)",
  borderRadius: 10,
  padding: "9px 10px",
  background: "#fff",
};
