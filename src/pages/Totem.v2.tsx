import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";

type TotemMode = "attract" | "intro" | "menu";

const LINKS = {
  market: "https://market.utopy.live/",
  falcon: "https://falcon.utopy.live/",
  docs: "https://docs.utopy.live/",
};

export default function TotemPage() {
  const [mode, setMode] = useState<TotemMode>("attract");
  const idleRef = useRef<number | null>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  const resetIdle = () => {
    if (idleRef.current) window.clearTimeout(idleRef.current);

    idleRef.current = window.setTimeout(() => {
      setMode("attract");
    }, 30000);
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

  const openLink = (url: string) => {
    window.location.href = url;
  };

  useEffect(() => {
    if (mode === "attract") {
      if (idleRef.current) {
        window.clearTimeout(idleRef.current);
        idleRef.current = null;
      }
      return;
    }

    resetIdle();

    const onActivity = () => resetIdle();

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
  }, [mode]);

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
              Tocá la pantalla para entrar al ecosistema UTOPY, abrir Market,
              Falcon o Docs directamente desde este tótem.
            </Sub>
            <StartBtn type="button">Toca para comenzar</StartBtn>
            <Hint>Market · Falcon · Docs · Nodo vivo</Hint>
          </Center>

          <BottomBar>
            <BottomText>Experiencia en bucle · toca la pantalla para iniciar</BottomText>
          </BottomBar>
        </>
      )}

      {mode === "intro" && (
        <>
          <Overlay />
          <Center onClick={(e) => e.stopPropagation()}>
            <Brand>Bienvenido a UTOPY</Brand>
            <Title>Un punto físico conectado</Title>
            <Sub>
              Desde aquí podés abrir el mercado vivo, entrar a Falcon para crear
              y explorar la documentación del ecosistema.
            </Sub>

            <StartBtn type="button" onClick={() => setMode("menu")}>
              Entrar
            </StartBtn>

            <Hint>Sin actividad, vuelve solo al inicio</Hint>
          </Center>
        </>
      )}

      {mode === "menu" && (
        <>
          <Overlay />
          <Center onClick={(e) => e.stopPropagation()}>
            <MenuWrap>
              <Brand>UTOPY · Menú del Nodo</Brand>
              <Title>Elegí una experiencia</Title>
              <Sub>
                Este tótem abre los enlaces directamente. No usa QR en esta versión.
              </Sub>

              <MenuGrid>
                <CardBtn type="button" onClick={() => openLink(LINKS.market)}>
                  <CardIcon>🛒</CardIcon>
                  <CardTitle>Abrir Market</CardTitle>
                  <CardText>
                    Entrar al mercado vivo para ver productos, ofertas, catálogos
                    y actividad del nodo.
                  </CardText>
                  <CardUrl>{LINKS.market}</CardUrl>
                </CardBtn>

                <CardBtn type="button" onClick={() => openLink(LINKS.falcon)}>
                  <CardIcon>🦅</CardIcon>
                  <CardTitle>Abrir Falcon</CardTitle>
                  <CardText>
                    Entrar al espacio visual de diseño, creación, exploración y
                    experiencia Falcon.
                  </CardText>
                  <CardUrl>{LINKS.falcon}</CardUrl>
                </CardBtn>

                <CardBtn type="button" onClick={() => openLink(LINKS.docs)}>
                  <CardIcon>📚</CardIcon>
                  <CardTitle>Abrir Docs</CardTitle>
                  <CardText>
                    Leer la visión, documentación y arquitectura del ecosistema
                    UTOPY.
                  </CardText>
                  <CardUrl>{LINKS.docs}</CardUrl>
                </CardBtn>
              </MenuGrid>

              <BackBtn type="button" onClick={() => setMode("attract")}>
                Volver al inicio
              </BackBtn>

              <Hint style={{ marginTop: 18 }}>
                Versión original: enlaces directos · Versión v2: QR
              </Hint>
            </MenuWrap>
          </Center>
        </>
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
    radial-gradient(circle at top, rgba(21, 255, 0, 0.16), transparent 34%),
    linear-gradient(
      to top,
      rgba(0, 0, 0, 0.82),
      rgba(0, 0, 0, 0.28),
      rgba(0, 0, 0, 0.66)
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
  gap: 0;
  padding: 28px;
  text-align: center;
`;

const Brand = styled.div`
  font-size: clamp(0.9rem, 1.8vw, 1.2rem);
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
  margin-top: 24px;
  border: 0;
  border-radius: 18px;
  padding: 18px 34px;
  min-width: 220px;
  font-size: 1.15rem;
  font-weight: 950;
  cursor: pointer;
  background: linear-gradient(180deg, #15ff00 0%, #0ed400 100%);
  color: #071007;
  box-shadow: 0 18px 60px rgba(21, 255, 0, 0.18);
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
  grid-template-columns: repeat(3, minmax(240px, 1fr));
  gap: 18px;
  margin-top: 28px;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`;

const CardBtn = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 24px;
  padding: 24px;
  min-height: 220px;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(21, 255, 0, 0.12);
    border-color: rgba(21, 255, 0, 0.34);
  }
`;

const CardIcon = styled.div`
  font-size: 2.2rem;
  margin-bottom: 14px;
`;

const CardTitle = styled.div`
  font-size: 1.25rem;
  font-weight: 950;
  margin-bottom: 10px;
`;

const CardText = styled.div`
  opacity: 0.86;
  line-height: 1.45;
  font-size: 1rem;
`;

const CardUrl = styled.div`
  margin-top: 16px;
  font-size: 0.86rem;
  opacity: 0.78;
  word-break: break-all;
  color: #baffb2;
`;

const BackBtn = styled.button`
  margin-top: 24px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 14px 20px;
  min-width: 180px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
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