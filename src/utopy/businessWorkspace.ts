import { LIVING_PILOTS } from '../pilots/livingPilotDefinitions';
import { verifyNodeManifestDV } from '../mt/utopy.nodeManifest';
import { resolveCurrentIdentityContext, type CurrentIdentityContext } from './identityContext';
import { verifyAuthorizedDV } from './authorizedPublish';
import {verifyAdminReceipt} from './adminReceipt';

// Configuration only: none of these entries is an identity, installed executor or live business.
export const BUSINESS_CONFIGURATIONS = {
  'don-mencia': { adminTools: ["catalog","orders","progress","charge","evidence","outcome"], ...LIVING_PILOTS['don-mencia'], requirements: ['Productos y unidades', 'Precios y disponibilidad', 'Preparación, retiro y entrega'] },
  encicar: { adminTools: ["diagnosis","quote","progress","charge","evidence","outcome"], ...LIVING_PILOTS.encicar, requirements: ['Recepción y diagnóstico', 'Repuestos y mano de obra', 'Aprobación del cliente y garantía'] },
  rene: { adminTools: ["catalog","orders","progress","charge","evidence","outcome"], name: 'Minimercado René', summary: 'Almacén y carnicería', icon: '🧺', steps: ['Solicitud', 'Aceptación', 'Preparación', 'Retiro o entrega', 'Cobro'], requirements: ['Catálogo por unidad o peso', 'Stock y reservas confirmadas', 'Medios de cobro disponibles'] },
  celulares: { adminTools: ["diagnosis","quote","progress","charge","evidence","outcome"], name: 'Servicio técnico de celulares', summary: 'Diagnóstico y reparación', icon: '📱', steps: ['Recepción', 'Diagnóstico', 'Presupuesto', 'Aprobación', 'Reparación', 'Listo para retirar', 'Entrega'], requirements: ['Modelo y falla; nunca contraseñas del equipo', 'Diagnóstico y presupuesto', 'Aprobación y tiempo estimado'] },
  peluqueria: { adminTools: ["agenda","orders","charge","evidence","outcome"], name: 'Peluquería', summary: 'Servicios y turnos', icon: '✂️', steps: ['Solicitud de turno', 'Confirmación', 'Atención', 'Cobro'], requirements: ['Servicios, precios y duración', 'Profesionales y disponibilidad', 'Confirmación atómica de turnos sin superposición'] },
  hamburgueseria: { adminTools: ["catalog","orders","progress","charge","evidence","outcome"], name: 'Hamburguesería', summary: 'Cocina, retiro y delivery', icon: '🍔', steps: ['Solicitud', 'Aceptación', 'En cocina', 'Listo', 'Retiro o delivery', 'Entrega', 'Cobro'], requirements: ['Menú, variantes y adicionales', 'Disponibilidad y preparación', 'Retiro y coordinación de entrega'] },
} as const;
export type BusinessConfigurationKey = keyof typeof BUSINESS_CONFIGURATIONS;
export type BusinessEntry = { nodeId: string; slug: string; name: string; manifest: any; configuration: BusinessConfigurationKey | null };
/** Keep historical test records intact, but never present them as commercial nodes. */
export const isCommercialWorkspaceEntry=(entry:BusinessEntry)=>entry.manifest.attrs?.simulation!==true&&!entry.manifest.attrs?.demonstrationSet;
/** Search a previously verified registry. Discovery never grants access or installs a capability. */
export function searchBusinessEcosystem(entries: BusinessEntry[], query: string): BusinessEntry[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words = normalize(query.trim().slice(0,500)).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries.filter(entry => {
    const attrs = entry.manifest.attrs || {};
    const capabilities = Array.isArray(attrs.capabilities) ? attrs.capabilities : [];
    const haystack = normalize([entry.name, attrs.description, attrs.workspaceIntent,
      ...capabilities.flatMap((value: any) => typeof value === 'string' ? [value] :
        [value?.id, value?.label, value?.description, ...(Array.isArray(value?.produces) ? value.produces : [])]),
    ].filter(value=>typeof value==='string').join(' '));
    return words.every(word=>haystack.includes(word));
  }).slice(0,12);
}
export const explicitPublic = (dv: any) => Array.isArray(dv?.meta?.scopes) && dv.meta.scopes.includes('public') && !dv.meta.scopes.some((s: string) => ['private','participants','custodians'].includes(s));
const text = (value: unknown) => String(value ?? '').trim();
export const businessPath = (entry: BusinessEntry, manage = false) => `/n/${encodeURIComponent(entry.slug)}${manage ? '/gestionar' : ''}`;
export function belongsToBusiness(dv: any, nodeId: string) {
  // Authority/origin are canonical ownership; targetNodeId alone is not ownership.
  return [dv?.attrs?.nodeId, dv?.attrs?.sellerNodeId, dv?.meta?.originNode, dv?.meta?.authority].some(value => text(value) === nodeId);
}
export async function businessRegistry(allLive: any[], verify = verifyNodeManifestDV): Promise<BusinessEntry[]> {
  const latest = new Map<string, any>();
  for (const dv of allLive) {
    if (!/node\.manifest$/i.test(text(dv?.kind)) || !explicitPublic(dv)) continue;
    const old = latest.get(text(dv.id));
    if (!old || Number(dv.meta?.version || 0) > Number(old.meta?.version || 0)) latest.set(text(dv.id), dv);
  }
  const verified = (await Promise.all([...latest.values()].map(async manifest => {
    const result = await verify(manifest, allLive);
    if (!result.accepted || result.proof !== 'verified') return null;
    const attrs = manifest.attrs || {}, nodeId = text(attrs.nodeId || attrs.node?.id);
    const expires = manifest.meta?.ttl_ms ? new Date(manifest.meta.updatedAt || manifest.meta.ts).getTime() + Number(manifest.meta.ttl_ms) : Infinity;
    if (!nodeId || !Number.isFinite(expires) && expires !== Infinity || expires <= Date.now() || ['revoked','inactive','disabled'].includes(attrs.status)) return null;
    const key = text(attrs.businessConfiguration);
    const slug = text(attrs.slug || attrs.handle || nodeId);
    if (!slug || /[/?#\\]/.test(slug)) return null;
    return {nodeId, slug, name: text(attrs.nodeName || attrs.node?.name) || 'Mi negocio', manifest, configuration: Object.hasOwn(BUSINESS_CONFIGURATIONS,key) ? key as BusinessConfigurationKey : null};
  }))).filter(Boolean) as BusinessEntry[];
  // Ambiguous public names/identifiers must never select an arbitrary controller.
  return verified.filter(entry => verified.filter(other => other.nodeId === entry.nodeId).length === 1 && verified.filter(other => other.slug === entry.slug).length === 1);
}
export function validBusinessGrant(grant: any, nodeId: string, actorId: string, action: string, now = Date.now()) {
  if (!grant?.verified || grant.status !== 'active' || grant.nodeId !== nodeId || grant.actorId !== actorId) return false;
  for (const [field, future] of [['validFrom',true],['validUntil',false]] as const) {
    if (!grant[field]) continue;
    const time = new Date(grant[field]).getTime();
    if (!Number.isFinite(time) || (future ? time > now : time <= now)) return false;
  }
  return (grant.allowedActions || []).some((allowed: string) => allowed === action || allowed === '*' || allowed.endsWith('.*') && action.startsWith(allowed.slice(0,-1)));
}
export async function businessAccess(entry: BusinessEntry, allLive: any[], action = 'node.workspace.read'): Promise<CurrentIdentityContext | null> {
  const proof = await verifyNodeManifestDV(entry.manifest, allLive);
  if (!proof.accepted || proof.proof !== 'verified') return null;
  const context = await resolveCurrentIdentityContext({allLive, actingAsNodeId: entry.nodeId, action});
  // A supplied nodeId, role label or UI flag cannot grant access.
  const controller = entry.manifest.meta?.ownership?.ownerDid === context.ownerDid;
  const grant = context.authorizations.some(item => validBusinessGrant(item,entry.nodeId,context.actorId,action));
  if(context.actingAsNodeId === entry.nodeId && (controller || grant))return context;
  for(const dv of allLive.filter(item=>item.kind==='node.authorization.receipt'&&item.attrs?.nodeId===entry.nodeId)){
    const receipt=await verifyAdminReceipt(entry.manifest,dv.attrs.envelope,context.actorId,allLive);
    if(receipt&&receipt.allowedActions.includes(action))return {...context,actingAsNodeId:entry.nodeId,authorizations:[...context.authorizations,receipt]} as CurrentIdentityContext;
  }
  return null;
}

/** Shared private projection for administrative shells; never infer membership from a target alone. */
export async function verifiedBusinessRecords(entry: BusinessEntry, allLive: any[], context: CurrentIdentityContext) {
  if (context.actingAsNodeId !== entry.nodeId) return [];
  return (await Promise.all(allLive.filter(dv=>belongsToBusiness(dv,entry.nodeId)).map(async dv=>{
    const scopes=dv.meta?.scopes || [], participants=dv.attrs?.participants || [];
    const readable=explicitPublic(dv) || (scopes.includes('private') ? dv.attrs?.actorId===context.actorId : participants.includes(context.actorId) || participants.includes(entry.nodeId));
    if (!readable) return null;
    const proof=await verifyAuthorizedDV(dv,allLive);
    return proof.accepted && proof.proof==='verified' ? dv : null;
  }))).filter(Boolean);
}
