export type LiveSignalMode =
  | "need"
  | "offer"
  | "sell"
  | "available";

export type ApproximateGeo = {
  lat: number;
  lng: number;
  precision: "approximate";
  radiusM: number;
  source?: string;
};

export type HumanCapability = {
  key: string;
  label: string;
  category: string;
};

export type LiveProfileInput = {
  actorId: string;
  actorName: string;
  nodeId?: string | null;
  bio?: string;
  avatar?: string;
  territoryId?: string | null;
  capabilities: HumanCapability[];
  availableNow?: boolean;
  serviceRadiusKm?: number;
  workRangeKm?: number;
  deliveryRangeKm?: number;
  remote?: boolean;
  pickup?: boolean;
  onSite?: boolean;
  geo?: ApproximateGeo | null;
  scopes?: string[];
};

export type LiveSignalInput = {
  actorId: string;
  actorName: string;
  nodeId?: string | null;
  mode: LiveSignalMode;
  text: string;
  category?: string;
  price?: number | null;
  currency?: string;
  unit?: string;
  image?: string | null;
  threadId?: string | null;
  territoryId?: string | null;
  geo?: ApproximateGeo | null;
  scopes?: string[];
  originalAudioRef?: string | null;
  semanticFrame?: Record<string, unknown> | null;
  privacyPolicies?: string[];
  persistence?: "temporary" | "persistent";
};

export type ContextReason =
  | "Es tuyo"
  | "Responde a tu señal"
  | "Está en el mismo hilo"
  | "Tiene capacidades compatibles"
  | "Coincide con lo que buscás"
  | "Está cerca"
  | "Está disponible"
  | "Es reciente"
  | "Puede entregarte"
  | "Trabaja en tu zona"
  | "Puede ayudarte a distancia"
  | "Trabaja en tu territorio"
  | "Está en tu territorio"
  | "Consultale si llega hasta vos"
  | "Podés explorar esta zona";

export type ContextualDV = {
  dv: any;
  score: number;
  reasons: ContextReason[];
  matchLabel?: string;
};

export type LiveContext = {
  actorId: string;
  profile: any | null;
  focus: any | null;
  focusId: string | null;
  threadId: string | null;
  tokens: string[];
  geo: ApproximateGeo | null;
};
