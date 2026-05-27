// utopy/symbol.bus.ts
import type { Intent } from "./intent";

type H = (i: Intent, ctx: any) => void|Promise<void>;
const handlers = new Map<string, H[]>();
export function hear(sym: string|"*", say: string|"*", h: H){
  const k = `${sym}::${say}`;
  handlers.set(k, [ ...(handlers.get(k)||[]), h ]);
}
export async function dispatch(i: Intent, ctx: any){
  const keys = [`${i.sym}::${i.say}`, `${i.sym}::*`, `*::${i.say}`, `*::*`];
  for (const k of keys) for (const h of (handlers.get(k)||[])) await h(i, ctx);
}
