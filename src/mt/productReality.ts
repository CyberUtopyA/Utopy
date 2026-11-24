export type ProductMeasurement={key:string;value:string;unit:string;basis:string;origin:string;evidenceRef?:string};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
export function safeRealityUrl(value:unknown,origin='https://market.utopy.live'){
  const raw=text(value);if(!raw||raw.length>4096)return '';
  try{
    const url=new URL(raw,origin),base=new URL(origin);
    if(url.username||url.password||!['https:','http:'].includes(url.protocol))return '';
    if(url.origin!==base.origin){
      if(url.protocol!=='https:'||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::|\[fc|\[fd|\[fe80)/i.test(url.hostname)||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))return '';
      const match=/^172\.(\d+)\./.exec(url.hostname);if(match&&Number(match[1])>=16&&Number(match[1])<=31)return '';
    }
    if(!/^https?:\/\//i.test(raw)&&(!raw.startsWith('/')||raw.startsWith('//')))return '';
    return url.href;
  }catch{return '';}
}
export function projectProductReality(source:any,origin?:string){
  const raw=source?.raw||source||{},attrs=raw.attrs||{};
  const images=[...new Set([attrs.image,attrs.imageUrl,attrs.imagen,raw.image,...(Array.isArray(attrs.images)?attrs.images:[]),...(Array.isArray(attrs.gallery)?attrs.gallery.map((item:any)=>typeof item==='string'?item:item?.url):[])].map(value=>safeRealityUrl(value,origin)).filter(Boolean))].slice(0,12);
  const candidates=[attrs.videoUrl,attrs.video,raw.videoUrl,attrs.media?.videoUrl,...(Array.isArray(attrs.videos)?attrs.videos:[])];
  const videos=[...new Set(candidates.map(value=>safeRealityUrl(typeof value==='string'?value:value?.url,origin)).filter(value=>value&&/\.(mp4|webm|mov)$/i.test(new URL(value).pathname)))].slice(0,3);
  const modelCandidates=[attrs.glbUrl,attrs.modelUrl,attrs.model?.url,attrs.model?.glb,attrs.artifacts?.glb?.url,attrs.ar?.modelUrl,raw.meta?.ar?.modelUrl,...(Array.isArray(attrs.artifacts)?attrs.artifacts.filter((item:any)=>item?.type==='glb'||item?.kind==='glb').map((item:any)=>item.url):[])];
  const modelUrl=modelCandidates.map(value=>safeRealityUrl(value,origin)).find(value=>value&&/\.glb$/i.test(new URL(value).pathname))||'';
  const measurements:ProductMeasurement[]=[];
  for(const m of (Array.isArray(attrs.measurements)?attrs.measurements:[]).slice(0,20)){
    const value=m?.value;
    if(typeof value!=='number'&&typeof value!=='string')continue;
    if(!/^\d+(?:[.,]\d+)?$/.test(String(value))||!Number.isFinite(Number(String(value).replace(',','.')))||Number(String(value).replace(',','.'))<=0||!['m','cm','mm','kg','g','h','min','m2','m3'].includes(m?.unit))continue;
    const evidence=safeRealityUrl(m.evidenceRef,origin);
    measurements.push({key:text(m.key)||'Medida',value:String(value),unit:m.unit,basis:['medido','estimado','declarado','calculado'].includes(m.basis)?m.basis:'declarado',origin:text(m.origin)||'Publicado por el vendedor',...(evidence?{evidenceRef:evidence}:{})});
  }
  const d=attrs.dimensions;
  if(!measurements.length&&d&&['m','cm','mm'].includes(d.unit))for(const [key,value] of [['Ancho',d.w??d.width],['Alto',d.h??d.height],['Profundidad',d.d??d.depth]] as const){
    if(typeof value==='number'&&Number.isFinite(value)&&value>0)measurements.push({key,value:String(value),unit:d.unit,basis:'declarado',origin:'Publicado por el vendedor'});
  }
  const inventory=attrs.inventory||raw.inventory||{};
  const stock=attrs.stockQty??attrs.stock??inventory.stockQty??inventory.stock??raw.stockQty??raw.stock;
  const hasStock=(typeof stock==='number'||typeof stock==='string'&&stock.trim()!=='')&&Number.isFinite(Number(stock))&&Number(stock)>=0;
  const declared=[attrs.available,inventory.available,raw.available,attrs.inStock,raw.inStock].find(value=>typeof value==='boolean');
  const status=String(attrs.status||inventory.status||raw.status||'').toLowerCase();
  const conflict=hasStock&&typeof declared==='boolean'&&declared!==(Number(stock)>0);
  const availabilityKnown=!conflict&&(hasStock||typeof declared==='boolean'||['out_of_stock','unavailable','deleted'].includes(status));
  return {images,videos,modelUrl,measurements,availabilityKnown,consultationOnly:attrs.status==='quote_only'||attrs.saleEnabled===false||attrs.availabilityStatus==='consult'};
}
