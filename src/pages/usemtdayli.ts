import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MT_DAYLI_NAMESPACES,
  emptyDayliState,
  extractDVFromAnyFrame,
  parseNsList,
  reduceDayliState,
  safeJsonParse,
  type FalconDayliCategory,
  type FalconDayliFood,
  type FalconDayliProducer,
  type FalconDayliState,
  type FalconDayliTerritory,
} from "./mtdaylibridge";

const MICELIO_HTTP =
  (import.meta as any)?.env?.VITE_MICELIO_HTTP ||
  "https://seed.mterra.space/micelio";

const SEED_WS =
  (import.meta as any)?.env?.VITE_SEED_WS ||
  "wss://seed.mterra.space/utopy?ns=mt";

const DAYLI_NS_RAW =
  (import.meta as any)?.env?.VITE_FALCON_DAYLI_NS ||
  DEFAULT_MT_DAYLI_NAMESPACES.join(",");

const SNAPSHOT_KEY = "falcon.dayli.snapshot.v1";

function persistSnapshot(state: FalconDayliState) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

function readSnapshot(): FalconDayliState | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      foods: Array.isArray(parsed?.foods) ? parsed.foods : [],
      producers: Array.isArray(parsed?.producers) ? parsed.producers : [],
      territories: Array.isArray(parsed?.territories) ? parsed.territories : [],
    };
  } catch {
    return null;
  }
}

function sortByScore<T extends { score?: number }>(items: T[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function filterFoodsByCategory(
  foods: FalconDayliFood[],
  cat: FalconDayliCategory | string
) {
  if (!cat) return sortByScore(foods);
  const q = String(cat).toLowerCase().trim();
  return sortByScore(
    foods.filter(
      (x) =>
        String(x.category).toLowerCase() === q ||
        x.tags.some((t) => String(t).toLowerCase().includes(q))
    )
  );
}

function groupFeaturedFoods(foods: FalconDayliFood[]) {
  return sortByScore(foods).slice(0, 12);
}

function groupTerritories(territories: FalconDayliTerritory[]) {
  return sortByScore(territories).slice(0, 8);
}

function groupProducers(producers: FalconDayliProducer[]) {
  return sortByScore(producers).slice(0, 8);
}

export function useFalconDayli(cat?: string) {
  const targetNamespaces = useMemo(() => parseNsList(DAYLI_NS_RAW), []);
  const [state, setState] = useState<FalconDayliState>(() => {
    return readSnapshot() || emptyDayliState();
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const snapshot = readSnapshot();
    return snapshot ? false : true;
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    function ingest(raw: any) {
      const dv = extractDVFromAnyFrame(raw) || raw;
      setState((prev) => {
        const next = reduceDayliState(prev, dv, targetNamespaces);
        persistSnapshot(next);
        return next;
      });
      if (alive) setLoading(false);
    }

    const ws = new WebSocket(SEED_WS);

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            kind: "query",
            id: "falcon:dayli:snapshot",
            where: {},
            limit: 5000,
            auth: "utopy-resonancia",
          })
        );
      } catch (err) {
        console.warn("[FalconDayli] ws query error", err);
      }
    };

    ws.onmessage = (ev) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;

      if (msg?.ok && Array.isArray(msg.items)) {
        for (const it of msg.items) ingest(it);
        if (alive) setLoading(false);
        return;
      }

      ingest(msg);
    };

    ws.onerror = () => {
      if (alive) setError("No se pudo abrir snapshot vivo de Dayli.");
    };

    const es = new EventSource(`${String(MICELIO_HTTP).replace(/\/$/, "")}/events`);

    const onAny = (ev: MessageEvent) => {
      const msg = safeJsonParse(ev.data);
      if (!msg) return;
      ingest(msg);
    };

    es.addEventListener("message", onAny);
    es.addEventListener("intent", onAny);
    es.addEventListener("dv", onAny);
    es.addEventListener("dato", onAny);

    es.onerror = () => {
      if (alive && !state.foods.length && !state.producers.length && !state.territories.length) {
        setError("No se pudo sincronizar Falcon Dayli en vivo.");
      }
    };

    return () => {
      alive = false;
      try {
        ws.close();
      } catch {
        // noop
      }
      try {
        es.close();
      } catch {
        // noop
      }
    };
  }, [targetNamespaces]);

  const foods = useMemo(() => sortByScore(state.foods), [state.foods]);
  const producers = useMemo(() => sortByScore(state.producers), [state.producers]);
  const territories = useMemo(() => sortByScore(state.territories), [state.territories]);

  const filteredFoods = useMemo(() => {
    if (!cat) return foods;
    return filterFoodsByCategory(foods, cat);
  }, [foods, cat]);

  const featuredFoods = useMemo(() => groupFeaturedFoods(foods), [foods]);
  const featuredTerritories = useMemo(() => groupTerritories(territories), [territories]);
  const featuredProducers = useMemo(() => groupProducers(producers), [producers]);

  const summary = useMemo(
    () => ({
      foods: foods.length,
      producers: producers.length,
      territories: territories.length,
      visible: filteredFoods.length,
      targetNamespaces,
    }),
    [foods.length, producers.length, territories.length, filteredFoods.length, targetNamespaces]
  );

  return {
    loading,
    error,
    summary,
    targetNamespaces,
    foods,
    filteredFoods,
    producers,
    territories,
    featuredFoods,
    featuredProducers,
    featuredTerritories,
    refreshFromSnapshot: () => {
      const snapshot = readSnapshot();
      if (snapshot) {
        setState(snapshot);
        setLoading(false);
      }
    },
  };
}