// src/mt/mt.furnitureDemo.ts
// Escenario local de prueba: diseño → producción → material → entrega → instalación.

import {
  publishUniversalSignal,
  type UniversalSignalInput,
} from "./mt.signalProtocol";

type DemoLocation = UniversalSignalInput["location"];

export type FurnitureDemoInput = {
  actorId?: string;
  actorName?: string;
  location?: DemoLocation;
};

export async function runFurnitureLiveDemo(
  input: FurnitureDemoInput = {}
) {
  const actorId = input.actorId || "actor:demo:buyer";
  const actorName = input.actorName || "Persona interesada";
  const shared = {
    location: input.location || null,
    scopes: ["public", "demo:furniture"],
  };

  const root = await publishUniversalSignal({
    ...shared,
    mode: "need",
    category: "design",
    title: "Quiero diseñar un mueble a medida",
    text: "Necesito una mesa pequeña de madera para mi sala.",
    actorId,
    actorName,
    objectType: "mueble mesa",
    material: "madera",
    quantity: 1,
    unit: "u",
    sourceApp: "utopy:demo:furniture:design-need",
  });

  const relation = {
    threadId: root.threadId,
    chainId: root.chainId,
    rootDvId: root.dv.id,
  };

  const designOffer = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: root.dv,
    mode: "offer",
    category: "design",
    title: "Diseño de mesa de madera a medida",
    text: "Puedo preparar el diseño, medidas y presupuesto.",
    actorId: "node:demo:design",
    actorName: "Nodo de diseño",
    nodeId: "node:demo:design",
    designId: "design:demo:mesa",
    objectType: "mueble mesa",
    material: "madera",
    quantity: 1,
    unit: "u",
    price: 80_000,
    sourceApp: "utopy:demo:furniture:design-offer",
  });

  const productionNeed = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: designOffer.dv,
    parentDvId: designOffer.dv.id,
    mode: "need",
    category: "fabrication",
    title: "Necesito fabricar la mesa diseñada",
    text: "Busco capacidad para cortar, ensamblar y terminar una mesa de madera.",
    actorId,
    actorName,
    designId: "design:demo:mesa",
    objectType: "mueble mesa",
    material: "madera",
    quantity: 1,
    unit: "u",
    sourceApp: "utopy:demo:furniture:production-need",
  });

  const productionOffer = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: productionNeed.dv,
    parentDvId: productionNeed.dv.id,
    mode: "offer",
    category: "fabrication",
    title: "Fabricación y ensamblado de muebles",
    text: "Puedo fabricar esta mesa a partir del diseño y preparar el acabado.",
    actorId: "node:demo:production",
    actorName: "Nodo productor",
    nodeId: "node:demo:production",
    designId: "design:demo:mesa",
    objectType: "mueble mesa",
    material: "madera",
    quantity: 1,
    unit: "u",
    price: 420_000,
    sourceApp: "utopy:demo:furniture:production-offer",
  });

  const materialNeed = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: productionOffer.dv,
    parentDvId: productionOffer.dv.id,
    mode: "need",
    category: "material",
    title: "Necesito madera para fabricar la mesa",
    text: "Necesito madera preparada para cortar y ensamblar el mueble.",
    actorId: "node:demo:production",
    actorName: "Nodo productor",
    nodeId: "node:demo:production",
    designId: "design:demo:mesa",
    objectType: "mueble mesa",
    material: "madera",
    quantity: 8,
    unit: "m",
    sourceApp: "utopy:demo:furniture:material-need",
  });

  const materialOffer = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: materialNeed.dv,
    parentDvId: materialNeed.dv.id,
    mode: "offer",
    category: "material",
    title: "Madera preparada para muebles",
    text: "Tengo madera disponible y puedo prepararla para entrega.",
    actorId: "node:demo:materials",
    actorName: "Nodo de materiales",
    nodeId: "node:demo:materials",
    material: "madera",
    quantity: 20,
    unit: "m",
    price: 35_000,
    sourceApp: "utopy:demo:furniture:material-offer",
  });

  const deliveryNeed = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: materialOffer.dv,
    parentDvId: materialOffer.dv.id,
    mode: "need",
    category: "transport",
    title: "Necesito entregar el mueble terminado",
    text: "Necesito retirar la mesa del lugar de producción y llevarla al hogar.",
    actorId,
    actorName,
    objectType: "mueble mesa",
    quantity: 1,
    unit: "u",
    sourceApp: "utopy:demo:furniture:delivery-need",
  });

  const deliveryOffer = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: deliveryNeed.dv,
    parentDvId: deliveryNeed.dv.id,
    mode: "offer",
    category: "transport",
    title: "Retiro y entrega local de objetos",
    text: "Puedo retirar y entregar el mueble coordinando por el hilo.",
    actorId: "node:demo:delivery",
    actorName: "Nodo de entregas",
    nodeId: "node:demo:delivery",
    objectType: "mueble mesa",
    quantity: 1,
    unit: "servicio",
    price: 70_000,
    sourceApp: "utopy:demo:furniture:delivery-offer",
  });

  const installationNeed = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: deliveryOffer.dv,
    parentDvId: deliveryOffer.dv.id,
    mode: "need",
    category: "installation",
    title: "Necesito instalar y ajustar el mueble",
    text: "Necesito medir, montar y dejar la mesa lista en el hogar.",
    actorId,
    actorName,
    objectType: "mueble mesa",
    quantity: 1,
    unit: "servicio",
    sourceApp: "utopy:demo:furniture:installation-need",
  });

  const installationOffer = await publishUniversalSignal({
    ...shared,
    ...relation,
    sourceDV: installationNeed.dv,
    parentDvId: installationNeed.dv.id,
    mode: "offer",
    category: "installation",
    title: "Montaje e instalación en el lugar",
    text: "Puedo medir, montar y ajustar el objeto en el hogar.",
    actorId: "node:demo:installation",
    actorName: "Nodo de instalación",
    nodeId: "node:demo:installation",
    objectType: "mueble mesa",
    quantity: 1,
    unit: "servicio",
    price: 90_000,
    sourceApp: "utopy:demo:furniture:installation-offer",
  });

  const published = [
    root,
    designOffer,
    productionNeed,
    productionOffer,
    materialNeed,
    materialOffer,
    deliveryNeed,
    deliveryOffer,
    installationNeed,
    installationOffer,
  ];

  return {
    threadId: root.threadId,
    chainId: root.chainId,
    dvs: published.map((item) => item.dv),
    needs: published.filter((item) => item.dv.kind === "work.intent").length,
    offers: published.filter((item) => item.dv.kind === "mt.offer").length,
  };
}
