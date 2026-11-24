import { useEffect, useState } from "react";
import type { LivingCapabilityEnvelope } from "utopy/living-space";
import { marketAuthorityTrust } from "../utopy/runtimeTrust";
import { livingSpaceContinuity } from "../utopy/livingSpaceContinuity";
import { runtimeIdentity } from "../utopy/MarketRuntimeAdapter";
import { humanVisibleText } from "../social/liveNetwork.human";
import { requireActiveSessionIdentity } from "../utopy/ownership";

export default function LivingCapabilityDetails({ envelope, allLive }: { envelope: LivingCapabilityEnvelope; allLive: any[] }) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [pendingUntil, setPendingUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const manifest = envelope.payload;
  const ack = allLive.find((dv) => dv.kind === "context.handoff.ack" && dv.attrs?.handoffRef === pending && dv.meta?.runtimeEnvelope);
  useEffect(() => { setPending(""); setPendingUntil(0); setConfirming(false); setNotice(""); }, [envelope.id]);
  useEffect(() => {
    if (!pendingUntil || ack) return;
    const timer = window.setTimeout(() => { setPending(""); setPendingUntil(0); setNotice("La solicitud venció sin confirmación. Podés volver a consultar; no se ejecutó ninguna acción."); }, Math.max(0, pendingUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pendingUntil, ack]);
  const request = async () => {
    setBusy(true); setNotice("");
    try {
      const session = await requireActiveSessionIdentity();
      if (marketAuthorityTrust.snapshot?.payload.revokedDeviceIds.includes(session.deviceId)) throw new Error("Este dispositivo fue revocado. Abrí tu Identidad Viva desde un dispositivo autorizado.");
      const identity = await runtimeIdentity();
      const mandate = marketAuthorityTrust.snapshot?.payload.mandates.find((item) => item.actorId === identity.actorId && item.status === "active"
        && item.allowedActions.includes("context.handoff") && Date.parse(item.expiresAt) > Date.now());
      if (!mandate) throw new Error("La continuidad estará disponible cuando tu Nodo tenga una autorización vigente. Podés consultar su Perfil Vivo.");
      const handoff = await livingSpaceContinuity.request({ identity: { ...identity, nodeId: mandate.nodeId }, mandateId: mandate.mandateId,
        capability: envelope, confirmed: true, context: { subjectRefs: [envelope.id] }, returnRef: window.location.origin + window.location.pathname });
      setPending(handoff.id); setPendingUntil(Date.parse(handoff.payload.expiresAt)); setConfirming(false); setNotice("Solicitud enviada. Esperando confirmación del Nodo.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No pudimos continuar."); }
    finally { setBusy(false); }
  };
  return <section className="living-capability-details">
    <b>{humanVisibleText(manifest.capability.label, "Puede ayudarte")}</b>
    <p>{manifest.execution.mode === "informational" ? "Información del Nodo" : manifest.execution.mode === "local" ? "Capacidad local del Nodo" : manifest.execution.mode === "remote-authorized" ? "Continuación autorizada en el Nodo" : "Consultá o acordá con el Nodo"} · {manifest.capability.lifecycle.status === "available" ? "Disponible" : "No disponible ahora"}</p>
    {manifest.effects.length ? <p>Sus acciones requieren revisar permisos y confirmar los efectos antes de ejecutarlas.</p> : null}
    {confirming ? <div><p>Compartir la referencia pública de esta capacidad para abrir una continuidad. No incluye tu texto privado ni autoriza compras o acciones.</p><button type="button" disabled={busy} onClick={request}>Confirmar solicitud</button><button type="button" onClick={() => setConfirming(false)}>Cancelar</button></div> : manifest.accepts.handoffPurposes.includes("view") ? <button type="button" disabled={busy || Boolean(pending) || manifest.capability.lifecycle.status !== "available"} onClick={() => setConfirming(true)}>Continuar con este Nodo</button> : <p>Este Nodo no anuncia continuidad remota. Podés consultar su perfil.</p>}
    <p role="status">{ack ? ack.attrs.status === "accepted" ? "El Nodo aceptó el contexto. Las operaciones siguen requiriendo sus permisos." : "El Nodo no aceptó esta continuidad." : notice}</p>
  </section>;
}
