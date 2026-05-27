export type FalconCategory = {
  id: string;
  label: string;
  description: string;
};

export type FalconSection = {
  key: "store" | "skylines" | "daily" | "capital";
  label: string;
  icon: string;
  path: string;
  subtitle: string;
  categories: FalconCategory[];
};

export const FALCON_SECTIONS: FalconSection[] = [
  {
    key: "store",
    label: "Store",
    icon: "🛍️",
    path: "/store",
    subtitle: "Storefront curado de MS Market",
    categories: [
      {
        id: "destacados",
        label: "Destacados",
        description: "Selección premium y ofertas visibles.",
      },
      {
        id: "shopping",
        label: "Shopping Itaipú",
        description: "Productos del shopping y frontera curados.",
      },
      {
        id: "muebles",
        label: "Muebles",
        description: "Mueblería local y piezas del tío.",
      },
      {
        id: "hogar",
        label: "Hogar",
        description: "Casa, organización y utilidades.",
      },
      {
        id: "tech",
        label: "Tecnología",
        description: "Electrónica y gadgets más vendidos.",
      },
    ],
  },
  {
    key: "skylines",
    label: "Skylines",
    icon: "🏙️",
    path: "/skylines",
    subtitle: "Propiedades, alquileres y aterrizaje en Paraguay",
    categories: [
      {
        id: "alquileres",
        label: "Alquileres",
        description: "Alquiler temporal y largo plazo.",
      },
      {
        id: "estudiantes",
        label: "Estudiantes",
        description: "Enfoque medicina, extranjeros y residencia.",
      },
      {
        id: "compra",
        label: "Compra/Venta",
        description: "Casas, terrenos y oportunidades.",
      },
      {
        id: "concierge",
        label: "Concierge",
        description: "Llegada, instalación y soporte.",
      },
      {
        id: "premium",
        label: "Premium",
        description: "Propiedades destacadas e inversión.",
      },
    ],
  },
  {
    key: "daily",
    label: "Daily",
    icon: "🛵",
    path: "/daily",
    subtitle: "Comida, super, farmacia y vida diaria",
    categories: [
      {
        id: "comida",
        label: "Comida",
        description: "Pedidos rápidos y delivery local.",
      },
      {
        id: "super",
        label: "Super",
        description: "Compras diarias y canastas.",
      },
      {
        id: "farmacia",
        label: "Farmacia",
        description: "Farmacia y bienestar.",
      },
      {
        id: "combos",
        label: "Combos",
        description: "Combos para extranjeros y estudiantes.",
      },
      {
        id: "recurrente",
        label: "Recurrente",
        description: "Reposición automática y suscripciones.",
      },
    ],
  },
  {
    key: "capital",
    label: "Capital",
    icon: "📈",
    path: "/capital",
    subtitle: "Inversión, negocios y oportunidades",
    categories: [
      {
        id: "yield",
        label: "Rental Yield",
        description: "Rentas y retornos potenciales.",
      },
      {
        id: "inversion",
        label: "Inversión",
        description: "Activos estratégicos y propiedades.",
      },
      {
        id: "negocios",
        label: "Negocios",
        description: "Locales, franquicias y alianzas.",
      },
      {
        id: "partners",
        label: "Partners",
        description: "Socios y empresarios.",
      },
      {
        id: "premium",
        label: "Premium",
        description: "Oportunidades destacadas de alto ticket.",
      },
    ],
  },
];

export function getFalconSection(
  key: string | undefined
): FalconSection {
  return FALCON_SECTIONS.find((s) => s.key === key) ?? FALCON_SECTIONS[0];
}