import styled from "styled-components";
import type { PresenceSignal } from "./presence.types";
import ResonanceOrb from "./ResonanceOrb";

const Wrap = styled.div`
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 92px;
  z-index: 9997;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

const Card = styled.div`
  width: min(620px, 100%);
  background:
    radial-gradient(circle at 10% 0%, rgba(159,140,255,.16), transparent 34%),
    rgba(247, 245, 255, 0.94);
  color: #211e2d;
  border: 1px solid rgba(93, 77, 136, 0.13);
  box-shadow: 0 20px 55px rgba(45, 36, 70, 0.2);
  border-radius: 24px;
  padding: 14px;
  backdrop-filter: blur(18px);
  pointer-events: auto;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const SignalHead = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 1rem;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.9rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  border: 1px solid rgba(66, 51, 105, 0.14);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  background: ${({ $primary }) => ($primary ? "#7160d7" : "rgba(255,255,255,.68)")};
  color: ${({ $primary }) => ($primary ? "#fff" : "#2b2540")};
  transition: transform .16s ease, box-shadow .16s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(76, 61, 120, 0.12);
  }
`;

type Props = {
  signal: PresenceSignal | null;
  onDismiss: () => void;
  onAction: (actionId: string) => void;
};

export default function PresenceOverlay({ signal, onDismiss, onAction }: Props) {
  if (!signal) return null;

  return (
    <Wrap>
      <Card>
        <Row>
          <SignalHead>
            <ResonanceOrb
              size={58}
              seed={signal.id}
              signature={signal.signature}
              strength={signal.strength}
            />
            <div>
              <Title>{signal.title}</Title>
              {signal.subtitle ? <Subtle>{signal.subtitle}</Subtle> : null}
              {signal.distanceLabel ? <Subtle>{signal.distanceLabel}</Subtle> : null}
            </div>
          </SignalHead>
          <Btn onClick={onDismiss}>Ocultar</Btn>
        </Row>

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
        </Actions>
      </Card>
    </Wrap>
  );
}
