import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  Check,
  CircleHelp,
  Coffee,
  Hammer,
  HandHeart,
  Plus,
  Sparkles,
} from "lucide-react";

import {
  acceptValueContributionDV,
  buildValueAgreementDV,
  buildValueCompositionDV,
  buildValueContributionDV,
} from "./value.builders";
import { buildValueDemoNeed, type ValueDemoKind } from "./value.demo";
import {
  computeValueComposition,
  contributionsForNeed,
  isOpenValueNeed,
} from "./value.engine";
import { publishValueDV, publishValueDVs } from "./value.publish";
import type {
  ValueCapabilityKind,
  ValueContributionMode,
  ValueRequirement,
  ValueReward,
} from "./value.types";
import {
  resolveCurrentIdentityContext,
  type CurrentIdentityContext,
} from "../utopy/identityContext";

const SHOW_VALUE_DEMOS = import.meta.env.DEV;

type Props = {
  allLive: any[];
  activeCajero?: any | null;
};

const modeForKind: Record<ValueCapabilityKind, ValueContributionMode> = {
  material: "provide_material",
  work: "do_work",
  equipment: "lend_equipment",
  logistics: "deliver",
  knowledge: "share_knowledge",
  customer_commitment: "preorder",
  space: "other",
  data: "other",
  other: "other",
};

function rewardFor(requirement: ValueRequirement): ValueReward {
  if (requirement.kind === "customer_commitment") {
    return {
      kind: "future_product",
      label: "Producto o servicio futuro acordado",
    };
  }
  return {
    kind: "other",
    label: "Compensación acordada al confirmar",
  };
}

function pct(value: unknown) {
  const parsed = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(parsed) ? parsed : 0));
}

