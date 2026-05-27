import { ActOutcome, Intent, MindContext, Skill } from "./mind";

export const SkillContext: Skill = {
  id: "skill.context",

  affordance(intent) {
    return ["set_modo","belief_set","symbol_boost"].includes(intent.goal) ? 0.95 : 0;
  },

  async act(intent: Intent, ctx: MindContext): Promise<ActOutcome> {
    if (intent.goal === "set_modo") {
      const modo = intent.args?.modo ?? "normal";
      ctx.beliefs.set("modo", { key:"modo", value: modo, weight: 3 });
      ctx.publish({ type:"context:modo", value: modo });
      return { ok: true, info: { modo } };
    }

    if (intent.goal === "belief_set") {
      const { key, value, weight = 1, ttl } = intent.args || {};
      if (!key) return { ok:false, info:"missing key" };
      ctx.beliefs.set(key, { key, value, weight, ttl });
      ctx.publish({ type:"context:belief", key, value, weight, ttl });
      return { ok: true, info: { key, value } };
    }

    if (intent.goal === "symbol_boost") {
      const { ns = "global", symbol, add = 1, patch = {} } = intent.args || {};
      if (!symbol) return { ok:false, info:"missing symbol" };
      const key = `${ns}:${symbol}`;
      const old = ctx.symbols.get(key) || {};
      const weight = (old.weight ?? 1) + add;
      const meaning = { ...old, ...patch, weight };
      ctx.symbols.set(key, meaning);
      ctx.publish({ type:"context:symbol", ns, symbol, meaning });
      return { ok: true, info: { ns, symbol, weight } };
    }

    return { ok: false, info: "unknown goal" };
  }
};
