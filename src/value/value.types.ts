export type ValueCapabilityKind =
  | "material"
  | "work"
  | "equipment"
  | "logistics"
  | "knowledge"
  | "customer_commitment"
  | "space"
  | "data"
  | "other";

export type ValueContributionMode =
  | "provide_material"
  | "do_work"
  | "lend_equipment"
  | "deliver"
  | "share_knowledge"
  | "preorder"
  | "other";

export type ValueRequirement = {
  key: string;
  label: string;
  kind: ValueCapabilityKind;
  amount: number;
  unit: string;
  description?: string | null;
};

export type ValueReward = {
  kind:
    | "recognition"
    | "future_product"
    | "discount"
    | "agreed_payment"
    | "commercial_credit"
    | "other";
  label: string;
  amount?: number | null;
  currency?: string | null;
};

export type ValueNeedInput = {
  needKey: string;
  nodeId: string;
  nodeName: string;
  actorId?: string | null;
  actorName?: string | null;
  title: string;
  purpose: string;
  requirements: ValueRequirement[];
  threadId?: string | null;
  territoryId?: string | null;
  location?: { lat: number; lng: number } | null;
  scopes?: string[];
  simulation?: boolean;
};

export type ValueContributionInput = {
  need: any;
  actorId: string;
  actorName?: string | null;
  capabilityKey: string;
  capabilityKind: ValueCapabilityKind;
  mode: ValueContributionMode;
  amount: number;
  unit: string;
  note?: string | null;
  reward: ValueReward;
};

export type RequirementCoverage = ValueRequirement & {
  /** Compatibilidad: equivale a lo comprometido, no a lo ya recibido. */
  coveredAmount: number;
  missingAmount: number;
  coverage: number;
  committedAmount: number;
  verifiedAmount: number;
  remainingToCommit: number;
  remainingToVerify: number;
  committedCoverage: number;
  verifiedCoverage: number;
  contributionIds: string[];
  committedContributionIds: string[];
  verifiedContributionIds: string[];
};

export type ValueComposition = {
  needId: string;
  /** Compatibilidad: cobertura comprometida. */
  coverage: number;
  committedCoverage: number;
  verifiedCoverage: number;
  readyForAgreement: boolean;
  fulfilled: boolean;
  status: "open" | "partially_covered" | "covered" | "fulfilled";
  requirements: RequirementCoverage[];
  contributionIds: string[];
  verifiedContributionIds: string[];
};
