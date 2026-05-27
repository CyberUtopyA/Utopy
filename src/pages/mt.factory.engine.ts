export type AnyDV = any;

export type FactoryEngineOptions = {
  ns?: string;
  selfActorId?: string | null;
  maxSuggestionsPerDemand?: number;
  autoNegotiate?: boolean;
  autoPlanFromDemand?: boolean;
  minScoreToSuggest?: number;
  emitDV?: (dv: AnyDV) => Promise<void> | void;
  sayAction?: (action: string, payload?: any, meta?: any) => Promise<void> | void;
};

export type FactoryDemand = {
  dv: AnyDV;
  id: string;
  threadId: string;
  title: string;
  materialKey: string;
  materialName: string;
  quantity: number;
  unit: string;
  budget?: number | null;
  location?: string | null;
  notes?: string | null;
  source?: string | null;
  ts: number;
};

export type FactoryOffer = {
  dv: AnyDV;
  id: string;
  productId: string;
  materialKey: string;
  materialName: string;
  quantity: number;
  unit: string;
  price?: number | null;
  sellerId?: string | null;
  sellerName?: string | null;
  threadId?: string | null;
  ts: number;
};

export type FactoryWork = {
  dv: AnyDV;
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  title: string;
  skills: string[];
  capacity?: string | null;
  location?: string | null;
  ts: number;
};

export type FactoryMatch = {
  demandId: string;
  offerId: string;
  score: number;
  reasons: string[];
  demand: FactoryDemand;
  offer: FactoryOffer;
};

export type FactorySuggestion = {
  demandId: string;
  type: "buy-material" | "ask-mo-plan" | "route-production" | "publish-demand";
  score: number;
  title: string;
  summary: string;
  payload?: Record<string, any>;
};

export type FactoryRouteStep =
  | {
      type: "material";
      title: string;
      status: "ready" | "missing";
      demandId: string;
      materialKey: string;
      quantity: number;
      unit: string;
      matchedOfferId?: string;
      sellerId?: string | null;
    }
  | {
      type: "work";
      title: string;
      status: "ready" | "missing";
      demandId: string;
      requiredSkill: string;
      actorId?: string | null;
    }
  | {
      type: "design";
      title: string;
      status: "ready" | "missing";
      demandId: string;
      action: string;
    };

export type FactoryRoute = {
  demandId: string;
  title: string;
  score: number;
  steps: FactoryRouteStep[];
};

export type FactoryEngineSnapshot = {
  demands: FactoryDemand[];
  offers: FactoryOffer[];
  works: FactoryWork[];
  matches: FactoryMatch[];
  suggestions: FactorySuggestion[];
  routes: FactoryRoute[];
};

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x: any, fb = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function normKey(x: any): string {
  return safeStr(x).trim().toLowerCase();
}

function hasTrait(dv: any, trait: string): boolean {
  return Array.isArray(dv?.traits) && dv.traits.includes(trait);
}

function tsOf(dv: any): number {
  const raw = dv?.ts ?? dv?.meta?.ts ?? dv?.attrs?.ts;
  if (typeof raw === "number") return raw;
  const n = Date.parse(String(raw || ""));
  return Number.isFinite(n) ? n : Date.now();
}

function getThreadId(dv: any): string {
  return safeStr(dv?.meta?.threadId || dv?.attrs?.threadId || dv?.id);
}

function getDemandMaterialKey(dv: any): string {
  return normKey(
    dv?.attrs?.materialKey ||
      dv?.attrs?.productoId ||
      dv?.meta?.materialKey ||
      dv?.meta?.productKey
  );
}

function getDemandMaterialName(dv: any): string {
  return safeStr(
    dv?.attrs?.materialName ||
      dv?.attrs?.title ||
      dv?.meta?.name ||
      dv?.attrs?.productoNombre ||
      "Material"
  );
}

function getDemandUnit(dv: any): string {
  return safeStr(dv?.attrs?.unit || dv?.attrs?.unidad || "u");
}

