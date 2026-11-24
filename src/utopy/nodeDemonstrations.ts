import { buildNodeManifestDV } from '../mt/utopy.nodeManifest';
import { mtLiveSnapshot } from '../mt/mt.liveStore';
import { publishAuthorizedDV } from './authorizedPublish';
import { resolveCurrentIdentityContext } from './identityContext';

// Named nodes are fixtures, not activity categories, trust anchors or production endpoints.
export const NODE_DEMONSTRATIONS = [
  {id:'utopy.node.demo.don-mencia',slug:'demo-don-mencia',name:'Don Mencia',configuration:'don-mencia',purpose:'Agricultura, hortalizas y empanadas'},
  {id:'utopy.node.demo.encicar',slug:'demo-encicar',name:'Encicar',configuration:'encicar',purpose:'Diagnósticos, presupuestos y reparaciones'},
  {id:'utopy.node.demo.rene',slug:'demo-rene',name:'Minimercado René',configuration:'rene',purpose:'Catálogo, inventario, ventas y delivery'},
  {id:'utopy.node.demo.celulares',slug:'demo-celulares',name:'Servicio técnico de celulares',configuration:'celulares',purpose:'Diagnóstico, aprobación y retiro'},
  {id:'utopy.node.demo.peluqueria',slug:'demo-peluqueria',name:'Peluquería',configuration:'peluqueria',purpose:'Servicios, agenda y reservas'},
  {id:'utopy.node.demo.hamburgueseria',slug:'demo-hamburgueseria',name:'Hamburguesería',configuration:'hamburgueseria',purpose:'Menú, pedidos, cocina y delivery'},
  {id:'utopy.node.falcon.delivery',slug:'demo-falcon-delivery',name:'Falcon Delivery',configuration:null,purpose:'Coordinación voluntaria de entregas entre nodos'},
] as const;

export function demonstrationManifest(item: typeof NODE_DEMONSTRATIONS[number]) {
  return buildNodeManifestDV({nodeId:item.id,nodeName:item.name,capabilities:[],endpoints:{},ttlMs:30*86400000,
    extraAttrs:{slug:item.slug,status:'setup',setupOnly:true,simulation:true,nonTradable:true,
      demonstrationSet:'utopy.initial-nodes/1',businessConfiguration:item.configuration,
      workspaceIntent:item.purpose,workspaceModules:['coordination'],productionReady:false}});
}

/** User-initiated, local-only preparation. Never overwrite a claimed/foreign/existing node. */
export async function installNodeDemonstrations(consent: boolean) {
  if (!consent) throw Error('Confirmá que querés preparar demostraciones locales.');
  const context=await resolveCurrentIdentityContext({allLive:mtLiveSnapshot()});
  if(context.wallet.custody!=='device')throw Error('Necesitás una identidad persistente para guardar los nodos.');
  const created:string[]=[];
  const skipped:string[]=[];
  for(const item of NODE_DEMONSTRATIONS){
    const allLive=mtLiveSnapshot();
    if(allLive.some(dv=>/node\.manifest$/.test(dv.kind)&&[dv.attrs?.nodeId,dv.attrs?.node?.id].includes(item.id))){skipped.push(item.name);continue;}
    await publishAuthorizedDV({dv:demonstrationManifest(item),allLive,actingAsNodeId:item.id,requiredAuthority:item.id,
      allowNodeBootstrap:true,localOnly:true});
    created.push(item.name);
  }
  return {created,skipped};
}
