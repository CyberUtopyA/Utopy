// src/mt/offeractionmodal.tsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Portal from "../pages/ui/portal";
import type { MtOffer, MtProduct } from "./mt.traitAdapter";
import type { MtCajero } from "./mt.cajeroAdapter";
import { mtLiveUpsert } from "./mt.liveStore";

type Mode =
  | "accept"
  | "counter"
  | "barter"
  | "message"
  | "fulfill"
  | "variant"
  | "consult";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10060;
  padding: 12px;
`;

const Box = styled.div`
  width: 100%;
  max-width: 760px;
  max-height: 92vh;
  overflow: auto;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.22);
`;

const Header = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 1rem;
`;

const Subtle = styled.div`
  opacity: 0.72;
  font-size: 0.9rem;
`;

const Body = styled.div`
  padding: 16px;
  display: grid;
  gap: 14px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const TabBtn = styled.button<{ active?: boolean }>`
  border: 1px solid ${({ active }) => (active ? "#111" : "rgba(0,0,0,0.12)")};
  background: ${({ active }) => (active ? "#111" : "#fff")};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  border-radius: 999px;
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 900;
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  padding: 14px;
  background: #fff;
`;

const Label = styled.label`
  font-weight: 900;
  font-size: 0.88rem;
  display: block;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 10px 12px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 96px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 10px 12px;
  resize: vertical;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 10px 12px;
`;

const ErrorBox = styled.div`
  border: 1px solid rgba(255, 0, 0, 0.15);
  background: rgba(255, 0, 0, 0.04);
  color: #8a1f1f;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 0.92rem;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 16px 16px;
  flex-wrap: wrap;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 950;
  ${({ kind }) =>
    kind === "solid"
      ? `background:#15ff00ff;color:#111;`
      : `background:#fff;color:#111;`}
`;

function newId(prefix = "dv:") {
  return `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getLocalActor() {
  try {
    const raw = localStorage.getItem("mt.actor");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed;
    }
  } catch {}

  const created = {
    id: `actor:${Math.random().toString(36).slice(2, 10)}`,
    name: "Actor local",
    role: "buyer",
  };

  try {
    localStorage.setItem("mt.actor", JSON.stringify(created));
  } catch {}

  return created;
}
async function publishDV(dv: any) {
  const upsertEnvelope = {
    kind: "dv.upsert",
    dv,
    meta: {
      nodeId: "ms:web",
      ts: new Date().toISOString(),
      ns: String(dv?.meta?.ns || "mt:market"),
      source: "ms:web",
      scopes:
        Array.isArray(dv?.meta?.scopes) && dv.meta.scopes.length
          ? dv.meta.scopes
          : ["public"],
    },
    auth: "utopy-resonancia",
    id: "ms:web",
    ns: "mt",
  };

  console.log("[MS] publishDV dispatch", upsertEnvelope);

  try {
    window.dispatchEvent(
      new CustomEvent("utopy.emit", {
        detail: upsertEnvelope,
      })
    );
  } catch (e) {
    console.warn("[MS] utopy.emit fail", e);
  }
}
function upsertDV(kind: string, attrs: Record<string, any>, extra?: Partial<any>) {
  const dv = {
    id: newId(`${kind}:`),
    kind,
    attrs,
    traits: ["mt:intent", kind, ...(extra?.traits || [])],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      ttl_ms: 1000 * 60 * 60 * 24 * 7,
      source: "ms:web",
      ...(extra?.meta || {}),
    },
    ...extra,
  };

  mtLiveUpsert(dv as any);
  return dv;
}

function emitChatMessage(args: {
  offer: MtOffer;
  threadId: string;
  fromActorId: string;
  toActorId: string | null;
  cajeroId?: string | null;
  text: string;
  actionKind: string;
  responseToId?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  contact?: any;
  vendor?: any;
  source?: any;
}) {
  return upsertDV(
    "trade.message",
    {
      threadId: args.threadId,
      offerId: args.offer.id,
      productoId: args.offer.productoId,
      offerType: args.offer.tipo,
      fromActorId: args.fromActorId,
      toActorId: args.toActorId,
      cajeroId: args.cajeroId || null,
      sellerId: args.sellerId || args.toActorId || null,
      sellerName: args.sellerName || null,
      participants: [args.fromActorId, args.toActorId, args.cajeroId].filter(Boolean),
      text: args.text,
      actionKind: args.actionKind,
      responseToId: args.responseToId || null,
      status: "sent",
      unreadBy: [args.toActorId, args.cajeroId].filter(Boolean),
      contact: args.contact || null,
      vendor: args.vendor || null,
      source: args.source || null,
    },
    {
      traits: ["mt:chat", "mt:thread", "mt:notify.cajero"],
    }
  );
}

