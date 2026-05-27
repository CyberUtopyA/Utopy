import { ActOutcome, Intent, MindContext, Skill } from "./mind";

export const SkillVenta: Skill = {
  id: "skill.venta",
  affordance(intent) { return intent.goal === "registrar_venta" ? 0.95 : 0; },
  async act(intent, ctx) {
    ctx.publish({ type: "venta:registrada", venta: intent.args });
    return { ok: true, info: intent.args } satisfies ActOutcome;
  },
};

export const SkillHuerta: Skill = {
  id: "skill.huerta",
  affordance(intent) { return ["siembra","regar","cosecha"].includes(intent.goal) ? 0.9 : 0; },
  async act(intent, ctx) {
    ctx.publish({ type: "huerta:evento", goal: intent.goal, args: intent.args });
    return { ok: true };
  },
};

export const SkillEnergia: Skill = {
  id: "skill.energia",
  affordance(intent) { return ["registrar_medicion","alerta_consumo","medir_energia"].includes(intent.goal) ? 0.9 : 0; },
  async act(intent, ctx) {
    ctx.publish({ type: "energia:evento", goal: intent.goal, args: intent.args });
    return { ok: true };
  },
};
