import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";

import AppShell from "./components/appshell";

import BotonIntruction from "./components/botonintruction";
const MercadoLocal = lazy(() => import("./pages/mercado"));
const TotemPage = lazy(() => import("./pages/totem"));
const TotemPageV2 = lazy(() => import("./pages/Totem.v2"));
const RoomDetailPage = lazy(() => import("./pages/renta"));
const Payment = lazy(() => import("./pages/payment"));
const Contrato = lazy(() => import("./pages/contract"));
const NodePanel = lazy(() => import("./pages/login"));
const PagoExitoso = lazy(() => import("./pages/exito"));
const Exitoso = PagoExitoso;
const FalconShell = lazy(() => import("./components/FalconShell"));
const FalconStorePage = lazy(() => import("./falcon/falconstore"));
const FalconSkylinesPage = lazy(() => import("./pages/falcon.skylines"));
const FalconDailyPage = lazy(() => import("./pages/falcondaily"));
const FalconCapitalPage = lazy(() => import("./pages/falconCapital"));
const LiveProfilePage = lazy(() => import("./pages/liveprofile"));
const MyContractsPage = lazy(() => import("./pages/mycontracts"));
const PrivateContractPage = lazy(() => import("./pages/privatecontract"));
const SkylinesRentalDetailPage = lazy(() => import("./pages/skylines.rental.detail"));
const LivingPayPage = lazy(() => import("./pages/livingpay"));
const ConversationView = lazy(() => import("./pages/ConversationView"));
const IdentitySessionSigner = lazy(() => import("./pages/IdentitySessionSigner"));
const BusinessWorkspace = lazy(() => import("./pages/BusinessWorkspace"));
const LuaPage = lazy(() => import("./pages/LuaPage"));
const BassiPage = lazy(() => import("./pages/BassiPage"));
const AcceptNodeInvitation = lazy(() => import("./pages/AcceptNodeInvitation"));
const BookingPreviewPage = lazy(() => import("./pages/BookingPreviewPage"));

function RouteFallback() {
  return <div className="grid min-h-[46vh] place-items-center bg-[#fafafa] px-5 text-center text-sm font-bold text-slate-500">⌁ Preparando esta vista…</div>;
}

function FrequencyReferenceRoute() {
  const { frequencyId = "" } = useParams();
  return <Navigate to={`/market?frequencyId=${encodeURIComponent(frequencyId)}`} replace />;
}

export default function App() {
  const previewRoute=/^\/prueba\/?$/i.test(useLocation().pathname);
  useEffect(() => {
    if(previewRoute)return;
    let active = true;
    void Promise.all([
      import("./utopy/boot"),
      import("./liquidity/liq.ai.runtime"),
    ]).then(([seedRuntime, liquidityRuntime]) => {
      if (!active) return;
      void seedRuntime.bootUtopyWithWs().catch(console.error);
      liquidityRuntime.bootLiqAiRuntime();
    });
    return () => { active = false; };
  }, [previewRoute]);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          {/* MARKET */}
          <Route path="/" element={<Navigate to="/mt" replace />} />
          <Route path="/mt" element={<MercadoLocal territoryMode />} />
          <Route path="/market" element={<MercadoLocal />} />
          <Route path="/lua" element={<LuaPage />} />
          <Route path="/lua/gestionar" element={<LuaPage manage />} />
          <Route path="/bassi" element={<BassiPage />} />
          <Route path="/bassi/gestionar" element={<BassiPage manage />} />
          <Route path="/prueba" element={<BookingPreviewPage />} />
          <Route path="/invitacion" element={<AcceptNodeInvitation />} />
          <Route path="/mi-espacio" element={<BusinessWorkspace />} />
          <Route path="/n/:slug" element={<BusinessWorkspace />} />
          <Route path="/n/:slug/gestionar" element={<BusinessWorkspace manage />} />
          <Route path="/market/mapa" element={<MercadoLocal />} />
          <Route path="/identity/session" element={<IdentitySessionSigner />} />
          <Route path="/conversacion/:threadId" element={<ConversationView />} />
         <Route path="/market/totem" element={<TotemPageV2/>} />
<Route path="/market/totem-v2" element={<TotemPage />} />
<Route path="/totem" element={<TotemPageV2 />} />
<Route path="/totem-v2" element={<TotemPage/>} />
          {/* MARKET DEEP LINKS / LINKS COMPARTIBLES */}
          <Route path="/market/producto/:productId" element={<MercadoLocal />} />
          <Route path="/market/oferta/:offerId" element={<MercadoLocal />} />
          <Route path="/market/pedido/:threadId" element={<MercadoLocal />} />

          {/* ALIAS CORTOS PARA COMPARTIR */}
          <Route path="/producto/:productId" element={<MercadoLocal />} />
          <Route path="/oferta/:offerId" element={<MercadoLocal />} />
          <Route path="/pedido/:threadId" element={<MercadoLocal />} />
          <Route path="/r/:frequencyId" element={<FrequencyReferenceRoute />} />

          {/* FALCON FULL */}
          <Route path="/falcon" element={<FalconShell />}>
            <Route index element={<Navigate to="/falcon/store" replace />} />
            <Route path="store" element={<FalconStorePage />} />
            <Route path="skylines" element={<FalconSkylinesPage />} />
            <Route path="daily" element={<FalconDailyPage />} />
            <Route path="capital" element={<FalconCapitalPage />} />
            <Route path="propiedad/:propertyId/pieza/:roomNumber" element={<RoomDetailPage />} />
            <Route path="skylines/propiedad/:propertyId" element={<SkylinesRentalDetailPage />} />
          </Route>

          {/* LEGACY */}
          <Route
            path="/propiedad/:propertyId/pieza/:roomNumber"
            element={<RoomDetailPage />}
          />
          <Route path="/login" element={<NodePanel />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/contrato" element={<Contrato />} />
          <Route path="/mis-contratos" element={<MyContractsPage />} />
          <Route path="/pagar/:paymentRequestId" element={<LivingPayPage />} />
          <Route path="/contratos/:contractId" element={<PrivateContractPage />} />
          <Route path="/contratos/acceso/:token" element={<PrivateContractPage capability />} />
          <Route path="/renta/:propertyId" element={<RoomDetailPage />} />
          <Route path="/renta" element={<RoomDetailPage />} />
          <Route path="/pago-exitoso/:hash" element={<PagoExitoso />} />
          <Route path="/exitoso" element={<Exitoso />} />
          <Route path="/exitoso/:hash" element={<Exitoso />} />
          <Route path="/:handle" element={<LiveProfilePage />} />
        </Route>

        {/* ALIAS CÓMODOS FALCON */}
        <Route path="/store" element={<Navigate to="/market?context=store" replace />} />
        <Route path="/skylines" element={<Navigate to="/falcon/skylines" replace />} />
        <Route path="/daily" element={<Navigate to="/falcon/daily" replace />} />
        <Route path="/capital" element={<Navigate to="/falcon/capital" replace />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
      </Suspense>

      <BotonIntruction/>
    </>
  );
}
