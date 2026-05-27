import { Datum, Intent, Interpreter, MindContext } from "./mind";

// Interpreta símbolos/emoji según diccionario vivo (ns + símbolo)
export const EmojiInterpreter: Interpreter = {
  id: "emoji.v1",
  score(d) { return d.kind === "emoji" ? 0.9 : 0; },
  interpret(d, ctx) {
    const { symbol, ns } = d.payload as { symbol: string; ns?: string };
    const key = `${ns ?? "global"}:${symbol}`;
    const meaning = ctx.symbols.get(key) || ctx.symbols.get(`global:${symbol}`);
    if (!meaning) return [];
    const intent: Intent = {
      goal: meaning.goal,
      args: meaning.args ?? {},
      confidence: Math.min(1, 0.55 + (meaning.weight ?? 1) / 10),
    };
    return meaning.goal ? [intent] : [];
  },
};

// Interpreta bloques ADN/DSL a metas del mundo (venta, siembra, energía)
export const ADNInterpreter: Interpreter = {
  id: "adn.v1",
  score(d) { return d.kind === "adn" ? 0.8 : 0; },
  interpret(d, _ctx) {
    const adn = d.payload || {};
    const goal = ({
      "venta.crear": "registrar_venta",
      "huerta.siembra": "siembra",
      "energia.medicion": "medir_energia",
    } as any)[adn.capacidad];
    return goal ? [{ goal, args: adn, confidence: 0.75 }] : [];
  },
};

// Interpreta mediciones (p. ej. energía) a registrar/alertar
export const SensorInterpreter: Interpreter = {
  id: "sensor.v1",
  score(d) { return d.kind === "medicion" ? 0.7 : 0; },
  interpret(d, ctx) {
    const { tipo, valor, unidad } = d.payload || {};
    if (tipo !== "energia" || typeof valor !== "number") return [];
    const umbral = ctx.beliefs.get("energia:umbral")?.value ?? 2.0;
    const goal = valor >= umbral ? "alerta_consumo" : "registrar_medicion";
    const conf = Math.min(1, 0.6 + (valor / 10));
    return [{ goal, args: { valor, unidad }, confidence: conf }];
  },
};
