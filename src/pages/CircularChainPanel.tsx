import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { mtLiveUpsert } from "../mt/mt.liveStore";
import {
  CircularChainSnapshot,
  CircularChainStage,
  collectCircularChainSnapshots,
  createCircularChainId,
  publishCircularChainEvent,
} from "../mt/mt.circularChain";
import {
  makeCircularDemandMaterialDV,
  makeCircularDesignDV,
  makeCircularOfferDV,
  makeCircularProductDV,
  makeCircularWorkIntentDV,
} from "./circula.dv";
import { resonateCircularDV } from "./circular.resonance";

type Props = {
  allLive: any[];
  activeCajero?: any | null;
};

type Geo = { lat: number; lng: number; source: string };

const STEP_LABEL: Record<CircularChainStage, string> = {
  need: "MO entrega diseño y presupuesto",
  design: "El carpintero acepta fabricar",
  fabrication: "El carpintero solicita madera",
  material_demand: "Comprar madera al proveedor",
  material_purchase: "Fabricar el mueble",
  production: "Publicar el mueble terminado",
  sale: "DecoHogar compra y publica reventa",
  resale: "La persona compra y recibe",
  delivery: "Completar la cadena viva",
  completed: "Crear otra prueba",
};

const STAGE_NAME: Record<CircularChainStage, string> = {
  need: "Necesidad",
  design: "Diseño",
  fabrication: "Fabricación",
  material_demand: "Demanda de material",
  material_purchase: "Compra de material",
  production: "Producción",
  sale: "Venta",
  resale: "Reventa",
  delivery: "Entrega",
  completed: "Completado",
};

function uid(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
}

function latestId(snapshot: CircularChainSnapshot): string | null {
  return snapshot.eventIds[snapshot.eventIds.length - 1] || null;
}

function markLocalTest(dv: any) {
  return {
    ...dv,
    attrs: {
      ...(dv?.attrs || {}),
      testMode: true,
    },
    traits: Array.from(
      new Set([...(Array.isArray(dv?.traits) ? dv.traits : []), "utopy:test"])
    ),
    meta: {
      ...(dv?.meta || {}),
      scopes: ["local:test"],
      test: true,
    },
  };
}

function publishLocal(dv: any) {
  const next = markLocalTest(dv);
  mtLiveUpsert(next);
  return next;
}

function capabilityDV(input: {
  id: string;
  name: string;
  domains: string[];
  verbs: string[];
  resources: string[];
  geo: Geo;
}) {
  const ts = new Date().toISOString();
  return markLocalTest({
    id: `capability.offer:${input.id}:furniture-demo`,
    kind: "capability.offer",
    attrs: {
      actor: { id: input.id, name: input.name, nodeId: input.id },
      actorId: input.id,
      actorName: input.name,
      node: { id: input.id, name: input.name },
      nodeId: input.id,
      title: `${input.name} · capacidad disponible`,
      geo: input.geo,
      location: input.geo,
      capabilities: [
        {
          id: `cap:${input.id}:furniture-demo`,
          domains: input.domains,
          verbs: input.verbs,
          resources: input.resources,
          serviceRadiusKm: 80,
        },
      ],
    },
    traits: ["resonance:capable", "capability:offer", "utopy:test"],
    meta: {
      ns: "utopy:resonance",
      ts,
      ttl_ms: 2 * 60 * 60_000,
      scopes: ["local:test"],
      test: true,
    },
  });
}

function browserGeo(): Promise<Geo> {
  const fallback: Geo = {
    lat: -24.0676,
    lng: -54.3101,
    source: "demo.fallback",
  };

  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "browser.geolocation",
        }),
      () => resolve(fallback),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60_000 }
    );
  });
}

