// src/mt/SignalComposer.tsx
// Publicador humano + estructurado de Señales Vivas para MS Market.

import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { requestApproximateBrowserLocation } from "./mt.threadProtocol";
import { runFurnitureLiveDemo } from "./mt.furnitureDemo";
import {
  SIGNAL_CATEGORIES,
  publishUniversalSignal,
  type SignalCategory,
  type SignalMode,
} from "./mt.signalProtocol";

type Props = {
  actorId: string;
  actorName?: string | null;
  nodeId?: string | null;
  threadId?: string | null;
  chainId?: string | null;
  relatedToThreadId?: string | null;
  previousChainId?: string | null;
  sourceDV?: any;
  allLive?: any[];
  activeActor?: any | null;
  initialMode?: SignalMode;
  initialCategory?: SignalCategory;
  initialTitle?: string;
  initialText?: string;
  initialDesignId?: string | null;
  initialImage?: string | null;
  compact?: boolean;
  onPublished?: (dv: any) => void;
  onClose?: () => void;
};

const Shell = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 20px;
  background: linear-gradient(145deg, #ffffff, #f4fff1);
  padding: 14px;
  display: grid;
  gap: 14px;
  color: #0b130d;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const Title = styled.div`
  font-size: 1.05rem;
  font-weight: 950;
`;

const Hint = styled.div`
  opacity: 0.68;
  font-size: 0.86rem;
  line-height: 1.4;
`;

const ModeRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) => ($active ? "#17bc37" : "rgba(0,0,0,0.1)")};
  background: ${({ $active }) => ($active ? "#18ff43" : "#fff")};
  color: #07110a;
  border-radius: 14px;
  padding: 11px;
  font-weight: 950;
  cursor: pointer;
`;

const Categories = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 8px;
`;

const CategoryButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) => ($active ? "#17bc37" : "rgba(0,0,0,0.09)")};
  background: ${({ $active }) =>
    $active ? "rgba(24,255,67,0.14)" : "rgba(255,255,255,0.86)"};
  border-radius: 14px;
  padding: 10px;
  display: grid;
  gap: 4px;
  text-align: left;
  cursor: pointer;
  color: inherit;
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 660px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label<{ $wide?: boolean }>`
  display: grid;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 850;
  ${({ $wide }) => ($wide ? "grid-column: 1 / -1;" : "")}

  input,
  textarea,
  select {
    width: 100%;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 12px;
    padding: 10px 11px;
    font: inherit;
    background: #fff;
  }

  textarea {
    min-height: 92px;
    resize: vertical;
  }
`;

const LocationRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 0.84rem;
  line-height: 1.35;
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 13px;
  padding: 10px 14px;
  font-weight: 950;
  cursor: pointer;
  background: ${({ $primary }) => ($primary ? "#18ff43" : "#fff")};
  color: #07110a;
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
`;

const Result = styled.div`
  border: 1px solid rgba(23, 188, 55, 0.25);
  background: rgba(24, 255, 67, 0.1);
  border-radius: 14px;
  padding: 11px;
  font-size: 0.86rem;
  line-height: 1.45;
`;

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function SignalComposer({
  actorId,
  actorName = "Actor local",
  nodeId = null,
  threadId = null,
  chainId = null,
  relatedToThreadId = null,
  previousChainId = null,
  sourceDV = null,
  allLive = [],
  activeActor = null,
  initialMode = "need",
  initialCategory = "design",
  initialTitle = "",
  initialText = "",
  initialDesignId = null,
  initialImage = null,
  compact = false,
  onPublished,
  onClose,
}: Props) {
  const [mode, setMode] = useState<SignalMode>(initialMode);
  const [category, setCategory] =
    useState<SignalCategory>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialText);
  const [objectType, setObjectType] = useState(
    initialCategory === "design" ? "mueble" : ""
  );
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("u");
  const [money, setMoney] = useState("");
  const [image, setImage] = useState(initialImage || "");
  const [shareApproximateLocation, setShareApproximateLocation] =
    useState(true);
  const [sending, setSending] = useState(false);
  const [demoing, setDemoing] = useState(false);
  const [published, setPublished] = useState<any | null>(null);
  const [error, setError] = useState("");

  const selectedCategory = useMemo(
    () => SIGNAL_CATEGORIES.find((item) => item.id === category),
    [category]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setError("");
    setSending(true);
    try {
      const location = shareApproximateLocation
        ? await requestApproximateBrowserLocation()
        : null;
      const result = await publishUniversalSignal({
        mode,
        category,
        title,
        text: description,
        actorId,
        actorName,
        nodeId,
        threadId,
        chainId,
        relatedToThreadId,
        previousChainId,
        sourceDV,
        designId: initialDesignId,
        objectType,
        image,
        material,
        quantity: numberOrNull(quantity),
        unit,
        price: mode === "offer" ? numberOrNull(money) : null,
        budget: mode === "need" ? numberOrNull(money) : null,
        currency: "PYG",
        location,
        sourceApp: "ms:signal-composer",
        allLive,
        activeActor,
      });
      setPublished(result.dv);
      onPublished?.(result.dv);
    } catch (nextError: any) {
      setError(nextError?.message || "No se pudo publicar la señal.");
    } finally {
      setSending(false);
    }
  };

  const runFurnitureDemo = async () => {
    if (!import.meta.env.DEV) return;
    if (demoing) return;
    setError("");
    setDemoing(true);
    try {
      const location = shareApproximateLocation
        ? await requestApproximateBrowserLocation()
        : null;
      const result = await runFurnitureLiveDemo({
        actorId,
        actorName: actorName || "Persona interesada",
        location,
      });
      setPublished({
        kind: "utopy.demo.result",
        attrs: {
          threadId: result.threadId,
          chainId: result.chainId,
          title: `${result.dvs.length} señales: ${result.needs} necesidades y ${result.offers} ofertas`,
        },
      });
      onPublished?.(result.dvs[0]);
    } catch (nextError: any) {
      setError(nextError?.message || "No se pudo ejecutar la prueba del mueble.");
    } finally {
      setDemoing(false);
    }
  };

  return (
    <Shell>
      <Header>
        <div>
          <Title>{compact ? "¿Qué necesitás ahora?" : "📡 Publicar una Señal Viva"}</Title>
          <Hint>
            {compact
              ? "Podés continuar esta operación o abrir una necesidad nueva sin mezclar historias."
              : "Explicá lo necesario y elegí una categoría. UTOPY completa el DV, conserva el hilo y busca nodos compatibles."}
          </Hint>
        </div>
        {onClose ? <Button onClick={onClose}>Cerrar</Button> : null}
      </Header>

      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <ModeRow>
          <ModeButton
            type="button"
            $active={mode === "need"}
            onClick={() => setMode("need")}
          >
            🙋 Necesito algo
          </ModeButton>
          <ModeButton
            type="button"
            $active={mode === "offer"}
            onClick={() => setMode("offer")}
          >
            🤲 Puedo ofrecer algo
          </ModeButton>
        </ModeRow>

        <div>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>
            ¿De qué se trata?
          </div>
          <Categories>
            {SIGNAL_CATEGORIES.map((item) => (
              <CategoryButton
                type="button"
                key={item.id}
                $active={item.id === category}
                onClick={() => setCategory(item.id)}
              >
                <strong>
                  {item.emoji} {item.label}
                </strong>
                {!compact ? <span>{item.hint}</span> : null}
              </CategoryButton>
            ))}
          </Categories>
        </div>

        <Fields>
          <Field $wide>
            Título
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                mode === "need"
                  ? "Ej.: Quiero fabricar un mueble para mi sala"
                  : "Ej.: Diseño y fabrico muebles a medida"
              }
              required
            />
          </Field>

          <Field $wide>
            Contalo con tus palabras
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={selectedCategory?.hint}
            />
          </Field>

          <Field>
            Objeto o resultado
            <input
              value={objectType}
              onChange={(event) => setObjectType(event.target.value)}
              placeholder="mueble, mesa, estante, reparación..."
            />
          </Field>

          <Field>
            Material, si ya lo sabés
            <input
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              placeholder="madera, MDF, metal..."
            />
          </Field>

          <Field>
            Cantidad
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>

          <Field>
            Unidad
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="u">unidad</option>
              <option value="kg">kilogramo</option>
              <option value="m">metro</option>
              <option value="m2">metro cuadrado</option>
              <option value="lote">lote</option>
              <option value="servicio">servicio</option>
            </select>
          </Field>

          <Field>
            {mode === "need" ? "Presupuesto opcional" : "Precio opcional"}
            <input
              type="number"
              min="0"
              step="any"
              value={money}
              onChange={(event) => setMoney(event.target.value)}
              placeholder="PYG"
            />
          </Field>

          <Field>
            Imagen o vista previa opcional
            <input
              value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="URL de imagen del diseño"
            />
          </Field>
        </Fields>

        <LocationRow>
          <input
            type="checkbox"
            checked={shareApproximateLocation}
            onChange={(event) =>
              setShareApproximateLocation(event.target.checked)
            }
          />
          <span>
            Mostrar una ubicación aproximada en el Mapa Vivo. El navegador pide
            permiso y UTOPY no publica la dirección exacta.
          </span>
        </LocationRow>

        {error ? <Result style={{ borderColor: "#ef4444" }}>{error}</Result> : null}
        {published ? (
          <Result>
            <strong>Señal publicada.</strong> Ya está en el hilo, Fábrica Viva,
            resonancia y Mapa Vivo cuando tiene ubicación.
            <br />
            {import.meta.env.DEV && !compact ? <small>threadId: {published.attrs?.threadId}</small> : null}
          </Result>
        ) : null}

        <Actions>
          {!compact && import.meta.env.DEV ? (
            <Button type="button" disabled={demoing} onClick={runFurnitureDemo}>
              {demoing ? "Creando prueba…" : "🧪 Probar ciclo del mueble"}
            </Button>
          ) : null}
          <Button type="submit" $primary disabled={sending}>
            {sending
              ? "Publicando…"
              : mode === "need"
                ? "Emitir necesidad"
                : "Publicar oferta"}
          </Button>
        </Actions>
      </form>
    </Shell>
  );
}
