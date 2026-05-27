// src/pages/PropertyNodes.tsx
// Falcon — flujo simple SIN BACKEND (local-first):
// 1) Crear Propiedad (ID único) + elegir módulos (PIN/Medidor/Cámara)
// 2) Guardar un .utopy.json mínimo (ADN/DSL) por propiedad
// 3) Mostrar QR con el ADN para que un micro-OS lo "absorba"
// 4) Exportar el ADN a disco
// 5) Generar propaganda viva SIN Adobe Express:
//    - diagnóstico comercial
//    - instrucciones de foto/video
//    - copies por canal
//    - guiones cortos
//    - hashtags
//    - export .txt / .utopy.promo.json
//    - copiar textos listos para publicar

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import QRCode from "react-qr-code";
import { Navigate, useNavigate } from "react-router-dom";

// ───────────────────────────── UI base ─────────────────────────────

const WRAP = styled.div`
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.20), transparent 34%),
    radial-gradient(circle at 80% 0%, rgba(168, 85, 247, 0.22), transparent 30%),
    linear-gradient(145deg, #07111d, #102331 45%, #173348);
  color: #fff;
  display: flex;
  gap: 24px;
  padding: 24px;

  @media (max-width: 720px) {
    padding: 14px;
  }
`;

const Board = styled.div`
  flex: 1;
  max-width: 1240px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.065);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 22px;
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(16px);
`;

const HeroCard = styled(Card)`
  position: relative;
  overflow: hidden;
  border-color: rgba(125, 249, 255, 0.28);

  &::before {
    content: "";
    position: absolute;
    inset: -2px;
    background:
      radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.18), transparent 35%),
      radial-gradient(circle at 100% 0%, rgba(217, 70, 239, 0.16), transparent 32%);
    pointer-events: none;
  }

  > * {
    position: relative;
    z-index: 1;
  }
`;

const Title = styled.h2`
  margin: 0 0 8px;
  letter-spacing: -0.03em;
`;

const BigTitle = styled.h1`
  margin: 0;
  font-size: clamp(30px, 5vw, 54px);
  line-height: 0.96;
  letter-spacing: -0.06em;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Three = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.13);
  color: #fff;
  outline: none;

  &::placeholder {
    color: rgba(226, 232, 240, 0.76);
  }

  &:focus {
    border-color: rgba(125, 249, 255, 0.62);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.13);
  color: #fff;
  outline: none;

  option {
    color: #0f172a;
  }

  &:focus {
    border-color: rgba(125, 249, 255, 0.62);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px 13px;
  min-height: 86px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  resize: vertical;
  background: rgba(255, 255, 255, 0.13);
  color: #fff;
  outline: none;

  &::placeholder {
    color: rgba(226, 232, 240, 0.76);
  }

  &:focus {
    border-color: rgba(125, 249, 255, 0.62);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
  }
`;

const Button = styled.button`
  padding: 10px 14px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  background: #020617;
  color: #fff;
  margin-right: 8px;
  font-weight: 800;
  transition: 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    background: #111827;
  }

  &:active {
    transform: translateY(0px);
  }
`;

const GhostButton = styled(Button)`
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.14);

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }
`;

const CyanButton = styled(Button)`
  background: linear-gradient(135deg, #06b6d4, #2563eb);
`;

const PinkButton = styled(Button)`
  background: linear-gradient(135deg, #d946ef, #7c3aed);
`;

const GreenButton = styled(Button)`
  background: linear-gradient(135deg, #059669, #0f766e);
`;

const DangerButton = styled(Button)`
  background: linear-gradient(135deg, #991b1b, #dc2626);
`;

const Tag = styled.span`
  display: inline-block;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.11);
  border: 1px solid rgba(255, 255, 255, 0.18);
  margin-right: 6px;
  margin-bottom: 6px;
  font-size: 12px;
`;

const Small = styled.p`
  color: #e3f2fd;
  margin: 3px 0;
  font-size: 13px;
  line-height: 1.55;
`;

const Muted = styled.span`
  opacity: 0.8;
`;

const Hr = styled.hr`
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  margin: 12px 0;
`;

const SoftGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);

  @media (max-width: 1040px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const StatBox = styled.div`
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
`;

const StatLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(226, 232, 240, 0.78);
`;

const StatValue = styled.div`
  margin-top: 4px;
  font-size: 24px;
  font-weight: 950;
`;

const MiniCard = styled.div`
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.075);
  border: 1px solid rgba(255, 255, 255, 0.14);
`;

const PieceCard = styled(MiniCard)`
  background:
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 32%),
    rgba(255, 255, 255, 0.075);
`;

const Mono = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.55;
  color: #dbeafe;
  background: rgba(2, 6, 23, 0.44);
  border-radius: 16px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  max-height: 260px;
  overflow: auto;
`;

const InlineActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const StatusPill = styled.span<{ $tone?: "ok" | "warn" | "info" | "bad" }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(16,185,129,.16)"
      : $tone === "warn"
      ? "rgba(245,158,11,.16)"
      : $tone === "bad"
      ? "rgba(239,68,68,.16)"
      : "rgba(34,211,238,.16)"};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "ok"
        ? "rgba(16,185,129,.32)"
        : $tone === "warn"
        ? "rgba(245,158,11,.32)"
        : $tone === "bad"
        ? "rgba(239,68,68,.32)"
        : "rgba(34,211,238,.32)"};
  color: #fff;
