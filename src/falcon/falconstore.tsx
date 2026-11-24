import React, { Suspense, lazy, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import { getFalconSection } from "../utils/falconsection";
import { useFalconStorefront } from "./usefalconstorefront";
import FalconProductCard from "./falconproductcard";
import FalconProductDialog from "./falconproductdialog";
import FalconConsultModal from "./falconconsultmodal";
import type { FalconStoreItem } from "../types/falcon.store";
import { productPathFor, rememberProductOrigin } from "../mt/productRoute";
import { projectUniversalProduct, universalProductToCheckoutProduct } from "../components/UniversalProductDialog";
import MODesignOfferSection from "../mt/MODesignOfferSection";

const CheckoutModal = lazy(() => import("../pages/checkoutmodal"));

export default function FalconStorePage() {
  const baseSection = getFalconSection("store");
  const [params] = useSearchParams();
  const cat = params.get("cat") || baseSection.categories[0].id;
  const { items, filtered, loading, error, liveDVs = [] } = useFalconStorefront(cat) as any;
  const navigate = useNavigate();
  const location = useLocation();
  const openProduct = (item: FalconStoreItem) => {
    const siblings = items.map((candidate) => candidate.raw || candidate);
    rememberProductOrigin(item.raw || item, siblings, `${location.pathname}${location.search}${location.hash}`);
    navigate(productPathFor(item.raw || item, siblings));
  };
  const section = useMemo(() => {
    const categories: string[] = Array.from(
      new Set(items.map((item) => String(item.category || "").trim().toLowerCase()).filter(Boolean)),
    );
    const known = new Map<string, (typeof baseSection.categories)[number]>(baseSection.categories.map((item) => [item.id, item]));
    const visibleCategories: string[] = Array.from(new Set<string>([...baseSection.categories.filter(item => item.id !== "destacados").map(item => item.id), ...categories]));
    return {
      ...baseSection,
      categories: [
        known.get("destacados")!,
        ...visibleCategories.map((id) =>
          known.get(id) || {
            id,
            label: id
              .replace(/^(mt:)?cat[:.]/, "")
              .replace(/[-_]/g, " ")
              .replace(/^./, (letter) => letter.toUpperCase()),
            description: "Selección viva",
          },
        ),
      ].filter(Boolean),
    };
  }, [baseSection, items]);
  const [selectedItem, setSelectedItem] = useState<FalconStoreItem | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<FalconStoreItem | null>(null);
  const [consultItem, setConsultItem] = useState<FalconStoreItem | null>(null);
  const checkoutProduct = useMemo(() => {
    if (!checkoutItem) return null;
    return universalProductToCheckoutProduct(projectUniversalProduct(checkoutItem.raw || checkoutItem, {
      title: checkoutItem.title, description: checkoutItem.description, image: checkoutItem.image,
      seller: checkoutItem.sellerName, sellerNodeId: checkoutItem.sourceNode || checkoutItem.sellerId,
      currency: checkoutItem.currency, finalPrice: checkoutItem.price,
    }));
  }, [checkoutItem]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pt-2">
      <div className="flex items-end justify-between gap-4 px-1"><div><h1 className="text-2xl font-black text-slate-950">Store</h1><p className="text-sm text-slate-500">Selección para vos</p></div><span className="text-sm font-semibold text-slate-500">{loading ? "…" : `${filtered.length} productos`}</span></div>
      <CategoryPills section={section} />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <MODesignOfferSection allLive={liveDVs} />
      {loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-[24px] bg-slate-100" />)}</div> : filtered.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{filtered.map((item) => <FalconProductCard key={item.id} item={item} onOpen={openProduct} />)}</div>
      ) : <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-500">No hay productos vivos en esta categoría.</div>}

      <FalconProductDialog item={selectedItem} onClose={() => setSelectedItem(null)} onBuyNow={(item) => { setSelectedItem(null); setCheckoutItem(item); }} onConsult={(item) => { setSelectedItem(null); setConsultItem(item); }} />
      <Suspense fallback={null}><CheckoutModal open={!!checkoutProduct} product={checkoutProduct} onClose={() => setCheckoutItem(null)} onDone={() => setCheckoutItem(null)} /></Suspense>
      <FalconConsultModal item={consultItem} onClose={() => setConsultItem(null)} />
    </div>
  );
}
