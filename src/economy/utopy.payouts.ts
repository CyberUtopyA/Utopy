export function payoutReadiness() {
  return {enabled:false as const,reason:'Vincular una tarjeta no crea un saldo retirable. Falta un proveedor de cuenta y retiros autorizado.'};
}
/** No request, optimistic completion, money movement, credentials or local payout queue. */
export async function requestLivingPayout():Promise<never> { throw Error(payoutReadiness().reason); }