export default function ValueContributionPanel({
  allLive,
  activeCajero,
}: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState<CurrentIdentityContext | null>(null);

  useEffect(() => {
    let mounted = true;
    void resolveCurrentIdentityContext({ allLive, activeActor: activeCajero })
      .then((next) => {
        if (mounted) setIdentity(next);
      })
      .catch(() => {
        if (mounted) setIdentity(null);
      });
    return () => {
      mounted = false;
    };
  }, [allLive, activeCajero]);

  const needs = useMemo(
    () => (Array.isArray(allLive) ? allLive : []).filter(isOpenValueNeed),
    [allLive],
  );
  const selectedNeed =
    needs.find((need) => String(need.id) === selectedNeedId) || needs[0] || null;
  const requirements = (
    Array.isArray(selectedNeed?.attrs?.requirements)
      ? selectedNeed.attrs.requirements
      : []
  ) as ValueRequirement[];
  const selectedRequirement =
    requirements.find((item) => item.key === selectedKey) ||
    requirements[0] ||
    null;

  useEffect(() => {
    if (!selectedNeedId && needs[0]?.id) {
      setSelectedNeedId(String(needs[0].id));
    }
  }, [needs, selectedNeedId]);

  useEffect(() => {
    const next =
      requirements.find((item: any) => item.key === selectedKey) ||
      requirements[0];

    if (next && next.key !== selectedKey) {
      setSelectedKey(next.key);
      setAmount(Math.max(1, Number(next.amount || 1)));
    }
  }, [requirements, selectedKey]);

  const createDemo = async (kind: ValueDemoKind) => {
    setBusy(true);
    try {
      const need = buildValueDemoNeed(kind);
      await publishValueDV(need);
      setSelectedNeedId(need.id);
      setSelectedKey(need.attrs.requirements[0]?.key || "");
      setAmount(Number(need.attrs.requirements[0]?.amount || 1));
      setMessage("Prueba creada. Elegí qué valor querés aportar.");
    } finally {
      setBusy(false);
    }
  };

  const offerContribution = async () => {
    if (!selectedNeed || !selectedRequirement) return;
    const actorId = identity?.actorId || "";
    if (!actorId) {
      setMessage("Tu identidad viva todavía se está preparando.");
      return;
    }
    setBusy(true);
    try {
      const contribution = buildValueContributionDV({
        need: selectedNeed,
        actorId,
        actorName: identity?.displayName || activeCajero?.name || "Participante",
        capabilityKey: selectedRequirement.key,
        capabilityKind: selectedRequirement.kind,
        mode: modeForKind[selectedRequirement.kind],
        amount: Math.max(0.01, Number(amount || 0)),
        unit: selectedRequirement.unit,
        note,
        reward: rewardFor(selectedRequirement),
      });
      await publishValueDV(contribution, {
        allLive,
        activeActor: { id: actorId, actorId, name: identity?.displayName },
        targetNodeId: String(selectedNeed?.attrs?.nodeId || selectedNeed?.meta?.originNode || "") || null,
      });
      setNote("");
      setMessage(
        "Aporte enviado. El nodo debe aceptarlo antes de formar el acuerdo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const acceptContribution = async (need: any, contribution: any) => {
    const nodeId = String(need?.attrs?.nodeId || need?.meta?.originNode || "");
    const actingNodeId = String(identity?.actingAsNodeId || identity?.nodeId || "");
    const isDemo = need?.attrs?.simulation === true;
    if (!isDemo && actingNodeId !== nodeId) {
      setMessage("Solo el nodo receptor puede confirmar este aporte.");
      return;
    }

    setBusy(true);
    try {
      const agreement = buildValueAgreementDV({
        need,
        contribution,
        acceptedBy: nodeId,
      });
      const nextAll = (Array.isArray(allLive) ? allLive : []).concat(agreement);
      const composition = buildValueCompositionDV(
        need,
        computeValueComposition(need, nextAll),
      );
      await publishValueDVs([agreement, composition], {
        allLive,
        activeActor: activeCajero,
        actingAsNodeId: nodeId,
      });
      setMessage("Aporte comprometido. Se marcará como recibido solo después de verificar el resultado.");
    } finally {
      setBusy(false);
    }
  };

  const completeSimulation = async (need: any) => {
    if (need?.attrs?.simulation !== true) return;
    const nodeId = String(need?.attrs?.nodeId || "node:demo");
    const demoActor = String(activeCajero?.id || "actor:demo");
    const requirementList = (
      Array.isArray(need?.attrs?.requirements) ? need.attrs.requirements : []
    ) as ValueRequirement[];
    setBusy(true);
    try {
      const nextAll = [...(Array.isArray(allLive) ? allLive : [])];
      const toPublish: any[] = [];

      for (const requirement of requirementList) {
        const offered = buildValueContributionDV({
          need,
          actorId: demoActor,
          actorName: activeCajero?.name || "Red UTOPY de prueba",
          capabilityKey: requirement.key,
          capabilityKind: requirement.kind,
          mode: modeForKind[requirement.kind],
          amount: requirement.amount,
          unit: requirement.unit,
          note: "Cobertura simulada para validar el flujo.",
          reward: rewardFor(requirement),
        });
        offered.id = `value.contribution.demo:${need.id}:${requirement.key}`;
        const accepted = acceptValueContributionDV(offered, nodeId);
        const agreement = buildValueAgreementDV({
          need,
          contribution: accepted,
          acceptedBy: nodeId,
        });
        toPublish.push(accepted, agreement);
        const previousIndex = nextAll.findIndex((dv) => dv?.id === accepted.id);
        if (previousIndex >= 0) nextAll.splice(previousIndex, 1);
        nextAll.push(accepted, agreement);
      }

      const composition = buildValueCompositionDV(
        need,
        computeValueComposition(need, nextAll),
      );
      toPublish.push(composition);
      await publishValueDVs(toPublish);
      setMessage("Simulación completa: el valor necesario quedó compuesto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Top>
        <div>
          <Eyebrow>
            <HandHeart size={15} /> Valor real
          </Eyebrow>
          <h3>Aportes vivos</h3>
        </div>
        <HelpButton
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          aria-label="¿Qué son los aportes vivos?"
        >
          <CircleHelp size={19} />
        </HelpButton>
      </Top>

      {showHelp ? (
        <Help>
          Un nodo dice qué quiere crear. La red puede aportar materiales,
          trabajo, equipos, conocimiento, logística o pedidos. Nada se vuelve
          inversión ni se acepta sin confirmación.
        </Help>
      ) : null}

      <DemoBar style={{ display: SHOW_VALUE_DEMOS ? undefined : "none" }}>
        <DemoButton
          type="button"
          disabled={busy}
          onClick={() => createDemo("coffee")}
        >
          <Coffee size={17} />
          Probar café
        </DemoButton>
        <DemoButton
          type="button"
          disabled={busy}
          onClick={() => createDemo("furniture")}
        >
          <Hammer size={17} />
          Probar muebles
        </DemoButton>
      </DemoBar>

      <SafeBadge style={{ display: SHOW_VALUE_DEMOS ? undefined : "none" }}>
        <Sparkles size={14} /> Simulación · sin dinero · no negociable
      </SafeBadge>

      {!needs.length ? (
        <Empty>
          {!SHOW_VALUE_DEMOS ? "Todavía no hay necesidades de valor abiertas en esta red." : null}
          <span style={{ display: SHOW_VALUE_DEMOS ? undefined : "none" }}>
          Elegí una prueba. Después cualquier nodo podrá publicar su propia
          necesidad con el mismo DV.
          </span>
        </Empty>
      ) : (
        <NeedList>
          {needs.map((need) => {
            const composition = computeValueComposition(need, allLive);
            const contributionList = contributionsForNeed(need.id, allLive);
            const committedIds = new Set(composition.contributionIds);
            const verifiedIds = new Set(composition.verifiedContributionIds);
            const selected = need.id === selectedNeed?.id;
            return (
              <NeedCard key={need.id} $selected={selected}>
                <NeedButton
                  type="button"
                  onClick={() => setSelectedNeedId(String(need.id))}
                >
                  <div>
                    <NodeName>{need.attrs?.nodeName || "Nodo vivo"}</NodeName>
                    <NeedTitle>{need.attrs?.title || "Necesidad viva"}</NeedTitle>
                  </div>
                  <Score>{Math.round(pct(composition.coverage))}%</Score>
                </NeedButton>
                <Progress>
                  <span style={{ width: `${pct(composition.coverage)}%` }} />
                </Progress>

                {selected ? (
                  <>
                    <RequirementGrid>
                      {(need.attrs?.requirements || []).map(
                        (requirement: ValueRequirement) => {
                          const row = composition.requirements.find(
                            (item) => item.key === requirement.key,
                          );
                          return (
                            <Requirement
                              key={requirement.key}
                              $active={selectedKey === requirement.key}
                              type="button"
                              onClick={() => {
                                setSelectedKey(requirement.key);
                                setAmount(
                                  Math.max(1, Number(requirement.amount || 1)),
                                );
                              }}
                            >
                              <span>{requirement.label}</span>
                              <small>
                                {row?.committedAmount || 0} comprometido · {row?.verifiedAmount || 0} recibido / {requirement.amount} {requirement.unit}
                              </small>
                            </Requirement>
                          );
                        },
                      )}
                    </RequirementGrid>

                    {selectedRequirement ? (
                      <OfferBox>
                        <AmountInput>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(event) =>
                              setAmount(Number(event.target.value || 0))
                            }
                          />
                          <span>{selectedRequirement.unit}</span>
                        </AmountInput>
                        <input
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Nota opcional"
                        />
                        <PrimaryButton
                          type="button"
                          disabled={busy || amount <= 0}
                          onClick={offerContribution}
                        >
                          <Plus size={17} /> Aportar
                        </PrimaryButton>
                      </OfferBox>
                    ) : null}

                    {contributionList.length ? (
                      <ContributionList>
                        {contributionList.map((contribution) => (
                          <ContributionRow key={contribution.id}>
                            <div>
                              <strong>
                                {contribution.attrs?.actorName || "Participante"}
                              </strong>
                              <small>
                                {contribution.attrs?.amount}{" "}
                                {contribution.attrs?.unit} ·{" "}
                                {verifiedIds.has(String(contribution.id))
                                  ? "recibido y verificado"
                                  : committedIds.has(String(contribution.id))
                                    ? "comprometido, pendiente de entrega"
                                    : "esperando acuerdo"}
                              </small>
                            </div>
                            {!committedIds.has(String(contribution.id)) ? (
                              <MiniButton
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  acceptContribution(need, contribution)
                                }
                              >
                                <Check size={15} /> Confirmar
                              </MiniButton>
                            ) : (
                              <Accepted>
                                <Check size={14} /> {verifiedIds.has(String(contribution.id)) ? "Recibido" : "Comprometido"}
                              </Accepted>
                            )}
                          </ContributionRow>
                        ))}
                      </ContributionList>
                    ) : null}

                    {SHOW_VALUE_DEMOS && need.attrs?.simulation === true ? (
                      <SecondaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => completeSimulation(need)}
                      >
                        Completar simulación
                      </SecondaryButton>
                    ) : null}
                  </>
                ) : null}
              </NeedCard>
            );
          })}
        </NeedList>
      )}

      {message ? <Message>{message}</Message> : null}
    </Shell>
  );
}

const Shell = styled.div`
  display: grid;
  gap: 12px;
`;

const Top = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 3px 0 0;
    font-size: 1.18rem;
  }
