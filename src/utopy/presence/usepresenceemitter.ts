import { useCallback } from "react";
import { buildPresenceSignal } from "./presence.dv";
import type { PresenceScanInput } from "./presence.types";
import { usePresenceStore } from "./presence.store";

export function usePresenceEmitter() {
  const upsertSignal = usePresenceStore((s) => s.upsertSignal);
  const upsertMany = usePresenceStore((s) => s.upsertMany);
  const removeSignal = usePresenceStore((s) => s.removeSignal);
  const clearSignals = usePresenceStore((s) => s.clearSignals);

  const emitPresence = useCallback((input: PresenceScanInput) => {
    const signal = buildPresenceSignal(input);
    upsertSignal(signal);
    return signal;
  }, [upsertSignal]);

  const emitMany = useCallback((inputs: PresenceScanInput[]) => {
    const signals = inputs.map(buildPresenceSignal);
    upsertMany(signals);
    return signals;
  }, [upsertMany]);

  return {
    emitPresence,
    emitMany,
    removeSignal,
    clearSignals,
  };
}