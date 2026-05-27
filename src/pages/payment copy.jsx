import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";

const Container = styled.div`
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(145deg, #2c5364, #203a43, #0f2027);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #fff;
  @media (max-width: 768px) {
    padding: 20px;
  }
`;
const Card = styled.div`
  background: rgba(255, 255, 255, 0.05);
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 420px;
  width: 100%;
  @media (max-width: 768px) {
    padding: 20px;
    max-width: 100%;
  }
`;
const Button = styled.button`
  width: 100%;
  padding: 12px;
  margin-top: 16px;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background: #222;
  }
`;

const WORKER_NEW_ORDER =
  "https://pagopar-worker.falconventas1.workers.dev/api/pagopar/new-order";

function Payment() {
  const { state = {} } = useLocation();
  const navigate = useNavigate();
  const {
    propertyId,
    roomId,
    amount: rawAmount,
    startDate,
    endDate,
    userName,
    userCI,
    userAddress,
    userEmail,
    // opcionales para el PDF en exitoso:
    ownerRaw,
    ownerRawUrl,
    address,
    city,
    description,
  } = state;

  const [amountNumber, setAmountNumber] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId || !roomId || !rawAmount || !startDate || !endDate) {
      alert("Faltan datos para iniciar el pago.");
      navigate("/");
      return;
    }
    // ⚠️ SIN PARSER: esperamos número directo
    if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount)) {
      console.error("rawAmount inválido:", rawAmount);
      alert("El monto debe venir como número (Gs). Corrige el origen.");
      navigate(-1);
      return;
    }
    setAmountNumber(Math.round(rawAmount));
  }, [navigate, propertyId, roomId, rawAmount, startDate, endDate]);
  // 🔹 Normalizar documento a solo dígitos y mínimo 6 chars
  const documentoDigits = String(userCI || "").replace(/\D+/g, "");
  const ci =
    documentoDigits.length >= 6
      ? documentoDigits
      : documentoDigits.padStart(6, "0"); // ej: "3929" -> "003929"

  const startPagopar = async () => {
    try {
      setLoading(true);

      const monto = Math.max(1000, Math.round(amountNumber || 0));
      if (!monto) {
        alert("El monto debe ser mayor a 0.");
        return;
      }

      // Email obligatorio (si falta, dummy)
      const safeEmail =
        userEmail && /\S+@\S+\.\S+/.test(userEmail)
          ? userEmail
          : "comprador@dummy.local";

      // 🔹 Normalizar documento a solo dígitos (requerido por Pagopar)
      const documento = String(userCI || "").replace(/\D+/g, "") || "0000000";

      // Guardar borrador para Exitoso (PDF)
      localStorage.setItem(
        "pendingContract",
        JSON.stringify({
          ownerRaw: ownerRaw || null,
          ownerRawUrl: ownerRawUrl || null,
          tenant: {
            nombreCompleto: userName || "",
            ci: documento, // ← guardo el doc ya normalizado
            domicilio: userAddress || "",
            email: safeEmail,
          },
          property: {
            tipo: "pieza",
            numeroUnidad: String(roomId || ""),
            direccion: address || "",
            ciudad: city || "Asunción",
            descripcion: description || "",
          },
          contrato: {
            canon: String(monto),
            moneda: "PYG",
            plazoMeses: "1",
            inicio: startDate,
            diaVencimiento: "5",
            deposito: "",
            incluyeServicios: "",
            politicaMascotas: "",
            lecturaMedidores: "",
            inventario: "",
            clausulasAdicionales: "",
          },
        })
      );

      // Llamada al Worker
      const resp = await fetch(WORKER_NEW_ORDER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: monto,
          description: `Alquiler prop:${propertyId} / hab:${roomId} (${startDate}→${endDate})`,
          orderId: `ALQ-${propertyId}-${roomId}-${Date.now()}`,
          buyer: {
            name: userName || "Consumidor final",
            documento: ci, // ← documento ya en dígitos
            address: userAddress || "",
            email: safeEmail,
            phone: "",
          },
          meta: { propertyId, roomId, startDate, endDate, currency: "PYG" },
        }),
      });

      const txt = await resp.text();
      let data;
      try {
        data = JSON.parse(txt);
      } catch {
        data = { raw: txt };
      }

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
      window.location.href =
        checkout_url || `https://www.pagopar.com/pagos/${hash}`;
    } catch (e) {
      console.error(e);
      alert("No se pudo iniciar el pago con Pagopar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Sidebar />
      <Card>
        <h2>Pago de alquiler</h2>
        <p>
          <strong>Propiedad:</strong> {propertyId} · <strong>Hab.:</strong>{" "}
          {roomId}
        </p>
        <p>
          <strong>Período:</strong> {startDate} → {endDate}
        </p>
        <p style={{ marginTop: 8 }}>
          Monto: <strong>{amountNumber.toLocaleString("es-PY")} Gs</strong>
        </p>

        <Button onClick={startPagopar} disabled={loading}>
          {loading ? "Creando pedido..." : "💳 Pagar"}
        </Button>

        <Button style={{ background: "#333" }} onClick={() => navigate(-1)}>
          Volver
        </Button>
      </Card>
    </Container>
  );
}

export default Payment;
