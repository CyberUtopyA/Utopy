import { useEffect, useMemo, useState } from "react";
import { verifyAuthorizedDV } from "./authorizedPublish";

export function useVerifiedAuthorizedDVs(
  allLive: any[],
  kinds: readonly string[],
) {
  const kindKey = kinds.join("|");
  const candidates = useMemo(() => {
    const allowed = new Set(kindKey.split("|").filter(Boolean));
    return (Array.isArray(allLive) ? allLive : []).filter((dv) => allowed.has(String(dv?.kind || "")));
  }, [allLive, kindKey]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void Promise.all(candidates.map(async (dv) => {
      const proof = await verifyAuthorizedDV(dv, allLive);
      return proof.accepted && proof.proof === "verified" ? String(dv.id || "") : "";
    })).then((ids) => {
      if (!cancelled) setVerifiedIds(new Set(ids.filter(Boolean)));
    });
    return () => { cancelled = true; };
  }, [allLive, candidates]);

  return verifiedIds;
}
