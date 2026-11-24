import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  Wallet,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  UserRound,
  Radar,
  CreditCard,
  RefreshCcw,
  Search,
} from "lucide-react";
import { mtLiveSubscribe } from "./mt.liveStore";
import { bootLiquidityRuntime, ingestLiquidityDV } from "../liquidity/liquidityruntime";
import { useLiquidity, useLiquidityThread } from "../liquidity/useliquidity";

type AnyDV = any;

type Props = {
  sellerId: string;
  sellerName?: string | null;
  ns?: string;  
  onlyOpen?: boolean;
  embedded?: boolean;
  operatorId?: string | null;
  operatorName?: string | null;
  paymentMethods?: any[];
};

function safeStr(x: any, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}
function safeNum(x: any, fb = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fb;
}
function parseTs(x: any): number {
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : 0;
}

function isKind(d: AnyDV, kind: string) {
  return safeStr(d?.kind) === kind;
}

function formatMoney(amount: any, currency = "PYG") {
  const n = safeNum(amount, 0);
  try {
    return `${n.toLocaleString("es-PY")} ${currency}`;
  } catch {
    return `${n} ${currency}`;
  }
}

function formatWhen(ts?: string | null) {
  const t = parseTs(ts);
  if (!t) return "sin fecha";
  const delta = Date.now() - t;
  if (delta < 60_000) return "ahora";
  if (delta < 3_600_000) return `hace ${Math.max(1, Math.floor(delta / 60_000))} min`;
  if (delta < 86_400_000) return `hace ${Math.max(1, Math.floor(delta / 3_600_000))} h`;
  return new Date(t).toLocaleString("es-PY");
}

function latestBy<T>(arr: T[], tsFn: (x: T) => number): T | null {
  return [...arr].sort((a, b) => tsFn(b) - tsFn(a))[0] || null;
}

function statusTone(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "paid") return "green";
  if (s === "pending_review") return "amber";
  if (s === "assigned") return "blue";
  if (s === "queued") return "gray";
  if (s === "waiting_proof") return "violet";
  if (s === "rejected") return "red";
  if (s === "expired") return "red";
  return "gray";
}

function statusLabel(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "open") return "Abierta";
  if (s === "waiting_proof") return "Esperando comprobante";
  if (s === "queued") return "En cola";
  if (s === "assigned") return "Asignada";
  if (s === "pending_review") return "Pendiente de revisión";
  if (s === "paid") return "Pagada";
  if (s === "rejected") return "Rechazada";
  if (s === "expired") return "Expirada";
  return s || "—";
}

function statusIcon(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "paid") return <CheckCircle2 size={14} />;
  if (s === "pending_review") return <AlertTriangle size={14} />;
  if (s === "assigned") return <UserRound size={14} />;
  if (s === "queued") return <Hourglass size={14} />;
  if (s === "waiting_proof") return <RefreshCcw size={14} />;
  return <Clock3 size={14} />;
}

function fmtScore(n?: number | null) {
  return `${Math.round((safeNum(n, 0.5) || 0) * 100)}%`;
}

type SessionRow = {
  sessionId: string;
  orderId: string | null;
  threadId: string | null;
  buyerId: string | null;
  buyerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  amount: number;
  currency: string;
  openDV: AnyDV;
  lastStatusDV: AnyDV | null;
  proposalDV: AnyDV | null;
  proofDV: AnyDV | null;
  proximityDV: AnyDV | null;
  outcomeDV: AnyDV | null;
};

function LiquidityMini({
  actorId,
  actorName,
  threadId,
  currency,
  amount,
}: {
  actorId?: string | null;
  actorName?: string | null;
  threadId?: string | null;
  currency: string;
  amount: number;
}) {
  const {
    spendable,
    reserved,
    trustScore,
  } = useLiquidity(actorId || undefined, currency);

  const { summary, latest } = useLiquidityThread(threadId || undefined, currency);

  const canCover = spendable >= amount;

  if (!actorId) return null;

  return (
    <LiquidityBox>
      <SectionTitle>UTOPY Liquidity</SectionTitle>

      <LiquidityRow>
        <MiniPill tone={canCover ? "green" : undefined}>
          spendable: {formatMoney(spendable, currency)}
        </MiniPill>
        <MiniPill>reserved: {formatMoney(reserved, currency)}</MiniPill>
        <MiniPill tone="amber">trust: {fmtScore(trustScore)}</MiniPill>
      </LiquidityRow>

      {summary && (
        <Muted>
          hilo → issue {formatMoney(summary.totalIssue, currency)} · redeem{" "}
          {formatMoney(summary.totalRedeem, currency)} · transfer{" "}
          {formatMoney(summary.totalTransfer, currency)} · locked{" "}
          {formatMoney(summary.totalLocked, currency)}
        </Muted>
      )}

      {!!latest?.length && (
        <LiquidityTags>
          {latest.slice(0, 4).map((e: any, i: number) => (
            <Tag key={`${e?.id || i}`}>
              {safeStr(e?.kind || "liq")} · {formatMoney(Math.abs(safeNum(e?.amount, 0)), currency)}
            </Tag>
          ))}
        </LiquidityTags>
      )}

      <Muted>
        {actorName || "Persona"} {canCover ? "· puede cubrir" : "· necesita otra ruta"}
      </Muted>
    </LiquidityBox>
  );
}

