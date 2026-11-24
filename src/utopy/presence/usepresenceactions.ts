import { useCallback, useMemo } from "react";
import type { PresenceAction, PresenceSignal } from "./presence.types";

export type PresenceActionHandlers = {
  openProduct?: (productId: string, signal: PresenceSignal) => void;
  openOffer?: (offerId: string, signal: PresenceSignal) => void;
  openCheckout?: (payload: any, signal: PresenceSignal) => void;
  openThread?: (threadId: string, signal: PresenceSignal) => void;
  openInvoice?: (payload: any, signal: PresenceSignal) => void;
  openMarket?: (signal: PresenceSignal) => void;
  openDesigner?: (payload: any, signal: PresenceSignal) => void;
  openWhatsApp?: (payload: any, signal: PresenceSignal) => void;
  openMap?: (payload: any, signal: PresenceSignal) => void;
  emitSignal?: (payload: any, signal: PresenceSignal) => void;
  respondSignal?: (payload: any, signal: PresenceSignal) => void;
  requestUtopy?: (payload: any, signal: PresenceSignal) => void;
  connectNode?: (payload: any, signal: PresenceSignal) => void;
  custom?: (action: PresenceAction, signal: PresenceSignal) => void;
};

export function usePresenceActions(handlers: PresenceActionHandlers) {
  const stable = useMemo(() => handlers, [handlers]);

  return useCallback(
    (action: PresenceAction, signal: PresenceSignal) => {
      switch (action.type) {
        case "open_product":
          if (action.payload?.productId) {
            stable.openProduct?.(String(action.payload.productId), signal);
          }
          return;
        case "open_offer":
          if (action.payload?.offerId) {
            stable.openOffer?.(String(action.payload.offerId), signal);
          }
          return;
        case "open_checkout":
          stable.openCheckout?.(action.payload || {}, signal);
          return;
        case "open_thread":
          if (action.payload?.threadId) {
            stable.openThread?.(String(action.payload.threadId), signal);
          }
          return;
        case "open_invoice":
          stable.openInvoice?.(action.payload || {}, signal);
          return;
        case "open_market":
          stable.openMarket?.(signal);
          return;
        case "open_designer":
          stable.openDesigner?.(action.payload || {}, signal);
          return;
        case "open_whatsapp":
          stable.openWhatsApp?.(action.payload || {}, signal);
          return;
        case "open_map":
          stable.openMap?.(action.payload || {}, signal);
          return;
        case "emit_signal":
          stable.emitSignal?.(action.payload || {}, signal);
          return;
        case "respond_signal":
          stable.respondSignal?.(action.payload || {}, signal);
          return;
        case "request_utopy":
          stable.requestUtopy?.(action.payload || {}, signal);
          return;
        case "connect_node":
          stable.connectNode?.(action.payload || {}, signal);
          return;
        default:
          stable.custom?.(action, signal);
      }
    },
    [stable]
  );
}
