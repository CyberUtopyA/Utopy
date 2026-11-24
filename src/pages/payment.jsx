// src/pages/Payment.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";
import { formatRentalMoney, normalizeCurrency } from "../utils/rentalProperty";
import { mtLiveSnapshot } from "../mt/mt.liveStore";

const Container = styled.div`
  min-height: 100vh; width: 100vw;
  background: linear-gradient(145deg, #2c5364, #203a43, #0f2027);
  display: flex; flex-direction: column; align-items: center;
  padding: 40px; color: #fff;
  @media (max-width: 768px) { padding: 20px; }
`;
const Card = styled.div`
  background: rgba(255,255,255,0.05);
  padding: 30px; border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  max-width: 420px; width: 100%;
  @media (max-width: 768px) { padding: 20px; max-width: 100%; }
`;
const Button = styled.button`
  width: 100%; padding: 12px; margin-top: 16px;
  background: #000; color: #fff; border: none; border-radius: 10px;
  cursor: pointer; &:hover { background: #222; }
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

const Box = styled.div`
  margin-top: 1rem; padding: 1rem;
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 12px;
`;

const Row = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 10px;
`;

const Label = styled.label`
  display: flex; align-items: center; gap: 10px;
  font-size: 14px; opacity: .95;
`;

const WORKER_NEW_ORDER =
  "https://pagopar-worker.falconventas1.workers.dev/api/pagopar/new-order";

// Email directo con FormSubmit
async function sendDirectEmail({ to, subject, body }) {
  if (!to) return;
  try {
    const res = await fetch("https://formsubmit.co/ajax/oficial@falconventas.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: subject,
        _cc: to,
        message: body,
      }),
    });
    await res.json().catch(() => ({}));
  } catch (err) {
    console.error("Error enviando email a", to, err);
  }
}

