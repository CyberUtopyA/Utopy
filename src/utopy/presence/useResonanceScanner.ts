import { useEffect, useMemo, useState } from "react";
import { mtLiveSubscribe } from "../mt/mt.liveStore";
import {
  matchIntentWithCapabilities,
  type ResonanceMatchContext,
} from "./resonance.matcher";
import type { DVLike } from "./resonance.types";

function isCapabilityDV(dv: DVLike): boolean {
  return Boolean(
    dv?.kind === "capability.offer" ||
      Array.isArray(dv?.attrs?.capabilities) ||
      dv?.traits?.includes("resonance:capable")
  );
}

export type UseResonanceScannerOptions = {
  enabled?: boolean;
  intentDV: DVLike | null;
  allDVs?: DVLike[];
  context?: ResonanceMatchContext;
  limit?: number;
};

export default function useResonanceScanner(
  options: UseResonanceScannerOptions
) {
  const {
    enabled = true,
    intentDV,
    allDVs,
    context,
    limit = 12,
  } = options;
  const [liveDVs, setLiveDVs] = useState<DVLike[]>(allDVs || []);

  useEffect(() => {
    if (allDVs) {
      setLiveDVs(allDVs);
      return;
    }
    if (!enabled) {
      setLiveDVs([]);
      return;
    }

    return mtLiveSubscribe((next: DVLike[]) => {
      setLiveDVs(Array.isArray(next) ? next : []);
    });
  }, [allDVs, enabled]);

  const capabilityDVs = useMemo(
    () => liveDVs.filter(isCapabilityDV),
    [liveDVs]
  );
  const matches = useMemo(
    () =>
      enabled && intentDV
        ? matchIntentWithCapabilities(intentDV, capabilityDVs, context).slice(
            0,
            Math.max(1, limit)
          )
        : [],
    [capabilityDVs, context, enabled, intentDV, limit]
  );

  return {
    capabilityDVs,
    matches,
    proposals: matches.map((match) => match.proposalDV),
    strongest: matches[0] || null,
    count: matches.length,
    hasMatches: matches.length > 0,
  };
}
