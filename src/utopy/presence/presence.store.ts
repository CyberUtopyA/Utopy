import { create } from "zustand";
import type { PresenceSignal, PresenceState } from "./presence.types";
import {
  isPresenceExpired,
  sortSignalsByPriority,
  uniqueSignals,
} from "./presence.helpers";

type PresenceStore = PresenceState & {
  upsertSignal: (signal: PresenceSignal) => void;
  upsertMany: (signals: PresenceSignal[]) => void;
  removeSignal: (id: string) => void;
  clearSignals: () => void;
  clearExpired: () => void;
  setActiveSignal: (signal: PresenceSignal | null) => void;
  dismissSignal: (id: string) => void;
  clearDismissed: () => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  signals: [],
  activeSignal: null,
  dismissedIds: [],

  upsertSignal: (signal) =>
    set((state) => {
      if (
        !signal?.id ||
        isPresenceExpired(signal) ||
        state.dismissedIds.includes(signal.id)
      ) {
        return state;
      }

      const current = state.signals.filter(
        (item) =>
          item.id !== signal.id &&
          !state.dismissedIds.includes(item.id) &&
          !isPresenceExpired(item)
      );
      const sorted = sortSignalsByPriority(uniqueSignals([...current, signal]));
      const active =
        state.activeSignal && state.activeSignal.id === signal.id
          ? signal
          : state.activeSignal &&
              !isPresenceExpired(state.activeSignal) &&
              !state.dismissedIds.includes(state.activeSignal.id)
            ? state.activeSignal
            : sorted[0] || null;

      return { signals: sorted, activeSignal: active };
    }),

  upsertMany: (signals) =>
    set((state) => {
      const allowed = signals.filter(
        (signal) =>
          signal?.id &&
          !state.dismissedIds.includes(signal.id) &&
          !isPresenceExpired(signal)
      );
      const current = state.signals.filter(
        (signal) =>
          !state.dismissedIds.includes(signal.id) &&
          !isPresenceExpired(signal)
      );
      const sorted = sortSignalsByPriority(uniqueSignals([...current, ...allowed]));
      const active =
        state.activeSignal &&
        !state.dismissedIds.includes(state.activeSignal.id) &&
        !isPresenceExpired(state.activeSignal)
          ? sorted.find((signal) => signal.id === state.activeSignal?.id) ||
            state.activeSignal
          : sorted[0] || null;
      return { signals: sorted, activeSignal: active };
    }),

  removeSignal: (id) =>
    set((state) => {
      const next = state.signals.filter((signal) => signal.id !== id);
      return {
        signals: next,
        activeSignal:
          state.activeSignal?.id === id
            ? next[0] || null
            : state.activeSignal,
      };
    }),

  clearSignals: () => set({ signals: [], activeSignal: null }),

  clearExpired: () =>
    set((state) => {
      const next = state.signals.filter(
        (signal) =>
          !isPresenceExpired(signal) &&
          !state.dismissedIds.includes(signal.id)
      );
      return {
        signals: next,
        activeSignal:
          state.activeSignal &&
          !isPresenceExpired(state.activeSignal) &&
          !state.dismissedIds.includes(state.activeSignal.id)
            ? state.activeSignal
            : next[0] || null,
      };
    }),

  setActiveSignal: (signal) => set({ activeSignal: signal }),

  dismissSignal: (id) =>
    set((state) => {
      const dismissedIds = Array.from(new Set([...state.dismissedIds, id]));
      const next = state.signals.filter((signal) => signal.id !== id);
      return {
        dismissedIds,
        signals: next,
        activeSignal:
          state.activeSignal?.id === id
            ? next[0] || null
            : state.activeSignal,
      };
    }),

  clearDismissed: () => set({ dismissedIds: [] }),
}));
