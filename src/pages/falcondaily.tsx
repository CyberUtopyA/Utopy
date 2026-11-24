import React, { Suspense, lazy, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CategoryPills from "../components/CategoryPills";
import FalconConsultModal from "../falcon/falconconsultmodal";
import FalconProductCard from "../falcon/falconproductcard";
import FalconProductDialog from "../falcon/falconproductdialog";
import { resolveLiveImage, resolveLiveSeller } from "../mt/livePresentation";
import type { FalconStoreItem } from "../types/falcon.store";
import { getFalconSection } from "../utils/falconsection";
import { useFalconDayli } from "./usefalcondayli";
import { productPathFor, rememberProductOrigin } from "../mt/productRoute";
import { projectUniversalProduct, universalProductToCheckoutProduct } from "../components/UniversalProductDialog";

const CheckoutModal = lazy(() => import("./checkoutmodal"));

export default function FalconDailyPage() {
  const baseSection = getFalconSection("daily");
  const [params] = useSearchParams();
  const cat = params.get("cat") || baseSection.categories[0].id;
  const { loading, error, foods, filteredFoods, liveDVs = [] } = useFalconDayli(cat) as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedItem, setSelectedItem] = useState<FalconStoreItem | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<FalconStoreItem | null>(null);
  const [consultItem, setConsultItem] = useState<FalconStoreItem | null>(null);

  const section = useMemo(() => {
    return {
      ...baseSection,
      categories: baseSection.categories,
    };
  }, [baseSection, foods]);

  const items = useMemo<FalconStoreItem[]>(
    () =>
      filteredFoods.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.subtitle,
        price: item.price,
        currency: item.currency || "PYG",
        image: resolveLiveImage(item.raw, liveDVs) || item.cover || "",
        images: [],
        category: item.category,
        tags: item.tags || [],
        sellerId: item.producerId || item.nodeId,
        sellerName: resolveLiveSeller(item.raw, liveDVs),
        sourceNode: item.nodeId,
        featured: item.selectionState === "pinned",
        inStock: item.available,
        score: item.score,
        raw: item.raw,
      })),
    [filteredFoods, liveDVs],
  );

  const checkoutProduct = useMemo(
    () =>
      checkoutItem
        ? universalProductToCheckoutProduct(projectUniversalProduct(checkoutItem.raw || checkoutItem, {
            title: checkoutItem.title, description: checkoutItem.description, image: checkoutItem.image,
            seller: checkoutItem.sellerName, sellerNodeId: checkoutItem.sourceNode || checkoutItem.sellerId,
            currency: checkoutItem.currency, finalPrice: checkoutItem.price,
          }))
        : null,
    [checkoutItem],
  );
  const openProduct = (item: FalconStoreItem) => {
    const siblings = items.map((candidate) => candidate.raw || candidate);
    rememberProductOrigin(item.raw || item, siblings, `${location.pathname}${location.search}${location.hash}`);
    navigate(productPathFor(item.raw || item, siblings));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pt-2">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Daily</h1>
          <p className="text-sm text-slate-500">Para hoy</p>
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {loading ? "â€¦" : `${items.length} productos`}
        </span>
      </div>

      <CategoryPills section={section} />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {items.map((item) => (
            <FalconProductCard key={item.id} item={item} onOpen={openProduct} />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-500">
          La red todavía no publicó algo para esta categoría.
        </div>
      )}

      <FalconProductDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onBuyNow={(item) => {
          setSelectedItem(null);
          setCheckoutItem(item);
        }}
        onConsult={(item) => {
          setSelectedItem(null);
          setConsultItem(item);
        }}
      />
      <Suspense fallback={null}><CheckoutModal
        open={!!checkoutProduct}
        product={checkoutProduct}
        onClose={() => setCheckoutItem(null)}
        onDone={() => setCheckoutItem(null)}
      /></Suspense>
      <FalconConsultModal item={consultItem} onClose={() => setConsultItem(null)} />
    </div>
  );
}
