import React, { useMemo, useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const DEFAULT_CENTER = [-24.0676, -54.3101];

const glow = keyframes`
  0% { transform: scale(1); opacity: .55; }
  70% { transform: scale(1.9); opacity: 0; }
  100% { transform: scale(1.9); opacity: 0; }
`;

const Wrap = styled.div`
  width: 100%;
  min-height: min(86vh, 920px);
  display: grid;
`;

const Shell = styled.div`
  position: relative;
  min-height: min(86vh, 920px);
  border-radius: 30px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 15%, rgba(21,255,0,0.22), transparent 26%),
    radial-gradient(circle at 78% 20%, rgba(56,189,248,0.20), transparent 24%),
    radial-gradient(circle at 50% 90%, rgba(139,92,246,0.18), transparent 30%),
    #07110c;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow:
    0 28px 90px rgba(0,0,0,0.28),
    inset 0 1px 0 rgba(255,255,255,0.12);

  @media (max-width: 900px) {
    border-radius: 24px;
    min-height: calc(100vh - 170px);
  }
`;

const MapLayer = styled.div`
  position: absolute;
  inset: 0;

  .leaflet-container {
    width: 100%;
    height: 100%;
    background: #07110c;
    font-family: inherit;
  }

  .leaflet-control-attribution {
    background: rgba(7, 17, 12, 0.72) !important;
    color: rgba(255,255,255,0.55) !important;
    backdrop-filter: blur(10px);
    border-radius: 999px 0 0 0;
    padding: 3px 8px;
    font-size: 10px;
  }

  .leaflet-control-attribution a {
    color: rgba(21,255,0,0.72) !important;
  }

  .leaflet-control-zoom {
    border: none !important;
    overflow: hidden;
    border-radius: 18px !important;
    box-shadow: 0 18px 40px rgba(0,0,0,0.22);
  }

  .leaflet-control-zoom a {
    background: rgba(255,255,255,0.82) !important;
    color: #06110b !important;
    border: none !important;
    backdrop-filter: blur(14px);
  }

  .leaflet-popup-content-wrapper {
    border-radius: 22px;
    padding: 0;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 70px rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.65);
  }

  .leaflet-popup-content {
    margin: 0;
  }

  .leaflet-popup-tip {
    background: rgba(255,255,255,0.92);
  }
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(7,17,12,0.88) 0%, rgba(7,17,12,0.20) 28%, rgba(7,17,12,0.20) 60%, rgba(7,17,12,0.88) 100%),
    radial-gradient(circle at center, transparent 44%, rgba(0,0,0,0.35) 100%);
  z-index: 400;
`;

const TopHud = styled.div`
  position: absolute;
  z-index: 500;
  top: 18px;
  left: 18px;
  right: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) auto;
  gap: 14px;
  align-items: start;

  @media (max-width: 900px) {
    top: 12px;
    left: 12px;
    right: 12px;
    grid-template-columns: 1fr;
  }
`;

const HeroPanel = styled.div`
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 26px;
  background: rgba(5, 15, 10, 0.62);
  color: #fff;
  padding: 16px;
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.24);
  min-width: 0;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(21,255,0,0.13);
  border: 1px solid rgba(21,255,0,0.22);
  color: rgba(227,255,231,0.92);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const Title = styled.div`
  margin-top: 10px;
  font-size: clamp(22px, 3vw, 38px);
  line-height: 0.98;
  font-weight: 1000;
  letter-spacing: -0.045em;
`;

const TitleGlow = styled.span`
  background: linear-gradient(90deg, #ffffff 0%, #b8ffc0 42%, #15ff00 100%);
  -webkit-background-clip: text;
  color: transparent;
`;

const Subtle = styled.div`
  font-size: 13px;
  opacity: 0.78;
  line-height: 1.45;
`;

const HeroSub = styled(Subtle)`
  margin-top: 8px;
  max-width: 720px;
  color: rgba(255,255,255,0.78);
`;

const StatsGlass = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(86px, 1fr));
  gap: 8px;
  min-width: min(430px, 100%);

  @media (max-width: 520px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Stat = styled.div`
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 22px;
  padding: 12px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 45px rgba(0,0,0,0.18);
`;

const StatLabel = styled.div`
  font-size: 10px;
  opacity: 0.68;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const StatValue = styled.div`
  margin-top: 3px;
  font-size: 25px;
  font-weight: 1000;
  letter-spacing: -0.04em;
`;

const ControlDock = styled.div`
  position: absolute;
  z-index: 510;
  left: 18px;
  right: 18px;
  bottom: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;

  @media (max-width: 900px) {
    left: 12px;
    right: 12px;
    bottom: 12px;
    grid-template-columns: 1fr;
  }
`;

const FilterPanel = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px;
  border-radius: 24px;
  background: rgba(255,255,255,0.78);
  border: 1px solid rgba(255,255,255,0.70);
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.22);
  min-width: 0;
`;

const FilterBtn = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "rgba(21,255,0,0.65)" : "rgba(0,0,0,0.06)")};
  border-radius: 999px;
  padding: 9px 12px;
  background: ${({ $active }) =>
    $active ? "linear-gradient(135deg,#15ff00,#b6ffbd)" : "rgba(255,255,255,0.64)"};
  color: #07110c;
  cursor: pointer;
  font-weight: 950;
  font-size: 12px;
  box-shadow: ${({ $active }) =>
    $active ? "0 10px 26px rgba(21,255,0,0.22)" : "none"};
  white-space: nowrap;
`;

const Select = styled.select`
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 999px;
  padding: 9px 12px;
  background: rgba(255,255,255,0.82);
  color: #07110c;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  min-width: 160px;
  outline: none;
`;

const Legend = styled.div`
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 520px;

  @media (max-width: 900px) {
    justify-content: flex-start;
  }
`;

const LegendChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 950;
  color: #07110c;
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(255,255,255,0.62);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 30px rgba(0,0,0,0.12);
`;

const EmptyState = styled.div`
  position: absolute;
  z-index: 520;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100% - 32px));
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 28px;
  background: rgba(5, 15, 10, 0.62);
  color: #fff;
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 70px rgba(0,0,0,0.24);
  padding: 18px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 58px;
  height: 58px;
  margin: 0 auto 10px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: rgba(21,255,0,0.14);
  border: 1px solid rgba(21,255,0,0.22);
  font-size: 26px;
