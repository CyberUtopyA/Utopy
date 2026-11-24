// src/utopy/bootLiveSymbiosis.ts
// Un único arranque para Market, Falcon, Pay, Perfil Vivo y Resonancia.

import { startMtNetworkIngest } from "../mt/mt.ingest";
import { startLiveCatalogSources } from "../mt/liveCatalog.sources";
import { startContinuousResonator } from "../mt/mt.resonator";
import { startBootstrapNodeSources } from "./bootstrapNodeSources";
import { startMarketRuntimeAdapter } from "./MarketRuntimeAdapter";
import { startFrequencyEngine } from "./frequency.engine";
import { startSkylinesRentalProjection } from "../mt/skylines.rentals";

type Runtime = { refs: number; release: () => void };
let active: Runtime | null = null;

export function bootLiveSymbiosis(): () => void {
  if (active) {
    active.refs += 1;
    return active.release;
  }

  const releases = [
    startMarketRuntimeAdapter(),
    startMtNetworkIngest(),
    startBootstrapNodeSources(),
    startLiveCatalogSources(),
    startSkylinesRentalProjection(),
    startContinuousResonator(),
    startFrequencyEngine(),
  ];

  const runtime: Runtime = {
    refs: 1,
    release: () => {
      runtime.refs -= 1;
      if (runtime.refs > 0) return;

      for (const release of releases.reverse()) {
        try {
          release?.();
        } catch {}
      }

      if (active === runtime) active = null;
    },
  };

  active = runtime;
  return runtime.release;
}
