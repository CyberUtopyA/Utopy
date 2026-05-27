// ============================================
// FILE: src/work/work.schema.ts
// Schema universal para células productivas UTOPY
// ============================================

export type WorkDomain =
  | "furniture"
  | "construction"
  | "electrical"
  | "plc"
  | "energy"
  | "waste"
  | "urban_mining"
  | "textile"
  | "food"
  | "metal"
  | "water"
  | "agro"
  | "general";

export type WorkCellKind =
  | "person"
  | "team"
  | "workshop"
  | "machine"
  | "microfactory"
  | "node";

export type WorkIntentStatus =
  | "open"
  | "matched"
  | "planned"
  | "in_progress"
  | "done"
  | "cancelled";

export type WorkPlanStatus =
  | "draft"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled";

export type WorkCapability = {
  id: string;
  label: string;
  domain: WorkDomain;
  level?: number; // 1..5
  tags?: string[];
};

export type WorkInput = {
  id: string;
  label: string;
  qty?: number;
  unit?: string;
};

export type WorkOutput = {
  id: string;
  label: string;
  qty?: number;
  unit?: string;
};

export type WorkCell = {
  id: string;
  nodeId: string;
  name: string;
  kind: WorkCellKind;
  roleLabel: string;
  domains: WorkDomain[];
  capabilities: WorkCapability[];
  inputs?: WorkInput[];
  outputs?: WorkOutput[];
  tools?: string[];
  capacity?: {
    daily?: number;
    weekly?: number;
    unit?: string;
  };
  serviceArea?: {
    mode: "local" | "remote" | "hybrid";
    territory?: string;
  };
  availability?: {
    status: "available" | "busy" | "offline";
    note?: string;
  };
  contact?: {
    sellerId?: string;
    sellerName?: string;
    via?: string[];
  };
  reputation?: {
    score?: number;
    samples?: number;
  };
  meta?: {
    workspace?: string;
    source?: string;
  };
};

export type WorkIntent = {
  id: string;
  title: string;
  description?: string;
  domain: WorkDomain;
  requestedCapabilities: string[];
  inputs?: WorkInput[];
  expectedOutputs?: WorkOutput[];
  constraints?: {
    budget?: number;
    currency?: string;
    deadline?: string;
    dimensions?: Record<string, number>;
    materials?: string[];
    location?: string;
  };
  status: WorkIntentStatus;
  by?: {
    actorId?: string;
    actorName?: string;
  };
  target?: {
    nodeId?: string;
    workCellId?: string;
  };
  context?: {
    sceneId?: string;
    worldId?: string;
    territoryId?: string;
    diagramId?: string;
  };
};

export type WorkPlanStep = {
  id: string;
  title: string;
  kind:
    | "design"
    | "measure"
    | "fabricate"
    | "install"
    | "wire"
    | "program"
    | "test"
    | "deliver"
    | "custom";
  description?: string;
  requires?: string[];
  outputs?: string[];
};

export type WorkPlan = {
  id: string;
  intentId?: string;
  title: string;
  domain: WorkDomain;
  status: WorkPlanStatus;
  owner?: {
    nodeId?: string;
    workCellId?: string;
    actorName?: string;
  };
  steps: WorkPlanStep[];
  materials?: WorkInput[];
  outputs?: WorkOutput[];
  estimate?: {
    amount?: number;
    currency?: string;
    durationHours?: number;
  };
  links?: {
    sceneId?: string;
    dvId?: string;
    quoteId?: string;
  };
};