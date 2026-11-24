import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BadgePercent, Compass, Home, Landmark, MapPin, Search, Sparkles, Store, Utensils, Mic } from "lucide-react";
import { useLivingSpaceNavigation, interpretSpaceCommand } from "../utopy/livingSpaceNavigation";
import { useContextualVoice } from "../utopy/useContextualVoice";
import { latestOwnedIntent } from "../utopy/livingSpaceRelevance";
import { useLivingCapabilities } from "../utopy/useLivingCapabilities";
import { humanVisibleText } from "../social/liveNetwork.human";
import "./unifiedLivingMarket.css";
import LivingExplorer from "./LivingExplorer";
import TerritoryHome from './TerritoryHome';
import "./productMotion.css";
import { inspectWithMotion, prefetchProductCheckout } from "./productMotion";
import { rankContextualFeed } from '../utopy/contextualFeed';
import { useCapabilityPresence } from '../utopy/useCapabilityPresence';
import { useCircularAtmosphere } from '../pages/useCircularAtmosphere';

type LivingItem = {
  id: string;
  title: string;
  seller: string;
  sellerNodeId?: string;
  image?: string;
  price?: string;
  previousPrice?: string | null;
  badge?: string | null;
  category?: string;
  financeAvailable?: boolean;
  available?: boolean;
  raw: any;
};

type Props = {
  items: LivingItem[];
  highlights?: ReactNode;
  activityCount?: number;
  actorId?: string;
  allLive?: any[];
  catalogStatus?: string;
  territoryMode?: boolean;
  onValue?:()=>void;
  onChat?:()=>void;
  onProjection?: (projection: "feed" | "orbit" | "map") => void;
  onOpenItem: (item: any) => void;
  onOpenNode: (item: any, seller: string) => void;
  onSearch: () => void;
  onExplore: () => void;
  onExploreFar: () => void;
  onOffers: () => void;
  onCreate: () => void;
  onContext: (context: "store" | "daily" | "skylines" | "capital") => void;
  onTerritory: (mode: "for_me" | "nearby") => void;
};

const quickFilters = ["Todo", "Comprar", "Comer", "Vivir", "Servicios", "Financiar", "Cerca de mí"];

function currentGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

export function isFoodLivingCategory(value: string) {
  return /comida|gastronom|cafeter|caf[eé]|coffee|bebida|restaurante|pizza|daily|alimento|food|dulce|fruta|verdura|panader|pasteler|postre|supermercado/.test(value.toLowerCase());
}

function categoryMatches(item: LivingItem, filter: string) {
  if (filter === "Todo" || filter === "Cerca de mí") return true;
  const category = String(item.category || "").toLowerCase();
  if (filter === "Comprar") return !/alquiler|vivienda|servicio/.test(category) && !isFoodLivingCategory(category);
  if (filter === "Comer") return isFoodLivingCategory(category);
  if (filter === "Vivir") return /alquiler|vivienda|apartamento|inmueble|rental|property|skylines/.test(category);
  if (filter === "Servicios") return /servicio|trabajo|instalación|entrega|delivery|work/.test(category);
  if (filter === "Financiar") return item.financeAvailable === true;
  return true;
}

