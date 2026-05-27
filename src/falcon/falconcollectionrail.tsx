import React from "react";
import FalconProductCard from "./falconproductcard";
import type { FalconStoreCollection, FalconStoreItem } from "../types/falcon.store";

type Props = {
  collection: FalconStoreCollection;
  onOpen: (item: FalconStoreItem) => void;
};

export default function FalconCollectionRail({ collection, onOpen }: Props) {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Colección
          </div>
          <h2 className="text-2xl font-bold text-slate-950">
            {collection.title}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {collection.subtitle}
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {collection.items.map((item) => (
          <div
            key={item.id}
            className="min-w-[300px] max-w-[300px] flex-shrink-0"
          >
            <FalconProductCard item={item} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}