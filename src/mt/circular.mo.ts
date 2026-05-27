import { mtLiveUpsert } from "./mt.liveStore";
import { setNamespaceTag } from "../pushtags";

function uid(prefix = "id") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function asArr<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function scopesFromDv(dv: any): string[] {
  const scopes = asArr<string>(dv?.meta?.scopes).filter(Boolean);
  return scopes.length ? scopes : ["public"];
}

function worldIdFromScopes(scopes: string[]): string | null {
  const s = scopes.find((x) => String(x).startsWith("world:"));
  return s ? String(s).slice("world:".length) : null;
}

function materialTitleFromDv(dv: any): string {
  return (
    safeStr(dv?.attrs?.materialName) ||
    safeStr(dv?.attrs?.title) ||
    safeStr(dv?.title) ||
    safeStr(dv?.attrs?.materialKey) ||
    safeStr(dv?.kind) ||
    "Circular"
  );
}

function materialQtyFromDv(dv: any): number {
  const n = Number(
    dv?.attrs?.quantity ??
      dv?.attrs?.cantidad ??
      dv?.attrs?.stock ??
      0
  );
  return Number.isFinite(n) ? n : 0;
}

function materialUnitFromDv(dv: any): string {
  return safeStr(dv?.attrs?.unit || dv?.attrs?.unidad || "u");
}

function threadIdForCircularMO(dv: any, actorId?: string | null) {
  const current =
    dv?.meta?.threadId ||
    dv?.attrs?.threadId ||
    dv?.threadId ||
    null;

  if (current) return String(current);

  const materialKey =
    safeStr(dv?.attrs?.materialKey) ||
    safeStr(dv?.attrs?.productoId) ||
    safeStr(dv?.kind) ||
    "circular";

  return `mt.thread.mo.circular:${safeStr(actorId || "actor")}::${materialKey}::${Date.now()}`;
}

function emitUtopy(detail: any) {
  try {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail,
      })
    );
  } catch {
    // noop
  }
}

export type SendCircularToMOInput = {
  dv: any;
  actorId?: string | null;
  actorName?: string | null;
  orgId?: string | null;
  territoryId?: string | null;
  note?: string | null;
  runAction?: boolean;
  action?:
    | "mo.reuse.plan.from.material"
    | "mo.fabrication.pack.from.recovered"
    | "mo.plan.from.urban.mining"
    | null;
};

export async function sendCircularToMO(input: SendCircularToMOInput) {
  const dv = input.dv;
  const ts = new Date().toISOString();
  const scopes = scopesFromDv(dv);
  const worldId = worldIdFromScopes(scopes);
  const ns = safeStr(dv?.meta?.ns || "mt:market");
  const actorId = safeStr(input.actorId || "actor:unknown");
  const actorName = safeStr(input.actorName || "Actor local");
  const orgId = safeStr(input.orgId || dv?.attrs?.orgId || dv?.meta?.orgId || "");
  const territoryId = safeStr(
    input.territoryId || dv?.attrs?.territoryId || dv?.meta?.territoryId || ""
  );
  const threadId = threadIdForCircularMO(dv, actorId);

  const title = materialTitleFromDv(dv);
  const qty = materialQtyFromDv(dv);
  const unit = materialUnitFromDv(dv);
  const kind = safeStr(dv?.kind);
  const materialKey = safeStr(
    dv?.attrs?.materialKey || dv?.attrs?.productoId || ""
  );

  const consultText =
    safeStr(input.note) ||
    `Consulta circular para MO · ${title}${qty > 0 ? ` · ${qty} ${unit}` : ""}`;

  const consultDv = {
    id: uid("mt.consult"),
    kind: "mt.consult",
    attrs: {
      threadId,
      sellerId: "mo",
      sellerName: "MO",
      toActorId: "mo",
      toActorName: "MO",
      buyerId: actorId,
      buyerName: actorName,
      actorId,
      actorName,
      orgId: orgId || null,
      territoryId: territoryId || null,
      source: "ms.web.circular.mo",
      sourceKind: kind,
      sourceDvId: dv?.id || null,
      materialKey: materialKey || null,
      materialName: title,
      quantity: qty,
      unit,
      text: consultText,
      unreadBy: ["mo"],
      participants: [actorId, "mo"],
    },
    traits: ["mt:consult", "mt:circular", "mo:lead", "mt:thread"],
    meta: {
      ns,
      ts,
      scopes,
      threadId,
      source: "ms.web.circular.consult",
      respondsTo: dv?.id || null,
    },
  };

  const tradeMessageDv = {
    id: uid("trade.message"),
    kind: "trade.message",
    attrs: {
      threadId,
      sellerId: "mo",
      sellerName: "MO",
      toActorId: "mo",
      toActorName: "MO",
      actorId,
      actorName,
      orgId: orgId || null,
      territoryId: territoryId || null,
      text: consultText,
      kind: "circular.mo.consult",
      sourceDvId: dv?.id || null,
      unreadBy: ["mo"],
      participants: [actorId, "mo"],
    },
    traits: ["mt:thread", "mt:circular", "mo:lead"],
    meta: {
      ns,
      ts,
      scopes,
      threadId,
      source: "ms.web.circular.trade.message",
    },
  };

  mtLiveUpsert(consultDv as any);
  mtLiveUpsert(tradeMessageDv as any);

  emitUtopy({
    ns: "mt",
    say: "dv.upsert",
    dv: consultDv,
  });

  emitUtopy({
    ns: "mt",
    say: "dv.upsert",
    dv: tradeMessageDv,
  });

  let actionMsg: any = null;

  if (input.runAction && input.action) {
    actionMsg = {
      kind: "action.run",
      id: uid("action"),
      action: input.action,
      input: {
        dvId: dv?.id || null,
        dv,
        facets: {
          primary: {
            kind: input.action,
          },
          source: {
            section: "circular",
            sourceKind: kind,
          },
          consult: {
            threadId,
            sellerId: "mo",
            toActorId: "mo",
          },
        },
      },
      meta: {
        ns: "mo",
        scopes,
        worldId,
        ts: Date.now(),
        from: "mt",
        threadId,
      },
    };

    emitUtopy({
      ns: "mt",
      say: "action.run",
      payload: actionMsg,
    });
  }

  try {
    await setNamespaceTag(ns || "mt:market");
  } catch {
    // noop
  }

  return {
    threadId,
    consultDv,
    tradeMessageDv,
    actionMsg,
  };
}