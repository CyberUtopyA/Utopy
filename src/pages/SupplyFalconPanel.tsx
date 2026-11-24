import React, { useMemo, useState } from "react";
import styled from "styled-components";
import {
  makeCircularDeliveryAssignmentDV,
  makeCircularDeliveryOfferDV,
  makeCircularDeliveryStatusDV,
  makeCircularSupplyAgreementDV,
  makeCircularSupplyOfferDV,
  type CircularDeliveryState,
} from "./circula.dv";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

type Props = {
  allLive?: any[];
  activeCajero?: any | null;
  onOpenThread?: (threadId: string, payload?: any) => void;
};

const DELIVERY_LABELS: Record<CircularDeliveryState, string> = {
  assigned: "Entrega asignada",
  heading_to_pickup: "Yendo a retirar",
  picked_up: "Pedido retirado",
  in_transit: "En camino",
  delivered: "Entregado; falta confirmar",
  received: "Entrega confirmada",
  cancelled: "Cancelado",
};

const DELIVERY_PROGRESS: Record<CircularDeliveryState, number> = {
  assigned: 20,
  heading_to_pickup: 35,
  picked_up: 50,
  in_transit: 72,
  delivered: 90,
  received: 100,
  cancelled: 0,
};

const PROVIDER_NEXT: Partial<Record<CircularDeliveryState, CircularDeliveryState>> = {
  assigned: "heading_to_pickup",
  heading_to_pickup: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
};

function safeStr(value: any) {
  return value == null ? "" : String(value);
}

function actorIdOf(dv: any) {
  return safeStr(
    dv?.attrs?.actorId ||
      dv?.attrs?.buyerId ||
      dv?.attrs?.sellerId ||
      dv?.attrs?.node?.id
  );
}

function threadIdOf(dv: any) {
  return safeStr(dv?.attrs?.threadId || dv?.meta?.threadId);
}

function tsOf(dv: any) {
  const value = Date.parse(safeStr(dv?.meta?.ts || dv?.attrs?.ts));
  return Number.isFinite(value) ? value : 0;
}

function newest(items: any[]) {
  return [...items].sort((a, b) => tsOf(b) - tsOf(a))[0] || null;
}

function respondsTo(dv: any, id: string) {
  return [
    dv?.attrs?.respondsTo,
    dv?.meta?.respondsTo,
    dv?.attrs?.target?.id,
    dv?.attrs?.delivery?.intentId,
    dv?.attrs?.deliveryIntentId,
  ].some((value) => safeStr(value) === safeStr(id));
}

function recurrenceLabel(value: any) {
  const labels: Record<string, string> = {
    once: "Una vez",
    daily: "Cada día",
    weekly: "Cada semana",
    monthly: "Cada mes",
    on_demand: "Cuando haga falta",
  };
  return labels[safeStr(value)] || "Una vez";
}

function currentActor(activeCajero: any) {
  return {
    actorId: safeStr(activeCajero?.actorId || activeCajero?.id),
    actorName: safeStr(activeCajero?.nombre || activeCajero?.name) || "Mi identidad",
    nodeId: safeStr(activeCajero?.nodeId) || null,
    cajeroId: safeStr(activeCajero?.cajeroId) || null,
    orgId: activeCajero?.orgId || null,
    territoryId: activeCajero?.territorioId || null,
  };
}

