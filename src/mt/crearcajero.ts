import type { DatoVivo } from "./mt.traitAdapter";
import { spore } from "../utopy/spore.singleton";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type CajeroDraft = {
  nombre: string;
  wallet?: string;        // evm:0x...
  orgId?: string;
  territorioId?: string;
  nodeId?: string;
  roles?: string[];      
  ns?: string ;
   // ["admin"] | ["supervisor"] | ["cashier"]
};

export function cajeroToDv(c: CajeroDraft): DatoVivo {
  const id = createId("mt:cajero:");

  return {
    id,
    kind: "mt:cajero",
    attrs: {
      cajeroId: id,
      nombre: c.nombre,
      wallet: c.wallet || null,
      orgId: c.orgId || null,
      territorioId: c.territorioId || null,
      roles: c.roles?.length ? c.roles : ["cashier"],
      nodeId: c.nodeId || null,
      actorId: null,
      surface: "cash-register",
    },
    traits: ["mt:cajero", "utopy:device-surface"],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      pinned: true,
    },
  };
}

export async function createCajero(c: CajeroDraft) {
  const dv = cajeroToDv(c);
  const signed = (
    await publishAuthorizedDV({
      dv,
      targetNodeId: c.nodeId || null,
      sensitivity: "relationship",
    })
  ).dv;

  // 2) intent para que otros nodos lo vean (opcional pero recomendado)
  try {
    await spore?.sayIntent({
      sym: "🧾",
      say: "mt.cajero.upsert",
      with: { dv: signed },
    });
  } catch {}

  return signed;
}
