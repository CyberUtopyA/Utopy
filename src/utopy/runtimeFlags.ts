function envBool(value: unknown, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

export const MARKET_RUNTIME_FLAGS = Object.freeze({
  runtime: envBool(import.meta.env.VITE_UTOPY_RUNTIME_ENABLED, false),
  mind: envBool(import.meta.env.VITE_UTOPY_RUNTIME_MIND_ENABLED, false),
  mindShadow: envBool(import.meta.env.VITE_UTOPY_RUNTIME_MIND_SHADOW, true),
  mindSafeAuto: envBool(import.meta.env.VITE_UTOPY_RUNTIME_MIND_SAFE_AUTO, false),
  frequency: envBool(import.meta.env.VITE_UTOPY_RUNTIME_FREQUENCY_ENABLED, false),
  discovery: envBool(import.meta.env.VITE_UTOPY_RUNTIME_DISCOVERY_ENABLED, false),
});

export type MarketRuntimeFlags = typeof MARKET_RUNTIME_FLAGS;
