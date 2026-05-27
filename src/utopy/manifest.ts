export type UtopyManifest = { id?:string; ws?:string; http?:string; auth?:string; tips?:string[]; prefer?: 'webrtc'|'ws'|'http' };


export function parseManifest(raw: string): UtopyManifest | null {
const s = raw?.trim(); if(!s) return null;
if (s.startsWith('utopy://')) {
try {
const url = new URL(s);
return {
id: url.searchParams.get('id') || undefined,
ws: url.searchParams.get('ws') || undefined,
http: url.searchParams.get('http') || undefined,
auth: url.searchParams.get('auth') || undefined,
prefer: (url.searchParams.get('prefer') as any) || undefined,
};
} catch { return null; }
}
try { return JSON.parse(s) as UtopyManifest; } catch { return null; }
}