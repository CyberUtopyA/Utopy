import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { readPrivateContractByCapability, readPrivateContractById, createTemporaryContractCapability, type PrivateContract } from "../mt/contract.private";
import { formatRentalMoney } from "../utils/rentalProperty";

export default function PrivateContractPage({ capability = false }: { capability?: boolean }) {
  const { contractId = "", token = "" } = useParams();
  const [record, setRecord] = useState<PrivateContract | null>(null);
  const [error, setError] = useState("");
  const [downloadBusy,setDownloadBusy]=useState(false);
  const [downloadError,setDownloadError]=useState('');
  const download=async()=>{if(!record||downloadBusy)return;setDownloadBusy(true);setDownloadError('');try{const current=capability?await readPrivateContractByCapability(token):await readPrivateContractById(contractId);const url=capability?`${window.location.origin}/contratos/acceso/${encodeURIComponent(token)}`:(await createTemporaryContractCapability(current.contractId)).url;const {generateContractPDFFromDraftWithQR}=await import('../utils/contrato');await generateContractPDFFromDraftWithQR(current.document,url);}catch(cause:any){setDownloadError(cause?.message||'No se pudo descargar el documento.');}finally{setDownloadBusy(false);}};
  useEffect(() => { const task = capability ? readPrivateContractByCapability(token) : readPrivateContractById(contractId); void task.then(setRecord).catch((value) => setError(value?.message || "Acceso denegado.")); }, [capability, contractId, token]);
  if (error) return <main className="grid min-h-[70vh] place-items-center p-5"><div className="max-w-md rounded-[28px] bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-rose-500"/><h1 className="mt-4 text-xl font-black">Contrato privado</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  if (!record) return <main className="grid min-h-[70vh] place-items-center text-sm font-bold text-slate-500">Verificando identidad e integridad…</main>;
  const doc = record.document || {};
  return <main className="mx-auto max-w-4xl p-3 py-8"><article className="rounded-[30px] border border-white bg-white p-6 shadow-[0_24px_90px_rgba(15,23,42,.14)] sm:p-10">
    <div className="flex items-center justify-between gap-4 border-b pb-5"><div><span className="text-xs font-black uppercase tracking-widest text-cyan-700">Contrato vivo privado</span><h1 className="mt-1 text-2xl font-black">Contrato de locación</h1></div><ShieldCheck className="text-emerald-500"/></div>
    <section className="mt-7 grid gap-5 sm:grid-cols-2"><div><small className="font-black text-slate-400">LOCADOR</small><h2 className="mt-1 font-black">{doc.arrendador?.nombreCompleto}</h2><p className="text-sm text-slate-600">{doc.arrendador?.domicilio}</p></div><div><small className="font-black text-slate-400">LOCATARIO</small><h2 className="mt-1 font-black">{doc.arrendatario?.nombreCompleto}</h2><p className="text-sm text-slate-600">{doc.arrendatario?.domicilio}</p></div></section>
    <section className="mt-7 rounded-[22px] bg-slate-50 p-5"><h2 className="font-black">{doc.property?.name || doc.inmueble?.nombre || "Inmueble"}</h2><p className="mt-1 text-sm text-slate-500">Unidad {doc.property?.roomId || record.roomId} · {doc.inmueble?.direccion}</p><strong className="mt-4 block text-xl">{formatRentalMoney(doc.contrato?.canon, doc.contrato?.moneda)}</strong></section>
    <div className="mt-6 grid gap-3 text-sm text-slate-600"><p><b>Estado:</b> {record.state.replaceAll("_", " ")}</p><p><b>Versión:</b> {record.version}</p><p><b>Integridad:</b> {record.integrityHash.slice(0, 16)}… verificada</p></div>
    <button type="button" disabled={downloadBusy} onClick={()=>void download()} className="mt-7 min-h-12 rounded-2xl bg-slate-950 px-6 font-black text-white">{downloadBusy?'Preparando PDF…':'Descargar contrato completo'}</button>
    {downloadError?<p role="alert">{downloadError}</p>:null}
    <p className="mt-4 text-sm text-slate-600">Se conserva en este navegador y con esta identidad. Guardá también el PDF descargado. Para proponer una renovación, entrá en Mis contratos; requiere acuerdo de ambas partes.</p><a href="/mis-contratos" className="mt-4 block underline">Mis contratos y renovaciones</a>
  </article></main>;
}
