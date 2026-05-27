// src/mt/mt.cajeroAdapter.ts
// Adaptador semántico DatoVivo → MtCajero (lado MS web)

import type { DatoVivo } from "./mt.traitAdapter";

export type MtCajeroNivel = "cajero" | "admin" | "supervisor";

export type MtCajero = {
  id: string;
  nombre: string;

  doc?: string;
  telefono?: string;
  nivel: MtCajeroNivel;

  orgId?: string;
  territorioId?: string;

  dispositivo?: {
    tipo?: string;
    id?: string;
  };

  meta?: {
    ns?: string;
    wallets?: {
      evm?: string;
      btc?: string;
      otro?: string;
    };
    hasPin?: boolean;
    [k: string]: any;
  };

  presence?: {
    online?: boolean;
    near?: boolean;
    lastSeenTs?: string;
    entryMethods?: string[];
    deviceId?: string;
    stage?: string;
  };

  payment?: {
    accepted?: string[];
    creditEnabled?: boolean;
    negotiator?: boolean;
    currencies?: string[];
  };

  runtime?: {
    autoCharge?: boolean;
    autoPropose?: boolean;
    autoAcceptProof?: boolean;
  };
};

/** Helper seguro de deep get */
function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
}

function toBool(v: any, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (["true", "1", "yes", "si", "sí", "on", "online", "active", "activo"].includes(s)) return true;
  if (["false", "0", "no", "off", "offline", "inactive", "inactivo"].includes(s)) return false;
  return fallback;
}

function arrOfStrings(...values: any[]): string[] {
  const out: string[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const s = String(item ?? "").trim();
        if (s) out.push(s);
      }
      continue;
    }

    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) continue;

      if (raw.includes(",") || raw.includes("|")) {
        raw
          .split(/[|,]/g)
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((x) => out.push(x));
      } else {
        out.push(raw);
      }
    }
  }

  return Array.from(new Set(out));
}

function normNivel(v: any): MtCajeroNivel {
  const s = String(v || "").toLowerCase();
  if (s === "admin") return "admin";
  if (s === "supervisor") return "supervisor";
  return "cajero";
}

function inferAcceptedPaymentMethods(d: DatoVivo, a: any, meta: any): string[] {
  const traits = Array.isArray(d?.traits) ? d.traits : [];

  const explicit = arrOfStrings(
    a?.payment?.accepted,
    a?.acceptedPayments,
    a?.acceptedMethods,
    a?.accepted,
    meta?.payment?.accepted,
    meta?.acceptedPayments,
    meta?.acceptedMethods,
    meta?.accepted
  );

  if (explicit.length) return explicit;

  const inferred: string[] = [];

  if (traits.includes("mt:payment.cash")) inferred.push("cash");
  if (traits.includes("mt:payment.qr")) inferred.push("qr");
  if (traits.includes("mt:payment.card")) inferred.push("card");
  if (traits.includes("mt:payment.transfer")) inferred.push("transfer");
  if (traits.includes("mt:payment.crypto")) inferred.push("crypto");
  if (traits.includes("mt:payment.credit")) inferred.push("credit");
  if (traits.includes("mt:payment.link")) inferred.push("link");

  return Array.from(new Set(inferred));
}

function inferEntryMethods(a: any, meta: any): string[] {
  return arrOfStrings(
    a?.presence?.entryMethods,
    a?.entryMethods,
    a?.entryMethod,
    meta?.presence?.entryMethods,
    meta?.entryMethods,
    meta?.entryMethod
  );
}

function inferCurrencies(a: any, meta: any): string[] {
  return arrOfStrings(
    a?.payment?.currencies,
    a?.currencies,
    a?.currency,
    meta?.payment?.currencies,
    meta?.currencies,
    meta?.currency
  );
}

/**
 * Adaptamos una lista de DatoVivo (lo que sale del seed / mente)
 * a una lista de cajeros entendible por el MS.
 */