type Props = {
  open: boolean;
  offer: MtOffer | null;
  threadId: string;
  products: MtProduct[];
  activeCajero?: MtCajero | null;
  onNeedCajero?: () => void;
  onClose: () => void;
};

function resolveDesignSellerId(offer: any) {
  return String(
    offer?.attrs?.contact?.sellerId ||
      offer?.contact?.sellerId ||
      offer?.attrs?.targetAuthor?.id ||
      offer?.targetAuthor?.id ||
      offer?.attrs?.author?.id ||
      offer?.author?.id ||
      offer?.attrs?.vendor?.id ||
      offer?.vendor?.id ||
      offer?.sellerId ||
      offer?.attrs?.sellerId ||
      ""
  ).trim();
}

function resolveDesignSellerName(offer: any) {
  return String(
    offer?.attrs?.contact?.sellerName ||
      offer?.contact?.sellerName ||
      offer?.attrs?.targetAuthor?.name ||
      offer?.targetAuthor?.name ||
      offer?.attrs?.author?.name ||
      offer?.author?.name ||
      offer?.attrs?.vendor?.name ||
      offer?.vendor?.name ||
      offer?.sellerName ||
      offer?.attrs?.sellerName ||
      "Diseñador / vendedor"
  ).trim();
}

function resolveDesignThreadId(offer: any) {
  return String(
    offer?.attrs?.contact?.threadId ||
      offer?.contact?.threadId ||
      offer?.meta?.threadId ||
      offer?.threadId ||
      ""
  ).trim();
}

