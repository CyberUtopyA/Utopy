import { usePresenceStore } from "./presence.store";

export function usePresence() {
  const signals = usePresenceStore((s) => s.signals);
  const activeSignal = usePresenceStore((s) => s.activeSignal);
  const dismissedIds = usePresenceStore((s) => s.dismissedIds);
  const upsertSignal = usePresenceStore((s) => s.upsertSignal);
  const upsertMany = usePresenceStore((s) => s.upsertMany);
  const removeSignal = usePresenceStore((s) => s.removeSignal);
  const clearSignals = usePresenceStore((s) => s.clearSignals);
  const setActiveSignal = usePresenceStore((s) => s.setActiveSignal);
  const dismissSignal = usePresenceStore((s) => s.dismissSignal);
  const clearDismissed = usePresenceStore((s) => s.clearDismissed);

  return {
    signals,
    activeSignal,
    dismissedIds,
    upsertSignal,
    upsertMany,
    removeSignal,
    clearSignals,
    setActiveSignal,
    dismissSignal,
    clearDismissed,
  };
}