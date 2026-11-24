// ============================================
// FILE: src/mt/TotemPage.tsx
// Tótem UTOPY + Mercado
// ============================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import MercadoLocal from "./mercado";

type TotemMode = "attract" | "intro" | "menu" | "market";
type ActionModal =
  | null
  | {
      title: string;
      text: string;
      qrSrc: string;
      steps?: string[];
    };

const MARKET_SESSION_MS = 5 * 60 * 1000;

const qrFalcon = "/qrfalcon.png";
const qrDocs = "/qrdocs.png";
const qrMarket = "/qrmarket.png";

function formatMs(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function TotemPage() {
  const [mode, setMode] = useState<TotemMode>("attract");
  const [modal, setModal] = useState<ActionModal>(null);

  const [marketDeadline, setMarketDeadline] = useState<number | null>(null);
  const [marketRemaining, setMarketRemaining] =
    useState<number>(MARKET_SESSION_MS);

  const idleRef = useRef<number | null>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);
  const resetIdle = () => {
    if (idleRef.current) window.clearTimeout(idleRef.current);

    idleRef.current = window.setTimeout(() => {
      setModal(null);
      setMarketDeadline(null);
      setMode("attract");
    }, 25000);
  };

  const playWelcomeAudio = () => {
    const audio = welcomeAudioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const handleTotemTouch = () => {
    if (mode !== "attract") return;

    playWelcomeAudio();
    setMode("intro");
  };

  useEffect(() => {
    if (mode === "attract" && !modal) {
      if (idleRef.current) {
        window.clearTimeout(idleRef.current);
        idleRef.current = null;
      }
      return;
    }

    if (mode !== "market") {
      resetIdle();
    }

    const onActivity = () => {
      if (mode !== "market") resetIdle();
    };

    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("touchstart", onActivity);
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);

    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);

      if (idleRef.current) {
        window.clearTimeout(idleRef.current);
        idleRef.current = null;
      }
    };
  }, [mode, modal]);

  useEffect(() => {
    if (mode !== "market" || !marketDeadline) return;

    const tick = () => {
      const left = marketDeadline - Date.now();

      if (left <= 0) {
        setMarketDeadline(null);
        setMarketRemaining(0);
        setMode("attract");
        return;
      }

      setMarketRemaining(left);
    };

    tick();

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [mode, marketDeadline]);

  const marketCountdownText = useMemo(
    () => formatMs(marketRemaining),
    [marketRemaining]
  );

  const openQrModal = (cfg: NonNullable<ActionModal>) => {
    setModal(cfg);
  };

  const openMarketInsideTotem = () => {
    setModal(null);
    setMarketRemaining(MARKET_SESSION_MS);
    setMarketDeadline(Date.now() + MARKET_SESSION_MS);
    setMode("market");
  };

  const closeMarketInsideTotem = () => {
    setMarketDeadline(null);
    setMarketRemaining(MARKET_SESSION_MS);
    setMode("attract");
  };

  return (
    <Full onPointerDown={handleTotemTouch}>
      <audio ref={welcomeAudioRef} src="/bienvenido.mp3" preload="auto" />

      {mode === "attract" && (
        <>
          <VideoBg autoPlay muted loop playsInline src="/totem.mp4" />
          <Overlay />

          <Center>
            <Brand>UTOPY · Nodo Vivo</Brand>
            <Title>Diseña, explora y conecta</Title>
            <Sub>
              Un punto físico para descubrir productos, imaginar nuevas ideas y
              entrar a un sistema vivo de creación, mercado y ecosistema.
            </Sub>
            <StartBtn type="button">Toca para comenzar</StartBtn>
            <Hint>Catálogo · Mercado · Diseño · Ecosistema</Hint>
          </Center>

          <BottomBar>
            <BottomText>
              Experiencia en bucle · toca la pantalla para iniciar
            </BottomText>
          </BottomBar>
        </>
      )}

      {mode === "intro" && (
        <>
          <Overlay />
          <Center onClick={(e) => e.stopPropagation()}>
            <Brand>Bienvenido a UTOPY</Brand>
            <Title>¿Qué puedes hacer aquí?</Title>
            <Sub>
              Este tótem te permite ver el catálogo actual, entrar al mercado,
              diseñar nuevas ideas en Falcon y explorar el ecosistema UTOPY
              desde un punto físico conectado.
            </Sub>
            <StartBtn type="button" onClick={() => setMode("menu")}>
              Iniciar
            </StartBtn>
            <Hint>Si no hay actividad, volverá solo al video principal</Hint>
          </Center>
        </>
      )}

      {mode === "menu" && (
        <>
          <Overlay />
          <Center onClick={(e) => e.stopPropagation()}>
            <MenuWrap>
              <Brand>UTOPY · Menú del Nodo</Brand>
              <Title>Elige una experiencia</Title>
              <Sub>
                Entra al catálogo y al mercado dentro del mismo tótem, o
                continúa desde tu celular para diseño y documentación.
              </Sub>

              <MenuGrid>
                <CardBtn type="button" onClick={openMarketInsideTotem}>
                  <CardTitle>Ver catálogo</CardTitle>
                  <CardText>
                    Renderiza el market directamente dentro del tótem por 5
                    minutos y luego vuelve solo a la pantalla principal.
                  </CardText>
                </CardBtn>

                <CardBtn
                  type="button"
                  onClick={() =>
                    openQrModal({
                      title: "Explorar Mercado",
                      text: "Escanea este QR para entrar al mercado vivo.",
                      qrSrc: qrMarket,
                      steps: [
                        "Abre la cámara de tu celular.",
                        "Escanea el QR del mercado.",
                        "Toca el enlace detectado.",
                        "Explora productos, ofertas y actividad del nodo local.",
                      ],
                    })
                  }
                >
                  <CardTitle>Explorar mercado</CardTitle>
                  <CardText>
                    Entra al mercado vivo para ver productos, ofertas,
                    conexiones y actividad del nodo local.
                  </CardText>
                </CardBtn>

                <CardBtn
                  type="button"
                  onClick={() =>
                    openQrModal({
                      title: "Diseñar en Falcon",
                      text:
                        "Escanea este QR para abrir Falcon en tu celular o tablet. Allí podrás diseñar muebles, ideas y estructuras de forma visual y creativa.",
                      qrSrc: qrFalcon,
                      steps: [
                        "Abre la cámara de tu celular.",
                        "Escanea el QR de Falcon.",
                        "Abre el enlace detectado.",
                        "Comienza a diseñar desde tu dispositivo.",
                      ],
                    })
                  }
                >
                  <CardTitle>Diseñar</CardTitle>
                  <CardText>
                    Crea muebles, ideas y estructuras visuales desde tu
                    dispositivo, sin sacar al tótem de esta pantalla.
                  </CardText>
                </CardBtn>

                <CardBtn
                  type="button"
                  onClick={() =>
                    openQrModal({
                      title: "Explorar ecosistema",
                      text:
                        "Escanea este QR para leer la documentación y comprender cómo funciona el ecosistema UTOPY, sus nodos y su visión.",
                      qrSrc: qrDocs,
                      steps: [
                        "Abre la cámara de tu celular.",
                        "Escanea el QR de documentación.",
                        "Toca el enlace detectado.",
                        "Explora la visión y arquitectura del sistema.",
                      ],
                    })
                  }
                >
                  <CardTitle>Explorar ecosistema</CardTitle>
                  <CardText>
                    Comprende la visión, la documentación y la arquitectura de
                    UTOPY desde tu celular.
                  </CardText>
                </CardBtn>
              </MenuGrid>

              <Hint style={{ marginTop: 22 }}>
                Catálogo/mercado dentro del tótem: sesión de 5 minutos
              </Hint>
            </MenuWrap>
          </Center>
        </>
      )}

      {mode === "market" && (
        <MarketShell>
          <MarketTopBar>
            <MarketTopLeft>
              <MarketTitle>UTOPY · Mercado en modo tótem</MarketTitle>
              <MarketSub>
                Esta sesión volverá automáticamente al inicio cuando termine el
                tiempo.
              </MarketSub>
            </MarketTopLeft>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Countdown>{marketCountdownText}</Countdown>
              <ActionBtn tone="ghost" onClick={closeMarketInsideTotem}>
                Volver al inicio
              </ActionBtn>
            </div>
          </MarketTopBar>

          <MercadoLocal kioskMode/>
        </MarketShell>
      )}


      {modal && (
        <ModalBackdrop onClick={() => setModal(null)}>
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <QrWrap>
              <QrImg src={modal.qrSrc} alt={modal.title} />
            </QrWrap>

            <div>
              <Brand>Continúa desde tu celular</Brand>
              <ModalTitle>{modal.title}</ModalTitle>
              <ModalText>{modal.text}</ModalText>

              <Steps>
                {(modal.steps || [
                  "Abre la cámara de tu celular.",
                  "Apunta al código QR.",
                  "Toca el enlace que aparece.",
                  "Continúa la experiencia desde tu dispositivo.",
                ]).map((step, i) => (
                  <Step key={i}>
                    {i + 1}. {step}
                  </Step>
                ))}
              </Steps>

              <ModalActions>
                <ActionBtn tone="ghost" onClick={() => setModal(null)}>
                  Volver
                </ActionBtn>
              </ModalActions>
            </div>
          </ModalBox>
        </ModalBackdrop>
      )}
    </Full>
  );
}

