import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { profileHandleForIdentity } from "../mt/productRoute";
import { inspectWithMotion, prefetchProductCheckout } from "./productMotion";

type Props = {
  title: string;
  seller: string;
  price: string;
  image?: string;
  actionLabel?: string;
  onAction: () => void;
  compact?: boolean;
  previousPrice?: string | null;
  discountPct?: number | null;
  discountLabel?: string | null;
  installmentLabel?: string | null;
  priority?: boolean;
  collection?: string | null;
  sellerIdentity?: any;
  onSeller?: () => void;
};

export default function LiveProductCard({ title, seller, price, image, actionLabel = "Ver", onAction, compact = false, previousPrice, discountPct, discountLabel, installmentLabel, priority = false, collection, sellerIdentity, onSeller }: Props) {
  const [broken, setBroken] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const showImage = Boolean(image) && !broken;
  const openSeller = () => {
    if (onSeller) return onSeller();
    const handle = profileHandleForIdentity(sellerIdentity, seller);
    navigate(`/${handle}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } });
  };
  return (
    <article style={{ contentVisibility: "auto", containIntrinsicSize: compact ? "220px" : "340px" }} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)]">
      <button type="button" onPointerEnter={prefetchProductCheckout} onFocus={prefetchProductCheckout} onClick={(event) => inspectWithMotion(event.currentTarget, onAction)} className="block w-full text-left">
        <div className={`${compact ? "h-36" : "aspect-[4/3]"} relative bg-slate-100`}>
          {showImage ? <img src={image} alt={title} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" sizes="(min-width: 1100px) 210px, (min-width: 900px) 25vw, (min-width: 520px) 33vw, 50vw" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-300 motion-reduce:transition-none group-hover:scale-[1.025] motion-reduce:group-hover:scale-100" /> : <div className="grid h-full place-items-center text-center text-slate-400"><div><div className="text-3xl">📦</div><div className="mt-1 text-xs font-semibold">Sin imagen</div></div></div>}
          {discountPct || discountLabel ? <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-black text-white shadow-sm">🔥 {discountPct ? `-${discountPct}%` : discountLabel}</span> : null}
        </div>
        <div className="p-4">
          {collection ? <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-violet-600">{collection}</div> : null}
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-950">{title}</h3>
          <span role="link" tabIndex={0} className="mt-2 block truncate text-sm text-slate-600 hover:underline" onClick={(event) => { event.stopPropagation(); openSeller(); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); openSeller(); } }}>○ {seller}</span>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {previousPrice ? <div className="text-xs font-bold text-slate-400 line-through">{previousPrice}</div> : null}
              <strong className="block text-xl font-black text-slate-950">{price}</strong>
              {installmentLabel ? <div className="mt-1 text-xs font-bold leading-snug text-emerald-700">{installmentLabel}</div> : null}
            </div>
            <span className="shrink-0 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white">{actionLabel} →</span>
          </div>
        </div>
      </button>
    </article>
  );
}