`;

const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #08773c;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
`;

const HelpButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.09);
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
`;

const Help = styled.div`
  padding: 11px 12px;
  border-radius: 16px;
  background: #effff1;
  color: #20402b;
  font-size: 0.78rem;
  line-height: 1.45;
`;

const DemoBar = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const DemoButton = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  padding: 11px 10px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 900;
  cursor: pointer;
`;

const SafeBadge = styled.div`
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 6px 9px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 0.68rem;
  font-weight: 900;
`;

const Empty = styled.div`
  border: 1px dashed rgba(0, 0, 0, 0.18);
  border-radius: 20px;
  padding: 18px;
  text-align: center;
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.45;
`;

const NeedList = styled.div`
  display: grid;
  gap: 9px;
`;

const NeedCard = styled.div<{ $selected?: boolean }>`
  border: 1px solid
    ${({ $selected }) => ($selected ? "#57e66b" : "rgba(0,0,0,0.08)")};
  border-radius: 20px;
  background: #fff;
  padding: 11px;
  box-shadow: ${({ $selected }) =>
    $selected ? "0 12px 32px rgba(21,255,0,0.12)" : "none"};
`;

const NeedButton = styled.button`
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  padding: 0;
`;

const NodeName = styled.div`
  color: #08773c;
  font-size: 0.68rem;
  font-weight: 900;
`;

