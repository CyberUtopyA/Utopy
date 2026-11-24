import { createEnvelope, LocalCapabilitySandbox, projectLivingInterface, type LivingInterfaceSurface } from 'utopy';
import { resolveCurrentIdentityContext } from '../utopy/identityContext';
import type { projectLivingEconomy } from './utopy.economy';

const READERS = [
  {code:'economy.movements.read',label:'Explicar movimientos',expressions:['mis movimientos','explicar movimientos','ver pagos'],component:'evidence' as const},
  {code:'economy.pending.read',label:'Consultar pagos pendientes',expressions:['pagos pendientes','que falta pagar','qué falta pagar'],component:'charge' as const},
  {code:'economy.connections.read',label:'Consultar relaciones económicas',expressions:['mis relaciones','mis comercios'],component:'outcome' as const},
] as const;

/** Local, read-only Runtime reasoning. No transfer, beneficiary or publication handler. */
export async function explainLivingEconomy(text:string,view:ReturnType<typeof projectLivingEconomy>,allLive:any[]) {
  const identity=await resolveCurrentIdentityContext({allLive});
  if(!view.actorId||identity.actorId!==view.actorId)throw Error('Volvé a abrir Mi Valor con tu identidad actual.');
  const sandbox=new LocalCapabilitySandbox();
  const surfaces:LivingInterfaceSurface[]=READERS.map(reader=>({capability:reader.code,label:reader.label,expressions:[...reader.expressions],component:reader.component}));
  for(const reader of READERS)sandbox.register({code:reader.code,inputs:[],outputs:['recordRefs'],effects:[],permissions:['economy.self.read'],network:{required:false},storage:{required:false},limits:{maxDurationMs:1000,maxOutputBytes:4096},reversibility:'reversible'}, {
    execute:async()=>{throw Error('Consulta de sólo lectura; no se ejecutan acciones.');},
  });
  const request=await createEnvelope({id:`economy:query:${crypto.randomUUID()}`,kind:'need.publish',sourceActorId:identity.actorId,sourceNodeId:identity.actorId,authority:identity.actorId,scopes:['private'],payload:{text:text.slice(0,500)}});
  const projection=await projectLivingInterface({request,context:{actorId:identity.actorId,nodeId:identity.actorId},sandbox,surfaces,
    authorize:declaration=>declaration.effects.length===0&&READERS.some(reader=>reader.code===declaration.code),offline:true});
  const explanation=projection.selected==='economy.pending.read'
    ? `${view.pending.length} operación(es) pendientes de confirmación. Una entrega o aceptación no confirma el pago.`
    :projection.selected==='economy.movements.read'
      ? `${view.registered.length} pago(s) registrados por comercios, ${view.failed.length} fallido(s) y ${view.refunds.length} devolución(es) registradas. Son declaraciones firmadas del comercio, no saldo ni evidencia bancaria.`
      :projection.selected==='economy.connections.read'
        ? `${view.connections.length} comercio(s) con operaciones verificadas. Cada nodo conserva sus fondos y permisos.`
        :'Podés consultar «mis movimientos», «pagos pendientes» o «mis relaciones». No hay proveedor autorizado para enviar o retirar dinero.';
  return {projection,explanation};
}
