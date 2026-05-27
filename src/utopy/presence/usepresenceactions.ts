import { useCallback } from "react";
import type { PresenceAction, PresenceSignal } from "./presence.types";

export type PresenceActionHandlers = {
  openProduct?: (productId: string, signal: PresenceSignal) => void;
  openOffer?: (offerId: string, signal: PresenceSignal) => void;
  openCheckout?: (payload: any, signal: PresenceSignal) => void;
  openThread?: (threadId: string, signal: PresenceSignal) => void;
  openInvoice?: (payload: any, signal: PresenceSignal) => void;
  openMarket?: (signal: PresenceSignal) => void;
  openDesigner?: (payload: any, signal: PresenceSignal) => void;
  custom?: (action: PresenceAction, signal: PresenceSignal) => void;
};

export function usePresenceActions(handlers: PresenceActionHandlers) {
  return useCallback(
    (action: PresenceAction, signal: PresenceSignal) => {
      switch (action.type) {
        case "open_product":
          if (action.payload?.productId) {
            handlers.openProduct?.(String(action.payload.productId), signal);
          }
          return;
        case "open_offer":
          if (action.payload?.offerId) {
            handlers.openOffer?.(String(action.payload.offerId), signal);
          }
          return;
        case "open_checkout":
          handlers.openCheckout?.(action.payload || {}, signal);
          return;
        case "open_thread":
          if (action.payload?.threadId) {
            handlers.openThread?.(String(action.payload.threadId), signal);
          }
          return;
        case "open_invoice":
          handlers.openInvoice?.(action.payload || {}, signal);
          return;
        case "open_market":
          handlers.openMarket?.(signal);
          return;
        case "open_designer":
          handlers.openDesigner?.(action.payload || {}, signal);
          return;
        default:
          handlers.custom?.(action, signal);
      }
    },
    [handlers]
  );
}