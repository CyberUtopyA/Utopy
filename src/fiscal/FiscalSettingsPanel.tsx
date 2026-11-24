import React, { useState } from "react";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { fiscalClientConfigured, fiscalRequest } from "./fiscalClient";

export default function FiscalSettingsPanel({ allLive, activeActor }: { allLive: any[]; activeActor?: any }) {
  const [mode, setMode] = useState("none");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const context = await resolveCurrentIdentityContext({ allLive, activeActor, actingAsNodeId: activeActor?.actingAsNodeId || activeActor?.nodeId, action: "fiscal.settings.read" });
      const result = await fiscalRequest("settings.read", context.actingAsNodeId || context.nodeId || context.actorId);
      setNotice(result.ready ? `${result.simulation ? "Simulación configurada" : "Listo para pruebas"}. Producción bloqueada.` : "Requiere atención: configuración de pruebas incompleta. Producción bloqueada.");
    } catch (e: any) { setNotice(e.message || "No se pudo comprobar la configuración."); }
    finally { setBusy(false); }
  }
  return <details className="rounded-2xl border border-slate-200 bg-white/80 p-4">
    <summary className="cursor-pointer font-black">Facturación</summary>
    <div className="mt-3 grid gap-3 text-sm">
      <p className="text-slate-500">{busy ? "Configurando: comprobando el servicio privado…" : notice || "No configurado. Podés seguir cobrando y usando comprobantes internos."}</p>
      <p className="rounded-xl bg-amber-50 p-2 text-amber-900">Modo de pruebas SIFEN · sin valor fiscal real. Producción bloqueada.</p>
      {[["none", "Todavía no configuro facturación electrónica"], ["manual", "Uso e-Kuatia’i"], ["sifen", "Conectar e-Kuatia / SIFEN"]].map(([value, label]) =>
        <label key={value} className="flex gap-2"><input type="radio" name="fiscal-onboarding" value={value} checked={mode === value} onChange={() => setMode(value)} />{label}</label>)}
      {mode === "manual" && <p>Emití este documento desde e-Kuatia’i. Esta opción no conecta ni automatiza esa plataforma.</p>}
      {mode === "sifen" && <><p>El administrador configura el contribuyente y los certificados en el servidor privado. No pegues claves ni CSC aquí.</p>
        <button type="button" disabled={busy || !fiscalClientConfigured()} onClick={check} className="rounded-full bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-40">{busy ? "Comprobando…" : "Comprobar conexión de pruebas"}</button>
        {!fiscalClientConfigured() && <p>Falta conectar el servicio fiscal seguro.</p>}</>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}