function getDemandQuantity(dv: any): number {
  return Math.max(0, toNum(dv?.attrs?.quantity || dv?.attrs?.cantidad, 0));
}

function getDemandBudget(dv: any): number | null {
  const n = Number(dv?.attrs?.budget ?? dv?.attrs?.presupuesto);
  return Number.isFinite(n) ? n : null;
}

function getDemandLocation(dv: any): string | null {
  const s = safeStr(dv?.attrs?.location || dv?.attrs?.ubicacion || "");
  return s || null;
}

function isDemandDV(dv: any): boolean {
  const kind = safeStr(dv?.kind).toLowerCase();
  return (
    kind === "mt.demand" ||
    kind === "mt:demand" ||
    hasTrait(dv, "mt:demand") ||
    hasTrait(dv, "mt:factory")
  );
}

function isOfferDV(dv: any): boolean {
  const kind = safeStr(dv?.kind).toLowerCase();
  const side = safeStr(dv?.attrs?.side || dv?.meta?.side).toLowerCase();
  const tipo = safeStr(dv?.attrs?.tipo || dv?.meta?.tipo).toLowerCase();
  return (
    kind === "mt.offer" ||
    kind === "mt:offer" ||
    side === "sell" ||
    tipo === "venta" ||
    hasTrait(dv, "mt:supply")
  );
}

function isWorkDV(dv: any): boolean {
  const kind = safeStr(dv?.kind).toLowerCase();
  return (
    kind === "mt.work" ||
    kind === "mt:work" ||
    hasTrait(dv, "mt:work") ||
    hasTrait(dv, "mt:service")
  );
}

function demandFromDV(dv: AnyDV): FactoryDemand | null {
  const materialKey = getDemandMaterialKey(dv);
  if (!materialKey) return null;

  return {
    dv,
    id: safeStr(dv?.id),
    threadId: getThreadId(dv),
    title: safeStr(dv?.attrs?.title || dv?.meta?.name || "Demanda"),
    materialKey,
    materialName: getDemandMaterialName(dv),
    quantity: getDemandQuantity(dv),
    unit: getDemandUnit(dv),
    budget: getDemandBudget(dv),
    location: getDemandLocation(dv),
    notes: safeStr(dv?.attrs?.description || dv?.attrs?.notes || "") || null,
    source: safeStr(dv?.attrs?.source || dv?.meta?.source || "") || null,
    ts: tsOf(dv),
  };
}

function offerFromDV(dv: AnyDV): FactoryOffer | null {
  const materialKey = normKey(
    dv?.attrs?.productoId ||
      dv?.attrs?.materialKey ||
      dv?.meta?.productKey ||
      dv?.meta?.materialKey
  );
  if (!materialKey) return null;

  return {
    dv,
    id: safeStr(dv?.id),
    productId: safeStr(dv?.attrs?.productoId || materialKey),
    materialKey,
    materialName: safeStr(
      dv?.attrs?.materialName || dv?.attrs?.title || dv?.meta?.name || "Oferta"
    ),
    quantity: Math.max(
      0,
      toNum(dv?.attrs?.cantidad || dv?.attrs?.quantity || dv?.attrs?.stock, 0)
    ),
    unit: safeStr(dv?.attrs?.unit || dv?.attrs?.unidad || "u"),
    price: (() => {
      const n = Number(dv?.attrs?.precio ?? dv?.attrs?.price);
      return Number.isFinite(n) ? n : null;
    })(),
    sellerId: safeStr(
      dv?.attrs?.sellerId ||
        dv?.attrs?.author?.id ||
        dv?.attrs?.vendor?.id ||
        dv?.meta?.sellerId ||
        ""
    ) || null,
    sellerName: safeStr(
      dv?.attrs?.sellerName ||
        dv?.attrs?.author?.name ||
        dv?.attrs?.vendor?.name ||
        dv?.meta?.sellerName ||
        ""
    ) || null,
    threadId: safeStr(dv?.attrs?.threadId || dv?.meta?.threadId || "") || null,
    ts: tsOf(dv),
  };
}