function methodLabel(method: any) {
  if (typeof method === "string") return method;
  return safeStr(method?.label || method?.channel || method?.kind || "Método");
}

export default function UtopyPayCenter({
  sellerId,
  sellerName,
  ns = "mt:market",
  onlyOpen = false,
  embedded = false,
  operatorId = null,
  operatorName = null,
  paymentMethods = [],
}: Props) {
  const [all, setAll] = useState<AnyDV[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    bootLiquidityRuntime();
  }, []);

  useEffect(() => {
    const unsub = mtLiveSubscribe((xs: AnyDV[]) => {
      const arr = Array.isArray(xs) ? xs : [];
      setAll(arr);
      for (const dv of arr) ingestLiquidityDV(dv);
    });
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  const rows = useMemo<SessionRow[]>(() => {
    const opens = all
      .filter((d) => isKind(d, "payment.session.open"))
      .filter((d) => safeStr(d?.attrs?.sellerId) === safeStr(sellerId))
      .filter((d) => !ns || safeStr(d?.meta?.ns || "mt:market") === safeStr(ns))
      .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts));

    return opens.map((open) => {
      const sessionId = safeStr(open?.attrs?.sessionId);
      const orderId = safeStr(open?.attrs?.orderId || "") || null;
      const threadId = safeStr(open?.attrs?.threadId || "") || null;
      const buyerId = safeStr(open?.attrs?.buyerId || "") || null;

      const statuses = all.filter(
        (d) =>
          isKind(d, "payment.session.status") &&
          safeStr(d?.attrs?.sessionId) === sessionId
      );

      const lastStatusDV = latestBy(statuses, (d) =>
        parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const proposalDV = latestBy(
        all.filter(
          (d) =>
            isKind(d, "payment.proposal") &&
            ((orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId))
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const proofDV = latestBy(
        all.filter(
          (d) =>
            isKind(d, "payment.proof") &&
            ((orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId))
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const proximityDV = latestBy(
        all.filter(
          (d) =>
            isKind(d, "payment.proximity") &&
            ((orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId))
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const outcomeDV = latestBy(
        all.filter(
          (d) =>
            isKind(d, "payment.outcome") &&
            Boolean(d?.meta?.ownership?.signature?.value) &&
            safeStr(d?.meta?.authority) === safeStr(d?.attrs?.actingAsNodeId) &&
            orderId &&
            safeStr(d?.attrs?.orderId) === orderId
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      return {
        sessionId,
        orderId,
        threadId,
        buyerId,
        buyerName: safeStr(open?.attrs?.buyerName || "") || null,
        sellerId: safeStr(open?.attrs?.sellerId || "") || null,
        sellerName: safeStr(open?.attrs?.sellerName || sellerName || "") || null,
        amount: safeNum(open?.attrs?.amount, 0),
        currency: safeStr(open?.attrs?.currency || "PYG"),
        openDV: open,
        lastStatusDV,
        proposalDV,
        proofDV,
        proximityDV,
        outcomeDV,
      };
    });
  }, [all, sellerId, sellerName, ns]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const outcome = safeStr(r.outcomeDV?.attrs?.status || "").toLowerCase();
      const status = safeStr(r.lastStatusDV?.attrs?.status || "open").toLowerCase();

      if (onlyOpen && ["paid", "rejected", "expired"].includes(outcome || status)) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        r.sessionId,
        r.orderId,
        r.threadId,
        r.buyerId,
        r.buyerName,
        r.sellerId,
        r.sellerName,
        safeStr(r.proposalDV?.attrs?.reason || ""),
        safeStr(r.lastStatusDV?.attrs?.status || ""),
        safeStr(r.outcomeDV?.attrs?.status || ""),
        safeStr(r.proposalDV?.attrs?.recommended?.channel || ""),
        safeStr(r.proposalDV?.attrs?.recommended?.label || ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, onlyOpen]);

  const stats = useMemo(() => {
    const allStatuses = visibleRows.map((r) =>
      safeStr(
        r.outcomeDV?.attrs?.status ||
          r.lastStatusDV?.attrs?.status ||
          "open"
      ).toLowerCase()
    );

    const count = (s: string) => allStatuses.filter((x) => x === s).length;

    return {
      total: visibleRows.length,
      waiting_proof: count("waiting_proof"),
      queued: count("queued"),
      assigned: count("assigned"),
      pending_review: count("pending_review"),
      paid: count("paid"),
    };
  }, [visibleRows]);

  return (
  <Wrap embedded={embedded}>
  {!embedded && (
    <TopBar>
      <Title>
        <Wallet size={17} />
        UTOPY Pay Center
      </Title>

      <StatsRow>
        <Stat>{stats.total} total</Stat>
        <Stat>{stats.waiting_proof} esperando</Stat>
        <Stat>{stats.queued} cola</Stat>
        <Stat>{stats.assigned} asignadas</Stat>
        <Stat>{stats.pending_review} revisión</Stat>
        <Stat>{stats.paid} pagadas</Stat>
      </StatsRow>
    </TopBar>
  )}

  {embedded && (
    <EmbeddedHeader>
      <div>
        <EmbeddedTitle>
          <Wallet size={16} />
          UTOPY Pay Center
        </EmbeddedTitle>
        <EmbeddedSummary>
          🏪 Cobra {sellerName || sellerId} · 👤 atiende {operatorName || operatorId || "operador sin nombre"}.
          El Pay Center elige únicamente rutas publicadas por el comercio.
        </EmbeddedSummary>
        <MethodRow>
          {(Array.isArray(paymentMethods) ? paymentMethods : []).map((method: any, index: number) => (
            <MethodPill key={`${methodLabel(method)}:${index}`}>{methodLabel(method)}</MethodPill>
          ))}
          {!paymentMethods?.length ? <MethodPill>Sin métodos publicados</MethodPill> : null}
        </MethodRow>
      </div>

      <StatsRow>
        <Stat>{stats.total} total</Stat>
        <Stat>{stats.waiting_proof} esperando</Stat>
        <Stat>{stats.queued} cola</Stat>
        <Stat>{stats.assigned} asignadas</Stat>
        <Stat>{stats.pending_review} revisión</Stat>
        <Stat>{stats.paid} pagadas</Stat>
      </StatsRow>
    </EmbeddedHeader>
  )}

  <SearchBox>
        <Search size={15} />
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por comprador, orderId, threadId, método, estado..."
        />
      </SearchBox>

      {visibleRows.length === 0 ? (
        <Empty>No hay sesiones de pago visibles.</Empty>
      ) : (
        <Grid>
          {visibleRows.map((r) => {
            const status = safeStr(
              r.outcomeDV?.attrs?.status ||
                r.lastStatusDV?.attrs?.status ||
                "open"
            );
            const assignedName = safeStr(r.lastStatusDV?.attrs?.assignedCajeroName || "");
            const recommended =
              r.proposalDV?.attrs?.recommended ||
              r.openDV?.attrs?.suggested ||
              null;
            const near = !!r.proximityDV?.attrs?.near;
            const reason = safeStr(
              r.lastStatusDV?.attrs?.reason ||
                r.proposalDV?.attrs?.reason ||
                ""
            );

            return (
              <Card key={r.sessionId}>
                <CardTop>
                  <div>
                    <Buyer>
                      {r.buyerName || r.buyerId || "Comprador sin nombre"}
                    </Buyer>
                    <Amount>{formatMoney(r.amount, r.currency)}</Amount>
                  </div>

                  <Badge tone={statusTone(status)}>
                    {statusIcon(status)}
                    {statusLabel(status)}
                  </Badge>
                </CardTop>

                <Meta>
                  <span>session: {r.sessionId}</span>
                  {r.orderId && <span>order: {r.orderId}</span>}
                  {import.meta.env.DEV && r.threadId && <span>thread: {r.threadId}</span>}
                </Meta>

                <Row>
                  <MiniPill>
                    <Clock3 size={13} />
                    abierta {formatWhen(r.openDV?.meta?.ts)}
                  </MiniPill>

                  {near && (
                    <MiniPill tone="green">
                      <Radar size={13} />
                      comprador cerca
                    </MiniPill>
                  )}

                  {r.proofDV && (
                    <MiniPill tone="amber">
                      <RefreshCcw size={13} />
                      comprobante recibido
                    </MiniPill>
                  )}
                </Row>

                <Section>
                  <SectionTitle>Ruta del comercio</SectionTitle>
                  <ValueRow>
                    <CreditCard size={14} />
                    <b>{safeStr(recommended?.label || recommended?.channel || "—")}</b>
                  </ValueRow>
                </Section>

                <Section>
                  <SectionTitle>Motivo</SectionTitle>
                  <Muted>{reason || "sin motivo explícito"}</Muted>
                </Section>

                <Section>
                  <SectionTitle>Asignación</SectionTitle>
                  <Muted>
                    {assignedName
                      ? `Tomada por ${assignedName}`
                      : "Aún no asignada"}
                  </Muted>
                </Section>
<LiquidityGrid>  
                <Section>
  <SectionTitle>Liquidez comprador</SectionTitle>
  <LiquidityMini
    actorId={r.buyerId}
    actorName={r.buyerName}
    threadId={r.threadId}
    currency={r.currency}
    amount={r.amount}
  />
</Section>

<Section>
  <SectionTitle>Liquidez comercio</SectionTitle>
  <LiquidityMini
    actorId={r.sellerId}
    actorName={r.sellerName}
    threadId={r.threadId}
    currency={r.currency}
    amount={r.amount}
  />
</Section>
</LiquidityGrid>

                <Section>
                  <SectionTitle>Última actualización</SectionTitle>
                  <Muted>
                    {formatWhen(
                      r.outcomeDV?.meta?.ts ||
                        r.lastStatusDV?.meta?.ts ||
                        r.proposalDV?.meta?.ts ||
                        r.openDV?.meta?.ts
                    )}
                  </Muted>
                </Section>
              </Card>
            );
          })}
        </Grid>
      )}
    </Wrap>
  );
}

const Wrap = styled.div<{ embedded?: boolean }>`
  display: grid;
  gap: 12px;
  padding: ${({ embedded }) => (embedded ? "12px" : "0")};
`;
const EmbeddedHeader = styled.div`
  display: grid;
  gap: 10px;
`;

const EmbeddedTitle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 950;
  font-size: 1rem;
`;

const EmbeddedSummary = styled.div`
  font-size: 0.86rem;
  opacity: 0.78;
  margin-top: 4px;
`;
const MethodRow = styled.div`display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;`;
const MethodPill = styled.span`font-size:9px;font-weight:850;padding:5px 8px;border-radius:999px;background:#eef9f0;color:#256132;border:1px solid #d2ecd7;`;
const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const Title = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 950;
  font-size: 1rem;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Stat = styled.div`
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.04);
  font-size: 0.78rem;
  font-weight: 900;
`;

const SearchBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.1);
  background: #fff;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.92rem;
  background: transparent;
`;

const Empty = styled.div`
  padding: 16px;
  border-radius: 14px;
  border: 1px dashed rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.02);
  color: rgba(0,0,0,0.65);
`;

const Grid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
`;

const Card = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  background: #fff;
  padding: 12px;
  display: grid;
  gap: 10px;
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
`;

const Buyer = styled.div`
  font-weight: 900;
  font-size: 0.95rem;
`;

const Amount = styled.div`
  font-size: 0.88rem;
  opacity: 0.82;
`;

const Badge = styled.div<{ tone?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: fit-content;
  font-size: 0.76rem;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,0.14)"
        : tone === "amber"
        ? "rgba(245,158,11,0.14)"
        : tone === "blue"
        ? "rgba(59,130,246,0.12)"
        : tone === "violet"
        ? "rgba(139,92,246,0.12)"
        : tone === "red"
        ? "rgba(239,68,68,0.12)"
        : "rgba(0,0,0,0.04)"};
`;

const Meta = styled.div`
  display: grid;
  gap: 4px;
  font-size: 0.76rem;
  opacity: 0.72;

  span {
    display: block;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.35;
  }
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const MiniPill = styled.div<{ tone?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 5px 8px;
  border-radius: 999px;
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,0.12)"
        : tone === "amber"
        ? "rgba(245,158,11,0.14)"
        : "rgba(0,0,0,0.04)"};
`;

const Section = styled.div`
  display: grid;
  gap: 4px;
`;

const SectionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 900;
  opacity: 0.7;
`;

const ValueRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
`;

const Muted = styled.div`
  font-size: 0.84rem;
  opacity: 0.8;
`;

const LiquidityBox = styled.div`
  border: 1px solid rgba(59,130,246,0.12);
  background: rgba(59,130,246,0.04);
  border-radius: 12px;
  padding: 10px;
  display: grid;
  gap: 8px;
`;

const LiquidityRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const LiquidityTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
const LiquidityGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;
const Tag = styled.div`
  font-size: 0.72rem;
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(0,0,0,0.05);
`;