function testOrderDV(input: {
  chainId: string;
  rootDvId: string | null;
  parentDvId: string | null;
  sourceDvIds: string[];
  stage: CircularChainStage;
  status: "paid" | "delivered";
  title: string;
  actorId: string;
  actorName: string;
  offerId?: string | null;
  productId?: string | null;
  threadId: string;
}) {
  const ts = new Date().toISOString();
  return {
    id: uid("market.order.event.test"),
    kind: "market.order.event.test",
    attrs: {
      chainId: input.chainId,
      rootDvId: input.rootDvId,
      parentDvId: input.parentDvId,
      sourceDvIds: input.sourceDvIds,
      stage: input.stage,
      status: input.status,
      paymentStatus: input.status,
      ok: true,
      title: input.title,
      actorId: input.actorId,
      actorName: input.actorName,
      buyerId: input.actorId,
      buyerName: input.actorName,
      offerId: input.offerId || null,
      productId: input.productId || null,
      threadId: input.threadId,
      requiresConfirmation: true,
      confirmed: true,
      testMode: true,
    },
    traits: ["mt:circular", "mt:order", "consent:explicit", "utopy:test"],
    meta: {
      ns: "mt:market",
      ts,
      chainId: input.chainId,
      stage: input.stage,
      threadId: input.threadId,
      scopes: ["local:test"],
      test: true,
    },
  };
}

async function publishResonance(source: any, liveDVs: any[]) {
  await resonateCircularDV({
    dv: source,
    actorId: String(source?.attrs?.actorId || "actor:demo"),
    nodeId: source?.attrs?.nodeId || null,
    liveDVs,
    publishDV: async (dv) => {
      mtLiveUpsert(dv as any);
    },
  });
}