function workFromDV(dv: AnyDV): FactoryWork | null {
  const title = safeStr(dv?.attrs?.title || dv?.meta?.name || "");
  const skillsRaw = dv?.attrs?.skills;
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((x: any) => normKey(x)).filter(Boolean)
    : [];

  if (!title && !skills.length) return null;

  return {
    dv,
    id: safeStr(dv?.id),
    actorId: safeStr(dv?.attrs?.actorId || dv?.attrs?.author?.id || "") || null,
    actorName: safeStr(dv?.attrs?.actorName || dv?.attrs?.author?.name || "") || null,
    title: title || "Trabajo",
    skills,
    capacity: safeStr(dv?.attrs?.capacity || "") || null,
    location: safeStr(dv?.attrs?.location || "") || null,
    ts: tsOf(dv),
  };
}

function scoreDemandOffer(demand: FactoryDemand, offer: FactoryOffer): FactoryMatch | null {
  if (demand.materialKey !== offer.materialKey) return null;
  if (offer.quantity <= 0) return null;

  let score = 0;
  const reasons: string[] = [];

  score += 50;
  reasons.push("material-key");

  if (offer.quantity >= demand.quantity && demand.quantity > 0) {
    score += 22;
    reasons.push("stock-ok");
  } else if (offer.quantity > 0) {
    score += 8;
    reasons.push("stock-partial");
  }

  if (demand.unit && offer.unit && normKey(demand.unit) === normKey(offer.unit)) {
    score += 8;
    reasons.push("unit-match");
  }

  if (demand.budget != null && offer.price != null) {
    if (offer.price <= demand.budget) {
      score += 12;
      reasons.push("price-within-budget");
    } else {
      score -= 10;
      reasons.push("price-over-budget");
    }
  }

  const freshnessHours = Math.max(0, (Date.now() - offer.ts) / 3600000);
  if (freshnessHours < 24) {
    score += 6;
    reasons.push("fresh-offer");
  } else if (freshnessHours < 72) {
    score += 3;
  }

  return {
    demandId: demand.id,
    offerId: offer.id,
    score,
    reasons,
    demand,
    offer,
  };
}

function suggestionForDemand(
  demand: FactoryDemand,
  matches: FactoryMatch[],
  opts: Required<Pick<FactoryEngineOptions, "minScoreToSuggest">>
): FactorySuggestion[] {
  const best = matches[0];
  const out: FactorySuggestion[] = [];

  if (best && best.score >= opts.minScoreToSuggest) {
    out.push({
      demandId: demand.id,
      type: "buy-material",
      score: best.score,
      title: `Tomar oferta para ${demand.materialName}`,
      summary: `${best.offer.sellerName || best.offer.sellerId || "Proveedor"} puede cubrir ${Math.min(
        demand.quantity,
        best.offer.quantity
      )} ${demand.unit}.`,
      payload: {
        demandId: demand.id,
        offerId: best.offer.id,
        threadId: demand.threadId,
        sellerId: best.offer.sellerId,
        productId: best.offer.productId,
      },
    });
  } else {
    out.push({
      demandId: demand.id,
      type: "publish-demand",
      score: 40,
      title: `Publicar / reforzar demanda de ${demand.materialName}`,
      summary: "No hay oferta suficiente. Conviene mantener la demanda visible o re-publicarla.",
      payload: {
        demandId: demand.id,
        materialKey: demand.materialKey,
        quantity: demand.quantity,
      },
    });
  }

  out.push({
    demandId: demand.id,
    type: "ask-mo-plan",
    score: 52,
    title: `Pedir plan a MO para ${demand.materialName}`,
    summary: "Generar o ajustar diseño/plano para convertir la demanda en producción concreta.",
    payload: {
      demandId: demand.id,
      threadId: demand.threadId,
      action: "mo.plan.from.demand",
    },
  });

  out.push({
    demandId: demand.id,
    type: "route-production",
    score: (best?.score ?? 20) + 5,
    title: `Armar ruta de producción para ${demand.materialName}`,
    summary: "Combinar material, trabajo y diseño en una ruta productiva viva.",
    payload: {
      demandId: demand.id,
      materialKey: demand.materialKey,
      threadId: demand.threadId,
    },
  });

  return out;
}

