import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  makeCircularDemandMaterialDV,
  makeCircularDeliveryIntentDV,
  makeCircularOfferDV,
  makeCircularWorkIntentDV,
  makeMaterialRecoveredDV,
  makeUrbanMiningLotDV,
  makeWasteOfferDV,
} from "./circula.dv";
import { resonateCircularDV } from "./circular.resonance";
import { startManagedResonanceFrequency } from "../utopy/presence/resonance.runtime";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

type PublishMode = "waste" | "mining" | "recovered" | "need" | "work";
type Recurrence = "once" | "daily" | "weekly" | "monthly" | "on_demand";

const WORK_CAPABILITIES = [
  {
    value: "circular.pickup",
    icon: "🤝",
    label: "Pasar a buscarlo",
    description: "Alguien puede retirar, cargar o recibir lo que publicaste.",
  },
  {
    value: "circular.sort",
    icon: "🧩",
    label: "Separar y ordenar",
    description: "Revisar, clasificar y dejar cada cosa en su mejor camino.",
  },
  {
    value: "circular.repair",
    icon: "🛠️",
    label: "Reparar y recuperar",
    description: "Buscar quién pueda arreglarlo o devolverle utilidad.",
  },
  {
    value: "circular.reuse",
    icon: "🌱",
    label: "Darle otra vida",
    description: "Encontrar una nueva forma de aprovecharlo sin desperdiciarlo.",
  },
  {
    value: "circular.fabrication",
    icon: "✨",
    label: "Crear o transformar",
    description: "Convertir una idea o material en algo nuevo y útil.",
  },
  {
    value: "circular.transport",
    icon: "🚚",
    label: "Llevarlo a otro lugar",
    description: "Conectar con quien pueda trasladarlo o entregarlo.",
  },
  {
    value: "logistics.delivery",
    icon: "🛵",
    label: "Entregar un pedido",
    description: "Buscar un nodo disponible para retirar, seguir y entregar.",
  },
  {
    value: "urban.mining",
    icon: "🔎",
    label: "Recuperar piezas valiosas",
    description: "Revisar objetos para rescatar componentes y materiales útiles.",
  },
] as const;

type WorkDomain = (typeof WORK_CAPABILITIES)[number]["value"];

function workCapability(domain: WorkDomain) {
  return (
    WORK_CAPABILITIES.find((capability) => capability.value === domain) ||
    WORK_CAPABILITIES[0]
  );
}

type Props = {
  activeCajero?: any | null;
  allLive?: any[];
  onPublished?: (payload: { dvs: any[]; threadId: string | null }) => void;
};

const Wrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Card = styled.div`
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 22px;
  background: rgba(255,255,255,.66);
  padding: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 950;
`;

const Subtle = styled.div`
  font-size: 13px;
  opacity: 0.75;
  line-height: 1.45;
`;

const ModeRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ModeBtn = styled.button<{ $active?: boolean }>`
  border: 1px solid rgba(255,255,255,.9);
  border-radius: 999px;
  padding: 9px 12px;
  background: ${({ $active }) =>
    $active ? "rgba(219,225,255,.9)" : "rgba(255,255,255,.54)"};
  color:#40508d;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
`;

const CapabilityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
`;

const CapabilityChoice = styled.button<{ $active?: boolean }>`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: start;
  text-align: left;
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(136,151,231,.7)" : "rgba(255,255,255,.9)")};
  border-radius: 15px;
  padding: 10px;
  background: ${({ $active }) => ($active ? "#ecefff" : "rgba(255,255,255,.7)")};
  color: #111;
  cursor: pointer;

  > span {
    font-size: 20px;
    line-height: 1;
  }

  strong {
    display: block;
    font-size: 12px;
  }

  small {
    display: block;
    margin-top: 3px;
    font-size: 10px;
    line-height: 1.35;
    opacity: 0.65;
  }
`;

const CapabilityHint = styled.div`
  padding: 9px 10px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.08);
  color: #14532d;
  font-size: 11px;
  line-height: 1.4;
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const Field = styled.label`
  display: grid;
  gap: 6px;
`;

const CapabilitySection = styled.div`
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
`;

const FieldLabel = styled.div`
  font-size: 12px;
  font-weight: 900;
  opacity: 0.84;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  background: #fff;
  font-family: inherit;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 92px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  background: #fff;
  font-family: inherit;
  resize: vertical;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  background: #fff;
  font-family: inherit;
`;

