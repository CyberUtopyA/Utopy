// src/pages/Exitoso.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import styled from "styled-components";
import { buildDraftFromInputs, generateContractPDFFromDraftWithQR } from "../utils/contrato";
import { mtLiveSnapshot } from "../mt/mt.liveStore";
import { activateRentalContract } from "../mt/rental.domain";
import { createPrivateContract, createTemporaryContractCapability, freezePrivateContract } from "../mt/contract.private";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { verifyAdultForJurisdiction } from "../utopy/identityPersonal";
import {rentalWhatsAppUrl,shareRentalPDF} from '../utils/rentalDelivery';

// ==============================
// UI
// ==============================
const Container = styled.div`
  min-height: 100vh;
  width: 100vw;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f8fafc;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 12% 8%, rgba(45, 212, 191, 0.22), transparent 30%),
    radial-gradient(circle at 88% 18%, rgba(129, 140, 248, 0.22), transparent 32%),
    radial-gradient(circle at 48% 100%, rgba(14, 165, 233, 0.16), transparent 38%),
    linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%);

  @media (max-width: 640px) {
    align-items: flex-start;
    padding: 18px 14px;
  }
`;

const Card = styled.div`
  position: relative;
  width: min(100%, 880px);
  padding: clamp(20px, 4vw, 34px);
  border-radius: 34px;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.055)),
    rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 40px 120px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(26px);

  &::before {
    content: "";
    position: absolute;
    inset: -1px;
    pointer-events: none;
    background:
      linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.16), transparent),
      radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.13), transparent 30%);
    opacity: 0.9;
  }

  &::after {
    content: "";
    position: absolute;
    width: 280px;
    height: 280px;
    right: -120px;
    top: -130px;
    border-radius: 999px;
    background: rgba(45, 212, 191, 0.12);
    filter: blur(8px);
    pointer-events: none;
  }

  > * {
    position: relative;
    z-index: 1;
  }

  @media (max-width: 640px) {
    border-radius: 28px;
  }
`;

const Header = styled.div`
  display: grid;
  gap: 16px;
  margin-bottom: 18px;
`;

const TopBadgeRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
`;

const Pill = styled.div`
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  color: #a7f3d0;
  background: rgba(20, 184, 166, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.18);
  font-size: 0.76rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const StatusOrbWrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border-radius: 999px;
  color: ${({ $done }) => ($done ? "#bbf7d0" : "#bfdbfe")};
  background: ${({ $done }) =>
    $done ? "rgba(34, 197, 94, 0.12)" : "rgba(59, 130, 246, 0.12)"};
  border: 1px solid
    ${({ $done }) =>
      $done ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)"};
  font-size: 0.78rem;
  font-weight: 900;
`;

const StatusOrb = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: ${({ $done }) => ($done ? "#22c55e" : "#38bdf8")};
  box-shadow:
    0 0 0 6px ${({ $done }) => ($done ? "rgba(34,197,94,.12)" : "rgba(56,189,248,.12)")},
    0 0 22px ${({ $done }) => ($done ? "rgba(34,197,94,.55)" : "rgba(56,189,248,.55)")};
`;

const Title = styled.h2`
  margin: 0;
  max-width: 760px;
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 0.98;
  letter-spacing: -0.07em;
  font-weight: 950;
  color: #ffffff;

  span {
    display: block;
    margin-top: 6px;
    background: linear-gradient(90deg, #5eead4, #bfdbfe, #c4b5fd);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
`;

const StatusText = styled.p`
  max-width: 720px;
  margin: 0;
  color: rgba(226, 232, 240, 0.86);
  font-size: clamp(0.98rem, 2vw, 1.08rem);
  line-height: 1.65;
`;