function inferSkillForMaterial(materialKey: string): string {
  const k = materialKey.toLowerCase();
  if (k.includes("madera") || k.includes("ply") || k.includes("mdf")) return "carpinteria";
  if (k.includes("metal")) return "metalurgia";
  if (k.includes("acm") || k.includes("panel")) return "corte";
  return "fabricacion";
}

function buildRoute(
  demand: FactoryDemand,
  matches: FactoryMatch[],
  works: FactoryWork[]
): FactoryRoute {
  const best = matches[0];
  const requiredSkill = inferSkillForMaterial(demand.materialKey);

  const worker = works.find((w) => w.skills.includes(requiredSkill));

  const steps: FactoryRouteStep[] = [
    best
      ? {
          type: "material",
          title: `Material listo: ${demand.materialName}`,
          status: "ready",
          demandId: demand.id,
          materialKey: demand.materialKey,
          quantity: demand.quantity,
          unit: demand.unit,
          matchedOfferId: best.offer.id,
          sellerId: best.offer.sellerId,
        }
      : {
          type: "material",
          title: `Falta material: ${demand.materialName}`,
          status: "missing",
          demandId: demand.id,
          materialKey: demand.materialKey,
          quantity: demand.quantity,
          unit: demand.unit,
        },
    worker
      ? {
          type: "work",
          title: `Trabajo listo: ${worker.title}`,
          status: "ready",
          demandId: demand.id,
          requiredSkill,
          actorId: worker.actorId,
        }
      : {
          type: "work",
          title: `Falta capacidad: ${requiredSkill}`,
          status: "missing",
          demandId: demand.id,
          requiredSkill,
        },
    {
      type: "design",
      title: "MO puede generar plan y preparación",
      status: "ready",
      demandId: demand.id,
      action: "mo.plan.from.demand",
    },
  ];

  const score =
    (best ? Math.min(60, best.score) : 15) +
    (worker ? 25 : 0) +
    15;

  return {
    demandId: demand.id,
    title: `Ruta productiva · ${demand.materialName}`,
    score,
    steps,
  };
}

function buildNegotiationDV(match: FactoryMatch): AnyDV {
  return {
    id: `mt.negotiation.suggest:${match.demand.id}:${match.offer.id}:${Date.now()}`,
    kind: "mt.negotiation.suggest",
    traits: ["mt:negotiation", "mt:factory", "mt:match"],
    ts: Date.now(),
    attrs: {
      demandId: match.demand.id,
      offerId: match.offer.id,
      materialKey: match.demand.materialKey,
      quantity: match.demand.quantity,
      unit: match.demand.unit,
      suggestedPrice: match.offer.price,
      sellerId: match.offer.sellerId,
      sellerName: match.offer.sellerName,
    },
    meta: {
      ns: "mt:market",
      threadId: match.demand.threadId,
      source: "mt.factory.engine",
      scopes: ["public"],
    },
  };
}

function buildRouteDV(route: FactoryRoute): AnyDV {
  return {
    id: `mt.factory.route:${route.demandId}:${Date.now()}`,
    kind: "mt.factory.route",
    traits: ["mt:factory", "mt:route", "mt:production"],
    ts: Date.now(),
    attrs: {
      demandId: route.demandId,
      title: route.title,
      score: route.score,
      steps: route.steps,
    },
    meta: {
      ns: "mt:market",
      source: "mt.factory.engine",
      scopes: ["public"],
    },
  };
}

export class MTFactoryEngine {
  private opts: Required<FactoryEngineOptions>;