const Checks = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const CheckChip = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Btn = styled.button<{ $ghost?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
  padding: 12px 14px;
  background: ${({ $ghost }) => ($ghost ? "rgba(255,255,255,.75)" : "linear-gradient(135deg,#e8ebff,#cbd5ff)")};
  color: #40508d;
  cursor: pointer;
  font-weight: 950;
  box-shadow: ${({ $ghost }) =>
    $ghost ? "none" : "0 10px 20px rgba(107,121,215,.15)"};
`;

const InfoRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Pill = styled.span<{ $tone?: "ok" | "warn" | "neutral" }>`
  font-size: 12px;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(34,197,94,0.12)"
      : $tone === "warn"
        ? "rgba(245,158,11,0.14)"
        : "rgba(0,0,0,0.04)"};
  border: 1px solid rgba(0, 0, 0, 0.06);
`;

const SuccessBox = styled.div`
  border: 1px solid rgba(34, 197, 94, 0.18);
  background: rgba(34, 197, 94, 0.08);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 6px;
`;

const LocationBox = styled.div`
  grid-column: 1 / -1;
  border: 1px solid rgba(34, 197, 94, 0.16);
  border-radius: 18px;
  padding: 12px;
  background:
    radial-gradient(circle at top left, rgba(21, 255, 0, 0.12), transparent 38%),
    rgba(21, 255, 0, 0.035);
  display: grid;
  gap: 10px;
`;

const LocationTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const LocationTitle = styled.div`
  font-weight: 950;
  font-size: 13px;
`;

const LocationSub = styled.div`
  font-size: 12px;
  opacity: 0.68;
  line-height: 1.35;
`;

const LocationStatus = styled.div`
  font-size: 12px;
  opacity: 0.74;
`;

const MiniBtn = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  padding: 9px 12px;
  background: #15ff00;
  color: #111;
  font-weight: 950;
  cursor: pointer;
`;

