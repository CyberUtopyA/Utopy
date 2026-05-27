import { create } from "zustand";
import type { PresenceSignal, PresenceState } from "./presence.types";
import { sortSignalsByPriority, uniqueSignals } from "./presence.helpers";

type PresenceStore = PresenceState & {
  upsertSignal: (signal: PresenceSignal) => void;
  upsertMany: (signals: PresenceSignal[]) => void;
  removeSignal: (id: string) => void;
  clearSignals: () => void;
  setActiveSignal: (signal: PresenceSignal | null) => void;
  dismissSignal: (id: string) => void;
  clearDismissed: () => void;
};

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  signals: [],
  activeSignal: null,
  dismissedIds: [],

  upsertSignal: (signal) =>
    set((s) => {
      const next = uniqueSignals([...s.signals.filter((x) => x.id !== signal.id), signal]);
      const sorted = sortSignalsByPriority(next);
      const active =
        s.activeSignal && s.activeSignal.id === signal.id
          ? signal
          : s.activeSignal || sorted[0] || null;

      return {
        signals: sorted,
        activeSignal: active,
      };
    }),

  upsertMany: (signals) =>
    set((s) => {
      const next = uniqueSignals([...s.signals, ...signals]);
      const sorted = sortSignalsByPriority(next);
      const active = s.activeSignal || sorted[0] || null;
      return {
        signals: sorted,
        activeSignal: active,
      };
    }),

  removeSignal: (id) =>
    set((s) => {
      const next = s.signals.filter((x) => x.id !== id);
      const active =
        s.activeSignal?.id === id ? next[0] || null : s.activeSignal;
      return {
        signals: next,
        activeSignal: active,
      };
    }),

  clearSignals: () =>
    set({
      signals: [],
      activeSignal: null,
    }),

  setActiveSignal: (signal) =>
    set({
      activeSignal: signal,
    }),

  dismissSignal: (id) =>
    set((s) => {
      const dismissedIds = Array.from(new Set([...s.dismissedIds, id]));
      const next = s.signals.filter((x) => x.id !== id);
      const active =
        s.activeSignal?.id === id ? next[0] || null : s.activeSignal;
      return {
        dismissedIds,
        signals: next,
        activeSignal: active,
      };
    }),

  clearDismissed: () =>
    set({
      dismissedIds: [],
    }),
}));