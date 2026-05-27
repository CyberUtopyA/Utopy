import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { bootUtopyWithWs } from "./utopy/boot";

import MercadoLocal from "./pages/mercado";
import TotemPage from "./pages/totem";

import RoomDetailPage from "./pages/renta";
import Payment from "./pages/payment";
import Contrato from "./pages/contract";
import NodePanel from "./pages/login";
import PagoExitoso from "./pages/exito";
import Exitoso from "./pages/exito";

import FalconShell from "./components/FalconShell";
import FalconStorePage from "./falcon/falconstore";
import FalconSkylinesPage from "./pages/falcon.skylines";
import FalconDailyPage from "./pages/falcondayli";
import FalconCapitalPage from "./pages/falconCapital";
import AppShell from "./components/appshell";
import { bootLiqAiRuntime } from "./liquidity/liq.ai.runtime";

export default function App() {
  useEffect(() => {
    bootUtopyWithWs().catch(console.error);
    bootLiqAiRuntime();
  }, []);

  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* MARKET */}
        <Route path="/" element={<Navigate to="/market" replace />} />
        <Route path="/market" element={<MercadoLocal />} />
        <Route path="/market/totem" element={<TotemPage />} />

        {/* MARKET DEEP LINKS / LINKS COMPARTIBLES */}
        <Route path="/market/producto/:productId" element={<MercadoLocal />} />
        <Route path="/market/oferta/:offerId" element={<MercadoLocal />} />
        <Route path="/market/pedido/:threadId" element={<MercadoLocal />} />

        {/* ALIAS CORTOS PARA COMPARTIR */}
        <Route path="/producto/:productId" element={<MercadoLocal />} />
        <Route path="/oferta/:offerId" element={<MercadoLocal />} />
        <Route path="/pedido/:threadId" element={<MercadoLocal />} />

        {/* FALCON FULL */}
        <Route path="/falcon" element={<FalconShell />}>
          <Route index element={<Navigate to="/falcon/store" replace />} />
          <Route path="store" element={<FalconStorePage />} />
          <Route path="skylines" element={<FalconSkylinesPage />} />
          <Route path="daily" element={<FalconDailyPage />} />
          <Route path="capital" element={<FalconCapitalPage />} />
        </Route>

        {/* LEGACY */}
        <Route
          path="/propiedad/:propertyId/pieza/:roomNumber"
          element={<RoomDetailPage />}
        />
        <Route path="/login" element={<NodePanel />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/contrato" element={<Contrato />} />
        <Route path="/renta/:propertyId" element={<RoomDetailPage />} />
        <Route path="/renta" element={<RoomDetailPage />} />
        <Route path="/pago-exitoso/:hash" element={<PagoExitoso />} />
        <Route path="/exitoso" element={<Exitoso />} />
        <Route path="/exitoso/:hash" element={<Exitoso />} />
      </Route>

      {/* ALIAS CÓMODOS FALCON */}
      <Route path="/store" element={<Navigate to="/falcon/store" replace />} />
      <Route path="/skylines" element={<Navigate to="/falcon/skylines" replace />} />
      <Route path="/daily" element={<Navigate to="/falcon/daily" replace />} />
      <Route path="/capital" element={<Navigate to="/falcon/capital" replace />} />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/market" replace />} />
    </Routes>
  );
}