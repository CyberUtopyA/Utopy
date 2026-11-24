import styled, { css, keyframes } from "styled-components";

const modalIn = keyframes`
  from { opacity: 0; translate: 0 6px; scale: .985; }
  to { opacity: 1; translate: 0 0; scale: 1; }
`;
const backdropIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

/** Capa visual compartida por los paneles del Mapa Vivo. */
export const livingGlass = css`
  border: 1px solid rgba(255, 255, 255, .92);
  border-radius: 30px;
  background:
    radial-gradient(circle at 6% 0%, rgba(255, 255, 255, .9), transparent 48%),
    radial-gradient(circle at 100% 100%, rgba(225, 220, 255, .5), transparent 52%),
    linear-gradient(145deg, rgba(251, 253, 255, .86), rgba(239, 237, 255, .82) 56%, rgba(230, 244, 255, .86));
  color: #273454;
  box-shadow: 0 20px 62px rgba(67, 79, 151, .18), 0 2px 10px rgba(97, 107, 173, .08), inset 0 1px 0 rgba(255, 255, 255, .96);
  backdrop-filter: blur(22px) saturate(1.15);
  -webkit-backdrop-filter: blur(22px) saturate(1.15);
  animation: ${modalIn} 190ms cubic-bezier(.2,.8,.2,1) both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const LivingModalBackdrop = styled.div<{ $level?: number }>`
  position: absolute;
  inset: 0;
  z-index: ${({ $level }) => $level ?? 535};
  background: rgba(225, 230, 250, .18);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: ${backdropIn} 180ms ease-out both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
