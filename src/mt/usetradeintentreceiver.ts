import { useEffect } from "react";
import { clearTradeIntent, readTradeIntent, type TradeIntent } from "../utopy/tradebridge";

type ReceiverArgs = {
  products: any[];
  onBuyProduct?: (product: any, intent?: TradeIntent | null) => void;
  onConsultProduct?: (product: any, intent?: TradeIntent | null) => void;
};

export function useTradeIntentReceiver({
  products,
  onBuyProduct,
  onConsultProduct,
}: ReceiverArgs) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const intentFromUrl = params.get("intent");
    const productId = params.get("productId");

    if (from !== "falcon") return;

    const intent = readTradeIntent();

    const resolvedProductId =
      productId ||
      intent?.attrs?.productId ||
      "";

    if (!resolvedProductId) return;

    const product =
      products.find((p) => String(p?.id) === String(resolvedProductId)) ||
      products.find((p) => String(p?.productId) === String(resolvedProductId)) ||
      null;

    if (!product) return;

    if (intentFromUrl === "trade.intent.buy" || intent?.kind === "trade.intent.buy") {
      onBuyProduct?.(product, intent);
      clearTradeIntent();
      return;
    }

    if (
      intentFromUrl === "trade.intent.consult" ||
      intent?.kind === "trade.intent.consult"
    ) {
      onConsultProduct?.(product, intent);
      clearTradeIntent();
    }
  }, [products, onBuyProduct, onConsultProduct]);
}