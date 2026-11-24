// Presentation configuration, not identities or verified capability announcements.
export const LIVING_PILOTS = {
  encicar: {
    name: "Encicar", summary: "Taller mecánico vivo", icon: "🔧",
    modules: ["Hoy", "Vehículos", "Reparaciones", "Inventario", "Caja", "Clientes", "Pasaportes"],
    steps: ["Recepción", "Diagnóstico", "Presupuesto", "Aprobación", "Repuestos", "Reparación", "Pruebas", "Cobro", "Entrega"],
    capabilities: ["vehicle.receive", "vehicle.diagnose", "quote.prepare", "quote.approve", "inventory.reserve", "work.repair", "work.test", "payment.confirm", "delivery.confirm"],
    sample: "Preparar un presupuesto de reparación. Faltan vehículo, diagnóstico confirmado y autorización del cliente.",
  },
  "don-mencia": {
    name: "Don Mencia", summary: "Producción, empanadas y verduras", icon: "🌱",
    modules: ["Hoy", "Productos", "Lotes y cosechas", "Inventario", "Pedidos", "Entregas", "Caja", "Clientes"],
    steps: ["Oferta", "Reserva", "Aprobación", "Preparación", "Delivery", "Entrega", "Cobro"],
    capabilities: ["offer.prepare", "inventory.reserve", "order.approve", "work.prepare", "delivery.coordinate", "delivery.confirm", "payment.confirm"],
    sample: "Mañana tengo 40 empanadas de carne a 5.000 y 20 kilos de tomate a 8.000 el kilo",
  },
} as const;
export type PilotKey = keyof typeof LIVING_PILOTS;