function makeThreadId() {
  return `mt.thread.circular:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toNumber(v: string, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function cleanArrayText(v: string) {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function modeLabel(mode: PublishMode) {
  switch (mode) {
    case "waste":
      return "Algo para aprovechar";
    case "mining":
      return "Piezas para recuperar";
    case "recovered":
      return "Material listo para usar";
    case "need":
      return "Necesito insumos";
    case "work":
      return "Necesito una mano";
    default:
      return mode;
  }
}

export default function CircularQuickPublishPanel({
  activeCajero,
  allLive = [],
  onPublished,
}: Props) {
  const [mode, setMode] = useState<PublishMode>("waste");

  const [activateResonance, setActivateResonance] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialKey, setMaterialKey] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("u");
  const [price, setPrice] = useState("");
  const [maxUnitPrice, setMaxUnitPrice] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [neededBy, setNeededBy] = useState("");
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [locationMode, setLocationMode] = useState<"auto" | "manual">("auto");
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");

  const [recoverables, setRecoverables] = useState(
    "cobre, componentes, aluminio"
  );
  const [quality, setQuality] = useState("standard");

  const [workDomain, setWorkDomain] =
    useState<WorkDomain>("circular.pickup");
  const selectedWorkCapability = useMemo(
    () => workCapability(workDomain),
    [workDomain]
  );

  const [mirrorOffer, setMirrorOffer] = useState(true);
  const [mirrorDemand, setMirrorDemand] = useState(false);
  const [createWork, setCreateWork] = useState(false);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<null | {
    count: number;
    threadId: string | null;
    label: string;
    resonanceMatches: number;
  }>(null);

  const actorMeta = useMemo(
    () => ({
      actorId: activeCajero?.actorId || activeCajero?.id || null,
      actorName: activeCajero?.nombre || activeCajero?.name || null,
      nodeId: activeCajero?.nodeId || null,
      cajeroId: activeCajero?.cajeroId || null,
      orgId: activeCajero?.orgId || null,
      territoryId: activeCajero?.territorioId || null,
    }),
    [activeCajero]
  );

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Tu navegador no permite ubicación automática.");
      setShowAdvancedLocation(true);
      setLocationMode("manual");
      return;
    }

    setGeoStatus("Buscando tu ubicación...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude.toFixed(6);
        const nextLng = pos.coords.longitude.toFixed(6);

        setLat(nextLat);
        setLng(nextLng);
        setGeoStatus("Ubicación actual cargada ✅");
      },
      () => {
        setGeoStatus("No se pudo obtener ubicación. Podés cargarla manualmente.");
        setShowAdvancedLocation(true);
        setLocationMode("manual");
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    if (locationMode === "auto") {
      useMyLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode]);

  function resetLight() {
    setTitle("");
    setDescription("");
    setMaterialKey("");
    setMaterialName("");
    setQuantity("1");
    setPrice("");
    setMaxUnitPrice("");
    setRecurrence("once");
    setNeededBy("");
    setDeliveryRequired(false);
    setDeliveryAddress("");

    if (locationMode === "auto") {
      useMyLocation();
    } else {
      setLat("");
      setLng("");
    }
  }

  async function submit() {
    try {
      setBusy(true);
      setSuccess(null);

      if (!actorMeta.actorId) {
        throw new Error(
          "Estamos preparando tu identidad privada. Intentá nuevamente en un instante."
        );
      }

      const publishCircular = async (dv: any) => {
        const result = await publishAuthorizedDV({
          dv,
          allLive,
          activeActor: activeCajero,
          action: dv?.kind,
          actingAsNodeId: actorMeta.nodeId,
        });
        return result.dv;
      };

      const threadId = makeThreadId();
      const published: any[] = [];

      const latNum = Number(lat);
      const lngNum = Number(lng);

      const hasLocation =
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum) &&
        latNum !== 0 &&
        lngNum !== 0;

      const locationPayload = hasLocation
        ? {
            lat: latNum,
            lng: lngNum,
            source:
              locationMode === "auto" ? "browser.geolocation" : "manual",
          }
        : null;

      const common = {
        ...actorMeta,
        threadId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        materialKey: materialKey.trim() || undefined,
        materialName: materialName.trim() || undefined,
        quantity: toNumber(quantity, 0),
        unit: unit.trim() || "u",
        lat: locationPayload?.lat ?? null,
        lng: locationPayload?.lng ?? null,
        location: locationPayload,
      };

      if (!common.materialName && mode !== "work") {
        throw new Error("Poné al menos el nombre del material.");
      }

      if (mode === "waste") {
        const dv = makeWasteOfferDV(common);
        published.push(await publishCircular(dv));

        if (mirrorOffer) {
          published.push(
            await publishCircular(
              makeCircularOfferDV({
                ...common,
                price: price.trim() ? toNumber(price, 0) : 0,
              })
            )
          );
        }

        if (createWork) {
          published.push(
            await publishCircular(
              makeCircularWorkIntentDV({
                ...common,
                domain: "circular.pickup",
                title:
                  title.trim() ||
                  `Retirar ${common.materialName || "material circular"}`,
              })
            )
          );
        }
      }

      if (mode === "mining") {
        const dv = makeUrbanMiningLotDV({
          ...common,
          recoverables: cleanArrayText(recoverables),
          category: "electronics",
        });

        published.push(await publishCircular(dv));

        if (createWork) {
          published.push(
            await publishCircular(
              makeCircularWorkIntentDV({
                ...common,
                domain: "urban.mining",
                title:
                  title.trim() ||
                  `Procesar lote ${
                    common.materialName || "de minería urbana"
                  }`,
              })
            )
          );
        }
      }

      if (mode === "recovered") {
        const dv = makeMaterialRecoveredDV({
          ...common,
          quality,
        });

        published.push(await publishCircular(dv));

        if (mirrorOffer) {
          published.push(
            await publishCircular(
              makeCircularOfferDV({
                ...common,
                price: price.trim() ? toNumber(price, 0) : 0,
              })
            )
          );
        }
      }

      if (mode === "need") {
        const demandDV = makeCircularDemandMaterialDV({
          ...common,
          maxUnitPrice: maxUnitPrice.trim()
            ? toNumber(maxUnitPrice, 0)
            : null,
          recurrence,
          neededBy: neededBy || null,
          deliveryRequired,
          deliveryAddress: deliveryAddress.trim() || null,
          title:
            title.trim() ||
            `Necesito ${common.materialName || "insumos"}`,
        });

        published.push(await publishCircular(demandDV));

        if (deliveryRequired) {
          published.push(
            await publishCircular(
              makeCircularDeliveryIntentDV({
                ...common,
                sourceDemandId: demandDV.id,
                parentDvId: demandDV.id,
                rootDvId: demandDV.id,
                sourceDvIds: [demandDV.id],
                pickupLabel: "Punto del nodo que responda",
                dropoffLabel:
                  deliveryAddress.trim() || "Ubicación de quien solicita",
                packageSummary: `${common.quantity || 1} ${common.unit} de ${
                  common.materialName || "insumos"
                }`,
                title: `Entrega de ${common.materialName || "insumos"}`,
              })
            )
          );
        }
      }

      if (mode === "work") {
        const dv = makeCircularWorkIntentDV({
          ...common,
          domain: workDomain,
          title:
            title.trim() ||
            `${selectedWorkCapability.label}: ${common.materialName || "señal abierta"}`,
        });

        published.push(await publishCircular(dv));

        if (mirrorDemand && common.materialName) {
          published.push(
            await publishCircular(
              makeCircularDemandMaterialDV({
                ...common,
                maxUnitPrice: maxUnitPrice.trim()
                  ? toNumber(maxUnitPrice, 0)
                  : null,
                title:
                  title.trim() ||
                  `Buscamos ${common.materialName || "material"}`,
              })
            )
          );
        }
      }

      let resonanceMatches = 0;

      if (activateResonance && published.length > 0) {
        const sourceDVs = [...published];
        const resonanceDVs: any[] = [];

        for (const sourceDV of sourceDVs) {
          const resonance = await resonateCircularDV({
            dv: sourceDV,
            actorId: actorMeta.actorId,
            nodeId: actorMeta.nodeId,
            liveDVs: [...allLive, ...resonanceDVs],
            publishProposals: true,
            publishDV: async (nextDv) => {
              await publishCircular(nextDv as any);
            },
          });

          resonanceDVs.push(
            resonance.intentDV,
            resonance.beaconDV,
            ...resonance.proposals
          );
          resonanceMatches += resonance.matches.length;

          const firstFrequency = resonance.beaconDV?.attrs?.frequency;
          const isOffer =
            resonance.intentDV?.attrs?.intent?.mode === "offer";

          startManagedResonanceFrequency({
            sourceDV: resonance.intentDV,
            actorId: actorMeta.actorId,
            nodeId: actorMeta.nodeId,
            publishDV: async (nextDv) => {
              await publishCircular(nextDv as any);
            },
            geo: resonance.intentDV?.attrs?.geo || null,
            scope: "circular",
            periodMs: 20_000,
            ttlMs: 45_000,
            maxDurationMs: isOffer
              ? 12 * 60 * 60_000
              : 4 * 60 * 60_000,
            sessionId:
              firstFrequency?.sessionId ||
              resonance.beaconDV?.attrs?.sessionId,
            initialSequence: Number(firstFrequency?.sequence || 0) + 1,
            emitImmediately: false,
          });
        }

        published.push(...resonanceDVs);
      }

      setSuccess({
        count: published.length,
        threadId,
        label: modeLabel(mode),
        resonanceMatches,
      });

      onPublished?.({ dvs: published, threadId });

      resetLight();
    } catch (e: any) {
      alert(e?.message || "No se pudo publicar en Circular");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Wrap>
      <Card>
        <Head>
          <div style={{ display: "grid", gap: 4 }}>
            <Title>⚡ Contalo a tu manera</Title>
            <Subtle>
              Elegí la idea que más se parece a lo que querés. UTOPY conserva
              el significado técnico por debajo para que la red siga
              entendiéndolo.
            </Subtle>
          </div>

          <InfoRow>
            <Pill $tone="ok">{modeLabel(mode)}</Pill>
            <Pill $tone="neutral">
              {activeCajero?.nombre || "sin cajero activo"}
            </Pill>
          </InfoRow>
        </Head>

        <ModeRow>
          <ModeBtn $active={mode === "waste"} onClick={() => setMode("waste")}>
            ♻️ Algo aprovechable
          </ModeBtn>

          <ModeBtn
            $active={mode === "mining"}
            onClick={() => setMode("mining")}
          >
            🔎 Recuperar piezas
          </ModeBtn>

          <ModeBtn
            $active={mode === "recovered"}
            onClick={() => setMode("recovered")}
          >
            🧱 Material listo
          </ModeBtn>

          <ModeBtn $active={mode === "need"} onClick={() => setMode("need")}>
            📥 Necesito insumos
          </ModeBtn>

          <ModeBtn $active={mode === "work"} onClick={() => setMode("work")}>
            🤝 Necesito una mano
          </ModeBtn>
        </ModeRow>

        <Grid>
          <Field>
            <FieldLabel>¿Qué está pasando?</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                mode === "work"
                  ? "Ej.: " + selectedWorkCapability.label.toLowerCase()
                  : mode === "need"
                    ? "Ej.: Necesitamos leche cada semana"
                  : "Ej.: Tengo madera que alguien puede aprovechar"
              }
            />
          </Field>

          <Field>
            <FieldLabel>Palabra para encontrarlo</FieldLabel>
            <Input
              value={materialKey}
              onChange={(e) => setMaterialKey(e.target.value)}
              placeholder="madera, botellas, cables, mueble..."
            />
          </Field>

          <Field>
            <FieldLabel>¿Qué objeto o material es?</FieldLabel>
            <Input
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="Botellas, placas, madera, un mueble..."
            />
          </Field>

          <Field>
            <FieldLabel>Cantidad</FieldLabel>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
            />
          </Field>

          <Field>
            <FieldLabel>Unidad</FieldLabel>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg / u / m / lote"
            />
          </Field>

          {(mode === "waste" || mode === "recovered") && (
            <Field>
              <FieldLabel>Precio sugerido</FieldLabel>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1800"
              />
            </Field>
          )}

          {mode === "work" && (
            <CapabilitySection>
              <FieldLabel>¿Qué te gustaría que ocurra?</FieldLabel>
              <CapabilityGrid>
                {WORK_CAPABILITIES.map((capability) => (
                  <CapabilityChoice
                    key={capability.value}
                    type="button"
                    $active={workDomain === capability.value}
                    onClick={() => setWorkDomain(capability.value)}
                  >
                    <span>{capability.icon}</span>
                    <div>
                      <strong>{capability.label}</strong>
                      <small>{capability.description}</small>
                    </div>
                  </CapabilityChoice>
                ))}
              </CapabilityGrid>
              <CapabilityHint>
                Elegiste: <b>{selectedWorkCapability.label}</b>. Cualquier nodo
                que demuestre una capacidad compatible puede responder; no se
                limita a una profesión o empresa determinada.
              </CapabilityHint>
            </CapabilitySection>
          )}

          {(mode === "work" || mode === "need") && (
            <Field>
              <FieldLabel>¿Hasta cuánto pagarías? (opcional)</FieldLabel>
              <Input
                value={maxUnitPrice}
                onChange={(e) => setMaxUnitPrice(e.target.value)}
                placeholder="2500"
              />
            </Field>
          )}

          {mode === "need" && (
            <>
              <Field>
                <FieldLabel>¿Cada cuánto lo necesitás?</FieldLabel>
                <Select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                >
                  <option value="once">Una sola vez</option>
                  <option value="daily">Todos los días</option>
                  <option value="weekly">Cada semana</option>
                  <option value="monthly">Cada mes</option>
                  <option value="on_demand">Cuando haga falta</option>
                </Select>
              </Field>

              <Field>
                <FieldLabel>¿Para cuándo? (opcional)</FieldLabel>
                <Input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                />
              </Field>

              <CapabilitySection>
                <CheckChip>
                  <input
                    type="checkbox"
                    checked={deliveryRequired}
                    onChange={(e) => setDeliveryRequired(e.target.checked)}
                  />
                  También necesito que llegue hasta mí
                </CheckChip>

                {deliveryRequired ? (
                  <Field>
                    <FieldLabel>Dirección o referencia de entrega</FieldLabel>
                    <Input
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Barrio, calle o punto de referencia"
                    />
                  </Field>
                ) : null}

                <CapabilityHint>
                  La demanda queda abierta a cualquier nodo compatible. Las
                  ofertas, el acuerdo y la entrega continúan en la misma
                  conversación, siempre con confirmación.
                </CapabilityHint>
              </CapabilitySection>
            </>
          )}

          {mode === "recovered" && (
            <Field>
              <FieldLabel>¿Cómo está el material?</FieldLabel>
              <Select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="standard">Listo para revisar</option>
                <option value="clean">Limpio y separado</option>
                <option value="premium">Selección especial</option>
                <option value="mixed">Mezclado</option>
              </Select>
            </Field>
          )}

          {mode === "mining" && (
            <Field>
              <FieldLabel>¿Qué se podría recuperar?</FieldLabel>
              <Input
                value={recoverables}
                onChange={(e) => setRecoverables(e.target.value)}
                placeholder="cobre, componentes, aluminio"
              />
            </Field>
          )}

          <LocationBox>
            <LocationTop>
              <div>
                <LocationTitle>Ubicación de la señal</LocationTitle>
                <LocationSub>
                  Por defecto usamos tu ubicación actual para que aparezca en el
                  mapa vivo.
                </LocationSub>
              </div>

              <MiniBtn type="button" onClick={useMyLocation}>
                Usar mi ubicación
              </MiniBtn>
            </LocationTop>

            {geoStatus ? <LocationStatus>{geoStatus}</LocationStatus> : null}

            <CheckChip>
              <input
                type="checkbox"
                checked={showAdvancedLocation}
                onChange={(e) => {
                  setShowAdvancedLocation(e.target.checked);

                  if (e.target.checked) {
                    setLocationMode("manual");
                  } else {
                    setLocationMode("auto");
                  }
                }}
              />
              Configuración avanzada de ubicación
            </CheckChip>

            {showAdvancedLocation ? (
              <Grid>
                <Field>
                  <FieldLabel>Latitud</FieldLabel>
                  <Input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="-24.0676"
                  />
                </Field>

                <Field>
                  <FieldLabel>Longitud</FieldLabel>
                  <Input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="-54.3101"
                  />
                </Field>
              </Grid>
            ) : null}
          </LocationBox>
        </Grid>

        <Field style={{ marginTop: 12 }}>
          <FieldLabel>Contanos un poco más</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cómo está, cuándo podría hacerse, qué necesitás o cualquier detalle útil..."
          />
        </Field>

        <Checks style={{ marginTop: 12 }}>
          {(mode === "waste" || mode === "recovered") && (
            <CheckChip>
              <input
                type="checkbox"
                checked={mirrorOffer}
                onChange={(e) => setMirrorOffer(e.target.checked)}
              />
              También avisar que está disponible
            </CheckChip>
          )}

          <CheckChip>
            <input
              type="checkbox"
              checked={activateResonance}
              onChange={(e) => setActivateResonance(e.target.checked)}
            />
            Activar Resonancia Viva
          </CheckChip>

          {(mode === "waste" || mode === "mining") && (
            <CheckChip>
              <input
                type="checkbox"
                checked={createWork}
                onChange={(e) => setCreateWork(e.target.checked)}
              />
              También pedir ayuda para moverlo o procesarlo
            </CheckChip>
          )}

          {mode === "work" && (
            <CheckChip>
              <input
                type="checkbox"
                checked={mirrorDemand}
                onChange={(e) => setMirrorDemand(e.target.checked)}
              />
              También avisar que hace falta este material
            </CheckChip>
          )}
        </Checks>

        <Actions style={{ marginTop: 14 }}>
          <Btn $ghost onClick={resetLight}>
            Limpiar
          </Btn>

          <Btn onClick={submit} disabled={busy as any}>
            {busy ? "Compartiendo..." : "Hacer visible mi señal"}
          </Btn>
        </Actions>

        {success ? (
          <SuccessBox style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 950 }}>
              ✅ Publicado: {success.label}
            </div>

            <div style={{ fontSize: 13, opacity: 0.78 }}>
              Se crearon {success.count} señal(es) conectadas. Cualquier nodo
              con capacidades compatibles puede entenderlas y responder.
            </div>

            {activateResonance ? (
              <div style={{ fontSize: 12, opacity: 0.72 }}>
                Resonancia activa · {success.resonanceMatches} coincidencia(s)
                inicial(es) · toda conexión requiere confirmación.
              </div>
            ) : null}

            {success.threadId ? (
              <details style={{ fontSize: 11, opacity: 0.65 }}>
                <summary>Detalle técnico</summary>
                Conversación lista
              </details>
            ) : null}
          </SuccessBox>
        ) : null}
      </Card>
    </Wrap>
  );
}
