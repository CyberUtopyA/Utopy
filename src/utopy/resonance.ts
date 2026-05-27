// Bus de resonancia local: pub/sub minimalista (conecta directo con tu seed vía spore)
type Listener = (e: any) => void;
const listeners = new Set<Listener>();

export function publish(e: any) {
  for (const l of listeners) { try { l(e); } catch {} }
}

export function subscribe(f: Listener) {
  listeners.add(f);
  return () => listeners.delete(f);
}

// Snapshots opcionales del “entendimiento” nodal (no a disco, sí a red voluntaria)
export function snapshotNodal(): any {
  const g: any = globalThis as any;
  const mem = g.__UTOPY_NODEMIND?.mem;
  if (!mem) return { beliefs: [], symbols: [] };
  return {
    beliefs: Array.from(mem.beliefs.entries()),
    symbols: Array.from(mem.symbols.entries()),
  };
}
export function restoreNodal(data: { beliefs?: [string, any][], symbols?: [string, any][] }) {
  const g: any = globalThis as any;
  if (!g.__UTOPY_NODEMIND) g.__UTOPY_NODEMIND = {};
  if (!g.__UTOPY_NODEMIND.mem) g.__UTOPY_NODEMIND.mem = { beliefs: new Map(), symbols: new Map() };
  if (data.beliefs) g.__UTOPY_NODEMIND.mem.beliefs = new Map(data.beliefs);
  if (data.symbols) g.__UTOPY_NODEMIND.mem.symbols = new Map(data.symbols);
}
