import { useEffect, useMemo, useState } from "react";
import { usePresence } from "./usepresence";
import { usePresenceActions } from "./usepresenceactions";
import PresenceBottomSheet from "./presencebottomsheet";
import PresenceOverlay from "./presenceoverlay";

type Props = {
  isMobile?: boolean;
  onOpenProduct?: (productId: string) => void;
  onOpenOffer?: (offerId: string) => void;
  onOpenCheckout?: (payload: any) => void;
  onOpenThread?: (threadId: string) => void;
  onOpenInvoice?: (payload: any) => void;
  onOpenMarket?: () => void;
  onOpenWhatsApp?: (payload: any) => void;
  onOpenMap?: (payload: any) => void;
  onRespondSignal?: (payload: any) => void;
  onRequestUtopy?: (payload: any) => void;
  onConnectNode?: (payload: any) => void;
};

export default function MtPresenceOverlay({
  isMobile = false,
  onOpenProduct,
  onOpenOffer,
  onOpenCheckout,
  onOpenThread,
  onOpenInvoice,
  onOpenMarket,
  onOpenWhatsApp,
  onOpenMap,
  onRespondSignal,
  onRequestUtopy,
  onConnectNode,
}: Props) {
  const { activeSignal, dismissSignal } = usePresence();
  const [sheetOpen, setSheetOpen] = useState(true);

  useEffect(() => {
    if (activeSignal?.id) setSheetOpen(true);
  }, [activeSignal?.id]);

  const actionRunner = usePresenceActions({
    openProduct: (productId) => onOpenProduct?.(productId),
    openOffer: (offerId) => onOpenOffer?.(offerId),
    openCheckout: (payload) => onOpenCheckout?.(payload),
    openThread: (threadId) => onOpenThread?.(threadId),
    openInvoice: (payload) => onOpenInvoice?.(payload),
    openMarket: () => onOpenMarket?.(),
    openWhatsApp: (payload) => onOpenWhatsApp?.(payload),
    openMap: (payload) => onOpenMap?.(payload),
    respondSignal: (payload) => onRespondSignal?.(payload),
    requestUtopy: (payload) => onRequestUtopy?.(payload),
    connectNode: (payload) => onConnectNode?.(payload),
    custom: () => {},
  });

  const activeActionMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const action of activeSignal?.actions || []) map.set(action.id, action);
    return map;
  }, [activeSignal]);

  const handleAction = (actionId: string) => {
    if (!activeSignal) return;
    const action = activeActionMap.get(actionId);
    if (action) actionRunner(action, activeSignal);
  };

  const handleDismiss = () => {
    if (!activeSignal?.id) return;
    dismissSignal(activeSignal.id);
    setSheetOpen(false);
  };

  if (isMobile) {
    return (
      <PresenceBottomSheet
        open={Boolean(activeSignal && sheetOpen)}
        signal={activeSignal}
        onClose={handleDismiss}
        onAction={handleAction}
      />
    );
  }

  return (
    <PresenceOverlay
      signal={activeSignal}
      onDismiss={handleDismiss}
      onAction={handleAction}
    />
  );
}