/* ---------- UI ---------- */

const Full = styled.div`
  width: 100vw;
  height: 100vh;
  background: #0b0d10;
  color: #fff;
  overflow: hidden;
  position: relative;
  font-family: Inter, system-ui, sans-serif;
`;

const VideoBg = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to top,
      rgba(0, 0, 0, 0.76),
      rgba(0, 0, 0, 0.24),
      rgba(0, 0, 0, 0.62)
    );
  z-index: 1;
`;

const Center = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px;
  text-align: center;
`;

const Brand = styled.div`
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.92;
  margin-bottom: 14px;
`;

const Title = styled.h1`
  margin: 0 0 10px;
  font-size: clamp(2rem, 5vw, 4.4rem);
  line-height: 1.04;
  font-weight: 950;
`;

const Sub = styled.p`
  max-width: 920px;
  margin: 0;
  font-size: clamp(1rem, 1.7vw, 1.35rem);
  line-height: 1.55;
  opacity: 0.94;
`;

const StartBtn = styled.button`
  margin-top: 22px;
  border: 0;
  border-radius: 18px;
  padding: 18px 34px;
  min-width: 220px;
  font-size: 1.15rem;
  font-weight: 900;
  cursor: pointer;
  background: linear-gradient(180deg, #f7e7a2 0%, #d9b650 100%);
  color: #18130a;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
`;

