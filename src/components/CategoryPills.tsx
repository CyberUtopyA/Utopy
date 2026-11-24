import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Grid2X2, Coffee, CupSoda, CakeSlice, Carrot, Utensils, ShoppingBasket, HeartPulse, Package, House, Shirt, Gem, Monitor, Sofa, Wrench } from "lucide-react";

const icons: Record<string, typeof Coffee> = { destacados: Grid2X2, todo: Grid2X2, salados: Utensils, comida: Utensils, "bebidas-calientes": Coffee, "bebidas-frias": CupSoda, dulces: CakeSlice, verduras: Carrot, super: ShoppingBasket, farmacia: HeartPulse, combos: Package, hogar: House, ropa: Shirt, accesorios: Gem, tech: Monitor, muebles: Sofa, servicios: Wrench };

type FalconCategory = {
  id: string;
  label?: string;
  title?: string;
};

type FalconSection = {
  slug?: string;
  categories: FalconCategory[];
};

export default function CategoryPills({ section }: { section: FalconSection }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const active = params.get("cat") || section.categories?.[0]?.id || "";

  function goTo(catId: string) {
    const next = new URLSearchParams(params);
    next.set("cat", catId);
    navigate(`?${next.toString()}`);
  }

  return (
    <section className="mx-auto max-w-7xl">
      <nav aria-label="Categorías" className="flex snap-x snap-mandatory gap-2 overflow-x-auto py-2 [scrollbar-width:none] sm:gap-3">
        {section.categories.map((cat) => {
          const label = cat.label || cat.title || cat.id;
          const isActive = active === cat.id;
          const Icon = icons[cat.id] || Grid2X2;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => goTo(cat.id)}
              aria-pressed={isActive}
              className={[
                "flex min-h-20 w-28 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-xs font-bold transition-colors motion-reduce:transition-none",
                "border shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-slate-100 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50",
              ].join(" ")}
            >
              <Icon size={23} strokeWidth={1.6} aria-hidden="true"/>{label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