export default function UnifiedLivingMarket(props: Props) {
  const [selectedAccess, setSelectedAccess] = useState("");
  const openContext = (context: "store" | "daily" | "skylines" | "capital") => {
    setSelectedAccess(context);
    props.onContext(context);
  };
  const [navigation, updateNavigation] = useLivingSpaceNavigation(props.actorId);
  const personalized=navigation.personalized!==false;
  const [zone,setZone]=useState<{actorId:string;lat:number;lng:number}|null>(null);
  const [contextNotice,setContextNotice]=useState('');
  const weatherAllowed=!!zone && zone.actorId===(props.actorId||'') && personalized;
  const atmosphere=useCircularAtmosphere(weatherAllowed?zone!.lat:null,weatherAllowed?zone!.lng:null,weatherAllowed);
  const requestWeather=()=>{
    if(!navigator.geolocation){setContextNotice('Este navegador no permite consultar tu zona. El feed sigue disponible.');return;}
    const actorId=props.actorId||'';
    setContextNotice('Se consultará el clima de una zona aproximada en Open-Meteo, no tu dirección.');
    navigator.geolocation.getCurrentPosition(position=>{setZone({actorId,lat:Number(position.coords.latitude.toFixed(1)),lng:Number(position.coords.longitude.toFixed(1))});setContextNotice('Clima opcional de zona aproximada. Podés desactivarlo cuando quieras.');},()=>setContextNotice('No se autorizó o no se pudo obtener la zona. El feed funciona sin clima.'),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  };
  const allLive = props.allLive || [];
  const presence=useCapabilityPresence(allLive);
  const intention = navigation.exploreAll ? "" : navigation.query || (personalized ? latestOwnedIntent(allLive, props.actorId || "") : "");
  const voice = useContextualVoice((text) => {
    const command = interpretSpaceCommand(text);
    if (command.create) props.onCreate();
    else if (command.projection) { updateNavigation({ projection: command.projection }); props.onProjection?.(command.projection); }
    else updateNavigation({ query: command.query ?? text, exploreAll: false });
  });
  const filter = navigation.homeFilter;
  const setFilter = (homeFilter: string) => updateNavigation({ homeFilter });
  const [greeting, setGreeting] = useState(currentGreeting);
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      setGreeting(currentGreeting());
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() < 12 ? 12 : now.getHours() < 19 ? 19 : 24, 0, 0, 0);
      timer = window.setTimeout(refresh, next.getTime() - now.getTime() + 100);
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const explorerCatalog=useMemo(()=>props.territoryMode?props.items:rankContextualFeed(props.items,{intention,allLive,actorId:props.actorId||'',personalized,exploreAll:navigation.exploreAll,hiddenIds:navigation.hiddenProductIds,weather:atmosphere.observation,presence}).map(entry=>entry.item),[props.items,props.territoryMode,intention,allLive,props.actorId,personalized,navigation.exploreAll,navigation.hiddenProductIds,atmosphere.observation,presence]);
  if(props.territoryMode)return <TerritoryHome items={props.items} allLive={allLive} actorId={props.actorId} catalogStatus={props.catalogStatus} onOpenItem={props.onOpenItem} onOpenNode={props.onOpenNode} onMap={props.onExplore} onCreate={props.onCreate} onValue={props.onValue||props.onExplore} onChat={props.onChat||props.onExplore}/>;
  return <div className="ulm-shell">
    <section className="ulm-hero">
      <div className="ulm-copy">
        <span>MS MARKET · UTOPÝ</span>
        <h1>{greeting}</h1>
        <p>¿Qué necesitás hoy?</p>
      </div>
      <div className="ulm-intention"><Sparkles size={20}/><input aria-label="Tu intención" value={navigation.query} onChange={(event) => updateNavigation({ query: event.target.value.slice(0, 500), exploreAll: false })} placeholder="Escribí, hablá o mostrámelo…"/><button type="button" aria-label="Hablar o escribir en tu espacio vivo" onClick={() => props.onProjection?.("orbit")}><Mic size={20}/></button><button type="button" aria-label="Abrir búsqueda" onClick={props.onSearch}><Search size={21}/></button></div>
      {voice.notice ? <p role="status">{voice.notice}</p> : null}
      <div className="ulm-space-controls"><button type="button" onClick={() => { updateNavigation({ query: "", mode: "all", exploreAll: true, explorerModule: "", explorerCategory: "" }); setFilter("Todo"); }}>Explorar todo</button></div>

    </section>

    {props.highlights}
    <details className="ulm-context-preferences"><summary>Tu feed · preferencias</summary><label><input type="checkbox" checked={personalized} onChange={event=>{updateNavigation({personalized:event.target.checked});if(!event.target.checked)setZone(null);}}/> Recomendaciones según lo que expresé</label><small>La búsqueda que escribís sigue funcionando aunque desactives las recomendaciones. No se infieren datos sensibles.</small>{personalized && <div>{weatherAllowed?<button type="button" onClick={()=>{setZone(null);setContextNotice('Clima desactivado.');}}>Desactivar clima de mi zona</button>:<button type="button" onClick={requestWeather}>Usar clima aproximado · Open-Meteo</button>}</div>}{atmosphere.label&&<small>{atmosphere.label} · Open-Meteo · consulta vigente por hasta 25 min</small>}{contextNotice&&<p role="status">{contextNotice}</p>}{!!navigation.hiddenProductIds?.length&&<button type="button" onClick={()=>updateNavigation({hiddenProductIds:[]})}>Volver a mostrar publicaciones ocultas</button>}</details>
    <LivingExplorer items={explorerCatalog} allLive={allLive} catalogStatus={props.catalogStatus} module={navigation.explorerModule||''} category={navigation.explorerCategory||''} query={navigation.query} onChange={(explorerModule,explorerCategory)=>updateNavigation({explorerModule,explorerCategory})} onOpenNode={(raw,seller)=>Array.isArray(raw?.rooms)?props.onOpenItem(raw):props.onOpenNode(raw,seller)} onOpenItem={raw=>{updateNavigation({selectedRef:String(raw.id||'')});props.onOpenItem(raw);}}/>

    <section className="ulm-finish">
      <button type="button" onClick={props.onExplore}><Compass/>Explorar la red</button>
      <button type="button" onClick={props.onCreate}><Sparkles/>Decir qué necesitás</button>
      <button type="button" onClick={props.onExploreFar}>Explorar más lejos <ArrowRight size={17}/></button>
      {props.activityCount ? <span>{props.activityCount} movimientos recientes</span> : null}
    </section>
  </div>;
}

function LivingRail({ title, subtitle, items, onOpen, explain, onHide, priority = false }: { priority?: boolean; title: string; subtitle: string; items: LivingItem[]; onOpen: (raw: any) => void; explain:(id:string)=>ReturnType<typeof rankContextualFeed>[number]|undefined; onHide:(id:string)=>void }) {
  return <section className="ulm-rail-section">
    <div className="ulm-section-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
    <div className="ulm-card-rail">{items.map((item,index) => <article className="ulm-contextual-item" key={item.id}><button type="button" className="ulm-card" onPointerEnter={prefetchProductCheckout} onFocus={prefetchProductCheckout} onClick={(event) => inspectWithMotion(event.currentTarget, () => onOpen(item.raw))}>
      <div className="ulm-card-media">{item.image ? <img src={item.image} alt={item.title} loading={priority&&index===0?"eager":"lazy"} fetchPriority={priority&&index===0?"high":"auto"} decoding="async"/> : <span>{item.title.slice(0, 1)}</span>}{item.badge ? <em>{item.badge}</em> : null}</div>
      <div className="ulm-card-body"><small>◉ {item.seller}</small><b>{item.title}</b><div>{item.previousPrice ? <del>{item.previousPrice}</del> : null}<strong>{item.price || "Consultar"}</strong></div><span>{item.available === false ? "No disponible" : explain(item.id)?.presence.label || 'Consultar disponibilidad'}</span><span className="ulm-card-action">Ver <ArrowRight size={15}/></span></div>
    </button><details className="ulm-recommendation-reason"><summary>¿Por qué veo esto?</summary><p>{explain(item.id)?.reasons.join(' · ')}</p><button type="button" onClick={()=>onHide(item.id)}>No me interesa · ocultar</button></details></article>)}</div>
  </section>;
}
