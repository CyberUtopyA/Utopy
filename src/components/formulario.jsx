import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvent } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styled from "styled-components";

const PLAN_CONFIG = {
  starter: {
    label: "Starter",
    priceMonthly: 79000,
    priceYearly: 790000,
    ads: 5,
    featured: 0,
    perks: ["5 anuncios", "perfil visible", "lead básico"],
  },
  pro: {
    label: "Pro",
    priceMonthly: 189000,
    priceYearly: 1890000,
    ads: 20,
    featured: 4,
    perks: ["20 anuncios", "4 destacados", "más visibilidad"],
  },
  scale: {
    label: "Scale",
    priceMonthly: 449000,
    priceYearly: 4490000,
    ads: 80,
    featured: 20,
    perks: ["80 anuncios", "prioridad", "automatización"],
  },
};

const PLAN_ORDER = ["starter", "pro", "scale"];

const Wrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1004;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 14px;
  background:
    radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 30%),
    rgba(2, 6, 23, 0.62);
  backdrop-filter: blur(10px);
`;

const Container = styled.div`
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  width: min(1080px, 96vw);
  max-height: 92vh;
  border-radius: 30px;
  overflow: hidden;
  background: rgba(255,255,255,0.94);
  border: 1px solid rgba(255,255,255,0.35);
  box-shadow: 0 24px 80px rgba(2, 6, 23, 0.28);

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
`;

const LeftPanel = styled.div`
  padding: 26px;
  min-height: 300px;
  color: white;
  display: grid;
  align-content: space-between;
  gap: 18px;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.18), rgba(2, 6, 23, 0.78)),
    radial-gradient(circle at top right, rgba(34,211,238,0.20), transparent 36%),
    radial-gradient(circle at bottom left, rgba(139,92,246,0.18), transparent 34%),
    url("/realestates.png") center center / cover no-repeat;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const LeftTitle = styled.h2`
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 0.96;
  font-weight: 950;
`;

const LeftSub = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255,255,255,0.88);
`;

const PlanList = styled.div`
  display: grid;
  gap: 10px;
`;

const PlanCard = styled.button`
  text-align: left;
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid ${({ $active }) =>
    $active ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.14)"};
  background: ${({ $active }) =>
    $active
      ? "linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.12))"
      : "rgba(255,255,255,0.08)"};
  color: white;
  cursor: pointer;
`;

const RightPanel = styled.div`
  background: linear-gradient(180deg, #f9fcff 0%, #f5f7fb 100%);
  padding: 22px;
`;

const FormBox = styled.div`
  width: 100%;
  max-width: 590px;
  display: grid;
  gap: 16px;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
`;

const FormTitle = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 950;
  color: #0f172a;
`;

const FormSub = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
`;

const CloseBtn = styled.button`
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.88);
  color: #0f172a;
  font-weight: 900;
  cursor: pointer;
`;

const Segmented = styled.div`
  display: inline-flex;
  background: #eaf2f7;
  border: 1px solid rgba(15,23,42,0.06);
  border-radius: 16px;
  overflow: hidden;
  width: fit-content;
`;

const SegmentBtn = styled.button`
  padding: 11px 14px;
  border: none;
  cursor: pointer;
  font-weight: 900;
  background: ${(p) => (p.$active ? "#0f172a" : "transparent")};
  color: ${(p) => (p.$active ? "#fff" : "#334155")};
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Full = styled.div`
  grid-column: 1 / -1;
`;

const Field = styled.label`
  display: grid;
  gap: 7px;
`;

const Label = styled.div`
  font-size: 12px;
  font-weight: 900;
  color: #0f172a;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 13px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: rgba(34,211,238,0.8);
    box-shadow: 0 0 0 4px rgba(34,211,238,0.12);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 13px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  outline: none;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 90px;
  padding: 12px 13px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  outline: none;
  resize: vertical;
`;

const Checks = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;
const Subtle = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const SmallPill = styled.span`
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15,23,42,0.08);
  border: 1px solid rgba(15,23,42,0.12);
  font-size: 10px;
  font-weight: 800;
  color: #0f172a;
`;
const CheckChip = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(15,23,42,0.04);
  border: 1px solid rgba(15,23,42,0.07);
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
`;

const Summary = styled.div`
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f3fbff 100%);
  border: 1px solid rgba(34,211,238,0.16);
`;

const SummaryStats = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  @media (max-width: 720px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Stat = styled.div`
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(15,23,42,0.06);
`;

const StatLabel = styled.div`
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
`;

const StatValue = styled.div`
  font-size: 19px;
  font-weight: 950;
  color: #0f172a;
`;

const Perks = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Perk = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(15,23,42,0.04);
  border: 1px solid rgba(15,23,42,0.06);
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
`;

const MapWrapper = styled.div`
  height: 220px;
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(15,23,42,0.1);
`;

