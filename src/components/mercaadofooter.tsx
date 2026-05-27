import React from "react";
import styled, { keyframes } from "styled-components";
import { PlusCircle } from "lucide-react";
import type { MercadoHeaderTab } from "./mercadoheader";

type Props = {
  tab: MercadoHeaderTab;
  onTab: (t: MercadoHeaderTab) => void;
};

const pulse = keyframes`
  0% { background-position: 0% 50%; transform: translateY(0); }
  50% { background-position: 100% 50%; transform: translateY(-1px); }
  100% { background-position: 0% 50%; transform: translateY(0); }
`;

const Wrap = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 14px;
  z-index: 45;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

const Inner = styled.div`
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.0);
`;

const CTA = styled.button<{ active?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 999px;
  padding: 12px 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  letter-spacing: -0.01em;

  background: linear-gradient(
    120deg,
    rgba(24, 255, 92, 0.95),
    rgba(255, 255, 255, 0.88),
    rgba(24, 255, 92, 0.9)
  );
  background-size: 220% 220%;
  animation: ${pulse} 3.1s ease-in-out infinite;

  box-shadow: ${({ active }) =>
    active ? "0 18px 40px rgba(0,0,0,0.16)" : "0 14px 34px rgba(0,0,0,0.12)"};

  &:hover {
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
  }
`;

const Badge = styled.span`
  opacity: 0.8;
  font-weight: 800;
  font-size: 0.9rem;
`;

export default function MercadoFooter({ tab, onTab }: Props) {
  const active = tab === "producir";
  return (
    <Wrap>
      <Inner>
        <CTA active={active} onClick={() => onTab("producir")} title="Producir / Vender">
          <PlusCircle size={18} />
          Producir / Vender <Badge>• nodo vivo</Badge>
        </CTA>
      </Inner>
    </Wrap>
  );
}
