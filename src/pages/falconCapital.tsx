import React, { Suspense, lazy, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import LiveProductCard from "../components/LiveProductCard";
import UniversalProductDialog, { formatUniversalMoney, projectUniversalProduct, universalProductToCheckoutProduct, type UniversalProductView } from "../components/UniversalProductDialog";
import { resolveLiveImage, resolveLiveSeller } from "../mt/livePresentation";
import { getFalconSection } from "../utils/falconsection";
import { useFalconCapital } from "../falcon/capital/usefalconcapital";
import { productPathFor, rememberProductOrigin } from "../mt/productRoute";

const CheckoutModal = lazy(() => import("./checkoutmodal"));

type Selected = { item: any; view: UniversalProductView } | null;

function capitalView(item: any, liveDVs: any[], pack = false) {
  const raw = item?.raw || item;
  return projectUniversalProduct(raw, {
    id: item.id,
    title: item.title,
    seller: item.producerName || resolveLiveSeller(raw, liveDVs),
    description: item.subtitle || "",
    image: resolveLiveImage(raw, liveDVs) || item.cover || "",
    currency: pack ? item.estimatedCurrency || "PYG" : item.currency || "PYG",
    finalPrice: pack ? item.estimatedCost : item.price,
    available: item.available !== false,
  });
}

export default function FalconCapitalPage() {
  const section = getFalconSection("capital");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cat = params.get("cat") || section.categories[0].id;
  const { loading, error, filteredAssets, filteredPacks, filteredProjects, liveDVs } = useFalconCapital(cat);
  const [selected, setSelected] = useState<Selected>(null);
  const [checkoutView, setCheckoutView] = useState<UniversalProductView | null>(null);
  const count = filteredAssets.length + filteredPacks.length + filteredProjects.length;
  const cards = useMemo(() => [
    ...filteredAssets.map((item: any) => ({ item, view: capitalView(item, liveDVs) })),
    ...filteredPacks.map((item: any) => ({ item, view: capitalView(item, liveDVs, true) })),
    ...filteredProjects.map((item: any) => ({ item, view: capitalView(item, liveDVs) })),
  ], [filteredAssets, filteredPacks, filteredProjects, liveDVs]);
  const openProduct = (item: any) => {
    const siblings = cards.map((entry) => entry.item?.raw || entry.item);
    rememberProductOrigin(item.raw || item, siblings, `${location.pathname}${location.search}${location.hash}`);
    navigate(productPathFor(item.raw || item, siblings));
  };

  const checkoutProduct = checkoutView ? universalProductToCheckoutProduct(checkoutView) : null;

  return <div className="mx-auto max-w-7xl space-y-5 pt-2">
    <div className="flex items-end justify-between gap-4 px-1"><div><h1 className="text-2xl font-black text-slate-950">◈ Capital</h1><p className="text-sm text-slate-500">Oportunidades seleccionadas</p></div><span className="text-sm font-semibold text-slate-500">{loading ? "…" : count}</span></div>
    <CategoryPills section={section} />
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-[24px] bg-slate-100" />)}</div> : cards.length ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ item, view }) => <LiveProductCard key={view.id} compact title={view.title} seller={view.seller} price={formatUniversalMoney(view.finalPrice, view.currency)} previousPrice={view.basePrice ? formatUniversalMoney(view.basePrice, view.currency) : null} discountPct={view.discountPct} discountLabel={view.discountAmount ? `Ahorrás ${formatUniversalMoney(view.discountAmount, view.currency)}` : null} installmentLabel={view.installmentCount && view.installmentValue ? `🗓 Hasta ${view.installmentCount} cuotas de ${formatUniversalMoney(view.installmentValue, view.currency)}` : null} image={view.image} actionLabel="Ver" onAction={() => openProduct(item)} />)}
    </div> : <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-500">Todavía no hay oportunidades seleccionadas.</div>}

    <UniversalProductDialog open={Boolean(selected)} product={selected?.view || null} onClose={() => setSelected(null)} onBuy={(view) => { setSelected(null); setCheckoutView(view); }} onConsult={() => { if (selected) window.dispatchEvent(new CustomEvent("utopy:open-dv", { detail: { dv: selected.item.raw, item: selected.item } })); setSelected(null); }} />
    <Suspense fallback={null}><CheckoutModal open={Boolean(checkoutProduct)} product={checkoutProduct} onClose={() => setCheckoutView(null)} onDone={() => setCheckoutView(null)} /></Suspense>
  </div>;
}
