import { buildValueNeedDV } from "./value.builders";

export type ValueDemoKind = "coffee" | "furniture";

export function buildValueDemoNeed(kind: ValueDemoKind) {
  if (kind === "coffee") {
    return buildValueNeedDV({
      needKey: "produccion-cafe-prueba",
      nodeId: "utopy.node.lapiedra.coffee",
      nodeName: "LaPiedra Coffee",
      title: "Producir más café juntos",
      purpose:
        "Probar cómo materiales, equipamiento, entregas y compras anticipadas forman una capacidad productiva.",
      requirements: [
        {
          key: "cafe.insumo",
          label: "Café e insumos",
          kind: "material",
          amount: 20,
          unit: "kg",
        },
        {
          key: "cafe.equipo",
          label: "Equipo disponible",
          kind: "equipment",
          amount: 1,
          unit: "equipo",
        },
        {
          key: "cafe.entregas",
          label: "Entregas locales",
          kind: "logistics",
          amount: 10,
          unit: "entregas",
        },
        {
          key: "cafe.preventa",
          label: "Compras anticipadas",
          kind: "customer_commitment",
          amount: 30,
          unit: "pedidos",
        },
      ],
      simulation: true,
      scopes: ["public", "demo:aportes-vivos"],
    });
  }

  return buildValueNeedDV({
    needKey: "mueble-comunitario-prueba",
    nodeId: "utopy.node.decohogar",
    nodeName: "DecoHogar",
    title: "Crear muebles con capacidades locales",
    purpose:
      "Probar cómo material, fabricación, entregas y pedidos reales pueden producir juntos.",
    requirements: [
      {
        key: "mueble.madera",
        label: "Madera y materiales",
        kind: "material",
        amount: 50,
        unit: "m²",
      },
      {
        key: "mueble.fabricacion",
        label: "Trabajo de fabricación",
        kind: "work",
        amount: 20,
        unit: "horas",
      },
      {
        key: "mueble.entrega",
        label: "Entregas",
        kind: "logistics",
        amount: 5,
        unit: "entregas",
      },
      {
        key: "mueble.preventa",
        label: "Pedidos anticipados",
        kind: "customer_commitment",
        amount: 5,
        unit: "pedidos",
      },
    ],
    simulation: true,
    scopes: ["public", "demo:aportes-vivos"],
  });
}

