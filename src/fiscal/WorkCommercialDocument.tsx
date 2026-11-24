import React, { useMemo, useState } from "react";
import CommercialDocumentPanel from "./CommercialDocumentPanel";
import type { CommercialDocument } from "../commercial/commercialDocument";

export default function WorkCommercialDocument({ workId, issuerNodeId, source }: { workId: string; issuerNodeId: string; source: any }) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [buyerRef, setBuyerRef] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [lines, setLines] = useState([{ description: "", total: "", type: "service" }]);
  const [document, setDocument] = useState<CommercialDocument | null>(null);
  // Integer PYG drafts are exact; other currencies require the existing source snapshot/adapter.
  const valid = currency === "PYG" && issuedAt && buyerRef.trim() && taxRate && paymentMethod && unitCode && lines.every(l => l.description.trim() && /^\d{1,15}$/.test(l.total));
  const sourceDV = useMemo(() => document ? { id: document.documentId, kind: "commercial.document", attrs: { document } } : null, [document]);
  function prepare() {
    if (!valid) return;
    setDocument({ documentId: `commercial:work:${workId}`, revision: 1, issuerNodeId, authority: issuerNodeId,
      issuedAt: new Date(issuedAt).toISOString(), currency, lines: lines.map((l, i) => ({ lineId: `line:${i}`, type: l.type as any,
        description: l.description.trim(), quantity: "1", unitPrice: l.total, total: l.total,
        unitCode, tax: { affectation: "1", proportion: "100", rate: taxRate } })),
      buyerRef: buyerRef.trim(), commercialCondition: { type: "cash", paymentMethod },
      totals: { total: lines.reduce((sum, l) => sum + BigInt(l.total), 0n).toString() }, workId,
      sourceRefs: source?.id ? [{ id: source.id, kind: source.kind }] : [], paymentRefs: [] });
  }
  return <div className="mt-2 grid gap-2">
    <button type="button" onClick={() => setOpen(!open)} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">{open ? "Cerrar documento" : "Crear documento"}</button>
    {open && !document && <div className="grid gap-2 rounded-xl border bg-white p-3 text-sm">
      <p>Prepará el documento del trabajo. No emite una factura ni registra otro pago.</p>
      <label>Fecha<input aria-label="Fecha del documento" type="datetime-local" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} className="w-full rounded border p-2" /></label>
      <label>Referencia privada del receptor<input value={buyerRef} onChange={e => setBuyerRef(e.target.value)} placeholder="Referencia configurada en el servicio fiscal, no CI/RUC" className="w-full rounded border p-2" /></label>
      <label>Tratamiento tributario de estos conceptos<select value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full rounded border p-2"><option value="">Elegí el IVA aplicable</option><option value="5">Gravado 5% · proporción 100%</option><option value="10">Gravado 10% · proporción 100%</option></select></label>
      <label>Unidad de medida<select value={unitCode} onChange={e => setUnitCode(e.target.value)} className="w-full rounded border p-2"><option value="">Elegí la unidad</option><option value="77">Unidad</option></select></label>
      <label>Forma de pago del documento al contado<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded border p-2"><option value="">Elegí la forma declarada</option><option value="1">Efectivo</option><option value="9">Transferencia</option></select></label>
      <label>Moneda<select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded border p-2"><option value="">Elegí la moneda</option><option value="PYG">PYG · Guaraníes</option></select></label>
      {lines.map((line, i) => <div className="grid gap-2 rounded border p-2" key={i}>
        <select aria-label="Tipo de concepto" value={line.type} onChange={e => setLines(ls => ls.map((l, index) => index === i ? { ...l, type: e.target.value } : l))}>
          <option value="service">Servicio</option><option value="labor">Mano de obra</option><option value="material">Material</option><option value="product">Producto</option><option value="transport">Transporte</option><option value="other">Otro</option>
        </select>
        <input aria-label="Descripción del concepto" placeholder="Concepto" value={line.description} onChange={e => setLines(ls => ls.map((l, index) => index === i ? { ...l, description: e.target.value } : l))} className="rounded border p-2" />
        <input aria-label="Importe del concepto en guaraníes" inputMode="numeric" placeholder="Importe PYG" value={line.total} onChange={e => setLines(ls => ls.map((l, index) => index === i ? { ...l, total: e.target.value } : l))} className="rounded border p-2" />
      </div>)}
      <button type="button" onClick={() => setLines(ls => [...ls, { description: "", total: "", type: "material" }])}>＋ Añadir concepto</button>
      <button type="button" disabled={!valid} onClick={prepare} className="rounded-full bg-slate-950 p-2 font-bold text-white disabled:opacity-40">Revisar documento</button>
    </div>}
    {open && sourceDV && <CommercialDocumentPanel source={sourceDV} />}
  </div>;
}
