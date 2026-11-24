export type FrequencyKind = "frequency.start" | "frequency.pulse" | "frequency.update" | "frequency.resolve" | "frequency.expire";
export type AttentionOutcome = "IGNORE" | "SILENT_FEED" | "RESONANCE" | "PUSH";
export type FrequencyMode = "soft" | "normal" | "now" | "silent";

export type FrequencyReference = {
  id: string;
  kind: string;
  revision?: number;
};

export type FrequencyEvent = {
  id: string;
  kind: FrequencyKind;
  attrs: {
    frequencyId: string;
    reference: FrequencyReference;
    sequence: number;
    status: "active" | "paused" | "resolved" | "expired";
    rootId: string;
    threadId?: string;
    chainId?: string;
    parentFrequencyId?: string;
    hopCount: number;
    maxBranches: number;
    visitedNodes: string[];
    expiresAt: string;
    actorId: string;
  };
  traits: string[];
  meta: Record<string, any>;
};
