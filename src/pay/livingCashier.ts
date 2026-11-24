import { publishAuthorizedDV, verifyAuthorizedDV } from "../utopy/authorizedPublish";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
export type CashMethod = "transfer" | "pix" | "bancard" | "cash";
export function validateChargeDraft(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) throw Error("Ingresá un importe válido mayor a cero.");
  if (!["PYG", "BRL", "USD"].includes(currency)) throw Error("Esta moneda no está soportada.");
  if (currency === "PYG" && !Number.isInteger(amount)) throw Error("Usá guaraníes enteros.");
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > .00001) throw Error("Usá como máximo dos decimales.");
}
export async function saveLivingCashier(input: { allLive: any[]; activeActor?: any; methods: CashMethod[]; privateDestinations: Record<string, any>; currency: string }) {
  const context = await resolveCurrentIdentityContext({ allLive: input.allLive, activeActor: input.activeActor });
  const subjectId = context.actingAsNodeId || context.nodeId || context.actorId;
  const methods = Array.from(new Set(input.methods));
  const privateDV = await publishAuthorizedDV({ dv: { id: `payment.receive.config:${subjectId}`, kind: "payment.receive.config", attrs: { subjectId, methods, currency: input.currency, destinations: input.privateDestinations, participants: [context.actorId] }, traits: ["payment:receive", "cashier:private"], meta: { ns: "utopy:payment", scopes: ["participants"] } }, allLive: input.allLive, activeActor: input.activeActor, action: "payment.receive.configure", sensitivity: "sensitive" });
  const capability = await publishAuthorizedDV({ dv: { id: `payment.receive.capability:${subjectId}`, kind: "payment.receive.capability", attrs: { subjectId, nodeId: context.actingAsNodeId || context.nodeId || null, actorId: context.actorId, methods, accepts: methods.map((method) => `payment.receive.${method}`), currency: input.currency, available: true }, traits: ["payment:receive", ...methods.map((method) => `payment.receive.${method}`)], meta: { ns: "mt:market", scopes: ["public"] } }, allLive: [...input.allLive, privateDV.dv], activeActor: input.activeActor, action: "payment.receive.publish", sensitivity: "ephemeral" });
  return { context, privateDV: privateDV.dv, capabilityDV: capability.dv };
}
export async function createLivingCharge(input: { allLive: any[]; activeActor?: any; amount: number; currency: string; concept?: string; expiresMinutes?: number; method?: CashMethod; requestId?: string }) {
  validateChargeDraft(input.amount, input.currency);
  const context = await resolveCurrentIdentityContext({ allLive: input.allLive, activeActor: input.activeActor });
  const sellerId = context.actingAsNodeId || context.nodeId || context.actorId;
  let capability = input.allLive.find((dv) => dv?.kind === "payment.receive.capability" && String(dv?.attrs?.subjectId) === sellerId);
  if (capability) {
    const proof = await verifyAuthorizedDV(capability, input.allLive);
    if (!proof.accepted || proof.proof !== "verified") throw Error("La configuración de esta caja necesita una firma válida y autorización vigente.");
  }
  if (capability && (capability.attrs.available === false || capability.attrs.currency !== input.currency)) throw Error("Elegí una moneda habilitada en tu caja.");
  if (!capability && input.currency !== "PYG") throw Error("Primero configurá esa moneda en tu caja.");
  if (!capability) {
    const created = await saveLivingCashier({ allLive: input.allLive, activeActor: input.activeActor, methods: ["cash"], privateDestinations: {}, currency: input.currency });
    capability = created.capabilityDV;
  }
  const supportedMethods = (capability.attrs.methods || []).filter((method: string) => ["cash", "transfer", "pix", "bancard"].includes(method));
  if (!supportedMethods.length || (input.method && !supportedMethods.includes(input.method))) throw Error("Ese medio no está habilitado en tu caja.");
  const paymentRequestId = input.requestId || `payment.request:${crypto.randomUUID()}`;
  if (!/^payment\.request:[a-f0-9-]{36}$/i.test(paymentRequestId)) throw Error("La solicitud no es válida.");
  const existing = input.allLive.find(dv => dv.id === paymentRequestId);
  if (existing) {
    const proof = await verifyAuthorizedDV(existing, input.allLive);
    const expiry = Date.parse(existing.attrs?.expiresAt || "");
    if (existing.attrs?.status !== "open" || !Number.isFinite(expiry) || expiry <= Date.now()) throw Error("Esta solicitud ya no está disponible. Revisá su estado antes de generar otra.");
    if (!proof.accepted || proof.proof !== "verified" || existing.attrs?.sellerId !== sellerId || existing.attrs?.amount !== input.amount || existing.attrs?.currency !== input.currency || existing.attrs?.concept !== (input.concept || "Cobro") || (input.method && !existing.attrs?.methods?.includes(input.method))) throw Error("Esta solicitud ya existe con otros datos.");
    return { dv: existing, url: `${window.location.origin}/pagar/${encodeURIComponent(paymentRequestId)}` };
  }
  const expiresAt = new Date(Date.now() + Math.max(2, input.expiresMinutes || 15) * 60_000).toISOString();
  const result = await publishAuthorizedDV({ dv: { id: paymentRequestId, kind: "payment.request", attrs: { paymentRequestId, sellerId, sellerNodeId: context.actingAsNodeId || context.nodeId || null, amount: input.amount, currency: input.currency, concept: input.concept || "Cobro", methods: input.method ? [input.method] : supportedMethods, status: "open", amountLocked: true, expiresAt, createdAt: new Date().toISOString() }, traits: ["payment:request", "cashier:charge"], meta: { ns: "utopy:payment", scopes: ["public"], ttl_ms: Math.max(2, input.expiresMinutes || 15) * 60_000 } }, allLive: input.allLive, activeActor: input.activeActor, action: "payment.request.create", sensitivity: "ephemeral" });
  return { dv: result.dv, url: `${window.location.origin}/pagar/${encodeURIComponent(paymentRequestId)}` };
}
export function parseSpokenAmount(value: string) { const normalized = value.toLowerCase().replace(/\./g, "").trim(); const digits = Number(normalized.replace(/[^0-9,]/g, "").replace(",", ".")); if (Number.isFinite(digits) && digits > 0) return digits; const units: Record<string, number> = { diez: 10, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100 }; const base = Object.entries(units).find(([word]) => normalized.includes(word))?.[1] || 0; return normalized.includes("mil") ? base * 1000 : base; }
