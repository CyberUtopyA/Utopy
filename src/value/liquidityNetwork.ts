import { collectRelationshipSnapshots } from "../utopy/relationshipProtocol";
import { projectIdentityLinks } from "../utopy/identityLink";
import { projectLivingVault } from "../vault/vault.engine";

function text(...values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function valuesOf(dv: any) {
  const attrs = dv?.attrs || {};
  return [
    attrs.actorId,
    attrs.issuerActorId,
    attrs.buyerId,
    attrs.sellerId,
    attrs.borrowerActorId,
    attrs.holderActorId,
    attrs.ownerActorId,
    attrs.requesterId,
    attrs.customerActorId,
    attrs.actor?.id,
    attrs.buyer?.id,
    attrs.seller?.id,
    attrs.fromActorId,
    attrs.toActorId,
    ...(Array.isArray(attrs.participants) ? attrs.participants : []),
  ].map(text).filter(Boolean);
}

function belongsTo(dv: any, actorId: string) {
  return valuesOf(dv).includes(actorId);
}

function timestamp(dv: any) {
  const raw = dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.occurredAt;
  const parsed = typeof raw === "number" ? raw : Date.parse(text(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

function signed(dv: any) {
  return Boolean(dv?.meta?.ownership?.signature?.value);
}

function obligationOutcome(obligation: any, allLive: any[]) {
  const sourceIds = new Set([
    text(obligation?.obligationId),
    text(obligation?.sourceId),
  ].filter(Boolean));
  const outcomes = allLive
    .filter((dv) => {
      if (!signed(dv)) return false;
      const refs = [
        dv?.meta?.respondsTo,
        dv?.attrs?.obligationId,
        dv?.attrs?.sourceId,
        dv?.attrs?.orderId,
      ].map(text);
      return refs.some((ref) => sourceIds.has(ref)) &&
        ["payment.outcome", "pay.receipt", "liq.transfer", "work.outcome.verified"].includes(text(dv?.kind));
    })
    .sort((a, b) => timestamp(b) - timestamp(a));
  const latest = outcomes[0] || null;
  return {
    ...obligation,
    state: latest ? text(latest?.attrs?.state, latest?.attrs?.status, "confirmed") : "planned",
    outcome: latest,
  };
}

export function projectSettlementPlan(batch: any, allLive: any[]) {
  const obligations = (Array.isArray(batch?.attrs?.obligations)
    ? batch.attrs.obligations
    : []).map((obligation: any) => obligationOutcome(obligation, allLive));
  const confirmed = obligations.filter((item: any) => item.outcome).length;
  return {
    dv: batch,
    batchId: text(batch?.attrs?.batchId, batch?.id),
    state: obligations.length && confirmed === obligations.length
      ? "confirmed"
      : confirmed
        ? "partially_confirmed"
        : "planned",
    custody: "none",
    obligations,
    confirmed,
  };
}

export function projectLiquidityNetwork(
  allLive: any[],
  actorId: string,
  verifiedVaultIds?: Set<string>,
) {
  const live = Array.isArray(allLive) ? allLive : [];
  const actorLive = live.filter((dv) => belongsTo(dv, actorId));
  const relationships = collectRelationshipSnapshots(live).filter((relationship) =>
    relationship.parties.some((party) => party.actorId === actorId),
  );
  const identityLinks = projectIdentityLinks(live, actorId, verifiedVaultIds);
  const vault = projectLivingVault(live, actorId, verifiedVaultIds);
  const verifiedContributions = actorLive
    .filter((dv) =>
      ["value.contribution.verified", "work.outcome.verified"].includes(text(dv?.kind)) && signed(dv),
    )
    .sort((a, b) => timestamp(b) - timestamp(a));
  const generatedOutcomes = actorLive
    .filter((dv) =>
      [
        "pay.receipt",
        "payment.outcome",
        "work.outcome.verified",
        "value.contribution.verified",
        "market.order.accept",
      ].includes(text(dv?.kind)) &&
      (signed(dv) || (dv?.kind === "pay.receipt" && (dv?.attrs?.confirmationIds || []).length >= 2)),
    )
    .sort((a, b) => timestamp(b) - timestamp(a));
  const creditOffers = live
    .filter((dv) => dv?.kind === "credit.offer" && signed(dv))
    .sort((a, b) => timestamp(b) - timestamp(a));
  const creditOperations = actorLive
    .filter((dv) => ["credit.request", "credit.decision", "credit.account"].includes(text(dv?.kind)))
    .sort((a, b) => timestamp(b) - timestamp(a));
  const routes = live
    .filter((dv) => dv?.kind === "liq.route.offer" && signed(dv))
    .sort((a, b) => timestamp(b) - timestamp(a));
  const settlementPlans = actorLive
    .filter((dv) => dv?.kind === "liq.settlement.batch")
    .map((dv) => projectSettlementPlan(dv, live));
  const activeOperations = actorLive
    .filter((dv) =>
      [
        "market.order.create",
        "work.intent",
        "work.agreement",
        "delivery.request",
        "delivery.assignment",
        "pay.session",
        "credit.request",
        "value.redemption.request",
      ].includes(text(dv?.kind)) &&
      !["closed", "completed", "cancelled", "rejected", "settled"].includes(
        text(dv?.attrs?.state, dv?.attrs?.status).toLowerCase(),
      ),
    )
    .sort((a, b) => timestamp(b) - timestamp(a));
  const protections = actorLive
    .filter((dv) => /^(liq\.(lock|escrow)|refund\.right)/.test(text(dv?.kind)))
    .sort((a, b) => timestamp(b) - timestamp(a));
  const needs = actorLive.filter((dv) =>
    ["value.need", "work.intent", "credit.request"].includes(text(dv?.kind)),
  );
  const gaps = needs
    .filter((need) => {
      const kind = text(need?.kind);
      if (kind === "credit.request") {
        return !creditOperations.some((candidate) =>
          candidate?.kind === "credit.decision" &&
          text(candidate?.attrs?.requestId, candidate?.meta?.respondsTo) === text(need?.id),
        );
      }
      const needId = text(need?.id);
      return !live.some((candidate) =>
        [candidate?.attrs?.needId, candidate?.attrs?.intentId, candidate?.meta?.respondsTo]
          .map(text)
          .includes(needId) &&
        ["value.contribution", "capability.offer", "work.agreement"].includes(text(candidate?.kind)),
      );
    })
    .map((dv) => ({
      id: text(dv?.id),
      kind: text(dv?.kind),
      title: text(dv?.attrs?.title, dv?.attrs?.purpose, dv?.attrs?.description, "Necesidad abierta"),
      dv,
    }));

  return {
    actorId,
    vault,
    generatedOutcomes,
    verifiedContributions,
    rights: vault.rights,
    activeRights: vault.activeRights,
    relationships,
    identityLinks,
    creditOffers,
    creditOperations,
    routes,
    settlementPlans,
    activeOperations,
    protections,
    gaps,
    summary: {
      outcomes: generatedOutcomes.length,
      rights: vault.activeRights.length,
      connections: relationships.length + identityLinks.filter((link) => link.status === "active").length,
      operations: activeOperations.length,
      contributions: verifiedContributions.length,
    },
  };
}
