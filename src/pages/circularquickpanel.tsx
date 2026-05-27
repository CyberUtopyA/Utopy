import React, { useMemo, useState } from "react";
import styled from "styled-components";
import {
  makeCircularDemandMaterialDV,
  makeCircularOfferDV,
  makeCircularWorkIntentDV,
  makeMaterialRecoveredDV,
  makeUrbanMiningLotDV,
  makeWasteOfferDV,
  publishCircularDV,
} from "./circula.dv";
import { sendCircularToMO } from "../mt/circular.mo";

type PublishMode = "waste" | "mining" | "recovered" | "work";

type Props = {
  activeCajero?: any | null;
  onPublished?: (payload: { dvs: any[]; threadId: string | null }) => void;
};

const Wrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Card = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fff9 100%);
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
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  padding: 9px 12px;
  background: ${({ $active }) =>
    $active ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.03)"};
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
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
  background: ${({ $ghost }) => ($ghost ? "#fff" : "#15ff00ff")};
  color: #111;
  cursor: pointer;
  font-weight: 950;
  box-shadow: ${({ $ghost }) =>
    $ghost ? "none" : "0 10px 20px rgba(21,255,0,0.16)"};
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

function makeThreadId() {
  return `mt.thread.circular:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
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
      return "Residuo / material";
    case "mining":
      return "Minería urbana";
    case "recovered":
      return "Material recuperado";
    case "work":
      return "Trabajo circular";
    default:
      return mode;
  }
}

export default function CircularQuickPublishPanel({
  activeCajero,
  onPublished,
}: Props) {
  const [mode, setMode] = useState<PublishMode>("waste");
const [sendToMO, setSendToMO] = useState(false);
const [runMoAction, setRunMoAction] = useState(false);
const [moAction, setMoAction] = useState<
  | "mo.reuse.plan.from.material"
  | "mo.fabrication.pack.from.recovered"
  | "mo.plan.from.urban.mining"
>("mo.reuse.plan.from.material");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialKey, setMaterialKey] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("u");
  const [price, setPrice] = useState("");
  const [maxUnitPrice, setMaxUnitPrice] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [recoverables, setRecoverables] = useState("copper, chip, aluminum");
  const [quality, setQuality] = useState("standard");
  const [workDomain, setWorkDomain] = useState<
    | "circular.pickup"
    | "circular.sort"
    | "circular.repair"
    | "circular.reuse"
    | "circular.fabrication"
    | "circular.transport"
    | "urban.mining"
  >("circular.pickup");

  const [mirrorOffer, setMirrorOffer] = useState(true);
  const [mirrorDemand, setMirrorDemand] = useState(false);
  const [createWork, setCreateWork] = useState(false);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<null | {
    count: number;
    threadId: string | null;
    label: string;
  }>(null);

  const actorMeta = useMemo(
    () => ({
      actorId: activeCajero?.id || null,
      actorName: activeCajero?.nombre || null,
      nodeId: activeCajero?.id || null,
      orgId: activeCajero?.orgId || null,
      territoryId: activeCajero?.territorioId || null,
    }),
    [activeCajero]
  );

  function resetLight() {
    setTitle("");
    setDescription("");
    setMaterialKey("");
    setMaterialName("");
    setQuantity("1");
    setPrice("");
    setMaxUnitPrice("");
    setLat("");
    setLng("");
  }

  async function submit() {
    try {
      setBusy(true);
      setSuccess(null);

      const threadId = makeThreadId();
      const published: any[] = [];

      const common = {
        ...actorMeta,
        threadId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        materialKey: materialKey.trim() || undefined,
        materialName: materialName.trim() || undefined,
        quantity: toNumber(quantity, 0),
        unit: unit.trim() || "u",
        lat: lat.trim() ? toNumber(lat, 0) : null,
        lng: lng.trim() ? toNumber(lng, 0) : null,
      };

      if (!common.materialName && mode !== "work") {
        throw new Error("Poné al menos el nombre del material.");
      }

      if (mode === "waste") {
        const dv = makeWasteOfferDV(common);
        published.push(publishCircularDV(dv));

        if (mirrorOffer) {
          published.push(
            publishCircularDV(
              makeCircularOfferDV({
                ...common,
                price: price.trim() ? toNumber(price, 0) : 0,
              })
            )
          );
        }

        if (createWork) {
          published.push(
            publishCircularDV(
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
        published.push(publishCircularDV(dv));

        if (createWork) {
          published.push(
            publishCircularDV(
              makeCircularWorkIntentDV({
                ...common,
                domain: "urban.mining",
                title:
                  title.trim() ||
                  `Procesar lote ${common.materialName || "de minería urbana"}`,
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
        published.push(publishCircularDV(dv));

        if (mirrorOffer) {
          published.push(
            publishCircularDV(
              makeCircularOfferDV({
                ...common,
                price: price.trim() ? toNumber(price, 0) : 0,
              })
            )
          );
        }
      }

      if (mode === "work") {
        const dv = makeCircularWorkIntentDV({
          ...common,
          domain: workDomain,
          title: title.trim() || `Trabajo ${workDomain}`,
        });
        published.push(publishCircularDV(dv));

        if (mirrorDemand && common.materialName) {
          published.push(
            publishCircularDV(
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
if (sendToMO && published.length > 0) {
  const lastPublished = published[published.length - 1];

  await sendCircularToMO({
    dv: lastPublished,
    actorId: actorMeta.actorId,
    actorName: actorMeta.actorName,
    orgId: actorMeta.orgId,
    territoryId: actorMeta.territoryId,
    note:
      description.trim() ||
      `Circular → MO · ${materialName || title || "material"}`,
    runAction: runMoAction,
    action: runMoAction ? moAction : null,
  });
}
      setSuccess({
        count: published.length,
        threadId,
        label: modeLabel(mode),
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
            <Title>⚡ Publicación rápida circular</Title>
            <Subtle>
              Publicá en segundos residuos, lotes de minería urbana, material recuperado
              o trabajo circular sin salir del centro operativo.
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
            ♻️ Residuo
          </ModeBtn>
          <ModeBtn $active={mode === "mining"} onClick={() => setMode("mining")}>
            🧲 Minería urbana
          </ModeBtn>
          <ModeBtn
            $active={mode === "recovered"}
            onClick={() => setMode("recovered")}
          >
            🧱 Recuperado
          </ModeBtn>
          <ModeBtn $active={mode === "work"} onClick={() => setMode("work")}>
            🛠️ Trabajo
          </ModeBtn>
        </ModeRow>

        <Grid>
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Lote PET para retiro"
            />
          </Field>

          <Field>
            <FieldLabel>Material key</FieldLabel>
            <Input
              value={materialKey}
              onChange={(e) => setMaterialKey(e.target.value)}
              placeholder="plastic.pet / electronics.scrap / wood.reclaimed"
            />
          </Field>

          <Field>
            <FieldLabel>Material</FieldLabel>
            <Input
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="Botellas PET / placas / cobre limpio"
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
            <Field>
              <FieldLabel>Dominio laboral</FieldLabel>
              <Select
                value={workDomain}
                onChange={(e) => setWorkDomain(e.target.value as any)}
              >
                <option value="circular.pickup">circular.pickup</option>
                <option value="circular.sort">circular.sort</option>
                <option value="circular.repair">circular.repair</option>
                <option value="circular.reuse">circular.reuse</option>
                <option value="circular.fabrication">circular.fabrication</option>
                <option value="circular.transport">circular.transport</option>
                <option value="urban.mining">urban.mining</option>
              </Select>
            </Field>
          )}

          {mode === "work" && (
            <Field>
              <FieldLabel>Max precio por unidad</FieldLabel>
              <Input
                value={maxUnitPrice}
                onChange={(e) => setMaxUnitPrice(e.target.value)}
                placeholder="2500"
              />
            </Field>
          )}

          {mode === "recovered" && (
            <Field>
              <FieldLabel>Calidad</FieldLabel>
              <Select value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="standard">standard</option>
                <option value="clean">clean</option>
                <option value="premium">premium</option>
                <option value="mixed">mixed</option>
              </Select>
            </Field>
          )}

          {mode === "mining" && (
            <Field>
              <FieldLabel>Recoverables</FieldLabel>
              <Input
                value={recoverables}
                onChange={(e) => setRecoverables(e.target.value)}
                placeholder="copper, chip, aluminum"
              />
            </Field>
          )}

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

        <Field style={{ marginTop: 12 }}>
          <FieldLabel>Descripción / nota</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Estado, retiro, urgencia, disponibilidad, detalle..."
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
              Reflejar también como oferta para radar
            </CheckChip>
          )}
          <CheckChip>
  <input
    type="checkbox"
    checked={sendToMO}
    onChange={(e) => setSendToMO(e.target.checked)}
  />
  Enviar también a MO
</CheckChip>

{sendToMO ? (
  <>
    <CheckChip>
      <input
        type="checkbox"
        checked={runMoAction}
        onChange={(e) => setRunMoAction(e.target.checked)}
      />
      Disparar action.run
    </CheckChip>

    <Field style={{ minWidth: 260 }}>
      <FieldLabel>Acción MO</FieldLabel>
      <Select
        value={moAction}
        onChange={(e) => setMoAction(e.target.value as any)}
      >
        <option value="mo.reuse.plan.from.material">
          mo.reuse.plan.from.material
        </option>
        <option value="mo.fabrication.pack.from.recovered">
          mo.fabrication.pack.from.recovered
        </option>
        <option value="mo.plan.from.urban.mining">
          mo.plan.from.urban.mining
        </option>
      </Select>
    </Field>
  </>
) : null}

          {(mode === "waste" || mode === "mining") && (
            <CheckChip>
              <input
                type="checkbox"
                checked={createWork}
                onChange={(e) => setCreateWork(e.target.checked)}
              />
              Crear trabajo asociado
            </CheckChip>
          )}

          {mode === "work" && (
            <CheckChip>
              <input
                type="checkbox"
                checked={mirrorDemand}
                onChange={(e) => setMirrorDemand(e.target.checked)}
              />
              Reflejar también como demanda de material
            </CheckChip>
          )}
        </Checks>

        <Actions style={{ marginTop: 14 }}>
          <Btn $ghost onClick={resetLight}>
            Limpiar
          </Btn>
          <Btn onClick={submit} disabled={busy as any}>
            {busy ? "Publicando..." : "Publicar en Circular"}
          </Btn>
        </Actions>

        {success ? (
          <SuccessBox style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 950 }}>
              ✅ Publicado: {success.label}
            </div>
            <div style={{ fontSize: 13, opacity: 0.78 }}>
              Se emitieron {success.count} DV(s) y el hilo circular quedó listo.
            </div>
            {success.threadId ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                threadId: {success.threadId}
              </div>
            ) : null}
          </SuccessBox>
        ) : null}
      </Card>
    </Wrap>
  );
}