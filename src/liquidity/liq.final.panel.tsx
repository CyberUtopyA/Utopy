import React from "react";
import { useLiquidity } from "./useliquidity";
import { useLiquidityStore } from "./liquidity.store";

export default function LiqFinalPanel({
  actorId,
  actorName,
  currency = "PYG",
}: {
  actorId?: string;
  actorName?: string;
  currency?: string;
}) {
  const { account, trust, spendable, reserved } = useLiquidity(actorId, currency);
  const dvs = useLiquidityStore((s) => s.dvs);

  const fiscal = dvs.filter((d) => d.kind === "liq.fiscal.document").slice(0, 5);
  const ai = dvs.filter((d) => d.kind === "liq.ai.decision").slice(0, 5);
  const commons = dvs.filter((d) => d.kind === "liq.commons.pool").slice(0, 5);

  if (!actorId) return null;

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <div>
        <h2 className="text-lg font-black">UTOPY Liquidity V1 Final</h2>
        <p className="text-sm text-white/60">{actorName || "Persona"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card title="Gastable" value={`${Math.round(spendable || 0).toLocaleString("es-PY")} ${currency}`} />
        <Card title="Reservado" value={`${Math.round(reserved || 0).toLocaleString("es-PY")} ${currency}`} />
        <Card title="Trust" value={`${Math.round((trust?.score || 0.5) * 100)}%`} />
        <Card title="Credit line" value={`${Math.round(account?.creditLine || 0).toLocaleString("es-PY")} ${currency}`} />
      </div>

      <Section title="IA económica" items={ai} />
      <Section title="Commons territoriales" items={commons} />
      <Section title="Fiscal / legal" items={fiscal} />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/55">{title}</div>
      <div className="font-black">{value}</div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 font-bold">{title}</div>
      {items.length ? (
        <div className="grid gap-2">
          {items.map((dv) => (
            <div key={dv.id} className="rounded-lg bg-white/5 p-2 text-xs">
              <div className="font-bold">{dv.kind}</div>
              <div className="text-white/60">{dv.attrs?.reason || dv.attrs?.status || dv.id}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-white/50">Sin eventos todavía.</div>
      )}
    </div>
  );
}
