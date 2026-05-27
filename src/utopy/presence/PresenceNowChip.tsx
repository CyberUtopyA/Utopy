import React, { useMemo } from "react";
import styled from "styled-components";

const Chip = styled.div<{ tone?: "ok" | "info" | "warn" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.12)"
      : tone === "warn"
        ? "rgba(245,158,11,0.12)"
        : "rgba(59,130,246,0.10)"};
  color: #111;
`;

type PresenceLike = {
  actorId?: string | null;
  productId?: string | null;
  threadId?: string | null;
  meta?: Record<string, any>;
};

export default function PresenceNowChip({
  presences,
  selfActorId,
  productId,
  threadId,
  minCount = 1,
}: {
  presences: PresenceLike[];
  selfActorId?: string | null;
  productId?: string | null;
  threadId?: string | null;
  minCount?: number;
}) {
  const filtered = useMemo(() => {
    return (presences || []).filter((p) => {
      const isOther = String(p?.actorId || "") !== String(selfActorId || "");
      const sameProduct =
        !!productId && String(p?.productId || "") === String(productId);
      const sameThread =
        !!threadId && String(p?.threadId || "") === String(threadId);
      return isOther && (sameProduct || sameThread);
    });
  }, [presences, selfActorId, productId, threadId]);

  const count = filtered.length;
  if (count < minCount) return null;

  return (
    <Chip tone="ok">
      {count === 1
        ? "👀 Alguien está viendo esto ahora"
        : `👀 ${count} personas lo están viendo`}
    </Chip>
  );
}