import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export async function uploadConversationReferences(files: File[], options?: { upload: (file: File, dataUrl: string) => Promise<{url:string}> }) {
  const attachments = [];
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type) || file.size > 8 * 1024 * 1024) throw Error("Usá fotos JPG, PNG, WebP o GIF de hasta 8 MB.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(Error("No se pudo leer la foto."));
      reader.onerror = () => reject(Error("No se pudo leer la foto."));
      reader.readAsDataURL(file);
    });
    let result: {url:string}|null=null;
    if(options){result=await options.upload(file,dataUrl);}
    else{const response = await fetch("https://market.utopy.live/media/upload.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, name: file.name, mime: file.type }) });if(response.ok)result=await response.json().catch(()=>null);}
    if (typeof result?.url !== "string" || !/^https:\/\//i.test(result.url)) throw Error("No se pudo guardar la foto. Podés reintentar sin perder tu mensaje.");
    attachments.push({ url: result.url, name: file.name, mime: file.type, purpose: "design.reference" });
  }
  return attachments;
}

/** Photo control only: messages continue through the existing authorized thread publisher. */
export default function ConversationReferences({ files, onChange, disabled = false }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  return <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={disabled} onChange={event => { onChange([...files, ...Array.from(event.target.files || [])].slice(0, 6)); event.target.value = ""; }} />
    <button type="button" disabled={disabled || files.length >= 6} onClick={() => input.current?.click()} style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 7, border: "1px solid #e5e2ef", borderRadius: 14, background: "#faf9ff", color: "#51456f", padding: "10px 14px", cursor: "pointer" }}><ImagePlus size={17}/>Fotos de referencia</button>
    {files.length ? <><div style={{ display: "flex", gap: 8, overflowX: "auto", padding: 2 }}>{previews.map((url, index) => <div key={url} style={{ position: "relative", flexShrink: 0 }}><img src={url} alt={files[index].name} style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 14 }}/><button type="button" aria-label={`Quitar foto ${index + 1}`} disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))} style={{ position: "absolute", top: 3, right: 3, border: 0, borderRadius: "50%", background: "white", padding: 3 }}><X size={14}/></button></div>)}</div><small style={{ color: "#777186" }}>Se comparten por enlace en este hilo. Evitá documentos y datos privados.</small></> : null}
  </div>;
}
