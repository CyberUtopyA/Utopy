import { useCallback } from "react";
import {
  buildPresenceDV,
  buildPresenceSignal,
  type BuildPresenceDVOptions,
} from "./presence.dv";
import type { PresenceScanInput } from "./presence.types";
import { usePresenceStore } from "./presence.store";
import type { DVLike, ResonancePublisher } from "./resonance.types";

export type UsePresenceEmitterOptions = {
  publishDV?: ResonancePublisher;
  dvOptions?: BuildPresenceDVOptions;
  onPublishError?: (error: unknown, dv: DVLike) => void;
};

export function usePresenceEmitter(
  options: UsePresenceEmitterOptions = {}
) {
  const upsertSignal = usePresenceStore((state) => state.upsertSignal);
  const upsertMany = usePresenceStore((state) => state.upsertMany);
  const removeSignal = usePresenceStore((state) => state.removeSignal);
  const clearSignals = usePresenceStore((state) => state.clearSignals);

  const emitPresence = useCallback(
    (input: PresenceScanInput) => {
      const signal = buildPresenceSignal(input);
      upsertSignal(signal);
      return signal;
    },
    [upsertSignal]
  );

  const emitMany = useCallback(
    (inputs: PresenceScanInput[]) => {
      const signals = inputs.map(buildPresenceSignal);
      upsertMany(signals);
      return signals;
    },
    [upsertMany]
  );

  const emitAndPublish = useCallback(
    async (
      input: PresenceScanInput,
      dvOptions: BuildPresenceDVOptions = {}
    ) => {
      const signal = buildPresenceSignal(input);
      const dv = buildPresenceDV(signal, {
        ...(options.dvOptions || {}),
        ...dvOptions,
      });
      upsertSignal(signal);

      if (options.publishDV) {
        try {
          await options.publishDV(dv);
        } catch (error) {
          options.onPublishError?.(error, dv);
          throw error;
        }
      }

      return { signal, dv };
    },
    [options.dvOptions, options.onPublishError, options.publishDV, upsertSignal]
  );

  return {
    emitPresence,
    emitMany,
    emitAndPublish,
    removeSignal,
    clearSignals,
  };
}
