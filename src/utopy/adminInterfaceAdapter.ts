import { LocalCapabilitySandbox, createEnvelope, projectLivingInterface, interfaceCompositionInput, LivingCompositionSDK, signEnvelope, simulateComposition, type LivingInterfaceProjection, type LivingInterfaceSurface, type JsonValue, type LivingEnvelope } from 'utopy';
import { businessAccess, belongsToBusiness, BUSINESS_CONFIGURATIONS, type BusinessEntry } from './businessWorkspace';
import { runtimeIdentity } from './MarketRuntimeAdapter';
import { publishAuthorizedDV, verifyAuthorizedDV } from './authorizedPublish';
import { mtLiveSnapshot } from '../mt/mt.liveStore';

// Native, read-only handlers over already authorized records. No business action is invented.
export const ADMIN_READERS = [
  {key:'catalog',label:'Ver mi catálogo',expressions:['ver catálogo','ver catalogo','mis productos'],kinds:/^(mt:producto|producto|market.product)$/},
  {key:'orders',label:'Ver mis pedidos',expressions:['ver pedidos','mis pedidos'],kinds:/^market\.order/},
  {key:'progress',label:'Ver trabajos y progreso',expressions:['ver trabajos','ver progreso','mis trabajos'],kinds:/^work\.|^delivery\./},
  {key:'diagnosis',label:'Consultar diagnósticos',expressions:['ver diagnósticos','ver diagnosticos'],kinds:/diagnosis|diagnostic/},
  {key:'quote',label:'Ver presupuestos',expressions:['ver presupuestos','mis presupuestos'],kinds:/^work\.quote/},
  {key:'agenda',label:'Consultar agenda',expressions:['ver agenda','mis turnos'],kinds:/^booking\.|^appointment\.|^schedule\./},
  {key:'charge',label:'Consultar cobros',expressions:['ver cobros','mis cobros'],kinds:/^pay\.|^payment\.|^mt:charge/},
  {key:'evidence',label:'Ver comprobantes',expressions:['ver comprobantes','ver evidencias'],kinds:/proof|receipt|evidence/},
  {key:'outcome',label:'Ver resultados',expressions:['ver resultados','mis resultados'],kinds:/outcome|result/},
] as const;
export function adminRecordTitle(dv: any) {
  return String(dv?.attrs?.title || dv?.attrs?.name || dv?.attrs?.description || dv?.attrs?.summary || 'Registro de tu negocio').slice(0,180);
}
export function queryAdminRecords(records: any[], capability: string, inputs: Record<string,JsonValue> = {}, nodeId?: string) {
  const reader=ADMIN_READERS.find(item=>`utopy.admin.${item.key}.read`===capability);
  if (!reader || !nodeId) return [];
  const query=String(inputs.query || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return records.filter(dv=>belongsToBusiness(dv,nodeId) && reader.kinds.test(dv.kind) && (!query || adminRecordTitle(dv).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))).slice(0,100);
}
export function activeAdminTools(entry: BusinessEntry, records: any[]) {
  const preferred: readonly string[]=entry.configuration ? BUSINESS_CONFIGURATIONS[entry.configuration].adminTools : ['catalog','orders','progress'];
  return ADMIN_READERS.filter(reader=>preferred.includes(reader.key) || records.some(dv=>belongsToBusiness(dv,entry.nodeId) && reader.kinds.test(dv.kind)))
    .sort((a,b)=>(preferred.includes(a.key)?preferred.indexOf(a.key):999)-(preferred.includes(b.key)?preferred.indexOf(b.key):999)).map(reader=>reader.key);
}
export function adminReaderHost(records: any[], assertAccess: () => Promise<boolean>, nodeId: string, enabled: readonly string[]=ADMIN_READERS.map(reader=>reader.key)) {
  const sandbox=new LocalCapabilitySandbox();
  const surfaces: LivingInterfaceSurface[]=[];
  for (const key of new Set(enabled)) {
    const reader=ADMIN_READERS.find(item=>item.key===key);
    if (!reader) continue;
    const code=`utopy.admin.${reader.key}.read`;
    sandbox.register({code,inputs:['query'],inputSchemas:{query:{type:'string',required:false,maxLength:120}},outputs:['recordRefs'],effects:[],permissions:['node.workspace.read'],network:{required:false},storage:{required:false},limits:{maxDurationMs:1000,maxOutputBytes:32768},reversibility:'reversible'}, {
      execute:async inputs=>{
        if (!await assertAccess()) throw Error('Acceso revocado.');
        return {status:'succeeded',evidenceRefs:[],output:{recordRefs:queryAdminRecords(records,code,inputs,nodeId).map(dv=>String(dv.id))}};
      },
    });
    surfaces.push({capability:code,label:reader.label,component:reader.key,expressions:[...reader.expressions],fieldLabels:{query:'¿Qué querés buscar? (opcional)'}});
  }
  return {sandbox,surfaces};
}
export async function projectAdminInterface(entry: BusinessEntry, records: any[], text: string, selected: string|null, inputs: Record<string,JsonValue>, requestId: string) {
  const context=await businessAccess(entry,mtLiveSnapshot());
  if (!context) throw Error('Tu autorización ya no está vigente.');
  const host=adminReaderHost(records,async()=>Boolean(await businessAccess(entry,mtLiveSnapshot())),entry.nodeId,activeAdminTools(entry,records));
  const request=await createEnvelope({id:requestId,kind:'need.publish',sourceActorId:context.actorId,sourceNodeId:entry.nodeId,authority:entry.nodeId,scopes:['private'],payload:{text,inputs,...(selected ? {requiredCapabilities:[selected]} : {})}});
  return projectLivingInterface({request,context:{actorId:context.actorId,nodeId:entry.nodeId},...host,authorize:()=>Boolean(context.actingAsNodeId===entry.nodeId),offline:!navigator.onLine});
}

