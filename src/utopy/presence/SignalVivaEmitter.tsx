import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { createIntentDV } from "./resonance.dv";
import {
  DEFAULT_RESONANCE_SECURITY,
  sealResonanceDV,
} from "./resonance.security";
import type {
  DVLike,
  ResonanceCapability,
  ResonanceGeo,
  ResonanceIntentMode,
  ResonancePublisher,
  ResonanceSecurityPolicy,
} from "./resonance.types";
import ResonanceOrb from "./ResonanceOrb";
import { useResonanceFrequency } from "./useResonanceFrequency";
import useResonanceScanner from "./useResonanceScanner";
import { buildWhatsAppSignalLink } from "./whatsapp.resonance";

type SignalMode = "need" | "offer" | "material" | "work" | "produce";

const MODES: Array<{ id: SignalMode; emoji: string; label: string }> = [
  { id: "need", emoji: "◌", label: "Necesito algo" },
  { id: "offer", emoji: "✦", label: "Ofrezco algo" },
  { id: "material", emoji: "◇", label: "Tengo material" },
  { id: "work", emoji: "⌁", label: "Trabajo u oficio" },
  { id: "produce", emoji: "◈", label: "Quiero crear o producir" },
];

const Wrap = styled.section`
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 26px;
  border: 1px solid rgba(103, 84, 158, 0.13);
  background:
    radial-gradient(circle at 8% 0%, rgba(159,140,255,.18), transparent 32%),
    radial-gradient(circle at 100% 100%, rgba(126,219,194,.16), transparent 36%),
    #fbfaff;
  box-shadow: 0 18px 48px rgba(58, 47, 91, 0.11);
  color: #252036;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Title = styled.div`
  font-size: 1.08rem;
  font-weight: 950;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.88rem;
  line-height: 1.42;
`;

const Modes = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 8px;
`;

const ModeButton = styled.button<{ $active?: boolean }>`
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(113,96,215,.42)" : "rgba(55,45,82,.1)")};
  border-radius: 16px;
  padding: 11px;
  text-align: left;
  font: inherit;
  font-weight: 850;
  cursor: pointer;
  color: #28223b;
  background: ${({ $active }) =>
    $active ? "rgba(159,140,255,.16)" : "rgba(255,255,255,.72)"};
`;

const Field = styled.label`
  display: grid;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 900;
`;

const Textarea = styled.textarea`
  min-height: 96px;
  resize: vertical;
  border: 1px solid rgba(55,45,82,.13);
  border-radius: 16px;
  padding: 12px;
  font: inherit;
  background: rgba(255,255,255,.82);
`;

const Input = styled.input`
  border: 1px solid rgba(55,45,82,.13);
  border-radius: 14px;
  padding: 11px 12px;
  font: inherit;
  background: rgba(255,255,255,.82);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $ghost?: boolean }>`
  border: 1px solid rgba(72,58,112,.15);
  border-radius: 15px;
  padding: 11px 14px;
  cursor: pointer;
  font: inherit;
  font-weight: 950;
  background: ${({ $ghost }) => ($ghost ? "#fff" : "#7160d7")};
  color: ${({ $ghost }) => ($ghost ? "#302846" : "#fff")};
  box-shadow: ${({ $ghost }) =>
    $ghost ? "none" : "0 10px 22px rgba(113,96,215,.22)"};

  &:disabled {
    opacity: .5;
    cursor: not-allowed;
  }
`;

const Status = styled.div`
  display: grid;
  gap: 8px;
  border: 1px solid rgba(126,219,194,.28);
  border-radius: 18px;
  padding: 12px;
  background: rgba(126,219,194,.1);
