import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchLoyaltyPassport,
  LOYALTY_SOURCES,
  loyaltyStorageKey,
  type LoyaltyPassport,
  type LoyaltySource,
} from "./loyalty.sources";

export type LoyaltyState = {
  source: LoyaltySource;
  memberId: string;
  passport: LoyaltyPassport | null;
  loading: boolean;
  error: string;
};

function savedMemberId(sourceId: string) {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(loyaltyStorageKey(sourceId)) || "";
}

export function useLoyaltyPassports() {
  const [states, setStates] = useState<Record<string, LoyaltyState>>(() =>
    Object.fromEntries(
      LOYALTY_SOURCES.map((source) => [
        source.id,
        {
          source,
          memberId: savedMemberId(source.id),
          passport: null,
          loading: false,
          error: "",
        },
      ]),
    ),
  );

  const load = useCallback(async (sourceId: string, explicitMemberId?: string) => {
    const source = LOYALTY_SOURCES.find((item) => item.id === sourceId);
    if (!source) return;
    const memberId = (explicitMemberId ?? states[sourceId]?.memberId ?? "").trim();
    if (!memberId) return;
    setStates((current) => ({
      ...current,
      [sourceId]: { ...current[sourceId], source, memberId, loading: true, error: "" },
    }));
    try {
      const passport = await fetchLoyaltyPassport(source, memberId);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(loyaltyStorageKey(sourceId), memberId);
      }
      setStates((current) => ({
        ...current,
        [sourceId]: { ...current[sourceId], source, memberId, passport, loading: false, error: "" },
      }));
    } catch (error: any) {
      setStates((current) => ({
        ...current,
        [sourceId]: {
          ...current[sourceId],
          source,
          memberId,
          passport: null,
          loading: false,
          error: error?.message || "No se pudo leer esta tarjeta.",
        },
      }));
    }
  }, [states]);

  const link = useCallback((sourceId: string, memberId: string) => load(sourceId, memberId), [load]);

  const unlink = useCallback((sourceId: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(loyaltyStorageKey(sourceId));
    }
    setStates((current) => {
      const source = current[sourceId]?.source || LOYALTY_SOURCES.find((item) => item.id === sourceId)!;
      return {
        ...current,
        [sourceId]: { source, memberId: "", passport: null, loading: false, error: "" },
      };
    });
  }, []);

  useEffect(() => {
    let linkedFromUrl = false;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sourceId = (params.get("utopy_loyalty_source") || "").trim();
      const memberId = (params.get("utopy_loyalty_id") || "").trim();
      if (sourceId && memberId && LOYALTY_SOURCES.some((source) => source.id === sourceId)) {
        linkedFromUrl = true;
        void load(sourceId, memberId);
        params.delete("utopy_loyalty_source");
        params.delete("utopy_loyalty_id");
        const cleanSearch = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`);
      }
    }
    LOYALTY_SOURCES.forEach((source) => {
      const memberId = savedMemberId(source.id);
      if (memberId && !linkedFromUrl) void load(source.id, memberId);
    });
    // Primera sincronización solamente; las siguientes se hacen con Actualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      cards: LOYALTY_SOURCES.map((source) => states[source.id]),
      link,
      unlink,
      refresh: (sourceId: string) => load(sourceId),
    }),
    [states, link, unlink, load],
  );
}