const Button = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 18px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 20% 0%, rgba(45, 212, 191, 0.9), transparent 35%),
    linear-gradient(135deg, #f8fafc, #dbeafe);
  color: #020617;
  text-decoration: none;
  font-weight: 950;
  box-shadow: 0 18px 45px rgba(14, 165, 233, 0.18);
  transition: 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
`;

const SmallBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.14);
  cursor: pointer;
  font-weight: 900;
  font-size: 0.86rem;
  transition: 0.18s ease;
  backdrop-filter: blur(16px);

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.13);
    border-color: rgba(45, 212, 191, 0.26);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
`;

const PrimaryBtn = styled(SmallBtn)`
  min-height: 48px;
  padding: 0 18px;
  color: #020617;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.85), transparent 34%),
    linear-gradient(135deg, #5eead4, #bfdbfe);
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow: 0 18px 45px rgba(45, 212, 191, 0.14);

  &:hover {
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.9), transparent 34%),
      linear-gradient(135deg, #99f6e4, #dbeafe);
  }
`;

const JsonBox = styled.pre`
  margin-top: 12px;
  padding: 16px;
  border-radius: 22px;
  overflow: auto;
  max-height: 360px;
  color: #d9f99d;
  background: rgba(2, 6, 23, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  font-size: 0.78rem;
  line-height: 1.55;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

const SigBox = styled.div`
  box-sizing:border-box;
  min-width:0;
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  margin-top: 18px;
  padding: clamp(16px, 3vw, 22px);
  border-radius: 28px;
  background:
    radial-gradient(circle at 0% 0%, rgba(45, 212, 191, 0.12), transparent 36%),
    rgba(255, 255, 255, 0.075);
  border: 1px solid rgba(255, 255, 255, 0.13);
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
`;

const SigHeader = styled.div`
  display: grid;
  gap: 8px;
  margin-bottom: 14px;

  h3 {
    margin: 0;
    color: #ffffff;
    font-size: clamp(1.25rem, 3vw, 1.8rem);
    letter-spacing: -0.04em;
    font-weight: 950;
  }

  p {
    margin: 0;
    color: rgba(226, 232, 240, 0.78);
    line-height: 1.55;
  }
`;

const CanvasWrap = styled.div`
  box-sizing:border-box;
  min-width:0;
  position: relative;
  margin-top: 12px;
  width: 100%;
  max-width: 720px;
  padding: 10px;
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06)),
    rgba(2, 6, 23, 0.38);
  border: 1px solid rgba(255, 255, 255, 0.12);
`;

const CanvasHint = styled.div`
  position: absolute;
  right: 18px;
  top: 18px;
  z-index: 2;
  pointer-events: none;
  padding: 7px 10px;
  border-radius: 999px;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.78);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.02em;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 180px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.98));
  border-radius: 18px;
  display: block;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 18px 45px rgba(0, 0, 0, 0.14);

  touch-action: none;
  -ms-touch-action: none;

  user-select: none;
  -webkit-user-select: none;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 12px;
  @media(max-width:640px){
    > button, > label {width:100%;box-sizing:border-box;min-height:44px;}
    input[type="file"]{max-width:100%;}
  }
`;

const Label = styled.label`
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  border-radius: 999px;
  color: rgba(248, 250, 252, 0.9);
  background: rgba(255, 255, 255, 0.07);
  border: 1px dashed rgba(255, 255, 255, 0.18);
  font-size: 0.84rem;
  font-weight: 850;
  cursor: pointer;

  input {
    max-width: 180px;
    color: rgba(226, 232, 240, 0.78);
    font-size: 0.78rem;
  }

  @media (max-width: 640px) {
    width: 100%;
    justify-content: space-between;

    input {
      max-width: 130px;
    }
  }
`;

const HR = styled.hr`
  border: none;
  height: 1px;
  margin: 20px 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  margin-top: 16px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const PagarBadge = styled.div`
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 999px;
  color: ${({ $active }) => ($active ? "#bbf7d0" : "rgba(226,232,240,.72)")};
  background: ${({ $active }) =>
    $active ? "rgba(34, 197, 94, 0.1)" : "rgba(255,255,255,.06)"};
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(34, 197, 94, 0.18)" : "rgba(255,255,255,.1)"};
  font-size: 0.84rem;
  font-weight: 900;
`;

