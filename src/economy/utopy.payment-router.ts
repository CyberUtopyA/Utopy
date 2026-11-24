export type EconomicRoute = {mode:'direct';custody:'node';walletCredit:false}|{mode:'unavailable';reason:string};
/** Existing checkout remains the executor. A public provider claim grants no financial capability. */
export function economicPaymentRoute(mode:'direct'|'coordinated'):EconomicRoute {
  return mode==='direct'?{mode:'direct',custody:'node',walletCredit:false}:{mode:'unavailable',reason:'No hay un proveedor financiero autorizado conectado.'};
}

// Reuse Runtime's route signatures, seller consent and Margin Guard. This is
// a merchant-boundary quote projection, never a provider/payment executor.
export { acceptedEconomicRoutes, evaluateEconomicRoute, explainEconomicRoute, authorizeEconomicRoute, projectSellerSettlement, evaluateSellerDeliverySafety } from 'utopy/liquidity';
