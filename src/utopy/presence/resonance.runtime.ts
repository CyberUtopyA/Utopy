import { createResonanceBeacon } from "./resonance.dv";
import { makeSessionId } from "./resonance.signature";
import type {
  DVLike,
  ResonanceGeo,
  ResonancePublisher,
  ResonanceSecurityPolicy,
  ResonanceSigner,
} from "./resonance.types";

export type ManagedResonanceFrequencyInput = {
  sourceDV: DVLike;
  actorId: string;
  nodeId?: string | null;
  publishDV: ResonancePublisher;
  geo?: ResonanceGeo | null;
  scope?: string;
  periodMs?: number;
  ttlMs?: number;
  maxDurationMs?: number;
  sessionId?: string;
  initialSequence?: number;
  emitImmediately?: boolean;
  emitWhileHidden?: boolean;
  policy?: ResonanceSecurityPolicy;
  signer?: ResonanceSigner;
  onError?: (error: unknown) => void;
};

export type ManagedResonanceFrequency = {
  key: string;
  sessionId: string;
  startedAt: number;
  stopAt: number;
  emitNow: () => Promise<DVLike | null>;
  stop: () => void;
};

type RuntimeFrequency = ManagedResonanceFrequency & {
  timer: ReturnType<typeof globalThis.setInterval>;
  stopTimer: ReturnType<typeof globalThis.setTimeout>;
  visibilityHandler?: () => void;
};

const activeFrequencies = new Map<string, RuntimeFrequency>();
const MAX_ACTIVE_FREQUENCIES = 48;

function removeOldestIfNeeded() {
  if (activeFrequencies.size < MAX_ACTIVE_FREQUENCIES) return;
  const oldest = Array.from(activeFrequencies.values()).sort(
    (a, b) => a.startedAt - b.startedAt
  )[0];
  oldest?.stop();
}

export function stopManagedResonanceFrequency(sourceDVId: string) {
  activeFrequencies.get(sourceDVId)?.stop();
}

export function stopAllManagedResonanceFrequencies() {
  for (const frequency of Array.from(activeFrequencies.values())) {
    frequency.stop();
  }
}

export function listManagedResonanceFrequencies() {
  return Array.from(activeFrequencies.values()).map(
    ({ key, sessionId, startedAt, stopAt }) => ({
      key,
      sessionId,
      startedAt,
      stopAt,
    })
  );
}

export function startManagedResonanceFrequency(
  input: ManagedResonanceFrequencyInput
): ManagedResonanceFrequency {
  const key = input.sourceDV.id;
  stopManagedResonanceFrequency(key);
  removeOldestIfNeeded();

  const startedAt = Date.now();
  const periodMs = Math.max(8_000, Number(input.periodMs || 20_000));
  const ttlMs = Math.max(periodMs * 2, Number(input.ttlMs || 45_000));
  const maxDurationMs = Math.max(
    60_000,
    Math.min(Number(input.maxDurationMs || 4 * 60 * 60_000), 24 * 60 * 60_000)
  );
  const stopAt = startedAt + maxDurationMs;
  const sessionId = input.sessionId || makeSessionId();
  let sequence = Math.max(0, Number(input.initialSequence || 0));
  let emitting = false;
  let stopped = false;

  const emitNow = async (): Promise<DVLike | null> => {
    if (stopped || emitting || Date.now() >= stopAt) return null;
    if (
      !input.emitWhileHidden &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return null;
    }

    emitting = true;
    try {
      const beacon = await createResonanceBeacon({
        sourceDV: input.sourceDV,
        actorId: input.actorId,
        nodeId: input.nodeId,
        sessionId,
        sequence,
        periodMs,
        ttlMs,
        scope: input.scope || "resonance",
        geo: input.geo,
        policy: input.policy,
        signer: input.signer,
      });
      sequence += 1;
      await input.publishDV(beacon);
      return beacon;
    } catch (error) {
      input.onError?.(error);
      return null;
    } finally {
      emitting = false;
    }
  };

  let runtime!: RuntimeFrequency;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    globalThis.clearInterval(runtime.timer);
    globalThis.clearTimeout(runtime.stopTimer);
    if (runtime.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", runtime.visibilityHandler);
    }
    activeFrequencies.delete(key);
  };

  const timer = globalThis.setInterval(() => void emitNow(), periodMs);
  const stopTimer = globalThis.setTimeout(stop, maxDurationMs);
  const visibilityHandler = () => {
    if (document.visibilityState === "visible") void emitNow();
  };

  runtime = {
    key,
    sessionId,
    startedAt,
    stopAt,
    timer,
    stopTimer,
    visibilityHandler,
    emitNow,
    stop,
  };

  activeFrequencies.set(key, runtime);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", visibilityHandler);
  }
  if (input.emitImmediately !== false) void emitNow();

  return runtime;
}

