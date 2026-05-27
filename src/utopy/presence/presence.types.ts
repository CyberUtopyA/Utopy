export type PresenceKind =
  | "product"
  | "offer"
  | "order"
  | "totem"
  | "designer"
  | "checkout"
  | "presence.signal"
  | "custom";

export type PresenceActionType =
  | "open_product"
  | "open_offer"
  | "open_checkout"
  | "open_thread"
  | "open_invoice"
  | "open_market"
  | "open_designer"
  | "custom";

export type PresenceAction = {
  id: string;
  type: PresenceActionType;
  label: string;
  payload?: Record<string, any>;
  priority?: number;
};

export type PresenceSignal = {
  id: string;
  nodeId?: string;
  ns?: string;
  kind: PresenceKind;
  title: string;
  subtitle?: string;
  description?: string;
  strength?: number;
  distanceLabel?: string;
  image?: string | null;
  actorId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  orderId?: string | null;
  threadId?: string | null;
  sceneId?: string | null;
  invoiceId?: string | null;
  receiptId?: string | null;
  actions: PresenceAction[];
  meta?: Record<string, any>;
  ts?: string;
};

export type PresenceState = {
  signals: PresenceSignal[];
  activeSignal: PresenceSignal | null;
  dismissedIds: string[];
};

export type PresenceScanInput = {
  id?: string;
  nodeId?: string;
  ns?: string;
  kind?: PresenceKind;
  title?: string;
  subtitle?: string;
  description?: string;
  strength?: number;
  distanceLabel?: string;
  image?: string | null;
  actorId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  orderId?: string | null;
  threadId?: string | null;
  sceneId?: string | null;
  invoiceId?: string | null;
  receiptId?: string | null;
  actions?: PresenceAction[];
  meta?: Record<string, any>;
};