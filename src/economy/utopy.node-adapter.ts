import { projectCheckoutPurchaseCycle } from '../mt/mt.checkoutPurchaseCycle';

export function describeDirectPayment(order:any, cycle:ReturnType<typeof projectCheckoutPurchaseCycle>) {
  const outcome=cycle.paymentOutcome;
  const reported=String(outcome?.attrs?.status||'').toLowerCase();
  const paid=reported==='paid';
  const closed=cycle.state==='rejected'||cycle.state==='cancelled';
  const status=reported==='refunded'?'refunded':reported==='failed'?'failed':paid?'registered':closed?'closed':'pending';
  return {status,paidAmount:paid?Number(outcome.attrs.amount):null,partialPayment:paid&&Number(outcome.attrs.amount)<Number(order.attrs.total),reviewRequired:paid&&closed,
    label:status==='refunded'?'Devolución registrada por el comercio':status==='failed'?'Pago fallido':paid?'Pago registrado por el comercio':closed?'Operación cerrada':'Pago pendiente de confirmación'};
}

export function privateEconomicRecord(dv:any) {
  return dv && dv.attrs?.simulation!==true && dv.simulation!==true && dv.meta?.simulation!==true
    && Array.isArray(dv.meta?.scopes) && !dv.meta.scopes.includes('public')
    && dv.meta.scopes.some((scope:string)=>['private','participants'].includes(scope));
}

/** Read-only projection of the existing exact-order/authority/payment contract. */
export function directNodeMovements(all:any[], actorId:string, verified:Set<any>) {
  if(!actorId)return [];
  const privateForActor=(dv:any)=>privateEconomicRecord(dv)
    && (dv.attrs?.buyerActorId||dv.attrs?.buyerId)===actorId && dv.meta?.authority===actorId;
  const orders=all.filter(dv=>dv.kind==='market.order.create' && verified.has(dv) && privateForActor(dv));
  const evidence=all.filter(dv=>verified.has(dv)&&privateEconomicRecord(dv));
  const ids=new Set(evidence.map(dv=>dv.id));
  const seen=new Set<string>();
  return orders.flatMap(order=>{
    const key=String(order.attrs.orderId||order.id);
    if(order.id!==key)return [];
    if(seen.has(key))return [];seen.add(key);
    const cycle=projectCheckoutPurchaseCycle({order,allLive:evidence,verifiedIds:ids});
    const amount=Number(order.attrs.total),currency=String(order.attrs.currency||'').toUpperCase();
    if(!Number.isFinite(amount)||amount<=0||!['PYG','USD','BRL'].includes(currency))return [];
    const event=cycle.paymentOutcome,description=describeDirectPayment(order,cycle);
    return [{id:key,nodeId:String(order.attrs.sellerNodeId||order.attrs.targetNodeId||''),amount,currency,...description,
      evidenceRef:event?.id||null,paymentSource:event?'merchant_statement':'none',
      time:String(event?.meta?.ts||order.meta?.ts||''),custody:'external' as const,withdrawable:false as const}];
  }).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
}
