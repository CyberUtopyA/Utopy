import type { DVLike } from "./mt.liquidity";
import { emitUtopyDV } from "./liquidity.publish";

const now = () => Date.now();
const id = (p: string) => `${p}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
const num = (v: any, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;

export type GovernanceVote = "approve" | "reject" | "abstain";

export function buildGovernanceProposalDV(input: {
  proposalType: "issue" | "credit.line" | "commons.spend" | "escrow.release" | "settlement.batch";
  territoryId?: string;
  actorId: string;
  amount?: number;
  currency?: string;
  reason: string;
  payload?: Record<string, any>;
}) {
  return {
    id: id("liq.governance.proposal"),
    kind: "liq.governance.proposal",
    ts: now(),
    traits: ["mt:liquidity", "mt:governance", "mt:proposal"],
    labels: ["Propuesta de gobernanza"],
    meta: {
      ns: "mt:liquidity",
      scopes: input.territoryId ? ["public", `territory:${input.territoryId}`] : ["public"],
      schema: "utopy.liq.governance.proposal.v1",
      by: input.actorId,
    },
    attrs: {
      proposalType: input.proposalType,
      territoryId: input.territoryId,
      actorId: input.actorId,
      amount: num(input.amount),
      currency: input.currency || "PYG",
      reason: input.reason,
      payload: input.payload || {},
      status: "open",
    },
  } satisfies DVLike;
}

export function buildGovernanceVoteDV(input: {
  proposalId: string;
  voterId: string;
  vote: GovernanceVote;
  weight?: number;
  reason?: string;
  territoryId?: string;
}) {
  return {
    id: id("liq.governance.vote"),
    kind: "liq.governance.vote",
    ts: now(),
    traits: ["mt:liquidity", "mt:governance", "mt:vote"],
    labels: ["Voto de gobernanza"],
    meta: {
      ns: "mt:liquidity",
      scopes: input.territoryId ? ["public", `territory:${input.territoryId}`] : ["public"],
      schema: "utopy.liq.governance.vote.v1",
      by: input.voterId,
    },
    attrs: {
      proposalId: input.proposalId,
      voterId: input.voterId,
      vote: input.vote,
      weight: num(input.weight, 1),
      reason: input.reason || input.vote,
      territoryId: input.territoryId,
    },
  } satisfies DVLike;
}

export function emitGovernanceProposal(input: Parameters<typeof buildGovernanceProposalDV>[0]) {
  const dv = buildGovernanceProposalDV(input);
  emitUtopyDV(dv, "mt");
  return dv;
}

export function emitGovernanceVote(input: Parameters<typeof buildGovernanceVoteDV>[0]) {
  const dv = buildGovernanceVoteDV(input);
  emitUtopyDV(dv, "mt");
  return dv;
}