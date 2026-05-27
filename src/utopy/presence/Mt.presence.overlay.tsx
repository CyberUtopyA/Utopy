import { useMemo, useState } from "react";
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
};

export default function MtPresenceOverlay({
  isMobile = false,
  onOpenProduct,
  onOpenOffer,
  onOpenCheckout,
  onOpenThread,
  onOpenInvoice,
  onOpenMarket,
}: Props) {
  const { activeSignal, dismissSignal } = usePresence();
  const [sheetOpen, setSheetOpen] = useState(true);

  const actionRunner = usePresenceActions({
    openProduct: (productId) => onOpenProduct?.(productId),
    openOffer: (offerId) => onOpenOffer?.(offerId),
    openCheckout: (payload) => onOpenCheckout?.(payload),
    openThread: (threadId) => onOpenThread?.(threadId),
    openInvoice: (payload) => onOpenInvoice?.(payload),
    openMarket: () => onOpenMarket?.(),
    custom: () => {},
  });

  const activeActionMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of activeSignal?.actions || []) {
      map.set(a.id, a);
    }
    return map;
  }, [activeSignal]);

  const handleAction = (actionId: string) => {
    if (!activeSignal) return;
    const action = activeActionMap.get(actionId);
    if (!action) return;
    actionRunner(action, activeSignal);
  };

  const handleDismiss = () => {
    if (!activeSignal?.id) return;
    dismissSignal(activeSignal.id);
    setSheetOpen(false);
  };

  if (isMobile) {
    return (
      <PresenceBottomSheet
        open={!!activeSignal && sheetOpen}
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