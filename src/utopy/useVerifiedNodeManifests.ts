import { useEffect, useMemo, useState } from "react";
import { verifyNodeManifestDV } from "../mt/utopy.nodeManifest";

function text(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function manifestNodeId(dv: any) {
  return text(dv?.attrs?.nodeId, dv?.attrs?.node?.id);
}

export function manifestCapabilities(dv: any) {
  const values = Array.isArray(dv?.attrs?.capabilities) ? dv.attrs.capabilities : [];
  return Array.from(new Set(values.flatMap((value: any) => [
    typeof value === "string" ? value : value?.id,
    ...(Array.isArray(value?.produces) ? value.produces : []),
    ...(Array.isArray(value?.accepts) ? value.accepts : []),
    ...(Array.isArray(value?.verbs) ? value.verbs : []),
  ]).map(text).filter(Boolean)));
}

export function useVerifiedNodeManifests(allLive: any[]) {
  const manifests = useMemo(
    () => (Array.isArray(allLive) ? allLive : []).filter((dv) =>
      /node\.manifest$/i.test(text(dv?.kind)),
    ),
    [allLive],
  );
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      manifests.map(async (manifest) => {
        const result = await verifyNodeManifestDV(manifest, allLive);
        return result.accepted && result.proof === "verified" ? text(manifest?.id) : "";
      }),
    ).then((ids) => {
      if (!cancelled) setVerifiedIds(new Set(ids.filter(Boolean)));
    });
    return () => {
      cancelled = true;
    };
  }, [allLive, manifests]);

  return {
    manifests,
    verifiedIds,
    verifiedManifests: manifests.filter((manifest) => verifiedIds.has(text(manifest?.id))),
    verifying: manifests.length > 0 && verifiedIds.size === 0,
  };
}
