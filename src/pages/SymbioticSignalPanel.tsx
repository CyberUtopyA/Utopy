import React, { useMemo, useState } from "react";
import styled from "styled-components";

import {
  acceptSymbioticOffer,
  offersForSignal,
  proposalsForSignal,
  publishSymbioticOffer,
  publishSymbioticSignal,
} from "../mt/mt.symbiotic";

type Props = {
  allLive: any[];
  activeCajero?: any | null;
};

function actorFrom(activeCajero: any) {
  return {
    id: String(activeCajero?.actorId || activeCajero?.id || ""),
    name: String(activeCajero?.nombre || activeCajero?.name || "Mi identidad"),
    nodeId: activeCajero?.nodeId ? String(activeCajero.nodeId) : null,
  };
}

function browserGeo(): Promise<{ lat: number; lng: number; source: "device" } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "device",
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60_000 }
    );
  });
}

function tsOf(dv: any): number {
  const raw = dv?.ts ?? dv?.meta?.ts ?? 0;
  if (typeof raw === "number") return raw;
  return Date.parse(String(raw || "")) || 0;
}

function titleOf(dv: any): string {
  return String(
    dv?.attrs?.text || dv?.attrs?.title || dv?.labels?.[0] || "Señal Viva"
  );
}

function providerName(proposal: any, allLive: any[]): string {
  const capabilityId = String(proposal?.attrs?.capabilityRef?.id || "");
  const capability = allLive.find((dv: any) => String(dv?.id) === capabilityId);
  return String(
    capability?.attrs?.actorName ||
      capability?.attrs?.actor?.name ||
      capability?.attrs?.node?.name ||
      capability?.labels?.[0] ||
      "Nodo con capacidad compatible"
  );
}

const QUICK_SIGNALS = [
  { icon: "🪵", label: "Madera", text: "Necesito madera y una cotización para fabricar un mueble" },
  { icon: "🧑‍🔧", label: "Carpintero", text: "Busco un carpintero que pueda preparar una cotización" },
  { icon: "🏭", label: "Fabricar", text: "Necesito fabricar una pieza a partir de un diseño" },
  { icon: "🚚", label: "Entrega", text: "Necesito retirar y entregar materiales" },
  { icon: "♻️", label: "Reutilizar", text: "Tengo materiales que pueden volver a usarse" },
];

