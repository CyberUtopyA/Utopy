export type UtopyPayRouteKind =
  | "bank_transfer"
  | "interoperable_qr"
  | "local_balance"
  | "refund_credit"
  | "commercial_credit"
  | "cash"
  | "external";

export type UtopyPayState =
  | "open"
  | "route_reserved"
  | "buyer_confirmed"
  | "merchant_confirmed"
  | "authorized"
  | "settled"
  | "expired"
  | "cancelled"
  | "refund_requested"
  | "refunded";

export type UtopyPayParty = {
  id: string;
  name?: string | null;
  nodeId?: string | null;
};

export type UtopyPayRoute = {
  id: string;
  kind: UtopyPayRouteKind;
  label: string;
  description: string;
  currency: string;
  amount: number;
  fee: number;
  etaSeconds: number | null;
  requiresExternalSettlement: boolean;
  requiresMerchantConfirmation: boolean;
  sourceDvId?: string | null;
  publicDetails?: Record<string, string | number | boolean | null>;
  priority: number;
};

export type UtopyPaySessionInput = {
  sessionId?: string;
  orderId: string;
  threadId: string;
  buyer: UtopyPayParty;
  seller: UtopyPayParty;
  operator?: UtopyPayParty | null;
  amount: number;
  currency: string;
  concept: string;
  productId?: string | null;
  accepted?: unknown[];
  expiresInMs?: number;
  ns?: string;
  scopes?: string[];
  source?: string;
};

export type UtopyPaySessionDV = {
  id: string;
  kind: "pay.session";
  attrs: {
    protocol: "utopy.pay.libre.v1";
    sessionId: string;
    orderId: string;
    threadId: string;
    buyer: UtopyPayParty;
    seller: UtopyPayParty;
    operator: UtopyPayParty | null;
    amount: number;
    currency: string;
    concept: string;
    productId: string | null;
    nonce: string;
    digest: string;
    state: UtopyPayState;
    selectedRouteId: string | null;
    routes: UtopyPayRoute[];
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    qrPayload: string;
    linkPayload: string;
    safeguards: {
      amountLocked: true;
      replayProtection: true;
      dualConfirmation: true;
      custody: "external_or_declared_route";
      refundRight: true;
    };
  };
  traits: string[];
  meta: Record<string, unknown>;
};

export type UtopyPayView = {
  session: UtopyPaySessionDV | null;
  state: UtopyPayState | "missing";
  route: UtopyPayRoute | null;
  buyerConfirmed: boolean;
  merchantConfirmed: boolean;
  authorized: boolean;
  settled: boolean;
  expired: boolean;
  receipt: any | null;
  refund: any | null;
};
