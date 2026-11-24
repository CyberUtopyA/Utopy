import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Upload,X} from 'lucide-react';
import {uploadConversationReferences} from '../components/ConversationReferences';
import {compressImageFile} from '../media/imageCompression';
import {businessAccess} from '../utopy/businessWorkspace';
import {mtLiveSnapshot} from '../mt/mt.liveStore';
import {bookingRequest} from './client';
export default function BookingPhotoPicker({entry,endpoint,onUploaded,label='Elegir de mi galería'}:{entry:any;endpoint:string;onUploaded:(url:string)=>void;label?:string}){
 const input=useRef<HTMLInputElement>(null),revision=useRef(0),busyRef=useRef(false);
 const latestUploaded=useRef(onUploaded);latestUploaded.current=onUploaded;
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{revision.current++;busyRef.current=false;setBusy(false);setFile(null);setConsent(false);setNotice('');return()=>{revision.current++;};},[entry.nodeId,endpoint]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const upload=async()=>{
  if(!file||!consent||busyRef.current)return;busyRef.current=true;setBusy(true);setNotice('');const current=revision.current;
  try{
   if(!await businessAccess(entry,mtLiveSnapshot(),'booking.configure'))throw Error('Tu identidad no tiene permiso para editar fotos de este nodo.');
   if(!endpoint)throw Error('Conectá el servidor del nodo para guardar fotos.');
   const prepared=await compressImageFile(file,{maxWidth:1600,maxHeight:1600,quality:.82,mimeType:'image/jpeg'});
   if(prepared.file.size>768*1024)throw Error('La foto sigue siendo muy grande. Elegí una más liviana.');
   const attachments=await uploadConversationReferences([prepared.file],{upload:async(photo,dataUrl)=>{
    if(current!==revision.current||!await businessAccess(entry,mtLiveSnapshot(),'booking.configure'))throw Error('El acceso cambió. Volvé a elegir la foto.');
    return bookingRequest(endpoint,entry.nodeId,'media.upload',{dataUrl,mime:photo.type,publicationConsent:true},true);
   }});
   if(current===revision.current&&await businessAccess(entry,mtLiveSnapshot(),'booking.configure')){latestUploaded.current(attachments[0].url);setFile(null);setConsent(false);setNotice('Foto subida. Guardá la configuración para mostrarla en el servicio.');}
  }catch(error:any){if(current===revision.current)setNotice(error.message||'No pudimos subir la foto.');}
  finally{if(current===revision.current){busyRef.current=false;setBusy(false);}}
 };
 return <div className="lb-photo-picker"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const next=e.target.files?.[0];e.target.value='';setNotice('');setConsent(false);if(!next)return;if(!/^image\/(jpeg|png|webp)$/.test(next.type)||next.size>12*1024*1024){setNotice('Elegí una foto JPG, PNG o WebP de hasta 12 MB.');return;}setFile(next);}}/><button type="button" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={18}/>{label}</button>{preview?<><img src={preview} alt="Vista previa de la foto elegida"/><button type="button" disabled={busy} aria-label="Quitar foto elegida" onClick={()=>{setFile(null);setConsent(false);}}><X size={16}/>Quitar selección</button><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> Tengo permiso para publicar esta foto. No contiene documentos ni datos privados.</label><button type="button" disabled={busy||!consent||!endpoint} onClick={()=>void upload()}><Upload size={17}/>{busy?'Subiendo…':'Subir foto'}</button></>:null}{notice?<p role="status">{notice}</p>:null}<small>La selección es local hasta tocar «Subir foto». Se optimiza una copia; el original de tu galería no cambia.</small></div>;
}
