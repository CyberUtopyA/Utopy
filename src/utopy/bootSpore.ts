// src/utopy/bootSpore.ts
import manifest from "./manifest.prod.json";
import { sporeClient } from "./utopy.spore";
import { SkillLocalStore } from "./skills.localstore";
import { MindCore } from "./mind";
import { EmojiInterpreter, ADNInterpreter, SensorInterpreter } from "./interpreters";
import { makeRuleInterpreter, Rule } from "./interpreter.rules";
import { SkillVenta, SkillHuerta, SkillEnergia } from "./skills";
import { publish } from "./resonance";
import { SkillContext } from "./skills.context";
import { makeMirrorStore, makeRemoteSporeAdapter } from "./store.mirror";
import { makeAsyncStore } from "./store.local.async";

import { hear, dispatch } from "./symbol.bus"; // bus mínimo
import { UPortal } from "./ui/UniversalPortal"; // ⬅️ UniversalPortal
import { SymbiosisCore } from "./symbiosis.core";

declare const __DEV__: boolean | undefined;

// ---------------------------------------------------------------------
// Resolución segura de isDev (sin process directo ni import.meta)
// ---------------------------------------------------------------------
function resolveIsDev(): boolean {
  // 1) React Native / bundlers que definen __DEV__
  try {
    if (typeof __DEV__ !== "undefined") return !!__DEV__;
  } catch {
    // ignorar
  }

  // 2) Entornos Node / webpack que exponen process en globalThis
  try {
    const g: any = globalThis as any;
    const proc = g && g.process;
    if (proc && proc.env && typeof proc.env.NODE_ENV === "string") {
      return proc.env.NODE_ENV !== "production";
    }
  } catch {
    // ignorar
  }

  // 3) Fallback
  return false;
}

const isDev = resolveIsDev();

// Núcleo de simbiosis: si lo usas en este nodo, ya queda cableado
export const symCore = new SymbiosisCore();
symCore.wireToSpore(sporeClient);

export let mindRef: MindCore | null = null;

// Loop de sincronización remoto→local con backoff simple
function startMirrorPump(
  ctxStore: { set: (k: string, v: any) => Promise<void> },
  remoteAny: any,
  opts?: { intervalMs?: number; jitterMs?: number; maxBackoffMs?: number; prefix?: string }
) {
  const base = opts?.intervalMs ?? 15_000;
  const jitter = opts?.jitterMs ?? 3_000;
  const maxBackoff = opts?.maxBackoffMs ?? 60_000;
  const prefix = opts?.prefix ?? "dato:";
  const pullFn: (() => Promise<any[]>) =
    typeof remoteAny?.pullRemote === "function"
      ? remoteAny.pullRemote.bind(remoteAny)
      : typeof remoteAny?.pull === "function"
      ? remoteAny.pull.bind(remoteAny)
      : typeof remoteAny?.fetch === "function"
      ? remoteAny.fetch.bind(remoteAny)
      : async () => [];

  let stopped = false;
  let backoff = 0;
  async function tick() {
    if (stopped) return;
    try {
      const items = await pullFn();
      if (Array.isArray(items))
        for (const it of items) {
          const id = it?.id || `anon_${Math.random().toString(36).slice(2)}`;
          await ctxStore.set(`${prefix}${id}`, it);
        }
      backoff = 0;
    } catch {
      backoff = Math.min(maxBackoff, backoff ? backoff * 2 : base);
    } finally {
      const wait = (backoff || base) + Math.floor(Math.random() * jitter);
      setTimeout(tick, wait);
    }
  }
  tick();
  return () => {
    stopped = true;
  };
}

export async function bootSpore(opts?: { env?: string; platform?: string; token?: string }) {
  // 0) Registrar renderer por defecto del host (DVPortal si existe)
  if (!UPortal.has("default")) {
    const dv = (globalThis as any).__DVPORTAL__;
    if (dv?.mount) UPortal.register("default", (blocks) => dv.mount(blocks));
    else
      UPortal.register("default", (blocks) => {
        if (!blocks) return;
        console.log("[UPortal/default] blocks:", JSON.stringify(blocks));
      });
  }

  // 1) Spore on
  await sporeClient.init(manifest, { token: opts?.token });
  await sporeClient.announceSelf({
    env: opts?.env ?? (isDev ? "dev" : "prod"),
    platform: opts?.platform ?? "react-native",
  });

  // 2) Contexto de nodo para el bus simbólico
  const ctx: any = {
    me: sporeClient.getId?.() || "node@utopy",
    say: (i: any) => sporeClient.sayIntent(i),
    portal: UPortal,
  };

  // 3) Eventos de intención → bus + manifestación universal
  sporeClient.on("intent", (msg: any) => {
    const intent = msg?.payload || msg?.i || msg;
    if (intent?.sym && intent?.say) dispatch(intent, ctx);
  });

  // 4) (Opcional) Publicar capacidad para descubrimiento
  sporeClient
    .call("node.capability", {
      id: sporeClient.getId(),
      capabilities: ["seed"],
      ws: "wss://seed.mterra.space/utopy",
      scope: "public",
    })
    .catch(() => {});

  // 5) Mente viva
  const mind = new MindCore(publish);
  mind.useInterpreter(EmojiInterpreter).useInterpreter(ADNInterpreter).useInterpreter(SensorInterpreter);

  const reglas: Rule[] = [
    {
      when: (d) => d.kind === "emoji" && d.payload?.symbol === "🍞",
      to: () => [
        { goal: "symbol_boost", args: { ns: "mt", symbol: "🍞", add: 1 }, confidence: 0.7 },
      ],
    },
    {
      when: (d, ctx) =>
        d.kind === "medicion" &&
        d.payload?.tipo === "energia" &&
        typeof d.payload?.valor === "number" &&
        d.payload.valor >= (ctx.beliefs.get("energia:umbral")?.value ?? 2.0),
      to: () => [{ goal: "set_modo", args: { modo: "ahorro" }, confidence: 0.9 }],
      weight: 2,
    },
  ];
  const RulesNodal = makeRuleInterpreter("rules.nodal", reglas);
  mind.useInterpreter(RulesNodal);

  // 6) Persistencia: local-first + espejo
  const local = makeAsyncStore("utopy");
  const remote = makeRemoteSporeAdapter();
  (mind as any).ctx.store = makeMirrorStore(local, remote);

  const stopPump = startMirrorPump((mind as any).ctx.store, remote, {
    intervalMs: 15_000,
    jitterMs: 3_000,
    maxBackoffMs: 60_000,
    prefix: "dato:",
  });

  // 7) Skills
  mind
    .useSkill(SkillContext)
    .useSkill(SkillLocalStore)
    .useSkill(SkillVenta)
    .useSkill(SkillHuerta)
    .useSkill(SkillEnergia);

  // 8) Contexto inicial (opcional)
  mind.remember("modo", "feria", 3);
  mind.remember("energia:umbral", 2.0, 3);
  mind.learnSymbol("mt", "🧪", { goal: "medir_energia", weight: 2 });

  // 9) Bus genérico de render (cualquier nodo puede manifestar)
  hear("*", "render", (i: any) => {
    const blocks = i?.with?.blocks ?? null;
    const target = i?.ns || "default";
    UPortal.mount(blocks, target);
  });

  mindRef = mind;

  // Limpieza para hot-reload
  (globalThis as any).__UTOPY_STOP_PUMP__?.();
  (globalThis as any).__UTOPY_STOP_PUMP__ = stopPump;

  console.log("[UTOPY] spore + mind + mirror + UPortal + Symbiosis OK");
  return { sporeClient, mind };
}