export function adaptDatosToMtCajeros(datos: DatoVivo[]): MtCajero[] {
  return datos
    .filter((d) => {
      const traits = Array.isArray(d.traits) ? d.traits : [];
      const isCajeroTrait = traits.includes("mt:cajero");
      const isCajeroKind = d.kind === "cajero";
      return isCajeroTrait || isCajeroKind;
    })
    .map((d) => {
      const a = d.attrs || {};
      const meta = d.meta || {};
      const traits = Array.isArray(d.traits) ? d.traits : [];

      const nombre =
        a.nombre ??
        a.name ??
        meta.nombre ??
        `Cajero ${String(d.id).slice(-4)}`;

      const doc =
        a.doc ??
        a.documento ??
        meta.doc ??
        meta.documento;

      const telefono =
        a.telefono ??
        a.phone ??
        a.tel ??
        meta.telefono ??
        meta.phone ??
        meta.tel;

      const nivelRaw =
        a.nivel ??
        meta.nivel ??
        (traits.includes("mt:admin")
          ? "admin"
          : traits.includes("mt:supervisor")
          ? "supervisor"
          : "cajero");

      const orgId =
        a.orgId ??
        deepGet(a, "org.id") ??
        meta.orgId ??
        deepGet(meta, "org.id");

      const territorioId =
        a.territorioId ??
        deepGet(a, "territorio.id") ??
        meta.territorioId ??
        deepGet(meta, "territorio.id");

      const dispositivo =
        a.dispositivo ??
        meta.dispositivo ??
        undefined;

      const wallets =
        meta.wallets ?? {
          evm: deepGet(meta, "wallet.evm") ?? deepGet(a, "wallet.evm"),
          btc: deepGet(meta, "wallet.btc") ?? deepGet(a, "wallet.btc"),
          otro: deepGet(meta, "wallet.otro") ?? deepGet(a, "wallet.otro"),
        };

      const hasPin =
        a.pin != null ||
        meta.pin != null ||
        deepGet(a, "seguridad.pin") != null ||
        deepGet(meta, "seguridad.pin") != null;

      const accepted = inferAcceptedPaymentMethods(d, a, meta);
      const entryMethods = inferEntryMethods(a, meta);
      const currencies = inferCurrencies(a, meta);

      const online =
        toBool(
          a?.presence?.online ??
            a?.online ??
            meta?.presence?.online ??
            meta?.online,
          false
        ) || traits.includes("mt:online");

      const near =
        toBool(
          a?.presence?.near ??
            a?.near ??
            meta?.presence?.near ??
            meta?.near,
          false
        ) || traits.includes("mt:near");

      const creditEnabled =
        toBool(
          a?.payment?.creditEnabled ??
            a?.creditEnabled ??
            meta?.payment?.creditEnabled ??
            meta?.creditEnabled,
          false
        ) || traits.includes("mt:payment.credit");

      const negotiator =
        toBool(
          a?.payment?.negotiator ??
            a?.negotiator ??
            meta?.payment?.negotiator ??
            meta?.negotiator,
          false
        ) || traits.includes("mt:negotiator");

      const autoCharge =
        toBool(
          a?.runtime?.autoCharge ??
            a?.autoCharge ??
            meta?.runtime?.autoCharge ??
            meta?.autoCharge,
          false
        ) || traits.includes("mt:auto.charge");

      const autoPropose =
        toBool(
          a?.runtime?.autoPropose ??
            a?.autoPropose ??
            meta?.runtime?.autoPropose ??
            meta?.autoPropose,
          false
        ) || traits.includes("mt:auto.propose");

      const autoAcceptProof =
        toBool(
          a?.runtime?.autoAcceptProof ??
            a?.autoAcceptProof ??
            meta?.runtime?.autoAcceptProof ??
            meta?.autoAcceptProof,
          false
        ) || traits.includes("mt:auto.accept.proof");

      const lastSeenTs =
        a?.presence?.lastSeenTs ??
        a?.lastSeenTs ??
        meta?.presence?.lastSeenTs ??
        meta?.lastSeenTs ??
        meta?.ts ??
        undefined;

      const stage =
        a?.presence?.stage ??
        a?.stage ??
        meta?.presence?.stage ??
        meta?.stage ??
        undefined;

      const deviceId =
        deepGet(a, "presence.deviceId") ??
        deepGet(a, "device.id") ??
        deepGet(meta, "presence.deviceId") ??
        deepGet(meta, "device.id") ??
        dispositivo?.id ??
        undefined;

      return {
        id: String(d.id),
        nombre,
        doc: doc ? String(doc) : undefined,
        telefono: telefono ? String(telefono) : undefined,
        nivel: normNivel(nivelRaw),
        orgId: orgId ? String(orgId) : undefined,
        territorioId: territorioId ? String(territorioId) : undefined,
        dispositivo: dispositivo || undefined,
        meta: {
          ...(meta as any),
          ns: (meta as any).ns ?? "mt:cajeros",
          wallets,
          hasPin,
        },
        presence: {
          online,
          near,
          lastSeenTs: lastSeenTs ? String(lastSeenTs) : undefined,
          entryMethods,
          deviceId: deviceId ? String(deviceId) : undefined,
          stage: stage ? String(stage) : undefined,
        },
        payment: {
          accepted,
          creditEnabled,
          negotiator,
          currencies,
        },
        runtime: {
          autoCharge,
          autoPropose,
          autoAcceptProof,
        },
      };
    });
}