import type {
  BenefitAcceptanceInput,
  BenefitProgramInput,
  LivingVaultDV,
  ValueRedemptionInput,
  ValueRedemptionOutcomeInput,
  ValueRightInput,
  ValueStampInput,
} from "./vault.types";

const nowIso = () => new Date().toISOString();

export function vaultIdPart(value: unknown, fallback = "value") {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function stableDigest(parts: unknown[]) {
  const source = parts.map((item) => String(item ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function privateScopes(actorId: string) {
  return ["private:actor", `actor:${actorId}`];
}

export function buildBenefitProgramDV(
  input: BenefitProgramInput,
): LivingVaultDV {
  const ts = nowIso();
  const programId = vaultIdPart(input.programId, "program");
  const issuerNodeId = String(input.issuerNodeId || "").trim();
  if (!issuerNodeId) throw new Error("El programa necesita un nodo emisor.");

  return {
    id: `benefit.program:${programId}`,
    kind: "benefit.program",
    attrs: {
      programId,
      issuerNodeId,
      issuerName: input.issuerName || issuerNodeId,
      family: vaultIdPart(input.family, "benefit"),
      title: input.title,
      description: input.description || "",
      stampsRequired: Math.max(1, Math.floor(Number(input.stampsRequired || 1))),
      eligibleReceiptKinds: ["pay.receipt"],
      benefit: {
        title: input.benefitTitle,
        description: input.benefitDescription || "",
      },
      state: "active",
      confirmationRequired: true,
      simulation: input.simulation === true,
      nonTradable: true,
      createdAt: ts,
      updatedAt: ts,
    },
    traits: [
      "utopy:vault",
      "benefit:program",
      "benefit:consent",
      "value:non-tradable",
    ],
    labels: [input.title, input.issuerName],
    meta: {
      ns: "mt:market",
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ts,
      updatedAt: ts,
      version: 1,
      source: "utopy.vault.program",
      authority: issuerNodeId,
      originNode: issuerNodeId,
    },
  };
}

export function buildBenefitAcceptanceDV(
  input: BenefitAcceptanceInput,
): LivingVaultDV {
  const ts = nowIso();
  const nodeId = String(input.nodeId || "").trim();
  if (!nodeId) throw new Error("La aceptación necesita identidad de nodo.");
  const acceptedProgramIds = (input.acceptedProgramIds || [])
    .map((item) => vaultIdPart(item))
    .filter(Boolean);
  const acceptedIssuerNodeIds = (input.acceptedIssuerNodeIds || [])
    .map(String)
    .filter(Boolean);
  const acceptedFamilies = (input.acceptedFamilies || [])
    .map((item) => vaultIdPart(item))
    .filter(Boolean);
  if (
    !acceptedProgramIds.length &&
    !acceptedIssuerNodeIds.length &&
    !acceptedFamilies.length
  ) {
    throw new Error("El nodo debe declarar qué beneficio acepta.");
  }
  const ruleKey =
    input.acceptanceId ||
    stableDigest([
      ...acceptedProgramIds,
      ...acceptedIssuerNodeIds,
      ...acceptedFamilies,
    ]);

  return {
    id: `benefit.acceptance:${vaultIdPart(nodeId)}:${vaultIdPart(ruleKey)}`,
    kind: "benefit.acceptance",
    attrs: {
      acceptanceId: input.acceptanceId || ruleKey,
      nodeId,
      nodeName: input.nodeName || nodeId,
      acceptedProgramIds,
      acceptedIssuerNodeIds,
      acceptedFamilies,
      state: "active",
      confirmationRequired: true,
      simulation: input.simulation === true,
      nonTradable: true,
      createdAt: ts,
      updatedAt: ts,
    },
    traits: [
      "utopy:vault",
      "benefit:acceptance",
      "benefit:explicit",
      "escudo:consent",
    ],
    labels: ["Acepta beneficios", input.nodeName],
    meta: {
      ns: "mt:market",
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ts,
      updatedAt: ts,
      version: 1,
      source: "utopy.vault.acceptance",
      authority: nodeId,
      originNode: nodeId,
    },
  };
}

export function buildValueStampDV(input: ValueStampInput): LivingVaultDV {
  const ts = nowIso();
  const program = input.program?.attrs || {};
  const receipt = input.receipt?.attrs || {};
  const programId = String(program.programId || "");
  const receiptId = String(input.receipt?.id || receipt.receiptId || "");
  if (!programId || !receiptId) {
    throw new Error("El sello necesita programa y comprobante.");
  }
  if (
    String(input.receipt?.kind) !== "pay.receipt" ||
    !["authorized", "settled"].includes(String(receipt.state || ""))
  ) {
    throw new Error("Solo un comprobante confirmado puede emitir un sello.");
  }
  if (String(receipt.buyerId || "") !== String(input.actorId)) {
    throw new Error("El comprobante no pertenece a este Perfil Vivo.");
  }
  if (
    String(receipt.sellerId || "") !== String(program.issuerNodeId || "")
  ) {
    throw new Error("El comprobante no corresponde al nodo emisor.");
  }

  return {
    id: `value.stamp:${vaultIdPart(programId)}:${stableDigest([receiptId])}`,
    kind: "value.stamp",
    attrs: {
      stampId: `stamp:${programId}:${stableDigest([receiptId])}`,
      programId,
      family: program.family,
      actorId: input.actorId,
      actorName: input.actorName || input.actorId,
      issuerNodeId: program.issuerNodeId,
      issuerName: program.issuerName,
      receiptId,
      orderId: receipt.orderId || null,
      state: "verified",
      simulation:
        program.simulation === true || receipt.simulation === true,
      nonTradable: true,
      issuedAt: ts,
    },
    traits: [
      "utopy:vault",
      "value:stamp",
      "receipt:verified",
      "value:non-tradable",
    ],
    labels: ["Sello verificado", program.issuerName],
    meta: {
      ns: input.program?.meta?.ns || "mt:market",
      scopes: privateScopes(input.actorId),
      ts,
      source: "utopy.vault.stamp",
      authority: program.issuerNodeId,
      originNode: program.issuerNodeId,
      respondsTo: receiptId,
    },
  };
}

export function buildValueRightDV(input: ValueRightInput): LivingVaultDV {
  const ts = nowIso();
  const program = input.program?.attrs || {};
  const programId = String(program.programId || "");
  const required = Math.max(1, Number(program.stampsRequired || 1));
  const stamps = [...(input.sourceStamps || [])]
    .filter(
      (stamp) =>
        stamp?.kind === "value.stamp" &&
        stamp?.attrs?.programId === programId &&
        stamp?.attrs?.actorId === input.actorId,
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, required);
  if (!programId || stamps.length < required) {
    throw new Error("Todavía no hay sellos suficientes para crear el derecho.");
  }
  const sourceStampIds = stamps.map((stamp) => String(stamp.id));
  const rightKey = stableDigest(sourceStampIds);

  return {
    id: `value.right:${vaultIdPart(programId)}:${rightKey}`,
    kind: "value.right",
    attrs: {
      rightId: `right:${programId}:${rightKey}`,
      programId,
      family: program.family,
      actorId: input.actorId,
      actorName: input.actorName || input.actorId,
      issuerNodeId: program.issuerNodeId,
      issuerName: program.issuerName,
      title: program?.benefit?.title || program.title || "Beneficio disponible",
      description: program?.benefit?.description || "",
      sourceStampIds,
      stampsRequired: required,
      state: "active",
      confirmationRequired: true,
      simulation: program.simulation === true,
      nonTradable: true,
      transferable: false,
      issuedAt: ts,
    },
    traits: [
      "utopy:vault",
      "value:right",
      "benefit:right",
      "benefit:consent",
      "value:non-tradable",
    ],
    labels: [program?.benefit?.title || "Beneficio disponible"],
    meta: {
      ns: input.program?.meta?.ns || "mt:market",
      scopes: privateScopes(input.actorId),
      ts,
      source: "utopy.vault.right",
      authority: program.issuerNodeId,
      originNode: program.issuerNodeId,
      respondsTo: input.program.id,
    },
  };
}

export function buildValueRedemptionDV(
  input: ValueRedemptionInput,
): LivingVaultDV {
  const ts = nowIso();
  const right = input.right?.attrs || {};
  const acceptance = input.acceptance?.attrs || {};
  if (input.right?.kind !== "value.right") {
    throw new Error("No existe un derecho de beneficio válido.");
  }
  if (String(right.actorId || "") !== String(input.actorId)) {
    throw new Error("El derecho pertenece a otro Perfil Vivo.");
  }
  if (right.nonTradable !== true || right.transferable === true) {
    throw new Error("Escudo rechazó un derecho transferible.");
  }
  if (
    input.acceptance?.kind !== "benefit.acceptance" ||
    acceptance.state !== "active"
  ) {
    throw new Error("El nodo no declaró una aceptación activa.");
  }
  const acceptedProgramIds = Array.isArray(acceptance.acceptedProgramIds)
    ? acceptance.acceptedProgramIds.map(String)
    : [];
  const acceptedIssuerNodeIds = Array.isArray(
    acceptance.acceptedIssuerNodeIds,
  )
    ? acceptance.acceptedIssuerNodeIds.map(String)
    : [];
  const acceptedFamilies = Array.isArray(acceptance.acceptedFamilies)
    ? acceptance.acceptedFamilies.map(String)
    : [];
  const compatible =
    acceptedProgramIds.includes(String(right.programId || "")) ||
    acceptedIssuerNodeIds.includes(String(right.issuerNodeId || "")) ||
    acceptedFamilies.includes(String(right.family || ""));
  if (!compatible) {
    throw new Error("El nodo no acepta este programa, emisor o familia.");
  }

  return {
    id: `value.redemption:${vaultIdPart(input.right.id)}`,
    kind: "value.redemption",
    attrs: {
      redemptionId: `redemption:${input.right.id}`,
      rightId: input.right.id,
      programId: right.programId,
      family: right.family,
      actorId: input.actorId,
      actorName: input.actorName || input.actorId,
      issuerNodeId: right.issuerNodeId,
      acceptingNodeId: acceptance.nodeId,
      acceptingNodeName: acceptance.nodeName,
      acceptanceId: input.acceptance.id,
      state: "closed",
      confirmation: {
        holder: true,
        acceptingNode: true,
      },
      simulation:
        right.simulation === true || acceptance.simulation === true,
      nonTradable: true,
      closedAt: ts,
    },
    traits: [
      "utopy:vault",
      "value:redemption",
      "benefit:closed",
      "escudo:dual-confirmation",
      "value:non-tradable",
    ],
    labels: ["Beneficio utilizado", acceptance.nodeName],
    meta: {
      ns: input.right?.meta?.ns || "mt:market",
      scopes: privateScopes(input.actorId),
      ts,
      source: "utopy.vault.redemption",
      authority: acceptance.nodeId,
      originNode: acceptance.nodeId,
      respondsTo: input.right.id,
    },
  };
}

export function buildValueRedemptionRequestDV(
  input: ValueRedemptionInput,
): LivingVaultDV {
  const legacy = buildValueRedemptionDV(input);
  const ts = nowIso();
  const acceptingNodeId = String(legacy?.attrs?.acceptingNodeId || "");
  return {
    ...legacy,
    id: `value.redemption.request:${vaultIdPart(input.right.id)}:${vaultIdPart(acceptingNodeId)}`,
    kind: "value.redemption.request",
    attrs: {
      ...legacy.attrs,
      redemptionRequestId: `redemption.request:${input.right.id}:${acceptingNodeId}`,
      state: "requested",
      confirmation: { holder: true, acceptingNode: false },
      requestedAt: ts,
      closedAt: null,
    },
    traits: [
      "utopy:vault",
      "value:redemption:request",
      "benefit:consent",
      "value:non-tradable",
    ],
    labels: ["Solicitud de uso", String(legacy?.attrs?.acceptingNodeName || "")],
    meta: {
      ...legacy.meta,
      ts,
      updatedAt: ts,
      source: "utopy.vault.redemption.request",
      authority: input.actorId,
      originNode: undefined,
      targetNodeId: acceptingNodeId,
      respondsTo: input.right.id,
    },
  };
}

export function buildValueRedemptionOutcomeDV(
  input: ValueRedemptionOutcomeInput,
): LivingVaultDV {
  if (input.request?.kind !== "value.redemption.request") {
    throw new Error("La respuesta necesita una solicitud de uso válida.");
  }
  const request = input.request.attrs || {};
  const issuerNodeId = String(input.issuerNodeId || "").trim();
  const allowedNodes = [request.acceptingNodeId, request.issuerNodeId]
    .map(String)
    .filter(Boolean);
  if (!issuerNodeId || !allowedNodes.includes(issuerNodeId)) {
    throw new Error("Solo el emisor o el nodo que acepta puede responder.");
  }
  const ts = nowIso();
  const accepted = input.status === "accepted";
  return {
    id: `value.redemption.outcome:${vaultIdPart(input.request.id)}`,
    kind: "value.redemption.outcome",
    attrs: {
      redemptionId: request.redemptionId,
      requestId: input.request.id,
      rightId: request.rightId,
      programId: request.programId,
      family: request.family,
      actorId: request.actorId,
      actorName: request.actorName,
      issuerNodeId: request.issuerNodeId,
      acceptingNodeId: request.acceptingNodeId,
      acceptanceId: request.acceptanceId,
      outcome: input.status,
      state: accepted ? "closed" : "rejected",
      confirmation: { holder: true, acceptingNode: true },
      reason: input.reason || null,
      nonTradable: true,
      confirmedAt: ts,
      closedAt: accepted ? ts : null,
    },
    traits: [
      "utopy:vault",
      "value:redemption:outcome",
      accepted ? "benefit:closed" : "benefit:rejected",
      "escudo:issuer-confirmed",
      "value:non-tradable",
    ],
    labels: [accepted ? "Uso confirmado" : "Uso rechazado", input.issuerName || issuerNodeId],
    meta: {
      ns: input.request?.meta?.ns || "mt:market",
      scopes: privateScopes(String(request.actorId || "")),
      ts,
      updatedAt: ts,
      source: "utopy.vault.redemption.outcome",
      authority: issuerNodeId,
      originNode: issuerNodeId,
      respondsTo: input.request.id,
    },
  };
}
