// src/utopy/types.bio.ts
export type BioBase = {
  id: string;                 // p.ej. "utopi:any:<uuid>"
  kind: string;               // libre: "ropa", "vehiculo", "proyecto3d", "lo_que_sea"
  attrs?: Record<string, any>;
  traits?: Record<string, any>;
  meta?: { ts?: number; ver?: number; cid?: string; author?: string } & Record<string, any>;
};
