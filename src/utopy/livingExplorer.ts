export const explorerModules=['Comer','Comprar','Vivir','Servicios','Financiar'] as const;
export type ExplorerModule=typeof explorerModules[number];
const normalize=(value:any)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function explorerModuleMatches(item:any,module:string){
 const content=normalize([item.category,item.raw?.kind,...(item.raw?.traits||[])].join(' '));
 const food=/comida|gastronom|cafeter|cafe|coffee|bebida|restaurante|pizza|alimento|food|dulce|fruta|verdura|panader|pasteler|postre/.test(content);
 const housing=/alquiler|vivienda|apartamento|inmueble|rental|property/.test(content);
 const service=/servicio|trabajo|instalacion|entrega|delivery|work|service|reparacion|peluquer/.test(content);
 return module==='Comer'?food:module==='Vivir'?housing:module==='Servicios'?service:module==='Financiar'?item.financeAvailable===true:module==='Comprar'?!food&&!housing&&!service:false;
}
export function explorerCategory(item:any){
 const raw=item.raw||{},a=raw.attrs||{},m=raw.meta||{};
 const value=item.catalogCategory||a.category||a.categoria||raw.categoria||m.category||m.cat;
 return typeof value==='string'?value.trim():'';
}
export function explorerItems(items:any[],module:string,category='',query=''){
 const seen=new Set<string>();const search=normalize(query).trim();
 return items.filter(item=>{
  if(!item.id||seen.has(item.id)||!explorerModuleMatches(item,module)||category&&category!=='__all__'&&explorerCategory(item)!==category)return false;
  if(search&&!normalize([item.title,item.seller,item.category].join(' ')).includes(search))return false;
  seen.add(item.id);return true;
 });
}
export function explorerNodes(items:any[],allLive:any[]){
 const groups=new Map<string,any>();
 for(const item of items){
  const key=String(item.sellerNodeId||item.raw?.attrs?.sellerNodeId||item.raw?.sellerNodeId||'').trim();if(!key)continue;
  if(groups.has(key)){groups.get(key).items.push(item);continue;}
  const manifest=allLive.find(dv=>/node\.manifest$/.test(String(dv.kind))&&(dv.meta?.scopes||[]).includes('public')&&String(dv.attrs?.nodeId||dv.attrs?.node?.id||dv.id)===key);
  const a=manifest?.attrs||{};const logo=a.presentation?.logo||a.logo||a.logoUrl||a.node?.logo||'';
  const safe=typeof logo==='string'&&(/^(https:\/\/|\/[^/])/.test(logo))?logo:'';
  groups.set(key,{key,name:item.seller,logo:safe,items:[item]});
 }return [...groups.values()];
}
