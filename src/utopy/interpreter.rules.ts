// Intérprete de REGLAS declarativas para que el nodo “se cree” su propia interpretación.
import { Datum, Intent, Interpreter, MindContext } from "./mind";

export type Rule = {
  // Condición de disparo (lee dato + contexto)
  when: (d: Datum, ctx: MindContext) => boolean;
  // Traducción a una o varias intenciones
  to:   (d: Datum, ctx: MindContext) => Intent[];
  // Peso opcional (sube confianza resultante)
  weight?: number;
};

export function makeRuleInterpreter(id: string, rules: Rule[]): Interpreter {
  return {
    id,
    score(d) {
      // si alguna regla podría aplicar, marcamos alta afinidad
      const hits = rules.some(r => {
        try { return !!r.when(d, (null as any)); } catch { return false; }
      });
      return hits ? 0.85 : 0;
    },
    interpret(d, ctx) {
      const outs: Intent[] = [];
      for (const r of rules) {
        try {
          if (r.when(d, ctx)) {
            const produced = r.to(d, ctx).map(it => ({
              ...it,
              confidence: Math.min(1, (it.confidence ?? 0.6) * (1 + (r.weight ?? 0) / 10)),
            }));
            outs.push(...produced);
          }
        } catch {}
      }
      return outs;
    },
  };
}
