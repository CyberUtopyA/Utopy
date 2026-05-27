import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import type { DatoVivo } from "./mt.traitAdapter";
import { mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";
import { emitDeliveryConfirm } from "./deliveryconfirm";
import { useLocalBuyerIdentity } from "./uselocalbuyerindentity";
import { spore } from "../utopy/spore.singleton";
import InvoiceCenter from "./invoicecenter";

/* ───────────────────────────── UI UTOPY ───────────────────────────── */

const Box = styled.div`
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 28px;
  padding: 16px;
  background:
    radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.16), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.12), transparent 32%),
    linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 18px 55px rgba(15, 23, 42, 0.08);
  color: #0f172a;
`;

const Header = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  padding: 18px;
  margin-bottom: 14px;
  background:
    radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.24), transparent 38%),
    radial-gradient(circle at 100% 20%, rgba(217, 70, 239, 0.18), transparent 36%),
    linear-gradient(135deg, #07111f, #12253a 55%, #172554);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.12);
`;

const HeaderGlow = styled.div`
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.65;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 36%),
    radial-gradient(circle at 70% 0%, rgba(125, 249, 255, 0.18), transparent 30%);
`;

const HeaderInner = styled.div`
  position: relative;
  z-index: 1;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  padding: 6px 10px;
  margin-bottom: 12px;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.25);
  color: #cffafe;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.18em;
`;

const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #67e8f9;
  box-shadow: 0 0 16px rgba(103, 232, 249, 0.9);
`;

const Title = styled.h2`
  margin: 0;
  font-size: clamp(24px, 4vw, 38px);
  line-height: 1;
  letter-spacing: -0.06em;
  font-weight: 1000;
`;

const HeaderText = styled.p`
  margin: 10px 0 0;
  max-width: 760px;
  color: rgba(226, 232, 240, 0.82);
  font-size: 14px;
  line-height: 1.7;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const Subtle = styled.div`
  opacity: 0.72;
  font-size: 0.9rem;
  line-height: 1.55;
`;

const Muted = styled.span`
  opacity: 0.68;
`;

const SectionBlock = styled.div`
  margin-top: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 24px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.045);
`;

const SectionHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
`;

const SectionTitle = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 1000;
  letter-spacing: -0.03em;
`;

const IconBubble = styled.div`
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.9), transparent 38%),
    linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(168, 85, 247, 0.14));
  border: 1px solid rgba(15, 23, 42, 0.07);
`;

const IdentityBox = styled.div`
  margin-top: 14px;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr auto;
  align-items: end;
  border-radius: 22px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.035);
  border: 1px solid rgba(15, 23, 42, 0.06);

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  border: 1px solid rgba(15, 23, 42, 0.11);
  border-radius: 16px;
  padding: 11px 12px;
  width: 100%;
  outline: none;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.88);
  transition: 0.18s ease;

  &::placeholder {
    color: rgba(15, 23, 42, 0.42);
  }

  &:focus {
    border-color: rgba(6, 182, 212, 0.55);
    box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.12);
  }
`;

const Btn = styled.button<{ tone?: "ok" | "warn" | "ghost" | "info" | "danger" }>`
  border: 1px solid
    ${({ tone }) =>
      tone === "ok"
        ? "rgba(16,185,129,0.32)"
        : tone === "warn"
          ? "rgba(245,158,11,0.35)"
          : tone === "info"
            ? "rgba(59,130,246,0.25)"
            : tone === "danger"
              ? "rgba(239,68,68,0.28)"
              : "rgba(15,23,42,0.10)"};
  border-radius: 15px;
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 950;
  font-size: 13px;
  background: ${({ tone }) =>
    tone === "ok"
      ? "linear-gradient(135deg,#10b981,#0f766e)"
      : tone === "warn"
        ? "linear-gradient(135deg,#f59e0b,#d97706)"
        : tone === "info"
          ? "linear-gradient(135deg,rgba(59,130,246,.13),rgba(34,211,238,.12))"
          : tone === "danger"
            ? "linear-gradient(135deg,#ef4444,#b91c1c)"
            : "rgba(255,255,255,0.82)"};
  color: ${({ tone }) =>
    tone === "ok" || tone === "warn" || tone === "danger" ? "#fff" : "#0f172a"};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
  transition: 0.18s ease;
  box-shadow: ${({ tone }) =>
    tone === "ok"
      ? "0 10px 22px rgba(16,185,129,.18)"
      : tone === "warn"
        ? "0 10px 22px rgba(245,158,11,.16)"
        : tone === "danger"
          ? "0 10px 22px rgba(239,68,68,.16)"
          : "0 8px 18px rgba(15,23,42,.045)"};

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Pill = styled.div<{ tone?: "ok" | "warn" | "info" | "bad" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 1000;
  border: 1px solid
    ${({ tone }) =>
      tone === "ok"
        ? "rgba(34,197,94,0.20)"
        : tone === "warn"
          ? "rgba(245,158,11,0.24)"
          : tone === "bad"
            ? "rgba(239,68,68,0.20)"
            : tone === "neutral"
              ? "rgba(15,23,42,0.10)"
              : "rgba(59,130,246,0.20)"};
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.10)"
      : tone === "warn"
        ? "rgba(245,158,11,0.13)"
        : tone === "bad"
          ? "rgba(239,68,68,0.10)"
          : tone === "neutral"
            ? "rgba(15,23,42,0.045)"
            : "rgba(59,130,246,0.10)"};
  color: #0f172a;
