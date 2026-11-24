// src/value/useUtopyValue.ts
// Descubre cualquier fidelización/confianza publicada por cualquier nodo.

import { useEffect, useMemo, useState } from "react";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { nodeIdentityOf, nodeNameOf, normalizeSemantic } from "../mt/utopy.symbiosis";

export type UtopyLoyaltyProgram = {
  id: string;
  nodeId: string;
  nodeName: string;
  name: string;
  unit: string;
  target: number;
  lookupEndpoint?: string;
  credentialParam: string;
  credentialPattern?: string;
  raw: any;
};

export type UtopyValueState = {
  programId: string;
  loading: boolean;
  error?: string;
  passport?: any;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function isKind(dv: any, kind: string) {
  return normalizeSemantic(dv?.kind) === normalizeSemantic(kind);
}

function asProgram(dv: any): UtopyLoyaltyProgram | null {
  if (!isKind(dv, "loyalty.program")) return null;
  const attrs = dv.attrs || {};
  const lookup = attrs.lookup || attrs.read || {};
  return {
    id: text(dv.id),
    nodeId: nodeIdentityOf(dv),
    nodeName: nodeNameOf(dv),
    name: text(attrs.name || attrs.program || dv.labels?.[0] || "Fidelidad viva"),
    unit: text(attrs.progressUnit || attrs.unit || "sello"),
    target: Math.max(1, Number(attrs.target || attrs.required || 1)),
    lookupEndpoint: text(lookup.endpoint || lookup.url) || undefined,
    credentialParam: text(lookup.credentialParam || lookup.param || "id"),
    credentialPattern: text(lookup.credentialPattern || lookup.pattern) || undefined,
    raw: dv,
  };
}

export function useUtopyValue(credential?: string) {
  const [all, setAll] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [remote, setRemote] = useState<Record<string, UtopyValueState>>({});

  useEffect(() => mtLiveSubscribe((next) => setAll(next as any[])), []);

  const programs = useMemo(
    () => all.map(asProgram).filter((value): value is UtopyLoyaltyProgram => Boolean(value)),
    [all],
  );
  const trustProofs = useMemo(
    () => all.filter((dv) => isKind(dv, "trust.proof")),
    [all],
  );
  const trustPolicies = useMemo(
    () => all.filter((dv) => isKind(dv, "trust.policy")),
    [all],
  );

  useEffect(() => {
    const cleanCredential = text(credential);
    if (!cleanCredential) return;
    const controllers: AbortController[] = [];

    for (const program of programs) {
      if (!program.lookupEndpoint) continue;
      if (program.credentialPattern) {
        try {
          if (!new RegExp(program.credentialPattern, "i").test(cleanCredential)) continue;
        } catch {
          continue;
        }
      }
      const controller = new AbortController();
      controllers.push(controller);
      setRemote((prev) => ({
        ...prev,
        [program.id]: { programId: program.id, loading: true },
      }));

      let url: URL;
      try {
        url = new URL(program.lookupEndpoint, window.location.href);
        url.searchParams.set(program.credentialParam, cleanCredential);
      } catch {
        setRemote((prev) => ({
          ...prev,
          [program.id]: {
            programId: program.id,
            loading: false,
            error: "El nodo publicó una dirección de consulta inválida.",
          },
        }));
        continue;
      }

      fetch(url.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body?.ok === false) {
            throw new Error(body?.message || `HTTP ${response.status}`);
          }
          setRemote((prev) => ({
            ...prev,
            [program.id]: {
              programId: program.id,
              loading: false,
              passport: body?.passport || body,
            },
          }));
        })
        .catch((error) => {
          if (error?.name === "AbortError") return;
          setRemote((prev) => ({
            ...prev,
            [program.id]: {
              programId: program.id,
              loading: false,
              error: String(error?.message || error),
            },
          }));
        });
    }

    return () => controllers.forEach((controller) => controller.abort());
  }, [credential, programs]);

  return {
    programs,
    trustProofs,
    trustPolicies,
    programStates: remote,
  };
}