const NeedTitle = styled.div`
  margin-top: 2px;
  font-weight: 950;
  font-size: 0.88rem;
`;

const Score = styled.strong`
  min-width: 42px;
  text-align: right;
  font-size: 0.86rem;
`;

const Progress = styled.div`
  height: 7px;
  margin-top: 9px;
  border-radius: 999px;
  overflow: hidden;
  background: #e8edf0;

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #15ff00, #34d399);
    transition: width 220ms ease;
  }
`;

const RequirementGrid = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
`;

const Requirement = styled.button<{ $active?: boolean }>`
  border: 1px solid
    ${({ $active }) => ($active ? "#15c92c" : "rgba(0,0,0,0.08)")};
  border-radius: 13px;
  padding: 8px;
  background: ${({ $active }) => ($active ? "#edffef" : "#f8fafc")};
  text-align: left;
  cursor: pointer;

  span,
  small {
    display: block;
  }

  span {
    font-size: 0.72rem;
    font-weight: 900;
  }

  small {
    margin-top: 3px;
    color: #64748b;
    font-size: 0.64rem;
  }
`;

const OfferBox = styled.div`
  margin-top: 9px;
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr) auto;
  gap: 7px;

  input {
    min-width: 0;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 13px;
    padding: 9px 10px;
    background: #fff;
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const AmountInput = styled.label`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 13px;
  overflow: hidden;

  input {
    width: 100%;
    border: 0;
  }

  span {
    padding-right: 9px;
    color: #64748b;
    font-size: 0.68rem;
    font-weight: 800;
  }
`;

const PrimaryButton = styled.button`
  border: 0;
  border-radius: 13px;
  padding: 9px 12px;
  background: #15ff00;
  color: #071107;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 950;
  cursor: pointer;
`;

const SecondaryButton = styled.button`
  width: 100%;
  margin-top: 9px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 13px;
  padding: 9px 12px;
  background: #111827;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
`;

const ContributionList = styled.div`
  margin-top: 9px;
  display: grid;
  gap: 6px;
`;

const ContributionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-radius: 13px;
  padding: 8px 9px;
  background: #f4f7f5;

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 0.72rem;
  }

  small {
    margin-top: 2px;
    color: #64748b;
    font-size: 0.63rem;
  }
`;

const MiniButton = styled.button`
  border: 0;
  border-radius: 11px;
  padding: 7px 9px;
  background: #15ff00;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 900;
  cursor: pointer;
`;

const Accepted = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  color: #08773c;
  font-size: 0.68rem;
  font-weight: 900;
`;

const Message = styled.div`
  border-radius: 14px;
  padding: 9px 10px;
  background: #08150d;
  color: #fff;
  font-size: 0.72rem;
`;
