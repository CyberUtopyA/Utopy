import type { Skill, Intent, MindContext } from "./mind";

type AnyBio = {
  id: string;
  kind: string;
  attrs?: Record<string, any>;
  meta?: Record<string, any>;
};

function textMatch(obj: any, q: string) {
  const hay = JSON.stringify(obj ?? {}).toLowerCase();
  return hay.includes(q.toLowerCase());
}

export const SkillLocalStore: Skill = {
  id: "skill.localstore",

  // Qué tan apto soy para este intent (0..1)
  affordance(intent: Intent, _ctx: MindContext) {
    const G = intent.goal;
    // soportamos nombres “canónicos” y alias
    if (G === "registrar_bio" || G === "buscar_bio") return 0.9;
    if (G === "dato.create") return 0.85;           // alias de registrar_bio
    if (G === "dato.find" || G === "dato.query") return 0.85; // alias de buscar_bio
    return 0;
  },

  // Ejecuta el intent
  async act(intent: Intent, ctx: MindContext) {
    const G = intent.goal;
    const args = (intent as Intent & { args?: any }).args ?? {};

    // helpers de store (con fallback defensivo)
    const store = ctx.store || {
      get: async (_k: string) => undefined,
      set: async (_k: string, _v: any) => {},
      all: async (_p: string) => [] as Array<[string, any]>,
    };

    // normalizamos alias a los canónicos
    const goal =
      G === "dato.create" ? "registrar_bio" :
      (G === "dato.find" || G === "dato.query") ? "buscar_bio" :
      G;

    switch (goal) {
      case "registrar_bio": {
        const item = args.item as AnyBio ?? args; // permite pasar el objeto directo
        if (!item?.id || !item?.kind) {
          return { ok: false, info: { error: "item.id y item.kind son requeridos" } };
        }

        await store.set(`bio:${item.id}`, item);

        // Evento opcional
        ctx.publish?.({
          kind: "event.resonance",
          chans: ["mt", "bio"],
          payload: { action: "registrar_bio", item },
        });

        return { ok: true, info: { id: item.id } };
      }

      case "buscar_bio": {
        const where = args.where ?? {};
        const limit = args.limit ?? 100;

        const pairs = (await store.all("bio:")) as Array<[string, AnyBio]>;
        let items = pairs.map(([, v]) => v);

        if (where.kind) items = items.filter((b) => b.kind === where.kind);
        if (where.$text) items = items.filter((b) => textMatch(b, String(where.$text)));

        items = items.slice(0, limit);

        ctx.publish?.({
          kind: "event.resonance",
          chans: ["mt", "bio"],
          payload: { action: "buscar_bio", count: items.length },
        });

        return { ok: true, info: { items } };
      }

      default:
        return { ok: false, info: { error: "no_soy_apto" } };
    }
  },
};