`;

function splitTokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function modeToIntent(mode: SignalMode): ResonanceIntentMode {
  if (mode === "offer" || mode === "material") return "offer";
  if (mode === "work") return "collaborate";
  if (mode === "produce") return "produce";
  return "need";
}

function geolocate(): Promise<ResonanceGeo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador no permite ubicación automática."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          source: "device",
        }),
      () => reject(new Error("No se pudo obtener la ubicación.")),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 }
    );
  });
}

export default function SignalVivaEmitter({
  actorId,
  nodeId,
  publishDV,
  allDVs,
  whatsappNumber,
  shareExactLocation = false,
  onPublished,
}: {
  actorId: string;
  nodeId?: string | null;
  publishDV: ResonancePublisher;
  allDVs?: DVLike[];
  whatsappNumber?: string;
  shareExactLocation?: boolean;
  onPublished?: (dv: DVLike) => void;
}) {
  const [mode, setMode] = useState<SignalMode>("need");
  const [message, setMessage] = useState("");
  const [domains, setDomains] = useState("");
  const [resources, setResources] = useState("");
  const [geo, setGeo] = useState<ResonanceGeo | null>(null);
  const [activeSource, setActiveSource] = useState<DVLike | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const policy = useMemo<ResonanceSecurityPolicy>(
    () => ({
      ...DEFAULT_RESONANCE_SECURITY,
      geoPrecision: shareExactLocation ? "exact" : "approximate",
    }),
    [shareExactLocation]
  );

  const stablePublish = useCallback(
    (dv: DVLike) => publishDV(dv),
    [publishDV]
  );
  const frequency = useResonanceFrequency({
    enabled: Boolean(activeSource),
    sourceDV: activeSource,
    actorId,
    nodeId,
    publishDV: stablePublish,
    geo,
    periodMs: 20_000,
    ttlMs: 45_000,
    policy,
  });
  const scanner = useResonanceScanner({
    enabled: Boolean(activeSource),
    intentDV: activeSource,
    allDVs,
    limit: 8,
  });

  const locate = async () => {
    setStatus("Obteniendo ubicación…");
    try {
      const nextGeo = await geolocate();
      setGeo(nextGeo);
      setStatus(
        shareExactLocation
          ? "Ubicación exacta preparada."
          : "Ubicación aproximada preparada."
      );
      return nextGeo;
    } catch (error: any) {
      setStatus(error?.message || "La señal puede emitirse sin ubicación.");
      return null;
    }
  };

  const submit = async () => {
    if (!message.trim()) {
      setStatus("Contá brevemente qué necesitás u ofrecés.");
      return;
    }

    setBusy(true);
    try {
      const nextGeo = geo || (await locate());
      const intentMode = modeToIntent(mode);
      const domainList = splitTokens(domains);
      const resourceList = splitTokens(resources);
      const capability: ResonanceCapability = {
        domains: domainList.length ? domainList : [mode],
        verbs:
          mode === "material"
            ? ["supply", "share", "sell"]
            : mode === "work"
              ? ["work", "repair", "produce"]
              : [intentMode],
        resources: resourceList,
      };
      const source = createIntentDV({
        actorId,
        nodeId,
        intent: {
          mode: intentMode,
          domains: capability.domains,
          verbs: capability.verbs,
          resources: resourceList,
          maxDistanceKm: 50,
        },
        capabilities:
          intentMode === "offer" || mode === "work" ? [capability] : [],
        labels: [message.trim(), MODES.find((item) => item.id === mode)?.label || "Señal Viva"],
        geo: nextGeo,
        entryMethod: "resonance",
        policy,
      });
      const sealed = await sealResonanceDV(source);
      await stablePublish(sealed);
      setActiveSource(sealed);
      setStatus("Frecuencia Viva activa. La red está buscando capacidades compatibles.");
      onPublished?.(sealed);
    } catch (error: any) {
      setStatus(error?.message || "No se pudo emitir la señal.");
    } finally {
      setBusy(false);
    }
  };

  const openWhatsApp = () => {
    if (!whatsappNumber || !activeSource) return;
    const url = buildWhatsAppSignalLink({
      phone: whatsappNumber,
      message,
      signalId: activeSource.id,
    });
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Wrap>
      <Header>
        <ResonanceOrb
          size={72}
          seed={activeSource?.id || `${actorId}:${mode}`}
          signature={frequency.lastBeacon?.attrs?.frequency?.signature}
          active={Boolean(activeSource)}
        />
        <div>
          <Title>Resonancia Viva</Title>
          <Subtle>
            Emití una intención. Cualquier nodo capaz puede responder; ninguna acción se ejecuta sin tu confirmación.
          </Subtle>
        </div>
      </Header>

      <Modes>
        {MODES.map((item) => (
          <ModeButton
            key={item.id}
            type="button"
            $active={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            {item.emoji} {item.label}
          </ModeButton>
        ))}
      </Modes>

      <Field>
        ¿Qué querés emitir?
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={600}
          placeholder="Ej: Necesito retirar y reutilizar madera esta semana"
        />
      </Field>

      <Grid>
        <Field>
          Ámbitos, separados por coma
          <Input
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
            placeholder="madera, construcción, reciclaje"
          />
        </Field>
        <Field>
          Recursos o materiales
          <Input
            value={resources}
            onChange={(event) => setResources(event.target.value)}
            placeholder="MDF, retiro, herramientas"
          />
        </Field>
      </Grid>

      <Actions>
        <Button type="button" disabled={busy} onClick={submit}>
          {busy ? "Emitiendo…" : "Emitir Señal Viva"}
        </Button>
        <Button type="button" $ghost onClick={() => void locate()}>
          {geo ? "Ubicación lista" : "Usar mi ubicación"}
        </Button>
        {activeSource ? (
          <Button type="button" $ghost onClick={() => setActiveSource(null)}>
            Apagar frecuencia
          </Button>
        ) : null}
        {activeSource && whatsappNumber ? (
          <Button type="button" $ghost onClick={openWhatsApp}>
            Compartir por WhatsApp
          </Button>
        ) : null}
      </Actions>

      {status ? <Subtle>{status}</Subtle> : null}

      {activeSource ? (
        <Status>
          <strong>
            {scanner.count
              ? `${scanner.count} ${scanner.count === 1 ? "opción disponible" : "opciones disponibles"}`
              : "Buscando opciones…"}
          </strong>
          <Subtle>
            Sesión temporal · ubicación {shareExactLocation ? "exacta autorizada" : "aproximada"} · sin ejecución automática
          </Subtle>
          {scanner.strongest ? (
            <Subtle>
              Encontramos una opción que puede ayudarte · requiere confirmación
            </Subtle>
          ) : null}
        </Status>
      ) : null}
    </Wrap>
  );
}
