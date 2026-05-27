import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Sidebar from "../components/sidebar";

/**
 * CONTRATO: flujo sin login ni base de datos
 * - Dos formularios: Arrendador y Arrendatario (switch en la UI)
 * - Guarda borrador en localStorage (clave: contratoDraft)
 * - Genera vista previa de contrato y permite imprimir/guardar como PDF (Ctrl/Cmd+P)
 * - Enlace compartible sin backend: serializa datos en la URL (#contrato=<base64url>)
 */

// ===== Estilos base (reusa la estética de tu Login) =====
const GlassContainer = styled.div`
  height: 100vh;
  width: 100vw;
  background: linear-gradient(145deg, #0f2027, #203a43, #2c5364);
  display: flex;
`;

const BodyWrap = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 32px 24px;
  overflow: auto;
`;

const Card = styled.div`
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 24px;
  width: 100%;
  max-width: 1120px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
`;

const Title = styled.h2`
  margin-bottom: 16px;
  font-size: 28px;
  font-weight: bold;
`;

const Row = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(12, 1fr);
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Col = styled.div<{ span?: number }>`
  grid-column: span ${(p) => p.span || 12};
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  &::placeholder { color: #ccc; }
  &:focus { outline: none; background-color: rgba(255, 255, 255, 0.3); }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  min-height: 96px;
  &::placeholder { color: #ccc; }
  &:focus { outline: none; background-color: rgba(255, 255, 255, 0.3); }
`;

const Label = styled.label`
  font-size: 13px;
  color: #e7f6ff;
  display: block;
  margin-bottom: 6px;
`;

const Button = styled.button<{ variant?: "solid" | "ghost" }>`
  padding: 12px 16px;
  border: ${(p) => (p.variant === "ghost" ? "1px solid rgba(255,255,255,0.5)" : "none")};
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  background: ${(p) => (p.variant === "ghost" ? "transparent" : "#000")};
  color: #fff;
  cursor: pointer;
  transition: 0.2s ease;
  &:hover { opacity: 0.9; }
`;

const Segmented = styled.div`
  display: inline-flex;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 12px;
  overflow: hidden;
`;

const SegmentBtn = styled.button<{ active?: boolean }>`
  padding: 10px 14px;
  font-weight: 700;
  color: ${(p) => (p.active ? "#0f2027" : "#fff")};
  background: ${(p) => (p.active ? "#fff" : "transparent")};
  border: none;
  cursor: pointer;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(255,255,255,0.25);
  margin: 16px 0 24px;
`;

const Help = styled.p`
  font-size: 13px;
  color: #cfe9ff;
  margin: 8px 0 0;
`;

// ===== Datos =====
export type Parte = "arrendador" | "arrendatario";

type DatosPersona = {
  nombreCompleto: string;
  documento: string; // CI/RUC/Pasaporte
  domicilio: string;
  telefono: string;
  email: string;
};

type DatosInmueble = {
  direccion: string;
  ciudad: string;
  tipo: string; // dpto, monoambiente, casa, etc.
  numeroUnidad?: string;
  descripcion?: string;
};

type DatosContrato = {
  canon: string; // monto
  moneda: string; // Gs, USD
  deposito: string; // monto o vacío
  diaVencimiento: string; // 1-31
  plazoMeses: string; // ej 12
  inicio: string; // yyyy-mm-dd
  incluyeServicios: string; // texto breve
  politicaMascotas: string; // permitido/no y condiciones
  lecturaMedidores?: string; // opcional
  inventario?: string; // opcional
  clausulasAdicionales?: string; // opcional
};

export type Draft = {
  parteActual: Parte;
  arrendador: DatosPersona;
  arrendatario: DatosPersona;
  inmueble: DatosInmueble;
  contrato: DatosContrato;
};

const baseDraft: Draft = {
  parteActual: "arrendador",
  arrendador: { nombreCompleto: "", documento: "", domicilio: "", telefono: "", email: "" },
  arrendatario: { nombreCompleto: "", documento: "", domicilio: "", telefono: "", email: "" },
  inmueble: { direccion: "", ciudad: "Asunción", tipo: "Monoambiente", numeroUnidad: "", descripcion: "" },
  contrato: {
    canon: "",
    moneda: "Gs",
    deposito: "",
    diaVencimiento: "5",
    plazoMeses: "12",
    inicio: "",
    incluyeServicios: "Agua, expensas comunes (si aplican)",
    politicaMascotas: "Permitidas bajo responsabilidad del arrendatario; daños a su cargo.",
    lecturaMedidores: "",
    inventario: "",
    clausulasAdicionales: ""
  }
};

// ===== Utilidades (share link sin backend) =====
function b64urlEncode(obj: unknown): string {
  const s = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(s))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function b64urlDecode<T = unknown>(b64: string): T | null {
  try {
    const norm = b64.replaceAll("-", "+").replaceAll("_", "/");
    const s = decodeURIComponent(escape(atob(norm)));
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ===== Vista previa del contrato =====
const PreviewWrap = styled.div`
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 14px;
  padding: 18px;
  color: #f5fbff;
  line-height: 1.5;
`;

function ContratoPreview({ data }: { data: Draft }) {
  const { arrendador, arrendatario, inmueble, contrato } = data;
  const fechaFin = useMemo(() => {
    try {
      if (!contrato.inicio || !contrato.plazoMeses) return "";
      const d = new Date(contrato.inicio + "T00:00:00");
      d.setMonth(d.getMonth() + Number(contrato.plazoMeses));
      return d.toISOString().slice(0, 10);
    } catch { return ""; }
  }, [contrato.inicio, contrato.plazoMeses]);

  return (
    <PreviewWrap>
      <h3 style={{ marginTop: 0 }}>Contrato de Arrendamiento</h3>
      <p>
        Entre <b>{arrendador.nombreCompleto || "[Arrendador]"}</b>, CI/RUC {arrendador.documento || "[doc]"}, con domicilio en {arrendador.domicilio || "[domicilio]"}, teléfono {arrendador.telefono || "[tel]"}, correo {arrendador.email || "[email]"} (en adelante, el <b>ARRENDADOR</b>);
        y <b>{arrendatario.nombreCompleto || "[Arrendatario]"}</b>, CI/RUC {arrendatario.documento || "[doc]"}, con domicilio en {arrendatario.domicilio || "[domicilio]"}, teléfono {arrendatario.telefono || "[tel]"}, correo {arrendatario.email || "[email]"} (en adelante, el <b>ARRENDATARIO</b>), se celebra el presente contrato sobre el inmueble ubicado en {inmueble.direccion || "[dirección]"}, {inmueble.ciudad || "[ciudad]"}, tipo {inmueble.tipo || "[tipo]"}{inmueble.numeroUnidad ? `, unidad ${inmueble.numeroUnidad}` : ""}.
      </p>

      {inmueble.descripcion && (
        <p><i>Descripción del inmueble:</i> {inmueble.descripcion}</p>
      )}

      <ol>
        <li>
          <b>Plazo:</b> {contrato.plazoMeses || "[meses]"} meses a partir del {contrato.inicio || "[inicio]"}
          {fechaFin ? ` (hasta ${fechaFin}).` : "."}
        </li>
        <li>
          <b>Canon:</b> {contrato.moneda} {contrato.canon || "[monto]"} pagadero hasta el día {contrato.diaVencimiento || "[día]"} de cada mes. Depósito en garantía: {contrato.deposito ? `${contrato.moneda} ${contrato.deposito}` : "No aplica"}.
        </li>
        <li>
          <b>Servicios incluidos:</b> {contrato.incluyeServicios || "[detallar]"}.
        </li>
        <li>
          <b>Mascotas:</b> {contrato.politicaMascotas || "[política]"}.
        </li>
        {contrato.lecturaMedidores && (
          <li><b>Lectura de medidores inicial:</b> {contrato.lecturaMedidores}</li>
        )}
        {contrato.inventario && (
          <li><b>Inventario de entrega:</b> {contrato.inventario}</li>
        )}
        <li>
          <b>Obligaciones y uso:</b> El ARRENDATARIO se obliga a usar el inmueble con diligencia, no realizar modificaciones sin autorización escrita y restituirlo en condiciones normales de uso. Los daños ocasionados por mal uso serán a su cargo.
        </li>
        <li>
          <b>Mora:</b> El incumplimiento en la fecha de pago generará mora automática y recargos según normativa vigente o lo aquí acordado por las partes.
        </li>
        <li>
          <b>Resolución:</b> Por falta de pago mayor a 2 períodos o incumplimientos graves, el ARRENDADOR podrá resolver el contrato conforme a derecho.
        </li>
        {contrato.clausulasAdicionales && (
          <li><b>Cláusulas adicionales:</b> {contrato.clausulasAdicionales}</li>
        )}
        <li>
          <b>Jurisdicción:</b> Las partes se someten a los tribunales competentes de {inmueble.ciudad || "[ciudad]"}.
        </li>
      </ol>

      <br/>
      <Row>
        <Col span={6}>
          <p>_____________________________<br/>
            {arrendador.nombreCompleto || "[Arrendador]"}<br/>
            CI/RUC {arrendador.documento || "[doc]"}
          </p>
        </Col>
        <Col span={6}>
          <p>_____________________________<br/>
            {arrendatario.nombreCompleto || "[Arrendatario]"}<br/>
            CI/RUC {arrendatario.documento || "[doc]"}
          </p>
        </Col>
      </Row>
    </PreviewWrap>
  );
}

// ===== Formulario =====
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function Contrato() {
  const [data, setData] = useState<Draft>(baseDraft);
  const [showPreview, setShowPreview] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");

  // Cargar de URL si hay #contrato=...
  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/contrato=([^&]+)/);
    if (m?.[1]) {
      const restored = b64urlDecode<Draft>(m[1]);
      if (restored) setData(restored);
    } else {
      const saved = localStorage.getItem("contratoDraft");
      if (saved) {
        try { setData(JSON.parse(saved)); } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar borrador automático
  useEffect(() => {
    localStorage.setItem("contratoDraft", JSON.stringify(data));
  }, [data]);

  const updateParte = (parte: Parte, field: keyof DatosPersona, value: string) => {
    setData((d) => ({ ...d, [parte]: { ...d[parte], [field]: value } }));
  };
  const updateInmueble = (field: keyof DatosInmueble, value: string) => {
    setData((d) => ({ ...d, inmueble: { ...d.inmueble, [field]: value } }));
  };
  const updateContrato = (field: keyof DatosContrato, value: string) => {
    setData((d) => ({ ...d, contrato: { ...d.contrato, [field]: value } }));
  };

  const generarEnlace = () => {
    const b64 = b64urlEncode(data);
    const url = `${window.location.origin}${window.location.pathname}#contrato=${b64}`;
    setShareLink(url);
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  return (
    <GlassContainer>
      <Sidebar />
      <BodyWrap>
        <Card>
          <Title>Contrato de Alquiler • Sin login / Sin BD</Title>

          <Segmented aria-label="Seleccionar parte">
            {(["arrendador", "arrendatario"] as Parte[]).map((p) => (
              <SegmentBtn
                key={p}
                active={data.parteActual === p}
                onClick={() => setData((d) => ({ ...d, parteActual: p }))}
              >
                {p === "arrendador" ? "Arrendador" : "Arrendatario"}
              </SegmentBtn>
            ))}
          </Segmented>

          <Divider />

          {/* Datos de la parte activa */}
          <Row>
            <Col span={6}>
              <Field label={`Nombre completo (${data.parteActual})`}>
                <Input
                  value={data[data.parteActual].nombreCompleto}
                  onChange={(e) => updateParte(data.parteActual, "nombreCompleto", e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Documento (CI/RUC)">
                <Input
                  value={data[data.parteActual].documento}
                  onChange={(e) => updateParte(data.parteActual, "documento", e.target.value)}
                  placeholder="Ej: 4.321.987"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Teléfono">
                <Input
                  value={data[data.parteActual].telefono}
                  onChange={(e) => updateParte(data.parteActual, "telefono", e.target.value)}
                  placeholder="Ej: +595 971..."
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Domicilio">
                <Input
                  value={data[data.parteActual].domicilio}
                  onChange={(e) => updateParte(data.parteActual, "domicilio", e.target.value)}
                  placeholder="Calle y número"
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Email">
                <Input
                  type="email"
                  value={data[data.parteActual].email}
                  onChange={(e) => updateParte(data.parteActual, "email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </Field>
            </Col>
          </Row>

          <Divider />

          {/* Datos del inmueble */}
          <Row>
            <Col span={8}>
              <Field label="Dirección del inmueble">
                <Input
                  value={data.inmueble.direccion}
                  onChange={(e) => updateInmueble("direccion", e.target.value)}
                  placeholder="Ej: Av. Principal 1234"
                />
              </Field>
            </Col>
            <Col span={4}>
              <Field label="Ciudad">
                <Input
                  value={data.inmueble.ciudad}
                  onChange={(e) => updateInmueble("ciudad", e.target.value)}
                  placeholder="Ej: Asunción"
                />
              </Field>
            </Col>
            <Col span={4}>
              <Field label="Tipo">
                <Input
                  value={data.inmueble.tipo}
                  onChange={(e) => updateInmueble("tipo", e.target.value)}
                  placeholder="Monoambiente / Dpto / Casa"
                />
              </Field>
            </Col>
            <Col span={4}>
              <Field label="Unidad (opcional)">
                <Input
                  value={data.inmueble.numeroUnidad || ""}
                  onChange={(e) => updateInmueble("numeroUnidad", e.target.value)}
                  placeholder="Ej: Depto 3B"
                />
              </Field>
            </Col>
            <Col span={12}>
              <Field label="Descripción (opcional)">
                <TextArea
                  value={data.inmueble.descripcion || ""}
                  onChange={(e) => updateInmueble("descripcion", e.target.value)}
                  placeholder="Características, estado, zonas comunes, etc."
                />
              </Field>
            </Col>
          </Row>

          <Divider />

          {/* Datos del contrato */}
          <Row>
            <Col span={3}>
              <Field label="Moneda">
                <Input
                  value={data.contrato.moneda}
                  onChange={(e) => updateContrato("moneda", e.target.value)}
                  placeholder="Gs / USD"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Canon mensual">
                <Input
                  value={data.contrato.canon}
                  onChange={(e) => updateContrato("canon", e.target.value)}
                  placeholder="Ej: 2.499.000"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Depósito">
                <Input
                  value={data.contrato.deposito}
                  onChange={(e) => updateContrato("deposito", e.target.value)}
                  placeholder="Ej: 2.499.000 o 'No'"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Vencimiento (día)">
                <Input
                  value={data.contrato.diaVencimiento}
                  onChange={(e) => updateContrato("diaVencimiento", e.target.value)}
                  placeholder="5"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Plazo (meses)">
                <Input
                  value={data.contrato.plazoMeses}
                  onChange={(e) => updateContrato("plazoMeses", e.target.value)}
                  placeholder="12"
                />
              </Field>
            </Col>
            <Col span={3}>
              <Field label="Inicio">
                <Input
                  type="date"
                  value={data.contrato.inicio}
                  onChange={(e) => updateContrato("inicio", e.target.value)}
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Servicios incluidos">
                <Input
                  value={data.contrato.incluyeServicios}
                  onChange={(e) => updateContrato("incluyeServicios", e.target.value)}
                  placeholder="Agua / Expensas / Internet..."
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Política de mascotas">
                <Input
                  value={data.contrato.politicaMascotas}
                  onChange={(e) => updateContrato("politicaMascotas", e.target.value)}
                  placeholder="Permitidas / No permitidas / Condiciones"
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Lectura de medidores (opcional)">
                <Input
                  value={data.contrato.lecturaMedidores || ""}
                  onChange={(e) => updateContrato("lecturaMedidores", e.target.value)}
                  placeholder="Ej: Luz 12345, Agua 678"
                />
              </Field>
            </Col>
            <Col span={6}>
              <Field label="Inventario de entrega (opcional)">
                <Input
                  value={data.contrato.inventario || ""}
                  onChange={(e) => updateContrato("inventario", e.target.value)}
                  placeholder="Ej: 1 cama, 1 heladera, 2 sillas..."
                />
              </Field>
            </Col>
            <Col span={12}>
              <Field label="Cláusulas adicionales (opcional)">
                <TextArea
                  value={data.contrato.clausulasAdicionales || ""}
                  onChange={(e) => updateContrato("clausulasAdicionales", e.target.value)}
                  placeholder="Cualquier acuerdo extra entre las partes."
                />
              </Field>
            </Col>
          </Row>

          <Row style={{ marginTop: 16, alignItems: "center" }}>
            <Col span={4}>
              <Button onClick={() => setShowPreview(true)}>Generar vista previa</Button>
            </Col>
            <Col span={4}>
              <Button variant="ghost" onClick={() => window.print()}>Imprimir / Guardar PDF</Button>
            </Col>
            <Col span={4}>
              <Button variant="ghost" onClick={generarEnlace}>Crear enlace compartible</Button>
            </Col>
            <Col span={12}>
              {shareLink && (
                <Help>
                  Enlace copiado. Si alguien abre este link, verá el contrato cargado: <br/>
                  <span style={{ wordBreak: "break-all" }}>{shareLink}</span>
                </Help>
              )}
            </Col>
          </Row>

          {showPreview && (
            <>
              <Divider />
              <ContratoPreview data={data} />
              <Help>
                Consejo: usa el botón "Imprimir / Guardar PDF" para generar el documento firmado. También puedes pegar fotos de cédula o adjuntar inventario impreso.
              </Help>
            </>
          )}
        </Card>
      </BodyWrap>

      {/* Estilos de impresión simples */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          #root, body, html { height: auto; }
          nav, aside, .Sidebar, .sidebar { display: none !important; }
          ${Card} { box-shadow: none !important; background: #fff !important; color: #000 !important; }
          ${PreviewWrap} { background: #fff !important; color: #000 !important; border: none !important; }
          a, button { display: none !important; }
        }
      `}</style>
    </GlassContainer>
  );
}
