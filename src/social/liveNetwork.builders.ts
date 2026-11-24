import { interpretHumanSignal } from "./interlanguage";
import type {
  ApproximateGeo,
  HumanCapability,
  LiveProfileInput,
  LiveSignalInput,
} from "./liveNetwork.types";

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  const cryptoId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${cryptoId}`;
}

function text(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function slug(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 72);
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

export function approximateGeo(
  lat: number,
  lng: number,
  source = "browser",
): ApproximateGeo | null {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (
    !Number.isFinite(safeLat) ||
    !Number.isFinite(safeLng) ||
    safeLat < -90 ||
    safeLat > 90 ||
    safeLng < -180 ||
    safeLng > 180
  ) {
    return null;
  }

  // Aproximadamente 1 km. El Feed Vivo nunca publica la ubicación exacta.
  return {
    lat: Number(safeLat.toFixed(2)),
    lng: Number(safeLng.toFixed(2)),
    precision: "approximate",
    radiusM: 1200,
    source,
  };
}

export function capabilityFromHumanText(
  label: string,
  category = "otro",
): HumanCapability {
  return {
    key: slug(label) || `capacidad.${Date.now()}`,
    label: text(label) || "Puedo ayudar",
    category: slug(category) || "otro",
  };
}

export function buildLiveProfileDV(input: LiveProfileInput) {
  const ts = nowIso();
  const nodeId = text(input.nodeId);
  const profileSubjectId = nodeId || text(input.actorId);
  const actorName = text(input.actorName) || "Persona";
  const capabilityInputs = Array.isArray(input.capabilities)
    ? input.capabilities.filter((item) => text(item?.label))
    : [];
  const serviceRadiusKm = Math.min(
    100,
    Math.max(1, Number(input.serviceRadiusKm || 15)),
  );

  return {
    id: `node.profile:${profileSubjectId}`,
    kind: "node.profile",
    attrs: {
      actorId: input.actorId,
      actorName,
      nodeId,
      node: nodeId ? { id: nodeId, name: actorName } : null,
      title: actorName,
      avatar: text(input.avatar),
      avatarRef: text(input.avatar),
      bio: text(input.bio),
      territoryId: input.territoryId || null,
      capabilities: capabilityInputs.map((item) => ({
        id: `cap:${profileSubjectId}:${item.key}`,
        label: item.label,
        domains: unique([item.category, item.key, item.label]),
        verbs: ["offer", "respond", "schedule"],
        resources: unique([item.label, item.category]),
        serviceRadiusKm,
      })),
      capabilityLabels: capabilityInputs,
      availability: {
        status: input.availableNow ? "available_now" : "by_agreement",
        availableNow: Boolean(input.availableNow),
      },
      geo: input.geo || null,
      location: input.geo || null,
      ranges: {
        workRangeKm: Math.max(0, Number(input.workRangeKm ?? serviceRadiusKm)),
        deliveryRangeKm: Math.max(0, Number(input.deliveryRangeKm ?? serviceRadiusKm)),
        serviceRangeKm: serviceRadiusKm,
        remote: Boolean(input.remote),
        pickup: Boolean(input.pickup),
        onSite: input.onSite !== false,
      },
      privacy: {
        exactLocationShared: false,
        publicGeoPrecision: input.geo ? "approximate" : "hidden",
      },
      consent: {
        discoverable: true,
        contactRequiresConfirmation: true,
        automaticBooking: false,
      },
      status: "active",
      updatedAt: ts,
    },
    labels: [actorName, text(input.bio) || "Perfil Vivo"],
    traits: [
      "node:profile",
      "social:profile",
      "resonance:capable",
      "consent:required",
      ...(input.availableNow ? ["presence:available"] : []),
      ...capabilityInputs.map((item) => `human-cap:${item.key}`),
    ],
    meta: {
      ns: "utopy:resonance",
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ts,
      updatedAt: ts,
      version: Date.now(),
      originNode: nodeId || undefined,
      authority: text(input.actorId),
      schema: "utopy.node.profile.live@1",
      portable: true,
    },
  };
}

function baseSignal(input: LiveSignalInput, id: string, kind: string) {
  const ts = nowIso();
  const nodeId = text(input.nodeId);
  const threadId = text(input.threadId) || `live.thread:${id}`;
  const category = slug(input.category || "otro") || "otro";
  const signalText = text(input.text) || "Señal Viva";
  const interlanguage = interpretHumanSignal(signalText);

  return {
    id,
    kind,
    attrs: {
      actorId: input.actorId,
      actorName: text(input.actorName) || "Persona",
      nodeId,
      node: nodeId ? { id: nodeId, name: text(input.actorName) || "Persona" } : null,
      title: signalText,
      image: input.image || null,
      text: signalText,
      description: signalText,
      category,
      territoryId: input.territoryId || null,
      geo: input.geo || null,
      location: input.geo || null,
      threadId,
      status: "open",
      privacy: {
        exactLocationShared: false,
        publicGeoPrecision: input.geo ? "approximate" : "hidden",
      },
      consent: {
        connectionRequiresConfirmation: true,
        automaticActions: false,
      },
      updatedAt: ts,
      interlanguage: {
        locale: interlanguage.locale,
        hints: interlanguage.hints,
      },
      expression: {
        originalText: signalText,
        originalAudioRef: input.originalAudioRef || null,
        transcription: signalText,
        interpretation: input.semanticFrame || interlanguage.frame,
        persistence: input.persistence || "temporary",
      },
      privacyPolicies: unique(input.privacyPolicies || []),
    },
    labels: [signalText, humanModeLabel(input.mode)],
    traits: [
      "social:feed",
      "live:signal",
      "consent:required",
      `human-category:${category}`,
    ],
    meta: {
      ns: "utopy:resonance",
      scopes: input.scopes?.length ? input.scopes : ["public"],
      ts,
      updatedAt: ts,
      version: 1,
      threadId,
      originNode: nodeId || undefined,
      authority: text(input.actorId),
      schema: "utopy.live.signal@1",
      portable: true,
      ttl_ms: 7 * 24 * 60 * 60_000,
    },
  };
}

export function buildLiveSignalDV(input: LiveSignalInput) {
  const id = randomId(`live.${input.mode}`);
  const category = slug(input.category || "otro") || "otro";
  const signalText = text(input.text) || "Señal Viva";
  const interlanguage = interpretHumanSignal(signalText);

  if (input.mode === "need") {
    const dv = baseSignal(input, id, "resonance.intent");
    return {
      ...dv,
      attrs: {
        ...dv.attrs,
        interactionRole: "need",
        intent: {
          mode: "need",
          domains: unique([category, signalText, ...interlanguage.domains]),
          verbs: unique(["find", "request", "schedule", "buy", ...interlanguage.verbs]),
          resources: unique([signalText, category, ...interlanguage.resources]),
        },
        requestedCapabilities: [signalText],
      },
      traits: [...dv.traits, "resonance:need", "work:intent"],
    };
  }

  if (input.mode === "sell") {
    const dv = baseSignal(input, id, "mt:offer");
    const price = Math.max(0, Number(input.price || 0));
    return {
      ...dv,
      attrs: {
        ...dv.attrs,
        interactionRole: "offer",
        side: "sell",
        tipo: "venta",
        productId: id,
        productoId: id,
        nombre: signalText,
        productName: signalText,
        quantity: 1,
        cantidad: 1,
        unit: input.unit || "u",
        unidad: input.unit || "u",
        price,
        precio: price,
        currency: input.currency || "PYG",
        image: input.image || null,
        imagen: input.image || null,
      },
      traits: [...dv.traits, "mt:supply", "mt:producto", "mt:vendible"],
      meta: { ...dv.meta, ns: "mt:market" },
    };
  }

  const dv = baseSignal(input, id, "capability.offer");
  return {
    ...dv,
    attrs: {
      ...dv.attrs,
      interactionRole: "offer",
      intent: {
        mode: "offer",
        domains: unique([category, signalText]),
        verbs: ["offer", "respond", "schedule"],
        resources: unique([signalText, category]),
      },
      availability: {
        status:
          input.mode === "available" ? "available_now" : "by_agreement",
        availableNow: input.mode === "available",
      },
      capabilities: [
        {
          id: `cap:${id}`,
          label: signalText,
          domains: unique([category, signalText, ...interlanguage.domains]),
          verbs: unique(["offer", "respond", "schedule", ...interlanguage.verbs]),
          resources: unique([signalText, category, ...interlanguage.resources]),
          serviceRadiusKm: 15,
        },
      ],
    },
    traits: [
      ...dv.traits,
      "capability:offer",
      "resonance:capable",
      ...(input.mode === "available" ? ["presence:available"] : []),
    ],
  };
}

export function humanModeLabel(mode: LiveSignalInput["mode"]) {
  if (mode === "need") return "Necesito";
  if (mode === "sell") return "Vendo";
  if (mode === "available") return "Disponible ahora";
  return "Puedo ayudar";
}

export function buildLiveReplyDVs(input: {
  actorId: string;
  actorName: string;
  nodeId?: string | null;
  targetDV: any;
  message: string;
  bookingAt?: string | null;
}) {
  const ts = nowIso();
  const target = input.targetDV || {};
  const targetAttrs = target.attrs || {};
  const targetId = text(target.id);
  const targetActorId = text(
    targetAttrs.actorId ||
      targetAttrs.node?.id ||
      targetAttrs.nodeId ||
      targetAttrs.sellerId,
  );
  const threadId =
    text(targetAttrs.threadId || target.meta?.threadId) ||
    `live.thread:${targetId || randomId("target")}`;
  const responseId = randomId(
    input.bookingAt ? "booking.request" : "resonance.response",
  );
  const message =
    text(input.message) ||
    (input.bookingAt
      ? "Quiero solicitar este horario."
      : "Quiero conversar sobre esta señal.");
  const nodeId = text(input.nodeId);

  const responseDV = {
    id: responseId,
    kind: input.bookingAt ? "booking.request" : "resonance.response",
    attrs: {
      actorId: input.actorId,
      actorName: text(input.actorName) || "Persona",
      nodeId,
      targetActorId: targetActorId || null,
      title: input.bookingAt ? "Solicitud de turno" : "Respuesta a la señal",
      text: message,
      message,
      bookingAt: input.bookingAt || null,
      threadId,
      target: { kind: target.kind || "live.signal", id: targetId },
      proposalRef: { id: targetId, kind: target.kind || "live.signal" },
      status: "proposed",
      confirmationRequired: true,
      updatedAt: ts,
    },
    labels: [
      input.bookingAt ? "Solicitud de turno" : "Nueva respuesta",
      message,
    ],
    traits: [
      "social:response",
      input.bookingAt ? "booking:request" : "resonance:response",
      "consent:required",
    ],
    meta: {
      ns: "utopy:resonance",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      version: 1,
      threadId,
      respondsTo: targetId,
      originNode: nodeId || undefined,
      authority: text(input.actorId),
      schema: input.bookingAt
        ? "utopy.booking.request@1"
        : "utopy.resonance.response@1",
    },
  };

  const messageDV = {
    id: randomId("trade.message"),
    kind: "trade.message",
    attrs: {
      threadId,
      actorId: input.actorId,
      actorName: text(input.actorName) || "Persona",
      toActorId: targetActorId || null,
      text: message,
      message,
      participants: [input.actorId, targetActorId].filter(Boolean),
      unreadBy: targetActorId ? [targetActorId] : [],
      sourceDvId: responseId,
      targetDvId: targetId,
      status: "sent",
    },
    labels: ["Mensaje", message],
    traits: ["mt:thread", "social:response"],
    meta: {
      ns: "mt:market",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      version: 1,
      threadId,
      respondsTo: responseId,
      originNode: nodeId || undefined,
      authority: text(input.actorId),
    },
  };

  return { responseDV, messageDV, threadId };
}

export function buildBookingDecisionDVs(input: {
  actorId: string;
  actorName: string;
  nodeId?: string | null;
  bookingDV: any;
  decision: "accepted" | "declined";
}) {
  const ts = nowIso();
  const booking = input.bookingDV || {};
  const bookingId = text(booking.id);
  const threadId =
    text(booking?.attrs?.threadId || booking?.meta?.threadId) ||
    `live.thread:${bookingId}`;
  const nodeId = text(input.nodeId);
  const accepted = input.decision === "accepted";
  const message = accepted
    ? "El turno fue confirmado."
    : "El horario no fue confirmado. Pueden proponer otro.";

  const statusDV = {
    id: `booking.status:${bookingId}`,
    kind: "booking.status",
    attrs: {
      bookingId,
      bookingAt: booking?.attrs?.bookingAt || null,
      actorId: input.actorId,
      actorName: text(input.actorName) || "Nodo Vivo",
      status: input.decision,
      title: accepted ? "Turno confirmado" : "Horario no confirmado",
      text: message,
      threadId,
      target: { kind: "booking.request", id: bookingId },
      participants: [input.actorId, booking?.attrs?.actorId].filter(Boolean),
      updatedAt: ts,
    },
    labels: [accepted ? "Turno confirmado" : "Horario no confirmado", message],
    traits: [
      "booking:status",
      accepted ? "booking:accepted" : "booking:declined",
      "consent:recorded",
    ],
    meta: {
      ns: "utopy:resonance",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      version: Date.now(),
      threadId,
      respondsTo: bookingId,
      originNode: nodeId || undefined,
      authority: text(input.actorId),
      schema: "utopy.booking.status@1",
    },
  };

  const messageDV = {
    id: randomId("trade.message"),
    kind: "trade.message",
    attrs: {
      threadId,
      actorId: input.actorId,
      actorName: text(input.actorName) || "Nodo Vivo",
      toActorId: booking?.attrs?.actorId || null,
      participants: [input.actorId, booking?.attrs?.actorId].filter(Boolean),
      text: message,
      message,
      sourceDvId: statusDV.id,
      targetDvId: bookingId,
      status: "sent",
    },
    labels: ["Mensaje", message],
    traits: ["mt:thread", "booking:status"],
    meta: {
      ns: "mt:market",
      scopes: ["participants"],
      ts,
      updatedAt: ts,
      version: 1,
      threadId,
      respondsTo: statusDV.id,
      originNode: nodeId || undefined,
      authority: text(input.actorId),
    },
  };

  return { statusDV, messageDV, threadId };
}