`;

const PopupWrap = styled.div`
  display: grid;
  gap: 10px;
  min-width: 250px;
  padding: 14px;
`;

const PopupTitle = styled.div`
  font-weight: 1000;
  font-size: 16px;
  color: #07110c;
  letter-spacing: -0.02em;
`;

const PopupMeta = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 950;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(34,197,94,0.13)"
      : $tone === "warn"
      ? "rgba(249,115,22,0.13)"
      : "rgba(0,0,0,0.04)"};
  color: #07110c;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 10px 12px;
  background: ${({ $ghost }) =>
    $ghost ? "rgba(255,255,255,0.92)" : "linear-gradient(135deg,#15ff00,#b6ffbd)"};
  color: #07110c;
  cursor: pointer;
  font-weight: 950;
  box-shadow: ${({ $ghost }) => ($ghost ? "none" : "0 12px 28px rgba(21,255,0,0.24)")};
`;

function safeStr(x, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x, fb = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function normKey(x) {
  return safeStr(x).trim().toLowerCase();
}

function hasTrait(dv, trait) {
  return Array.isArray(dv?.traits) && dv.traits.includes(trait);
}

function getCoords(dv) {
  const lat =
    dv?.attrs?.location?.lat ??
    dv?.attrs?.lat ??
    dv?.meta?.location?.lat ??
    dv?.meta?.lat;

  const lng =
    dv?.attrs?.location?.lng ??
    dv?.attrs?.lng ??
    dv?.attrs?.location?.lon ??
    dv?.meta?.location?.lng ??
    dv?.meta?.lng ??
    dv?.meta?.location?.lon;

  const la = Number(lat);
  const lo = Number(lng);

  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { lat: la, lng: lo };
}

function getMaterialKey(dv) {
  return normKey(
    dv?.attrs?.materialKey ||
      dv?.attrs?.productoId ||
      dv?.meta?.materialKey ||
      dv?.meta?.productKey
  );
}

function getMaterialName(dv) {
  return safeStr(
    dv?.attrs?.materialName ||
      dv?.attrs?.title ||
      dv?.meta?.name ||
      dv?.attrs?.productoNombre ||
      "Material"
  );
}

function getQuantity(dv) {
  return toNum(
    dv?.attrs?.quantity ??
      dv?.attrs?.cantidad ??
      dv?.attrs?.stock ??
      0,
    0
  );
}

function getUnit(dv) {
  return safeStr(dv?.attrs?.unit || dv?.attrs?.unidad || "u");
}

function getThreadId(dv) {
  return safeStr(dv?.meta?.threadId || dv?.attrs?.threadId || "");
}

function getOrgId(dv) {
  return safeStr(dv?.attrs?.orgId || dv?.meta?.orgId || "");
}

function getTerritoryId(dv) {
  return safeStr(dv?.attrs?.territoryId || dv?.meta?.territoryId || "");
}

function getTitleForPoint(dv) {
  return safeStr(
    dv?.attrs?.title ||
      dv?.attrs?.name ||
      dv?.meta?.name ||
      dv?.kind ||
      "Punto circular"
  );
}

function getSubtitleForPoint(dv) {
  return safeStr(
    dv?.attrs?.description ||
      dv?.attrs?.domain ||
      dv?.attrs?.category ||
      ""
  );
}

function isCircularWork(dv) {
  if (dv?.kind !== "work.intent") return false;
  const domain = safeStr(dv?.attrs?.domain || "").toLowerCase();
  return (
    domain.startsWith("circular.") ||
    domain === "urban.mining" ||
    hasTrait(dv, "mt:circular")
  );
}

function isCircularOffer(dv) {
  return (
    dv?.kind === "mt:offer" &&
    (hasTrait(dv, "mt:circular") || hasTrait(dv, "mt:supply"))
  );
}

function isCircularDemand(dv) {
  return (
    dv?.kind === "mt:demand.material" &&
    (hasTrait(dv, "mt:circular") || hasTrait(dv, "mt:material"))
  );
}

function makePoint(kind, dv) {
  const coords = getCoords(dv);
  if (!coords) return null;

  return {
    id: safeStr(dv?.id, `${kind}:${coords.lat}:${coords.lng}`),
    kind,
    title: getTitleForPoint(dv),
    subtitle: getSubtitleForPoint(dv),
    materialKey: getMaterialKey(dv),
    materialName: getMaterialName(dv),
    quantity: getQuantity(dv),
    unit: getUnit(dv),
    lat: coords.lat,
    lng: coords.lng,
    orgId: getOrgId(dv) || null,
    territoryId: getTerritoryId(dv) || null,
    threadId: getThreadId(dv) || null,
    domain: safeStr(dv?.attrs?.domain || "") || null,
    raw: dv,
  };
}

function collectCircularPoints(allLive) {
  const out = [];

  for (const dv of allLive || []) {
    let point = null;

    if (dv?.kind === "waste.offer") point = makePoint("waste.offer", dv);
    else if (dv?.kind === "urban.mining.lot") point = makePoint("urban.mining.lot", dv);
    else if (dv?.kind === "material.recovered") point = makePoint("material.recovered", dv);
    else if (isCircularWork(dv)) point = makePoint("work.intent", dv);
    else if (isCircularDemand(dv)) point = makePoint("mt:demand.material", dv);
    else if (isCircularOffer(dv)) point = makePoint("mt:offer", dv);

    if (point) out.push(point);
  }

  return out;
}

function iconTone(kind) {
  switch (kind) {
    case "waste.offer":
      return { bg: "#15ff00", glow: "rgba(21,255,0,.34)", emoji: "♻️" };
    case "urban.mining.lot":
      return { bg: "#a78bfa", glow: "rgba(167,139,250,.34)", emoji: "🧲" };
    case "material.recovered":
      return { bg: "#67e8f9", glow: "rgba(103,232,249,.34)", emoji: "🧱" };
    case "work.intent":
      return { bg: "#facc15", glow: "rgba(250,204,21,.34)", emoji: "🛠️" };
    case "mt:demand.material":
      return { bg: "#fb7185", glow: "rgba(251,113,133,.34)", emoji: "📥" };
    default:
      return { bg: "#93c5fd", glow: "rgba(147,197,253,.34)", emoji: "📦" };
  }
}

function makeDivIcon(kind) {
  const tone = iconTone(kind);

  return L.divIcon({
    className: "circular-map-marker",
    html: `
      <div style="
        width: 46px;
        height: 46px;
        position: relative;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="
          position:absolute;
          inset:2px;
          border-radius:999px;
          background:${tone.glow};
          animation: circularPulse 2.2s infinite;
        "></div>
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: ${tone.bg};
          border: 2px solid rgba(255,255,255,.92);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:16px;
          position:relative;
          z-index:2;
          box-shadow:
            0 14px 34px rgba(0,0,0,.28),
            0 0 0 6px rgba(255,255,255,.12);
        ">
          ${tone.emoji}
        </div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -22],
  });
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    setTimeout(() => {
      map.invalidateSize();

      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 14);
        return;
      }

      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [72, 72] });
    }, 80);
  }, [map, points]);

  return null;
}

function MapCssInjector() {
  useEffect(() => {
    const id = "circular-map-utopy-css";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @keyframes circularPulse {
        0% { transform: scale(.7); opacity: .72; }
        70% { transform: scale(1.72); opacity: 0; }
        100% { transform: scale(1.72); opacity: 0; }
      }
      .circular-map-marker {
        background: transparent !important;
        border: none !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}

export default function CircularMapPanel({
  allLive,
  title = "Mapa circular vivo",
  subtitle = "Materiales, trabajos, minería urbana y señales productivas moviéndose sobre el territorio.",
  onOpenThread,
  onOfferMaterial,
}) {
  const [mode, setMode] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("");

  const points = useMemo(() => collectCircularPoints(allLive), [allLive]);

  const materialOptions = useMemo(() => {
    return Array.from(new Set(points.map((p) => p.materialName).filter(Boolean))).sort();
  }, [points]);

  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      if (mode === "material") {
        const materialKinds = [
          "waste.offer",
          "material.recovered",
          "mt:offer",
          "mt:demand.material",
        ];
        if (!materialKinds.includes(p.kind)) return false;
      }

      if (mode === "work" && p.kind !== "work.intent") return false;
      if (mode === "mining" && p.kind !== "urban.mining.lot") return false;

      if (materialFilter && normKey(p.materialName) !== normKey(materialFilter)) {
        return false;
      }

      return true;
    });
  }, [points, mode, materialFilter]);

  const stats = useMemo(() => {
    return {
      total: filteredPoints.length,
      materials: filteredPoints.filter((p) =>
        ["waste.offer", "material.recovered", "mt:offer", "mt:demand.material"].includes(p.kind)
      ).length,
      work: filteredPoints.filter((p) => p.kind === "work.intent").length,
      mining: filteredPoints.filter((p) => p.kind === "urban.mining.lot").length,
    };
  }, [filteredPoints]);

  return (
    <Wrap>
      <Shell>
        <MapCssInjector />

        <MapLayer>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            zoomControl
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
            />

            <FitBounds points={filteredPoints} />

            {filteredPoints.map((point) => (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={makeDivIcon(point.kind)}
              >
                <Popup>
                  <PopupWrap>
                    <div>
                      <PopupTitle>{point.title}</PopupTitle>
                      {point.subtitle ? (
                        <Subtle style={{ marginTop: 3 }}>{point.subtitle}</Subtle>
                      ) : null}
                    </div>

                    <PopupMeta>
                      <Chip $tone="neutral">{point.kind}</Chip>
                      {point.materialName ? <Chip $tone="ok">{point.materialName}</Chip> : null}
                      {point.quantity > 0 ? (
                        <Chip $tone="warn">
                          {point.quantity} {point.unit}
                        </Chip>
                      ) : null}
                    </PopupMeta>

                    <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45 }}>
                      {point.orgId ? `org: ${point.orgId}` : ""}
                      {point.orgId && point.territoryId ? " · " : ""}
                      {point.territoryId ? `territorio: ${point.territoryId}` : ""}
                      {point.domain ? ` · dominio: ${point.domain}` : ""}
                    </div>

                    <Row>
                      {point.threadId ? (
                        <Btn $ghost onClick={() => onOpenThread?.(point.threadId, point)}>
                          Abrir hilo
                        </Btn>
                      ) : null}

                      {point.materialKey ? (
                        <Btn onClick={() => onOfferMaterial?.(point)}>
                          Ofertar / enviar a MO
                        </Btn>
                      ) : null}
                    </Row>
                  </PopupWrap>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </MapLayer>

        <Vignette />

        <TopHud>
          <HeroPanel>
            <Eyebrow>UTOPY Circular · territorio vivo</Eyebrow>
            <Title>
              <TitleGlow>{title}</TitleGlow>
            </Title>
            <HeroSub>{subtitle}</HeroSub>
          </HeroPanel>

          <StatsGlass>
            <Stat>
              <StatLabel>Puntos</StatLabel>
              <StatValue>{stats.total}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Material</StatLabel>
              <StatValue>{stats.materials}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Trabajo</StatLabel>
              <StatValue>{stats.work}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Minería</StatLabel>
              <StatValue>{stats.mining}</StatValue>
            </Stat>
          </StatsGlass>
        </TopHud>

        {!filteredPoints.length ? (
          <EmptyState>
            <EmptyIcon>♻️</EmptyIcon>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>
              Todavía no hay señales circulares con ubicación.
            </div>
            <Subtle style={{ marginTop: 6, color: "rgba(255,255,255,0.72)" }}>
              Publicá un material, lote urbano, demanda o trabajo con lat/lng para que el mapa despierte.
            </Subtle>
          </EmptyState>
        ) : null}

        <ControlDock>
          <FilterPanel>
            <FilterBtn $active={mode === "all"} onClick={() => setMode("all")}>
              Todo
            </FilterBtn>
            <FilterBtn $active={mode === "material"} onClick={() => setMode("material")}>
              Material
            </FilterBtn>
            <FilterBtn $active={mode === "work"} onClick={() => setMode("work")}>
              Trabajo
            </FilterBtn>
            <FilterBtn $active={mode === "mining"} onClick={() => setMode("mining")}>
              Minería urbana
            </FilterBtn>

            <Select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
            >
              <option value="">Todos los materiales</option>
              {materialOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </FilterPanel>

          <Legend>
            <LegendChip>♻️ residuo</LegendChip>
            <LegendChip>🧲 minería urbana</LegendChip>
            <LegendChip>🧱 recuperado</LegendChip>
            <LegendChip>🛠️ trabajo</LegendChip>
            <LegendChip>📥 demanda</LegendChip>
          </Legend>
        </ControlDock>
      </Shell>
    </Wrap>
  );
}