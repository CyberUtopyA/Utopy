import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, CircleDollarSign, FileText, Grid2X2, Heart, MapPin, Plus, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MapComponent from "../components/Mapcomponent";
import { useFalconFeed } from "../falcon/usefalconfeed";
import { buildFalconSelectionIndex, selectionForItem } from "../falcon/falcon.selection";
import { resolveLiveImage } from "../mt/livePresentation";
import { formatRentalMoney, rentalDisplayPrice } from "../utils/rentalProperty";
import { isRentalDV, projectRentalProperties } from "../mt/rental.domain";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import AddSkylinesProperty from "./skylines.property";
import SkylinesPassPanel from "./skylines.pass";
import { MyContractsContent } from "./mycontracts";
import { useLocalBuyerIdentity } from "../mt/uselocalbuyerindentity";
import { isTrustedStudioDV } from "../utopy/studioEntitlements";

type ViewMode = "map" | "catalog";
type OperationFilter = "all" | "rent" | "sale";

function propertyLike(dv: any) {
  const blob = [dv?.kind, ...(dv?.traits || []), dv?.attrs?.category, dv?.attrs?.operation].filter(Boolean).join(" ").toLowerCase();
  return /property|propiedad|realestate|alquiler|renta|inmueble|vivienda|terreno/.test(blob);
}
function isRental(property: any) { return /alquiler|renta/.test(String(property?.tipo || property?.operation || "").toLowerCase()); }
function imageOf(property: any) { const image = property?.image || property?.photos?.[0] || ""; return Array.isArray(image) ? image[0] || "" : image; }
function placeOf(property: any) { return property?.city || property?.zone || property?.address || property?.locationLabel || "Ubicación por completar"; }
function priceOf(property: any) { return isRental(property) ? rentalDisplayPrice(property?.rooms, property?.price, property?.currency) : formatRentalMoney(property?.price, property?.currency || "PYG"); }
function unitsOf(property: any) { return isRental(property) ? Number(property?.availableRooms ?? property?.rooms?.filter?.((room: any) => room?.available)?.length ?? 0) : Number(property?.availableRooms ?? (Array.isArray(property?.units) ? property.units.filter((unit: any) => unit.available).length : property?.units) ?? property?.roomCount ?? 1); }