export default function OfferActionModal({
  open,
  offer,
  threadId,
  products,
  activeCajero,
  onNeedCajero,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("accept");
  const [qty, setQty] = useState<number>(1);
  const [counterPrice, setCounterPrice] = useState<number>(0);
  const [counterQty, setCounterQty] = useState<number>(1);
  const [message, setMessage] = useState("");
  const [barterProductId, setBarterProductId] = useState("");
  const [barterQty, setBarterQty] = useState<number>(1);
  const [barterCash, setBarterCash] = useState<number>(0);
  const [fulfillDays, setFulfillDays] = useState<number>(3);
  const [fulfillPrice, setFulfillPrice] = useState<number>(0);
  const [variantNotes, setVariantNotes] = useState("");
  const [consultText, setConsultText] = useState("");
  const [error, setError] = useState("");

  const actor = useMemo(() => getLocalActor(), []);
  const offerAny = offer as any;

  const resolvedSellerId = resolveDesignSellerId(offerAny);
  const resolvedSellerName = resolveDesignSellerName(offerAny);
  const resolvedThreadId = resolveDesignThreadId(offerAny) || threadId;

  const ownProducts = useMemo(() => {
    return products.filter((p) => String(p.id) !== String(offer?.productoId || ""));
  }, [products, offer]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setMode("accept");
    setQty(1);
    setCounterPrice(Number(offer?.precio || 0));
    setCounterQty(1);
    setMessage("");
    setBarterProductId("");
    setBarterQty(1);
    setBarterCash(0);
    setFulfillDays(3);
    setFulfillPrice(Number(offer?.precio || 0));
    setVariantNotes("");
    setConsultText("");
  }, [open, offer]);

  if (!open || !offer) return null;

  const sellerId = resolvedSellerId;
  const sellerName = resolvedSellerName;

  const authorName =
    offerAny?.attrs?.author?.name ||
    offerAny?.author?.name ||
    resolvedSellerName;

  const safeQty = Math.max(1, safeNum(qty, 1));
  const total = safeQty * safeNum(offer.precio, 0);
  const cajeroId = String(activeCajero?.id || "");

  const baseContext = {
    threadId: resolvedThreadId || threadId,
    offerId: offer.id,
    productoId: offer.productoId,
    offerType: offer.tipo,
    sellerId: resolvedSellerId || null,
    sellerName: resolvedSellerName,
    cajeroId: cajeroId || null,
    fromActorId: actor.id,
    toActorId: resolvedSellerId || null,
    participants: [actor.id, resolvedSellerId, cajeroId].filter(Boolean),
    author: offerAny?.attrs?.author || offerAny?.author || null,
    contact: {
      ...(offerAny?.attrs?.contact || offerAny?.contact || {}),
      sellerId: resolvedSellerId || null,
      sellerName: resolvedSellerName,
      threadId: resolvedThreadId || threadId,
    },
    vendor: {
      ...(offerAny?.attrs?.vendor || offerAny?.vendor || {}),
      id: resolvedSellerId || null,
      name: resolvedSellerName,
    },
    source: offerAny?.attrs?.source || offerAny?.source || null,
  };

  const closeOk = () => {
    setError("");
    onClose();
  };

  const requireMessageIfNeeded = (text: string, fallback: string) => {
    const finalText = String(text || "").trim();
    return finalText || fallback;
  };

  const handleConsult = async () => {
    const text = String(consultText || "").trim();
    if (!text) {
      setError("Escribe la consulta que quieres hacer.");
      return;
    }

    const finalSellerId = String(resolvedSellerId || "").trim();
    const finalSellerName = String(resolvedSellerName || "Diseñador / vendedor").trim();
    const finalThreadId = String(resolvedThreadId || threadId || "").trim();

    if (!finalSellerId) {
      setError("Esta oferta no tiene diseñador/vendedor identificado todavía.");
      return;
    }

    if (!finalThreadId) {
      setError("No se pudo resolver el hilo de esta oferta.");
      return;
    }

    const sourceSceneId =
      offerAny?.attrs?.source?.sceneId ||
      offerAny?.source?.sceneId ||
      offerAny?.meta?.source?.sceneId ||
      null;

    const consultId = `mt.consult:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

    const sharedContact = {
      ...(offerAny?.attrs?.contact || offerAny?.contact || {}),
      sellerId: finalSellerId,
      sellerName: finalSellerName,
      threadId: finalThreadId,
    };

    const sharedVendor = {
      ...(offerAny?.attrs?.vendor || offerAny?.vendor || {}),
      id: finalSellerId,
      name: finalSellerName,
    };

    const sharedSource = {
      ...(offerAny?.attrs?.source || offerAny?.source || {}),
      node: "ms-market",
      sceneId: sourceSceneId,
    };

    const consultDV = {
      id: consultId,
      kind: "mt.consult",
      attrs: {
        threadId: finalThreadId,
        consultId,
        offerId: offerAny?.id || offer?.id || null,
        productId: offerAny?.productoId || offer?.productoId || null,
        fromActorId: actor.id,
        buyerId: actor.id,
        buyerName: actor.name || "Actor local",
        toActorId: finalSellerId,
        sellerId: finalSellerId,
        sellerName: finalSellerName,
        cajeroId: cajeroId || null,
        text,
        question: text,
        consultText: text,
        ok: null,
        status: "open",
        unreadBy: [finalSellerId].filter(Boolean),
        targetAuthor: {
          id: finalSellerId,
          name: finalSellerName,
        },
        contact: sharedContact,
        vendor: sharedVendor,
        source: sharedSource,
        participants: [actor.id, finalSellerId, cajeroId].filter(Boolean),
      },
      traits: ["mt:consult", "mt:thread", "mo:consult"],
      meta: {
        ns: "mt:market",
        ts: new Date().toISOString(),
        scopes: ["public"],
        source: "ms.offeraction.consult",
      },
    };

    const chatDV = {
      id: `trade.message:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      kind: "trade.message",
      attrs: {
        threadId: finalThreadId,
        offerId: offerAny?.id || offer?.id || null,
        productoId: offerAny?.productoId || offer?.productoId || null,
        fromActorId: actor.id,
        toActorId: finalSellerId,
        sellerId: finalSellerId,
        sellerName: finalSellerName,
        buyerId: actor.id,
        cajeroId: cajeroId || null,
        participants: [actor.id, finalSellerId, cajeroId].filter(Boolean),
        unreadBy: [finalSellerId].filter(Boolean),
        text: `Consulta: ${text}`,
        actionKind: "mt.consult",
        responseToId: consultId,
        contact: sharedContact,
        vendor: sharedVendor,
        source: sharedSource,
      },
      traits: ["mt:chat", "mt:thread", "mt:consult"],
      meta: {
        ns: "mt:market",
        ts: new Date().toISOString(),
        scopes: ["public"],
        source: "ms.offeraction.consult.message",
      },
    };

    mtLiveUpsert(consultDV as any);
    mtLiveUpsert(chatDV as any);

    await publishDV(consultDV);
    await publishDV(chatDV);

    closeOk();
  };

  const handleAccept = () => {
    if (!activeCajero && onNeedCajero) {
      setError("Elegí un cajero para formalizar la aceptación.");
      onNeedCajero();
      return;
    }

    const note = requireMessageIfNeeded(
      message,
      `Acepto la oferta por ${safeQty} unidad(es).`
    );

    const action = upsertDV("trade.intent.accept", {
      ...baseContext,
      cantidad: safeQty,
      precio_unitario: safeNum(offer.precio, 0),
      total,
      paymentPreference: "cajero",
      cajeroId: activeCajero?.id || null,
      note,
      status: "pending",
    });

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text: note,
      actionKind: "trade.intent.accept",
      responseToId: action.id,
    });

    closeOk();
  };

  const handleCounter = () => {
    const proposedQty = Math.max(1, safeNum(counterQty, 1));
    const proposedPrice = Math.max(0, safeNum(counterPrice, 0));

    const note = requireMessageIfNeeded(
      message,
      `Te propongo ${proposedQty} unidad(es) a ${proposedPrice} cada una.`
    );

    const action = upsertDV("trade.intent.counter", {
      ...baseContext,
      proposedQty,
      proposedPrice,
      cajeroId: activeCajero?.id || null,
      note,
      status: "pending",
    });

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text: note,
      actionKind: "trade.intent.counter",
      responseToId: action.id,
    });

    closeOk();
  };

  const handleBarter = () => {
    const barterProduct = ownProducts.find((p) => String(p.id) === String(barterProductId));

    if (!barterProduct) {
      setError("Elegí un producto propio para proponer el trueque.");
      return;
    }

    const offeredQty = Math.max(1, safeNum(barterQty, 1));
    const cashDifference = Math.max(0, safeNum(barterCash, 0));

    const note = requireMessageIfNeeded(
      message,
      `Te propongo trueque por ${barterProduct.nombre} x ${offeredQty}${
        cashDifference > 0 ? ` + ${cashDifference} en efectivo` : ""
      }.`
    );

    const action = upsertDV("trade.intent.barter", {
      ...baseContext,
      targetProductoId: offer.productoId,
      targetSellerId: sellerId,
      offeredProductoId: barterProduct.id,
      offeredProductoNombre: barterProduct.nombre,
      offeredQty,
      cashDifference,
      cajeroId: activeCajero?.id || null,
      note,
      status: "pending",
    });

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text: note,
      actionKind: "trade.intent.barter",
      responseToId: action.id,
    });

    closeOk();
  };

  const handleMessage = () => {
    const text = String(message || "").trim();
    if (!text) {
      setError("Escribí un mensaje antes de enviar.");
      return;
    }

    const action = upsertDV("trade.intent.message", {
      ...baseContext,
      cajeroId: activeCajero?.id || null,
      topic: "offer",
      message: text,
      status: "pending",
    });

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text,
      actionKind: "trade.intent.message",
      responseToId: action.id,
    });

    closeOk();
  };

  const handleFulfill = () => {
    const proposedDays = Math.max(1, safeNum(fulfillDays, 1));
    const proposedPrice = Math.max(0, safeNum(fulfillPrice, 0));

    const note = requireMessageIfNeeded(
      message,
      `Puedo producir/cumplir esto en ${proposedDays} día(s) por ${proposedPrice}.`
    );

    const action = upsertDV("trade.intent.fulfill", {
      ...baseContext,
      proposedDays,
      proposedPrice,
      cajeroId: activeCajero?.id || null,
      note,
      sourceNodeHint: "mo",
      status: "pending",
    });

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text: note,
      actionKind: "trade.intent.fulfill",
      responseToId: action.id,
    });

    closeOk();
  };

  const handleVariant = () => {
    const notes = String(variantNotes || "").trim();
    if (!notes) {
      setError("Describe la variante que quieres pedir.");
      return;
    }

    const action = upsertDV(
      "mt.demand",
      {
        ...baseContext,
        type: "variant.request",
        productId: offer.productoId,
        targetAuthor: offerAny?.attrs?.author || offerAny?.author || null,
        notes,
        status: "pending",
      },
      {
        traits: ["mt:demand", "mt:variant.request", "mt:thread"],
      }
    );

    emitChatMessage({
      offer,
      threadId: resolvedThreadId || threadId,
      fromActorId: actor.id,
      toActorId: sellerId || null,
      cajeroId: cajeroId || null,
      sellerId: sellerId || null,
      sellerName: sellerName || null,
      contact: baseContext.contact,
      vendor: baseContext.vendor,
      source: baseContext.source,
      text: `Quiero una variante: ${notes}`,
      actionKind: "mt.demand.variant.request",
      responseToId: action.id,
    });

    closeOk();
  };

  return (
    <Portal>
      <Backdrop onClick={onClose}>
        <Box onClick={(e) => e.stopPropagation()}>
          <Header>
            <div>
              <Title>Responder oferta viva</Title>
              <Subtle>
                Oferta {String(offer.tipo).toUpperCase()} · producto {String(offer.productoId)} ·
                precio {String(offer.precio)}
              </Subtle>
              <Subtle>Thread: {resolvedThreadId || threadId || "—"}</Subtle>
              <Subtle>Diseñador: {resolvedSellerName}</Subtle>
            </div>
            <Btn onClick={onClose}>Cerrar</Btn>
          </Header>

          <Body>
            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <Card>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Identidad local</div>
              <Subtle>
                Actor: {actor.name || "Actor local"} · {actor.id}
              </Subtle>
              <Subtle>
                Destino: {sellerName} · {sellerId || "sin sellerId"}
              </Subtle>
              <Subtle>
                Cajero activo: {activeCajero ? activeCajero.nombre : "sin seleccionar"}
              </Subtle>
            </Card>

            <Tabs>
              <TabBtn active={mode === "accept"} onClick={() => setMode("accept")}>
                Aceptar
              </TabBtn>
              <TabBtn active={mode === "counter"} onClick={() => setMode("counter")}>
                Contraoferta
              </TabBtn>
              <TabBtn active={mode === "barter"} onClick={() => setMode("barter")}>
                Trueque
              </TabBtn>
              <TabBtn active={mode === "message"} onClick={() => setMode("message")}>
                Mensaje
              </TabBtn>
              <TabBtn active={mode === "fulfill"} onClick={() => setMode("fulfill")}>
                Producir
              </TabBtn>
              <TabBtn active={mode === "variant"} onClick={() => setMode("variant")}>
                Pedir variante
              </TabBtn>
              <TabBtn active={mode === "consult"} onClick={() => setMode("consult")}>
                Consulta
              </TabBtn>
            </Tabs>

            {mode === "consult" && (
              <Grid>
                <Card>
                  <Label>Escribe tu consulta</Label>
                  <TextArea
                    value={consultText}
                    onChange={(e) => setConsultText(e.target.value)}
                    placeholder="Ej: ¿podés hacerlo en otra medida, color, material o distribución?"
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>
                    Consulta al diseñador / vendedor
                  </div>
                  <Subtle>Diseñador: {authorName}</Subtle>
                  <Subtle>Thread: {resolvedThreadId || threadId || "—"}</Subtle>
                  <Subtle style={{ marginTop: 10 }}>
                    Esto crea una consulta viva conectada al mismo hilo del diseño/oferta.
                  </Subtle>
                </Card>
              </Grid>
            )}

            {mode === "accept" && (
              <Grid>
                <Card>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Mensaje opcional</Label>
                  <TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: puedo pasar hoy de tarde / quiero retiro en cajero"
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Resumen vivo</div>
                  <Subtle>Precio unitario: {offer.precio}</Subtle>
                  <Subtle>Cantidad: {safeQty}</Subtle>
                  <Subtle>Total: {total}</Subtle>
                  <Subtle>
                    Cajero: {activeCajero ? activeCajero.nombre : "sin seleccionar"}
                  </Subtle>
                  <Subtle style={{ marginTop: 10 }}>
                    Emitirá intención formal + mensaje de chat en el mismo thread.
                  </Subtle>
                </Card>
              </Grid>
            )}

            {mode === "counter" && (
              <Grid>
                <Card>
                  <Label>Nueva cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={counterQty}
                    onChange={(e) => setCounterQty(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Nuevo precio propuesto</Label>
                  <Input
                    type="number"
                    min={0}
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Mensaje</Label>
                  <TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: si llevo 5 unidades, ¿me dejás a este precio?"
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Contraoferta</div>
                  <Subtle>Oferta original: {offer.precio}</Subtle>
                  <Subtle>Tu propuesta: {counterPrice || "—"}</Subtle>
                  <Subtle>Cantidad: {counterQty}</Subtle>
                  <Subtle style={{ marginTop: 10 }}>
                    Queda como negociación formal y mensaje visible.
                  </Subtle>
                </Card>
              </Grid>
            )}

            {mode === "barter" && (
              <Grid>
                <Card>
                  <Label>Producto para ofrecer en trueque</Label>
                  <Select
                    value={barterProductId}
                    onChange={(e) => setBarterProductId(e.target.value)}
                  >
                    <option value="">Elegir producto propio</option>
                    {ownProducts.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.nombre}
                      </option>
                    ))}
                  </Select>

                  <div style={{ height: 12 }} />

                  <Label>Cantidad de tu producto</Label>
                  <Input
                    type="number"
                    min={1}
                    value={barterQty}
                    onChange={(e) => setBarterQty(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Diferencia en efectivo opcional</Label>
                  <Input
                    type="number"
                    min={0}
                    value={barterCash}
                    onChange={(e) => setBarterCash(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Mensaje</Label>
                  <TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: te doy este producto + diferencia en efectivo"
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Trueque simbiótico</div>
                  <Subtle>
                    Emite propuesta formal de intercambio y deja conversación viva.
                  </Subtle>
                  <Subtle style={{ marginTop: 8 }}>
                    Ideal para MT + MO + producción local.
                  </Subtle>
                </Card>
              </Grid>
            )}

            {mode === "message" && (
              <Card>
                <Label>Mensaje vivo</Label>
                <TextArea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ej: ¿seguís teniendo disponible?, ¿aceptás retiro mañana?, ¿podés reservarme?"
                />
              </Card>
            )}

            {mode === "fulfill" && (
              <Grid>
                <Card>
                  <Label>Tiempo estimado (días)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={fulfillDays}
                    onChange={(e) => setFulfillDays(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Precio propuesto</Label>
                  <Input
                    type="number"
                    min={0}
                    value={fulfillPrice}
                    onChange={(e) => setFulfillPrice(Number(e.target.value))}
                  />

                  <div style={{ height: 12 }} />

                  <Label>Cómo lo cumplirías</Label>
                  <TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: puedo fabricarlo parecido, conseguirlo o adaptarlo"
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>
                    Cumplimiento / producción
                  </div>
                  <Subtle>
                    Esto permite responder una oferta aunque no tengas el item exacto.
                  </Subtle>
                  <Subtle style={{ marginTop: 8 }}>
                    Muy bueno para MO, talleres, recicladoras y mueblerías.
                  </Subtle>
                </Card>
              </Grid>
            )}

            {mode === "variant" && (
              <Grid>
                <Card>
                  <Label>Describe la variante que quieres</Label>
                  <TextArea
                    value={variantNotes}
                    onChange={(e) => setVariantNotes(e.target.value)}
                    placeholder="Ej: mismo diseño pero en color negro, más alto, con otra madera, para 6 personas..."
                  />
                </Card>

                <Card>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>
                    Pedido de variante
                  </div>
                  <Subtle>Diseñador: {authorName}</Subtle>
                  <Subtle>Thread del diseño: {resolvedThreadId || threadId || "—"}</Subtle>
                  <Subtle style={{ marginTop: 10 }}>
                    Esto emite una demanda viva conectada al mismo hilo del diseño.
                  </Subtle>
                </Card>
              </Grid>
            )}
          </Body>

          <Actions>
            {!activeCajero && <Btn onClick={onNeedCajero}>Elegir cajero</Btn>}

            {mode === "accept" && (
              <Btn kind="solid" onClick={handleAccept}>
                Confirmar aceptación
              </Btn>
            )}

            {mode === "counter" && (
              <Btn kind="solid" onClick={handleCounter}>
                Enviar contraoferta
              </Btn>
            )}

            {mode === "barter" && (
              <Btn kind="solid" onClick={handleBarter}>
                Enviar trueque
              </Btn>
            )}

            {mode === "message" && (
              <Btn kind="solid" onClick={handleMessage}>
                Enviar mensaje
              </Btn>
            )}

            {mode === "fulfill" && (
              <Btn kind="solid" onClick={handleFulfill}>
                Proponer producción
              </Btn>
            )}

            {mode === "variant" && (
              <Btn kind="solid" onClick={handleVariant}>
                Pedir variante
              </Btn>
            )}

            {mode === "consult" && (
              <Btn kind="solid" onClick={handleConsult}>
                Enviar consulta
              </Btn>
            )}
          </Actions>
        </Box>
      </Backdrop>
    </Portal>
  );
}