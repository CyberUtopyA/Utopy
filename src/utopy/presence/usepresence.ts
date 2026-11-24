import { useEffect } from "react";
import { usePresenceStore } from "./presence.store";

export function usePresence() {
  const store = usePresenceStore();

  useEffect(() => {
    const timer = window.setInterval(store.clearExpired, 15_000);
    return () => window.clearInterval(timer);
  }, [store.clearExpired]);

  return store;
}
