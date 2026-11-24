import React, { useEffect, useMemo, useState } from "react";
import { adaptCommercialDocument } from "../commercial/commercialDocument.adapters";
import { fiscalClientConfigured, fiscalRequest } from "./fiscalClient";
import { projectFiscalOutcome } from "./fiscalProjection";
import type { FiscalOutcome } from "./fiscalOutcome";
import { canonicalCommercial } from "../commercial/commercialDocument";

export default function CommercialDocumentPanel({ source }: { source: any }) {
  const adapted = useMemo(() => adaptCommercialDocument(source), [source]);
  const [outcome, setOutcome] = useState<FiscalOutcome | null>(null);
  const [verifiedSnapshot, setVerifiedSnapshot] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const document = adapted?.document;
  const missingFields = adapted?.missingFields || [];
  const snapshot = document ? canonicalCommercial(document) : "";
  const matches = Boolean(document && outcome?.documentHash && outcome.commercialDocumentId === document.documentId && outcome.revision === document.revision && verifiedSnapshot === snapshot);
  const projection = projectFiscalOutcome(matches ? outcome : null, Boolean(matches));
  useEffect(() => {
    if (!document || !fiscalClientConfigured() || missingFields.length) return;
    let active = true;
    // One authenticated read on opening; no polling and never an automatic issue.
    void fiscalRequest("document.status", document.issuerNodeId, document).then(result => {
      if (active) { setVerifiedSnapshot(snapshot); setOutcome(result); }
    }).catch(() => {});
    return () => { active = false; };
  }, [document?.documentId, document?.revision, document?.issuerNodeId, snapshot, missingFields.length]);
  const steps = ["Borrador", "Enviado", "Procesando", "Aceptado"];
  const activeStep = !matches || outcome?.state === "DRAFT" ? 0
    : outcome?.state === "GENERATED" || outcome?.state === "SIGNED" || outcome?.state === "SENT" ? 1
    : outcome?.state === "ACCEPTED" ? 3 : 2;
  if (!document) return null;
  async function act(action: "document.save" | "document.status" | "document.submit" | "document.kude" | "document.preview") {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      if (action === "document.submit") await fiscalRequest("document.save", document.issuerNodeId, document);
      const result = await fiscalRequest(action, document.issuerNodeId, document);
      setVerifiedSnapshot(canonicalCommercial(document)); setOutcome(result);
      if (result.archiveWarning) setNotice(result.archiveWarning);
      if (result.download?.mimeType === "application/pdf") {
        const bytes = Uint8Array.from(atob(result.download.base64), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const link = window.document.createElement("a"); link.href = url; link.download = "kude-test.pdf";
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    catch (e: any) { setNotice(e.message || "No se pudo consultar el documento."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
    <strong>Documento comercial</strong>
    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Modo de pruebas SIFEN. Los documentos no tienen valor fiscal real.</p>
    <p className="text-sm text-slate-500">{projection.label}. El estado del pago se conserva por separado.</p>
    <div className="flex flex-wrap gap-1.5" aria-label="Estado del documento fiscal">
      {steps.map((step, index) => <span key={step} className={`rounded-full px-3 py-1 text-xs ${index === activeStep ? "bg-slate-950 font-bold text-white" : index < activeStep ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-500"}`}>{step}</span>)}
      {matches && outcome?.state === "REJECTED" && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Rechazado</span>}
    </div>
    {document.lines.map(line => <div key={line.lineId} className="flex justify-between gap-3 text-sm"><span>{line.description}</span><span>{line.total} {document.currency}</span></div>)}
    {missingFields.length > 0 && <p className="text-sm text-amber-800">El documento de origen está incompleto. Faltan: {missingFields.join(", ")}.</p>}
    {fiscalClientConfigured() ? <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || missingFields.length > 0} onClick={() => act("document.save")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Guardar documento privado</button>
      <button type="button" disabled={busy} onClick={() => act("document.status")} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Consultar estado fiscal</button>
      <button type="button" disabled={busy || missingFields.length > 0 || Boolean(matches && outcome?.state !== "DRAFT")} onClick={() => act("document.submit")} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Emitir electrónicamente · TEST</button>
      {projection.canViewKude && <button type="button" disabled={busy} onClick={() => act("document.kude")} className="rounded-full border px-4 py-2 text-sm font-bold">Descargar KuDE</button>}
      {matches && ["SIGNED", "SENT", "PROCESSING", "UNKNOWN"].includes(outcome!.state) && <button type="button" disabled={busy} onClick={() => act("document.preview")} className="rounded-full border px-4 py-2 text-sm">Ver borrador sin validez fiscal</button>}
    </div> : <p className="text-sm text-slate-500">Facturación electrónica no configurada. Este documento no es una factura electrónica aceptada.</p>}
    {matches && outcome?.cdc && <p className="break-all text-xs text-slate-500">CDC: {outcome.cdc}</p>}
    {matches && outcome?.state === "REJECTED" && <p role="alert" className="text-sm text-amber-900">Revisá el documento con tu responsable fiscal. Código de respuesta: {outcome.resultCode || "No informado"}. El pago no fue modificado.</p>}
    {notice && <p role="status" className="text-sm text-amber-800">{notice}</p>}
  </section>;
}
