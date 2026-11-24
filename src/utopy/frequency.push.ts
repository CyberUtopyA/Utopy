import { createSignedMarketEnvelope } from "./MarketRuntimeAdapter";

function baseUrl() {
  return String(
    (import.meta as any)?.env?.VITE_UTOPY_FREQUENCY_PUSH_BASE ||
      "https://seed.mterra.space/push",
  ).replace(/\/+$/, "");
}
function vapidBytes(value: string) {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function frequencyPushEnabled(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  return Boolean(await registration.pushManager.getSubscription());
}

export async function enableFrequencyPush(actorId: string) {
  const base = baseUrl();
  if (!base) throw new Error("UTOPY Frequency Push Bridge no está configurado.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return false;
  const keyResponse = await fetch(`${base}/push/v1/vapid-public-key`, { credentials: "omit", headers: { Accept: "application/json" } });
  if (!keyResponse.ok) throw new Error("No se pudo obtener la clave pública de Frecuencia.");
  const keyPayload = await keyResponse.json();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(String(keyPayload.publicKey || keyPayload.key || "")) });
  const preferences = JSON.parse(localStorage.getItem("utopy.frequency.preferences.v1") || "null") || { mode: "soft" };
  const envelope = await createSignedMarketEnvelope("frequency.subscription.register", { actorId, subscription: subscription.toJSON(), attention: { mode: preferences.mode || "soft", wakeHintOnly: true } }, ["private"]);
  const response = await fetch(`${base}/push/v1/subscriptions/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope), credentials: "omit" });
  if (!response.ok) throw new Error("No se pudo registrar este dispositivo.");
  return true;
}

export async function disableFrequencyPush(actorId: string) {
  const base = baseUrl();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  if (base) {
    const envelope = await createSignedMarketEnvelope("frequency.subscription.remove", { actorId, endpoint: subscription.endpoint }, ["private"]);
    await fetch(`${base}/push/v1/subscriptions/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope), credentials: "omit" });
  }
  return subscription.unsubscribe();
}
