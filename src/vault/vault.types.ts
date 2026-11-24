export type LivingVaultDV = {
  id: string;
  kind: string;
  attrs?: Record<string, any>;
  traits?: string[];
  meta?: Record<string, any>;
  labels?: string[];
  ts?: number | string;
};

export type BenefitProgramInput = {
  programId: string;
  issuerNodeId: string;
  issuerName: string;
  family: string;
  title: string;
  description?: string;
  stampsRequired: number;
  benefitTitle: string;
  benefitDescription?: string;
  simulation?: boolean;
  scopes?: string[];
};

export type BenefitAcceptanceInput = {
  acceptanceId?: string;
  nodeId: string;
  nodeName: string;
  acceptedProgramIds?: string[];
  acceptedIssuerNodeIds?: string[];
  acceptedFamilies?: string[];
  simulation?: boolean;
  scopes?: string[];
};

export type ValueStampInput = {
  program: LivingVaultDV;
  receipt: LivingVaultDV;
  actorId: string;
  actorName?: string;
};

export type ValueRightInput = {
  program: LivingVaultDV;
  actorId: string;
  actorName?: string;
  sourceStamps: LivingVaultDV[];
};

export type ValueRedemptionInput = {
  right: LivingVaultDV;
  acceptance: LivingVaultDV;
  actorId: string;
  actorName?: string;
};

export type ValueRedemptionOutcomeInput = {
  request: LivingVaultDV;
  status: "accepted" | "rejected";
  issuerNodeId: string;
  issuerName?: string;
  reason?: string;
};

export type VaultRightView = {
  dv: LivingVaultDV;
  state: "active" | "requested" | "closed";
  redemptionRequest: LivingVaultDV | null;
  redemption: LivingVaultDV | null;
  acceptedBy: LivingVaultDV[];
};

export type VaultProgramProgress = {
  program: LivingVaultDV;
  totalStamps: number;
  availableStamps: LivingVaultDV[];
  consumedStamps: number;
  required: number;
  ready: boolean;
};

export type LivingVaultView = {
  actorId: string;
  receipts: LivingVaultDV[];
  trustEvents: LivingVaultDV[];
  trustScore: number;
  stamps: LivingVaultDV[];
  programs: LivingVaultDV[];
  progress: VaultProgramProgress[];
  rights: VaultRightView[];
  activeRights: VaultRightView[];
  closedRights: VaultRightView[];
  locks: LivingVaultDV[];
  history: LivingVaultDV[];
};