const SignaturePreview = styled.div`
  margin-top: 14px;
  padding: 12px;
  border-radius: 22px;
  background: rgba(2, 6, 23, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);

  p {
    margin: 0 0 8px;
    color: rgba(226, 232, 240, 0.76);
    font-size: 0.86rem;
    font-weight: 850;
  }

  img {
    width: 100%;
    max-height: 180px;
    object-fit: contain;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
`;

const FooterNote = styled.p`
  margin: 12px 0 0;
  color: rgba(226, 232, 240, 0.62);
  font-size: 0.78rem;
  line-height: 1.5;
`;

const OwnerStatus = styled.span`
  color: rgba(226, 232, 240, 0.78);
  font-size: 0.86rem;
  font-weight: 850;
`;

// Util: fetch URL -> dataURL
async function urlToDataUrl(url) {
  const r = await fetch(url);
  const blob = await r.blob();
  return await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(blob);
  });
}

/* ==============================
   ✅ Scroll Lock (iOS/Android safe)
   - Bloquea el body SOLO mientras firmas
   - Restaura al terminar
============================== */
function lockBodyScroll() {
  const body = document.body;
  if (body.dataset.scrollLock === "1") return;

  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

  body.dataset.scrollLock = "1";
  body.dataset.scrollY = String(scrollY);

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.touchAction = "none";
}

function unlockBodyScroll() {
  const body = document.body;
  if (body.dataset.scrollLock !== "1") return;

  const y = parseInt(body.dataset.scrollY || "0", 10);

  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  body.style.touchAction = "";
  delete body.dataset.scrollLock;
  delete body.dataset.scrollY;

  window.scrollTo(0, y);
}