`;

const MiniGrid = styled.div`
  display: grid;
  gap: 10px;
`;

const OrderGrid = styled.div`
  display: grid;
  gap: 12px;
`;

const OrderCard = styled.div`
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 24px;
  padding: 14px;
  background:
    radial-gradient(circle at 100% 0%, rgba(34, 211, 238, 0.09), transparent 32%),
    #ffffff;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.055);
`;

const SoftCard = styled.div`
  margin-top: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 20px;
  padding: 12px;
  background: rgba(248, 250, 252, 0.9);
`;

const CreditCard = styled.div`
  border: 1px solid rgba(59, 130, 246, 0.12);
  border-radius: 20px;
  padding: 12px;
  display: grid;
  gap: 8px;
  background:
    radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.10), transparent 34%),
    rgba(255, 255, 255, 0.9);
`;

const MandateCard = styled.div`
  display: grid;
  gap: 8px;
  border: 1px solid rgba(16, 185, 129, 0.12);
  border-radius: 20px;
  padding: 12px;
  background:
    radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.10), transparent 34%),
    rgba(255, 255, 255, 0.9);
`;

const EmptyState = styled.div`
  border: 1px dashed rgba(15, 23, 42, 0.14);
  border-radius: 22px;
  padding: 18px;
  text-align: center;
  background: rgba(248, 250, 252, 0.78);
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto 10px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(168, 85, 247, 0.12));
  border: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 22px;
`;

const DocRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

const ProgressWrap = styled.div`
  height: 9px;
  width: 100%;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
`;

const ProgressFill = styled.div<{ $value: number }>`
  height: 100%;
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  border-radius: inherit;
  background: linear-gradient(90deg, #06b6d4, #8b5cf6);
`;

const TinyCode = styled.code`
  border-radius: 8px;
  padding: 2px 6px;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 12px;
`;

const Message = styled.div<{ tone?: "ok" | "warn" }>`
  margin-top: 12px;
  border-radius: 18px;
  padding: 11px 12px;
  font-weight: 850;
  font-size: 13px;
  background: ${({ tone }) =>
    tone === "warn" ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.10)"};
  border: 1px solid
    ${({ tone }) =>
      tone === "warn" ? "rgba(245,158,11,0.22)" : "rgba(34,197,94,0.18)"};
`;

const CreditMini = styled.div`
  margin-top: 10px;
  border: 1px solid rgba(59, 130, 246, 0.12);
  border-radius: 18px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.045);
  display: grid;
  gap: 5px;
`;

/* ───────────────────────────── Helpers ───────────────────────────── */

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function num(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(value: any, currency = "PYG") {
  const n = Number(value);
  if (!Number.isFinite(n)) return `— ${currency}`;
  if (currency === "PYG") return `${new Intl.NumberFormat("es-PY").format(n)} PYG`;
  return `${new Intl.NumberFormat("es-PY").format(n)} ${currency}`;
}

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function newId(prefix = "dv:") {
  return `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function resolveOrderThreadId(order: any) {
  return String(
    order?.attrs?.threadId ||
      order?.threadId ||
      order?.meta?.threadId ||
      `order:thread:${String(order?.attrs?.orderId || order?.id || "")}`
  );
}

