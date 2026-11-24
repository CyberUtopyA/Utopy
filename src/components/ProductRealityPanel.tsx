import React,{useEffect,useState} from 'react';
import {projectProductReality} from '../mt/productReality';
import './productReality.css';

const labelOf=(key:string)=>({length:'Largo',width:'Ancho',thickness:'Espesor'} as Record<string,string>)[key]||key;
export default function ProductRealityPanel({source}:{source:any}){
  const reality=projectProductReality(source,typeof window==='undefined'?undefined:window.location.origin);
  const [modelOpen,setModelOpen]=useState(false),[viewerReady,setViewerReady]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{setModelOpen(false);setViewerReady(false);setNotice('');},[source?.id]);
  useEffect(()=>{
    if(!modelOpen)return;let active=true;
    void import('@google/model-viewer').then(()=>{if(active)setViewerReady(true);}).catch(()=>{if(active)setNotice('No se pudo cargar el visor. La ficha y las medidas siguen disponibles.');});
    return()=>{active=false;};
  },[modelOpen]);
  if(!reality.measurements.length&&!reality.videos.length&&!reality.modelUrl&&reality.images.length<2)return null;
  return <section className="utopy-product-reality" aria-label="Medidas y material visual del producto">
    {reality.measurements.length>0&&<details open><summary>Medidas publicadas</summary><dl>{reality.measurements.map((m,index)=><div key={`${m.key}:${index}`}><dt>{labelOf(m.key)}</dt><dd>{m.value} {m.unit.replace('m2','m²').replace('m3','m³')}<small>{m.basis==='estimado'?'Estimada':m.basis==='calculado'?'Calculada':m.basis==='medido'?'Medida según el vendedor':'Declarada por el vendedor'}</small>{m.evidenceRef&&<a href={m.evidenceRef} rel="noopener noreferrer" target="_blank">Ver evidencia</a>}</dd></div>)}</dl><p>Una declaración o una foto no equivalen a una medición independiente.</p></details>}
    {reality.images.length>1&&<details><summary>Más fotografías del vendedor</summary><div className="utopy-reality-photos">{reality.images.slice(1).map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} loading="lazy" alt="Otra fotografía publicada por el vendedor"/></a>)}</div></details>}
    {reality.videos.length>0&&<details><summary>Ver video del producto</summary>{reality.videos.map(url=><video key={url} src={url} controls playsInline preload="none" onError={()=>setNotice('Este video no pudo reproducirse en tu dispositivo.')}/>)}<p>Material aportado por el vendedor; no generado por UTOPY.</p></details>}
    {reality.modelUrl&&<><button type="button" className="utopy-reality-open" aria-expanded={modelOpen} onClick={()=>setModelOpen(value=>!value)}>{modelOpen?'Cerrar vista espacial':'Explorar en 3D / AR'}</button>{modelOpen&&<div className="utopy-reality-model">{viewerReady?React.createElement('model-viewer',{src:reality.modelUrl,ar:true,'ar-modes':'webxr scene-viewer quick-look','camera-controls':true,'ar-scale':'fixed',alt:'Modelo 3D publicado por el vendedor',onError:()=>setNotice('El modelo no pudo cargarse. Consultá el archivo al vendedor.'),style:{width:'100%',height:'min(50dvh,360px)'}}):<p role="status">Preparando visor…</p>}<p>AR depende del dispositivo y del archivo publicado. El modelo no certifica medidas ni escala física.</p></div>}</>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
