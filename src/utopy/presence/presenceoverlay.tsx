import styled from "styled-components";
import type { PresenceSignal } from "./presence.types";

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
  width: min(560px, 100%);
  background: rgba(12, 12, 14, 0.88);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 18px 50px rgba(0,0,0,0.32);
  border-radius: 20px;
  padding: 14px;
  backdrop-filter: blur(14px);
  pointer-events: auto;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 1rem;
`;

const Subtle = styled.div`
  opacity: 0.72;
  font-size: 0.9rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  background: ${({ kind }) => (kind === "solid" ? "#fff" : "transparent")};
  color: ${({ kind }) => (kind === "solid" ? "#111" : "#fff")};
`;

type Props = {
  signal: PresenceSignal | null;
  onDismiss: () => void;
  onAction: (actionId: string) => void;
};

export default function PresenceOverlay({
  signal,
  onDismiss,
  onAction,
}: Props) {
  if (!signal) return null;

  return (
    <Wrap>
      <Card>
        <Row>
          <div>
            <Title>{signal.title}</Title>
            {signal.subtitle ? <Subtle>{signal.subtitle}</Subtle> : null}
          </div>
          <Btn kind="ghost" onClick={onDismiss}>
            Ocultar
          </Btn>
        </Row>

        {signal.description ? (
          <Subtle style={{ marginTop: 8 }}>{signal.description}</Subtle>
        ) : null}

        <Actions>
          {signal.actions.map((a) => (
            <Btn key={a.id} kind="solid" onClick={() => onAction(a.id)}>
              {a.label}
            </Btn>
          ))}
        </Actions>
      </Card>
    </Wrap>
  );
}