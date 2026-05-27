import type { DatoVivo } from "./mt.traitAdapter";
import { publishDatoVivo } from "./seedbus";
import { mtLiveUpsert } from "./mt.liveStore";
import { spore } from "../utopy/spore.singleton";

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type CajeroDraft = {
  nombre: string;
  wallet?: string;        // evm:0x...
  orgId?: string;
  territorioId?: string;
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
      nombre: c.nombre,
      wallet: c.wallet || null,
      orgId: c.orgId || null,
      territorioId: c.territorioId || null,
      roles: c.roles?.length ? c.roles : ["cashier"],
    },
    traits: ["mt:cajero", "mt:actor"],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      pinned: true,
    },
  };
}

export async function createCajero(c: CajeroDraft) {
  const dv = cajeroToDv(c);

  // 1) aparece instantáneo en la UI local
  mtLiveUpsert(dv);

  // 2) intent para que otros nodos lo vean (opcional pero recomendado)
  try {
    await spore?.sayIntent({
      sym: "🧾",
      say: "mt.cajero.upsert",
      with: { dv },
    });
  } catch {}

  // 3) publicar DV en seed/micelio
  await publishDatoVivo(dv);

  return dv;
}