const Hint = styled.div`
  margin-top: 14px;
  opacity: 0.8;
  font-size: 0.98rem;
`;

const MenuWrap = styled.div`
  width: min(1180px, 100%);
  margin: 0 auto;
`;

const MenuGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 28px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const CardBtn = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 24px;
  padding: 24px;
  min-height: 150px;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const CardTitle = styled.div`
  font-size: 1.18rem;
  font-weight: 950;
  margin-bottom: 10px;
`;

const CardText = styled.div`
  opacity: 0.86;
  line-height: 1.45;
  font-size: 1rem;
`;

const BottomBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  z-index: 2;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

const BottomText = styled.div`
  pointer-events: auto;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.96rem;
  opacity: 0.94;
`;

const ModalBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const ModalBox = styled.div`
  width: min(920px, 100%);
  border-radius: 28px;
  background: linear-gradient(180deg, #171717 0%, #0f1115 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.36);
  padding: 28px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 28px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const QrWrap = styled.div`
  background: #fff;
  border-radius: 22px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const QrImg = styled.img`
  width: 100%;
  max-width: 280px;
  aspect-ratio: 1 / 1;
  object-fit: contain;
`;

const ModalTitle = styled.h2`
  margin: 0 0 10px;
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
  line-height: 1.08;
`;

const ModalText = styled.p`
  margin: 0;
  opacity: 0.9;
  line-height: 1.6;
  font-size: 1.05rem;
`;

const Steps = styled.div`
  margin-top: 18px;
  display: grid;
  gap: 10px;
`;

const Step = styled.div`
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  line-height: 1.45;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
`;

const ActionBtn = styled.button<{ tone?: "primary" | "ghost" }>`
  border: 0;
  border-radius: 16px;
  padding: 14px 18px;
  min-width: 160px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 800;
  background: ${({ tone }) =>
    tone === "ghost"
      ? "rgba(255,255,255,0.08)"
      : "linear-gradient(180deg, #f7e7a2 0%, #d9b650 100%)"};
  color: ${({ tone }) => (tone === "ghost" ? "#fff" : "#18130a")};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
`;

const MarketShell = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  background: #fff;
  color: #111;
  overflow: auto;
`;

const MarketTopBar = styled.div`
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(11, 13, 16, 0.92);
  color: #fff;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const MarketTopLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MarketTitle = styled.div`
  font-size: 1rem;
  font-weight: 900;
`;

const MarketSub = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
`;

const Countdown = styled.div`
  font-size: 1rem;
  font-weight: 900;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
`;