export default function SupplyFalconPanel({
  allLive = [],
  activeCajero,
  onOpenThread,
}: Props) {
  const me = useMemo(() => currentActor(activeCajero), [activeCajero]);
  const [offerTarget, setOfferTarget] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [availability, setAvailability] = useState("Disponible ahora");
  const [deliveryIncluded, setDeliveryIncluded] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("30");
  const [radiusKm, setRadiusKm] = useState("15");
  const [notice, setNotice] = useState("");

  async function publishCircular(dv: any) {
    const result = await publishAuthorizedDV({
      dv,
      allLive,
      activeActor: activeCajero,
      action: dv?.kind,
      actingAsNodeId: me.nodeId,
      targetNodeId:
        dv?.attrs?.targetNodeId ||
        dv?.attrs?.providerId ||
        dv?.attrs?.supplierId ||
        null,
    });
    return result.dv;
  }

  const demands = useMemo(
    () =>
      allLive
        .filter(
          (dv) =>
            dv?.kind === "mt:demand.material" &&
            safeStr(dv?.attrs?.status || "open") === "open"
        )
        .sort((a, b) => tsOf(b) - tsOf(a)),
    [allLive]
  );

  const deliveryIntents = useMemo(
    () =>
      allLive
        .filter(
          (dv) =>
            dv?.kind === "work.intent" &&
            dv?.attrs?.visibleToResponders !== false &&
            safeStr(dv?.attrs?.status) !== "waiting_payment" &&
            (safeStr(dv?.attrs?.domain) === "logistics.delivery" ||
              (Array.isArray(dv?.traits) &&
                dv.traits.includes("falcon:delivery")))
        )
        .sort((a, b) => tsOf(b) - tsOf(a)),
    [allLive]
  );

  function supplyOffersFor(demand: any) {
    return allLive
      .filter(
        (dv) =>
          dv?.kind === "mt:offer" &&
          (dv?.attrs?.target?.kind === "mt:demand.material" ||
            Array.isArray(dv?.traits)) &&
          respondsTo(dv, demand.id)
      )
      .sort((a, b) => tsOf(b) - tsOf(a));
  }

  function deliveryOffersFor(intent: any) {
    return allLive
      .filter(
        (dv) =>
          dv?.kind === "capability.offer" &&
          respondsTo(dv, intent.id)
      )
      .sort((a, b) => tsOf(b) - tsOf(a));
  }

  function assignmentFor(intent: any) {
    return newest(
      allLive.filter(
        (dv) =>
          dv?.kind === "delivery.assignment" &&
          safeStr(dv?.attrs?.deliveryIntentId) === safeStr(intent.id)
      )
    );
  }

  function statusFor(assignment: any) {
    if (!assignment) return null;
    return newest(
      allLive.filter(
        (dv) =>
          dv?.kind === "delivery.status" &&
          safeStr(dv?.attrs?.assignmentId) === safeStr(assignment.id)
      )
    );
  }

  async function publishSupplyOffer(demand: any) {
    if (!me.actorId) {
      setNotice("Estamos preparando tu identidad privada.");
      return;
    }
    const amount = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Indicá una cantidad válida.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setNotice("Indicá un precio válido.");
      return;
    }

    await publishCircular(
      makeCircularSupplyOfferDV({
        ...me,
        demandId: demand.id,
        threadId: threadIdOf(demand) || null,
        rootDvId: demand?.attrs?.rootDvId || demand.id,
        parentDvId: demand.id,
        sourceDvIds: [demand.id],
        materialKey: demand?.attrs?.materialKey,
        materialName: demand?.attrs?.materialName,
        quantity: amount,
        unit: demand?.attrs?.unit || "u",
        unitPrice: price,
        availability,
        deliveryIncluded,
        title: `Puedo ofrecer ${demand?.attrs?.materialName || "este insumo"}`,
      })
    );

    setNotice("Oferta publicada en la misma conversación viva.");
    setOfferTarget(null);
  }

  async function acceptSupplyOffer(demand: any, offer: any) {
    if (!me.actorId) {
      setNotice("Tu identidad todavía no está lista para confirmar el acuerdo.");
      return;
    }
    const qty = Number(offer?.attrs?.quantity || offer?.attrs?.cantidad || 0);
    const price = Number(offer?.attrs?.unitPrice || offer?.attrs?.price || 0);

    await publishCircular(
      makeCircularSupplyAgreementDV({
        ...me,
        demandId: demand.id,
        offerId: offer.id,
        threadId: threadIdOf(demand) || threadIdOf(offer) || null,
        rootDvId: demand?.attrs?.rootDvId || demand.id,
        parentDvId: offer.id,
        sourceDvIds: [demand.id, offer.id],
        supplierId: actorIdOf(offer),
        supplierName: offer?.attrs?.actorName || offer?.attrs?.sellerName,
        buyerId: actorIdOf(demand),
        buyerName: demand?.attrs?.actorName,
        materialKey: demand?.attrs?.materialKey,
        materialName: demand?.attrs?.materialName,
        quantity: qty,
        unit: offer?.attrs?.unit || demand?.attrs?.unit || "u",
        amount: qty * price,
      })
    );

    setNotice("Acuerdo registrado. Ningún pago o entrega se confirma sin acción de las partes.");
  }

  async function publishDeliveryOffer(intent: any) {
    if (!me.actorId) {
      setNotice("Tu identidad todavía no está lista para ofrecer la entrega.");
      return;
    }
    const fee = Number(deliveryFee);
    const eta = Number(etaMinutes);
    const radius = Number(radiusKm);
    if (!Number.isFinite(fee) || fee < 0) {
      setNotice("Indicá un costo de entrega válido.");
      return;
    }

    await publishCircular(
      makeCircularDeliveryOfferDV({
        ...me,
        deliveryIntentId: intent.id,
        threadId: threadIdOf(intent) || null,
        rootDvId: intent?.attrs?.rootDvId || intent.id,
        parentDvId: intent.id,
        sourceDvIds: [intent.id],
        fee,
        etaMinutes: Number.isFinite(eta) ? eta : null,
        serviceRadiusKm: Number.isFinite(radius) ? radius : 15,
      })
    );

    setNotice("Tu capacidad de entrega quedó disponible para esta señal.");
    setDeliveryTarget(null);
  }

  async function acceptDeliveryOffer(intent: any, offer: any) {
    if (!me.actorId) {
      setNotice("Tu identidad todavía no está lista para asignar la entrega.");
      return;
    }
    await publishCircular(
      makeCircularDeliveryAssignmentDV({
        ...me,
        deliveryIntentId: intent.id,
        deliveryOfferId: offer.id,
        providerId: actorIdOf(offer),
        providerName: offer?.attrs?.actorName || offer?.attrs?.node?.name,
        customerId: actorIdOf(intent),
        fee: offer?.attrs?.delivery?.fee,
        threadId: threadIdOf(intent) || threadIdOf(offer) || null,
        rootDvId: intent?.attrs?.rootDvId || intent.id,
        parentDvId: offer.id,
        sourceDvIds: [intent.id, offer.id],
      })
    );
    setNotice("Entrega asignada. El seguimiento ya está activo en el hilo.");
  }

  async function advanceDelivery(intent: any, assignment: any, state: CircularDeliveryState) {
    if (!me.actorId) {
      setNotice("Tu identidad todavía no está lista para actualizar la entrega.");
      return;
    }
    await publishCircular(
      makeCircularDeliveryStatusDV({
        ...me,
        assignmentId: assignment.id,
        deliveryIntentId: intent.id,
        state,
        threadId: threadIdOf(intent) || threadIdOf(assignment) || null,
        rootDvId: intent?.attrs?.rootDvId || intent.id,
        parentDvId: assignment.id,
        sourceDvIds: [intent.id, assignment.id],
      })
    );
    setNotice(`Estado actualizado: ${DELIVERY_LABELS[state]}.`);
  }

  return (
    <Wrap>
      <Hero>
        <div>
          <Eyebrow>UTOPY · conexión abierta</Eyebrow>
          <h3>Abastecimiento y Entregas Vivas</h3>
          <p>
            Una necesidad, muchas capacidades posibles. Nadie queda fijado a
            una profesión o empresa: responde el nodo que pueda demostrar que
            puede cumplir.
          </p>
        </div>
        <Badge>⌁ mismo hilo vivo</Badge>
      </Hero>

      {notice ? <Notice>{notice}</Notice> : null}

      <Section>
        <SectionTitle>📥 Demandas de abastecimiento</SectionTitle>
        <Subtle>
          Ejemplo: una cafetería pide leche o harina, pero el mismo flujo sirve
          para cualquier persona, nodo, insumo o necesidad.
        </Subtle>

        {!demands.length ? <Empty>No hay demandas abiertas todavía.</Empty> : null}

        {demands.map((demand) => {
          const offers = supplyOffersFor(demand);
          const isOwner = actorIdOf(demand) === me.actorId;
          const isOpen = offerTarget === demand.id;

          return (
            <Card key={demand.id}>
              <CardHead>
                <div>
                  <strong>{demand?.attrs?.title || "Necesidad de insumos"}</strong>
                  <small>
                    {demand?.attrs?.quantity || 0} {demand?.attrs?.unit || "u"} ·{" "}
                    {recurrenceLabel(demand?.attrs?.recurrence)}
                  </small>
                </div>
                <Badge>{offers.length} oferta(s)</Badge>
              </CardHead>

              <Chips>
                <Chip>{demand?.attrs?.materialName || "Insumo"}</Chip>
                {demand?.attrs?.deliveryRequired ? <Chip>🚚 requiere entrega</Chip> : null}
                {demand?.attrs?.neededBy ? <Chip>Para {demand.attrs.neededBy}</Chip> : null}
              </Chips>

              {offers.map((offer) => (
                <OfferRow key={offer.id}>
                  <div>
                    <strong>{offer?.attrs?.actorName || "Nodo oferente"}</strong>
                    <small>
                      {offer?.attrs?.quantity || 0} {offer?.attrs?.unit || "u"} ·{" "}
                      {offer?.attrs?.unitPrice ?? offer?.attrs?.price ?? 0} PYG/u
                    </small>
                  </div>
                  {isOwner ? (
                    <PrimaryBtn onClick={() => acceptSupplyOffer(demand, offer)}>
                      Aceptar
                    </PrimaryBtn>
                  ) : null}
                </OfferRow>
              ))}

              {isOpen ? (
                <FormGrid>
                  <Field>
                    <span>Cantidad</span>
                    <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </Field>
                  <Field>
                    <span>Precio por unidad</span>
                    <Input
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field>
                    <span>Disponibilidad</span>
                    <Input
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                    />
                  </Field>
                  <Check>
                    <input
                      type="checkbox"
                      checked={deliveryIncluded}
                      onChange={(e) => setDeliveryIncluded(e.target.checked)}
                    />
                    Incluyo la entrega
                  </Check>
                  <PrimaryBtn onClick={() => publishSupplyOffer(demand)}>
                    Publicar oferta
                  </PrimaryBtn>
                </FormGrid>
              ) : (
                <Actions>
                  {!isOwner ? (
                    <PrimaryBtn onClick={() => setOfferTarget(demand.id)}>
                      Ofertar directo
                    </PrimaryBtn>
                  ) : null}
                  {threadIdOf(demand) ? (
                    <GhostBtn onClick={() => onOpenThread?.(threadIdOf(demand), demand)}>
                      Abrir conversación
                    </GhostBtn>
                  ) : null}
                </Actions>
              )}
            </Card>
          );
        })}
      </Section>

      <Section>
        <SectionTitle>🚚 Falcon · Entregas Vivas</SectionTitle>
        <Subtle>
          Falcon no es una empresa fija: es la capacidad de retirar, trasladar,
          seguir y entregar que cualquier nodo habilitado puede ofrecer.
        </Subtle>

        {!deliveryIntents.length ? <Empty>No hay entregas solicitadas todavía.</Empty> : null}

        {deliveryIntents.map((intent) => {
          const offers = deliveryOffersFor(intent);
          const assignment = assignmentFor(intent);
          const latestStatus = statusFor(assignment);
          const state = safeStr(
            latestStatus?.attrs?.state || assignment?.attrs?.state || "assigned"
          ) as CircularDeliveryState;
          const progress =
            Number(latestStatus?.attrs?.progress) ||
            DELIVERY_PROGRESS[state] ||
            0;
          const isOwner = actorIdOf(intent) === me.actorId;
          const isProvider =
            safeStr(assignment?.attrs?.providerId) === me.actorId;
          const nextProviderState = PROVIDER_NEXT[state];
          const isOpen = deliveryTarget === intent.id;

          return (
            <Card key={intent.id}>
              <CardHead>
                <div>
                  <strong>{intent?.attrs?.title || "Entrega solicitada"}</strong>
                  <small>{intent?.attrs?.packageSummary || "Pedido"}</small>
                </div>
                <Badge>{assignment ? DELIVERY_LABELS[state] : `${offers.length} propuesta(s)`}</Badge>
              </CardHead>

              {assignment ? (
                <>
                  <Progress aria-label={`Progreso ${progress}%`}>
                    <i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                  </Progress>
                  <Subtle>
                    {progress}% · {DELIVERY_LABELS[state]}
                  </Subtle>

                  <Actions>
                    {isProvider && nextProviderState ? (
                      <PrimaryBtn
                        onClick={() =>
                          advanceDelivery(intent, assignment, nextProviderState)
                        }
                      >
                        {DELIVERY_LABELS[nextProviderState]}
                      </PrimaryBtn>
                    ) : null}
                    {isOwner && state === "delivered" ? (
                      <PrimaryBtn
                        onClick={() => advanceDelivery(intent, assignment, "received")}
                      >
                        Confirmar que llegó
                      </PrimaryBtn>
                    ) : null}
                  </Actions>
                </>
              ) : (
                <>
                  {offers.map((offer) => (
                    <OfferRow key={offer.id}>
                      <div>
                        <strong>{offer?.attrs?.actorName || "Nodo disponible"}</strong>
                        <small>
                          {offer?.attrs?.delivery?.fee || 0} PYG ·{" "}
                          {offer?.attrs?.delivery?.etaMinutes || "?"} min
                        </small>
                      </div>
                      {isOwner ? (
                        <PrimaryBtn onClick={() => acceptDeliveryOffer(intent, offer)}>
                          Elegir
                        </PrimaryBtn>
                      ) : null}
                    </OfferRow>
                  ))}

                  {isOpen ? (
                    <FormGrid>
                      <Field>
                        <span>Costo</span>
                        <Input
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field>
                        <span>Llego en (minutos)</span>
                        <Input
                          value={etaMinutes}
                          onChange={(e) => setEtaMinutes(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <span>Radio disponible (km)</span>
                        <Input
                          value={radiusKm}
                          onChange={(e) => setRadiusKm(e.target.value)}
                        />
                      </Field>
                      <PrimaryBtn onClick={() => publishDeliveryOffer(intent)}>
                        Ofrecer entrega
                      </PrimaryBtn>
                    </FormGrid>
                  ) : (
                    <Actions>
                      {!isOwner ? (
                        <PrimaryBtn onClick={() => setDeliveryTarget(intent.id)}>
                          Puedo entregarlo
                        </PrimaryBtn>
                      ) : null}
                    </Actions>
                  )}
                </>
              )}

              {threadIdOf(intent) ? (
                <GhostBtn onClick={() => onOpenThread?.(threadIdOf(intent), intent)}>
                  Ver hilo completo
                </GhostBtn>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: grid;
  gap: 14px;
`;

const Hero = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  padding: 15px;
  border-radius: 20px;
  color: #ecfeff;
  background:
    radial-gradient(circle at 15% 20%, rgba(34, 211, 238, 0.25), transparent 38%),
    linear-gradient(135deg, #052e2b, #0f172a);

  h3 {
    margin: 4px 0;
    font-size: 18px;
  }

  p {
    margin: 0;
    max-width: 640px;
    opacity: 0.78;
    font-size: 12px;
    line-height: 1.45;
  }
`;

const Eyebrow = styled.div`
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 10px;
  font-weight: 950;
  color: #67e8f9;
`;

const Badge = styled.span`
  display: inline-flex;
  width: fit-content;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.2);
  font-size: 10px;
  font-weight: 900;
`;

const Notice = styled.div`
  padding: 10px 12px;
  border-radius: 14px;
  background: #ecfdf5;
  color: #14532d;
  font-size: 12px;
  font-weight: 800;
`;

const Section = styled.section`
  display: grid;
  gap: 10px;
`;

const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 1000;
`;

const Subtle = styled.div`
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.66;
`;

const Empty = styled.div`
  padding: 16px;
  border: 1px dashed rgba(0, 0, 0, 0.14);
  border-radius: 16px;
  font-size: 12px;
  opacity: 0.66;
`;

const Card = styled.article`
  display: grid;
  gap: 10px;
  padding: 13px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
`;

const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;

  strong,
  small {
    display: block;
  }

  small {
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.65;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.span`
  padding: 5px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 10px;
  font-weight: 850;
`;

const OfferRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 13px;
  background: #f8fafc;

  strong,
  small {
    display: block;
  }

  small {
    margin-top: 3px;
    opacity: 0.64;
    font-size: 10px;
  }
`;

const FormGrid = styled.div`
  display: grid;
  gap: 9px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  align-items: end;
  padding: 10px;
  border-radius: 14px;
  background: #f8fafc;
`;

const Field = styled.label`
  display: grid;
  gap: 5px;
  font-size: 10px;
  font-weight: 900;
`;

const Input = styled.input`
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 9px 10px;
  font: inherit;
  background: #fff;
`;

const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  font-size: 11px;
  font-weight: 850;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const PrimaryBtn = styled.button`
  border: 0;
  border-radius: 11px;
  padding: 9px 11px;
  background: #15ff00;
  color: #06110b;
  font-weight: 950;
  cursor: pointer;
`;

const GhostBtn = styled.button`
  width: fit-content;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 11px;
  padding: 8px 10px;
  background: #fff;
  color: #111827;
  font-weight: 900;
  cursor: pointer;
`;

const Progress = styled.div`
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #15ff00, #22d3ee);
    transition: width 260ms ease;
  }
`;
