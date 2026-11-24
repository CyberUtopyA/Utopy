import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { buildFalconSelectionIndex, selectionForItem } from "../falcon/falcon.selection";
import { livePrice, liveTitle, resolveLiveSeller } from "../mt/livePresentation";
import { profileSearchDV, projectLiveProfiles } from "../social/liveProfile";
import { isRentalDV } from "../mt/rental.domain";

type Surface = "market" | "falcon.store" | "falcon.daily" | "falcon.capital" | "falcon.skylines";
type Props = {
  open: boolean;
  onClose: () => void;
  allLive: any[];
  surface: Surface;
  initialQuery?: string;
  onSelect: (dv: any, kind: string) => void;
  onSearchNetwork?: (query: string) => void;
};

function classify(dv: any) {
  const kind = String(dv?.kind || "").toLowerCase();
  const traits = Array.isArray(dv?.traits) ? dv.traits.join(" ").toLowerCase() : "";
  const blob = `${kind} ${traits}`;
  if (kind === "live.profile") return { kind: "profile", icon: "👤", label: "Perfil" };
  if (/manifest|catalog\.source|node|org\b|commerce/.test(blob)) return { kind: "node", icon: "🏪", label: "Nodo" };
  if (/property|propiedad|realestate|alquiler|renta/.test(blob)) return { kind: "property", icon: "🏠", label: "Propiedad" };
  if (/product|producto|vendible|catalog/.test(blob)) return { kind: "product", icon: "📦", label: "Producto" };
  if (/work|job|trabajo/.test(blob)) return { kind: "work", icon: "🧑‍🔧", label: "Trabajo" };
  if (/need|demand|signal|intent/.test(blob)) return { kind: "signal", icon: "⚡", label: "Necesidad" };
  if (/material|waste|recovered/.test(blob)) return { kind: "material", icon: "🪵", label: "Material" };
  if (/finance|credit|payment/.test(blob)) return { kind: "finance", icon: "💳", label: "Financiación" };
  if (/delivery|transport|logistic/.test(blob)) return { kind: "service", icon: "🚚", label: "Servicio" };
  if (/capability|service|offer/.test(blob)) return { kind: "service", icon: "🛠", label: "Capacidad" };
  return { kind: "related", icon: "◈", label: "Relacionado" };
}

function searchableText(dv: any, allLive: any[]) {
  const attrs = dv?.attrs || {};
  return [liveTitle(dv), resolveLiveSeller(dv, allLive), ...(dv?.labels || []),
    attrs.description, attrs.descripcion, attrs.summary, attrs.category, attrs.categoria, attrs.domain,
    attrs.text, attrs.materialName, attrs.serviceName, attrs.capability, attrs.intent?.text,
    ...(Array.isArray(attrs.capabilities) ? attrs.capabilities.flatMap((x: any) =>
      typeof x === "string" ? [x] : [x?.label, x?.name, ...(x?.resources || []), ...(x?.domains || [])]) : [])]
    .filter(Boolean).join(" ").toLocaleLowerCase("es");
}

export default function LiveSearchOverlay({ open, onClose, allLive, surface, initialQuery = "", onSelect, onSearchNetwork }: Props) {
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (open) { setQuery(initialQuery); window.setTimeout(() => inputRef.current?.focus(), 30); } }, [initialQuery, open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredQuery(query), 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchIndex = useMemo(() => {
    const source = Array.isArray(allLive) ? allLive : [];
    const curated = surface === "market" ? source : (() => {
      const index = buildFalconSelectionIndex(source, surface);
      return source.filter((dv) => {
        if (surface === "falcon.skylines" && isRentalDV(dv)) return true;
        const decision = selectionForItem(index, dv);
        return decision?.state === "selected" || decision?.state === "pinned";
      });
    })();
    const profiles = projectLiveProfiles(source).map(profileSearchDV);
    return [...curated, ...profiles].map((dv) => ({ dv, text: searchableText(dv, source) }));
  }, [allLive, surface]);
  const results = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    return searchIndex.filter((entry) => !needle || entry.text.includes(needle)).slice(0, 18).map((entry) => entry.dv);
  }, [deferredQuery, searchIndex]);
  const groupedResults = useMemo(() => {
    const groups = [
      { label: "Productos", items: results.filter((dv) => classify(dv).kind === "product") },
      { label: "Perfiles", items: results.filter((dv) => classify(dv).kind === "profile") },
      { label: "Ofertas / posibilidades", items: results.filter((dv) => !["product", "profile"].includes(classify(dv).kind)) },
    ];
    return groups.filter((group) => group.items.length);
  }, [results]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180] bg-slate-950/45 p-3 backdrop-blur-md" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Búsqueda universal" onMouseDown={(e) => e.stopPropagation()} className="mx-auto mt-[8vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <Search className="h-5 w-5 text-slate-500" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="¿Qué estás buscando?" className="min-w-0 flex-1 bg-transparent text-lg text-slate-950 outline-none placeholder:text-slate-400" />
          <button type="button" onClick={onClose} aria-label="Cerrar búsqueda" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="px-2 pb-2 pt-1">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Sugerencias</div>
              <div className="flex flex-wrap gap-2">
                {[["☕", "café"], ["🪑", "muebles"], ["🏠", "casas"], ["🪵", "materiales"]].map(([icon, label]) => (
                  <button key={label} type="button" onClick={() => setQuery(label)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50">
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {results.length ? groupedResults.map((group) => <section key={group.label}><div className="px-3 pb-1 pt-3 text-xs font-black uppercase tracking-[.16em] text-slate-400">{group.label}</div>{group.items.map((dv) => {
            const type = classify(dv); const price = livePrice(dv); const seller = resolveLiveSeller(dv, allLive);
            return <button key={String(dv?.id)} type="button" onClick={() => { onSelect(dv, type.kind); onClose(); }} className="flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition hover:bg-slate-100">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-xl">{dv?.attrs?.avatar ? <img src={dv.attrs.avatar} alt="" className="h-full w-full object-cover" /> : type.icon}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-slate-950">{type.kind === "profile" ? dv?.attrs?.displayName : liveTitle(dv)}{type.kind === "profile" && dv?.attrs?.verified ? " ✓" : ""}</strong><span className="block truncate text-sm text-slate-500">{type.kind === "profile" ? `${dv?.attrs?.bio || "Perfil Vivo"}${dv?.attrs?.territoryName ? ` · ${dv.attrs.territoryName}` : ""}` : `${type.label}${seller !== "Nodo vendedor" ? ` · ${seller}` : ""}${price ? ` · ₲ ${price.toLocaleString("es-PY")}` : ""}`}</span></span>
              <span className="text-slate-400">→</span>
            </button>;
          })}</section>) : <div className="p-8 text-center text-sm text-slate-500">No encontramos resultados vivos para esa búsqueda.</div>}
          {surface !== "market" && query.trim() && onSearchNetwork ? (
            <button type="button" onClick={() => { onSearchNetwork(query.trim()); onClose(); }} className="mt-2 flex w-full items-center justify-between rounded-[18px] border border-cyan-200 bg-cyan-50 p-4 text-left font-bold text-cyan-950 transition hover:bg-cyan-100">
              <span>🌐 Buscar “{query.trim()}” en todo el Mercado Vivo</span>
              <span>→</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
