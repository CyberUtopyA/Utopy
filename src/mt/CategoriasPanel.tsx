import React, { useMemo, useState } from "react";
import LiveProductCard from "../components/LiveProductCard";
import { formatUniversalMoney, projectUniversalProduct } from "../components/UniversalProductDialog";
import { resolveLiveImage, resolveLiveSeller } from "./livePresentation";
import type { MtProduct } from "./mt.traitAdapter";

type Props = {
  products: MtProduct[];
  allLive?: any[];
  nsFilter: string;
  onAddToCart: (product: MtProduct) => void;
  onCheckout: (product: MtProduct) => void;
  onOpenProduct?: (product: MtProduct) => void;
};

type CategoryGroup = {
  id: string;
  label: string;
  icon: string;
  products: MtProduct[];
  image: string;
};

function normalized(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(mt:)?cat[.:]/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function humanCategory(value: string): string {
  const aliases: Record<string, string> = {
    cafe: "Café",
    coffee: "Café",
    furniture: "Muebles",
    muebles: "Muebles",
    hogar: "Hogar",
    home: "Hogar",
    comida: "Comida",
    food: "Comida",
    bebidas: "Bebidas",
    materials: "Materiales",
    material: "Materiales",
    materiales: "Materiales",
    technology: "Tecnología",
    tecnologia: "Tecnología",
    services: "Servicios",
    servicios: "Servicios",
    properties: "Propiedades",
    propiedades: "Propiedades",
    production: "Producción",
    produccion: "Producción",
  };
  return aliases[value] || value.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function categoryIcon(value: string): string {
  if (/mueble|furniture/.test(value)) return "🪑";
  if (/comida|food|cafe|bebida/.test(value)) return "☕";
  if (/material/.test(value)) return "🪵";
  if (/hogar|home/.test(value)) return "🏠";
  if (/tecn|tech/.test(value)) return "💡";
  if (/servic/.test(value)) return "🛠️";
  if (/prop/.test(value)) return "🏙️";
  if (/produc/.test(value)) return "🏭";
  return "✦";
}

function categoryIds(product: MtProduct): string[] {
  const attrs = product.attrs || {};
  const raw = [
    product.meta?.cat,
    ...(product.meta?.categorias || []),
    attrs.category,
    attrs.categoria,
    ...(Array.isArray(attrs.categories) ? attrs.categories : []),
    ...(product.tags || []).filter((tag) => /^(mt:)?cat[.:]/i.test(tag)),
  ];
  return Array.from(new Set(raw.map(normalized).filter(Boolean)));
}

function subcategoryOf(product: MtProduct): string {
  return normalized(product.attrs?.subcategory || product.attrs?.subcategoria || "");
}

function displayPrice(product: MtProduct): string {
  const amount = Number(product.precio || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Consultar";
  const currency = String(product.attrs?.currency || product.meta?.currency || "PYG");
  return currency === "PYG"
    ? `₲ ${amount.toLocaleString("es-PY")}`
    : `${amount.toLocaleString("es-PY")} ${currency}`;
}

export default function CategoriasPanel({ products, allLive = [], nsFilter, onCheckout, onOpenProduct }: Props) {
  const [activeCategory, setActiveCategory] = useState("");
  const [activeSubcategory, setActiveSubcategory] = useState("");

  const groups = useMemo<CategoryGroup[]>(() => {
    const byId = new Map<string, MtProduct[]>();
    for (const product of products) {
      for (const id of categoryIds(product)) {
        byId.set(id, [...(byId.get(id) || []), product]);
      }
    }
    return Array.from(byId.entries())
      .map(([id, categoryProducts]) => ({
        id,
        label: humanCategory(id),
        icon: categoryIcon(id),
        products: categoryProducts,
        image:
          categoryProducts
            .map((product) => resolveLiveImage(product, allLive) || product.imagen || "")
            .find(Boolean) || "",
      }))
      .sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label));
  }, [allLive, products]);

  const activeGroup = groups.find((group) => group.id === activeCategory) || null;
  const subcategories = useMemo(
    () => Array.from(new Set((activeGroup?.products || []).map(subcategoryOf).filter(Boolean))),
    [activeGroup],
  );
  const visibleProducts = (activeGroup?.products || []).filter(
    (product) => !activeSubcategory || subcategoryOf(product) === activeSubcategory,
  );

  if (activeGroup) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <button type="button" onClick={() => { setActiveCategory(""); setActiveSubcategory(""); }} className="mb-2 text-sm font-bold text-slate-500 transition hover:text-slate-950">
              ← Categorías
            </button>
            <h2 className="text-2xl font-black text-slate-950">{activeGroup.label}</h2>
          </div>
          <span className="text-sm font-semibold text-slate-500">{visibleProducts.length} disponibles</span>
        </div>

        {subcategories.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setActiveSubcategory("")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${!activeSubcategory ? "border-cyan-300 bg-cyan-100" : "border-slate-200 bg-white"}`}>Todos</button>
            {subcategories.map((subcategory) => (
              <button key={subcategory} type="button" onClick={() => setActiveSubcategory(subcategory)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${activeSubcategory === subcategory ? "border-cyan-300 bg-cyan-100" : "border-slate-200 bg-white"}`}>
                {humanCategory(subcategory)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {visibleProducts.map((product) => {
            const view = projectUniversalProduct(product, {
              title: product.nombre,
              seller: resolveLiveSeller(product, allLive),
              image: resolveLiveImage(product, allLive) || product.imagen,
            });
            return <LiveProductCard
              key={product.id}
              title={view.title}
              seller={view.seller}
              price={formatUniversalMoney(view.finalPrice, view.currency)}
              previousPrice={view.basePrice ? formatUniversalMoney(view.basePrice, view.currency) : null}
              discountPct={view.discountPct}
              discountLabel={view.discountAmount ? `Ahorrás ${formatUniversalMoney(view.discountAmount, view.currency)}` : null}
              installmentLabel={view.installmentCount && view.installmentValue ? `🗓 Hasta ${view.installmentCount} cuotas de ${formatUniversalMoney(view.installmentValue, view.currency)}` : null}
              image={view.image}
              actionLabel="Ver"
              onAction={() => (onOpenProduct ? onOpenProduct(product) : onCheckout(product))}
            />;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Categorías</h2>
          <p className="text-sm text-slate-500">Explorá el Mercado Vivo</p>
        </div>
        {nsFilter !== "__ALL__" ? <span className="text-xs font-semibold text-slate-400">Selección activa</span> : null}
      </div>

      {groups.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {groups.map((group) => (
            <button key={group.id} type="button" onClick={() => setActiveCategory(group.id)} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)]">
              <div className="h-36 bg-slate-100">
                {group.image ? <img src={group.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-4xl">{group.icon}</div>}
              </div>
              <div className="p-4">
                <h3 className="font-black text-slate-950">{group.label}</h3>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500"><span>{group.products.length} vivos</span><span>→</span></div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-500">Todavía no hay categorías publicadas.</div>
      )}
    </div>
  );
}