export default function CircularChainPanel({ allLive, activeCajero }: Props) {
  const developmentMode = import.meta.env.DEV;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const snapshots = useMemo(
    () => collectCircularChainSnapshots(Array.isArray(allLive) ? allLive : []),
    [allLive]
  );

  const demo = useMemo(
    () =>
      (developmentMode ? snapshots : []).find((snapshot) =>
        snapshot.events.some(
          (dv: any) => dv?.meta?.test === true || dv?.attrs?.testMode === true
        )
      ) || null,
    [snapshots, developmentMode]
  );

  const startDemo = async () => {
    setBusy(true);
    setMessage("Preparando capacidades y ubicación...");

    try {
      const geo = await browserGeo();
      const chainId = createCircularChainId("furniture");
      const clientId = String(activeCajero?.id || "actor:cliente.demo");
      const clientName = String(activeCajero?.nombre || "Persona interesada");
      const threadId = uid("thread.design");

      const capabilities = [
        capabilityDV({
          id: "node:design.demo",
          name: "MO · diseño",
          domains: ["furniture.design", "diseño", "mobiliario"],
          verbs: ["design", "quote", "plan", "produce"],
          resources: ["mueble", "mobiliario", "proyecto"],
          geo,
        }),
        capabilityDV({
          id: "node:carpentry.demo",
          name: "Carpintero capaz",
          domains: ["circular.fabrication", "carpintería", "muebles"],
          verbs: ["fabricate", "produce", "assemble"],
          resources: ["mueble", "madera", "mobiliario"],
          geo,
        }),
        capabilityDV({
          id: "node:wood.demo",
          name: "Proveedor de madera",
          domains: ["materiales", "madera", "circular.fabrication"],
          verbs: ["supply", "cut", "deliver"],
          resources: ["madera", "mdf", "tablero"],
          geo,
        }),
        capabilityDV({
          id: "node:retail.demo",
          name: "DecoHogar · reventa",
          domains: ["retail.furniture", "muebles", "comercio"],
          verbs: ["buy", "resell", "deliver"],
          resources: ["mueble", "mobiliario"],
          geo,
        }),
      ];
      capabilities.forEach((dv) => mtLiveUpsert(dv));

      const rootDraft = makeCircularWorkIntentDV({
        actorId: clientId,
        actorName: clientName,
        nodeId: clientId,
        title: "Quiero diseñar un mueble a medida",
        description:
          "Prueba local: diseño, fabricación, compra de madera, venta y reventa.",
        domain: "furniture.design",
        materialKey: "furniture.custom",
        materialName: "mueble",
        quantity: 1,
        unit: "proyecto",
        lat: geo.lat,
        lng: geo.lng,
        chainId,
        stage: "need",
        status: "open",
        threadId,
        scopes: ["local:test"],
      });
      const root = publishLocal({
        ...rootDraft,
        attrs: { ...rootDraft.attrs, rootDvId: rootDraft.id },
        meta: { ...rootDraft.meta, rootDvId: rootDraft.id },
      });

      await publishResonance(root, [...allLive, ...capabilities, root]);
      setMessage(
        `Cadena iniciada. La Señal Viva debe encontrar diseño, fabricación, madera y reventa compatibles.`
      );
    } catch (error: any) {
      setMessage(error?.message || "No se pudo iniciar la prueba.");
    } finally {
      setBusy(false);
    }
  };

  const advanceDemo = async (snapshot: CircularChainSnapshot) => {
    setBusy(true);
    setMessage("");

    try {
      const chainId = snapshot.chainId;
      const rootDvId = snapshot.rootDvId;
      const parentDvId = latestId(snapshot);
      const geo = snapshot.geo || {
        lat: -24.0676,
        lng: -54.3101,
        source: "demo.fallback",
      };
      const common = {
        chainId,
        rootDvId,
        parentDvId,
        sourceDvIds: parentDvId ? [parentDvId] : [],
        lat: geo.lat,
        lng: geo.lng,
        scopes: ["local:test"],
      };

      if (snapshot.currentStage === "need") {
        const design = publishLocal(
          makeCircularDesignDV({
            ...common,
            actorId: "node:design.demo",
            actorName: "MO · diseño",
            nodeId: "node:design.demo",
            title: "Diseño de mueble a medida",
            description: "Plano, materiales estimados y presupuesto de prueba.",
            materialKey: "furniture.custom",
            materialName: "mueble",
            budget: 1_500_000,
            currency: "PYG",
            specifications: {
              widthCm: 120,
              heightCm: 80,
              material: "madera",
            },
            capabilities: ["furniture.design", "quote"],
            stage: "design",
            status: "accepted",
            threadId: uid("thread.design"),
          })
        );
        publishLocal(
          makeCircularOfferDV({
            ...common,
            parentDvId: design.id,
            sourceDvIds: [design.id],
            actorId: "node:design.demo",
            actorName: "MO · diseño",
            nodeId: "node:design.demo",
            title: "Diseño y presupuesto del mueble",
            materialKey: "service.furniture.design",
            materialName: "Diseño de mueble",
            quantity: 1,
            unit: "proyecto",
            price: 1_500_000,
            stage: "design",
            status: "accepted",
            threadId: uid("thread.design.offer"),
          })
        );
        setMessage("MO publicó el diseño y el presupuesto en MS Market.");
      } else if (snapshot.currentStage === "design") {
        const work = publishLocal(
          makeCircularWorkIntentDV({
            ...common,
            actorId: "node:design.demo",
            actorName: "MO · diseño",
            nodeId: "node:design.demo",
            title: "Fabricar mueble diseñado",
            description: "Trabajo disponible para cualquier nodo carpintero compatible.",
            domain: "circular.fabrication",
            materialKey: "furniture.custom",
            materialName: "mueble de madera",
            quantity: 1,
            unit: "trabajo",
            stage: "fabrication",
            status: "open",
            threadId: uid("thread.fabrication"),
          })
        );
        await publishResonance(work, [...allLive, work]);
        publishCircularChainEvent(
          {
            chainId,
            rootDvId,
            parentDvId: work.id,
            sourceDvIds: [work.id],
            stage: "fabrication",
            status: "accepted",
            action: "work.accept",
            title: "Carpintero acepta fabricar",
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            nodeId: "node:carpentry.demo",
            threadId: work.attrs.threadId,
            capabilities: ["circular.fabrication", "carpentry"],
            confirmed: true,
            scopes: ["local:test"],
            testMode: true,
          },
          { broadcast: false }
        );
        setMessage("Un nodo carpintero compatible aceptó el trabajo.");
      } else if (snapshot.currentStage === "fabrication") {
        const demand = publishLocal(
          makeCircularDemandMaterialDV({
            ...common,
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            nodeId: "node:carpentry.demo",
            title: "Necesito madera para fabricar el mueble",
            materialKey: "material.wood",
            materialName: "madera",
            quantity: 20,
            unit: "kg",
            maxUnitPrice: 18_000,
            stage: "material_demand",
            status: "open",
            threadId: uid("thread.material"),
          })
        );
        await publishResonance(demand, [...allLive, demand]);
        setMessage("El carpintero publicó la demanda de madera.");
      } else if (snapshot.currentStage === "material_demand") {
        const materialOffer = publishLocal(
          makeCircularOfferDV({
            ...common,
            actorId: "node:wood.demo",
            actorName: "Proveedor de madera",
            nodeId: "node:wood.demo",
            title: "20 kg de madera disponible",
            materialKey: "material.wood",
            materialName: "madera",
            quantity: 20,
            unit: "kg",
            price: 15_000,
            stage: "material_demand",
            status: "open",
            threadId: uid("thread.material.offer"),
          })
        );
        publishLocal(
          testOrderDV({
            chainId,
            rootDvId,
            parentDvId: materialOffer.id,
            sourceDvIds: [materialOffer.id],
            stage: "material_purchase",
            status: "paid",
            title: "Compra de madera confirmada",
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            offerId: materialOffer.id,
            threadId: uid("thread.material.order"),
          })
        );
        setMessage("La compra de madera fue confirmada de forma explícita.");
      } else if (snapshot.currentStage === "material_purchase") {
        const product = publishLocal(
          makeCircularProductDV({
            ...common,
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            nodeId: "node:carpentry.demo",
            title: "Mueble circular terminado",
            description: "Fabricado a partir del diseño y material de esta cadena.",
            materialKey: "product.furniture.custom",
            materialName: "mueble",
            quantity: 1,
            stock: 1,
            unit: "u",
            price: 2_400_000,
            stage: "production",
            status: "available",
            threadId: uid("thread.production"),
          })
        );
        publishCircularChainEvent(
          {
            chainId,
            rootDvId,
            parentDvId: product.id,
            sourceDvIds: [product.id],
            stage: "production",
            status: "completed",
            action: "production.complete",
            title: "Mueble fabricado",
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            nodeId: "node:carpentry.demo",
            confirmed: true,
            scopes: ["local:test"],
            testMode: true,
          },
          { broadcast: false }
        );
        setMessage("El mueble se convirtió en un producto trazable.");
      } else if (snapshot.currentStage === "production") {
        publishLocal(
          makeCircularOfferDV({
            ...common,
            actorId: "node:carpentry.demo",
            actorName: "Carpintero capaz",
            nodeId: "node:carpentry.demo",
            title: "Mueble circular terminado en venta",
            materialKey: "product.furniture.custom",
            materialName: "mueble",
            quantity: 1,
            unit: "u",
            price: 2_400_000,
            stage: "sale",
            status: "open",
            threadId: uid("thread.sale"),
          })
        );
        setMessage("La oferta del mueble ya aparece en Market.");
      } else if (snapshot.currentStage === "sale") {
        const purchase = publishLocal(
          testOrderDV({
            chainId,
            rootDvId,
            parentDvId,
            sourceDvIds: parentDvId ? [parentDvId] : [],
            stage: "resale",
            status: "paid",
            title: "DecoHogar compra el mueble",
            actorId: "node:retail.demo",
            actorName: "DecoHogar · reventa",
            offerId: parentDvId,
            threadId: uid("thread.retail.buy"),
          })
        );
        publishLocal(
          makeCircularOfferDV({
            ...common,
            parentDvId: purchase.id,
            sourceDvIds: [purchase.id],
            actorId: "node:retail.demo",
            actorName: "DecoHogar · reventa",
            nodeId: "node:retail.demo",
            ownerId: "node:retail.demo",
            title: "Mueble circular disponible en DecoHogar",
            materialKey: "product.furniture.custom",
            materialName: "mueble",
            quantity: 1,
            unit: "u",
            price: 2_850_000,
            stage: "resale",
            status: "open",
            threadId: uid("thread.retail.sale"),
          })
        );
        setMessage("DecoHogar adquirió el mueble y publicó una reventa trazable.");
      } else if (snapshot.currentStage === "resale") {
        publishLocal(
          testOrderDV({
            chainId,
            rootDvId,
            parentDvId,
            sourceDvIds: parentDvId ? [parentDvId] : [],
            stage: "delivery",
            status: "delivered",
            title: "Compra y entrega final confirmadas",
            actorId: String(activeCajero?.id || "actor:cliente.demo"),
            actorName: String(activeCajero?.nombre || "Persona interesada"),
            offerId: parentDvId,
            threadId: uid("thread.final.delivery"),
          })
        );
        setMessage("La persona confirmó la compra y la entrega final.");
      } else if (snapshot.currentStage === "delivery") {
        publishCircularChainEvent(
          {
            chainId,
            rootDvId,
            parentDvId,
            sourceDvIds: parentDvId ? [parentDvId] : [],
            stage: "completed",
            status: "completed",
            action: "chain.complete",
            title: "Cadena del mueble completada",
            actorId: String(activeCajero?.id || "actor:cliente.demo"),
            actorName: String(activeCajero?.nombre || "Persona interesada"),
            confirmed: true,
            scopes: ["local:test"],
            testMode: true,
          },
          { broadcast: false }
        );
        setMessage("Ciclo completo: necesidad, diseño, material, fabricación y venta.");
      } else {
        await startDemo();
      }
    } catch (error: any) {
      setMessage(error?.message || "No se pudo avanzar la prueba.");
    } finally {
      setBusy(false);
    }
  };

  const action = () => {
    if (!developmentMode) return Promise.resolve();
    if (!demo || demo.currentStage === "completed") return startDemo();
    return advanceDemo(demo);
  };

  if (!developmentMode) {
    const liveChains = snapshots.filter((snapshot) =>
      !snapshot.events.some((dv: any) => dv?.meta?.test === true || dv?.attrs?.testMode === true),
    );
    const openNeeds = (Array.isArray(allLive) ? allLive : [])
      .filter((dv: any) =>
        ["value.need", "work.intent", "demand.material", "material.demand"].includes(String(dv?.kind || "")) &&
        dv?.meta?.test !== true &&
        dv?.attrs?.testMode !== true &&
        !["closed", "completed", "cancelled"].includes(String(dv?.attrs?.state || dv?.attrs?.status || "").toLowerCase()),
      )
      .slice(0, 8);
    return (
      <Wrap>
        <Hero>
          <Eyebrow>MAPA CIRCULAR · RED VIVA</Eyebrow>
          <h3>Necesidades y cadenas reales del territorio</h3>
          <p>La red muestra dónde hace falta trabajo, material, transporte o financiación. Ninguna simulación se publica como actividad real.</p>
        </Hero>
        {openNeeds.map((dv: any) => (
          <ChainCard key={dv.id}>
            <Small>{dv.kind === "work.intent" ? "TRABAJO O CAPACIDAD NECESARIA" : "NECESIDAD ABIERTA"}</Small>
            <strong>{dv?.attrs?.title || dv?.attrs?.purpose || dv?.attrs?.description || "Coordinación disponible"}</strong>
            <Meta>{dv?.attrs?.territoryName || dv?.attrs?.territoryId || "Territorio aproximado"}</Meta>
            <Next>Ver propuesta y capacidades compatibles</Next>
          </ChainCard>
        ))}
        {liveChains.slice(0, 6).map((chain) => (
          <ChainCard key={chain.chainId}>
            <Row><div><Small>CADENA VIVA</Small><strong>{chain.title}</strong></div><Percent>{chain.progress}%</Percent></Row>
            <Progress><i style={{ width: `${chain.progress}%` }} /></Progress>
            <Meta>{chain.eventCount} hechos enlazados · {STAGE_NAME[chain.currentStage]}</Meta>
          </ChainCard>
        ))}
        {!openNeeds.length && !liveChains.length ? (
          <Empty>Todavía no hay una necesidad circular real visible en este territorio.</Empty>
        ) : null}
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Hero>
        <Eyebrow>CADENA VIVA · PRUEBA LOCAL SEGURA</Eyebrow>
        <h3>Ciclo completo de un mueble</h3>
        <p>
          Cada clic confirma una etapa. La prueba usa capacidades, no nombres
          fijos dentro del algoritmo, y no ejecuta pagos reales ni se transmite
          a la red.
        </p>
      </Hero>

      {demo ? (
        <ChainCard>
          <Row>
            <div>
              <Small>ETAPA ACTUAL</Small>
              <strong>{STAGE_NAME[demo.currentStage]}</strong>
            </div>
            <Percent>{demo.progress}%</Percent>
          </Row>

          <Progress>
            <i style={{ width: `${demo.progress}%` }} />
          </Progress>

          <Meta>{demo.title}</Meta>
          <Meta>{demo.eventCount} DV enlazados</Meta>
          <Actors>
            {demo.participants.map((actor) => (
              <Actor key={actor.actorId}>{actor.actorName}</Actor>
            ))}
          </Actors>

          {demo.nextAction ? <Next>Próximo: {demo.nextAction}</Next> : null}
        </ChainCard>
      ) : (
        <Empty>
          Todavía no existe una cadena de prueba. Al iniciarla aparecerán la
          demanda, capacidades compatibles y la resonancia inicial.
        </Empty>
      )}

      <Primary type="button" onClick={action} disabled={busy}>
        {busy
          ? "Procesando..."
          : demo
          ? STEP_LABEL[demo.currentStage]
          : "Iniciar prueba del mueble"}
      </Primary>

      {message ? <Message>{message}</Message> : null}

      <Legend>
        <span>Persona</span>
        <b>→</b>
        <span>Diseño</span>
        <b>→</b>
        <span>Carpintería</span>
        <b>→</b>
        <span>Madera</span>
        <b>→</b>
        <span>Market</span>
      </Legend>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Hero = styled.div`
  padding: 16px;
  border-radius: 20px;
  color: #fff;
  background:
    radial-gradient(circle at 90% 10%, rgba(34, 197, 94, 0.45), transparent 34%),
    linear-gradient(135deg, #052e16, #0f172a 70%);

  h3 {
    margin: 5px 0 6px;
    font-size: 1.14rem;
  }

  p {
    margin: 0;
    opacity: 0.78;
    line-height: 1.4;
    font-size: 0.86rem;
  }
`;

const Eyebrow = styled.div`
  color: #86efac;
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.08em;
`;

const ChainCard = styled.div`
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  display: grid;
  gap: 8px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Small = styled.div`
  font-size: 0.67rem;
  font-weight: 950;
  opacity: 0.52;
`;

const Percent = styled.div`
  font-size: 1.3rem;
  font-weight: 950;
  color: #16a34a;
`;

const Progress = styled.div`
  height: 9px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #22c55e, #15ff00);
    transition: width 0.3s ease;
  }
`;

const Meta = styled.div`
  font-size: 0.82rem;
  opacity: 0.72;
`;

const Code = styled.code`
  display: block;
  padding: 8px;
  border-radius: 10px;
  background: #f1f5f9;
  font-size: 0.68rem;
  overflow-wrap: anywhere;
`;

const Actors = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const Actor = styled.span`
  padding: 5px 8px;
  border-radius: 999px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  font-size: 0.7rem;
  font-weight: 800;
`;

const Next = styled.div`
  padding: 9px 10px;
  border-radius: 12px;
  background: #f0fdf4;
  color: #166534;
  font-size: 0.78rem;
  font-weight: 850;
`;

const Empty = styled.div`
  padding: 14px;
  border-radius: 18px;
  border: 1px dashed rgba(0, 0, 0, 0.16);
  font-size: 0.84rem;
  line-height: 1.45;
  opacity: 0.72;
`;

const Primary = styled.button`
  border: 0;
  border-radius: 16px;
  padding: 13px 14px;
  background: #15ff00;
  color: #041007;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(21, 255, 0, 0.2);

  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
`;

const Message = styled.div`
  padding: 10px 12px;
  border-radius: 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
  font-size: 0.8rem;
  line-height: 1.4;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 10px;
  border-radius: 14px;
  background: #f8fafc;
  font-size: 0.67rem;

  span {
    font-weight: 850;
  }

  b {
    color: #16a34a;
  }
`;
