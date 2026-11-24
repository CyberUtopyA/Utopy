import type {
  DVLike,
  ResonanceCapability,
  ResonanceEntryMethod,
  ResonanceGeo,
  ResonanceIntent,
} from "./resonance.types";

export type PresenceKind =
  | "product"
  | "offer"
  | "order"
  | "totem"
  | "designer"
  | "checkout"
  | "need"
  | "work"
  | "material"
  | "project"
  | "capability"
  | "match"
  | "presence.signal"
  | "custom"
  | (string & {});

export type PresenceActionType =
  | "open_product"
  | "open_offer"
  | "open_checkout"
  | "open_thread"
  | "open_invoice"
  | "open_market"
  | "open_designer"
  | "open_whatsapp"
  | "open_map"
  | "emit_signal"
  | "respond_signal"
  | "request_utopy"
  | "connect_node"
  | "custom";

export type PresenceAction = {
  id: string;
  type: PresenceActionType;
  label: string;
  payload?: Record<string, any>;
  priority?: number;
  requiresConsent?: boolean;
};

export type PresenceSignal = {
  id: string;
  nodeId?: string;
  ns?: string;
  kind: PresenceKind;
  title: string;
  subtitle?: string;
  description?: string;
  labels?: string[];
  strength?: number;
  distanceLabel?: string;
  distanceKm?: number | null;
  image?: string | null;
  actorId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  orderId?: string | null;
  threadId?: string | null;
  sceneId?: string | null;
  invoiceId?: string | null;
  receiptId?: string | null;
  sessionId?: string | null;
  scope?: string | null;
  stage?: string | null;
  sourceDVId?: string | null;
  entryMethod?: ResonanceEntryMethod | string | null;
  geo?: ResonanceGeo | null;
  intent?: ResonanceIntent | null;
  capabilities?: ResonanceCapability[];
  signature?: string | null;
  verified?: boolean;
  expiresAt?: number | null;
  actions: PresenceAction[];
  meta?: Record<string, any>;
  sourceDV?: DVLike | null;
  ts?: string | number;
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
  labels?: string[];
  strength?: number;
  distanceLabel?: string;
  distanceKm?: number | null;
  image?: string | null;
  actorId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  orderId?: string | null;
  threadId?: string | null;
  sceneId?: string | null;
  invoiceId?: string | null;
  receiptId?: string | null;
  sessionId?: string | null;
  scope?: string | null;
  stage?: string | null;
  sourceDVId?: string | null;
  entryMethod?: ResonanceEntryMethod | string | null;
  geo?: ResonanceGeo | null;
  intent?: ResonanceIntent | null;
  capabilities?: ResonanceCapability[];
  signature?: string | null;
  verified?: boolean;
  expiresAt?: number | null;
  actions?: PresenceAction[];
  meta?: Record<string, any>;
  sourceDV?: DVLike | null;
  ts?: string | number;
};
