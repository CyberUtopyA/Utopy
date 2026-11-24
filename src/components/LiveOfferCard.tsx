import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { profileHandleForIdentity } from "../mt/productRoute";

type Props = {
  title: string;
  seller?: string;
  meta: string;
  image?: string | null;
  icon?: string;
  eyebrow?: string;
  actionLabel: string;
  live?: boolean;
  onAction: () => void;
  sellerIdentity?: any;
};

export default function LiveOfferCard({
  title,
  seller,
  meta,
  image,
  icon = "✦",
  eyebrow,
  actionLabel,
  live = false,
  onAction,
  sellerIdentity,
}: Props) {
  const [broken, setBroken] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)]">
      {live ? <span className="absolute right-3 top-3 z-10 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 ring-4 ring-emerald-100" aria-label="Respuesta viva" /> : null}
      <button type="button" onClick={onAction} className="block h-full w-full text-left">
        <div className="h-40 bg-slate-100">
          {image && !broken ? (
            <img src={image} alt={title} loading="lazy" decoding="async" sizes="(min-width: 900px) 320px, 92vw" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">{icon}</div>
          )}
        </div>
        <div className="p-4">
          {eyebrow ? <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{eyebrow}</div> : null}
          <h3 className="mt-1 line-clamp-2 text-base font-black leading-snug text-slate-950">{title}</h3>
          {seller ? <span role="link" tabIndex={0} className="mt-2 block truncate text-sm text-slate-600 hover:underline" onClick={(event) => { event.stopPropagation(); navigate(`/${profileHandleForIdentity(sellerIdentity, seller)}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } }); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); navigate(`/${profileHandleForIdentity(sellerIdentity, seller)}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } }); } }}>○ {seller}</span> : null}
          <div className="mt-1 text-sm text-slate-500">{meta}</div>
          <div className="mt-4 flex justify-end">
            <span className="rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white">{actionLabel} →</span>
          </div>
        </div>
      </button>
    </article>
  );
}
