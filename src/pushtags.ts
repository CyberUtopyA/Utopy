import OneSignal from "react-onesignal";
import { initOneSignal } from "./onesignal";

function clean(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[:.\-/\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
}

export function nsTag(ns: string) {
  return `ns_${clean(ns)}`;
}

export async function clearNamespaceTags(namespaces: string[]) {
  await initOneSignal();

  const allKeys = ["ns_all", ...namespaces.map(nsTag)];
  await OneSignal.User.removeTags(allKeys);
}

export async function setNamespaceTag(ns: string) {
  await initOneSignal();

  if (ns === "__ALL__") {
    await OneSignal.User.addTags({ ns_all: "1" });
    return;
  }

  await OneSignal.User.removeTags(["ns_all"]);
  await OneSignal.User.addTags({
    [nsTag(ns)]: "1",
  });
}