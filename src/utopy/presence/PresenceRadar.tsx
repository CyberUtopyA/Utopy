import React, { useMemo } from "react";
import styled from "styled-components";

const RadarWrap = styled.div`
  width: 180px;
  height: 180px;
  position: relative;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.04) 28%, transparent 29%),
    radial-gradient(circle at center, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.04) 52%, transparent 53%),
    radial-gradient(circle at center, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.03) 76%, transparent 77%),
    #fff;
`;

const Sweep = styled.div`
  position: absolute;
  inset: -10%;
  background: conic-gradient(
    from 0deg,
    rgba(34,197,94,0.00) 0deg,
    rgba(34,197,94,0.00) 300deg,
    rgba(34,197,94,0.18) 340deg,
    rgba(34,197,94,0.00) 360deg
  );
  animation: radar-spin 4s linear infinite;

  @keyframes radar-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const Center = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #16a34a;
  box-shadow: 0 0 0 8px rgba(34,197,94,0.10);
`;

const Dot = styled.div<{ x: number; y: number; size?: number }>`
  position: absolute;
  left: ${({ x }) => x}%;
  top: ${({ y }) => y}%;
  width: ${({ size }) => size || 10}px;
  height: ${({ size }) => size || 10}px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #111;
`;

const Label = styled.div`
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  opacity: 0.78;
  text-align: center;
`;

type PresenceLike = {
  actorId?: string | null;
  strength?: number | null;
};

function buildRadarPoints(items: PresenceLike[]) {
  return items.map((p, i) => {
    const strength = Math.max(0.15, Math.min(1, Number(p?.strength ?? 0.65)));
    const angle = (i / Math.max(1, items.length)) * Math.PI * 2;
    const radius = 14 + (1 - strength) * 24;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const size = 8 + Math.round(strength * 5);
    return { ...p, x, y, size };
  });
}

export default function PresenceRadar({
  meId,
  presences,
  minCount = 2,
}: {
  meId?: string | null;
  presences: PresenceLike[];
  minCount?: number;
}) {
  const others = useMemo(() => {
    return (presences || []).filter(
      (p) => String(p?.actorId || "") !== String(meId || "")
    );
  }, [presences, meId]);

  const points = useMemo(() => buildRadarPoints(others), [others]);

  if (others.length < minCount) return null;

  return (
    <div>
      <RadarWrap>
        <Sweep />
        <Center />
        {points.map((p, i) => (
          <Dot
            key={`${p.actorId || "presence"}:${i}`}
            x={p.x}
            y={p.y}
            size={p.size}
          />
        ))}
      </RadarWrap>
      <Label>
        {others.length === 1
          ? "1 presencia cercana"
          : `${others.length} presencias cercanas`}
      </Label>
    </div>
  );
}