import React from "react";
import LiveProductCard from "../components/LiveProductCard";
import type { FalconStoreItem } from "../types/falcon.store";
import { readPublishedMerchandising } from "../mt/productMerchandising";
import { formatUniversalMoney, projectUniversalProduct } from "../components/UniversalProductDialog";

type Props = { item: FalconStoreItem; onOpen: (item: FalconStoreItem) => void };

export default function FalconProductCard({ item, onOpen }: Props) {
  const source = item.raw || item;
  const merchandising = readPublishedMerchandising(source);
  const view = projectUniversalProduct(source, {
    title: item.title,
    seller: item.sellerName || "Nodo vendedor",
    image: item.image || "",
    currency: item.currency,
  });
  const installmentLabel = merchandising.installmentCount && merchandising.installmentValue
    ? `🗓 Hasta ${merchandising.installmentCount} cuotas de ${formatUniversalMoney(merchandising.installmentValue, view.currency)}`
    : null;

  return <LiveProductCard title={view.title} seller={view.seller} collection={view.collection} price={formatUniversalMoney(view.finalPrice, view.currency)} previousPrice={view.basePrice ? formatUniversalMoney(view.basePrice, view.currency) : null} discountPct={view.discountPct} discountLabel={view.discountAmount ? `Ahorrás ${formatUniversalMoney(view.discountAmount, view.currency)}` : null} installmentLabel={installmentLabel} image={view.image} actionLabel="Ver" onAction={() => onOpen(item)} />;
}
