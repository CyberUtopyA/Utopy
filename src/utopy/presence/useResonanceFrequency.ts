import { useCallback, useEffect, useRef, useState } from "react";
import { createResonanceBeacon } from "./resonance.dv";
import { makeSessionId } from "./resonance.signature";
import type {
  DVLike,
  ResonanceGeo,
  ResonancePublisher,
  ResonanceSecurityPolicy,
  ResonanceSigner,
} from "./resonance.types";

export type UseResonanceFrequencyOptions = {
  enabled: boolean;
  sourceDV: DVLike | null;
  actorId: string;
  nodeId?: string | null;
  publishDV: ResonancePublisher;
  geo?: ResonanceGeo | null;
  scope?: string;
  periodMs?: number;
  ttlMs?: number;
  policy?: ResonanceSecurityPolicy;
  signer?: ResonanceSigner;
  emitWhileHidden?: boolean;
};

export function useResonanceFrequency(
  options: UseResonanceFrequencyOptions
) {
  const sessionRef = useRef(makeSessionId());
  const sequenceRef = useRef(0);
  const emittingRef = useRef(false);
  const [lastBeacon, setLastBeacon] = useState<DVLike | null>(null);
  const [lastError, setLastError] = useState<unknown>(null);
  const [isEmitting, setIsEmitting] = useState(false);

  const emitNow = useCallback(async () => {
    if (
      !options.enabled ||
      !options.sourceDV ||
      emittingRef.current ||
      (!options.emitWhileHidden &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden")
    ) {
      return null;
    }

    emittingRef.current = true;
    setIsEmitting(true);
    try {
      const beacon = await createResonanceBeacon({
        sourceDV: options.sourceDV,
        actorId: options.actorId,
        nodeId: options.nodeId,
        sessionId: sessionRef.current,
        sequence: sequenceRef.current,
        periodMs: options.periodMs,
        ttlMs: options.ttlMs,
        scope: options.scope,
        geo: options.geo,
        policy: options.policy,
        signer: options.signer,
      });
      sequenceRef.current += 1;
      await options.publishDV(beacon);
      setLastBeacon(beacon);
      setLastError(null);
      return beacon;
    } catch (error) {
      setLastError(error);
      return null;
    } finally {
      emittingRef.current = false;
      setIsEmitting(false);
    }
  }, [
    options.actorId,
    options.emitWhileHidden,
    options.enabled,
    options.geo,
    options.nodeId,
    options.periodMs,
    options.policy,
    options.publishDV,
    options.scope,
    options.signer,
    options.sourceDV,
    options.ttlMs,
  ]);

  useEffect(() => {
    sessionRef.current = makeSessionId();
    sequenceRef.current = 0;
    setLastBeacon(null);
  }, [options.sourceDV?.id]);

  useEffect(() => {
    if (!options.enabled || !options.sourceDV) return;
    void emitNow();
    const timer = window.setInterval(
      () => void emitNow(),
      Math.max(8_000, options.periodMs ?? 20_000)
    );
    return () => window.clearInterval(timer);
  }, [emitNow, options.enabled, options.periodMs, options.sourceDV]);

  const rotateSession = useCallback(() => {
    sessionRef.current = makeSessionId();
    sequenceRef.current = 0;
    setLastBeacon(null);
  }, []);

  return {
    sessionId: sessionRef.current,
    lastBeacon,
    lastError,
    isEmitting,
    emitNow,
    rotateSession,
  };
}
