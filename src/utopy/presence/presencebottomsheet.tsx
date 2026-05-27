import React from "react";
import styled from "styled-components";
import type { PresenceSignal } from "./presence.types";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9998;
`;

const Sheet = styled.div`
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
  border: 1px solid rgba(0,0,0,0.08);
  padding: 14px;
`;

const Title = styled.div`
  font-weight: 950;
`;

const Subtle = styled.div`
  opacity: 0.72;
  font-size: 0.9rem;
`;

const Actions = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 11px 12px;
  cursor: pointer;
  font-weight: 900;
  background: ${({ kind }) => (kind === "solid" ? "#111" : "#fff")};
  color: ${({ kind }) => (kind === "solid" ? "#fff" : "#111")};
`;

type Props = {
  open: boolean;
  signal: PresenceSignal | null;
  onClose: () => void;
  onAction: (actionId: string) => void;
};

export default function PresenceBottomSheet({
  open,
  signal,
  onClose,
  onAction,
}: Props) {
  if (!open || !signal) return null;

  return (
    <>
      <Backdrop onClick={onClose} />
      <Sheet>
        <Title>{signal.title}</Title>
        {signal.subtitle ? <Subtle style={{ marginTop: 4 }}>{signal.subtitle}</Subtle> : null}
        {signal.description ? <Subtle style={{ marginTop: 8 }}>{signal.description}</Subtle> : null}

        <Actions>
          {signal.actions.map((a) => (
            <Btn key={a.id} kind="solid" onClick={() => onAction(a.id)}>
              {a.label}
            </Btn>
          ))}
          <Btn kind="ghost" onClick={onClose}>
            Cerrar
          </Btn>
        </Actions>
      </Sheet>
    </>
  );
}