import {intentionWords,publicLivingSignals} from './livingSpaceRelevance';
export const MT_INTENTIONS=['Comida','Belleza','Servicios','Hogar','Diseño','Aprender','Energía','Comunidad'] as const;
export const normalizeTerritoryText=(v:any)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function territoryIdOf(raw:any){const a=raw?.attrs||raw||{};return String(a.territoryId||a.territory?.id||(typeof a.territory==='string'?a.territory:'')||'');}
export function mtItemText(item:any){return normalizeTerritoryText([item.title,item.seller,item.category,item.catalogCategory,item.raw?.attrs?.description,item.raw?.description].filter(Boolean).join(' '));}
export function mtIntentionMatches(item:any,intention:string){
 const text=normalizeTerritoryText([item.title,item.category,item.catalogCategory,item.raw?.attrs?.description].filter(Boolean).join(' '));
 const food=/comida|hamburgues|pizza|almuerzo|alimento|cafe|bebida|restaurante|empanada|panader|food/.test(text);
 const beauty=/belleza|masaj|peluquer|barber|corte|skincare|maquill|ceja|facial|beauty/.test(text);
 if(!intention)return true;
 if(intention==='Comida')return food;
 if(intention==='Belleza')return beauty;
 if(intention==='Hogar')return /hogar|vivienda|alquiler|mueble|rental|property|apartamento|carpinter/.test(text);
 if(intention==='Diseño')return /diseno|design|modelado|fabricacion|impresion 3d/.test(text);
 if(intention==='Aprender')return /aprender|learning|curso|educacion|conocimiento|tutoria/.test(text);
 if(intention==='Energía')return /energia|energy|sensor|dispositivo|automatizacion/.test(text);
 if(intention==='Comunidad')return item.viewKind==='capability';
 return item.viewKind==='booking'&&!beauty||/servicio|reparacion|trabajo|service|work/.test(text)&&!food&&!beauty;
}
export function matchTerritoryQuery(item:any,query:string){
 const text=mtItemText(item),words=intentionWords(query);
 const meals=words.some(w=>/^(almorzar|cenar|desayunar|hambre)$/.test(w));
 return (!meals||mtIntentionMatches(item,'Comida'))&&words.filter(w=>!/^(almorzar|cenar|desayunar|hambre)$/.test(w)).every(w=>text.includes(w));
}
export function territorialCapabilities(allLive:any[]){
 return publicLivingSignals(allLive).filter(dv=>dv.attrs?.simulation!==true&&!dv.attrs?.demonstrationSet&&dv.meta?.simulation!==true).map(dv=>{
 const a=dv.attrs||{},nodeId=String(a.nodeId||a.sellerNodeId||dv.meta?.originNode||'');
 return {id:dv.id,title:String(a.title||a.name||a.summary||a.capability||a.intent?.text||'Capacidad publicada'),seller:String(a.nodeName||a.actorName||a.authorName||nodeId||'Perfil público'),sellerNodeId:nodeId,category:String(a.category||a.domain||dv.kind),raw:dv,viewKind:'capability'};
 }).filter(row=>row.sellerNodeId);
}
export function territoryChoices(rows:any[]){const choices=new Map<string,string>();for(const row of rows){const id=territoryIdOf(row.raw);if(id)choices.set(id,String(row.raw?.attrs?.territory?.name||row.raw?.territory?.name||id));}return [...choices].map(([id,label])=>({id,label}));}
