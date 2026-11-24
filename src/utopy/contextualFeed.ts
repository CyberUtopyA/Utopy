import { rankLivingItems, intentionWords } from './livingSpaceRelevance';
import type { CapabilityPresence } from './capabilityPresence';
type Item={id:string;title:string;category?:string;sellerNodeId?:string;available?:boolean;raw:any};
export type FeedWeather={temperature:number;code:number;updatedAt:number;expiresAt:number;source:string};
type Input={intention:string;allLive:any[];actorId:string;personalized:boolean;exploreAll?:boolean;hiddenIds?:string[];weather?:FeedWeather|null;presence:(nodeId:string)=>CapabilityPresence;now?:number};
export function rankContextualFeed<T extends Item>(items:T[],input:Input):Array<{item:T;reasons:string[];presence:CapabilityPresence}> {
  const now=input.now??Date.now();
  const hidden=new Set(input.hiddenIds||[]);
  const source=rankLivingItems(items.filter(item=>!hidden.has(item.id)),{intention:input.intention,allLive:input.personalized?input.allLive:[],actorId:input.personalized?input.actorId:'',exploreAll:input.exploreAll});
  const weather=input.weather;
  const climate=input.personalized && weather && weather.source.startsWith('https://') && Number.isFinite(weather.updatedAt) && weather.updatedAt<=now+5000 && weather.expiresAt>now && weather.expiresAt-weather.updatedAt<=25*60_000 && Number.isFinite(weather.temperature)?weather:null;
  const candidates=source.map((item,index)=>{
    const state=input.presence(item.sellerNodeId||'');
    const words=intentionWords(`${item.title} ${item.category||''} ${item.raw?.attrs?.description||''}`).join(' ');
    const reasons:string[]=[];
    let score=intentionWords(input.intention).filter(word=>words.includes(word)).length*100-index*.01;
    if(input.intention)reasons.push('Coincide con lo que expresaste');
    if(input.personalized && !input.exploreAll){
      if(climate && climate.temperature<=18 && /cafe|coffee|caliente|sopa|abrigo/.test(words)){score+=2;reasons.push('Para un día fresco · clima aproximado');}
      if(climate && climate.temperature>=28 && /helado|jugo|fri[oa]|refresc/.test(words)){score+=2;reasons.push('Para un día caluroso · clima aproximado');}
      if(state.status==='available'){score+=1;reasons.push('El comercio anunció que está atendiendo');}
    }
    if(!reasons.length)reasons.push('Publicación del catálogo · sin inferencias personales');
    return {item,reasons,presence:state,score,index};
  });
  // Stable, bounded exposure penalty. No sensitive attributes, random rotation or paid ranking.
  const result:typeof candidates=[];
  const shown=new Map<string,number>();
  while(candidates.length && result.length<80){
    candidates.sort((a,b)=> (b.score-(shown.get(b.item.sellerNodeId||b.item.id)||0)*3)-(a.score-(shown.get(a.item.sellerNodeId||a.item.id)||0)*3)||a.index-b.index);
    const next=candidates.shift()!;result.push(next);
    const seller=next.item.sellerNodeId||next.item.id;shown.set(seller,(shown.get(seller)||0)+1);
  }
  return result.map(({item,reasons,presence})=>({item,reasons,presence}));
}