const Hint = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const ErrorText = styled.div`
  font-size: 12px;
  color: #dc2626;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Button = styled.button`
  flex: 1;
  min-width: 170px;
  padding: 14px 16px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  color: white;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 14px 32px rgba(99,102,241,0.22);
`;

const GhostButton = styled.button`
  flex: 1;
  min-width: 170px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.08);
  background: rgba(255,255,255,0.88);
  color: #0f172a;
  font-weight: 900;
  cursor: pointer;
`;

const areaPin = new L.DivIcon({
  className: "skylines-pass-pin",
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: linear-gradient(135deg,#06b6d4,#8b5cf6);
      border: 3px solid white;
      box-shadow: 0 8px 18px rgba(15,23,42,.25);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function formatGs(value) {
  return new Intl.NumberFormat("es-PY").format(value) + " Gs.";
}

function computePlan(planKey, billing) {
  const plan = PLAN_CONFIG[planKey] || PLAN_CONFIG.starter;
  const total =
    billing === "yearly" ? plan.priceYearly : plan.priceMonthly;

  return {
    ...plan,
    billing,
    total,
  };
}

function LocationMarker({ position, setPosition, setFormData }) {
  useMapEvent("click", (e) => {
    const next = [e.latlng.lat, e.latlng.lng];
    setPosition(next);
    setFormData((prev) => ({ ...prev, focusLocation: next }));
  });

  return (
    <Marker
      position={position}
      icon={areaPin}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const next = [e.target.getLatLng().lat, e.target.getLatLng().lng];
          setPosition(next);
          setFormData((prev) => ({ ...prev, focusLocation: next }));
        },
      }}
    />
  );
}

export default function RealEstateForm({ onClose, isVisible = false }) {
  const formRef = useRef(null);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [billing, setBilling] = useState("monthly");
  const [position, setPosition] = useState([-25.2637, -57.5759]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    zone: "",
    adType: "alquiler",
    targetAudience: "estudiantes",
    focusLocation: [-25.2637, -57.5759],
    wantsBoost: true,
    wantsAutomation: true,
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const plan = useMemo(
    () => computePlan(selectedPlan, billing),
    [selectedPlan, billing]
  );

  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event) {
      if (formRef.current && !formRef.current.contains(event.target)) {
        onClose && onClose();
      }
    }

    function handleEsc(event) {
      if (event.key === "Escape") onClose && onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  function validateForm() {
    const next = {};

    ["fullName", "email", "phone", "city"].forEach((key) => {
      if (!String(formData[key] || "").trim()) {
        next[key] = "Este campo es obligatorio";
      }
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const lines = [
      `Skylines Pass`,
      ``,
      `Plan: ${plan.label}`,
      `Ciclo: ${billing === "yearly" ? "Anual" : "Mensual"}`,
      `Precio: ${formatGs(plan.total)}`,
      `Anuncios: ${plan.ads}`,
      `Destacados: ${plan.featured}`,
      ``,
      `Nombre: ${formData.fullName}`,
      `Email: ${formData.email}`,
      `Teléfono: ${formData.phone}`,
      `Ciudad: ${formData.city}`,
      `Zona: ${formData.zone || "-"}`,
      `Tipo: ${formData.adType}`,
      `Audiencia: ${formData.targetAudience}`,
      `Boost: ${formData.wantsBoost ? "Sí" : "No"}`,
      `Automatización: ${formData.wantsAutomation ? "Sí" : "No"}`,
      `Ubicación foco: ${formData.focusLocation[0]}, ${formData.focusLocation[1]}`,
      `Notas: ${formData.notes || "-"}`,
      ``,
      `Beneficios:`,
      ...plan.perks.map((x) => `- ${x}`),
    ];

    const subject = `Skylines Pass · ${plan.label} · ${formData.fullName}`;
    window.location.href = `mailto:oficial@falconventas.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  return (
    <Wrapper>
      <Container ref={formRef}>
        <LeftPanel>
          <div>
            <Eyebrow>Skylines Pass</Eyebrow>
            <LeftTitle>Planes simples para crecer en Skylines.</LeftTitle>
            <LeftSub>
              Activá anuncios, foco territorial y visibilidad con una experiencia
              más limpia, más clara y más útil.
            </LeftSub>
          </div>

          <PlanList>
            {PLAN_ORDER.map((key) => {
              const p = PLAN_CONFIG[key];
              return (
                <PlanCard
                  key={key}
                  type="button"
                  $active={selectedPlan === key}
                  onClick={() => setSelectedPlan(key)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{p.label}</strong>
                    <SmallPill>
                      {formatGs(billing === "yearly" ? p.priceYearly : p.priceMonthly)}
                    </SmallPill>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.86 }}>
                    {p.ads} anuncios · {p.featured} destacados
                  </div>
                </PlanCard>
              );
            })}
          </PlanList>
        </LeftPanel>

        <RightPanel>
          <FormBox>
            <TopRow>
              <div>
                <FormTitle>Solicitar pass</FormTitle>
                <FormSub>
                  Elegí plan, zona y objetivo. Lo justo y necesario.
                </FormSub>
              </div>

              <CloseBtn type="button" onClick={onClose}>
                Cerrar
              </CloseBtn>
            </TopRow>

            <Segmented>
              <SegmentBtn
                type="button"
                $active={billing === "monthly"}
                onClick={() => setBilling("monthly")}
              >
                Mensual
              </SegmentBtn>
              <SegmentBtn
                type="button"
                $active={billing === "yearly"}
                onClick={() => setBilling("yearly")}
              >
                Anual
              </SegmentBtn>
            </Segmented>

            <Grid>
              <Field>
                <Label>Nombre</Label>
                <Input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                />
                {errors.fullName ? <ErrorText>{errors.fullName}</ErrorText> : null}
              </Field>

              <Field>
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@dominio.com"
                />
                {errors.email ? <ErrorText>{errors.email}</ErrorText> : null}
              </Field>

              <Field>
                <Label>Teléfono</Label>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+595 ..."
                />
                {errors.phone ? <ErrorText>{errors.phone}</ErrorText> : null}
              </Field>

              <Field>
                <Label>Ciudad</Label>
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Asunción / CDE / Salto"
                />
                {errors.city ? <ErrorText>{errors.city}</ErrorText> : null}
              </Field>

              <Field>
                <Label>Zona foco</Label>
                <Input
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  placeholder="Barrio / eje / universidad"
                />
              </Field>

              <Field>
                <Label>Tipo</Label>
                <Select
                  name="adType"
                  value={formData.adType}
                  onChange={handleChange}
                >
                  <option value="alquiler">Alquiler</option>
                  <option value="venta">Venta</option>
                  <option value="mixto">Mixto</option>
                </Select>
              </Field>

              <Field>
                <Label>Audiencia</Label>
                <Select
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleChange}
                >
                  <option value="estudiantes">Estudiantes</option>
                  <option value="extranjeros">Extranjeros</option>
                  <option value="inversionistas">Inversionistas</option>
                  <option value="familias">Familias</option>
                </Select>
              </Field>

              <Full>
                <Label style={{ marginBottom: 8 }}>Extras</Label>
                <Checks>
                  <CheckChip>
                    <input
                      type="checkbox"
                      name="wantsBoost"
                      checked={formData.wantsBoost}
                      onChange={handleChange}
                    />
                    Boost
                  </CheckChip>

                  <CheckChip>
                    <input
                      type="checkbox"
                      name="wantsAutomation"
                      checked={formData.wantsAutomation}
                      onChange={handleChange}
                    />
                    Automatización
                  </CheckChip>
                </Checks>
              </Full>

              <Full>
                <Summary>
                  <div style={{ display: "grid", gap: 4 }}>
                    <Label>Resumen</Label>
                    <Subtle>
                      Claro, rápido y sin ruido.
                    </Subtle>
                  </div>

                  <SummaryStats>
                    <Stat>
                      <StatLabel>Plan</StatLabel>
                      <StatValue>{plan.label}</StatValue>
                    </Stat>
                    <Stat>
                      <StatLabel>Total</StatLabel>
                      <StatValue>{formatGs(plan.total)}</StatValue>
                    </Stat>
                    <Stat>
                      <StatLabel>Anuncios</StatLabel>
                      <StatValue>{plan.ads}</StatValue>
                    </Stat>
                  </SummaryStats>

                  <Perks>
                    {plan.perks.map((perk) => (
                      <Perk key={perk}>✦ {perk}</Perk>
                    ))}
                  </Perks>
                </Summary>
              </Full>

              <Full>
                <Label style={{ marginBottom: 8 }}>Zona principal</Label>
                <MapWrapper>
                  <MapContainer
                    center={position}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationMarker
                      position={position}
                      setPosition={setPosition}
                      setFormData={setFormData}
                    />
                  </MapContainer>
                </MapWrapper>
                <Hint>
                  Tocá el mapa o arrastrá el punto para marcar tu zona principal.
                </Hint>
              </Full>

              <Full>
                <Field>
                  <Label>Notas</Label>
                  <TextArea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Contame en una línea qué querés mover o captar..."
                  />
                </Field>
              </Full>
            </Grid>

            <ButtonRow>
              <GhostButton type="button" onClick={onClose}>
                Cerrar
              </GhostButton>
              <Button type="button" onClick={handleSubmit}>
                Solicitar Skylines Pass
              </Button>
            </ButtonRow>
          </FormBox>
        </RightPanel>
      </Container>
    </Wrapper>
  );
}