export default function Exitoso() {
  const { hash: hashParam } = useParams();
  const [searchParams] = useSearchParams();
  const manual = searchParams.get("manual") === "1";

  const [status, setStatus] = useState(manual ? "Confirmando transferencia…" : "Confirmando pago…");
  const [done, setDone] = useState(false);

  const [showJson, setShowJson] = useState(false);
  const [debug, setDebug] = useState({
    hash: null,
    manual: false,
    pending: null,
    ownerSource: null,
    ownerPicked: null,
    draft: null,
  });

  const [draftState, setDraftState] = useState(null);
  const [pendingState, setPendingState] = useState(null);
  const [ownerSig, setOwnerSig] = useState("");
  const [tenantSig, setTenantSig] = useState("");
  const [pdfBusy,setPdfBusy]=useState(false);
  const [generatedPDF,setGeneratedPDF]=useState(null);
  const pdfInFlight=useRef(false);

  const ranRef = useRef(false);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = 640;
    c.height = 180;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const prevent = (e) => {
      if (drawingRef.current) e.preventDefault();
    };

    c.addEventListener("touchmove", prevent, { passive: false });
    c.addEventListener("touchstart", prevent, { passive: false });

    return () => {
      c.removeEventListener("touchmove", prevent);
      c.removeEventListener("touchstart", prevent);
    };
  }, []);

  useEffect(() => {
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const raw = localStorage.getItem("pendingContract");
        if (!raw) {
          setStatus("No hay datos del contrato para generar el PDF.");
          setDebug((d) => ({ ...d, hash: hashParam || null, manual }));
          return;
        }
        const pending = JSON.parse(raw);
        setPendingState(pending);

        let ownerPicked = pending.ownerRaw || null;
        let ownerSource = null;

        if (!ownerPicked) {
          const ownerId = pending?.meta?.ownerId || pending?.meta?.propietarioId || null;
          let registry = {};
          try { registry = JSON.parse(localStorage.getItem("skylines.owner.registry") || "{}"); } catch {}
          const liveOwner = mtLiveSnapshot().find((item) => item?.kind === "skylines.owner.profile" && String(item?.id) === String(ownerId));
          ownerPicked = liveOwner?.attrs || registry?.[ownerId] || { nombreCompleto: "", documento: "", domicilio: "", email: "" };
          ownerSource = liveOwner ? "Identidad Viva" : "registro privado local";
        }

        const ownerNormalized = {
          nombreCompleto:
            ownerPicked?.nombreCompleto || ownerPicked?.nombre_completo || ownerPicked?.nombre || "",
          documento: ownerPicked?.documento || ownerPicked?.cedula || ownerPicked?.ruc || "",
          domicilio: ownerPicked?.domicilio || ownerPicked?.direccion || "",
          email: ownerPicked?.email || "",
        };

        let ownerSigDataUrl =
          pending?.ownerSigDataUrl ||
          ownerPicked?.firmaDataUrl ||
          ownerPicked?.firma_dataurl ||
          ownerPicked?.firmaDataURL ||
          "";

        if (!ownerSigDataUrl) {
          const firmaUrl = ownerPicked?.firmaUrl || ownerPicked?.firma_url || ownerPicked?.firma || "";
          if (firmaUrl) {
            try {
              ownerSigDataUrl = await urlToDataUrl(firmaUrl);
            } catch {
              ownerSigDataUrl = "";
            }
          }
        }
        setOwnerSig(ownerSigDataUrl || "");

        const pagareFromPending = pending?.pagare || null;

        const draft = buildDraftFromInputs({
          ownerRaw: ownerNormalized,
          tenant: {
            nombreCompleto: pending?.tenant?.nombreCompleto || "",
            documento: pending?.tenant?.documento || "",
            domicilio: pending?.tenant?.domicilio || "",
            email: pending?.tenant?.email || "",
            telefono: pending?.tenant?.telefono || "",
          },
          property: pending?.property || {},
          contrato: pending?.contrato || {},
          pagare: pagareFromPending || undefined,
        });

        const tenantSigFromPending = pending?.tenantSigDataUrl || "";
        if (tenantSigFromPending) setTenantSig(tenantSigFromPending);

        setStatus(
          manual
            ? "Transferencia confirmada ✅ Falta firma del inquilino para generar contrato."
            : "Pago confirmado ✅ Falta firma del inquilino para generar contrato."
        );

        setDraftState({
          ...draft,
          firmas: {
            locadorDataUrl: ownerSigDataUrl || "",
            locatarioDataUrl: tenantSigFromPending || "",
            signedAt: new Date().toISOString(),
          },
        });

        setDebug({
          hash: hashParam || null,
          manual,
          pending,
          ownerSource,
          ownerPicked: ownerNormalized,
          draft,
        });
      } catch (e) {
        console.error(e);
        setStatus("Ocurrió un error preparando el contrato.");
        setDebug((d) => ({ ...d, hash: hashParam || null, manual }));
      }
    })();
  }, [hashParam, manual]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debug, null, 2));
      alert("JSON copiado al portapapeles");
    } catch {
      alert("No se pudo copiar. Copiá manualmente.");
    }
  };

  const getPos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const startDraw = (e) => {
    e.preventDefault?.();
    lockBodyScroll();

    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const { x, y } = getPos(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (e) => {
    e.preventDefault?.();
    if (!drawingRef.current) return;

    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const { x, y } = getPos(e);

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    e?.preventDefault?.();
    drawingRef.current = false;
    unlockBodyScroll();
  };

  const clearSig = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(0, 0, c.width, c.height);
    setTenantSig("");
  };

  const saveSigFromCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    setTenantSig(c.toDataURL("image/png"));
  };

  const onUploadSig = (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => setTenantSig(String(fr.result || ""));
    fr.readAsDataURL(f);
  };

  const generateSignedPDF = async () => {
    if(pdfInFlight.current)return;
    pdfInFlight.current=true;setPdfBusy(true);
    let stage="Verificar identidad";
    try {
      if (!draftState) return;
      if (!tenantSig) {
        alert("Falta la firma del inquilino. Dibujá y tocá 'Guardar firma' o subí una imagen.");
        return;
      }
      const allLive = mtLiveSnapshot();
      const identity = await resolveCurrentIdentityContext({ allLive });
      const rentalMeta = pendingState?.meta || {};
      const landlordActorId = String(rentalMeta.landlordActorId || rentalMeta.ownerId || "");
      const tenantActorId = String(rentalMeta.tenantActorId || (identity.actorId !== landlordActorId ? identity.actorId : ""));
      if (!tenantActorId) throw new Error("Vinculá la Identidad Viva del locatario antes de activar el contrato.");
      const tenantAdult = await verifyAdultForJurisdiction(allLive, tenantActorId, { country: "PY", region: "Canindeyú", city: "Salto del Guairá" });
      if (!tenantAdult.verified) throw new Error("El locatario todavía no tiene la mayoría de edad verificada.");

      const signedDraft = {
        ...draftState,
        firmas: {
          ...(draftState.firmas || {}),
          locadorDataUrl: ownerSig || draftState?.firmas?.locadorDataUrl || "",
          locatarioDataUrl: tenantSig,
          signedAt: new Date().toISOString(),
        },
      };

      setStatus("Generando contrato firmado…");
      const rental = rentalMeta;
      let secureShareLink;
      if (rental.propertyId && rental.unitId && rental.holdId) {
        stage="Guardar contrato privado";
        const contractId = pendingState?.contractId || `rental.contract:${rental.holdId}`;
        const privateContract = await createPrivateContract({ contractId, state: "signed_by_tenant", ownerId: String(rental.ownerId || ""), propertyId: rental.propertyId, roomId: rental.unitId, landlordActorId, tenantActorId, authorizedAdminActorIds: [], document: { ...signedDraft, property: { propertyId: rental.propertyId, roomId: rental.unitId, name: pendingState?.property?.name || pendingState?.propertyName || "" } } });
        stage="Preparar acceso privado del QR";
        const capability = await createTemporaryContractCapability(privateContract.contractId, 20);
        secureShareLink = capability.url;
        if (ownerSig) {
          stage="Activar contrato y verificar reserva";
          await freezePrivateContract(privateContract.contractId, "active");
          await activateRentalContract({ propertyId: rental.propertyId, unitId: rental.unitId, holdId: rental.holdId, contractId, tenantActorId, expectedRevision: Number(rental.expectedRevision || 2), periodStart: pendingState?.contrato?.inicio, periodEnd: pendingState?.contrato?.fin, allLive });
        }
      }
      stage="Generar y descargar PDF";
      const generated=await generateContractPDFFromDraftWithQR(signedDraft, secureShareLink);
      setGeneratedPDF(generated);

      localStorage.removeItem("pendingContract");
      setDone(true);
      setStatus("Contrato firmado generado y descargado 📄✅");

      setDebug((d) => ({
        ...d,
        draftFirmado: signedDraft,
      }));
    } catch (e) {
      const detail=e instanceof Error?e.message:"No se pudo completar este paso.";
      setStatus(`${stage}: ${detail} Tu firma sigue cargada; podés reintentar.`);
    } finally {
      pdfInFlight.current=false;setPdfBusy(false);
    }
  };

  const pagareEnabled = !!draftState?.pagare?.enabled;

  return (
    <Container>
      <Card>
        <Header>
          <TopBadgeRow>
            <Pill>Skylines · UTOPY rent</Pill>

            <StatusOrbWrap $done={done}>
              <StatusOrb $done={done} />
              {done ? "Contrato generado" : "Esperando firma"}
            </StatusOrbWrap>
          </TopBadgeRow>

          <Title>
            {manual ? "Transferencia registrada" : "Pago exitoso"}
            <span>Contrato vivo listo para firmar</span>
          </Title>

          <StatusText>{status}</StatusText>
        </Header>

        {draftState && (
          <MetaGrid>
            <PagarBadge $active={pagareEnabled}>
              Pagaré: {pagareEnabled ? "incluido ✅" : "no incluido"}
            </PagarBadge>

            <Row style={{ marginTop: 0 }}>
              <SmallBtn onClick={() => setShowJson((v) => !v)}>
                {showJson ? "Ocultar JSON" : "Ver JSON debug"}
              </SmallBtn>
              {showJson && <SmallBtn onClick={copyJson}>Copiar JSON</SmallBtn>}
            </Row>
          </MetaGrid>
        )}

        {!draftState && (
          <Row>
            <SmallBtn onClick={() => setShowJson((v) => !v)}>
              {showJson ? "Ocultar JSON" : "Ver JSON debug"}
            </SmallBtn>
            {showJson && <SmallBtn onClick={copyJson}>Copiar JSON</SmallBtn>}
          </Row>
        )}

        {showJson && <JsonBox>{JSON.stringify(debug, null, 2)}</JsonBox>}

        {draftState && (
          <>
            <HR />

            <SigBox>
              <SigHeader>
                <h3>Firma del inquilino</h3>
                <p>
                  Firmá con el dedo o el mouse. También podés subir una imagen de tu firma.
                  Al guardar, el contrato se genera con QR y queda listo para descargar.
                </p>
              </SigHeader>

              <CanvasWrap>
                <CanvasHint>Área de firma</CanvasHint>
                <Canvas
                  ref={canvasRef}
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
              </CanvasWrap>

              <Row>
                <SmallBtn onClick={clearSig}>Limpiar</SmallBtn>
                <SmallBtn onClick={saveSigFromCanvas}>Guardar firma</SmallBtn>

                <Label>
                  <span>Subir firma</span>
                  <input type="file" accept="image/*" onChange={onUploadSig} />
                </Label>
              </Row>

              {tenantSig && (
                <SignaturePreview>
                  <p>Vista previa de la firma</p>
                  <img src={tenantSig} alt="firma inquilino" />
                </SignaturePreview>
              )}

              <Row style={{ marginTop: 16 }}>
                <PrimaryBtn onClick={generateSignedPDF} disabled={!tenantSig||pdfBusy}>
                  {pdfBusy?'Preparando contrato…':'Generar PDF firmado 📄'}
                </PrimaryBtn>

                <OwnerStatus>
                  LOCADOR: {ownerSig ? "firma cargada ✅" : "sin firma opcional"}
                </OwnerStatus>
              </Row>

              <FooterNote>
                Tip: en celular podés firmar con el dedo. Mientras firmás, la pantalla no se mueve para evitar cortes.
              </FooterNote>
            </SigBox>
          </>
        )}

        {done && <><Row><Button to="/mis-contratos">Mis contratos y renovaciones</Button>{generatedPDF?<SmallBtn onClick={()=>void shareRentalPDF(generatedPDF).then(()=>setStatus('Se cerró el menú de compartir. Confirmá el envío en la aplicación elegida.')).catch(error=>{if(error?.name!=='AbortError')setStatus(error?.message||'No se pudo compartir. El PDF ya está descargado.');})}>Compartir PDF</SmallBtn>:null}<a href={rentalWhatsAppUrl()} target="_blank" rel="noopener noreferrer">Abrir WhatsApp de Mateo</a></Row><FooterNote>Compartí el PDF con WhatsApp y elegí el contacto. Si abrís el chat directamente, adjuntá el archivo descargado. No se envía automáticamente. Tus contratos se conservan en este navegador, con tu identidad; no borres sus datos.</FooterNote><Button to="/falcon/skylines">Volver a Skylines</Button></>}
      </Card>
    </Container>
  );
}
