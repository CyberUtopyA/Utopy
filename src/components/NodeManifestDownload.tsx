import {useState} from 'react';
import {businessAccess} from '../utopy/businessWorkspace';
import {mtLiveSnapshot} from '../mt/mt.liveStore';
export default function NodeManifestDownload({entry}:{entry:any}){
 const [notice,setNotice]=useState('');
 return <details><summary>Instalación inicial · avanzado</summary><p>Para conectar este mismo nodo al servidor, descargá su presentación firmada. No contiene claves privadas.</p><button type="button" className="utopy-button" onClick={async()=>{try{const all=mtLiveSnapshot(),context=await businessAccess(entry,all,'node.manifest');if(!context||context.ownerDid!==entry.manifest.meta.ownership.ownerDid)throw Error('Sólo el controlador puede preparar esta conexión.');if(all.find(dv=>dv.id===entry.manifest.id)!==entry.manifest)throw Error('El nodo cambió. Actualizá antes de descargar.');const url=URL.createObjectURL(new Blob([JSON.stringify(entry.manifest,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nodo-manifiesto-firmado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Manifiesto público descargado. Instalalo en la ruta privada configurada en el servidor.');}catch(error:any){setNotice(error.message);}}}>Descargar manifiesto público</button>{notice?<p role="status">{notice}</p>:null}</details>;
}
