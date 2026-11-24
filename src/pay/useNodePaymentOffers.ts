// src/pay/useNodePaymentOffers.ts
// El método de pago pertenece al nodo; el cajero solamente opera la sesión.

import { useEffect, useMemo, useState } from "react";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { nodeIdentityOf, normalizeSemantic } from "../mt/utopy.symbiosis";

function key(value: unknown) {
  return normalizeSemantic(value).replace(/^utopy\.node\./, "").replace(/[^a-z0-9]/g, "");
}

export function useNodePaymentOffers(nodeId?: string | null) {
  const [all, setAll] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  useEffect(() => mtLiveSubscribe((next) => setAll(next as any[])), []);

  return useMemo(() => {
    const target = key(nodeId || "");
    return all
      .filter((dv) => normalizeSemantic(dv?.kind) === "payment.offer")
      .filter((dv) => !target || key(nodeIdentityOf(dv)) === target)
      .sort((a, b) =>
        String(b?.meta?.updatedAt || b?.meta?.ts || "").localeCompare(
          String(a?.meta?.updatedAt || a?.meta?.ts || ""),
        ),
      );
  }, [all, nodeId]);
}