function PropertyVisual({ property, featured = false, onOpen }: { property: any; featured?: boolean; onOpen: () => void }) {
  const image = imageOf(property);
  const rental = isRental(property);
  return <button type="button" onClick={onOpen} className={`group relative w-full min-w-0 overflow-hidden border border-slate-200/80 bg-white text-left shadow-[0_18px_55px_rgba(15,23,42,.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,.13)] ${featured ? "rounded-[32px] lg:grid lg:grid-cols-[1.35fr_.95fr]" : "rounded-[25px]"}`}>
    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-100 to-cyan-50 ${featured ? "h-[260px] sm:h-[340px] lg:h-[440px]" : "aspect-[1.45/1]"}`}>
      {image ? <img src={image} alt={property?.name || property?.title || "Propiedad"} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /> : <div className="grid h-full min-h-[220px] place-items-center text-center text-sm font-bold text-slate-400"><Building2 size={34}/><span>Imagen por completar</span></div>}
      <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-cyan-700/85 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur">{featured ? "Destacada" : rental ? "Alquiler" : "Compra"}</span>
      <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-950/25 text-white backdrop-blur-md"><Heart size={20}/></span>
      {!featured ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent px-4 pb-4 pt-16 text-white"><h3 className="text-lg font-black">{property?.name || property?.title || "Propiedad"}</h3><p className="mt-1 flex items-center gap-1 text-xs text-white/80"><MapPin size={13}/>{placeOf(property)}</p></div> : null}
    </div>
    <div className={`${featured ? "flex flex-col justify-center p-7 lg:p-9" : "p-4"}`}>
      {featured ? <><span className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Selección Falcon</span><h2 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-950">{property?.name || property?.title || "Propiedad"}</h2><p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500"><MapPin size={15}/>{placeOf(property)}</p><p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-600">{property?.description || "Una oportunidad viva seleccionada por Falcon Skylines."}</p></> : null}
      <div className={`${featured ? "mt-7" : ""} flex items-end justify-between gap-3`}><div><span className="text-[11px] font-bold text-slate-400">Desde</span><strong className={`${featured ? "text-xl" : "text-sm"} mt-0.5 block leading-tight text-slate-950`}>{priceOf(property)}</strong></div><span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-500"><i className="h-2 w-2 rounded-full bg-emerald-400"/>{unitsOf(property)} {unitsOf(property) === 1 ? "unidad" : "unidades"}</span></div>
    </div>
  </button>;
}

export default function FalconSkylinesPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ViewMode>("catalog");
  const [operation, setOperation] = useState<OperationFilter>("all");
  const [currency, setCurrency] = useState("PYG");
  const [passOpen, setPassOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [contractsOpen, setContractsOpen] = useState(false);
  const [networkLive, setNetworkLive] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  useEffect(() => mtLiveSubscribe((next) => setNetworkLive(next as any[])), []);
  useEffect(() => { if (!contractsOpen) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setContractsOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [contractsOpen]);
  const { liveDVs, loading } = useFalconFeed();
  const studioPassUrl = useMemo(() => {
    const advertised = networkLive.find((dv) => isTrustedStudioDV(dv) && (dv?.kind === "studio.pass.catalog" || (/studio/i.test(String(dv?.attrs?.nodeId || dv?.meta?.originNode || "")) && /manifest|profile/i.test(String(dv?.kind || "")))));
    const candidate = String(advertised?.attrs?.links?.skylinesPass || advertised?.attrs?.subscription?.skylinesPassUrl || import.meta.env.VITE_UTOPY_STUDIO_PASS_URL || "");
    return /^https:\/\//i.test(candidate) ? candidate : "";
  }, [networkLive]);
  const { buyerId, name: buyerName } = useLocalBuyerIdentity();
  const activeActor = useMemo(() => ({ id: buyerId, displayName: buyerName || "Propietario" }), [buyerId, buyerName]);

  const selectionIndex = useMemo(() => buildFalconSelectionIndex(liveDVs, "falcon.skylines"), [liveDVs]);
  const properties = useMemo(() => {
    const rentalProperties = projectRentalProperties(liveDVs);
    const rentalIds = new Set(rentalProperties.map((property) => String(property.id)));
    const liveProperties = liveDVs.filter((dv) => { const decision = selectionForItem(selectionIndex, dv); const own = buyerId && String(dv?.attrs?.actorId || dv?.attrs?.issuerActorId || "") === buyerId; return !isRentalDV(dv) && propertyLike(dv) && (decision?.state === "selected" || decision?.state === "pinned" || own); }).map((dv) => ({
      ...(dv.attrs || {}), id: dv.id, name: dv.attrs?.name || dv.attrs?.title || dv.labels?.[0] || "Propiedad", image: resolveLiveImage(dv, liveDVs), tipo: dv.attrs?.tipo || dv.attrs?.operation || dv.attrs?.category || "propiedad", operation: dv.attrs?.operation || dv.attrs?.tipo || "venta", price: dv.attrs?.price ?? dv.attrs?.precio,
      location: dv.attrs?.location || (Number.isFinite(Number(dv.attrs?.geo?.lat ?? dv.attrs?.lat)) && Number.isFinite(Number(dv.attrs?.geo?.lng ?? dv.attrs?.lng)) ? [Number(dv.attrs?.geo?.lat ?? dv.attrs?.lat), Number(dv.attrs?.geo?.lng ?? dv.attrs?.lng)] : null),
    }));
    return [...rentalProperties, ...liveProperties.filter((property) => !rentalIds.has(String(property.id)))];
  }, [buyerId, liveDVs, selectionIndex]);
  const visible = useMemo(() => properties.filter((property) => operation === "all" || (operation === "rent" ? isRental(property) : !isRental(property))), [operation, properties]);
  const featured = visible.find((property) => imageOf(property)) || visible[0];
  const liveNodes = useMemo(() => new Set(liveDVs.map((dv) => dv?.meta?.authority || dv?.attrs?.nodeId).filter(Boolean)).size, [liveDVs]);
  const mapFilters = useMemo(() => ({ currency, operation: operation === "rent" ? "Alquiler" : operation === "sale" ? "Venta" : "" }), [currency, operation]);
  const openProperty = (property: any) => {
    if (isRental(property)) {
      navigate(`/falcon/skylines/propiedad/${encodeURIComponent(property.id)}`);
      return;
    }
    setMode("map");
  };

  return <div className="mx-auto max-w-7xl space-y-5 px-1 pb-6 pt-3 text-slate-950">
    <div className="flex items-end justify-between gap-4 px-1"><div><h1 className="flex items-center gap-2 text-3xl font-black tracking-[-.045em]"><span aria-hidden>🏙️</span> Skylines</h1><p className="mt-1 text-sm font-medium text-slate-500">Propiedades seleccionadas</p></div><span className="text-sm font-bold text-slate-400">{loading ? "…" : visible.length}</span></div>
    <div className="grid max-w-2xl grid-cols-2 rounded-[24px] border border-slate-200/80 bg-slate-100/70 p-1.5 shadow-inner">
      <button type="button" onClick={() => setMode("map")} className={`flex min-h-12 items-center justify-center gap-2 rounded-[19px] text-sm font-black transition ${mode === "map" ? "bg-white text-cyan-700 shadow-[0_8px_24px_rgba(15,23,42,.09)] ring-1 ring-cyan-300" : "text-slate-500"}`}><MapPin size={18}/>Modo mapa</button>
      <button type="button" onClick={() => setMode("catalog")} className={`flex min-h-12 items-center justify-center gap-2 rounded-[19px] text-sm font-black transition ${mode === "catalog" ? "bg-white text-cyan-700 shadow-[0_8px_24px_rgba(15,23,42,.09)] ring-1 ring-cyan-300" : "text-slate-500"}`}><Grid2X2 size={17}/>Modo catálogo</button>
    </div>
    <div className="grid grid-cols-2 gap-2 pb-1 sm:flex sm:flex-wrap">
      <label className="relative flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"><Building2 size={17} className="text-cyan-700"/><select value={operation} onChange={(event) => setOperation(event.target.value as OperationFilter)} className="appearance-none bg-transparent pr-5 outline-none"><option value="all">Alquileres y venta</option><option value="rent">Alquileres</option><option value="sale">Compra/Venta</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3"/></label>
      <label className="relative flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"><CircleDollarSign size={17} className="text-cyan-700"/><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="appearance-none bg-transparent pr-5 outline-none"><option value="PYG">Precio en Gs.</option><option value="BRL">Precio en R$</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3"/></label>
      <span className="flex min-h-12 min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"><Radio size={17} className="shrink-0 text-cyan-700"/><i className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400"/>{liveNodes} nodos vivos</span>
      <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm"><Plus size={17} className="shrink-0"/>Añadir propiedad</button>
      <button type="button" onClick={() => setContractsOpen(true)} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm"><FileText size={17} className="shrink-0"/>Mis contratos</button>
      <button type="button" onClick={() => navigate("/market?tab=producir&view=publicar")} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm"><Plus size={17} className="shrink-0"/>Crear publicación</button>
    </div>
    {mode === "map" ? <div className="relative h-[calc(100vh-330px)] min-h-[560px] overflow-hidden rounded-[34px] border border-white bg-slate-100 shadow-[0_25px_80px_rgba(15,23,42,.12)] ring-1 ring-slate-200 [&_.leaflet-control-zoom]:overflow-hidden [&_.leaflet-control-zoom]:rounded-2xl [&_.leaflet-control-zoom]:border-0 [&_.leaflet-control-zoom]:shadow-xl">
      <MapComponent filters={mapFilters} properties={visible} onCloseMap={() => {}} />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1005] flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&>*]:pointer-events-auto [&::-webkit-scrollbar]:hidden">{visible.slice(0, 5).map((property) => <button key={property.id} type="button" onClick={() => openProperty(property)} className="grid w-[260px] shrink-0 grid-cols-[82px_1fr] overflow-hidden rounded-[20px] border border-white/80 bg-white/90 text-left shadow-2xl backdrop-blur-xl"><div className="bg-slate-100">{imageOf(property) ? <img src={imageOf(property)} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center"><Building2 size={22}/></div>}</div><div className="min-w-0 p-3"><span className="text-[10px] font-black uppercase tracking-wider text-cyan-700">{isRental(property) ? "Alquiler" : "Compra"}</span><strong className="mt-1 block truncate text-sm">{property.name || property.title}</strong><small className="mt-1 block truncate text-slate-500">{priceOf(property)}</small></div></button>)}</div>
      {!visible.length ? <div className="absolute inset-0 z-[1006] grid place-items-center bg-white/75 p-8 text-center text-sm font-semibold text-slate-500 backdrop-blur">No hay propiedades en esta selección.</div> : null}
    </div> : <div className="space-y-7">
      {featured ? <PropertyVisual property={featured} featured onOpen={() => openProperty(featured)}/> : <div className="rounded-[30px] border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">Todavía no hay propiedades seleccionadas.</div>}
      {visible.length > 1 ? <section><div className="mb-4"><h2 className="text-xl font-black tracking-[-.03em]">Propiedades premium</h2><p className="mt-1 text-sm text-slate-500">Selección curada de oportunidades vivas.</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.filter((property) => property !== featured).map((property) => <PropertyVisual key={property.id} property={property} onOpen={() => openProperty(property)}/>)}</div></section> : null}
    </div>}
    <AddSkylinesProperty open={addOpen} onClose={() => setAddOpen(false)} allLive={networkLive} activeActor={activeActor} />
    {contractsOpen ? <div role="dialog" aria-modal="true" aria-label="Mis contratos" className="fixed inset-0 z-[10060] grid place-items-center bg-indigo-950/20 p-3 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setContractsOpen(false); }}><MyContractsContent onClose={() => setContractsOpen(false)}/></div> : null}
    <SkylinesPassPanel open={passOpen} onClose={() => setPassOpen(false)} onOpenContracts={() => { setPassOpen(false); setContractsOpen(true); }} properties={properties} allLive={networkLive} activeActor={activeActor} studioPassUrl={studioPassUrl} />
  </div>;
}
