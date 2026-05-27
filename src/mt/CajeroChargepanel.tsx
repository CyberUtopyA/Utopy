import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  BadgeDollarSign,
  Clock3,
  Radar,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  CreditCard,
  Landmark,
  QrCode,
  Banknote,
  CircleDollarSign,
} from "lucide-react";

import { mtLiveSubscribe } from "./mt.liveStore";
import {
  emitPaymentAccept,
  emitPaymentOutcome,
  emitPaymentProposal,
  type PaymentMethod,
} from "./mt.intentpayment";
import { emitPaymentSessionStatus } from "./paymentsession";

type AnyDV = any;

type Props = {
  sellerId: string;
  sellerName?: string | null;
  ns?: string;
};

function safeStr(x: any, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function safeNum(x: any, fb = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fb;
}

function safeArr<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function parseTs(x: any): number {
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : 0;
}

function isDue(d: AnyDV) {
  return safeStr(d?.kind) === "payment.due";
}

function isProposal(d: AnyDV) {
  return safeStr(d?.kind) === "payment.proposal";
}

function isProximity(d: AnyDV) {
  return safeStr(d?.kind) === "payment.proximity";
}

function isOffer(d: AnyDV) {
  return safeStr(d?.kind) === "payment.offer";
}

function isOutcome(d: AnyDV) {
  return safeStr(d?.kind) === "payment.outcome";
}

function isAccept(d: AnyDV) {
  return safeStr(d?.kind) === "payment.accept";
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

function normalizeMethod(m: any): PaymentMethod | null {
  if (!m || typeof m !== "object") return null;
  const channel = safeStr(m.channel).trim();
  if (!channel) return null;
  return {
    channel,
    label: m.label ? safeStr(m.label) : undefined,
    address: m.address != null ? safeStr(m.address) : null,
    link: m.link != null ? safeStr(m.link) : null,
    qr: m.qr != null ? safeStr(m.qr) : null,
    meta: m.meta && typeof m.meta === "object" ? m.meta : undefined,
  };
}

function uniqMethods(xs: PaymentMethod[]) {
  const seen = new Set<string>();
  const out: PaymentMethod[] = [];
  for (const m of xs) {
    const key = `${safeStr(m?.channel).toLowerCase()}|${safeStr(m?.label).toLowerCase()}`;
    if (!safeStr(m?.channel)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function methodIcon(channel?: string) {
  const ch = safeStr(channel).toLowerCase();
  if (ch === "qr") return <QrCode size={13} />;
  if (ch === "cash") return <Banknote size={13} />;
  if (ch === "card") return <CreditCard size={13} />;
  if (ch === "transfer" || ch === "link") return <Landmark size={13} />;
  if (ch === "credit") return <CircleDollarSign size={13} />;
  return <Wallet size={13} />;
}

function buildDefaultAlternativeMethods(offer: AnyDV | null, proposal: AnyDV | null): PaymentMethod[] {
  const offerMethods = safeArr<any>(offer?.attrs?.accepted)
    .map(normalizeMethod)
    .filter(Boolean) as PaymentMethod[];

  const proposalMethods = [
    normalizeMethod(proposal?.attrs?.recommended),
    ...safeArr<any>(proposal?.attrs?.alternatives).map(normalizeMethod),
  ].filter(Boolean) as PaymentMethod[];

  const merged = uniqMethods([...proposalMethods, ...offerMethods]);

  if (!merged.length) {
    return [
      { channel: "cash", label: "Efectivo" },
      { channel: "transfer", label: "Transferencia" },
      { channel: "qr", label: "QR" },
    ];
  }

  return merged;
}

type ChargeItem = {
  key: string;
  mandateId: string | null;
  sessionId: string | null;
  orderId: string | null;
  threadId: string | null;
  buyerId: string | null;
  buyerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  amount: number;
  currency: string;
  dueTs: string | null;
  dueDV: AnyDV | null;
  proposalDV: AnyDV | null;
  proximityDV: AnyDV | null;
  offerDV: AnyDV | null;
  outcomeDV: AnyDV | null;
  acceptDV: AnyDV | null;
};

export default function CajeroChargesPanel({
  sellerId,
  sellerName,
  ns = "mt:market",
}: Props) {
  const [all, setAll] = useState<AnyDV[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = mtLiveSubscribe((xs: AnyDV[]) => {
      setAll(Array.isArray(xs) ? xs : []);
    });
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  const items = useMemo<ChargeItem[]>(() => {
    const dues = all
      .filter(isDue)
      .filter((d) => safeStr(d?.attrs?.sellerId) === safeStr(sellerId))
      .sort((a, b) => {
        const ta = parseTs(a?.meta?.ts || a?.attrs?.dueTs);
        const tb = parseTs(b?.meta?.ts || b?.attrs?.dueTs);
        return tb - ta;
      });
      

    return dues.map((due) => {
      const mandateId = safeStr(due?.attrs?.mandateId || "");
      const orderId = safeStr(due?.attrs?.orderId || "") || null;
      const threadId = safeStr(due?.attrs?.threadId || "") || null;
      const buyerId = safeStr(due?.attrs?.buyerId || "") || null;

      const proposalDV =
        all
          .filter(isProposal)
          .filter((d) => safeStr(d?.attrs?.mandateId || "") === mandateId)
          .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts))[0] || null;
          

      const proximityDV =
        all
          .filter(isProximity)
          .filter((d) => {
            const sameMandate = mandateId && safeStr(d?.attrs?.mandateId || "") === mandateId;
            const sameThread = threadId && safeStr(d?.attrs?.threadId || "") === threadId;
            const sameOrder = orderId && safeStr(d?.attrs?.orderId || "") === orderId;
            const sameBuyer =
              buyerId &&
              safeStr(d?.attrs?.buyerId || "") === buyerId &&
              safeStr(d?.attrs?.sellerId || "") === safeStr(sellerId);
            return !!(sameMandate || sameThread || sameOrder || sameBuyer);
          })
          .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts))[0] || null;

      const offerDV =
        all
          .filter(isOffer)
          .filter((d) => safeStr(d?.attrs?.sellerId || "") === safeStr(sellerId))
          .filter((d) => {
            const scope = safeStr(d?.attrs?.scope || "seller");
            if (scope === "seller") return true;
            if (scope === "order" && orderId) return safeStr(d?.attrs?.orderId || "") === orderId;
            return false;
          })
          .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts))[0] || null;

      const outcomeDV =
        all
          .filter(isOutcome)
          .filter((d) => safeStr(d?.attrs?.orderId || "") === safeStr(orderId || ""))
          .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts))[0] || null;

      const acceptDV =
        all
          .filter(isAccept)
          .filter((d) => safeStr(d?.attrs?.orderId || "") === safeStr(orderId || ""))
          .sort((a, b) => parseTs(b?.meta?.ts) - parseTs(a?.meta?.ts))[0] || null;
          const sessionId =
  safeStr(due?.attrs?.sessionId || "") ||
  safeStr(proposalDV?.attrs?.sessionId || "") ||
  safeStr(outcomeDV?.attrs?.sessionId || "") ||
  safeStr(acceptDV?.attrs?.sessionId || "") ||
  (orderId ? `session:${orderId}` : "") ||
  null;

  return {
  key: safeStr(due?.id || `${mandateId}:${orderId}:${threadId}`),
  sessionId: sessionId || null,
  mandateId: mandateId || null,
  orderId,
  threadId,
  buyerId,
  buyerName: safeStr(due?.attrs?.buyerName || "") || null,
  sellerId: safeStr(due?.attrs?.sellerId || "") || null,
  sellerName: safeStr(due?.attrs?.sellerName || sellerName || "") || null,
  amount: safeNum(due?.attrs?.amount, 0),
  currency: safeStr(due?.attrs?.currency || "PYG"),
  dueTs: safeStr(due?.attrs?.dueTs || due?.meta?.ts || "") || null,
  dueDV: due,
  proposalDV,
  proximityDV,
  offerDV,
  outcomeDV,
  acceptDV,
};
    });
  }, [all, sellerId, sellerName]);

  const visibleItems = useMemo(() => {
    return items.filter((it) => {
      const status = safeStr(it.outcomeDV?.attrs?.status || "").toLowerCase();
      return !["paid", "cancelled", "rejected"].includes(status);
    });
  }, [items]);

  async function handleAccept(item: ChargeItem) {
    try {
      setBusyKey(item.key);
      setMsg(null);

      const chosen = normalizeMethod(item.proposalDV?.attrs?.recommended) || null;

      if (!item.orderId) {
        throw new Error("Este cobro no tiene orderId asociado todavía.");
      }

      const accept = await emitPaymentAccept({
        orderId: item.orderId,
        actorId: safeStr(sellerId),
        actorName: safeStr(sellerName || "Cajero"),
        ok: true,
        note: "Pago validado por cajero",
        chosen,
        amount: item.amount,
        currency: item.currency,
        threadId: item.threadId || undefined,
        ns,
        source: "ms.cajero.panel.accept",
      });

      await emitPaymentOutcome({
        orderId: item.orderId,
        threadId: item.threadId || undefined,
        status: "paid",
        actorId: safeStr(sellerId),
        actorName: safeStr(sellerName || "Cajero"),
        chosen,
        amount: item.amount,
        currency: item.currency,
        note: "Cobro marcado como pagado desde cajero",
        acceptId: safeStr(accept?.id || "") || null,
        ns,
        source: "ms.cajero.panel.outcome.paid",
      });

      setMsg("Pago marcado como pagado ✅");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo marcar el pago");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReview(item: ChargeItem) {
    try {
      setBusyKey(item.key);
      setMsg(null);

      if (!item.orderId) {
        throw new Error("Este cobro no tiene orderId asociado todavía.");
      }

      await emitPaymentOutcome({
        orderId: item.orderId,
        threadId: item.threadId || undefined,
        status: "pending_review",
        actorId: safeStr(sellerId),
        actorName: safeStr(sellerName || "Cajero"),
        chosen: normalizeMethod(item.proposalDV?.attrs?.recommended) || null,
        amount: item.amount,
        currency: item.currency,
        note: "Marcado para revisión manual",
        ns,
        source: "ms.cajero.panel.outcome.review",
      });
      const sessionId =
  item.sessionId ||
  (item.orderId ? `session:${item.orderId}` : null);

if (sessionId) {
  await emitPaymentSessionStatus({
    sessionId,
    orderId: item.orderId || undefined,
    threadId: item.threadId || undefined,
    sellerId: safeStr(item.sellerId || sellerId),
    buyerId: safeStr(item.buyerId || ""),
    status: "pending_review",
    assignedCajeroId: safeStr(sellerId),
    assignedCajeroName: safeStr(sellerName || "Cajero"),
    chosen: normalizeMethod(item.proposalDV?.attrs?.recommended) || null,
    amount: item.amount,
    currency: item.currency,
    reason: "cajero.review",
    note: "Pago enviado a revisión por cajero",
    ns,
    actorId: safeStr(sellerId),
    source: "ms.cajero.panel.session.review",
  });
}

      setMsg("Cobro marcado para revisión 🟡");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo marcar revisión");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReject(item: ChargeItem) {
    try {
      setBusyKey(item.key);
      setMsg(null);

      if (!item.orderId) {
        throw new Error("Este cobro no tiene orderId asociado todavía.");
      }

      await emitPaymentAccept({
        orderId: item.orderId,
        actorId: safeStr(sellerId),
        actorName: safeStr(sellerName || "Cajero"),
        ok: false,
        note: "Pago rechazado por cajero",
        chosen: normalizeMethod(item.proposalDV?.attrs?.recommended) || null,
        amount: item.amount,
        currency: item.currency,
        threadId: item.threadId || undefined,
        ns,
        source: "ms.cajero.panel.reject",
      });

      await emitPaymentOutcome({
        orderId: item.orderId,
        threadId: item.threadId || undefined,
        status: "rejected",
        actorId: safeStr(sellerId),
        actorName: safeStr(sellerName || "Cajero"),
        chosen: normalizeMethod(item.proposalDV?.attrs?.recommended) || null,
        amount: item.amount,
        currency: item.currency,
        note: "Pago rechazado desde cajero",
        ns,
        source: "ms.cajero.panel.outcome.rejected",
      });
      const sessionId =
  item.sessionId ||
  (item.orderId ? `session:${item.orderId}` : null);

if (sessionId) {
  await emitPaymentSessionStatus({
    sessionId,
    orderId: item.orderId || undefined,
    threadId: item.threadId || undefined,
    sellerId: safeStr(item.sellerId || sellerId),
    buyerId: safeStr(item.buyerId || ""),
    status: "rejected",
    assignedCajeroId: safeStr(sellerId),
    assignedCajeroName: safeStr(sellerName || "Cajero"),
    chosen: normalizeMethod(item.proposalDV?.attrs?.recommended) || null,
    amount: item.amount,
    currency: item.currency,
    reason: "cajero.rejected.payment",
    note: "Pago rechazado por cajero",
    ns,
    actorId: safeStr(sellerId),
    source: "ms.cajero.panel.session.rejected",
  });
}

      setMsg("Pago rechazado 🔴");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo rechazar");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRepropose(item: ChargeItem, method: PaymentMethod) {
    try {
      setBusyKey(item.key);
      setMsg(null);

      const alternatives = buildDefaultAlternativeMethods(item.offerDV, item.proposalDV);

      await emitPaymentProposal({
        sellerId: safeStr(item.sellerId || sellerId),
        sellerName: safeStr(item.sellerName || sellerName || "") || null,
        buyerId: safeStr(item.buyerId || ""),
        buyerName: safeStr(item.buyerName || "") || null,
        orderId: item.orderId || undefined,
        mandateId: item.mandateId || undefined,
        threadId: item.threadId || undefined,
        recommended: method,
        alternatives,
        amount: item.amount,
        currency: item.currency,
        reason: "cajero.manual.reproposal",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        note: `Repropuesta manual por cajero: ${safeStr(method.label || method.channel)}`,
        ns,
        source: "ms.cajero.panel.reproposal",
      });

      if (item.orderId) {
        await emitPaymentOutcome({
          orderId: item.orderId,
          threadId: item.threadId || undefined,
          status: "scheduled",
          actorId: safeStr(sellerId),
          actorName: safeStr(sellerName || "Cajero"),
          chosen: method,
          amount: item.amount,
          currency: item.currency,
          note: "Nueva propuesta emitida por cajero",
          ns,
          source: "ms.cajero.panel.outcome.scheduled",
        });
      }

      setMsg(`Nueva propuesta enviada: ${safeStr(method.label || method.channel)} 🤝`);
    } catch (e: any) {
      setMsg(e?.message || "No se pudo reproponer");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Wrap>
      <HeaderRow>
        <Title>
          <BadgeDollarSign size={16} />
          Cobros vivos del cajero
        </Title>
        <Counter>{visibleItems.length} activos</Counter>
      </HeaderRow>

      {msg && <Info>{msg}</Info>}

      {visibleItems.length === 0 ? (
        <Empty>No hay cobros activos para este cajero.</Empty>
      ) : (
        <List>
          {visibleItems.map((item) => {
            const recommended = normalizeMethod(item.proposalDV?.attrs?.recommended);
            const alternatives = buildDefaultAlternativeMethods(item.offerDV, item.proposalDV);
            const near = !!item.proximityDV?.attrs?.near;
            const distanceHint = safeStr(item.proximityDV?.attrs?.distanceHint || "");
            const proposalReason = safeStr(item.proposalDV?.attrs?.reason || "");
            const outcomeStatus = safeStr(item.outcomeDV?.attrs?.status || "");

            return (
              <Card key={item.key}>
                <Top>
                  <Main>
                    <Name>
                      {item.buyerName || item.buyerId || "Comprador"} ·{" "}
                      {formatMoney(item.amount, item.currency)}
                    </Name>
                    <Sub>
                      <Clock3 size={13} />
                      Due: {formatWhen(item.dueTs)}
                    </Sub>
                    {item.threadId && <Sub>thread: {item.threadId}</Sub>}
                    {item.orderId && <Sub>order: {item.orderId}</Sub>}
                    {item.mandateId && <Sub>mandate: {item.mandateId}</Sub>}
                  </Main>

                  <Right>
                    {near ? (
                      <Pill tone="green">
                        <Radar size={13} />
                        cerca
                      </Pill>
                    ) : (
                      <Pill>
                        <Radar size={13} />
                        {distanceHint || "sin proximidad"}
                      </Pill>
                    )}

                    {outcomeStatus && (
                      <Pill tone="amber">{outcomeStatus}</Pill>
                    )}
                  </Right>
                </Top>

                <Section>
                  <SectionTitle>Propuesta actual</SectionTitle>
                  {recommended ? (
                    <MethodBox>
                      <MethodMain>
                        {methodIcon(recommended.channel)}
                        <b>{safeStr(recommended.label || recommended.channel)}</b>
                      </MethodMain>
                      {proposalReason && <Mini>reason: {proposalReason}</Mini>}
                    </MethodBox>
                  ) : (
                    <Mini>Sin propuesta todavía.</Mini>
                  )}
                </Section>

                <Section>
                  <SectionTitle>Métodos alternativos</SectionTitle>
                  <MethodsRow>
                    {alternatives.map((m, idx) => (
                      <MethodBtn
                        key={`${safeStr(m.channel)}-${idx}`}
                        onClick={() => void handleRepropose(item, m)}
                        disabled={busyKey === item.key}
                        title={`Proponer ${safeStr(m.label || m.channel)}`}
                      >
                        {methodIcon(m.channel)}
                        {safeStr(m.label || m.channel)}
                      </MethodBtn>
                    ))}
                  </MethodsRow>
                </Section>

                {item.offerDV?.attrs?.text && (
                  <Section>
                    <SectionTitle>Mensaje del cajero</SectionTitle>
                    <Mini>{safeStr(item.offerDV.attrs.text)}</Mini>
                  </Section>
                )}

                <Actions>
                  <ActionBtn
                    tone="green"
                    onClick={() => void handleAccept(item)}
                    disabled={busyKey === item.key}
                  >
                    <CheckCircle2 size={15} />
                    Marcar pagado
                  </ActionBtn>

                  <ActionBtn
                    tone="amber"
                    onClick={() => void handleReview(item)}
                    disabled={busyKey === item.key}
                  >
                    <RefreshCcw size={15} />
                    Revisión
                  </ActionBtn>

                  <ActionBtn
                    tone="red"
                    onClick={() => void handleReject(item)}
                    disabled={busyKey === item.key}
                  >
                    <AlertTriangle size={15} />
                    Rechazar
                  </ActionBtn>
                </Actions>
              </Card>
            );
          })}
        </List>
      )}
    </Wrap>
  );
}

const Wrap = styled.div`
  display: grid;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
`;

const Title = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
`;

const Counter = styled.div`
  font-size: 0.8rem;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.04);
`;

const Info = styled.div`
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(59,130,246,0.08);
  border: 1px solid rgba(59,130,246,0.14);
  font-size: 0.9rem;
`;

const Empty = styled.div`
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.65);
  background: rgba(0,0,0,0.02);
`;

const List = styled.div`
  display: grid;
  gap: 10px;
`;

const Card = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  background: #fff;
  padding: 12px;
  display: grid;
  gap: 12px;
`;

const Top = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
`;

const Main = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
`;

const Right = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
`;

const Name = styled.div`
  font-weight: 900;
  font-size: 0.96rem;
`;

const Sub = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  opacity: 0.8;
  flex-wrap: wrap;
`;

const Section = styled.div`
  display: grid;
  gap: 8px;
`;

const SectionTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 900;
  opacity: 0.75;
`;

const MethodBox = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 10px;
  display: grid;
  gap: 6px;
  background: rgba(0,0,0,0.02);
`;

const MethodMain = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
`;

const Mini = styled.div`
  font-size: 0.78rem;
  opacity: 0.74;
`;

const MethodsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const MethodBtn = styled.button`
  border: 1px solid rgba(0,0,0,0.1);
  background: #fff;
  border-radius: 999px;
  padding: 7px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.8rem;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ActionBtn = styled.button<{ tone?: "green" | "amber" | "red" }>`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 9px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 800;
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,0.12)"
        : tone === "amber"
        ? "rgba(245,158,11,0.14)"
        : tone === "red"
        ? "rgba(239,68,68,0.12)"
        : "#fff"};
`;

const Pill = styled.div<{ tone?: "green" | "amber" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 900;
  padding: 5px 9px;
  border-radius: 999px;
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,0.12)"
        : tone === "amber"
        ? "rgba(245,158,11,0.14)"
        : "rgba(0,0,0,0.04)"};
`;