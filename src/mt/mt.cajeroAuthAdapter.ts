// src/mt/mt.cajeroAuthAdapter.ts
// Adaptador DV -> reglas de autorización de cajero/actores de delivery.confirm

import type { DatoVivo } from "./mt.traitAdapter";

export type AuthScope = "global" | "org" | "territory" | "product" | "order";

export type MtCajeroAuthRule = {
  id: string;
  scope: AuthScope;

  // a qué aplica
  orgId?: string;
  territorioId?: string;
  productId?: string;
  orderId?: string;

  // quién autoriza
  by: { id: string; nombre?: string };

  // permisos: actorId -> roles permitidos
  grants: Array<{
    actorId: string;
    roles: string[]; // ["carrier","witness","supervisor",...]
    trustHint?: number; // 0..1 opcional
    note?: string;
  }>;

  // control
  active: boolean;
  ts: number;
  meta?: any;
};

function safeStr(x: any): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function clamp01(n: any): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function isAuthDV(d: DatoVivo): boolean {
  const k = safeStr(d.kind);
  const traits = Array.isArray(d.traits) ? d.traits.map(String) : [];
  return k === "mt:cajero.auth" || traits.includes("mt:cajero.auth");
}

export function adaptDatosToMtCajeroAuthRules(datos: DatoVivo[]): MtCajeroAuthRule[] {
  return datos
    .filter(isAuthDV)
    .map((d) => {
      const a: any = d.attrs || {};
      const meta: any = d.meta || {};
      const scope = (safeStr(a.scope) as AuthScope) || "global";

      const byId = safeStr(a.by?.id ?? meta.by?.id ?? a.actorId ?? meta.actorId) || "unknown";
      const byNombre = safeStr(a.by?.nombre ?? meta.by?.nombre ?? a.actorNombre ?? meta.actorNombre) || undefined;

      const grantsRaw: any[] = Array.isArray(a.grants) ? a.grants : [];
      const grants = grantsRaw
        .map((g) => ({
          actorId: safeStr(g.actorId ?? g.id),
          roles: Array.isArray(g.roles) ? g.roles.map((x: any) => safeStr(x).toLowerCase()).filter(Boolean) : [],
          trustHint: g.trustHint != null ? clamp01(g.trustHint) : undefined,
          note: safeStr(g.note) || undefined,
        }))
        .filter((g) => g.actorId && g.roles.length);

      return {
        id: safeStr(d.id),
        scope: (["global", "org", "territory", "product", "order"].includes(scope) ? scope : "global") as AuthScope,
        orgId: safeStr(a.orgId ?? meta.orgId) || undefined,
        territorioId: safeStr(a.territorioId ?? meta.territorioId) || undefined,
        productId: safeStr(a.productId ?? meta.productId) || undefined,
        orderId: safeStr(a.orderId ?? meta.orderId) || undefined,
        by: { id: byId, nombre: byNombre },
        grants,
        active: a.active == null ? true : !!a.active,
        ts: Number(a.ts ?? meta.ts ?? Date.now()) || Date.now(),
        meta,
      };
    })
    // más nuevo primero
    .sort((x, y) => (y.ts || 0) - (x.ts || 0));
}

// Construye allowMap: key = `${scopeKey}|${actorId}|${role}` -> true
export function buildAllowMap(rules: MtCajeroAuthRule[]) {
  const allow = new Map<string, boolean>();
  const trustHint = new Map<string, number>(); // actorId -> trustHint max

  for (const r of rules) {
    if (!r.active) continue;

    const scopeKey =
      r.scope === "order"
        ? `order:${r.orderId || "*"}`
        : r.scope === "product"
        ? `product:${r.productId || "*"}`
        : r.scope === "territory"
        ? `territory:${r.territorioId || "*"}`
        : r.scope === "org"
        ? `org:${r.orgId || "*"}`
        : "global:*";

    for (const g of r.grants) {
      for (const role of g.roles) {
        allow.set(`${scopeKey}|${g.actorId}|${role}`, true);
      }
      if (typeof g.trustHint === "number") {
        const prev = trustHint.get(g.actorId) ?? 0;
        trustHint.set(g.actorId, Math.max(prev, g.trustHint));
      }
    }
  }

  return { allow, trustHint };
}