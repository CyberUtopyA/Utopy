import React from "react";
import styled from "styled-components";

const Badge = styled.div<{ tone?: "low" | "mid" | "high" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 900;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ tone }) =>
    tone === "high"
      ? "rgba(239,68,68,0.12)"
      : tone === "mid"
        ? "rgba(245,158,11,0.12)"
        : "rgba(59,130,246,0.10)"};
  color: #111;
`;

function toneFromScore(score: number): "low" | "mid" | "high" {
  if (score >= 4) return "high";
  if (score >= 2) return "mid";
  return "low";
}

function labelFromScore(score: number) {
  if (score >= 4) return "🔥 muy activo";
  if (score >= 2) return "✨ activo";
  return "👀 visto ahora";
}

export default function PresenceHeatBadge({
  score,
}: {
  score: number;
}) {
  if (!Number.isFinite(score) || score < 1) return null;
  return <Badge tone={toneFromScore(score)}>{labelFromScore(score)}</Badge>;
}