/** Signed proposals in the existing store; not activation, a new Runtime or an independent procedure store. */
export async function saveAdminProcedure(entry: BusinessEntry, projection: LivingInterfaceProjection, prior?: any) {
  const allLive=mtLiveSnapshot();
  const context=await businessAccess(entry,allLive,'composition.publish');
  if (!context || context.wallet.custody!=='device' || projection.actorId!==context.actorId || projection.nodeId!==entry.nodeId) throw Error('Necesitás una identidad persistente y permiso para guardar procedimientos.');
  const identity={...await runtimeIdentity(),nodeId:entry.nodeId};
  const exactKey=(authority:string,keyId:string,jwk:JsonWebKey)=>authority===entry.nodeId && keyId===identity.keyId && ['kty','crv','x','y'].every(key=>(jwk as any)[key]===(identity.publicKeyJwk as any)[key]);
  const record=async <T,>(envelope:LivingEnvelope<T>):Promise<LivingEnvelope<T>> => {
    // Recheck immediately before committing. This remains local, private and proposal-only.
    if (!await businessAccess(entry,mtLiveSnapshot(),'composition.publish')) throw Error('Tu permiso cambió. Revisá nuevamente.');
    const signed=envelope.ownership ? envelope : await signEnvelope(envelope,identity);
    await publishAuthorizedDV({dv:{id:signed.id,kind:'composition.publish',attrs:{...(signed.payload as any),nodeId:entry.nodeId},meta:{scopes:['private'],runtimeEnvelope:signed}},allLive:mtLiveSnapshot(),actingAsNodeId:entry.nodeId,requiredAuthority:entry.nodeId,action:'composition.publish',sensitivity:'relationship',localOnly:true});
    return signed;
  };
  const sdk=new LivingCompositionSDK({identity,authorities:{accepts:exactKey},capabilities:{list:()=>[]},publish:record,recordLocal:record});
  const values=Object.fromEntries((projection.form?.fields || []).filter(field=>field.known && field.value!==undefined).map(field=>[field.name,field.value!]));
  const checked=await projectAdminInterface(entry,allLive,projection.intent,projection.selected,values,`review:${crypto.randomUUID()}`);
  const input=interfaceCompositionInput(checked);
  const consent={mode:'explicit-consent' as const,ref:`${projection.viewId}:proposal-review:${crypto.randomUUID()}`};
  if (prior) {
    if (!belongsToBusiness(prior,entry.nodeId) || !(await verifyAuthorizedDV(prior,allLive)).accepted) throw Error('La versión anterior no es verificable.');
    const latest=allLive.find(dv=>dv.id===prior.id);
    if (JSON.stringify(latest?.meta?.runtimeEnvelope)!==JSON.stringify(prior.meta?.runtimeEnvelope)) throw Error('Otra versión cambió. Volvé a abrir el procedimiento antes de guardar.');
    const previous=prior.meta?.runtimeEnvelope;
    if (!previous || previous.sourceActorId!==identity.actorId || previous.authority!==entry.nodeId) throw Error('La propuesta pertenece a otra identidad o nodo.');
    return sdk.revise(previous,{intent:input.intent,inputs:input.inputs,requiredCapabilities:input.requiredCapabilities,participants:input.participants,steps:input.steps,conditions:input.conditions,outcome:input.outcome,authorityRequirements:input.authorityRequirements,resourceLimits:input.resourceLimits,privacy:input.privacy,evidenceRequirements:input.evidenceRequirements,expectedOutcomes:input.expectedOutcomes},consent);
  }
  return record(await sdk.sign(input,consent));
}

export async function simulateAdminInterface(entry: BusinessEntry, records: any[], projection: LivingInterfaceProjection) {
  if (!await businessAccess(entry,mtLiveSnapshot())) throw Error('Tu permiso cambió.');
  const identity={...await runtimeIdentity(),nodeId:entry.nodeId};
  const sdk=new LivingCompositionSDK({identity,authorities:{accepts:()=>false},capabilities:{list:()=>[]},publish:async envelope=>envelope});
  const composition=await sdk.sign(interfaceCompositionInput(projection),{mode:'explicit-consent',ref:`${projection.viewId}:simulation-only`});
  const host=adminReaderHost(records,async()=>Boolean(await businessAccess(entry,mtLiveSnapshot())),entry.nodeId,activeAdminTools(entry,records));
  return simulateComposition(composition,host.sandbox,entry.nodeId);
}
