import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { ShoppingCart, Store, Package, Coins, LayoutGrid } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export type MercadoHeaderTab = "mercado" | "categorias" | "ofertas" | "producir";

type Props = {
  tab: MercadoHeaderTab;
  onTab: (t: MercadoHeaderTab) => void;

  status: "live" | "fallback" | "idle";
  activeCajeroName?: string;

  nsFilter: string;
  namespaces: string[];
  onNsFilter: (ns: string) => void;

  onOpenCart: () => void;
};


const gradientMove = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/* ================= LAYOUT ================= */

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 14px;

  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
`;

/* ================= IZQUIERDA ================= */

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
`;

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.1;
`;

const Subtle = styled.span`
  font-size: 0.82rem;
  opacity: 0.75;
`;

const NsSelect = styled.select`
  margin-left: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.18);

  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);

  color: #111;
  font-weight: 700;
  font-size: 0.85rem;

  outline: none;
  appearance: none;

  option {
    color: #111;
    background: #fff;
  }
`;

/* ================= CENTRO ================= */

const Center = styled.div`
  display: flex;
  justify-content: center;
`;

const CircleBar = styled.div`
  display: flex;
  gap: 14px;
  padding: 8px 14px;
  border-radius: 999px;

  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const CircleBtn = styled.button<{ active?: boolean }>`
  width: 54px;
  height: 54px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  position: relative;
  background: rgba(255, 255, 255, 0.75);
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &::before {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: linear-gradient(
      120deg,
      #19ff6a,
      #ffffff,
      #19ff6a
    );
    background-size: 220% 220%;
    animation: ${gradientMove} 3s ease infinite;
    opacity: ${({ active }) => (active ? 0.55 : 0.35)};
    z-index: 0;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 3px;
    border-radius: inherit;
    background: rgba(255, 255, 255, 0.85);
    z-index: 1;
  }

  svg {
    position: relative;
    z-index: 2;

    /* 🔥 ICONOS GRANDES DE VERDAD */
    width: 28px;
    height: 28px;
    stroke-width: 2.2;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.15);
  }
`;

/* ================= DERECHA ================= */

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CartBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.18);

  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-weight: 800;

  svg {
    width: 22px;
    height: 22px;
  }
`;

function statusText(status: Props["status"]) {
  if (status === "live") return "en vivo";
  if (status === "fallback") return "catálogo demo";
  return "inicializando";
}

export default function MercadoHeader({
  tab,
  onTab,
  status,
  activeCajeroName,
  nsFilter,
  namespaces,
  onNsFilter,
  onOpenCart,
}:
 Props) {
    const cartRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // expone el target para animación (desde cards)
    (window as any).__mtCartTargetEl = cartRef.current;
    return () => {
      if ((window as any).__mtCartTargetEl === cartRef.current) {
        (window as any).__mtCartTargetEl = null;
      }
    };
  }, []);
  return (
    <Bar>
      <Inner>
        {/* IZQUIERDA */}
        <Left>
          <Brand>
            <Store size={22} />
            <BrandText>
              <span>Mercado Local</span>
              <Subtle>
                Nodo MT · {statusText(status)} · Caja:{" "}
                {activeCajeroName || "sin turno"}
              </Subtle>
            </BrandText>
          </Brand>

          <NsSelect
            value={nsFilter}
            onChange={(e) => onNsFilter(e.target.value)}
          >
            <option value="__ALL__">Todos</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </NsSelect>
        </Left>

        {/* CENTRO */}
        <Center>
          <CircleBar>
            <CircleBtn
              active={tab === "mercado"}
              onClick={() => onTab("mercado")}
              title="Productos"
            >
              <Package color="black" />
            </CircleBtn>

            <CircleBtn
              active={tab === "categorias"}
              onClick={() => onTab("categorias")}
              title="Categorías"
            >
              <LayoutGrid color="black" />
            </CircleBtn>

            <CircleBtn
              active={tab === "ofertas"}
              onClick={() => onTab("ofertas")}
              title="Ofertas"
            >
              <Coins color="black" />
            </CircleBtn>
          </CircleBar>
        </Center>

        {/* DERECHA */}
        <Right>
          <ConnectButton chainStatus={{ smallScreen: "icon", largeScreen: "full" }} />
          <CartBtn ref={cartRef} onClick={onOpenCart}>
            <ShoppingCart color="black"/> 
          </CartBtn>
        </Right>
      </Inner>
    </Bar>
  );
}
