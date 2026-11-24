import { useMemo, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { activeEntitlementDVs, isTrustedStudioDV } from "../utopy/studioEntitlements";

type Props = { section: "store" | "daily" | "skylines" | "capital"; live: any[]; actorId: string; authorizedNodeIds?: string[]; onManage: () => void };
const text = (value: unknown) => String(value || "").trim();
const names: Record<Props["section"], string> = { store: "Store", daily: "Daily", skylines: "Skylines", capital: "Capital" };
const safeLink = (value: unknown) => { const url = text(value); return /^https:\/\//i.test(url) ? url : ""; };

export default function FalconPassActions({ section, live, actorId, authorizedNodeIds = [], onManage }: Props) {
  const [notice, setNotice] = useState("");
  const status = useMemo(() => {
    const entitlements = activeEntitlementDVs(live, actorId, authorizedNodeIds);
    const matching = entitlements.some((dv) => {
      const attrs = dv.attrs || dv.payload || {};
      const refs = [attrs.productKey, attrs.entitlementKey, attrs.passId, attrs.planKey, ...(Array.isArray(attrs.entitlements) ? attrs.entitlements : [])].map(text);
      return refs.some((ref) => ref.toLowerCase().includes(section));
    });
    const sifen = entitlements.some((dv) => /sifen|fiscal\.managed/i.test(JSON.stringify(dv.attrs || dv.payload || {})));
    return { matching, sifen };
  }, [live, actorId, section, authorizedNodeIds]);
  const links = useMemo(() => {
    const studio = live.find((dv) => isTrustedStudioDV(dv) && (dv?.kind === "studio.pass.catalog" || (/studio/i.test(text(dv?.attrs?.nodeId || dv?.meta?.originNode)) && /manifest|profile/i.test(text(dv?.kind)))));
    const advertised = studio?.attrs?.links || {};
    const configured = {
      store: import.meta.env.VITE_UTOPY_STUDIO_STORE_PASS_URL,
      daily: import.meta.env.VITE_UTOPY_STUDIO_DAILY_PASS_URL,
      skylines: import.meta.env.VITE_UTOPY_STUDIO_PASS_URL,
      capital: import.meta.env.VITE_UTOPY_STUDIO_CAPITAL_PASS_URL,
    };
    return {
      acquire: safeLink(advertised[`${section}Pass`] || advertised.pass || advertised.studioPass || configured[section]),
      sifen: safeLink(advertised.sifenManaged || advertised.sifenPass || import.meta.env.VITE_UTOPY_STUDIO_SIFEN_PASS_URL),
    };
  }, [live, section]);
  const acquire = (url: string) => {
    if (!url) { setNotice("Studio todavía no anunció un enlace seguro para contratar este Pass."); return; }
    const target = new URL(url);
    target.searchParams.set("returnTo", window.location.href);
    window.open(target.href, "_blank", "noopener,noreferrer");
  };
  return <section className="fum-pass-actions" aria-label={`Pass ${names[section]}`}>
    <div className="fum-pass-copy"><Sparkles size={18} /><span><b>{names[section]} Pass</b><small>{status.matching ? "Activo para tu Identidad Viva" : "Descubrí más herramientas para este Nodo"}</small></span></div>
    <div className="fum-pass-buttons"><button type="button" onClick={() => acquire(links.acquire)}>Adquirir Pass <ArrowUpRight size={15} /></button><button type="button" onClick={onManage}>Gestionar Pass</button><button type="button" onClick={() => status.sifen ? onManage() : acquire(links.sifen)}>{status.sifen ? "Gestionar SIFEN" : "SIFEN administrado"}</button></div>
    {notice ? <p className="fum-pass-notice" role="status">{notice}</p> : null}
  </section>;
}