`;

// ───────────────────────────── Modelos propiedad ─────────────────────────────

const LS_KEY = "utopy.props.v1";
const PROMO_LS_KEY = "utopy.props.propaganda.v1";

const nowIso = () => new Date().toISOString();

export type ModKind = "door_lock" | "meter" | "camera";

export type PropertyADN = {
  "🧬": string;
  propiedad_id: string;
  arrendatario: { nombre: string; doc: string; contacto: string };
  devices: {
    lock?: {
      tipo: string;
      id?: string;
      modo: "pin" | "nfc";
      pin_policy?: { len: number; auto_expira_dias: number };
    };
    meter?: {
      tipo: string;
      id?: string;
      limites: { incluido_kwh: number; corte_por_exceso: boolean };
    };
    camera?: {
      tipo: string;
      rtsp?: string;
      retencion_dias: number;
    };
  };
  billing: {
    alquiler_gs: number;
    kwh_incluido: number;
    excedente_gs_por_kwh: number;
    vencimiento_dia: number;
    gracia_dias: number;
  };
  policies: string[];
  webhooks?: { onPago?: string; onEvento?: string };
};

export type Property = {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;

  alquilerGs: number;
  kwhIncluido: number;
  excedenteGsPorKwh: number;
  vencimientoDia: number;
  graciaDias: number;

  modules: ModKind[];

  lockPinLen?: number;
  lockPinAutoExpira?: number;
  lockTipo?: string;

  meterTipo?: string;
  meterIncluyeCorte?: boolean;

  cameraRtsp?: string;
  cameraRetencion?: number;
  cameraTipo?: string;

  endpoint?: string;
  secret?: string;
  notes?: string;
};

const defaultForm: Omit<Property, "id" | "createdAt" | "updatedAt"> = {
  propertyId: "",
  alquilerGs: 690000,
  kwhIncluido: 100,
  excedenteGsPorKwh: 1200,
  vencimientoDia: 5,
  graciaDias: 5,
  modules: ["meter"],
  lockPinLen: 6,
  lockPinAutoExpira: 30,
  lockTipo: "tuya.lock",
  meterTipo: "tuya.sinotimer.dds6619",
  meterIncluyeCorte: true,
  cameraRtsp: "",
  cameraRetencion: 7,
  cameraTipo: "onvif/rtsp",
  endpoint: "",
  secret: "",
  notes: "",
};

// ───────────────────────────── Modelos propaganda ─────────────────────────────

type PromoChannel =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "whatsapp"
  | "telegram"
  | "flyer";

type PromoStatus = "idea" | "to_create" | "ready" | "used";

type PromoPiece = {
  id: string;
  channel: PromoChannel;
  status: PromoStatus;
  title: string;
  objective: string;
  format: string;
  hook: string;
  caption: string;
  script: string[];
  visualInstructions: string[];
  shotList: string[];
  cta: string;
  hashtags: string[];
};

type PromoCampaign = {
  id: string;
  propertyLocalId: string;
  propertyId: string;
  title: string;
  subtitle: string;
  score: number;
  audience: string;
  offerAngle: string;
  diagnosis: string[];
  missingAssets: string[];
  globalInstructions: string[];
  pieces: PromoPiece[];
  createdAt: string;
  updatedAt: string;
};

// ───────────────────────────── Helpers generales ─────────────────────────────

function safeStr(x: unknown) {
  return String(x || "").trim();
}

function gs(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "Gs. —";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(n)}`;
}

function slugifyLabel(label: string) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function downloadJSON(obj: any, filename: string) {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(obj, null, 2));

  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadText(text: string, filename: string) {
  const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copiado.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("Copiado.");
  }
}

function moduleLabel(m: ModKind) {
  if (m === "door_lock") return "PIN inteligente";
  if (m === "meter") return "Medidor inteligente";
  if (m === "camera") return "Cámara";
  return m;
}

function toADN(p: Property): PropertyADN {
  return {
    "🧬": "utopy/propiedad/v1",
    propiedad_id: p.propertyId,
    arrendatario: { nombre: "—", doc: "—", contacto: "—" },
    devices: {
      lock: p.modules.includes("door_lock")
        ? {
            tipo: p.lockTipo || "tuya.lock",
            modo: "pin",
            pin_policy: {
              len: p.lockPinLen || 6,
              auto_expira_dias: p.lockPinAutoExpira || 30,
            },
          }
        : undefined,

      meter: p.modules.includes("meter")
        ? {
            tipo: p.meterTipo || "tuya.sinotimer.dds6619",
            limites: {
              incluido_kwh: p.kwhIncluido,
              corte_por_exceso: !!p.meterIncluyeCorte,
            },
          }
        : undefined,

      camera: p.modules.includes("camera")
        ? {
            tipo: p.cameraTipo || "onvif/rtsp",
            rtsp: p.cameraRtsp || undefined,
            retencion_dias: p.cameraRetencion || 7,
          }
        : undefined,
    },

    billing: {
      alquiler_gs: p.alquilerGs,
      kwh_incluido: p.kwhIncluido,
      excedente_gs_por_kwh: p.excedenteGsPorKwh,
      vencimiento_dia: p.vencimientoDia,
      gracia_dias: p.graciaDias,
    },

    policies: [
      "si impago -> lock.disable_all_pins + meter.power_off",
      "si pago_ok -> lock.enable_tenant_pin + meter.power_on",
      "si kwh_mes > kwh_incluido -> notificar + marcar_exceso",
    ],

    webhooks: undefined,
  };
}

// ───────────────────────────── Motor de propaganda ─────────────────────────────

function propertyHeadline(p: Property) {
  const note = safeStr(p.notes);
  if (note) return note.split("\n")[0].slice(0, 90);
  return `Propiedad inteligente ${p.propertyId}`;
}

function propertySubtitle(p: Property) {
  const mods = p.modules.map(moduleLabel).join(", ");
  return `${gs(p.alquilerGs)} mensual · ${p.kwhIncluido} kWh incluidos · ${mods}`;
}

