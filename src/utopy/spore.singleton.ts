// src/utopy/spore.singleton.ts
import { UtopySpore } from "./spore";

// 🔔 Bus local sólo para la web (mercado, etc.)
type Listener = (msg: any) => void;
const seedEchoListeners = new Set<Listener>();

export function onSeedEcho(listener: Listener) {
  seedEchoListeners.add(listener);
  return () => seedEchoListeners.delete(listener);
}

function notifySeedEcho(msg: any) {
  for (const fn of seedEchoListeners) {
    try {
      fn(msg);
    } catch (e) {
      console.warn("[UTOPY web] error en listener de seedEcho:", e);
    }
  }
}

const spore = new UtopySpore({
  onState: (s) => console.log("[UTOPY state]", s),

  onLog: (l) => {
    console.log("[UTOPY log]", l);

    let msg: any;
    try {
      // Lo que nos llega desde UtopySpore suele ser JSON plano del frame WS
      msg = typeof l === "string" ? JSON.parse(l) : l;
    } catch {
      // Si no es JSON, ignoramos
      return;
    }

    // 1) Modelo viejo: { ack:true, echo:"{...}" }
    if (msg.ack && typeof msg.echo === "string") {
      let inner: any = msg.echo;
      try {
        inner = JSON.parse(msg.echo);
      } catch {
        // si no parsea, usamos el string crudo
      }

      // Enviamos el contenido interno a los listeners
      notifySeedEcho(inner);
      return;
    }

    // 2) Modelo nuevo: frames crudos desde el seed:
    //    { kind:"producto", ... }, { kind:"dato.query", ... }, etc.
    if (msg.kind) {
      // Ignoramos señales internas de roster
      if (msg.kind === "seed.signal") {
        // opcional: console.log("[UTOPY web] seed.signal:", msg);
        return;
      }

      // Cualquier otro frame con kind lo pasamos al hook
      notifySeedEcho(msg);
      return;
    }

    // 3) Si llega algo raro sin kind/echo, lo ignoramos
  },

  // Si ya tenías más opciones (wsUrl, token, etc.), mantenelas aquí
  // wsUrl: "...",
  // token: "...",
});

export { spore };
