import type {
  RequirementCoverage,
  ValueComposition,
  ValueRequirement,
} from "./value.types";

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function isOpenValueNeed(dv: any) {
  return (
    dv?.kind === "value.need" &&
    !["closed", "cancelled", "completed"].includes(
      String(dv?.attrs?.status || "open"),
    )
  );
}

export function contributionsForNeed(needId: string, all: any[]) {
  return (Array.isArray(all) ? all : []).filter(
    (dv) =>
      dv?.kind === "value.contribution" &&
      String(dv?.attrs?.needId || "") === String(needId),
  );
}

export function computeValueComposition(
  need: any,
  all: any[],
): ValueComposition {
  const requirements = (
    Array.isArray(need?.attrs?.requirements)
      ? need.attrs.requirements
      : []
  ) as ValueRequirement[];
  const needId = String(need?.id || "");
  const contributions = contributionsForNeed(needId, all);
  const agreements = (Array.isArray(all) ? all : []).filter(
    (dv) =>
      dv?.kind === "value.agreement" &&
      String(dv?.attrs?.needId || "") === needId &&
      ["accepted", "active"].includes(String(dv?.attrs?.status || "accepted")),
  );
  const committedIds = new Set(
    agreements.map((agreement) => String(agreement?.attrs?.contributionId || "")).filter(Boolean),
  );
  // Una entrega declarada es un resultado, pero no prueba por sí sola que el
  // receptor la haya verificado. Solo el evento de verificación suma como recibido.
  const verifiedEvents = (Array.isArray(all) ? all : []).filter(
    (dv) =>
      dv?.kind === "value.contribution.verified" &&
      String(dv?.attrs?.needId || "") === needId &&
      String(dv?.attrs?.status || "verified") === "verified",
  );
  const verifiedIds = new Set(
    verifiedEvents
      .map((event) => String(event?.attrs?.contributionId || ""))
      .filter(Boolean),
  );

  const coverageRows: RequirementCoverage[] = requirements.map((requirement) => {
    const matching = contributions.filter(
      (dv) =>
        String(dv?.attrs?.capabilityKey || "") ===
        String(requirement.key || ""),
    );
    const committed = matching.filter((dv) => committedIds.has(String(dv?.id || "")));
    const verified = matching.filter((dv) => verifiedIds.has(String(dv?.id || "")));
    const target = number(requirement.amount);
    const committedAmount = committed.reduce(
      (sum, dv) => sum + number(dv?.attrs?.amount),
      0,
    );
    const verifiedAmount = verified.reduce((sum, contribution) => {
      const event = verifiedEvents.find(
        (candidate) =>
          String(candidate?.attrs?.contributionId || "") === String(contribution?.id || ""),
      );
      return sum + number(event?.attrs?.verifiedAmount ?? contribution?.attrs?.amount);
    }, 0);
    const committedCoverage =
      target <= 0 ? 100 : Math.min(100, (committedAmount / target) * 100);
    const verifiedCoverage =
      target <= 0 ? 100 : Math.min(100, (verifiedAmount / target) * 100);

    return {
      ...requirement,
      coveredAmount: committedAmount,
      missingAmount: Math.max(0, target - committedAmount),
      coverage: committedCoverage,
      committedAmount,
      verifiedAmount,
      remainingToCommit: Math.max(0, target - committedAmount),
      remainingToVerify: Math.max(0, target - verifiedAmount),
      committedCoverage,
      verifiedCoverage,
      contributionIds: matching.map((dv) => String(dv.id)),
      committedContributionIds: committed.map((dv) => String(dv.id)),
      verifiedContributionIds: verified.map((dv) => String(dv.id)),
    };
  });

  const committedCoverage = coverageRows.length
    ? coverageRows.reduce((sum, row) => sum + row.committedCoverage, 0) /
      coverageRows.length
    : 0;
  const verifiedCoverage = coverageRows.length
    ? coverageRows.reduce((sum, row) => sum + row.verifiedCoverage, 0) /
      coverageRows.length
    : 0;
  const readyForAgreement =
    coverageRows.length > 0 && coverageRows.every((row) => row.committedCoverage >= 100);
  const fulfilled =
    coverageRows.length > 0 && coverageRows.every((row) => row.verifiedCoverage >= 100);
  const status = fulfilled
    ? "fulfilled"
    : readyForAgreement
      ? "covered"
      : committedCoverage > 0
        ? "partially_covered"
        : "open";

  return {
    needId,
    coverage: committedCoverage,
    committedCoverage,
    verifiedCoverage,
    readyForAgreement,
    fulfilled,
    status,
    requirements: coverageRows,
    contributionIds: Array.from(committedIds),
    verifiedContributionIds: Array.from(verifiedIds),
  };
}

export function latestValueComposition(needId: string, all: any[]) {
  return (
    [...(Array.isArray(all) ? all : [])]
      .filter(
        (dv) =>
          dv?.kind === "value.composition" &&
          String(dv?.attrs?.needId || "") === String(needId),
      )
      .sort(
        (a, b) =>
          Date.parse(String(b?.meta?.updatedAt || b?.meta?.ts || "")) -
          Date.parse(String(a?.meta?.updatedAt || a?.meta?.ts || "")),
      )[0] || null
  );
}
