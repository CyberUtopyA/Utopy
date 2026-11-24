import { useEffect, useState } from "react";
import { canAccessEnvelope } from "utopy/continuity";
import { verifyLivingCapabilityEnvelope, type LivingCapabilityEnvelope } from "utopy/living-space";
import { marketAuthorityTrust } from "./runtimeTrust";

export function useLivingCapabilities(allLive: any[], actorId = "") {
  const [capabilities, setCapabilities] = useState<LivingCapabilityEnvelope[]>([]);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const verified: LivingCapabilityEnvelope[] = [];
      for (const dv of allLive) {
        if (dv.kind !== "living.capability.manifest") continue;
        const envelope = dv.meta?.runtimeEnvelope || (dv.contentHash ? dv : null);
        if (!envelope || !envelope.scopes?.includes("public") || !canAccessEnvelope(envelope, { actorId })) continue;
        if ((await verifyLivingCapabilityEnvelope(envelope, marketAuthorityTrust.trusted)).ok) verified.push(envelope);
      }
      if (cancelled) return;
      const latest = new Map<string, LivingCapabilityEnvelope>();
      for (const envelope of verified) {
        const key = `${envelope.authority}|${envelope.payload.capability.code}`;
        const prior = latest.get(key);
        if (!prior || Date.parse(prior.createdAt) < Date.parse(envelope.createdAt)) latest.set(key, envelope);
      }
      setCapabilities([...latest.values()]);
      const expiry = Math.min(...[...verified.map((envelope) => Date.parse(envelope.expiresAt || "")), Date.parse(marketAuthorityTrust.snapshot?.expiresAt || "")].filter(Number.isFinite));
      if (Number.isFinite(expiry) && expiry > Date.now()) timer = setTimeout(refresh, Math.min(expiry - Date.now() + 10, 2_147_483_647));
    };
    void refresh();
    const changed = () => { clearTimeout(timer); void refresh(); };
    window.addEventListener("utopy:trust:changed", changed);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("utopy:trust:changed", changed); };
  }, [allLive, actorId]);
  return capabilities;
}
