export type SymbolMap = Record<string, { op: string; note?: string }>;


export const defaultSymbolDict: SymbolMap = {
'🌱': { op: 'dato.create', note: 'semilla/dato vivo' },
'🔎': { op: 'dato.query', note: 'consulta' },
'💬': { op: 'interpretar.msg', note: 'mensaje humano' },
'📦': { op: 'invocar.cap', note: 'capability/worker' },
};