import { sanitizeHumanText } from "./resonance.security";
import type { ResonanceIntentMode } from "./resonance.types";

export type WhatsAppSignalDraft = {
  mode: ResonanceIntentMode;
  message: string;
  domains: string[];
  resources: string[];
};

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildWhatsAppSignalLink(input: {
  phone: string;
  message: string;
  signalId?: string;
  signalUrl?: string;
}): string | null {
  const phone = normalizePhone(input.phone);
  if (phone.length < 8 || phone.length > 15) return null;

  const parts = [
    "Señal Viva UTOPY",
    sanitizeHumanText(input.message, 420),
    input.signalId ? `Señal: ${sanitizeHumanText(input.signalId, 180)}` : "",
    input.signalUrl ? sanitizeHumanText(input.signalUrl, 500) : "",
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(parts.join("\n"))}`;
}

export function whatsappMessageToSignalDraft(
  rawMessage: string
): WhatsAppSignalDraft {
  const message = sanitizeHumanText(rawMessage, 600);
  const normalized = message.toLowerCase();
  let mode: ResonanceIntentMode = "need";

  if (/^(ofrezco|tengo|dispongo|vendo)\b/.test(normalized)) mode = "offer";
  else if (/^(busco colaborar|colaboro|trabajo|oficio)\b/.test(normalized)) {
    mode = "collaborate";
  } else if (/^(quiero crear|quiero producir|fabricar|construir)\b/.test(normalized)) {
    mode = "produce";
  }

  const words = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  return {
    mode,
    message,
    domains: Array.from(new Set(words.slice(0, 8))),
    resources: Array.from(new Set(words.slice(8, 18))),
  };
}
