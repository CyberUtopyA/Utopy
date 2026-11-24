// utils/contrato.ts
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/* =========================
   Tipos
   ========================= */
export type CurrencyCode = "PYG" | "USD" | "ARS" | "BRL";

export interface Arrendador {
  nombreCompleto: string;
  documento: string;
  domicilio: string;
  email?: string;
}

export interface Arrendatario {
  nombreCompleto: string;
  documento: string;
  domicilio: string;
  telefono?: string;
  email?: string;
}

export interface Inmueble {
  tipo: string;
  numeroUnidad?: string | number;
  direccion: string;
  ciudad: string;
  descripcion?: string;
}

export interface Contrato {
  inicio: string;
  fin?: string;
  plazoMeses?: string | number;
  moneda: string | CurrencyCode;
  canon: string | number;
  diaVencimiento?: string | number;

  /** garantía / depósito (si viene vacío => renuncia) */
  deposito?: string | number;

  incluyeServicios?: string;
  politicaMascotas?: string;
  lecturaMedidores?: string;
  inventario?: string;
  clausulasAdicionales?: string;
  regimenMora?: string;
  condicionesGarantia?: string;
  preaviso?: string;
  jurisdiccion?: string;
  obligacionesLocador?: string;
  obligacionesLocatario?: string;
}

/** Firmas opcionales (si las cargás desde tu UI) */
export interface Signatures {
  locadorDataUrl?: string;
  locatarioDataUrl?: string;
  signedAt?: string; // ISO
}

/** PAGARÉ opcional */
export interface Pagare {
  enabled?: boolean;
  monto?: string | number; // si no se setea, usa deposito o 0
  moneda?: string | CurrencyCode; // default contrato.moneda
  vencimiento?: string; // YYYY-MM-DD (opcional)
  lugarPago?: string; // opcional
  clausula?: string; // texto opcional extra del pagaré
}

export interface Draft {
  arrendador: Arrendador;
  arrendatario: Arrendatario;
  inmueble: Inmueble;
  contrato: Contrato;
  firmas?: Signatures;
  pagare?: Pagare;
}

/* =========================
   Helpers
   ========================= */
const safeStr = (v: unknown, fallback = ""): string =>
  (typeof v === "string" ? v : v == null ? "" : String(v)).trim() || fallback;
function buildPagareNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900 + 100); // 100–999
  return `Pagaré Nº ${seq}-${year}`;
}

const onlyDigits = (v: unknown): string => safeStr(v).replace(/\D+/g, "");

const numFrom = (v: unknown, def = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = safeStr(v);
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : def;
};

export function currencyFromMoneda(moneda: string): CurrencyCode {
  const m = safeStr(moneda).toLowerCase();
  if (m.includes("gs") || m.includes("pyg") || m.includes("guaran")) return "PYG";
  if (m.includes("usd") || m.includes("$")) return "USD";
  if (m.includes("ars")) return "ARS";
  if (m.includes("brl") || m.includes("r$")) return "BRL";
  return "PYG";
}

function randomId(len = 10) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (const n of arr) out += abc[n % abc.length];
  return out;
}

/** Link compacto para QR */
export function buildShareLink(draft: Draft): string {
  const id = randomId(12);
  try {
    localStorage.setItem(`contract:${id}`, JSON.stringify(draft));
  } catch {}
  return `${window.location.origin}${window.location.pathname}#cid=${id}`;
}

export function fmtMoney(moneda: string, valor: string | number): string {
  const num = numFrom(valor, 0);
  const code = currencyFromMoneda(moneda);
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "PYG" ? 0 : 2,
    }).format(num);
  } catch {
    return `${code === "PYG" ? "Gs." : moneda} ${num.toLocaleString("es-PY")}`.trim();
  }
}