  constructor(options?: FactoryEngineOptions) {
    this.opts = {
      ns: options?.ns || "mt:market",
      selfActorId: options?.selfActorId ?? null,
      maxSuggestionsPerDemand: options?.maxSuggestionsPerDemand ?? 3,
      autoNegotiate: options?.autoNegotiate ?? false,
      autoPlanFromDemand: options?.autoPlanFromDemand ?? false,
      minScoreToSuggest: options?.minScoreToSuggest ?? 55,
      emitDV: options?.emitDV ?? (() => {}),
      sayAction: options?.sayAction ?? (() => {}),
    };
  }

  snapshotFromDV(items: AnyDV[]): FactoryEngineSnapshot {
    const filtered = (items || []).filter((dv) => {
      const ns = safeStr(dv?.meta?.ns || "");
      return !this.opts.ns || !ns || ns === this.opts.ns;
    });

    const demands = filtered.filter(isDemandDV).map(demandFromDV).filter(Boolean) as FactoryDemand[];
    const offers = filtered.filter(isOfferDV).map(offerFromDV).filter(Boolean) as FactoryOffer[];
    const works = filtered.filter(isWorkDV).map(workFromDV).filter(Boolean) as FactoryWork[];

    const matches = demands
      .flatMap((d) => offers.map((o) => scoreDemandOffer(d, o)))
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score) as FactoryMatch[];

    const suggestions = demands.flatMap((demand) => {
      const own = matches
        .filter((m) => m.demandId === demand.id)
        .sort((a, b) => b.score - a.score);
      return suggestionForDemand(demand, own, {
        minScoreToSuggest: this.opts.minScoreToSuggest,
      }).slice(0, this.opts.maxSuggestionsPerDemand);
    });

    const routes = demands.map((demand) => {
      const own = matches
        .filter((m) => m.demandId === demand.id)
        .sort((a, b) => b.score - a.score);
      return buildRoute(demand, own, works);
    });

    return { demands, offers, works, matches, suggestions, routes };
  }

  async autoRun(items: AnyDV[]): Promise<FactoryEngineSnapshot> {
    const snapshot = this.snapshotFromDV(items);

    if (this.opts.autoNegotiate) {
      const topMatches = snapshot.matches
        .filter((m) => m.score >= this.opts.minScoreToSuggest)
        .slice(0, 8);

      for (const match of topMatches) {
        await this.opts.emitDV(buildNegotiationDV(match));
      }
    }

    for (const route of snapshot.routes) {
      await this.opts.emitDV(buildRouteDV(route));
    }

    if (this.opts.autoPlanFromDemand) {
      for (const demand of snapshot.demands) {
        await this.opts.sayAction(
          "mo.plan.from.demand",
          {
            demandId: demand.id,
            threadId: demand.threadId,
            materialKey: demand.materialKey,
            materialName: demand.materialName,
            quantity: demand.quantity,
            unit: demand.unit,
            budget: demand.budget,
            location: demand.location,
            notes: demand.notes,
          },
          {
            ns: "mt:market",
            source: "mt.factory.engine",
            threadId: demand.threadId,
          }
        );
      }
    }

    return snapshot;
  }

  async suggestForDemand(demandDV: AnyDV, allItems: AnyDV[]) {
    const demand = demandFromDV(demandDV);
    if (!demand) return null;

    const snapshot = this.snapshotFromDV(allItems);
    const ownMatches = snapshot.matches
      .filter((m) => m.demandId === demand.id)
      .sort((a, b) => b.score - a.score);

    const ownSuggestions = suggestionForDemand(demand, ownMatches, {
      minScoreToSuggest: this.opts.minScoreToSuggest,
    });

    const route = buildRoute(demand, ownMatches, snapshot.works);

    return {
      demand,
      matches: ownMatches,
      suggestions: ownSuggestions,
      route,
    };
  }
}

export function createMTFactoryEngine(options?: FactoryEngineOptions) {
  return new MTFactoryEngine(options);
}