import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { selectShellAssets } from "./utils/publicAssetPolicy";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// El shell y Market quedan disponibles sin conexión. Vistas pesadas que el
// usuario todavía no abrió (mapa, Falcon, AR, checkout, documentos) no se
// descargan durante la instalación inicial del worker.
const OPTIONAL_CHUNK = /(?:model-viewer|leaflet|circularcenter|circularGeographicMap|falcon|checkoutmodal|html2canvas|exito-|renta-|totem-|login-)/i;
precacheAndRoute(selectShellAssets(self.__WB_MANIFEST, OPTIONAL_CHUNK));

function safeWakePayload(event) {
  try {
    const value = event.data?.json();
    if (!value || value.kind !== "frequency.wake") return null;
    return {
      frequencyId: String(value.frequencyId || "").slice(0, 160),
      reference: String(value.reference || "").slice(0, 160),
      revision: Number(value.revision || 0),
    };
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const wake = safeWakePayload(event);
  if (!wake?.frequencyId) return;
  event.waitUntil(self.registration.showNotification("⌁ Algo resuena con vos", {
    body: "Abrí UTOPY para descubrirlo.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `frequency:${wake.frequencyId}`,
    renotify: false,
    data: wake,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL("/market", self.location.origin);
  url.searchParams.set("frequencyId", String(data.frequencyId || ""));
  if (data.reference) url.searchParams.set("reference", String(data.reference));
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const current = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (current) {
      await current.navigate(url.href);
      return current.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
