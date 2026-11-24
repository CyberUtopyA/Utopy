import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { makeResonanceVisualSignature } from "./resonance.signature";

const expand = keyframes`
  0% { transform: scale(.42); opacity: .72; }
  72% { opacity: .12; }
  100% { transform: scale(1.5); opacity: 0; }
`;

const breathe = keyframes`
  0%, 100% { transform: scale(.92); filter: saturate(.9); }
  50% { transform: scale(1.06); filter: saturate(1.14); }
`;

const Shell = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
`;

const Ring = styled.span<{
  $delay: number;
  $duration: number;
  $tone: string;
  $active: boolean;
}>`
  position: absolute;
  inset: 7%;
  border-radius: 999px;
  border: 1.5px solid ${({ $tone }) => $tone};
  box-shadow: 0 0 22px ${({ $tone }) => $tone};
  opacity: ${({ $active }) => ($active ? 0.62 : 0.16)};
  animation: ${({ $active }) => ($active ? expand : "none")}
    ${({ $duration }) => $duration}ms ease-out infinite;
  animation-delay: ${({ $delay }) => $delay}ms;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Core = styled.span<{
  $tone: string;
  $duration: number;
  $active: boolean;
}>`
  width: 44%;
  height: 44%;
  position: relative;
  border-radius: 42% 58% 52% 48% / 48% 44% 56% 52%;
  background:
    radial-gradient(circle at 32% 28%, rgba(255,255,255,.92), transparent 24%),
    ${({ $tone }) => $tone};
  box-shadow:
    0 0 0 5px rgba(255,255,255,.32),
    0 8px 28px ${({ $tone }) => $tone};
  animation: ${({ $active }) => ($active ? breathe : "none")}
    ${({ $duration }) => $duration}ms ease-in-out infinite;

  &::after {
    content: "";
    position: absolute;
    width: 24%;
    height: 24%;
    right: 14%;
    bottom: 12%;
    border-radius: 999px;
    background: rgba(255,255,255,.84);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const TONES = ["#9f8cff", "#7edbc2", "#ffc86b", "#ff9e91", "#73b9ff"];

export default function ResonanceOrb({
  seed,
  signature,
  size = 64,
  strength = 0.8,
  active = true,
  label = "Señal Viva activa",
}: {
  seed?: string;
  signature?: string | null;
  size?: number;
  strength?: number;
  active?: boolean;
  label?: string;
}) {
  const visual = useMemo(
    () => makeResonanceVisualSignature(signature || seed || "utopy"),
    [seed, signature]
  );
  const tone = TONES[visual.hueIndex % TONES.length];
  const rings = Math.max(2, Math.min(5, visual.rings));
  const duration = Math.round(visual.pulseMs / Math.max(0.55, strength));

  return (
    <Shell
      $size={size}
      role="img"
      aria-label={label}
      title={`${label} · ${visual.id}`}
    >
      {Array.from({ length: rings }).map((_, index) => (
        <Ring
          key={index}
          $tone={tone}
          $active={active}
          $duration={duration}
          $delay={Math.round((duration / rings) * index * -1)}
        />
      ))}
      <Core $tone={tone} $duration={visual.pulseMs} $active={active} />
    </Shell>
  );
}