export function calcFin(inicio: string, meses: string | number): string {
  const start = safeStr(inicio);
  if (!start) return "";
  const m = Number(meses);
  if (!Number.isFinite(m)) return "";
  const d = new Date(`${start}T00:00:00`);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

function todayPY(): string {
  return new Date().toLocaleDateString("es-PY");
}

/* =========================
   Texto legal (profesional)
   ========================= */
export function buildContractText(input: Draft): string {
  const arrendador: Arrendador = {
    nombreCompleto: safeStr(input.arrendador?.nombreCompleto, "[Arrendador]"),
    documento: onlyDigits(input.arrendador?.documento) || "[doc]",
    domicilio: safeStr(input.arrendador?.domicilio, "[domicilio]"),
    email: safeStr(input.arrendador?.email),
  };

  const arrendatario: Arrendatario = {
    nombreCompleto: safeStr(input.arrendatario?.nombreCompleto, "[Arrendatario]"),
    documento: onlyDigits(input.arrendatario?.documento) || "[doc]",
    domicilio: safeStr(input.arrendatario?.domicilio, "[domicilio]"),
    telefono: safeStr(input.arrendatario?.telefono),
    email: safeStr(input.arrendatario?.email),
  };

  const inmueble: Inmueble = {
    tipo: safeStr(input.inmueble?.tipo, "inmueble"),
    numeroUnidad: input.inmueble?.numeroUnidad,
    direccion: safeStr(input.inmueble?.direccion, "—"),
    ciudad: safeStr(input.inmueble?.ciudad, "Asunción"),
    descripcion: safeStr(input.inmueble?.descripcion),
  };

  const contrato: Contrato = {
    inicio: safeStr(input.contrato?.inicio),
    fin: safeStr(
      input.contrato?.fin ||
        (input.contrato?.plazoMeses ? calcFin(input.contrato?.inicio, input.contrato?.plazoMeses) : "")
    ),
    plazoMeses: input.contrato?.plazoMeses != null ? Number(input.contrato.plazoMeses) : undefined,
    moneda: safeStr(input.contrato?.moneda || "PYG"),
    canon: numFrom(input.contrato?.canon, 0),
    diaVencimiento: input.contrato?.diaVencimiento != null ? Number(input.contrato.diaVencimiento) : 5,
    deposito: input.contrato?.deposito,
    incluyeServicios: safeStr(input.contrato?.incluyeServicios, "No especificado"),
    politicaMascotas: safeStr(input.contrato?.politicaMascotas, "No especificado"),
    lecturaMedidores: safeStr(input.contrato?.lecturaMedidores),
    inventario: safeStr(input.contrato?.inventario),
    clausulasAdicionales: safeStr(input.contrato?.clausulasAdicionales),
    regimenMora:safeStr(input.contrato?.regimenMora),
    condicionesGarantia:safeStr(input.contrato?.condicionesGarantia),
    preaviso:safeStr(input.contrato?.preaviso),
    jurisdiccion:safeStr(input.contrato?.jurisdiccion),
  };

  const hoy = todayPY();
  const inicioTxt = contrato.inicio || "—";
  const finTxt = contrato.fin || "—";

  const plazoTxt =
    contrato.plazoMeses != null && Number(contrato.plazoMeses) > 0 ? String(contrato.plazoMeses) : "—";

  const unidad =
    inmueble.numeroUnidad !== undefined && inmueble.numeroUnidad !== null && `${inmueble.numeroUnidad}` !== ""
      ? `, unidad ${String(inmueble.numeroUnidad)}`
      : "";

  const objeto = `${inmueble.tipo}${unidad}, ubicado en ${inmueble.direccion}, ${inmueble.ciudad}.`;

  const canonFmt = fmtMoney(String(contrato.moneda), contrato.canon);

  const garantiaNum =
    contrato.deposito != null && safeStr(contrato.deposito) !== "" ? numFrom(contrato.deposito, 0) : 0;

  const garantiaFmt =
    garantiaNum > 0 ? fmtMoney(String(contrato.moneda), garantiaNum) : "No aplica (renunciada expresamente por el LOCADOR)";

  let t = "";
  t += "CONTRATO PRIVADO DE LOCACIÓN DE INMUEBLE\n\n";
  t += `En la ciudad de ${inmueble.ciudad}, a los ${hoy}.\n\n`;

  t += "PARTES:\n";
  t += `1) LOCADOR: ${arrendador.nombreCompleto}, C.I./RUC Nº ${arrendador.documento}, domicilio ${arrendador.domicilio}.`;
  if (arrendador.email) t += ` Email: ${arrendador.email}.`;
  t += "\n";
  t += `2) LOCATARIO: ${arrendatario.nombreCompleto}, C.I./RUC Nº ${arrendatario.documento}, domicilio ${arrendatario.domicilio}.`;
  if (arrendatario.telefono) t += ` Tel: ${arrendatario.telefono}.`;
  if (arrendatario.email) t += ` Email: ${arrendatario.email}.`;
  t += "\n\n";

  t += "CLÁUSULAS:\n\n";

  t += `PRIMERA — Objeto: El LOCADOR da en locación al LOCATARIO el ${objeto}\n`;
  if (inmueble.descripcion) t += `Descripción: ${inmueble.descripcion}\n`;
  t += "\n";

  t += `SEGUNDA — Plazo: ${plazoTxt} meses, desde el ${inicioTxt} hasta el ${finTxt}. Renovable por acuerdo escrito.\n\n`;

  t += `TERCERA — Canon, vencimiento y mora: El canon es de ${canonFmt} mensuales, pagaderos hasta el día ${String(
    contrato.diaVencimiento
  )} de cada mes. Régimen de mora: ${safeStr(contrato.regimenMora, "se aplicará únicamente lo expresamente acordado por las partes y permitido por la normativa aplicable")}.\n\n`;

  t += `CUARTA — Garantía: ${garantiaFmt}. `;
  if (garantiaNum > 0) {
    t +=
      `${safeStr(contrato.condicionesGarantia, "La garantía podrá aplicarse únicamente para cubrir daños, faltantes, deterioro por mal uso, limpieza extraordinaria o incumplimientos comprobados al momento de la entrega.")} ` +
      "Si la entrega final se realiza en orden, el LOCADOR no exigirá cobro alguno por este concepto.\n\n";
  } else {
    t += "El LOCADOR renuncia expresamente a exigir depósito o garantía.\n\n";
  }

  t += `QUINTA — Servicios: ${contrato.incluyeServicios}.\n\n`;
  t += `SEXTA — Mascotas: ${contrato.politicaMascotas}.\n\n`;

  if (contrato.lecturaMedidores) t += `SÉPTIMA — Lectura de medidores / servicios: ${contrato.lecturaMedidores}.\n\n`;
  if (contrato.inventario) t += `OCTAVA — Inventario de entrega: ${contrato.inventario}.\n\n`;

  t +=
    `NOVENA — Reparaciones y mantenimiento: Serán de cargo del LOCATARIO los daños comprobablemente atribuibles a mal uso, negligencia, convivientes, invitados, pérdida de llaves, daños en cerraduras, vidrios, muebles, equipamiento, obstrucciones por uso incorrecto o modificaciones no autorizadas. El desgaste normal, los defectos preexistentes y las reparaciones estructurales no imputables al LOCATARIO no se considerarán daño suyo. La atribución podrá documentarse con fotografías, observaciones e inventarios inicial y final.\n\n`;

  t += `DÉCIMA — Obligaciones del LOCATARIO: ${safeStr(contrato.obligacionesLocatario, "uso diligente, conservación, limpieza, destino convenido, convivencia, comunicación de averías, prohibición de actividades ilícitas y modificaciones no autorizadas, restitución de llaves e inmueble y responsabilidad por daños atribuibles")}.\n\n`;

  t += `DÉCIMA PRIMERA — Obligaciones del LOCADOR: ${safeStr(contrato.obligacionesLocador, "entregar la unidad, respetar el uso convenido, recibir comunicaciones, reconocer pagos, atender las reparaciones que no correspondan al LOCATARIO y devolver la garantía cuando proceda")}.\n\n`;

  t +=
    "DÉCIMA SEGUNDA — Incumplimiento: La falta de pago, el uso indebido, los daños atribuibles o el incumplimiento grave de las condiciones pactadas permitirán ejercer los derechos de resolución conforme al contrato y al marco jurídico aplicable.\n\n";

  t +=
    `DÉCIMA TERCERA — Rescisión y terminación: El preaviso será ${safeStr(contrato.preaviso, "el acordado por las partes antes de la firma")}. Al finalizar deberán regularizarse obligaciones pendientes, documentarse el estado final y el inventario, y restituirse inmueble y llaves.\n\n`;

  if (contrato.clausulasAdicionales) {
    t += `DÉCIMA CUARTA — Cláusulas adicionales: ${contrato.clausulasAdicionales}\n\n`;
  }

  t += `JURISDICCIÓN: Las partes se someten a los tribunales competentes de ${safeStr(contrato.jurisdiccion, inmueble.ciudad)}.\n`;

  return t;
}

/* =========================
   Build Draft desde inputs
   ========================= */
export interface BuildDraftOwner {
  nombreCompleto: string;
  documento: string;
  domicilio: string;
  email?: string;
}
export interface BuildDraftTenant {
  nombreCompleto: string;
  documento: string;
  domicilio: string;
  email?: string;
  telefono?: string;
}
export interface BuildDraftProperty {
  direccion: string;
  ciudad: string;
  tipo?: string;
  numeroUnidad?: string | number;
  descripcion?: string;
}
export interface BuildDraftContrato {
  inicio: string;
  fin?: string;
  plazoMeses?: string | number;
  moneda?: string | CurrencyCode;
  canon: string | number;
  diaVencimiento?: string | number;
  deposito?: string | number;
  incluyeServicios?: string;
  politicaMascotas?: string;
  lecturaMedidores?: string;
  inventario?: string;
  clausulasAdicionales?: string;
}
export interface BuildDraftPagare {
  enabled?: boolean;
  monto?: string | number;
  moneda?: string | CurrencyCode;
  vencimiento?: string;
  lugarPago?: string;
  clausula?: string;
}

export function buildDraftFromInputs(params: {
  ownerRaw: BuildDraftOwner;
  tenant: BuildDraftTenant;
  property: BuildDraftProperty;
  contrato: BuildDraftContrato;
  pagare?: BuildDraftPagare;
  firmas?: Signatures;
}): Draft {
  const owner: Arrendador = {
    nombreCompleto: safeStr(params.ownerRaw?.nombreCompleto),
    documento: onlyDigits(params.ownerRaw?.documento),
    domicilio: safeStr(params.ownerRaw?.domicilio),
    email: safeStr(params.ownerRaw?.email),
  };

  const tenant: Arrendatario = {
    nombreCompleto: safeStr(params.tenant?.nombreCompleto),
    documento: onlyDigits(params.tenant?.documento),
    domicilio: safeStr(params.tenant?.domicilio),
    telefono: safeStr(params.tenant?.telefono),
    email: safeStr(params.tenant?.email),
  };

  const prop: Inmueble = {
    tipo: safeStr(params.property?.tipo, "pieza"),
    numeroUnidad: params.property?.numeroUnidad,
    direccion: safeStr(params.property?.direccion, "—"),
    ciudad: safeStr(params.property?.ciudad, "Asunción"),
    descripcion: safeStr(params.property?.descripcion),
  };

  const c: Contrato = {
    inicio: safeStr(params.contrato?.inicio),
    fin: safeStr(params.contrato?.fin || ""),
    plazoMeses: params.contrato?.plazoMeses,
    moneda: safeStr(params.contrato?.moneda || "PYG"),
    canon: numFrom(params.contrato?.canon, 0),
    diaVencimiento: params.contrato?.diaVencimiento != null ? Number(params.contrato?.diaVencimiento) : 5,
    deposito: params.contrato?.deposito,
    incluyeServicios: safeStr(params.contrato?.incluyeServicios),
    politicaMascotas: safeStr(params.contrato?.politicaMascotas),
    lecturaMedidores: safeStr(params.contrato?.lecturaMedidores),
    inventario: safeStr(params.contrato?.inventario),
    clausulasAdicionales: safeStr(params.contrato?.clausulasAdicionales),
    regimenMora:safeStr(params.contrato?.regimenMora),
    condicionesGarantia:safeStr(params.contrato?.condicionesGarantia),
    preaviso:safeStr(params.contrato?.preaviso),
    jurisdiccion:safeStr(params.contrato?.jurisdiccion),
  };

  if (!c.fin && c.inicio && c.plazoMeses) c.fin = calcFin(c.inicio, c.plazoMeses);

  const pagare: Pagare | undefined = params.pagare
    ? {
        enabled: !!params.pagare.enabled,
        monto: params.pagare.monto,
        moneda: params.pagare.moneda,
        vencimiento: safeStr(params.pagare.vencimiento),
        lugarPago: safeStr(params.pagare.lugarPago),
        clausula: safeStr(params.pagare.clausula),
      }
    : undefined;

  return {
    arrendador: owner,
    arrendatario: tenant,
    inmueble: prop,
    contrato: c,
    firmas: params.firmas,
    pagare,
  };
}

/* =========================
   Render PDF helpers
   ========================= */
function addHeader(doc: jsPDF, title: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text(title, pageW / 2, 14, { align: "center" });
  doc.setFontSize(10);
}

function addFooterPageNumber(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const page = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.text(`Página ${page}`, pageW / 2, pageH - 8, { align: "center" });
}

/** ✅ Ahora acepta pageTitle para que el pagaré no se imprima como "CONTRATO" */
function writeBody(doc: jsPDF, text: string, pageTitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 15;
  const topY = 22;
  const bottomY = pageH - 18;
  const maxW = pageW - marginX * 2;

  doc.setFont("times", "normal");
  doc.setFontSize(11);

  const paragraphs = text.split("\n").map((s) => s.trimEnd());

  let y = topY;
  const lineHeight = 5.2;

  const newPage = () => {
    addFooterPageNumber(doc);
    doc.addPage();
    addHeader(doc, pageTitle);
    y = topY;
  };

  for (const p of paragraphs) {
    if (!p.trim()) {
      y += lineHeight;
      if (y > bottomY) newPage();
      continue;
    }

    const lines = doc.splitTextToSize(p, maxW) as string[];
    for (const ln of lines) {
      if (y > bottomY) newPage();
      doc.text(ln, marginX, y);
      y += lineHeight;
    }
  }

  addFooterPageNumber(doc);
}

/* =========================
   Página QR + Firmas
   ========================= */
async function addQRAndSignPage(doc: jsPDF, draft: Draft, shareLink: string) {
  doc.addPage();
  addHeader(doc, "ANEXO — QR Y FIRMAS");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const qrPng = await QRCode.toDataURL(shareLink, { margin: 1, width: 260 });
  const qrSize = 70;

  const qrX = (pageW - qrSize) / 2;
  const qrY = 30;

  doc.setFontSize(10);
  doc.text("Escaneá este QR para abrir el contrato y ver el borrador guardado.", pageW / 2, 24, { align: "center" });
  doc.addImage(qrPng, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFontSize(8);
  doc.textWithLink(shareLink, pageW / 2, qrY + qrSize + 10, { url: shareLink, align: "center" });

  // Firmas
  const sigY = qrY + qrSize + 28;
  const boxW = 75;
  const boxH = 22;

  const leftX = 20;
  const rightX = pageW - boxW - 20;

  doc.setFontSize(10);
  doc.text("LOCADOR", leftX + boxW / 2, sigY - 6, { align: "center" });
  doc.text("LOCATARIO", rightX + boxW / 2, sigY - 6, { align: "center" });

  doc.rect(leftX, sigY, boxW, boxH);
  doc.rect(rightX, sigY, boxW, boxH);

  const locSig = draft?.firmas?.locadorDataUrl || "";
  const tenSig = draft?.firmas?.locatarioDataUrl || "";

  try {
    if (locSig.startsWith("data:image/")) doc.addImage(locSig, "PNG", leftX + 2, sigY + 2, boxW - 4, boxH - 4);
  } catch {}

  try {
    if (tenSig.startsWith("data:image/")) doc.addImage(tenSig, "PNG", rightX + 2, sigY + 2, boxW - 4, boxH - 4);
  } catch {}

  doc.setFontSize(9);
  doc.text(`${draft.arrendador?.nombreCompleto || "LOCADOR"}`, leftX, sigY + boxH + 10);
  doc.text(`${draft.arrendatario?.nombreCompleto || "LOCATARIO"}`, rightX, sigY + boxH + 10);

  doc.setFontSize(8);
  doc.text("Firma:", leftX, sigY + boxH + 18);
  doc.text("Firma:", rightX, sigY + boxH + 18);

  const signedAt = draft?.firmas?.signedAt;
  if (signedAt) {
    doc.setFontSize(8);
    doc.text(`Firmado: ${new Date(signedAt).toLocaleString("es-PY")}`, 15, pageH - 16);
  }

  addFooterPageNumber(doc);
}
function addPagareSignatures(
  doc: jsPDF,
  draft: Draft,
  startY: number
) {
  const pageW = doc.internal.pageSize.getWidth();

  const boxW = 75;
  const boxH = 22;
  const leftX = 20;
  const rightX = pageW - boxW - 20;
  const sigY = startY;

  doc.setFontSize(10);
  doc.text("BENEFICIARIO (LOCADOR)", leftX + boxW / 2, sigY - 6, { align: "center" });
  doc.text("SUSCRIPTOR (LOCATARIO)", rightX + boxW / 2, sigY - 6, { align: "center" });

  doc.rect(leftX, sigY, boxW, boxH);
  doc.rect(rightX, sigY, boxW, boxH);

  const locSig = draft?.firmas?.locadorDataUrl || "";
  const tenSig = draft?.firmas?.locatarioDataUrl || "";

  try {
    if (locSig.startsWith("data:image/")) {
      doc.addImage(locSig, "PNG", leftX + 2, sigY + 2, boxW - 4, boxH - 4);
    }
  } catch {}

  try {
    if (tenSig.startsWith("data:image/")) {
      doc.addImage(tenSig, "PNG", rightX + 2, sigY + 2, boxW - 4, boxH - 4);
    }
  } catch {}

  doc.setFontSize(9);
  doc.text(draft.arrendador.nombreCompleto || "LOCADOR", leftX, sigY + boxH + 8);
  doc.text(draft.arrendatario.nombreCompleto || "LOCATARIO", rightX, sigY + boxH + 8);

  doc.setFontSize(8);
  doc.text("Firma:", leftX, sigY + boxH + 14);
  doc.text("Firma:", rightX, sigY + boxH + 14);
}

/* =========================
   Pagaré (opcional)
   ========================= */
function buildPagareText(draft: Draft): string {
  const a = draft.arrendador;
  const t = draft.arrendatario;
  const c = draft.contrato;
  const p = draft.pagare;

  const numeroPagare = buildPagareNumber();
  const moneda = currencyFromMoneda(String(p?.moneda || c.moneda || "PYG"));

  const monto =
    p?.monto != null && safeStr(p.monto) !== ""
      ? numFrom(p.monto, 0)
      : (c.deposito != null ? numFrom(c.deposito, 0) : 0);

  const montoFmt = fmtMoney(moneda, monto);

  const hoy = todayPY();
  const vencimiento = safeStr(p?.vencimiento, "A determinar");
  const lugarPago = safeStr(p?.lugarPago, "República del Paraguay");

  let x = "";
  x += `${numeroPagare}\n`;
  x += "PAGARÉ A LA ORDEN\n\n";

  x += `En la ciudad de ${lugarPago}, República del Paraguay, a los ${hoy}, `;
  x += `YO, ${t.nombreCompleto}, con C.I. Nº ${onlyDigits(t.documento)}, `;
  x += `me obligo en forma irrevocable e incondicional a pagar `;
  x += `A LA ORDEN DE ${a.nombreCompleto}, C.I./RUC Nº ${onlyDigits(a.documento)}, `;
  x += `la suma de ${montoFmt} (${moneda}), `;
  x += `pagadera en dinero efectivo y de curso legal.\n\n`;

  x += `VENCIMIENTO: ${vencimiento}.\n`;
  x += `LUGAR DE PAGO: ${lugarPago}.\n\n`;

  x +=
    "El presente pagaré se emite en garantía del CONTRATO DE LOCACIÓN DE INMUEBLE ";
  x +=
    "suscripto entre las partes, y sólo será exigible en caso de ";
  x +=
    "incumplimiento contractual, daños comprobados, faltantes, deterioro por mal uso ";
  x +=
    "o entrega del inmueble en condiciones distintas a las recibidas, ";
  x +=
    "conforme acta de entrega y verificación.\n\n";

  if (p?.clausula) {
    x += `CLÁUSULA ESPECIAL: ${p.clausula}\n\n`;
  }

  x +=
    "Este pagaré no podrá ejecutarse si el inmueble es entregado ";
  x +=
    "en condiciones normales de uso, limpio y con todas las obligaciones ";
  x +=
    "contractuales cumplidas.\n\n";

  return x;
}


/* =========================
   Generar y descargar PDF
   ========================= */
export async function generateContractPDFFromDraftWithQR(draft: Draft, secureShareLink?: string): Promise<{blob:Blob;fileName:string}> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Contrato
  addHeader(doc, "CONTRATO DE LOCACIÓN");
  const body = buildContractText(draft);
  writeBody(doc, body, "CONTRATO DE LOCACIÓN");

  // Link + QR (borrador guardado)
  // Los contratos nuevos reciben una capacidad temporal opaca. El fallback
  // conserva compatibilidad con documentos históricos ya generados.
  const shareLink = secureShareLink || buildShareLink(draft);

  // Página aparte: QR + firmas
  await addQRAndSignPage(doc, draft, shareLink);

 // Página opcional: Pagaré (con firmas)
if (draft.pagare?.enabled) {
  doc.addPage();
  addHeader(doc, "ANEXO — PAGARÉ");

  const pagareText = buildPagareText(draft);
  writeBody(doc, pagareText, "ANEXO — PAGARÉ");

  // Firmas visuales del pagaré
  const pageH = doc.internal.pageSize.getHeight();
  addPagareSignatures(doc, draft, pageH - 60);

  addFooterPageNumber(doc);
}

  const fName =
    "Contrato-" +
    (draft.arrendador.nombreCompleto || "Arrendador").replace(/\s+/g, "_") +
    "-" +
    (draft.arrendatario.nombreCompleto || "Arrendatario").replace(/\s+/g, "_") +
    ".pdf";

  doc.save(fName);
  return {blob:doc.output('blob'),fileName:fName};
}
