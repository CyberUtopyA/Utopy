import {
  approximateGeo,
  buildLiveProfileDV,
  buildLiveSignalDV,
  capabilityFromHumanText,
} from "./liveNetwork.builders";

function demoDV(dv: any) {
  return {
    ...dv,
    traits: [...(dv.traits || []), "demo:live-network"],
    meta: {
      ...(dv.meta || {}),
      simulation: true,
      nonCommercial: true,
      source: "utopy.live-network.demo",
    },
  };
}

export function buildLiveNetworkDemoDVs(
  actorId = "actor:local",
  actorName = "Mi Perfil Vivo",
) {
  const geo = approximateGeo(-24.0676, -54.3101, "demo");
  const need = demoDV(
    buildLiveSignalDV({
      actorId,
      actorName,
      nodeId: actorId,
      mode: "need",
      text: "Quiero un mueble sencillo a medida",
      category: "Crear y reparar",
      geo,
    }),
  );

  const capableProfile = demoDV(
    buildLiveProfileDV({
      actorId: "actor:demo:creator",
      actorName: "Nodo creador de prueba",
      nodeId: "node:demo:creator",
      bio: "Puede crear objetos a medida.",
      capabilities: [
        capabilityFromHumanText(
          "Fabricación de muebles a medida",
          "Crear y reparar",
        ),
      ],
      availableNow: true,
      geo,
    }),
  );

  const capableSignal = demoDV(
    buildLiveSignalDV({
      actorId: "actor:demo:creator",
      actorName: "Nodo creador de prueba",
      nodeId: "node:demo:creator",
      mode: "available",
      text: "Puedo fabricar muebles a medida",
      category: "Crear y reparar",
      geo,
    }),
  );

  const unrelatedSignal = demoDV(
    buildLiveSignalDV({
      actorId: "actor:demo:unrelated",
      actorName: "Nodo no relacionado",
      nodeId: "node:demo:unrelated",
      mode: "available",
      text: "Servicios de cuidado personal disponibles",
      category: "Cuidado personal",
      geo,
    }),
  );

  return {
    need,
    focusId: need.id,
    dvs: [need, capableProfile, capableSignal, unrelatedSignal],
  };
}

