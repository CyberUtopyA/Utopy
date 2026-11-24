import React, { useMemo } from "react";
import styled from "styled-components";
import type { ResonanceGeo } from "./resonance.types";

const RadarWrap = styled.div`
  width: 180px;
  height: 180px;
  position: relative;
  border-radius: 999px;
  border: 1px solid rgba(88, 70, 135, 0.12);
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(159,140,255,.13) 0%, rgba(159,140,255,.04) 28%, transparent 29%),
    radial-gradient(circle at center, rgba(91,72,145,.05) 0%, rgba(91,72,145,.05) 52%, transparent 53%),
    radial-gradient(circle at center, rgba(91,72,145,.04) 0%, rgba(91,72,145,.04) 76%, transparent 77%),
    #fbfaff;
`;

const Sweep = styled.div`
  position: absolute;
  inset: -10%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    transparent 300deg,
    rgba(159,140,255,.24) 340deg,
    transparent 360deg
  );
  animation: radar-spin 5s linear infinite;

  @keyframes radar-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
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
  background: #7160d7;
  box-shadow: 0 0 0 8px rgba(159,140,255,.14);
`;

const Dot = styled.div<{ x: number; y: number; size: number; $tone: string }>`
  position: absolute;
  left: ${({ x }) => x}%;
  top: ${({ y }) => y}%;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: ${({ $tone }) => $tone};
  box-shadow: 0 0 0 4px rgba(255,255,255,.5), 0 0 18px ${({ $tone }) => $tone};
`;

const Label = styled.div`
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  opacity: 0.74;
  text-align: center;
`;

type PresenceLike = {
  actorId?: string | null;
  strength?: number | null;
  geo?: ResonanceGeo | null;
  distanceKm?: number | null;
  signature?: string | null;
};

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function geoMetrics(from: ResonanceGeo, to: ResonanceGeo) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLng = radians(to.lng - from.lng);
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);

  const dLat = lat2 - lat1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { bearing, distance };
}

function buildRadarPoints(
  items: PresenceLike[],
  centerGeo?: ResonanceGeo | null,
  maxDistanceKm = 25
) {
  const tones = ["#9f8cff", "#7edbc2", "#ffc86b", "#ff9e91", "#73b9ff"];

  return items.map((presence, index) => {
    const strength = Math.max(0.15, Math.min(1, Number(presence.strength ?? 0.65)));
    const seed = hash(
      presence.signature || presence.actorId || `presence:${index}`
    );
    let angle = ((seed % 360) * Math.PI) / 180;
    let radius = 14 + (1 - strength) * 25;

    if (centerGeo && presence.geo) {
      const metrics = geoMetrics(centerGeo, presence.geo);
      angle = metrics.bearing - Math.PI / 2;
      radius = 8 + Math.min(1, metrics.distance / Math.max(0.1, maxDistanceKm)) * 37;
    }

    return {
      ...presence,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      size: 8 + Math.round(strength * 5),
      tone: tones[seed % tones.length],
    };
  });
}

export default function PresenceRadar({
  meId,
  presences,
  minCount = 2,
  centerGeo = null,
  maxDistanceKm = 25,
}: {
  meId?: string | null;
  presences: PresenceLike[];
  minCount?: number;
  centerGeo?: ResonanceGeo | null;
  maxDistanceKm?: number;
}) {
  const others = useMemo(
    () =>
      (presences || []).filter(
        (presence) => String(presence.actorId || "") !== String(meId || "")
      ),
    [presences, meId]
  );
  const points = useMemo(
    () => buildRadarPoints(others, centerGeo, maxDistanceKm),
    [centerGeo, maxDistanceKm, others]
  );

  if (others.length < minCount) return null;

  return (
    <div>
      <RadarWrap>
        <Sweep />
        <Center />
        {points.map((point, index) => (
          <Dot
            key={`${point.actorId || "presence"}:${index}`}
            x={point.x}
            y={point.y}
            size={point.size}
            $tone={point.tone}
          />
        ))}
      </RadarWrap>
      <Label>
        {others.length === 1
          ? "1 frecuencia viva cercana"
          : `${others.length} frecuencias vivas cercanas`}
      </Label>
    </div>
  );
}
