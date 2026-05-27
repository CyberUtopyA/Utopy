// src/mt/CategoriasPanel.tsx
// Panel de categorías vivas (lado MS web), sin tocar el nodo MT.

import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { ShoppingCart, Coins, LayoutGrid } from "lucide-react";
import type { MtProduct } from "./mt.traitAdapter";

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.9rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const Img = styled.img`
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  background: #f2f2f2;
`;

const Title = styled.div`
  font-weight: 700;
  margin-top: 8px;
`;

const Price = styled.div`
  font-weight: 700;
  margin-top: 6px;
`;

const NsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #f6f6f6;
  margin-top: 6px;
  color: #333;
`;

const CatBadge = styled.button<{ active?: boolean }>`
  border-radius: 999px;
  border: 1px solid ${({ active }) => (active ? "#22c55e" : "rgba(0,0,0,0.12)")};
  background: ${({ active }) => (active ? "#dcfce7" : "#fff")};
  color: #111;
  padding: 6px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 4px 6px 0;
`;

const SmallBtn = styled.button`
  margin-top: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 8px 10px;
  background: #15ff00ff;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

// Mismo criterio que usamos en MercadoLocal / Checkout
function labelCategoria(catId: string): string {
  if (catId === "mt:cat.muebles") return "Muebles";
  if (catId === "mt:cat.frutas") return "Frutas";
  if (catId === "mt:cat.verduras") return "Verduras";
  if (catId === "mt:cat.dulces") return "Dulces / Golosinas";
  if (catId === "mt:cat.bebidas") return "Bebidas";
  if (catId === "mt:cat.energia") return "Energía";
  if (catId === "mt:cat.otro") return "Otros";
  const last = catId.split(".").pop() || catId;
  return last.replace(/^mt:cat\./, "").replace(/_/g, " ");
}

type Props = {
  products: MtProduct[]; // ya filtrados por ns desde MercadoLocal
  nsFilter: string;
  onAddToCart: (p: MtProduct) => void;
  onCheckout: (p: MtProduct) => void;
};

const CategoriasPanel: React.FC<Props> = ({
  products,
  nsFilter,
  onAddToCart,
  onCheckout,
}) => {
  const [catFilter, setCatFilter] = useState<string>("__ALL__");

  // Categorías vivas detectadas en los productos
  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const meta = p.meta || {};
      if (meta.cat) set.add(String(meta.cat));
      if (Array.isArray(meta.categorias)) {
        for (const c of meta.categorias) set.add(String(c));
      }
    }
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (catFilter === "__ALL__") return true;
        const meta = p.meta || {};
        if (meta.cat === catFilter) return true;
        if (Array.isArray(meta.categorias) && meta.categorias.includes(catFilter)) {
          return true;
        }
        return false;
      }),
    [products, catFilter]
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <SectionHeader>
        <LayoutGrid size={18} />
        <div style={{ fontWeight: 700 }}>Categorías vivas</div>
      </SectionHeader>

      <Subtle>
        Detectadas automáticamente a partir de los productos resonados. No hay
        categorías fijas en el código, solo señales semánticas.
      </Subtle>

      <div style={{ marginTop: 6, marginBottom: 6 }}>
        <CatBadge
          active={catFilter === "__ALL__"}
          onClick={() => setCatFilter("__ALL__")}
        >
          Todas
        </CatBadge>
        {categorias.map((c) => (
          <CatBadge
            key={c}
            active={catFilter === c}
            onClick={() => setCatFilter(c)}
          >
            {labelCategoria(c)}
          </CatBadge>
        ))}
      </div>

      {nsFilter !== "__ALL__" && (
        <Subtle style={{ marginBottom: 10 }}>
          Namespace: <b>{nsFilter}</b>
        </Subtle>
      )}

      <Grid>
        {filtered.map((p) => (
          <Card key={p.id}>
            <Img src={p.imagen || "/placeholder.png"} alt={p.nombre} />
            <Title>{p.nombre}</Title>
            <Subtle>
              {p.unidad || "u"} · Stock: {p.stock ?? "—"}
            </Subtle>

            <div style={{ marginTop: 4 }}>
              {p.meta?.cat && (
                <NsBadge title="Categoría principal">
                  {labelCategoria(p.meta.cat)}
                </NsBadge>
              )}
              {Array.isArray(p.meta?.categorias) &&
                p.meta?.categorias
                  .filter((c) => c !== p.meta?.cat)
                  .map((c) => (
                    <NsBadge key={c} title="Categoría adicional">
                      {labelCategoria(c)}
                    </NsBadge>
                  ))}
            </div>

            {typeof p.precio === "number" && (
              <Price>
                {p.precio} {p.meta?.token?.symbol || "BNB"}
              </Price>
            )}

            <SmallBtn onClick={() => onAddToCart(p)}>
              <ShoppingCart size={16} /> Agregar
            </SmallBtn>
            <SmallBtn onClick={() => onCheckout(p)}>
              <Coins size={16} /> Comprar
            </SmallBtn>
          </Card>
        ))}
      </Grid>
    </div>
  );
};

export default CategoriasPanel;
