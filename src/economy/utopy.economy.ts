import { directNodeMovements } from './utopy.node-adapter';
export const ECONOMY_SCHEMA='utopy.economy/1';
/** A node receipt is not a provider account. Never sum node sales into a wallet. */
export function projectLivingEconomy(all:any[], actorId:string, verified:Set<any>) {
  const movements=directNodeMovements(all,actorId,verified);
  return {schema:ECONOMY_SCHEMA,actorId,providerStatus:'not_configured' as const,available:null,pendingSettlement:null,
    payoutDestinations:[] as never[],canPayout:false,canSend:false,movements,
    registered:movements.filter(movement=>movement.status==='registered'),
    pending:movements.filter(movement=>movement.status==='pending'),
    failed:movements.filter(movement=>movement.status==='failed'),
    refunds:movements.filter(movement=>movement.status==='refunded'),
    connections:[...new Set(movements.map(movement=>movement.nodeId).filter(Boolean))]};
}
