import React, { useMemo } from "react";
import type { DVLike } from "./liquidity/mt.liquidity";
import {
  summarizeFalconThreadLiquidity,
  type FalconLiquidityCheckoutPayload,
} from "./falconliquidity";

type Props = {
  actorId: string;
  actorName?: string | null;
  allDvs: DVLike[];
  defaultCurrency?: string;
  threadId?: string | null;
  onUseInCheckout?: (payload: {
    actorId: string;
    actorName?: string | null;
    currency: string;
    spendable: number;
    reserved: number;
    available: number;
    trustScore: number;
    summary: FalconLiquidityCheckoutPayload["summary"];
    trust: FalconLiquidityCheckoutPayload["trust"];
  }) => void;
  onOpenWallet?: () => void;
};

function fmt(n: number) {
  return Math.round(Number(n || 0)).toLocaleString("es-PY");
}

function trustTone(score: number) {
  if (score >= 0.8) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 0.45) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export default function FalconLiquidityPanel({
  actorId,
  actorName,
  allDvs,
  defaultCurrency = "PYG",
  threadId,
  onUseInCheckout,
  onOpenWallet,
}: Props) {
  const payload = useMemo(() => {
    return summarizeFalconThreadLiquidity({
      actorId,
      currency: defaultCurrency,
      threadId,
      dvs: allDvs,
    });
  }, [actorId, defaultCurrency, threadId, allDvs]);

  const { summary, trust, thread } = payload;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Liquidez disponible
          </div>
          <div className="mt-1 text-xl font-black text-slate-950">
            {actorName || actorId}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Usá saldo, reserva o crédito sin salir del checkout.
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs font-bold ${trustTone(
            trust.score
          )}`}
        >
          Confianza {Math.round(trust.score * 100)}%
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Disponible
          </div>
          <div className="mt-1 text-2xl font-black text-slate-950">
            {fmt(summary.available)} {summary.currency}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Reservado
          </div>
          <div className="mt-1 text-2xl font-black text-slate-950">
            {fmt(summary.reserved)} {summary.currency}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">
            Usable ahora
          </div>
          <div className="mt-1 text-2xl font-black text-cyan-950">
            {fmt(summary.spendable)} {summary.currency}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Emitido" value={summary.issued} currency={summary.currency} />
        <Metric label="Redimido" value={summary.redeemed} currency={summary.currency} />
        <Metric label="Transferido" value={summary.transferredIn - summary.transferredOut} currency={summary.currency} />
        <Metric label="Crédito" value={summary.creditLine} currency={summary.currency} />
      </div>

      {thread ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Movimiento del checkout
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-700">
            <span>Emitido: <b>{fmt(thread.totalIssue)} {thread.currency}</b></span>
            <span>Redimido: <b>{fmt(thread.totalRedeem)} {thread.currency}</b></span>
            <span>Transferido: <b>{fmt(thread.totalTransfer)} {thread.currency}</b></span>
            <span>Bloqueado: <b>{fmt(thread.totalLocked)} {thread.currency}</b></span>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={summary.spendable <= 0}
          onClick={() =>
            onUseInCheckout?.({
              actorId,
              actorName,
              currency: summary.currency,
              spendable: summary.spendable,
              reserved: summary.reserved,
              available: summary.available,
              trustScore: trust.score,
              summary,
              trust,
            })
          }
          className="rounded-2xl border border-cyan-300 bg-cyan-100 px-4 py-3 text-sm font-bold text-cyan-900 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Usar en esta compra
        </button>

        <button
          type="button"
          onClick={onOpenWallet}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
        >
          Ver detalle
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-950">
        {fmt(value)} {currency}
      </div>
    </div>
  );
}