function Payment() {
  const { state = {} } = useLocation();
  const navigate = useNavigate();

  const {
    propertyId,
    roomId,
    amount: rawAmount,
    currency: rawCurrency,
    startDate,
    endDate,
    userName,
    userCI,
    userAddress,
    userEmail,

    ownerEmail: ownerEmailFromState,
    ownerRaw,
    ownerRawUrl,
    meta,

    address,
    city,
    description,

    userPhone,
  } = state;

  const [amountNumber, setAmountNumber] = useState(0);
  const [loading, setLoading] = useState(false);
  const currency = normalizeCurrency(rawCurrency);

  // ✅ Garantía por defecto (siempre 500.000 como pediste)
  const GUARANTEE_DEFAULT = Number(state?.contractDefaults?.deposito ?? 0);

  // ✅ pagaré: auto-true si garantía >= 1, pero editable por checkbox
  const [enablePagare, setEnablePagare] = useState(false);

  useEffect(() => {
    if (!propertyId || !roomId || !rawAmount || !startDate || !endDate) {
      alert("Faltan datos para iniciar el pago.");
      navigate("/");
      return;
    }
    if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount)) {
      console.error("rawAmount inválido:", rawAmount);
      alert("El monto debe venir como número (Gs). Corrige el origen.");
      navigate(-1);
      return;
    }
    setAmountNumber(Math.round(rawAmount));
  }, [navigate, propertyId, roomId, rawAmount, startDate, endDate]);

  // ✅ auto set pagaré según garantía (si algún día cambiás el monto)
  useEffect(() => {
    setEnablePagare(false);
  }, []);

  const normalizeDocumento = (doc) => {
    const digits = String(doc || "").replace(/\D+/g, "");
    return digits.length >= 6 ? digits : digits.padStart(6, "0");
  };

  const isEmail = (s) => typeof s === "string" && /\S+@\S+\.\S+/.test(s);

  const ownerIdResolved = useMemo(() => {
    return (
      meta?.ownerId ||
      state?.owner || // si tu app manda "owner" como UUID
      ownerRaw?.id ||
      null
    );
  }, [meta?.ownerId, state?.owner, ownerRaw?.id]);
  const hasLegacyBankTransfer =
    currency === "PYG" && ownerIdResolved === "6c44e912-c220-4f51-91dd-b317d639fc58";

  // ✅ pendingContract completo para utils/contrato.ts nuevo
  const savePendingContractDraft = (amount) => {
    const documento = normalizeDocumento(userCI);
    const tenantEmail = isEmail(userEmail) ? userEmail.trim() : "";

    const inmuebleDireccion = address?.trim() || "";
    const inmuebleCiudad = city?.trim() || "";
    const inmuebleDesc = description?.trim() || "";

    const draft = {
      ownerRaw: ownerRaw || null,
      ownerRawUrl: null,
      meta: { ...(meta || {}), ownerId: ownerIdResolved, propertyId, unitId: meta?.unitId || roomId },

      tenant: {
        nombreCompleto: (userName || "").trim(),
        documento,
        domicilio: (userAddress || "").trim(),
        email: tenantEmail, // opcional
        telefono: (userPhone || "").trim(),
      },

      property: {
        tipo: "pieza",
        numeroUnidad: String(roomId || ""),
        direccion: inmuebleDireccion,
        ciudad: inmuebleCiudad,
        descripcion: inmuebleDesc,
      },

      contrato: {
        inicio: startDate,
        fin: endDate,       // ✅ fin real
        plazoMeses: 6,      // ✅ 6 meses
        moneda: currency,
        canon: amount,
        diaVencimiento: "",

        // ✅ Garantía real para que contrato.ts la imprima
        deposito: GUARANTEE_DEFAULT,

        incluyeServicios: "",
        politicaMascotas: "",
        lecturaMedidores: "",
        inventario: "",
        clausulasAdicionales: "",
        ...(state?.contractDefaults||{}),
      },

      // ✅ PAGARÉ opcional (lo consume tu contrato.ts actualizado)
      pagare: {
        enabled: !!enablePagare,
        monto: GUARANTEE_DEFAULT,
        moneda: currency,
        vencimiento: endDate || "",
        lugarPago: inmuebleCiudad,
        clausula:
          "Exigible únicamente si se verifican daños/faltantes o incumplimiento comprobado al momento de la entrega.",
      },
    };

    localStorage.setItem("pendingContract", JSON.stringify(draft));
  };

  // 1) Pagopar
  const startPagopar = async () => {
    try {
      if (currency !== "PYG") {
        alert("Este medio de pago solo está habilitado para PYG. La moneda contractual no fue modificada.");
        return;
      }
      setLoading(true);

      const monto = Math.max(1000, Math.round(amountNumber || 0));
      if (!monto) {
        alert("El monto debe ser mayor a 0.");
        return;
      }

      savePendingContractDraft(monto);

      const documento = normalizeDocumento(userCI);
      const buyerEmail = isEmail(userEmail) ? userEmail : "comprador@dummy.local";

      const resp = await fetch(WORKER_NEW_ORDER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: monto,
          description: `Alquiler prop:${propertyId} / hab:${roomId} (${startDate}→${endDate})`,
          orderId: `ALQ-${propertyId}-${roomId}-${Date.now()}`,
          buyer: {
            name: userName || "Consumidor final",
            documento,
            ci: documento,
            address: userAddress || "",
            email: buyerEmail,
            phone: userPhone || "",
          },
          meta: {
            propertyId,
            roomId,
            startDate,
            endDate,
            currency,
            address: address || "",
            city: city || "",
            description: description || "",
            ownerId: ownerIdResolved,
          },
        }),
      });

      const txt = await resp.text();
      let data;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!resp.ok) {
        console.error("Pagopar error:", data);
        alert(
          data?.detail_v2?.resultado ||
            data?.detail_legacy?.resultado ||
            "Pagopar rechazó el pedido. Ver consola."
        );
        return;
      }

      const { hash, checkout_url } = data || {};
      if (!hash) {
        console.error("Respuesta sin hash:", data);
        alert("Pagopar no devolvió hash (ver consola).");
        return;
      }
      window.location.href = checkout_url || `https://www.pagopar.com/pagos/${hash}`;
    } catch (e) {
      console.error(e);
      alert("No se pudo iniciar el pago con Pagopar.");
    } finally {
      setLoading(false);
    }
  };

  // 2) Transferencia
  const handleBankTransferConfirm = async () => {
    try {
      setLoading(true);

      const monto = Math.max(1000, Math.round(amountNumber || 0));
      if (!monto) {
        alert("El monto debe ser mayor a 0.");
        return;
      }

      savePendingContractDraft(monto);

      const formatAmount = (n) => formatRentalMoney(n, currency);
      const renterEmail = isEmail(userEmail) ? userEmail : null;

      const ownerEmail =
        ownerEmailFromState ||
        (ownerRaw && ownerRaw.email) ||
        null;

      if (renterEmail) {
        await sendDirectEmail({
          to: renterEmail,
          subject: "📄 Confirmación de alquiler (transferencia registrada)",
          body: `
Hola ${userName || ""},

Registramos tu pago por transferencia bancaria del alquiler:

• Propiedad: ${propertyId} / Habitación: ${roomId}
• Período: ${startDate} → ${endDate}
• Monto: ${formatAmount(monto)}

Ahora podés generar el contrato en PDF desde la página de confirmación.

Gracias.
          `.trim(),
        });
      }

      if (ownerEmail) {
        await sendDirectEmail({
          to: ownerEmail,
          subject: "🏠 Notificación de alquiler — transferencia registrada",
          body: `
Hola,

Un inquilino registró pago por transferencia:

• Propiedad: ${propertyId}
• Habitación: ${roomId}
• Período: ${startDate} → ${endDate}
• Monto: ${formatAmount(monto)}

Verificá el ingreso y coordiná la entrega/continuidad.
          `.trim(),
        });
      }

      await sendDirectEmail({
        to: "oficial@falconventas.com",
        subject: "📦 Nuevo pago por transferencia — procesar",
        body: `
Nuevo pago por transferencia registrado:

• Propiedad: ${propertyId}
• Habitación: ${roomId}
• Inquilino: ${userName || "-"} (CI ${normalizeDocumento(userCI)})
• Email inquilino: ${renterEmail || "-"}

• Período: ${startDate} → ${endDate}
• Monto: ${formatAmount(monto)}

Acción: verificar la transferencia y archivar comprobantes.
        `.trim(),
      });

      navigate("/exitoso?manual=1");
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la transferencia.");
    } finally {
      setLoading(false);
    }
  };

  const openEditableContract = async () => {
    try {
      setLoading(true);
      let registry = {};
      try { registry = JSON.parse(localStorage.getItem("skylines.owner.registry") || "{}"); } catch {}
      const liveOwner = mtLiveSnapshot().find((item) => item?.kind === "skylines.owner.profile" && String(item?.id) === String(ownerIdResolved));
      const selectedOwner =
        ownerRaw ||
        liveOwner?.attrs || registry?.[ownerIdResolved] ||
        {};
      localStorage.setItem("contratoDraft", JSON.stringify({
        parteActual: "arrendador",
        arrendador: {
          nombreCompleto: selectedOwner?.nombreCompleto || "",
          documento: selectedOwner?.documento || "",
          domicilio: selectedOwner?.domicilio || "",
          telefono: selectedOwner?.telefono || "",
          email: selectedOwner?.email || "",
        },
        arrendatario: { nombreCompleto: "", documento: "", domicilio: "", telefono: "", email: "" },
        inmueble: {
          direccion: address?.trim() || "",
          ciudad: city?.trim() || "",
          tipo: "apartamento",
          numeroUnidad: String(roomId || ""),
          descripcion: description?.trim() || "",
        },
        contrato: {
          canon: String(amountNumber || ""),
          moneda: currency,
          deposito: "",
          diaVencimiento: "",
          plazoMeses: "",
          inicio: "",
          incluyeServicios: "",
          politicaMascotas: "",
          lecturaMedidores: "",
          inventario: "",
          clausulasAdicionales: "",
        },
      }));
      navigate("/contrato");
    } catch (error) {
      console.error("No se pudo preparar el contrato:", error);
      alert("No se pudo cargar al propietario para preparar el contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Sidebar />
      <Card>
        <h2>Pago de alquiler</h2>

        <p><strong>Propiedad:</strong> {propertyId} · <strong>Hab.:</strong> {roomId}</p>
        <p><strong>Período:</strong> {startDate} → {endDate}</p>
        <p style={{ marginTop: 8 }}>
          Monto: <strong>{formatRentalMoney(amountNumber, currency)}</strong>
        </p>

        {/* ✅ pagaré opcional */}
        <Box>
          <h4 style={{ margin: 0 }}>📌 Documento</h4>
          <Row>
            <Label>
              <input
                type="checkbox"
                checked={enablePagare}
                onChange={(e) => setEnablePagare(e.target.checked)}
                disabled={loading}
              />
              Agregar pagaré (opcional)
            </Label>
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              Depósito libre para completar
            </span>
          </Row>
          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            El pagaré solo se incluye como anexo si está activado. La garantía se imprime igualmente en el contrato.
          </p>
        </Box>

        <Button onClick={openEditableContract} disabled={loading}>
          Preparar contrato
        </Button>

        {currency === "PYG" ? <Button onClick={startPagopar} disabled={loading}>
          {loading ? "Creando pedido..." : "💳 Pagar"}
        </Button> : null}

        {hasLegacyBankTransfer ? <Box>
          <h4>🧾 Datos para transferencia</h4>
          <p><strong>Alias:</strong> 7636446</p>
          <p><strong>Titular:</strong> Mateo Valentin Falcon Villalba</p>
          <p><strong>CI:</strong> 7636446</p>
          <p><strong>Banco:</strong> Ueno Bank</p>
          <p><strong>N° de cuenta:</strong> 6192012392</p>
          <p><strong>Moneda:</strong> Guaraníes (Gs)</p>

          <Button style={{ marginTop: 12 }} onClick={handleBankTransferConfirm} disabled={loading}>
            {loading ? "Registrando..." : "✅ Ya hice la transferencia"}
          </Button>
        </Box> : null}

        <Button style={{ background: "#333", marginTop: 16 }} onClick={() => navigate(-1)} disabled={loading}>
          Volver
        </Button>
      </Card>
    </Container>
  );
}

export default Payment;
