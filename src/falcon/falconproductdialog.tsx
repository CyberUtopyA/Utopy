import React from "react";
import UniversalProductDialog, { projectUniversalProduct } from "../components/UniversalProductDialog";
import type { FalconStoreItem } from "../types/falcon.store";

type Props = {
  item: FalconStoreItem | null;
  onClose: () => void;
  onBuyNow: (item: FalconStoreItem) => void;
  onConsult: (item: FalconStoreItem) => void;
};

export default function FalconProductDialog({ item, onClose, onBuyNow, onConsult }: Props) {
  const view = item
    ? projectUniversalProduct(item.raw || item, {
        id: item.id,
        title: item.title,
        seller: item.sellerName || "Nodo vendedor",
        description: item.description || "",
        image: item.image || "",
        currency: item.currency,
        available: item.inStock !== false,
      })
    : null;
  return (
    <UniversalProductDialog
      open={Boolean(item)}
      product={view}
      onClose={onClose}
      onBuy={() => item && onBuyNow(item)}
      onConsult={() => item && onConsult(item)}
    />
  );
}
