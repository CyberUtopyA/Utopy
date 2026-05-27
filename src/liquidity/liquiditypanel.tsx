import React, { useMemo, useState } from "react";
import { useLiquidity, useLiquidityCounterparties } from "./useliquidity";
import { useLiquidityStore } from "./liquidity.store";
import type { DVLike } from "./mt.liquidity";
import { asCurrency, safeNum } from "./mt.liquidity";

type Props = {
  actorId?: string;
  actorName?: string;
  defaultCurrency?: string;
  className?: string;
  onUseInCheckout?: (payload: {
    actorId: string;
    currency: string;
    available: number;
    spendable: number;
    trustScore: number;
  }) => void;
  onOpenPayCenter?: () => void;
};

const UI = {
  text: "#0f172a",
  textSoft: "rgba(15,23,42,0.72)",
  textMuted: "rgba(15,23,42,0.56)",
  border: "rgba(15,23,42,0.10)",
  borderStrong: "rgba(15,23,42,0.16)",
  card: "#ffffff",
  cardSoft: "rgba(15,23,42,0.03)",
  greenBg: "rgba(16,185,129,0.10)",
  greenText: "#047857",
  amberBg: "rgba(245,158,11,0.12)",
  amberText: "#b45309",
  blueBg: "rgba(59,130,246,0.10)",
  blueText: "#1d4ed8",
  redBg: "rgba(239,68,68,0.10)",
  redText: "#b91c1c",
};

const card: React.CSSProperties = {
  border: `1px solid ${UI.border}`,
  background: UI.card,
  borderRadius: 18,
  padding: 14,
  color: UI.text,
  boxShadow: "0 6px 22px rgba(15,23,42,0.05)",
};

const softCard: React.CSSProperties = {
  border: `1px solid ${UI.border}`,
  background: UI.cardSoft,
  borderRadius: 14,
  padding: 12,
};

