import { useEffect, useMemo, useState } from "react";
import { Building2, Check, MapPin } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { projectRentalProperties } from "../mt/rental.domain";
import { asRentalMoneyNumber, formatRentalMoney } from "../utils/rentalProperty";

export default function SkylinesRentalDetailPage() {
  const { propertyId = "" } = useParams();
  const navigate = useNavigate();
  const [live, setLive] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => mtLiveSubscribe((items) => setLive(items as any[])), []);
  const property = useMemo(() => projectRentalProperties(live).find((item) => String(item.id) === propertyId), [live, propertyId]);
  const selected = property?.rooms?.find?.((room: any) => String(room.id) === selectedId);
  if (!property) return <div className="grid min-h-[55vh] place-items-center text-sm font-bold text-slate-500">Buscando propiedad viva…</div>;

  const openUnit = (reserve = false) => {
    if (!selected) return;
    navigate(`/falcon/propiedad/${encodeURIComponent(property.id)}/pieza/${encodeURIComponent(String(selected.number))}`, {
      state: { propertyId: property.id, room: selected, name: property.name, price: selected.price, currency: selected.currency, image: selected.image || property.image, location: property.location, description: property.description, owner: property.owner_id || property.ownerId, city: property.city || "", address: property.address || "", reserveDirect: reserve },
    });
  };

  return <main className="mx-auto max-w-6xl space-y-6 pb-8">
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.1)] lg:grid lg:grid-cols-[1.15fr_.85fr]">
      <div className="min-h-[320px] bg-slate-100">{property.image ? <img src={property.image} alt={property.name} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center"><Building2 size={38}/></div>}</div>
      <div className="p-6 sm:p-8">
        <span className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Nodo vivo de alquiler</span>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{property.name}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><MapPin size={16}/>{property.address || property.city || "Salto del Guairá"}</p>
        <p className="mt-5 text-sm leading-6 text-slate-600">{property.description || `Propiedad de alquiler con ${property.rooms?.length || 0} unidades.`}</p>
        {Array.isArray(property.servicesIncluded) && property.servicesIncluded.length ? <p className="mt-4 text-sm font-bold leading-6 text-slate-700">Incluye {property.servicesIncluded.join(" · ")}</p> : null}
        <p className="mt-5 text-sm font-bold text-emerald-600">{property.availableRooms} {property.availableRooms === 1 ? "unidad disponible" : "unidades disponibles"}</p>
      </div>
    </section>

    {Array.isArray(property.photos) && property.photos.length > 1 ? <section className="grid grid-cols-3 gap-2 overflow-hidden rounded-[24px]">{property.photos.slice(0, 3).map((photo: string, index: number) => <img key={photo} src={photo} alt={`${property.name} ${index + 1}`} className="aspect-[4/3] h-full w-full object-cover" />)}</section> : null}

    <section><h2 className="text-xl font-black">Unidades</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{property.rooms?.map?.((room: any) => {
      const chosen = String(room.id) === selectedId;
      const available = room.available === true;
      const contractPrice = asRentalMoneyNumber(room.longTermPrice ?? room.contractPrice);
      return <button key={room.id} type="button" disabled={!available} onClick={() => setSelectedId(String(room.id))} className={`rounded-[24px] border p-5 text-left transition ${chosen ? "border-cyan-400 bg-cyan-50 shadow-lg" : "border-slate-200 bg-white hover:border-cyan-200"} disabled:cursor-not-allowed disabled:opacity-55`}>
        <div className="flex items-center justify-between"><strong>Unidad {room.number}</strong>{chosen ? <Check size={18} className="text-cyan-700"/> : null}</div>
        {room.floor ? <p className="mt-2 text-xs font-bold text-slate-500">{room.floor}</p> : null}
        <strong className="mt-4 block text-lg">{formatRentalMoney(room.price, room.currency)} / mes</strong>
        {contractPrice != null && Number(room.minimumMonthsForLongTermPrice || 0) > 0 ? <span className="mt-1 block text-xs font-black text-cyan-700">{formatRentalMoney(contractPrice, room.currency)} con contrato de {room.minimumMonthsForLongTermPrice}+ meses</span> : null}
        <span className={`mt-2 block text-xs font-black ${available ? "text-emerald-600" : "text-rose-600"}`}>{available ? "Disponible" : "Ocupada"}</span>
        {available ? <span className="mt-4 inline-block rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Seleccionar</span> : null}
      </button>;
    })}</div></section>
    <div className="sticky bottom-24 z-20 flex justify-end gap-2"><button disabled={!selected} onClick={() => openUnit(false)} className="min-h-14 rounded-2xl border border-slate-200 bg-white px-6 font-black shadow-xl disabled:opacity-40">Ver</button><button disabled={!selected} onClick={() => openUnit(true)} className="min-h-14 rounded-2xl bg-slate-950 px-7 font-black text-white shadow-xl disabled:opacity-40">Reservar</button></div>
  </main>;
}
