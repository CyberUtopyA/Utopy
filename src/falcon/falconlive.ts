type Listener = (all: any[]) => void;

let items: any[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...items];
  for (const cb of listeners) {
    try {
      cb(snapshot);
    } catch (err) {
      console.warn("[FalconLiveStore] listener error", err);
    }
  }
}

function sameId(a: any, b: any) {
  return String(a?.id || "") === String(b?.id || "");
}

export function falconLiveGetAll() {
  return [...items];
}

export function falconLiveReset(next: any[] = []) {
  items = Array.isArray(next) ? [...next] : [];
  emit();
}

export function falconLiveUpsert(dv: any) {
  if (!dv || typeof dv !== "object") return;
  if (!dv.id || !dv.kind) return;

  const idx = items.findIndex((x) => sameId(x, dv));
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...dv };
  } else {
    items = [dv, ...items];
  }

  emit();
}

export function falconLiveUpsertMany(list: any[]) {
  if (!Array.isArray(list)) return;
  for (const dv of list) {
    if (!dv || typeof dv !== "object") continue;
    if (!dv.id || !dv.kind) continue;

    const idx = items.findIndex((x) => sameId(x, dv));
    if (idx >= 0) items[idx] = { ...items[idx], ...dv };
    else items.push(dv);
  }
  emit();
}

export function falconLiveSubscribe(cb: Listener) {
  listeners.add(cb);
  try {
    cb([...items]);
  } catch {}

  return () => {
    listeners.delete(cb);
  };
}