const btn: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${UI.borderStrong}`,
  background: "#fff",
  color: UI.text,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const selectStyle: React.CSSProperties = {
  ...btn,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

function fmtAmount(n: number, currency = "PYG") {
  return `${Math.round(n).toLocaleString("es-PY")} ${currency}`;
}

function fmtDate(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("es-PY", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(ts);
  }
}

function getThreadId(dv: DVLike) {
  return dv?.attrs?.threadId || "-";
}

function getTitle(dv: DVLike) {
  if (dv.kind === "liq.issue") return "Issue";
  if (dv.kind === "liq.redeem") return "Redeem";
  if (dv.kind === "liq.transfer") return "Transfer";
  if (dv.kind === "liq.lock") return "Lock";
  if (dv.kind === "liq.unlock") return "Unlock";
  if (dv.kind === "liq.credit.line") return "Credit line";
  if (dv.kind === "liq.trust") return "Trust";
  return dv.kind;
}

function getTs(dv: DVLike) {
  return (
    safeNum((dv as any)?.ts, 0) ||
    safeNum(Date.parse((dv as any)?.meta?.ts || ""), 0) ||
    safeNum(Date.parse((dv as any)?.attrs?.ts || ""), 0)
  );
}

function DeltaText({ dv, currency }: { dv: DVLike; currency: string }) {
  if (dv.kind === "liq.trust") {
    const delta = safeNum((dv as any)?.attrs?.scoreDelta, 0);
    const pct = Math.round(delta * 100);
    return (
      <span style={{ color: delta >= 0 ? UI.blueText : UI.redText, fontWeight: 800 }}>
        {pct >= 0 ? `+${pct}` : pct} pts
      </span>
    );
  }

  const amount = safeNum((dv as any)?.attrs?.amount || (dv as any)?.attrs?.amountMax || 0);
  return (
    <span style={{ color: UI.text, fontWeight: 800 }}>
      {fmtAmount(amount, (dv as any)?.attrs?.currency || currency)}
    </span>
  );
}

export default function MtLiquidityPanel({
  actorId,
  actorName,
  defaultCurrency = "PYG",
  className,
  onUseInCheckout,
  onOpenPayCenter,
}: Props) {
  const dvs = useLiquidityStore((s) => s.dvs);
  const getThreadSummary = useLiquidityStore((s) => s.getThreadSummary);

  const [currency, setCurrency] = useState(asCurrency(defaultCurrency));
  const [selectedThread, setSelectedThread] = useState<string>("");

  const { account, trust, currencies, available, spendable, reserved, trustScore } =
    useLiquidity(actorId, currency);

  const counterparties = useLiquidityCounterparties(actorId);

  const actorHistory = useMemo(() => {
    if (!actorId) return [];
    return dvs.filter((dv) => {
      const a = dv.attrs || {};
      return (
        a?.actor?.id === actorId ||
        a?.beneficiary?.id === actorId ||
        a?.from?.id === actorId ||
        a?.to?.id === actorId ||
        a?.actorId === actorId ||
        a?.buyerId === actorId ||
        a?.sellerId === actorId
      );
    });
  }, [actorId, dvs]);

  const threadIds = useMemo(() => {
    const out = new Set<string>();
    for (const dv of actorHistory) {
      const tid = dv?.attrs?.threadId;
      if (tid) out.add(tid);
    }
    return [...out].sort();
  }, [actorHistory]);

  const threadSummary = useMemo(() => {
    if (!selectedThread) return null;
    return getThreadSummary(selectedThread, currency);
  }, [selectedThread, currency, getThreadSummary]);

  const latestHistory = useMemo(() => {
    return actorHistory
      .filter((dv) => !selectedThread || dv?.attrs?.threadId === selectedThread)
      .filter(
        (dv) =>
          dv.kind === "liq.trust" ||
          ((dv?.attrs?.currency || "PYG").toUpperCase() === currency)
      )
      .sort((a, b) => getTs(b) - getTs(a))
      .slice(0, 18);
  }, [actorHistory, currency, selectedThread]);

  if (!actorId) {
    return (
      <div style={card} className={className}>
        <div style={{ color: UI.text, fontWeight: 800 }}>Liquidez viva</div>
        <div style={{ color: UI.textSoft }}>No hay actor seleccionado.</div>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "grid", gap: 12 }}>
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ color: UI.text, fontWeight: 900, fontSize: 18 }}>
              Banco simbiótico
            </div>
            <div style={{ color: UI.textSoft, fontSize: 13 }}>
              {actorName || actorId}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={currency}
              onChange={(e) => setCurrency(asCurrency(e.target.value))}
              style={selectStyle}
            >
              {(currencies.length ? currencies : [currency]).map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>

            <button
              type="button"
              style={btn}
              onClick={() =>
                onUseInCheckout?.({
                  actorId,
                  currency,
                  available,
                  spendable,
                  trustScore,
                })
              }
            >
              Usar en checkout
            </button>

            <button type="button" style={btn} onClick={() => onOpenPayCenter?.()}>
              Pay Center
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 10,
          }}
        >
          <div style={{ ...softCard, background: UI.greenBg }}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Disponible</div>
            <div style={{ color: UI.greenText, fontWeight: 900, fontSize: 22 }}>
              {fmtAmount(available, currency)}
            </div>
          </div>

          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Gastable</div>
            <div style={{ color: UI.text, fontWeight: 900, fontSize: 22 }}>
              {fmtAmount(spendable, currency)}
            </div>
          </div>

          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Reservado</div>
            <div style={{ color: UI.amberText, fontWeight: 900, fontSize: 22 }}>
              {fmtAmount(reserved, currency)}
            </div>
          </div>

          <div style={{ ...softCard, background: UI.blueBg }}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Trust</div>
            <div style={{ color: UI.blueText, fontWeight: 900, fontSize: 22 }}>
              {Math.round((trust?.score || 0.5) * 100)}%
            </div>
            <div style={{ color: UI.textMuted, fontSize: 12 }}>
              {trust?.level || "medium"} · {trust?.samples || 0} eventos
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Issue</div>
            <div style={{ color: UI.text, fontWeight: 800 }}>
              {fmtAmount(account?.issued || 0, currency)}
            </div>
          </div>
          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Redeem</div>
            <div style={{ color: UI.text, fontWeight: 800 }}>
              {fmtAmount(account?.redeemed || 0, currency)}
            </div>
          </div>
          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Transfer in</div>
            <div style={{ color: UI.text, fontWeight: 800 }}>
              {fmtAmount(account?.transferredIn || 0, currency)}
            </div>
          </div>
          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Transfer out</div>
            <div style={{ color: UI.text, fontWeight: 800 }}>
              {fmtAmount(account?.transferredOut || 0, currency)}
            </div>
          </div>
          <div style={softCard}>
            <div style={{ color: UI.textSoft, fontSize: 12 }}>Credit line</div>
            <div style={{ color: UI.text, fontWeight: 800 }}>
              {fmtAmount(account?.creditLine || 0, currency)}
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ color: UI.text, fontWeight: 800, marginBottom: 10 }}>
          Trust por contraparte
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {counterparties.length ? (
            counterparties.map((item) => (
              <div
                key={item.counterpartyId}
                style={{
                  border: `1px solid ${UI.border}`,
                  background: UI.cardSoft,
                  borderRadius: 14,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: UI.text, fontWeight: 700 }}>
                    {item.counterpartyId}
                  </div>
                  <div style={{ color: UI.textMuted, fontSize: 12 }}>
                    {item.trust.lastReason || "sin detalle"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: UI.blueText, fontWeight: 800 }}>
                    {Math.round(item.trust.score * 100)}%
                  </div>
                  <div style={{ color: UI.textMuted, fontSize: 12 }}>
                    {item.trust.level} · {item.trust.samples} eventos
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: UI.textSoft }}>
              Aún no hay trust por contraparte.
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div style={{ color: UI.text, fontWeight: 800 }}>
            Últimas operaciones por hilo
          </div>
          <select
            value={selectedThread}
            onChange={(e) => setSelectedThread(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos los hilos</option>
            {threadIds.map((tid) => (
              <option key={tid} value={tid}>
                {tid}
              </option>
            ))}
          </select>
        </div>

        {threadSummary ? (
          <div style={{ ...softCard, marginBottom: 10 }}>
            <div style={{ color: UI.text, fontWeight: 700, marginBottom: 6 }}>
              Resumen del hilo
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: 8,
              }}
            >
              <div style={{ color: UI.greenText }}>
                Issue: {fmtAmount(threadSummary.totalIssue, currency)}
              </div>
              <div style={{ color: UI.amberText }}>
                Redeem: {fmtAmount(threadSummary.totalRedeem, currency)}
              </div>
              <div style={{ color: UI.blueText }}>
                Transfer: {fmtAmount(threadSummary.totalTransfer, currency)}
              </div>
              <div style={{ color: UI.redText }}>
                Lock: {fmtAmount(threadSummary.totalLocked, currency)}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 8 }}>
          {latestHistory.length ? (
            latestHistory.map((dv) => (
              <div
                key={dv.id}
                style={{
                  border: `1px solid ${UI.border}`,
                  background: UI.cardSoft,
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ color: UI.text, fontWeight: 700 }}>
                      {getTitle(dv)}
                    </div>
                    <div style={{ color: UI.textMuted, fontSize: 12 }}>
                      {dv?.attrs?.reason || dv?.attrs?.status || "-"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <DeltaText dv={dv} currency={currency} />
                  </div>
                </div>

                <div style={{ color: UI.textMuted, fontSize: 12 }}>
                  Hilo: {getThreadId(dv)}
                </div>

                <div style={{ color: UI.textMuted, fontSize: 12 }}>
                  {fmtDate(getTs(dv))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: UI.textSoft }}>
              No hay operaciones todavía.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}