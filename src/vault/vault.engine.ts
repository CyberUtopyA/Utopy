import type {
  LivingVaultDV,
  LivingVaultView,
  VaultProgramProgress,
  VaultRightView,
} from "./vault.types";

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function timeOf(dv: LivingVaultDV) {
  const raw =
    dv?.meta?.updatedAt ||
    dv?.meta?.ts ||
    dv?.attrs?.closedAt ||
    dv?.attrs?.issuedAt ||
    dv?.attrs?.settledAt ||
    dv?.ts ||
    "";
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

function belongsToVaultActor(dv: LivingVaultDV, actorId: string) {
  const attrs = dv?.attrs || {};
  return [
    attrs.actorId,
    attrs.buyerId,
    attrs.trustForId,
    attrs?.actor?.id,
  ]
    .filter(Boolean)
    .some((value) => String(value) === String(actorId));
}

function hasOwnershipProof(dv: LivingVaultDV) {
  return Boolean(dv?.meta?.ownership?.signature?.value);
}

function trustedDV(dv: LivingVaultDV, verifiedIds?: Set<string>) {
  if (!hasOwnershipProof(dv)) return false;
  return verifiedIds ? verifiedIds.has(String(dv?.id || "")) : true;
}

function issuerConfirmedRedemption(
  outcome: LivingVaultDV,
  right: LivingVaultDV,
) {
  if (!hasOwnershipProof(outcome)) return false;
  const status = String(outcome?.attrs?.outcome || outcome?.attrs?.state || "");
  if (!["accepted", "closed", "completed"].includes(status)) return false;
  const authority = String(outcome?.meta?.authority || "");
  return [right?.attrs?.issuerNodeId, outcome?.attrs?.acceptingNodeId]
    .map(String)
    .filter(Boolean)
    .includes(authority);
}

export function acceptanceMatchesRight(
  acceptanceDV: LivingVaultDV,
  rightDV: LivingVaultDV,
) {
  if (
    acceptanceDV?.kind !== "benefit.acceptance" ||
    acceptanceDV?.attrs?.state !== "active" ||
    rightDV?.kind !== "value.right"
  ) {
    return false;
  }
  const acceptance = acceptanceDV.attrs || {};
  const right = rightDV.attrs || {};
  return (
    list(acceptance.acceptedProgramIds).includes(String(right.programId)) ||
    list(acceptance.acceptedIssuerNodeIds).includes(
      String(right.issuerNodeId),
    ) ||
    list(acceptance.acceptedFamilies).includes(String(right.family))
  );
}

export function compatibleAcceptances(
  allLive: LivingVaultDV[],
  rightDV: LivingVaultDV,
  verifiedIds?: Set<string>,
) {
  return (Array.isArray(allLive) ? allLive : []).filter((dv) =>
    acceptanceMatchesRight(dv, rightDV) && trustedDV(dv, verifiedIds),
  );
}

export function projectLivingVault(
  allLive: LivingVaultDV[],
  actorId: string,
  verifiedIds?: Set<string>,
): LivingVaultView {
  const all = Array.isArray(allLive) ? allLive : [];
  const programs = all.filter(
    (dv) =>
      dv?.kind === "benefit.program" &&
      dv?.attrs?.state === "active" &&
      trustedDV(dv, verifiedIds),
  );
  const stamps = all.filter(
    (dv) =>
      dv?.kind === "value.stamp" &&
      String(dv?.attrs?.actorId || "") === String(actorId) &&
      trustedDV(dv, verifiedIds),
  );
  const rightDVs = all.filter(
    (dv) =>
      dv?.kind === "value.right" &&
      String(dv?.attrs?.actorId || "") === String(actorId) &&
      trustedDV(dv, verifiedIds),
  );
  const redemptionRequests = all.filter(
    (dv) =>
      dv?.kind === "value.redemption.request" &&
      String(dv?.attrs?.actorId || "") === String(actorId) &&
      trustedDV(dv, verifiedIds),
  );
  const redemptionOutcomes = all.filter(
    (dv) =>
      dv?.kind === "value.redemption.outcome" &&
      String(dv?.attrs?.actorId || "") === String(actorId) &&
      trustedDV(dv, verifiedIds),
  );
  const legacyRedemptions = all.filter(
    (dv) =>
      dv?.kind === "value.redemption" &&
      String(dv?.attrs?.actorId || "") === String(actorId) &&
      trustedDV(dv, verifiedIds),
  );
  const consumedStampIds = new Set(
    rightDVs.flatMap((right) => list(right?.attrs?.sourceStampIds)),
  );

  const progress: VaultProgramProgress[] = programs
    .map((program) => {
      const programId = String(program?.attrs?.programId || "");
      const programStamps = stamps.filter(
        (stamp) => String(stamp?.attrs?.programId || "") === programId,
      );
      const availableStamps = programStamps.filter(
        (stamp) => !consumedStampIds.has(String(stamp.id)),
      );
      const required = Math.max(
        1,
        Number(program?.attrs?.stampsRequired || 1),
      );
      return {
        program,
        totalStamps: programStamps.length,
        availableStamps,
        consumedStamps: programStamps.length - availableStamps.length,
        required,
        ready: availableStamps.length >= required,
      };
    })
    .filter(
      (item) =>
        item.totalStamps > 0 ||
        String(item.program?.attrs?.issuerNodeId || "") === String(actorId) ||
        item.program?.attrs?.simulation === true,
    );

  const rights: VaultRightView[] = rightDVs.map((right) => {
    const redemptionRequest =
      redemptionRequests.find(
        (item) => String(item?.attrs?.rightId || "") === String(right.id),
      ) || null;
    const modernOutcome = redemptionOutcomes.find(
      (item) =>
        String(item?.attrs?.rightId || "") === String(right.id) &&
        issuerConfirmedRedemption(item, right),
    );
    const signedLegacy = legacyRedemptions.find(
      (item) =>
        String(item?.attrs?.rightId || "") === String(right.id) &&
        issuerConfirmedRedemption(item, right),
    );
    const redemption = modernOutcome || signedLegacy || null;
    return {
      dv: right,
      state: redemption ? "closed" : redemptionRequest ? "requested" : "active",
      redemptionRequest,
      redemption,
      acceptedBy: compatibleAcceptances(all, right, verifiedIds),
    };
  });

  const receipts = all.filter(
    (dv) =>
      dv?.kind === "pay.receipt" &&
      String(dv?.attrs?.buyerId || "") === String(actorId),
  );
  const trustEvents = all.filter(
    (dv) =>
      (dv?.kind === "liq.trust" || dv?.kind === "liq.trust.signal") &&
      String(dv?.attrs?.trustForId || "") === String(actorId),
  );
  const trustScore = trustEvents.reduce(
    (sum, dv) => sum + Math.max(0, Number(dv?.attrs?.scoreDelta || 0)),
    0,
  );
  const locks = all.filter(
    (dv) =>
      ["liq.lock", "liq.escrow.open"].includes(String(dv?.kind || "")) &&
      belongsToVaultActor(dv, actorId),
  );
  const historyKinds = new Set([
    "pay.receipt",
    "liq.trust",
    "liq.trust.signal",
    "value.stamp",
    "value.right",
    "value.redemption",
    "value.redemption.request",
    "value.redemption.outcome",
    "refund.right",
    "liq.lock",
    "liq.unlock",
    "liq.escrow.open",
    "liq.escrow.release",
    "liq.escrow.refund",
  ]);
  const history = all
    .filter(
      (dv) =>
        historyKinds.has(String(dv?.kind || "")) &&
        belongsToVaultActor(dv, actorId),
    )
    .sort((a, b) => timeOf(b) - timeOf(a));

  return {
    actorId,
    receipts,
    trustEvents,
    trustScore,
    stamps,
    programs,
    progress,
    rights,
    activeRights: rights.filter((item) => item.state !== "closed"),
    closedRights: rights.filter((item) => item.state === "closed"),
    locks,
    history,
  };
}

export function nextRightSource(
  allLive: LivingVaultDV[],
  actorId: string,
  programId: string,
) {
  const projection = projectLivingVault(allLive, actorId);
  const item = projection.progress.find(
    (progress) =>
      String(progress?.program?.attrs?.programId || "") === String(programId),
  );
  if (!item || !item.ready) return null;
  return {
    program: item.program,
    stamps: item.availableStamps.slice(0, item.required),
  };
}

export function canRedeemRight(
  allLive: LivingVaultDV[],
  right: LivingVaultDV,
  acceptance: LivingVaultDV,
  actorId: string,
  verifiedIds?: Set<string>,
) {
  if (
    right?.kind !== "value.right" ||
    String(right?.attrs?.actorId || "") !== String(actorId) ||
    right?.attrs?.nonTradable !== true
  ) {
    return false;
  }
  if (!trustedDV(right, verifiedIds) || !trustedDV(acceptance, verifiedIds)) return false;
  const view = projectLivingVault(allLive, actorId, verifiedIds).rights.find(
    (item) => String(item.dv.id) === String(right.id),
  );
  return view?.state === "active" && acceptanceMatchesRight(acceptance, right);
}