export default function SymbioticSignalPanel({ allLive, activeCajero }: Props) {
  const actor = useMemo(() => actorFrom(activeCajero), [activeCajero]);
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerText, setOfferText] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ icon: string; title: string; context: string } | null>(null);

  const signals = useMemo(
    () =>
      (Array.isArray(allLive) ? allLive : [])
        .filter(
          (dv: any) =>
            dv?.kind === "resonance.signal" ||
            dv?.traits?.includes?.("utopy:symbiotic") &&
              dv?.attrs?.interactionRole === "signal"
        )
        .sort((a: any, b: any) => tsOf(b) - tsOf(a)),
    [allLive]
  );

  const selected =
    signals.find((signal: any) => String(signal.id) === String(selectedId)) ||
    signals[0] ||
    null;

  const offers = useMemo(
    () => (selected ? offersForSignal(selected, allLive) : []),
    [selected, allLive]
  );
  const proposals = useMemo(
    () => (selected ? proposalsForSignal(selected, allLive) : []),
    [selected, allLive]
  );

  const acceptedOfferIds = useMemo(
    () =>
      new Set(
        (Array.isArray(allLive) ? allLive : [])
          .filter(
            (dv: any) =>
              dv?.kind === "resonance.response" &&
              dv?.attrs?.decision === "accepted"
          )
          .map((dv: any) => String(dv?.attrs?.offerRef?.id || ""))
          .filter(Boolean)
      ),
    [allLive]
  );

  const publishSignal = async () => {
    if (!actor.id) {
      setMessage("Estamos preparando tu identidad privada. Intentá nuevamente en un instante.");
      return;
    }
    if (!preview) {
      const normalized = text.toLowerCase();
      const icon = /madera|material|viga|metal|ladrillo/.test(normalized) ? "🪵" : /transport|entrega|llevar/.test(normalized) ? "🚚" : /financ|cuota|crédito/.test(normalized) ? "💳" : /casa|espacio|terreno|alquiler/.test(normalized) ? "🏠" : "🛠";
      const title = icon === "🪵" ? "Necesitás material" : icon === "🚚" ? "Necesitás una entrega" : icon === "💳" ? "Buscás financiación" : icon === "🏠" ? "Buscás un espacio" : "Necesitás ayuda";
      setPreview({ icon, title, context: text.trim() });
      setMessage("");
      return;
    }
    setBusy(true);
    setMessage("Interpretando la señal y buscando capacidades...");
    try {
      const geo = await browserGeo();
      const result = await publishSymbioticSignal({
        text,
        actorId: actor.id,
        actorName: actor.name,
        nodeId: actor.nodeId,
        geo,
        liveDVs: allLive,
        activeActor: activeCajero,
        scopes: ["local", "market"],
        broadcast: true,
      });
      setSelectedId(result.signalDV.id);
      setText("");
      setPreview(null);
      setMessage(
        `Señal emitida · ${result.matches.length} capacidad(es) compatible(s) inicial(es). Los nodos pueden responder con sus propias ofertas.`
      );
    } catch (error: any) {
      setMessage(error?.message || "No se pudo emitir la señal.");
    } finally {
      setBusy(false);
    }
  };

  const publishOffer = async () => {
    if (!selected) return;
    if (!actor.id) {
      setMessage("Tu identidad todavía no está lista para publicar una oferta.");
      return;
    }
    setBusy(true);
    setMessage("Publicando oferta del nodo...");
    try {
      const geo = await browserGeo();
      await publishSymbioticOffer({
        signalDV: selected,
        text: offerText,
        actorId: actor.id,
        actorName: actor.name,
        nodeId: actor.nodeId,
        geo,
        amount: amount ? Number(amount) : null,
        currency: amount ? "PYG" : null,
        broadcast: true,
        allLive,
        activeActor: activeCajero,
      });
      setOfferText("");
      setAmount("");
      setMessage("Oferta publicada. La persona decide si quiere aceptarla.");
    } catch (error: any) {
      setMessage(error?.message || "No se pudo publicar la oferta.");
    } finally {
      setBusy(false);
    }
  };

  const acceptOffer = async (offer: any) => {
    if (!selected) return;
    if (!actor.id) {
      setMessage("Tu identidad todavía no está lista para confirmar esta elección.");
      return;
    }
    setBusy(true);
    setMessage("Registrando tu elección...");
    try {
      await acceptSymbioticOffer({
        signalDV: selected,
        offerDV: offer,
        actorId: actor.id,
        actorName: actor.name,
        message: "Quiero continuar con esta oferta.",
        broadcast: true,
        allLive,
        activeActor: activeCajero,
      });
      setMessage(
        "Oferta elegida. Se creó un hilo privado; ninguna acción se ejecutó automáticamente."
      );
    } catch (error: any) {
      setMessage(error?.message || "No se pudo aceptar la oferta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Hero><Eyebrow>CREAR</Eyebrow><h3>Decilo a tu manera</h3></Hero>

      <Composer>
        <Textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setPreview(null); }}
          placeholder="Ej.: necesito madera y un carpintero para fabricar esta mesa"
          rows={3}
        />
        <Primary
          type="button"
          onClick={publishSignal}
          disabled={busy || text.trim().length < 3}
        >
          {busy ? "Buscando..." : preview ? "Sí, buscar" : "Entender"}
        </Primary>
        {preview ? <Preview><Small>ENTENDÍ ESTO</Small><strong>{preview.icon} {preview.title}</strong><span>{preview.context}</span><button type="button" onClick={() => setPreview(null)}>Corregir</button></Preview> : null}
        {!preview ? <Examples>{QUICK_SIGNALS.map((item) => <button type="button" key={item.label} onClick={() => { setText(item.text); setPreview(null); }}>{item.icon} {item.label}</button>)}</Examples> : null}
        <Privacy>
          Ubicación aproximada. Vos elegís con quién hablar.
        </Privacy>
      </Composer>

      {message ? <Message>{message}</Message> : null}

      {signals.length ? (
        <Section>
          <SectionTitle>En movimiento</SectionTitle>
          <SignalTabs>
            {signals.slice(0, 8).map((signal: any) => (
              <SignalTab
                key={signal.id}
                type="button"
                $active={selected?.id === signal.id}
                onClick={() => setSelectedId(signal.id)}
              >
                {titleOf(signal)}
              </SignalTab>
            ))}
          </SignalTabs>
        </Section>
      ) : null}

      {selected ? (
        <Section>
          <SignalHead>
            <div>
              <Small>SEÑAL SELECCIONADA</Small>
              <strong>{titleOf(selected)}</strong>
            </div>
            <Count>{offers.length} oferta(s)</Count>
          </SignalHead>

          {proposals.length ? (
            <Matches>
              {proposals.slice(0, 5).map((proposal: any) => (
                <Match key={proposal.id}>
                  <span>{providerName(proposal, allLive)}</span>
                  <b>Puede ayudarte</b>
                </Match>
              ))}
              <Hint>
                Opciones relacionadas con tu búsqueda.
              </Hint>
            </Matches>
          ) : (
            <Hint>
              La red sigue buscando talleres, personas e insumos.
            </Hint>
          )}

          <OfferComposer>
            <Small>HACER UNA PROPUESTA</Small>
            <Input
              value={offerText}
              onChange={(event) => setOfferText(event.target.value)}
              placeholder="Qué podés aportar y cuándo"
            />
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Monto opcional"
            />
            <Secondary
              type="button"
              onClick={publishOffer}
              disabled={busy || offerText.trim().length < 3}
            >
              Enviar propuesta
            </Secondary>
          </OfferComposer>

          <OfferList>
            {offers.map((offer: any) => {
              const accepted = acceptedOfferIds.has(String(offer.id));
              return (
                <OfferCard key={offer.id}>
                  <strong>
                    {offer?.attrs?.actorName || "Nodo que respondió"}
                  </strong>
                  <p>{offer?.attrs?.text}</p>
                  {offer?.attrs?.amount != null ? (
                    <Price>
                      {offer.attrs.amount} {offer?.attrs?.currency || ""}
                    </Price>
                  ) : null}
                  <Primary
                    type="button"
                    onClick={() => acceptOffer(offer)}
                    disabled={busy || accepted}
                  >
                    {accepted ? "Oferta elegida" : "Elegir esta oferta"}
                  </Primary>
                </OfferCard>
              );
            })}
          </OfferList>
        </Section>
      ) : null}
    </Wrap>
  );
}

const Wrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Hero = styled.div`
  padding: 14px 4px 6px;
  color: #29375f;
  background: transparent;

  h3 {
    margin: 5px 0 6px;
    font-size: 1.18rem;
  }

`;

const Eyebrow = styled.div`
  color: #6b79d7;
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.08em;
`;

const Composer = styled.div`
  display: grid;
  gap: 8px;
  padding: 13px;
  border-radius: 22px;
  background: rgba(255,255,255,.64);
  border: 1px solid rgba(255,255,255,.95);
`;

const Textarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid rgba(159,171,222,.32);
  border-radius: 17px;
  padding: 12px;
  font: inherit;
  outline: none;

  &:focus {
    border-color: #91a0ed;
    box-shadow: 0 0 0 3px rgba(135, 150, 232, .15);
  }
`;

const Primary = styled.button`
  border: 0;
  border-radius: 13px;
  padding: 11px 12px;
  background: linear-gradient(135deg,#e6eaff,#cdd6ff);
  color: #34458f;
  font-weight: 950;
  cursor: pointer;

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
`;

const Secondary = styled(Primary)`
  background: #0f172a;
  color: #fff;
`;

const Privacy = styled.div`
  font-size: 0.7rem;
  opacity: 0.58;
  line-height: 1.35;
`;

const Examples = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 7px 9px;
    background: #f8fafc;
    color: #334155;
    font: inherit;
    font-size: .72rem;
    font-weight: 800;
    cursor: pointer;
  }
`;

const Preview = styled.div`
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  span { font-size: .78rem; color: #475569; }
  button { justify-self: start; border: 0; background: transparent; color: #166534; font-weight: 800; cursor: pointer; padding: 2px 0; }
`;

const Message = styled.div`
  padding: 10px 12px;
  border-radius: 13px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
  font-size: 0.78rem;
  line-height: 1.4;
`;

const Section = styled.div`
  display: grid;
  gap: 10px;
  padding: 13px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
`;

const SectionTitle = styled.div`
  font-weight: 950;
`;

const SignalTabs = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 3px;
`;

const SignalTab = styled.button<{ $active?: boolean }>`
  flex: 0 0 auto;
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid ${({ $active }) => ($active ? "#22c55e" : "rgba(0,0,0,0.1)")};
  border-radius: 999px;
  padding: 7px 10px;
  background: ${({ $active }) => ($active ? "#ecfdf5" : "#fff")};
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
`;

const SignalHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
`;

const Small = styled.div`
  font-size: 0.67rem;
  font-weight: 950;
  opacity: 0.5;
`;

const Count = styled.div`
  flex: 0 0 auto;
  font-size: 0.72rem;
  font-weight: 900;
  color: #15803d;
`;

const Matches = styled.div`
  display: grid;
  gap: 6px;
`;

const Match = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #f0fdf4;
  font-size: 0.76rem;

  b {
    color: #15803d;
  }
`;

const Hint = styled.div`
  font-size: 0.72rem;
  line-height: 1.4;
  opacity: 0.62;
`;

const OfferComposer = styled.div`
  display: grid;
  gap: 7px;
  padding: 11px;
  border-radius: 14px;
  background: #f8fafc;
`;

const Input = styled.input`
  border: 1px solid rgba(0, 0, 0, 0.11);
  border-radius: 11px;
  padding: 10px;
  font: inherit;
  outline: none;

  &:focus {
    border-color: #22c55e;
  }
`;

const OfferList = styled.div`
  display: grid;
  gap: 8px;
`;

const OfferCard = styled.div`
  display: grid;
  gap: 7px;
  padding: 12px;
  border-radius: 15px;
  border: 1px solid rgba(0, 0, 0, 0.09);

  p {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.4;
    opacity: 0.75;
  }
`;

const Price = styled.div`
  font-weight: 950;
  color: #166534;
`;