function promoHashtags(p: Property) {
  return uniq([
    "#Falcon",
    "#UTOPY",
    "#AlquilerInteligente",
    "#PropiedadViva",
    "#SaltoDelGuaira",
    "#Alquiler",
    p.modules.includes("meter") ? "#MedidorInteligente" : "",
    p.modules.includes("door_lock") ? "#AccesoInteligente" : "",
    p.modules.includes("camera") ? "#Seguridad" : "",
    `#${slugifyLabel(p.propertyId)}`,
  ]).slice(0, 10);
}

function scorePropertyForPromo(p: Property) {
  let score = 35;

  if (safeStr(p.notes)) score += 15;
  if (p.alquilerGs > 0) score += 10;
  if (p.kwhIncluido > 0) score += 8;
  if (p.modules.includes("meter")) score += 10;
  if (p.modules.includes("door_lock")) score += 10;
  if (p.modules.includes("camera")) score += 8;
  if (safeStr(p.endpoint)) score += 4;

  return Math.max(0, Math.min(100, score));
}

function buildDiagnosis(p: Property) {
  const items: string[] = [];

  if (!safeStr(p.notes)) {
    items.push(
      "Falta una descripción humana de la propiedad. Agregá una frase emocional: ubicación, comodidad, seguridad o ventaja principal."
    );
  }

  if (!p.modules.includes("door_lock")) {
    items.push(
      "Podés mejorar la percepción premium agregando PIN inteligente o acceso digital."
    );
  }

  if (!p.modules.includes("camera")) {
    items.push(
      "Podés mejorar la confianza mostrando seguridad, iluminación, entrada o cámara."
    );
  }

  if (p.kwhIncluido <= 0) {
    items.push(
      "Falta aclarar consumo incluido. En alquileres, esto ayuda mucho a reducir dudas."
    );
  }

  if (items.length === 0) {
    items.push(
      "La base comercial está fuerte. Ahora conviene crear fotos reales, video corto y mensaje simple para WhatsApp."
    );
  }

  return items;
}

function buildMissingAssets(p: Property) {
  const items = [
    "Foto principal vertical de la propiedad o habitación.",
    "Foto de entrada/fachada para generar confianza.",
    "Foto del baño, cama, cocina o espacio más atractivo.",
    "Video corto caminando desde la entrada hasta el ambiente principal.",
  ];

  if (p.modules.includes("meter")) {
    items.push("Foto o captura del medidor/control de consumo para mostrar transparencia.");
  }

  if (p.modules.includes("door_lock")) {
    items.push("Foto o mini video del acceso con PIN para mostrar modernidad.");
  }

  if (p.modules.includes("camera")) {
    items.push("Foto de zona segura o cámara sin invadir privacidad.");
  }

  return items;
}

function buildVisualInstructions(p: Property, channel: PromoChannel) {
  const title = propertyHeadline(p);

  const base = [
    "Usar imagen real, limpia y luminosa.",
    "Mostrar primero el beneficio, no solo la pared o el objeto.",
    "Agregar texto grande y corto sobre la imagen.",
    "Evitar saturar con demasiadas palabras.",
  ];

  if (channel === "tiktok" || channel === "instagram") {
    base.push("Estructura del video: problema → solución → prueba → consulta.");
    base.push("Primeros 2 segundos: mostrar el lugar o beneficio más fuerte.");
  }

  if (channel === "whatsapp") {
    base.push("Usar una sola imagen clara y texto corto.");
    base.push("Terminar con pregunta directa: ¿Querés que te pase ubicación o disponibilidad?");
  }

  if (p.modules.includes("meter")) {
    base.push("Resaltar consumo incluido y control transparente.");
  }

  if (p.modules.includes("door_lock")) {
    base.push("Resaltar acceso inteligente: menos llave física, más control.");
  }

  if (p.modules.includes("camera")) {
    base.push("Resaltar seguridad sin mostrar zonas privadas.");
  }

  base.push(`El mensaje central debe ser: ${title}.`);

  return base;
}

function buildShotList(p: Property, channel: PromoChannel) {
  if (channel === "whatsapp") {
    return [
      "Foto 1: mejor vista de la propiedad.",
      "Foto 2: detalle útil: cama, baño, cocina, estacionamiento o acceso.",
      "Texto: precio + beneficio + consulta.",
    ];
  }

  if (channel === "flyer") {
    return [
      "Imagen principal arriba.",
      "Precio visible.",
      "3 beneficios en bullets.",
      "CTA grande: Consultar disponibilidad.",
      "QR o contacto abajo.",
    ];
  }

  return [
    "Toma 1: entrada o vista general.",
    "Toma 2: ambiente principal.",
    "Toma 3: beneficio especial: medidor, PIN, seguridad, estacionamiento o ubicación.",
    "Toma 4: texto final con precio y llamado a consulta.",
  ];
}