function uniqueStrings(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function isOrder(d: any) {
  const k = safeStr(d?.kind).trim();
  if (k === "market.order.create" || k === "market.order") return true;
  if (k.startsWith("market.order.")) return false;
  const itemsOk = Array.isArray(d?.attrs?.items);
  const traits = Array.isArray(d?.traits) ? d.traits : [];
  return traits.includes("mt:order") && itemsOk;
}

function isOrderEvent(d: any) {
  return safeStr(d?.kind) === "market.order.event";
}

function isMandateCreate(d: any) {
  return safeStr(d?.kind) === "payment.mandate.create";
}

function isMandateCancel(d: any) {
  return safeStr(d?.kind) === "payment.mandate.cancel";
}

function isCreditAccount(d: any) {
  return safeStr(d?.kind) === "credit.account";
}

function isCreditInstallment(d: any) {
  return safeStr(d?.kind) === "credit.installment";
}

function isReceipt(d: any) {
  return safeStr(d?.kind) === "sale.receipt";
}

function isInvoiceDraft(d: any) {
  return safeStr(d?.kind) === "market.invoice.draft";
}

function mandateKey(m: any) {
  const buyerId = safeStr(m?.attrs?.buyerId);
  const sellerId = safeStr(m?.attrs?.sellerId);
  const productId = safeStr(m?.attrs?.productId || "");
  const interval = safeStr(m?.attrs?.interval || "");
  const every = safeStr(m?.attrs?.every || "");
  return `${buyerId}|${sellerId}|${productId}|${interval}|${every}`;
}

function lastMandateStateFor(key: string, all: any[]) {
  const creates = all.filter(isMandateCreate).filter((d) => mandateKey(d) === key);
  const cancels = all
    .filter(isMandateCancel)
    .filter((d) => safeStr(d?.attrs?.mandateKey) === key);

  const lastCreate = creates.sort((a, b) => parseTs(b) - parseTs(a))[0] || null;
  const lastCancel = cancels.sort((a, b) => parseTs(b) - parseTs(a))[0] || null;

  if (!lastCreate) return { active: false, create: null as any, cancel: null as any };

  const createTs = parseTs(lastCreate);
  const cancelTs = lastCancel ? parseTs(lastCancel) : 0;

  return {
    active: createTs > cancelTs,
    create: lastCreate,
    cancel: lastCancel,
  };
}

function lastEventByRole(orderId: string, all: any[]) {
  const evs = all
    .filter(isOrderEvent)
    .filter((e) => String(e?.attrs?.orderId) === String(orderId))
    .sort((a, b) => parseTs(b) - parseTs(a));

  const lastByRole: Record<string, any> = {};
  for (const e of evs) {
    const role = safeStr(e?.attrs?.role);
    if (!lastByRole[role]) lastByRole[role] = e;
  }
  return lastByRole;
}

function orderStatus(orderId: string, all: any[]) {
  const lastByRole = lastEventByRole(orderId, all);
  const buyer = lastByRole["buyer"];
  const cajero = lastByRole["cajero"];
  const seller = lastByRole["seller"];

  const anyNok = [buyer, cajero, seller].some((x) => x?.attrs?.ok === false);
  if (anyNok) return { label: "Disputa", tone: "warn" as const, done: true };

  const okCount = [buyer, cajero, seller].filter((x) => x?.attrs?.ok === true).length;
  if (okCount >= 2) return { label: "Entregado", tone: "ok" as const, done: true };

  return { label: "Pendiente", tone: "info" as const, done: false };
}

function expectedDeliverToken(orderId: string, all: any[]) {
  const lastByRole = lastEventByRole(orderId, all);
  const caj = lastByRole["cajero"];
  const sel = lastByRole["seller"];
  return safeStr(caj?.attrs?.deliverToken || sel?.attrs?.deliverToken || "");
}

function findCreditAccountForOrder(orderId: string, buyerId: string, all: any[]) {
  return (
    all
      .filter(isCreditAccount)
      .filter((d: any) => safeStr(d?.attrs?.buyerId) === buyerId)
      .filter((d: any) => safeStr(d?.attrs?.orderId) === orderId)
      .sort((a: any, b: any) => parseTs(b) - parseTs(a))[0] || null
  );
}

function installmentsForAccount(accountId: string, all: any[]) {
  return all
    .filter(isCreditInstallment)
    .filter((d: any) => safeStr(d?.attrs?.accountId) === accountId)
    .sort((a: any, b: any) => num(a?.attrs?.number, 0) - num(b?.attrs?.number, 0));
}

function computeCreditAccountView(account: any, all: any[]) {
  if (!account) return null;

  const accountId = safeStr(account?.id);
  const installments = installmentsForAccount(accountId, all);

  const paidAmount = num(account?.attrs?.paidAmount, 0);
  const balance = num(account?.attrs?.balance, 0);
  const financedAmount = num(account?.attrs?.financedAmount, 0);
  const downPayment = num(account?.attrs?.downPayment, 0);
  const principal = num(account?.attrs?.principal, 0);
  const currency = safeStr(account?.attrs?.currency || "PYG");
  const installmentCount = num(account?.attrs?.installmentCount, installments.length);
  const installmentValue = num(account?.attrs?.installmentValue, 0);
  const status = safeStr(account?.attrs?.status || "active");
  const nextDueAt = safeStr(account?.attrs?.nextDueAt || "");
  const guaranteeMode = safeStr(account?.attrs?.guaranteeMode || "downpayment");

  const paidInstallments = installments.filter((i: any) => safeStr(i?.attrs?.status) === "paid").length;
  const partialInstallments = installments.filter((i: any) => safeStr(i?.attrs?.status) === "partial").length;
  const overdueInstallments = installments.filter((i: any) => safeStr(i?.attrs?.status) === "overdue").length;

  const nextPending =
    installments.find((i: any) => {
      const st = safeStr(i?.attrs?.status);
      return st === "pending" || st === "partial" || st === "overdue";
    }) || null;

  return {
    accountId,
    installments,
    paidAmount,
    balance,
    financedAmount,
    downPayment,
    principal,
    currency,
    installmentCount,
    installmentValue,
    status,
    nextDueAt,
    guaranteeMode,
    paidInstallments,
    partialInstallments,
    overdueInstallments,
    nextPending,
  };
}

async function emitMandateCancel(params: {
  mandateKey: string;
  buyerId: string;
  buyerName?: string;
  ns?: string;
  note?: string;
}) {
  const ns = params.ns ?? "mt:market";
  const dv = {
    id: `payment.mandate.cancel:${params.mandateKey}:${Date.now()}`,
    kind: "payment.mandate.cancel",
    traits: ["mt:payment.mandate", "mt:cancel", "mt:market"],
    attrs: {
      mandateKey: params.mandateKey,
      buyerId: params.buyerId,
      buyerName: params.buyerName ?? null,
      note: params.note ?? "Cancelado por el comprador",
    },
    meta: {
      ns,
      ts: new Date().toISOString(),
      actor: params.buyerId,
      source: "ms.web.buyer.cancel",
    },
  };

  mtLiveUpsert(dv as any);

  try {
    await spore?.sayIntent({
      sym: "🧬",
      say: "dato.upsert",
      with: { dv },
    });
  } catch {}

  try {
    await spore?.sayIntent({
      sym: "⛔",
      say: "payment.mandate.cancel",
      with: dv,
    });
  } catch {}

  return dv;
}

type Props = {
  onOpenThread?: (threadId: string) => void;
};

/* ───────────────────────────── Component ───────────────────────────── */

export default function BuyerOrdersPanel({ onOpenThread }: Props) {
  const { name, setName, buyerId } = useLocalBuyerIdentity();

  const [allDvs, setAllDvs] = useState<DatoVivo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tokenByOrder, setTokenByOrder] = useState<Record<string, string>>({});
  const [cancelBusyKey, setCancelBusyKey] = useState<string | null>(null);

  const [invoiceCenterOpen, setInvoiceCenterOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<{
    orderId: string;
    threadId: string;
  } | null>(null);

  useEffect(() => {
    const unsub = mtLiveSubscribe((all: DatoVivo[]) =>
      setAllDvs(Array.isArray(all) ? all : [])
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  const myOrders = useMemo(() => {
    return allDvs
      .filter(isOrder)
      .filter(
        (d: any) =>
          String(d?.attrs?.buyerId ?? d?.attrs?.buyer?.id ?? "") === buyerId
      )
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [allDvs, buyerId]);

  const myCreditAccounts = useMemo(() => {
    return allDvs
      .filter(isCreditAccount)
      .filter((d: any) => safeStr(d?.attrs?.buyerId) === buyerId)
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));
  }, [allDvs, buyerId]);

  const myMandates = useMemo(() => {
    const creates = allDvs
      .filter(isMandateCreate)
      .filter((d: any) => safeStr(d?.attrs?.buyerId) === buyerId)
      .sort((a: any, b: any) => parseTs(b) - parseTs(a));

    const keys = Array.from(new Set(creates.map(mandateKey)));

    const activeList = keys
      .map((k) => {
        const st = lastMandateStateFor(k, allDvs);
        return st.active ? { key: k, dv: st.create } : null;
      })
      .filter(Boolean) as { key: string; dv: any }[];

    return activeList.sort((a, b) => parseTs(b.dv) - parseTs(a.dv));
  }, [allDvs, buyerId]);

  const docsByOrder = useMemo(() => {
    const map = new Map<string, { receipt: any | null; invoice: any | null }>();

    for (const d of allDvs) {
      const orderId = safeStr((d as any)?.attrs?.orderId);
      if (!orderId) continue;

      if (!map.has(orderId)) {
        map.set(orderId, { receipt: null, invoice: null });
      }

      const entry = map.get(orderId)!;

      if (isReceipt(d)) {
        const currentTs = entry.receipt ? parseTs(entry.receipt) : 0;
        if (parseTs(d) >= currentTs) entry.receipt = d;
      }

      if (isInvoiceDraft(d)) {
        const currentTs = entry.invoice ? parseTs(entry.invoice) : 0;
        if (parseTs(d) >= currentTs) entry.invoice = d;
      }
    }

    return map;
  }, [allDvs]);

  const emitOrderMessage = (params: {
    orderId: string;
    buyerId: string;
    buyerName?: string;
    sellerId?: string;
    cajeroId?: string;
    text: string;
    source?: string;
  }) => {
    const orderDv: any =
      allDvs.find(
        (x: any) =>
          String(x?.id) === String(params.orderId) ||
          String(x?.attrs?.orderId) === String(params.orderId)
      ) || null;

    const threadId = resolveOrderThreadId(orderDv);

    mtLiveUpsert({
      id: newId("market.order.message:"),
      kind: "market.order.message",
      attrs: {
        threadId,
        orderId: params.orderId,
        fromActorId: params.buyerId,
        actorName: params.buyerName || "Comprador",
        toActorId: params.sellerId || params.cajeroId || null,
        buyerId: params.buyerId,
        sellerId: params.sellerId || null,
        cajeroId: params.cajeroId || null,
        participants: uniqueStrings([params.buyerId, params.sellerId, params.cajeroId]),
        text: params.text,
        unreadBy: uniqueStrings([params.sellerId, params.cajeroId]),
        status: "sent",
      },
      traits: ["mt:chat", "mt:order.thread"],
      meta: {
        ns: "mt:market",
        ts: nowIso(),
        source: params.source || "ms.web.buyer.order.message",
      },
    } as any);
  };

  const cancelMandate = async (key: string) => {
    try {
      setCancelBusyKey(key);
      setMsg(null);

      await emitMandateCancel({
        mandateKey: key,
        buyerId,
        buyerName: name || "Anon",
        ns: "mt:market",
        note: "Cancelado desde Mis pedidos",
      });

      setMsg("✅ Débito automático cancelado");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo cancelar el débito automático");
    } finally {
      setCancelBusyKey(null);
    }
  };

  const act = async (orderId: string, ok: boolean) => {
    setBusyId(orderId);
    setMsg(null);

    const inputToken = safeStr(tokenByOrder[orderId]).trim();
    const expectedToken = expectedDeliverToken(orderId, allDvs);

    if (ok) {
      if (!expectedToken) {
        setBusyId(null);
        setMsg("⚠️ Aún no hay código de entrega del cajero/seller para este pedido.");
        return;
      }

      if (!inputToken) {
        setBusyId(null);
        setMsg("⚠️ Ingresá el código de entrega para confirmar recepción.");
        return;
      }

      if (inputToken !== expectedToken) {
        setBusyId(null);
        setMsg("⚠️ Código incorrecto. Pedí al vendedor/cajero el QR/PIN correcto.");
        return;
      }
    }

    const orderDv: any =
      allDvs.find(
        (x: any) =>
          String(x?.id) === String(orderId) ||
          String(x?.attrs?.orderId) === String(orderId)
      ) || null;

    const threadId = resolveOrderThreadId(orderDv);
    const sellerId = safeStr(orderDv?.attrs?.sellerId);
    const cajeroId =
      safeStr(orderDv?.meta?.caja?.id) ||
      safeStr(orderDv?.meta?.pay?.recommendedCajeroId) ||
      safeStr(orderDv?.meta?.cajeroId);

    mtLiveUpsert({
      id: `market.order.event:${orderId}:buyer:${Date.now()}`,
      kind: "market.order.event",
      attrs: {
        threadId,
        orderId,
        role: "buyer",
        ok,
        actorId: buyerId,
        actorName: name || "Anon",
        buyerId,
        sellerId: sellerId || null,
        cajeroId: cajeroId || null,
        participants: uniqueStrings([buyerId, sellerId, cajeroId]),
        deliverToken: ok ? inputToken : undefined,
        note: ok ? "Recibí el producto" : "No recibí / problema",
        unreadBy: uniqueStrings([sellerId, cajeroId]),
      },
      traits: ["mt:event", ok ? "mt:ok" : "mt:nok", "mt:role.buyer", "mt:order.thread"],
      meta: {
        ns: "mt:market",
        ts: new Date().toISOString(),
        source: "ms.web.buyer.panel",
      },
    } as any);

    emitOrderMessage({
      orderId,
      buyerId,
      buyerName: name || "Anon",
      sellerId,
      cajeroId,
      text: ok
        ? `Confirmé recepción del pedido ${orderId.slice(-6)}.`
        : `Abrí disputa sobre el pedido ${orderId.slice(-6)}.`,
      source: "ms.web.buyer.order.message",
    });

    try {
      await emitDeliveryConfirm({
        orderId,
        role: "buyer",
        ok,
        actorId: buyerId,
        actorName: name || "Anon",
        deliverToken: ok ? inputToken : undefined,
        note: ok ? "Recibí el producto" : "Disputa: no recibí / problema",
      });

      setMsg(
        ok
          ? `✅ Confirmaste recepción ${orderId.slice(-6)}`
          : `⚠️ Disputa enviada ${orderId.slice(-6)}`
      );
    } catch (e: any) {
      setMsg(e?.message || "No se pudo enviar confirmación/disputa");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Box>
        <Header>
          <HeaderGlow />
          <HeaderInner>
            <Eyebrow>
              <Dot />
              Centro comprador
            </Eyebrow>

            <Title>Mis pedidos</Title>

            <HeaderText>
              Seguimiento simple de compras, créditos, débitos automáticos,
              documentos y confirmación de entrega dentro del ecosistema MT.
            </HeaderText>

            <IdentityBox>
              <div>
                <Subtle>Tu nombre local</Subtle>
                <Input
                  value={name}
                  placeholder="Ej: MATEO"
                  onChange={(e) => setName(e.target.value)}
                />
                <Subtle style={{ marginTop: 7, color: "rgba(255,255,255,.78)" }}>
                  ID comprador: <TinyCode>{buyerId}</TinyCode>
                </Subtle>
              </div>

              <Pill tone="info">🧬 identidad local</Pill>
            </IdentityBox>
          </HeaderInner>
        </Header>

        <SectionBlock>
          <SectionHead>
            <SectionTitle>
              <IconBubble>💳</IconBubble>
              <div>
                <div>Mis créditos</div>
                <Subtle>{myCreditAccounts.length} activos / históricos</Subtle>
              </div>
            </SectionTitle>
          </SectionHead>

          {myCreditAccounts.length === 0 ? (
            <EmptyState>
              <EmptyIcon>🌱</EmptyIcon>
              <b>No tenés créditos registrados todavía.</b>
              <Subtle style={{ marginTop: 6 }}>
                Cuando compres con financiación, acá vas a ver saldo, cuotas y próximo vencimiento.
              </Subtle>
            </EmptyState>
          ) : (
            <MiniGrid>
              {myCreditAccounts.map((acc: any) => {
                const view = computeCreditAccountView(acc, allDvs);
                if (!view) return null;

                const threadId = String(
                  acc?.attrs?.threadId ||
                    acc?.meta?.threadId ||
                    `order:thread:${String(acc?.attrs?.orderId || "")}`
                );

                const progress =
                  view.installmentCount > 0
                    ? (view.paidInstallments / view.installmentCount) * 100
                    : 0;

                return (
                  <CreditCard key={acc.id}>
                    <Row>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Pill tone={view.status === "paid" ? "ok" : view.overdueInstallments > 0 ? "warn" : "info"}>
                          {view.status === "paid"
                            ? "✅ Cancelado"
                            : view.overdueInstallments > 0
                              ? "⚠️ En mora"
                              : "💳 Activo"}
                        </Pill>

                        <b>Crédito</b>

                        {acc?.attrs?.orderId ? (
                          <TinyCode>{safeStr(acc.attrs.orderId).slice(-6)}</TinyCode>
                        ) : null}
                      </div>

                      <Subtle>
                        {acc?.meta?.ts ? new Date(acc.meta.ts).toLocaleString() : ""}
                      </Subtle>
                    </Row>

                    <ProgressWrap>
                      <ProgressFill $value={progress} />
                    </ProgressWrap>

                    <Subtle>
                      Total: <b>{fmtMoney(view.principal, view.currency)}</b> · Entrega:{" "}
                      <b>{fmtMoney(view.downPayment, view.currency)}</b>
                    </Subtle>

                    <Subtle>
                      Financiado: <b>{fmtMoney(view.financedAmount, view.currency)}</b> · Pagado:{" "}
                      <b>{fmtMoney(view.paidAmount, view.currency)}</b>
                    </Subtle>

                    <Subtle>
                      Saldo: <b>{fmtMoney(view.balance, view.currency)}</b>
                    </Subtle>

                    <Subtle>
                      Cuotas: <b>{view.installmentCount}</b> · Valor estimado:{" "}
                      <b>{fmtMoney(view.installmentValue, view.currency)}</b>
                    </Subtle>

                    <Subtle>
                      Avance: <b>{view.paidInstallments}</b> pagadas
                      {view.partialInstallments ? <> · <b>{view.partialInstallments}</b> parciales</> : null}
                      {view.overdueInstallments ? <> · <b>{view.overdueInstallments}</b> vencidas</> : null}
                    </Subtle>

                    {view.nextPending && (
                      <Subtle>
                        Próxima cuota: <b>#{view.nextPending?.attrs?.number}</b> · vence{" "}
                        <b>
                          {view.nextPending?.attrs?.dueAt
                            ? new Date(view.nextPending.attrs.dueAt).toLocaleDateString()
                            : "—"}
                        </b>{" "}
                        · saldo{" "}
                        <b>
                          {fmtMoney(
                            view.nextPending?.attrs?.balance ?? view.nextPending?.attrs?.amountDue,
                            safeStr(view.nextPending?.attrs?.currency || view.currency)
                          )}
                        </b>
                      </Subtle>
                    )}

                    {view.nextDueAt && !view.nextPending && (
                      <Subtle>
                        Próximo vencimiento: <b>{new Date(view.nextDueAt).toLocaleDateString()}</b>
                      </Subtle>
                    )}

                    <Subtle>
                      Garantía: <b>{view.guaranteeMode}</b>
                    </Subtle>

                    {acc?.attrs?.orderId ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <Btn type="button" tone="ghost" onClick={() => onOpenThread?.(threadId)}>
                          Abrir conversación 💬
                        </Btn>
                      </div>
                    ) : null}
                  </CreditCard>
                );
              })}
            </MiniGrid>
          )}
        </SectionBlock>

        <SectionBlock>
          <SectionHead>
            <SectionTitle>
              <IconBubble>🔁</IconBubble>
              <div>
                <div>Débito automático</div>
                <Subtle>{myMandates.length} activos</Subtle>
              </div>
            </SectionTitle>
          </SectionHead>

          {myMandates.length === 0 ? (
            <EmptyState>
              <EmptyIcon>🛡️</EmptyIcon>
              <b>No tenés débitos automáticos activos.</b>
              <Subtle style={{ marginTop: 6 }}>
                Podés activarlos desde el checkout marcando “Débito automático”.
              </Subtle>
            </EmptyState>
          ) : (
            <MiniGrid>
              {myMandates.map(({ key, dv }) => {
                const busy = cancelBusyKey === key;
                const sellerName =
                  safeStr(dv?.attrs?.sellerName) || safeStr(dv?.attrs?.sellerId);
                const productId = safeStr(dv?.attrs?.productId);
                const interval = safeStr(dv?.attrs?.interval);
                const every = Number(dv?.attrs?.every || 1);
                const amountMax = dv?.attrs?.amountMax;
                const currency = safeStr(dv?.attrs?.currency || "PYG");

                return (
                  <MandateCard key={key}>
                    <Row>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Pill tone="ok">🔁 Activo</Pill>
                        <b>{sellerName}</b>
                        {productId && (
                          <Subtle>
                            · producto <TinyCode>{productId}</TinyCode>
                          </Subtle>
                        )}
                      </div>

                      <Subtle>
                        {dv?.meta?.ts ? new Date(dv.meta.ts).toLocaleString() : ""}
                      </Subtle>
                    </Row>

                    <Subtle>
                      Máximo: <b>{fmtMoney(amountMax, currency)}</b> · Cada <b>{every}</b>{" "}
                      {interval}
                    </Subtle>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Btn
                        type="button"
                        tone="warn"
                        disabled={busy}
                        onClick={() => void cancelMandate(key)}
                      >
                        {busy ? "Cancelando..." : "Cancelar débito ⛔"}
                      </Btn>
                    </div>
                  </MandateCard>
                );
              })}
            </MiniGrid>
          )}
        </SectionBlock>

        {msg && (
          <Message tone={msg.includes("⚠️") ? "warn" : "ok"}>
            {msg}
          </Message>
        )}

        <SectionBlock>
          <SectionHead>
            <SectionTitle>
              <IconBubble>📦</IconBubble>
              <div>
                <div>Pedidos</div>
                <Subtle>{myOrders.length} encontrados</Subtle>
              </div>
            </SectionTitle>
          </SectionHead>

          {myOrders.length === 0 ? (
            <EmptyState>
              <EmptyIcon>🛒</EmptyIcon>
              <b>No tenés pedidos todavía.</b>
              <Subtle style={{ marginTop: 6 }}>
                Cuando compres algo en Market, va a aparecer acá con su estado, conversación y documentos.
              </Subtle>
            </EmptyState>
          ) : (
            <OrderGrid>
              {myOrders.map((d: any) => {
                const orderId = safeStr(d?.attrs?.orderId || d?.id);
                const threadId = resolveOrderThreadId(d);
                const st = orderStatus(orderId, allDvs);
                const isBusy = busyId === orderId;
                const expectedToken = expectedDeliverToken(orderId, allDvs);

                const sellerId = safeStr(
                  d?.attrs?.sellerId ||
                    d?.attrs?.seller?.id ||
                    d?.meta?.sellerId
                );

                const productId = safeStr(
                  d?.attrs?.productId || d?.attrs?.items?.[0]?.productId || ""
                );

                const possibleKey1 = `${buyerId}|${sellerId}|${productId}|monthly|1`;
                const possibleKey2 = `${buyerId}|${sellerId}||monthly|1`;

                const st1 = lastMandateStateFor(possibleKey1, allDvs);
                const st2 = lastMandateStateFor(possibleKey2, allDvs);

                const mandateActive = st1.active || st2.active;
                const mandateDv =
                  st1.active ? st1.create : st2.active ? st2.create : null;

                const creditAccount = findCreditAccountForOrder(orderId, buyerId, allDvs);
                const creditView = computeCreditAccountView(creditAccount, allDvs);

                const isCreditOrder =
                  safeStr(d?.attrs?.payment?.type) === "credit" || !!creditAccount;

                const docs = docsByOrder.get(orderId) || { receipt: null, invoice: null };
                const hasReceipt = !!docs.receipt;
                const hasInvoice = !!docs.invoice;

                return (
                  <OrderCard key={orderId}>
                    <Row>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <b>Pedido</b>
                        <TinyCode>{orderId.slice(-6)}</TinyCode>

                        <Pill tone={st.tone}>
                          {st.label === "Entregado"
                            ? "✅ Entregado"
                            : st.label === "Disputa"
                              ? "⚠️ Disputa"
                              : "⏳ Pendiente"}
                        </Pill>

                        {isCreditOrder && <Pill tone="info">💳 Crédito</Pill>}
                        {mandateActive && <Pill tone="info">🔁 Suscripción</Pill>}
                        {hasReceipt && <Pill tone="ok">🧾 Comprobante</Pill>}
                        {hasInvoice && <Pill tone="info">📄 Factura</Pill>}
                      </div>

                      <Subtle>
                        {d?.meta?.ts ? new Date(d.meta.ts).toLocaleString() : ""}
                      </Subtle>
                    </Row>

                    <Subtle style={{ marginTop: 8 }}>
                      Total: <b>{d?.attrs?.total ?? "—"}</b> · Items:{" "}
                      <b>{Array.isArray(d?.attrs?.items) ? d.attrs.items.length : "—"}</b>
                    </Subtle>

                    {creditView && (
                      <CreditMini>
                        <Subtle>
                          Crédito: <b>{creditView.status}</b> · saldo{" "}
                          <b>{fmtMoney(creditView.balance, creditView.currency)}</b>
                        </Subtle>

                        <Subtle>
                          Entrega: <b>{fmtMoney(creditView.downPayment, creditView.currency)}</b> ·
                          financiado: <b>{fmtMoney(creditView.financedAmount, creditView.currency)}</b>
                        </Subtle>

                        <Subtle>
                          Cuotas: <b>{creditView.installmentCount}</b> · pagadas:{" "}
                          <b>{creditView.paidInstallments}</b>
                          {creditView.overdueInstallments ? (
                            <>
                              {" "}· vencidas: <b>{creditView.overdueInstallments}</b>
                            </>
                          ) : null}
                        </Subtle>

                        {creditView.nextPending && (
                          <Subtle>
                            Próxima cuota #{creditView.nextPending?.attrs?.number}:{" "}
                            <b>
                              {fmtMoney(
                                creditView.nextPending?.attrs?.balance ??
                                  creditView.nextPending?.attrs?.amountDue,
                                safeStr(creditView.nextPending?.attrs?.currency || creditView.currency)
                              )}
                            </b>{" "}
                            · vence{" "}
                            <b>
                              {creditView.nextPending?.attrs?.dueAt
                                ? new Date(creditView.nextPending.attrs.dueAt).toLocaleDateString()
                                : "—"}
                            </b>
                          </Subtle>
                        )}
                      </CreditMini>
                    )}

                    {mandateActive && mandateDv && (
                      <Subtle style={{ marginTop: 8 }}>
                        Débito: máx{" "}
                        <b>
                          {fmtMoney(
                            mandateDv?.attrs?.amountMax,
                            safeStr(mandateDv?.attrs?.currency || "PYG")
                          )}
                        </b>{" "}
                        · cada <b>{safeStr(mandateDv?.attrs?.every || 1)}</b>{" "}
                        {safeStr(mandateDv?.attrs?.interval || "monthly")}
                      </Subtle>
                    )}

                    {!mandateActive && (st1.cancel || st2.cancel) && (
                      <Subtle style={{ marginTop: 8 }}>
                        Débito automático: <b>cancelado</b>
                      </Subtle>
                    )}

                    {!st.done && (
                      <SoftCard>
                        <Subtle>Código de entrega QR/PIN</Subtle>
                        <Input
                          value={tokenByOrder[orderId] ?? ""}
                          placeholder={
                            expectedToken
                              ? "Escaneá o pegá el código"
                              : "Esperando código del cajero..."
                          }
                          onChange={(e) =>
                            setTokenByOrder((p) => ({
                              ...p,
                              [orderId]: e.target.value,
                            }))
                          }
                        />

                        {expectedToken && (
                          <Subtle style={{ marginTop: 7 }}>
                            Tip: si el cajero te mostró QR, el texto suele empezar con{" "}
                            <TinyCode>tk:</TinyCode>
                          </Subtle>
                        )}
                      </SoftCard>
                    )}

                    <DocRow>
                      {!st.done && (
                        <>
                          <Btn
                            type="button"
                            tone="ok"
                            disabled={isBusy}
                            onClick={() => void act(orderId, true)}
                          >
                            {isBusy ? "Procesando..." : "Recibí ✅"}
                          </Btn>

                          <Btn
                            type="button"
                            tone="warn"
                            disabled={isBusy}
                            onClick={() => void act(orderId, false)}
                          >
                            {isBusy ? "Procesando..." : "Disputar ⚠️"}
                          </Btn>
                        </>
                      )}

                      <Btn
                        type="button"
                        tone="ghost"
                        onClick={() => onOpenThread?.(threadId)}
                      >
                        Abrir conversación 💬
                      </Btn>

                      {(hasReceipt || hasInvoice) && (
                        <Btn
                          type="button"
                          tone="info"
                          onClick={() => {
                            setSelectedDocs({
                              orderId,
                              threadId,
                            });
                            setInvoiceCenterOpen(true);
                          }}
                        >
                          Ver documentos 🧾
                        </Btn>
                      )}
                    </DocRow>
                  </OrderCard>
                );
              })}
            </OrderGrid>
          )}
        </SectionBlock>
      </Box>

      <InvoiceCenter
        open={invoiceCenterOpen}
        orderId={selectedDocs?.orderId || null}
        threadId={selectedDocs?.threadId || null}
        onClose={() => setInvoiceCenterOpen(false)}
        onOpenThread={(threadId) => {
          setInvoiceCenterOpen(false);
          onOpenThread?.(threadId);
        }}
      />
    </>
  );
}