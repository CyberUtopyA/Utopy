import type {
  DVLike,
  ResonanceGeo,
  ResonanceSecurityPolicy,
  ResonanceSigner,
} from "./resonance.types";

export const DEFAULT_RESONANCE_SECURITY: ResonanceSecurityPolicy = {
  requireConsent: true,
  allowAutomaticActions: false,
  geoPrecision: "approximate",
  maxPublicTtlMs: 1000 * 60 * 60 * 24 * 7,
  allowedActionProtocols: ["https:", "mailto:", "tel:"],
};

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function isValidGeo(geo: unknown): geo is ResonanceGeo {
  if (!geo || typeof geo !== "object") return false;
  const value = geo as ResonanceGeo;
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

export function protectPublicGeo(
  geo: ResonanceGeo | null | undefined,
  precision: ResonanceSecurityPolicy["geoPrecision"] =
    DEFAULT_RESONANCE_SECURITY.geoPrecision
): ResonanceGeo | undefined {
  if (!isValidGeo(geo) || precision === "hidden") return undefined;

  const digits =
    precision === "exact" ? 6 : precision === "approximate" ? 3 : 2;

  return {
    lat: round(geo.lat, digits),
    lng: round(geo.lng, digits),
    accuracy_m:
      precision === "exact"
        ? geo.accuracy_m
        : precision === "approximate"
          ? Math.max(geo.accuracy_m || 0, 120)
          : Math.max(geo.accuracy_m || 0, 1200),
    precision:
      precision === "exact"
        ? "exact"
        : precision === "approximate"
          ? "approximate"
          : "region",
    source: geo.source || "device",
  };
}

export function clampPublicTtl(
  ttlMs: number,
  policy: ResonanceSecurityPolicy = DEFAULT_RESONANCE_SECURITY
): number {
  const safe = Number.isFinite(ttlMs) ? ttlMs : 45_000;
  return Math.max(10_000, Math.min(safe, policy.maxPublicTtlMs));
}

export function sanitizeHumanText(value: unknown, maxLength = 280): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isAllowedActionUrl(
  value: unknown,
  policy: ResonanceSecurityPolicy = DEFAULT_RESONANCE_SECURITY
): boolean {
  try {
    const url = new URL(String(value || ""));
    return policy.allowedActionProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .filter((key) => key !== "signature" && key !== "integrity")
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
}

export function canonicalDV(dv: DVLike): string {
  return JSON.stringify(canonicalize(dv));
}

export async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "unavailable";

  const bytes = new TextEncoder().encode(value);
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sealResonanceDV(
  dv: DVLike,
  signer?: ResonanceSigner
): Promise<DVLike> {
  const canonicalPayload = canonicalDV(dv);
  const integrity = await sha256Hex(canonicalPayload);
  const signature = signer ? await signer(canonicalPayload) : undefined;

  return {
    ...dv,
    meta: {
      ...(dv.meta || {}),
      integrity: {
        alg: "SHA-256",
        value: integrity,
      },
      ...(signature ? { signature } : {}),
    },
  };
}

export function requiresHumanConsent(dv: DVLike): boolean {
  return dv?.attrs?.security?.requiresConsent !== false;
}