function buildCaption(p: Property, channel: PromoChannel) {
  const title = propertyHeadline(p);
  const price = gs(p.alquilerGs);
  const kwh = `${p.kwhIncluido} kWh incluidos`;
  const mods = p.modules.map(moduleLabel).join(", ");

  if (channel === "whatsapp") {
    return [
      `Hola, te paso esta opción: ${title}`,
      `${price} mensual · ${kwh}`,
      mods ? `Incluye: ${mods}` : "",
      "¿Querés que te pase más detalles o disponibilidad?",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (channel === "tiktok") {
    return `${title}. ${price} mensual, ${kwh}. Una forma más simple y transparente de alquilar.`;
  }

  if (channel === "instagram") {
    return `${title}\n\n${price} mensual · ${kwh}\n${mods ? `Sistema: ${mods}\n` : ""}\nConsultá disponibilidad desde Falcon.`;
  }

  if (channel === "facebook") {
    return `${title}. ${price} mensual, con ${kwh}. Ideal para quien busca una opción clara, organizada y con gestión más inteligente. Consultá disponibilidad.`;
  }

  if (channel === "telegram") {
    return `Disponible: ${title}\n${price} mensual\n${kwh}\n${mods ? `Módulos: ${mods}` : ""}\nConsultá más info.`;
  }

  return `${title}\n${price} mensual\n${kwh}\nConsultá disponibilidad.`;
}

function buildScript(p: Property, channel: PromoChannel) {
  const title = propertyHeadline(p);

  if (channel === "tiktok" || channel === "instagram") {
    return [
      "Escena 1: mostrar el lugar en vertical con texto: “¿Buscás alquilar sin complicarte?”",
      `Escena 2: mostrar ambiente principal: “${title}”`,
      `Escena 3: mostrar precio/beneficio: “${gs(p.alquilerGs)} mensual · ${p.kwhIncluido} kWh incluidos”`,
      "Escena 4: mostrar detalle de confianza: entrada, medidor, PIN, seguridad o estacionamiento.",
      "Escena 5: cierre: “Consultá disponibilidad en Falcon”.",
    ];
  }

  if (channel === "whatsapp") {
    return [
      "Enviar imagen clara.",
      "Enviar texto corto con precio.",
      "Cerrar con pregunta directa.",
    ];
  }

  if (channel === "flyer") {
    return [
      "Crear flyer vertical.",
      "Título grande.",
      "Precio visible.",
      "Beneficios en 3 líneas.",
      "CTA y contacto/QR.",
    ];
  }

  return [
    "Abrir con beneficio principal.",
    "Explicar precio y consumo incluido.",
    "Mostrar confianza: gestión inteligente, módulos y orden.",
    "Cerrar con CTA de consulta.",
  ];
}

function buildPromoPiece(p: Property, channel: PromoChannel): PromoPiece {
  const title = propertyHeadline(p);

  const formatMap: Record<PromoChannel, string> = {
    instagram: "Reel vertical 9:16 + carrusel de 3 imágenes",
    facebook: "Post con imagen principal + texto explicativo",
    tiktok: "Video vertical 9:16 de 12 a 25 segundos",
    whatsapp: "Mensaje corto con imagen",
    telegram: "Anuncio corto con imagen y datos clave",
    flyer: "Flyer vertical para imprimir o compartir",
  };

  const hookMap: Record<PromoChannel, string> = {
    instagram: `¿Buscás una opción lista, clara y fácil de consultar?`,
    facebook: `Una propiedad más simple de alquilar, con información clara desde el inicio.`,
    tiktok: `Esto puede ahorrarte vueltas si estás buscando alquilar.`,
    whatsapp: `Mirá esta opción disponible.`,
    telegram: `Nueva opción disponible para consultar.`,
    flyer: `Alquiler disponible · gestión inteligente`,
  };

  const ctaMap: Record<PromoChannel, string> = {
    instagram: "Consultá disponibilidad en Falcon",
    facebook: "Escribí para más información",
    tiktok: "Pedí disponibilidad",
    whatsapp: "¿Querés que te pase más detalles?",
    telegram: "Consultar ahora",
    flyer: "Escaneá o consultá disponibilidad",
  };

  return {
    id: uuidv4(),
    channel,
    status: "to_create",
    title: `Pieza para ${channel}`,
    objective:
      channel === "tiktok" || channel === "instagram"
        ? "Captar atención rápida y generar consulta"
        : channel === "whatsapp"
        ? "Enviar una oferta clara y fácil de responder"
        : "Explicar valor y generar confianza",
    format: formatMap[channel],
    hook: hookMap[channel],
    caption: buildCaption(p, channel),
    script: buildScript(p, channel),
    visualInstructions: buildVisualInstructions(p, channel),
    shotList: buildShotList(p, channel),
    cta: ctaMap[channel],
    hashtags: promoHashtags(p),
  };
}

function buildPromoCampaignFromProperty(p: Property): PromoCampaign {
  const now = nowIso();

  return {
    id: uuidv4(),
    propertyLocalId: p.id,
    propertyId: p.propertyId,
    title: `Propaganda viva · ${p.propertyId}`,
    subtitle: propertySubtitle(p),
    score: scorePropertyForPromo(p),
    audience:
      "Personas que buscan alquilar rápido, con confianza, precio claro y menos vueltas.",
    offerAngle:
      "No vender solo una pieza o propiedad: vender tranquilidad, claridad, control y facilidad para consultar.",
    diagnosis: buildDiagnosis(p),
    missingAssets: buildMissingAssets(p),
    globalInstructions: [
      "Primero mostrar el lugar real.",
      "Luego mostrar el beneficio: precio, consumo incluido, seguridad o gestión inteligente.",
      "Usar lenguaje simple, humano y directo.",
      "No parecer una inmobiliaria fría: sonar cercano, confiable y claro.",
      "Cada publicación debe terminar con una acción: consultar, pedir ubicación o verificar disponibilidad.",
    ],
    pieces: [
      buildPromoPiece(p, "instagram"),
      buildPromoPiece(p, "tiktok"),
      buildPromoPiece(p, "facebook"),
      buildPromoPiece(p, "whatsapp"),
      buildPromoPiece(p, "telegram"),
      buildPromoPiece(p, "flyer"),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function campaignToText(campaign: PromoCampaign) {
  return [
    `CAMPAÑA: ${campaign.title}`,
    `PROPIEDAD: ${campaign.propertyId}`,
    `SCORE: ${campaign.score}/100`,
    "",
    `SUBTÍTULO:`,
    campaign.subtitle,
    "",
    `AUDIENCIA:`,
    campaign.audience,
    "",
    `ÁNGULO:`,
    campaign.offerAngle,
    "",
    `DIAGNÓSTICO:`,
    ...campaign.diagnosis.map((x, i) => `${i + 1}. ${x}`),
    "",
    `FALTA CREAR / MEJORAR:`,
    ...campaign.missingAssets.map((x, i) => `${i + 1}. ${x}`),
    "",
    `INSTRUCCIONES GENERALES:`,
    ...campaign.globalInstructions.map((x, i) => `${i + 1}. ${x}`),
    "",
    ...campaign.pieces.flatMap((piece) => [
      "────────────────────────────",
      `CANAL: ${piece.channel.toUpperCase()}`,
      `ESTADO: ${piece.status}`,
      `FORMATO: ${piece.format}`,
      `OBJETIVO: ${piece.objective}`,
      "",
      `GANCHO:`,
      piece.hook,
      "",
      `CAPTION / COPY:`,
      piece.caption,
      "",
      `GUIÓN:`,
      ...piece.script.map((x, i) => `${i + 1}. ${x}`),
      "",
      `INSTRUCCIONES VISUALES:`,
      ...piece.visualInstructions.map((x, i) => `${i + 1}. ${x}`),
      "",
      `TOMAS / ASSETS:`,
      ...piece.shotList.map((x, i) => `${i + 1}. ${x}`),
      "",
      `CTA: ${piece.cta}`,
      "",
      `HASHTAGS:`,
      piece.hashtags.join(" "),
      "",
    ]),
  ].join("\n");
}

// ───────────────────────────── Componente ─────────────────────────────

export default function PropertyNodes() {
  const [props, setProps] = useState<Property[]>([]);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [qrFor, setQrFor] = useState<Property | null>(null);
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setProps(raw ? JSON.parse(raw) : []);
    } catch {
      setProps([]);
    }

    try {
      const rawPromo = localStorage.getItem(PROMO_LS_KEY);
      setCampaigns(rawPromo ? JSON.parse(rawPromo) : []);
    } catch {
      setCampaigns([]);
    }
  }, []);

  const persist = (next: Property[]) => {
    setProps(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  };

  const persistCampaigns = (next: PromoCampaign[]) => {
    setCampaigns(next);
    try {
      localStorage.setItem(PROMO_LS_KEY, JSON.stringify(next));
    } catch {}
  };

  const filtered = useMemo(() => {
    if (!filter.trim()) return props;

    const f = filter.toLowerCase();

    return props.filter((p) => {
      const hay = [
        p.propertyId,
        p.notes,
        p.modules.join(" "),
        String(p.alquilerGs),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(f);
    });
  }, [props, filter]);

  const promoStats = useMemo(() => {
    let pieces = 0;
    let ready = 0;
    let used = 0;

    for (const c of campaigns) {
      for (const p of c.pieces) {
        pieces += 1;
        if (p.status === "ready") ready += 1;
        if (p.status === "used") used += 1;
      }
    }

    return {
      campaigns: campaigns.length,
      pieces,
      ready,
      used,
    };
  }, [campaigns]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "meterIncluyeCorte") {
      setForm((prev) => ({
        ...prev,
        meterIncluyeCorte: value === "true",
      }));
      return;
    }

    if (
      [
        "alquilerGs",
        "kwhIncluido",
        "excedenteGsPorKwh",
        "vencimientoDia",
        "graciaDias",
        "lockPinLen",
        "lockPinAutoExpira",
        "cameraRetencion",
      ].includes(name)
    ) {
      setForm((prev) => ({ ...prev, [name]: Number(value) } as any));
    } else {
      setForm((prev) => ({ ...prev, [name]: value } as any));
    }
  };

  const onToggleModule = (mk: ModKind) => {
    setForm((prev) => {
      const has = prev.modules.includes(mk);
      const modules = has
        ? prev.modules.filter((m) => m !== mk)
        : [...prev.modules, mk];

      return { ...prev, modules };
    });
  };

  const validate = () => {
    if (!form.propertyId.trim()) {
      return "Ingresá el ID de la propiedad (ej: PROP-123)";
    }

    if (form.modules.length === 0) {
      return "Elegí al menos un módulo (PIN / Medidor / Cámara)";
    }

    if (form.vencimientoDia < 1 || form.vencimientoDia > 28) {
      return "El día de vencimiento debe estar entre 1 y 28";
    }

    return null;
  };

  const handleCreate = () => {
    const err = validate();
    if (err) return alert(err);

    const p: Property = {
      id: uuidv4(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...form,
    };

    persist([p, ...props]);
    setForm(defaultForm);
  };
  const volver = useNavigate();
  const goBack = () => { 
    volver("/falcon/skylines");

  }

  const startEdit = (p: Property) => {
    setEditingId(p.id);
    setForm({ ...p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleUpdate = () => {
    const err = validate();
    if (err) return alert(err);

    const next = props.map((p) =>
      p.id === editingId ? { ...p, ...form, updatedAt: nowIso() } : p
    );

    persist(next);
    cancelEdit();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("¿Eliminar propiedad?")) return;

    persist(props.filter((p) => p.id !== id));
    persistCampaigns(campaigns.filter((c) => c.propertyLocalId !== id));
  };

  const handleExportADN = (p: Property) => {
    const adn = toADN(p);
    downloadJSON(adn, `${p.propertyId}.utopy.json`);
  };

  const openQR = (p: Property) => setQrFor(p);
  const closeQR = () => setQrFor(null);

  const handleCreatePromo = (p: Property) => {
    const campaign = buildPromoCampaignFromProperty(p);
    persistCampaigns([campaign, ...campaigns]);
    setOpenCampaignId(campaign.id);
  };

  const handleDeleteCampaign = (id: string) => {
    if (!window.confirm("¿Eliminar campaña de propaganda?")) return;
    persistCampaigns(campaigns.filter((c) => c.id !== id));
  };

  const updatePieceStatus = (
    campaignId: string,
    pieceId: string,
    status: PromoStatus
  ) => {
    const next = campaigns.map((campaign) => {
      if (campaign.id !== campaignId) return campaign;

      return {
        ...campaign,
        updatedAt: nowIso(),
        pieces: campaign.pieces.map((piece) =>
          piece.id === pieceId ? { ...piece, status } : piece
        ),
      };
    });

    persistCampaigns(next);
  };

  const campaignsFor = (p: Property) =>
    campaigns.filter((c) => c.propertyLocalId === p.id);

  return (
    <WRAP>
      <Board>
        <Button onClick={goBack} style={{ marginBottom: 20 }}>
          ← Volver a Skylines
        </Button>
        <HeroCard>
          <Tag>Falcon · propiedad viva</Tag>
          <Tag>Sin backend</Tag>
          <Tag>Propaganda local</Tag>

          <BigTitle>Propiedad → Nodo UTOPÝ → Propaganda Viva</BigTitle>

          <Small style={{ maxWidth: 920, marginTop: 12 }}>
            Cada propiedad genera un <b>ADN (.utopy.json)</b>, un QR para micro-OS
            local y una campaña de propaganda lista para usar: copys, guiones,
            fotos que faltan, instrucciones visuales y piezas por canal.
          </Small>
        </HeroCard>

        <SoftGrid>
          <StatBox>
            <StatLabel>Propiedades</StatLabel>
            <StatValue>{props.length}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Campañas</StatLabel>
            <StatValue>{promoStats.campaigns}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Piezas</StatLabel>
            <StatValue>{promoStats.pieces}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Listas</StatLabel>
            <StatValue>{promoStats.ready}</StatValue>
          </StatBox>
        </SoftGrid>

        <Card>
          <Title>{editingId ? "Editar propiedad" : "Crear propiedad"}</Title>

          <Row>
            <Input
              name="propertyId"
              placeholder="ID (ej: PROP-123)"
              value={form.propertyId}
              onChange={onChange}
            />

            <Input
              name="endpoint"
              placeholder="Endpoint local/bridge (opcional)"
              value={form.endpoint}
              onChange={onChange}
            />
          </Row>

          <div style={{ marginTop: 12 }}>
            <TextArea
              name="notes"
              placeholder="Descripción comercial para propaganda. Ej: Habitación amoblada cerca del Hospital Regional, con aire, wifi, estacionamiento y ambiente tranquilo..."
              value={form.notes}
              onChange={onChange}
            />
          </div>

          <Row style={{ marginTop: 12 }}>
            <Input
              name="alquilerGs"
              type="number"
              placeholder="Canon (Gs)"
              value={form.alquilerGs}
              onChange={onChange}
            />

            <Input
              name="kwhIncluido"
              type="number"
              placeholder="kWh incluido"
              value={form.kwhIncluido}
              onChange={onChange}
            />
          </Row>

          <Row>
            <Input
              name="excedenteGsPorKwh"
              type="number"
              placeholder="Gs por kWh extra"
              value={form.excedenteGsPorKwh}
              onChange={onChange}
            />

            <Input
              name="vencimientoDia"
              type="number"
              placeholder="Día de vencimiento (1–28)"
              value={form.vencimientoDia}
              onChange={onChange}
            />
          </Row>

          <Row>
            <Input
              name="graciaDias"
              type="number"
              placeholder="Días de gracia"
              value={form.graciaDias}
              onChange={onChange}
            />

            <Input
              name="secret"
              placeholder="Shared secret (opcional)"
              value={form.secret}
              onChange={onChange}
            />
          </Row>

          <Hr />

          <Small>
            <b>Módulos</b> — activá lo que tendrá esta propiedad:
          </Small>

          <InlineActions style={{ marginBottom: 10 }}>
            {(["door_lock", "meter", "camera"] as ModKind[]).map((mk) => {
              const on = form.modules.includes(mk);

              return (
                <Button
                  key={mk}
                  onClick={() => onToggleModule(mk)}
                  style={{
                    background: on
                      ? "linear-gradient(135deg,#0891b2,#0f766e)"
                      : "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.16)",
                  }}
                >
                  {on ? "✓ " : ""}
                  {moduleLabel(mk)}
                </Button>
              );
            })}
          </InlineActions>

          {form.modules.includes("door_lock") && (
            <MiniCard style={{ marginTop: 12 }}>
              <Title>PIN de puerta</Title>

              <Row>
                <Input
                  name="lockTipo"
                  placeholder="tipo (ej: tuya.lock)"
                  value={form.lockTipo}
                  onChange={onChange}
                />

                <Input
                  name="lockPinLen"
                  type="number"
                  placeholder="Longitud PIN"
                  value={form.lockPinLen}
                  onChange={onChange}
                />
              </Row>

              <Row>
                <Input
                  name="lockPinAutoExpira"
                  type="number"
                  placeholder="Auto-expira (días)"
                  value={form.lockPinAutoExpira}
                  onChange={onChange}
                />

                <div />
              </Row>
            </MiniCard>
          )}

          {form.modules.includes("meter") && (
            <MiniCard style={{ marginTop: 12 }}>
              <Title>Medidor</Title>

              <Row>
                <Input
                  name="meterTipo"
                  placeholder="tipo (ej: tuya.sinotimer.dds6619)"
                  value={form.meterTipo}
                  onChange={onChange}
                />

                <Select
                  name="meterIncluyeCorte"
                  value={String(!!form.meterIncluyeCorte)}
                  onChange={onChange}
                >
                  <option value="true">Con corte remoto</option>
                  <option value="false">Solo medición</option>
                </Select>
              </Row>
            </MiniCard>
          )}

          {form.modules.includes("camera") && (
            <MiniCard style={{ marginTop: 12 }}>
              <Title>Cámara</Title>

              <Row>
                <Input
                  name="cameraRtsp"
                  placeholder="rtsp://user:pass@ip:554/stream"
                  value={form.cameraRtsp}
                  onChange={onChange}
                />

                <Input
                  name="cameraRetencion"
                  type="number"
                  placeholder="Retención (días)"
                  value={form.cameraRetencion}
                  onChange={onChange}
                />
              </Row>

              <Row>
                <Input
                  name="cameraTipo"
                  placeholder="tipo (ej: onvif/rtsp)"
                  value={form.cameraTipo}
                  onChange={onChange}
                />

                <div />
              </Row>
            </MiniCard>
          )}

          <InlineActions style={{ marginTop: 14 }}>
            {editingId ? (
              <>
                <CyanButton onClick={handleUpdate}>Guardar cambios</CyanButton>
                <GhostButton onClick={cancelEdit}>Cancelar</GhostButton>
              </>
            ) : (
              <CyanButton onClick={handleCreate}>Crear propiedad</CyanButton>
            )}
          </InlineActions>
        </Card>

        <Card>
          <Title>Propiedades</Title>

          <Input
            placeholder="Filtrar por ID, nota, módulo o precio…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          {filtered.length === 0 && (
            <Small style={{ marginTop: 12 }}>No hay propiedades aún.</Small>
          )}

          {filtered.map((p) => {
            const adn = toADN(p);
            const ownCampaigns = campaignsFor(p);

            return (
              <Card key={p.id} style={{ marginTop: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 18 }}>{p.propertyId}</strong>
                    <Small>{propertyHeadline(p)}</Small>
                  </div>

                  <div>
                    {p.modules.map((m) => (
                      <Tag key={m}>{moduleLabel(m)}</Tag>
                    ))}
                  </div>
                </div>

                <Small>
                  <Muted>canon:</Muted> {gs(p.alquilerGs)} ·{" "}
                  <Muted>kWh incl.:</Muted> {p.kwhIncluido} ·{" "}
                  <Muted>excedente:</Muted> {gs(p.excedenteGsPorKwh)}/kWh
                </Small>

                {p.cameraRtsp && (
                  <Small>
                    <Muted>rtsp:</Muted> {p.cameraRtsp}
                  </Small>
                )}

                {p.endpoint && (
                  <Small>
                    <Muted>endpoint:</Muted> {p.endpoint}
                  </Small>
                )}

                {p.secret && (
                  <Small>
                    <Muted>secret:</Muted> ••••••••
                  </Small>
                )}

                {p.notes && (
                  <Small>
                    <Muted>nota:</Muted> {p.notes}
                  </Small>
                )}

                <Small>
                  <Muted>creado:</Muted> {new Date(p.createdAt).toLocaleString()} ·{" "}
                  <Muted>actualizado:</Muted>{" "}
                  {new Date(p.updatedAt).toLocaleString()}
                </Small>

                <Hr />

                <InlineActions>
                  <GhostButton onClick={() => startEdit(p)}>Editar</GhostButton>

                  <DangerButton onClick={() => handleDelete(p.id)}>
                    Eliminar
                  </DangerButton>

                  <GhostButton onClick={() => handleExportADN(p)}>
                    .utopy.json
                  </GhostButton>

                  <GreenButton onClick={() => openQR(p)}>QR ADN</GreenButton>

                  <PinkButton onClick={() => handleCreatePromo(p)}>
                    Crear propaganda
                  </PinkButton>

                  {ownCampaigns.length > 0 && (
                    <StatusPill $tone="info">
                      {ownCampaigns.length} campaña
                      {ownCampaigns.length === 1 ? "" : "s"}
                    </StatusPill>
                  )}
                </InlineActions>

                {qrFor?.id === p.id && (
                  <MiniCard style={{ marginTop: 12 }}>
                    <Small>
                      Escaneá este QR desde el micro-OS/resonador para absorber el
                      ADN.
                    </Small>

                    <div
                      style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 16,
                        display: "inline-block",
                        marginTop: 8,
                      }}
                    >
                      <QRCode value={JSON.stringify(adn)} size={180} />
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <GhostButton onClick={closeQR}>Cerrar QR</GhostButton>
                    </div>

                    <Mono>{JSON.stringify(adn, null, 2)}</Mono>
                  </MiniCard>
                )}
              </Card>
            );
          })}
        </Card>

        <Card>
          <Title>Propaganda viva</Title>

          <Small>
            Este panel no publica solo. Te dice <b>qué crear</b>, cómo grabarlo,
            qué texto usar y qué pieza falta para vender mejor. Todo queda local
            en Falcon.
          </Small>

          <SoftGrid style={{ marginTop: 14 }}>
            <StatBox>
              <StatLabel>Campañas</StatLabel>
              <StatValue>{promoStats.campaigns}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Piezas generadas</StatLabel>
              <StatValue>{promoStats.pieces}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Listas</StatLabel>
              <StatValue>{promoStats.ready}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Usadas</StatLabel>
              <StatValue>{promoStats.used}</StatValue>
            </StatBox>
          </SoftGrid>

          {campaigns.length === 0 ? (
            <MiniCard style={{ marginTop: 14 }}>
              <Small>
                Todavía no hay campañas. Tocá <b>Crear propaganda</b> en una
                propiedad.
              </Small>
            </MiniCard>
          ) : (
            campaigns.map((campaign) => {
              const isOpen = openCampaignId === campaign.id;

              return (
                <Card key={campaign.id} style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <Tag>Score {campaign.score}/100</Tag>
                      <Tag>{campaign.propertyId}</Tag>

                      <Title style={{ marginTop: 8 }}>{campaign.title}</Title>

                      <Small>{campaign.subtitle}</Small>
                      <Small>
                        <b>Ángulo:</b> {campaign.offerAngle}
                      </Small>
                    </div>

                    <InlineActions>
                      <GhostButton
                        onClick={() =>
                          setOpenCampaignId(isOpen ? null : campaign.id)
                        }
                      >
                        {isOpen ? "Cerrar" : "Ver piezas"}
                      </GhostButton>

                      <GhostButton
                        onClick={() =>
                          copyText(campaignToText(campaign))
                        }
                      >
                        Copiar todo
                      </GhostButton>

                      <GhostButton
                        onClick={() =>
                          downloadText(
                            campaignToText(campaign),
                            `${campaign.propertyId}.propaganda.txt`
                          )
                        }
                      >
                        Export .txt
                      </GhostButton>

                      <GhostButton
                        onClick={() =>
                          downloadJSON(
                            campaign,
                            `${campaign.propertyId}.utopy.promo.json`
                          )
                        }
                      >
                        .promo.json
                      </GhostButton>

                      <DangerButton
                        onClick={() => handleDeleteCampaign(campaign.id)}
                      >
                        Eliminar
                      </DangerButton>
                    </InlineActions>
                  </div>

                  <Three style={{ marginTop: 14 }}>
                    <MiniCard>
                      <StatusPill $tone="warn">Diagnóstico</StatusPill>
                      {campaign.diagnosis.map((x, i) => (
                        <Small key={i}>• {x}</Small>
                      ))}
                    </MiniCard>

                    <MiniCard>
                      <StatusPill $tone="info">Falta crear</StatusPill>
                      {campaign.missingAssets.slice(0, 5).map((x, i) => (
                        <Small key={i}>• {x}</Small>
                      ))}
                    </MiniCard>

                    <MiniCard>
                      <StatusPill $tone="ok">Instrucción madre</StatusPill>
                      {campaign.globalInstructions.slice(0, 5).map((x, i) => (
                        <Small key={i}>• {x}</Small>
                      ))}
                    </MiniCard>
                  </Three>

                  {isOpen && (
                    <div style={{ marginTop: 14 }}>
                      {campaign.pieces.map((piece) => (
                        <PieceCard key={piece.id} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <StatusPill
                                $tone={
                                  piece.status === "ready" ||
                                  piece.status === "used"
                                    ? "ok"
                                    : piece.status === "to_create"
                                    ? "warn"
                                    : "info"
                                }
                              >
                                {piece.channel} · {piece.status}
                              </StatusPill>

                              <h3 style={{ margin: "10px 0 4px" }}>
                                {piece.title}
                              </h3>

                              <Small>
                                <b>Formato:</b> {piece.format}
                              </Small>

                              <Small>
                                <b>Objetivo:</b> {piece.objective}
                              </Small>
                            </div>

                            <InlineActions>
                              <Select
                                value={piece.status}
                                onChange={(e) =>
                                  updatePieceStatus(
                                    campaign.id,
                                    piece.id,
                                    e.target.value as PromoStatus
                                  )
                                }
                                style={{ width: 150 }}
                              >
                                <option value="idea">Idea</option>
                                <option value="to_create">Por crear</option>
                                <option value="ready">Lista</option>
                                <option value="used">Usada</option>
                              </Select>

                              <GhostButton
                                onClick={() =>
                                  copyText(
                                    [
                                      `CANAL: ${piece.channel}`,
                                      `FORMATO: ${piece.format}`,
                                      "",
                                      `GANCHO: ${piece.hook}`,
                                      "",
                                      `COPY:`,
                                      piece.caption,
                                      "",
                                      `CTA: ${piece.cta}`,
                                      "",
                                      piece.hashtags.join(" "),
                                    ].join("\n")
                                  )
                                }
                              >
                                Copiar copy
                              </GhostButton>
                            </InlineActions>
                          </div>

                          <Hr />

                          <Three>
                            <MiniCard>
                              <StatusPill $tone="info">Gancho</StatusPill>
                              <Small>{piece.hook}</Small>

                              <Hr />

                              <StatusPill $tone="ok">CTA</StatusPill>
                              <Small>{piece.cta}</Small>
                            </MiniCard>

                            <MiniCard>
                              <StatusPill $tone="warn">Caption / copy</StatusPill>
                              <Mono>{piece.caption}</Mono>
                            </MiniCard>

                            <MiniCard>
                              <StatusPill $tone="info">Hashtags</StatusPill>
                              <Small>{piece.hashtags.join(" ")}</Small>
                            </MiniCard>
                          </Three>

                          <Three style={{ marginTop: 12 }}>
                            <MiniCard>
                              <StatusPill $tone="info">Guión</StatusPill>
                              {piece.script.map((x, i) => (
                                <Small key={i}>• {x}</Small>
                              ))}
                            </MiniCard>

                            <MiniCard>
                              <StatusPill $tone="warn">Visual</StatusPill>
                              {piece.visualInstructions.map((x, i) => (
                                <Small key={i}>• {x}</Small>
                              ))}
                            </MiniCard>

                            <MiniCard>
                              <StatusPill $tone="ok">Tomas / assets</StatusPill>
                              {piece.shotList.map((x, i) => (
                                <Small key={i}>• {x}</Small>
                              ))}
                            </MiniCard>
                          </Three>
                        </PieceCard>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </Card>
      </Board>
    </WRAP>
  );
}