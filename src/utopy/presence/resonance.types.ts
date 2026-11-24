export type DVLike = {
  id: string;
  kind: string;
  ts?: number;
  traits?: string[];
  meta?: {
    ns?: string;
    scopes?: string[];
    schema?: string;
    by?: string;
    ttl_ms?: number;
    pinned?: boolean;
    [key: string]: any;
  };
  attrs?: Record<string, any>;
  labels?: string[];
};

export type ResonanceIntentMode =
  | "need"
  | "offer"
  | "discover"
  | "collaborate"
  | "produce"
  | "presence";

export type ResonanceEntryMethod =
  | "resonance"
  | "whatsapp"
  | "link"
  | "webrtc"
  | "lan"
  | "bluetooth"
  | "totem"
  | "qr"
  | "nfc"
  | "manual"
  | "offline"
  | "unknown";

export type ResonanceGeo = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  precision?: "exact" | "approximate" | "region";
  source?: "device" | "node" | "manual" | "inferred";
};

export type ResonanceAvailability = {
  from?: number;
  until?: number;
  schedule?: string[];
};

export type ResonanceCapability = {
  id?: string;
  domains: string[];
  verbs?: string[];
  resources?: string[];
  accepts?: string[];
  quantities?: Array<{
    resource: string;
    min?: number;
    max?: number;
    unit?: string;
  }>;
  availability?: ResonanceAvailability;
  serviceRadiusKm?: number;
  constraints?: Record<string, unknown>;
};

export type ResonanceIntent = {
  mode: ResonanceIntentMode;
  domains: string[];
  verbs?: string[];
  resources?: string[];
  quantity?: number;
  unit?: string;
  maxDistanceKm?: number;
  availability?: ResonanceAvailability;
  constraints?: Record<string, unknown>;
};

export type ResonanceFrequency = {
  protocol: "utopy.resonance/1";
  signature: string;
  sessionId: string;
  sequence: number;
  period_ms: number;
  phase: number;
  emittedAt: number;
  expiresAt: number;
};

export type ResonanceSignerResult = {
  alg: string;
  keyId: string;
  value: string;
};

export type ResonanceSigner = (
  canonicalPayload: string
) => Promise<ResonanceSignerResult>;

export type ResonancePublisher = (
  dv: DVLike
) => void | Promise<void>;

export type ResonanceMatchReason = {
  code:
    | "domain"
    | "verb"
    | "resource"
    | "distance"
    | "availability"
    | "trust"
    | "verification";
  score: number;
  label: string;
};

export type ResonanceMatch = {
  intentDV: DVLike;
  capabilityDV: DVLike;
  capability: ResonanceCapability;
  score: number;
  distanceKm: number | null;
  reasons: ResonanceMatchReason[];
  proposalDV: DVLike;
};

export type ResonanceSecurityPolicy = {
  requireConsent: boolean;
  allowAutomaticActions: false;
  geoPrecision: "exact" | "approximate" | "region" | "hidden";
  maxPublicTtlMs: number;
  allowedActionProtocols: readonly string[];
};
