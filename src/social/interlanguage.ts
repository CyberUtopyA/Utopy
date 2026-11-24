import type { LiveSignalMode } from "./liveNetwork.types";

export type SemanticDirection = "need" | "offer" | "can" | "seek" | "learn" | "share" | "other";
export type SemanticFrame = { direction: SemanticDirection; action: string; resource: string; quantity: number | null; unit: string; time: string; territory: string; conditions: string[]; references: string[]; provisional: boolean };
export type InterlanguageMeaning = { locale: "es" | "pt" | "en" | "gn" | "mixed"; mode: LiveSignalMode; category: string; emoji: string; plainSummary: string; domains: string[]; verbs: string[]; resources: string[]; hints: string[]; frame: SemanticFrame };

function normalize(value: unknown) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9ñü'@:/\. -]+/g, " ").replace(/\s+/g, " ").trim(); }
function unique(values: string[]) { return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))); }
const STOP = new Set("yo tu el la los las un una de del para por con que quiero necesito busco ofrezco puedo compartir aprender procuro preciso quero posso offer need want looking for i can".split(" "));

function directionOf(text: string): SemanticDirection {
  if (/\b(aprender|aprendo|curso|learn)\b/.test(text)) return "learn";
  if (/\b(comparto|compartir|presto|regalo|share)\b/.test(text)) return "share";
  if (/\b(busco|procuro|encontrar|looking for|seek)\b/.test(text)) return "seek";
  if (/\b(puedo|se hacer|soy capaz|posso|i can)\b/.test(text)) return "can";
  if (/\b(ofrezco|vendo|tengo disponible|ofereco|offer|selling)\b/.test(text)) return "offer";
  if (/\b(necesito|preciso|quiero|me hace falta|need|want|aikoteve)\b/.test(text)) return "need";
  return "other";
}
function localeOf(text: string): InterlanguageMeaning["locale"] { const scores = { es: /\b(necesito|quiero|puedo|busco)\b/.test(text) ? 1 : 0, pt: /\b(preciso|quero|posso|procuro)\b/.test(text) ? 1 : 0, en: /\b(need|want|offer|learn)\b/.test(text) ? 1 : 0, gn: /\b(aikoteve|ajapo|yvyra|gueraha)\b/.test(text) ? 1 : 0 }; const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]); return !ranked[0][1] || ranked[0][1] === ranked[1][1] ? "mixed" : ranked[0][0] as InterlanguageMeaning["locale"]; }

export function interpretHumanSignal(rawText: unknown, preferredDirection?: SemanticDirection): InterlanguageMeaning {
  const raw = String(rawText || "").trim(); const normalized = normalize(raw);
  const direction = preferredDirection && preferredDirection !== "other" ? preferredDirection : directionOf(normalized);
  const words = normalized.split(" ").filter((word) => word.length > 1 && !STOP.has(word));
  const quantityMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilos?|litros?|l|metros?|m|unidades?|u|horas?)?\b/);
  const time = normalized.match(/\b(hoy|mañana|esta semana|cada semana|semanal|mensual|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)?.[0] || "";
  const territory = normalized.match(/\b(?:en|cerca de|hasta)\s+([a-zñ ]{3,40})/)?.[1]?.trim() || "";
  const action = words[0] || normalized.split(" ")[0] || "expresar";
  const resource = words.filter((word) => !time.includes(word)).slice(1).join(" ") || words.join(" ") || raw;
  const provisional = direction === "other" || !resource;
  const mode: LiveSignalMode = direction === "need" || direction === "seek" || direction === "learn" || direction === "other" ? "need" : "offer";
  const labels: Record<SemanticDirection, [string, string]> = { need: ["🙋", "necesitás"], offer: ["🤝", "ofrecés"], can: ["🛠️", "podés hacer"], seek: ["🔎", "buscás"], learn: ["🌱", "querés aprender"], share: ["🫶", "querés compartir"], other: ["✨", "querés expresar"] };
  const [emoji, label] = labels[direction];
  const frame: SemanticFrame = { direction, action, resource, quantity: quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : null, unit: quantityMatch?.[2] || "", time, territory, conditions: [], references: Array.from(raw.matchAll(/(?:https?:\/\/\S+|@[\w.-]+)/g)).map((match) => match[0]), provisional };
  return { locale: localeOf(normalized), mode, category: "Expresión abierta", emoji, plainSummary: raw ? `${emoji} Entendí que ${label}: “${raw}”.` : "Decilo como hablás. UTOPY conserva tus palabras.", domains: unique(words.slice(0, 8)), verbs: unique([action, direction]), resources: unique([resource, ...words]), hints: provisional ? ["provisional"] : [direction], frame };
}

const LEARNING_KEY = "utopy.expression.learning.v1";
export function rememberConfirmedMeaning(original: string, frame: SemanticFrame) { if (typeof window === "undefined") return; try { const current = JSON.parse(localStorage.getItem(LEARNING_KEY) || "{}"); current[normalize(original)] = { frame, confirmedAt: new Date().toISOString() }; localStorage.setItem(LEARNING_KEY, JSON.stringify(current)); } catch {} }
