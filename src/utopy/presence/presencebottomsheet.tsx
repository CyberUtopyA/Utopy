import React from "react";
import styled from "styled-components";
import type { PresenceSignal } from "./presence.types";
import ResonanceOrb from "./ResonanceOrb";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(28, 23, 42, 0.34);
  backdrop-filter: blur(3px);
  z-index: 9998;
`;

const Sheet = styled.div`
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  background:
    radial-gradient(circle at 10% 0%, rgba(159,140,255,.18), transparent 36%),
    #fbfaff;
  border-radius: 24px;
  box-shadow: 0 20px 64px rgba(45, 36, 70, 0.24);
  border: 1px solid rgba(93, 77, 136, 0.12);
  padding: 14px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Title = styled.div`
  color: #211e2d;
  font-weight: 950;
`;

const Subtle = styled.div`
  color: #211e2d;
  opacity: 0.7;
  font-size: 0.9rem;
`;

const Actions = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  border: 1px solid rgba(66, 51, 105, 0.14);
  border-radius: 14px;
  padding: 12px;
  cursor: pointer;
  font-weight: 900;
  background: ${({ $primary }) => ($primary ? "#7160d7" : "#fff")};
  color: ${({ $primary }) => ($primary ? "#fff" : "#2b2540")};
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
      <Sheet role="dialog" aria-modal="true" aria-label={signal.title}>
        <Head>
          <ResonanceOrb
            size={62}
            seed={signal.id}
            signature={signal.signature}
            strength={signal.strength}
          />
          <div>
            <Title>{signal.title}</Title>
            {signal.subtitle ? <Subtle>{signal.subtitle}</Subtle> : null}
            {signal.distanceLabel ? <Subtle>{signal.distanceLabel}</Subtle> : null}
          </div>
        </Head>

        {signal.description ? (
          <Subtle style={{ marginTop: 8 }}>{signal.description}</Subtle>
        ) : null}

        <Actions>
          {signal.actions.map((action, index) => (
            <Btn
              key={action.id}
              $primary={index === 0}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </Btn>
          ))}
          <Btn onClick={onClose}>Cerrar</Btn>
        </Actions>
      </Sheet>
    </>
  );
}
