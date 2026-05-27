import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  MessageCircle,
  Package2,
  Megaphone,
  Send,
  Truck,
  Archive,
  CheckCircle2,
  MessageCircleOff,
  Wand2,
  UserRound,
  Receipt,
  FileText,
} from "lucide-react";
import { mtLiveSubscribe, mtLiveUpsert } from "./mt.liveStore";
import { publishDatoVivo } from "./seedbus";

type TradeMode = "buyer" | "seller" | "cajero" | "all";

const Box = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  background: #fff;
  padding: 12px;
  display: grid;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const TitleWrap = styled.div`
  display: grid;
  gap: 4px;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Subtle = styled.div`
  opacity: 0.72;
  font-size: 0.9rem;
  line-height: 1.35;
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  min-width: 0;

  > * {
    min-width: 0;
  }
`;

const PanelCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  background: #fff;
  padding: 10px;
  min-width: 0;
  overflow: hidden;
`;

const Conversation = styled.div`
  display: grid;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
`;

const MsgList = styled.div`
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  min-width: 0;
`;

const ThreadList = styled.div`
  display: grid;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
`;

const ThreadBtn = styled.button<{ active?: boolean }>`
  text-align: left;
  border: 1px solid ${({ active }) => (active ? "#111" : "rgba(0,0,0,0.08)")};
  background: ${({ active }) => (active ? "rgba(21,255,0,0.06)" : "#fff")};
  border-radius: 14px;
  padding: 10px;
  cursor: pointer;
  display: grid;
  gap: 6px;
  transition: 0.15s ease;

  &:hover {
    background: ${({ active }) =>
      active ? "rgba(21,255,0,0.08)" : "rgba(0,0,0,0.03)"};
  }
`;

const Dot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ef4444;
  margin-left: 8px;
`;

const Badge = styled.span<{ tone?: "ok" | "warn" | "info" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 950;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ tone }) =>
    tone === "ok"
      ? "rgba(34,197,94,0.10)"
      : tone === "warn"
        ? "rgba(245,158,11,0.14)"
        : tone === "info"
          ? "rgba(59,130,246,0.10)"
          : "rgba(0,0,0,0.05)"};
`;

const SummaryCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
  padding: 12px;
  display: grid;
  gap: 8px;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const QuickActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const QuickBtn = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  padding: 8px 10px;
  background: #fff;
  color: #111;
  cursor: pointer;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }
`;

const Msg = styled.div<{ mine?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ mine }) => (mine ? "rgba(21,255,0,0.08)" : "#fafafa")};
  border-radius: 14px;
  padding: 10px;
  display: grid;
  gap: 6px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 84px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
  padding: 10px 12px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgba(34, 197, 94, 0.45);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  }
`;

const ComposerCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 10px;
  background: #fff;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  ${({ kind }) =>
    kind === "solid"
      ? `background:#15ff00ff;color:#111;`
      : `background:#fff;color:#111;`}
`;

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function newId(prefix = "dv:") {
  return `${prefix}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function getLocalBuyerActor() {
  try {
    const raw = localStorage.getItem("mt.actor");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed;
    }
  } catch {}
  return { id: "buyer:local", name: "Comprador local", role: "buyer" };
}

function looksLikeOrderThread(threadId: string) {
  return safeStr(threadId).startsWith("order:thread:");
}

function getThreadKind(d: any): "order" | "offer" | "design" {
  const tid = safeStr(d?.attrs?.threadId);
  if (looksLikeOrderThread(tid)) return "order";
  if (tid.startsWith("mt.thread.design:")) return "design";
  return "offer";
}

function getReadableStatus(items: any[]) {
  const sorted = [...items].sort((a, b) => parseTs(b) - parseTs(a));
  const last = sorted[0];
  const normalizedText = safeStr(last?.attrs?.text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!last) return { label: "Sin estado", tone: "neutral" as const };

  const k = safeStr(last?.kind);
  const ok = last?.attrs?.ok;

  if (k === "market.order.event") {
    if (ok === true) return { label: "Confirmado", tone: "ok" as const };
    if (ok === false) return { label: "Disputa", tone: "warn" as const };
  }

  if (normalizedText.includes("oferta") && normalizedText.includes("complet")) {
    return { label: "Oferta completada", tone: "ok" as const };
  }

  if (k === "sale.receipt") {
    return { label: "Comprobante", tone: "ok" as const };
  }

  if (k === "market.invoice.draft") {
    return { label: "Factura", tone: "info" as const };
  }

  if (
    normalizedText.includes("debito automatico") &&
    normalizedText.includes("cancel")
  ) {
    return { label: "Suscripción cancelada", tone: "warn" as const };
  }

  if (k === "trade.intent.accept")
    return { label: "Aceptación", tone: "ok" as const };
  if (k === "trade.intent.counter")
    return { label: "Contraoferta", tone: "warn" as const };
  if (k === "trade.intent.barter")
    return { label: "Trueque", tone: "info" as const };
  if (k === "trade.intent.fulfill")
    return { label: "Producción", tone: "info" as const };
  if (k === "mt.demand")
    return { label: "Pedido de variante", tone: "info" as const };
  if (k === "mt.consult")
    return { label: "Consulta", tone: "info" as const };
  if (k === "mt.consult.answer")
    return { label: "Consulta respondida", tone: "ok" as const };

  if (
    k === "trade.intent.message" ||
    k === "trade.message" ||
    k === "market.order.message"
  ) {
    return { label: "Mensaje", tone: "neutral" as const };
  }

  return { label: "Activo", tone: "neutral" as const };
}

function uniqueStrings(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function getLastPreviewText(d: any) {
  return (
    safeStr(d?.attrs?.text) ||
    safeStr(d?.attrs?.note) ||
    safeStr(d?.attrs?.message) ||
    safeStr(d?.attrs?.notes) ||
    (safeStr(d?.kind) === "sale.receipt"
      ? `Comprobante ${safeStr(d?.attrs?.receiptNumber)} · Total: ${safeStr(d?.attrs?.total)} ${safeStr(d?.attrs?.currency)}`
      : safeStr(d?.kind) === "market.invoice.draft"
        ? `Factura ${safeStr(d?.attrs?.invoiceNumber)} · Total: ${safeStr(d?.attrs?.total)} ${safeStr(d?.attrs?.currency)}`
        : safeStr(d?.kind))
  );
}
function shortId(x: any, size = 6) {
  const s = safeStr(x);
  if (!s) return "";
  if (s.length <= size) return s;
  return s.slice(-size);
}

function humanThreadTitle(t: any) {
  const title =
    safeStr(t?.last?.attrs?.title) ||
    safeStr(t?.last?.attrs?.productName) ||
    safeStr(t?.last?.attrs?.nombre) ||
    safeStr(t?.last?.attrs?.name) ||
    safeStr(t?.last?.attrs?.description) ||
    "";

  if (title) return title.slice(0, 54);

  if (t.kind === "order") {
    return `Pedido #${shortId(t.orderId || t.threadId)}`;
  }

  if (t.kind === "design") {
    return `Diseño MO #${shortId(t.productoId || t.offerId || t.threadId)}`;
  }

  return `Conversación #${shortId(t.offerId || t.productoId || t.threadId)}`;
}

function humanActorName(id: any, fallback = "Participante") {
  const s = safeStr(id);
  if (!s) return fallback;

  if (s.includes("buyer")) return "Comprador";
  if (s.includes("cajero")) return "Cajero";
  if (s.includes("seller")) return "Vendedor";
  if (s.includes("mo:")) return "Diseñador MO";
  if (s.includes("local-node")) return "Nodo local";

  return `${fallback} #${shortId(s)}`;
}

function getStepLabel(m: any) {
  const k = safeStr(m?.kind);
  const txt = safeStr(m?.attrs?.text).toLowerCase();

  if (k === "mt.consult") return "Consulta";
  if (k === "mt.consult.answer") return "Respuesta";
  if (k === "sale.receipt") return "Comprobante";
  if (k === "market.invoice.draft") return "Factura";
  if (k === "market.order.event") {
    if (m?.attrs?.ok === true) return "Pago confirmado";
    if (m?.attrs?.ok === false) return "Observación";
    return "Evento";
  }

  if (txt.includes("entregado")) return "Entregado";
  if (txt.includes("retirar")) return "Listo para retirar";
  if (txt.includes("camino")) return "En camino";
  if (txt.includes("reservado")) return "Reservado";
  if (txt.includes("completada")) return "Completado";

  if (k.includes("message")) return "Mensaje";
  if (k.includes("fulfill")) return "Producción";

  return "Actualización";
}

type Props = {
  mode?: TradeMode;
  activeCajero?: any | null;
  title?: string;
  initialThreadId?: string | null;

  /**
   * Si true, el inbox muestra SOLO el hilo recibido por initialThreadId.
   * Ideal para "abrir conversación" desde Trabajos/Pedidos.
   */
  focusThreadOnly?: boolean;

  /**
   * Oculta nombres técnicos largos y vuelve la vista más humana.
   */
  simple?: boolean;
};

export default function TradeInboxPanel({
  mode = "all",
  activeCajero = null,
  title = "Conversaciones vivas",
  initialThreadId = null,
  focusThreadOnly = false,
  simple = true,
}: Props) { 
  const [all, setAll] = useState<any[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [draft, setDraft] = useState("");

  const buyerActor = useMemo(() => getLocalBuyerActor(), []);
  const viewerId =
    mode === "buyer"
      ? String(buyerActor.id || "")
      : mode === "cajero"
        ? String(activeCajero?.id || "")
        : mode === "seller"
          ? "seller"
          : String(activeCajero?.id || buyerActor.id || "");

  useEffect(() => {
    return mtLiveSubscribe((items) => setAll(items || []));
  }, []);

  useEffect(() => {
    if (initialThreadId) {
      setThreadId(initialThreadId);
    }
  }, [initialThreadId]);

  const tradeItems = useMemo(() => {
    return (all || []).filter((d: any) => {
      const k = safeStr(d?.kind);
      const tid = safeStr(d?.attrs?.threadId);

      return (
        !!tid &&
        (k === "trade.message" ||
          k === "trade.intent.accept" ||
          k === "trade.intent.counter" ||
          k === "trade.intent.barter" ||
          k === "trade.intent.fulfill" ||
          k === "trade.intent.message" ||
          k === "market.order.event" ||
          k === "market.order.message" ||
          k === "mt.demand" ||
          k === "sale.receipt" ||
          k === "market.invoice.draft" ||
          k === "mt.consult" ||
          k === "mt.consult.answer")
      );
    });
  }, [all]);

  const filteredThreads = useMemo(() => {
    const map = new Map<string, any[]>();

    for (const d of tradeItems) {
      const tid = safeStr(d?.attrs?.threadId);
      if (!tid) continue;

      const participants = Array.isArray(d?.attrs?.participants)
        ? d.attrs.participants.map(String)
        : [];

      const sellerId =
        safeStr(d?.attrs?.sellerId) ||
        safeStr(d?.attrs?.contact?.sellerId) ||
        safeStr(d?.attrs?.targetAuthor?.id);

      const cajeroId = safeStr(d?.attrs?.cajeroId);

      let match = true;

      if (mode === "buyer") {
        match =
          participants.includes(String(buyerActor.id)) ||
          safeStr(d?.attrs?.buyerId) === String(buyerActor.id) ||
          safeStr(d?.attrs?.fromActorId) === String(buyerActor.id);
      } else if (mode === "cajero") {
        match =
          !!activeCajero?.id &&
          (participants.includes(String(activeCajero.id)) ||
            cajeroId === String(activeCajero.id));
      } else if (mode === "seller") {
        match = !!sellerId;
      }

      if (!match) continue;

      const list = map.get(tid) || [];
      list.push(d);
      map.set(tid, list);
    }

    const threads = Array.from(map.entries()).map(([tid, items]) => {
      const sorted = [...items].sort((a, b) => parseTs(a) - parseTs(b));
      const last = sorted[sorted.length - 1];

      const unread = sorted.filter((x) => {
        const unreadBy = Array.isArray(x?.attrs?.unreadBy)
          ? x.attrs.unreadBy.map(String)
          : [];
        return viewerId && unreadBy.includes(String(viewerId));
      }).length;

      const participants = uniqueStrings(
        sorted.flatMap((x) =>
          Array.isArray(x?.attrs?.participants) ? x.attrs.participants : []
        )
      );

      const orderId = safeStr(last?.attrs?.orderId);
      const offerId = safeStr(last?.attrs?.offerId);
      const productoId =
        safeStr(last?.attrs?.productoId) || safeStr(last?.attrs?.productId);

      const sellerId =
        safeStr(last?.attrs?.sellerId) ||
        safeStr(last?.attrs?.contact?.sellerId) ||
        safeStr(last?.attrs?.targetAuthor?.id);

      const sellerName =
        safeStr(last?.attrs?.contact?.sellerName) ||
        safeStr(last?.attrs?.vendor?.name) ||
        safeStr(last?.attrs?.targetAuthor?.name);

      const authorName =
        safeStr(last?.attrs?.author?.name) ||
        safeStr(last?.attrs?.targetAuthor?.name) ||
        sellerName;

      const cajeroId = safeStr(last?.attrs?.cajeroId);
      const buyerId =
        participants.find((p) => p !== sellerId && p !== cajeroId) ||
        safeStr(last?.attrs?.buyerId) ||
        safeStr(buyerActor.id);

      const total =
        last?.attrs?.total ??
        sorted.find((x) => x?.attrs?.total != null)?.attrs?.total ??
        null;

      const hasReceipt = sorted.some(
        (x) => safeStr(x?.kind) === "sale.receipt"
      );
      const hasInvoice = sorted.some(
        (x) => safeStr(x?.kind) === "market.invoice.draft"
      );

      const state = getReadableStatus(sorted);

      return {
        threadId: tid,
        items: sorted,
        last,
        unread,
        kind: getThreadKind(last),
        participants,
        orderId: orderId || null,
        offerId: offerId || null,
        productoId: productoId || null,
        sellerId: sellerId || null,
        sellerName: sellerName || null,
        authorName: authorName || null,
        buyerId: buyerId || null,
        cajeroId: cajeroId || null,
        total,
        state,
        hasReceipt,
        hasInvoice,
      };
    });
threads.sort((a, b) => parseTs(b.last) - parseTs(a.last));

if (focusThreadOnly && initialThreadId) {
  return threads.filter((t) => String(t.threadId) === String(initialThreadId));
}

return threads;
  }, [tradeItems, mode, activeCajero, buyerActor, viewerId]);

useEffect(() => {
  if (initialThreadId) {
    setThreadId(initialThreadId);
    return;
  }

  if (focusThreadOnly) return;

  if (!threadId && filteredThreads[0]?.threadId) {
    setThreadId(filteredThreads[0].threadId);
  }
}, [filteredThreads, threadId, initialThreadId, focusThreadOnly]);
  const selected = useMemo(() => {
    return filteredThreads.find((t) => t.threadId === threadId) || null;
  }, [filteredThreads, threadId]);

  const markThreadRead = (tid: string) => {
    const th = filteredThreads.find((t) => t.threadId === tid);
    if (!th || !viewerId) return;

    for (const dv of th.items) {
      const unreadBy = Array.isArray(dv?.attrs?.unreadBy)
        ? dv.attrs.unreadBy.map(String)
        : [];

      if (!unreadBy.includes(String(viewerId))) continue;

      mtLiveUpsert({
        ...dv,
        attrs: {
          ...(dv?.attrs || {}),
          unreadBy: unreadBy.filter((x: string) => x !== String(viewerId)),
        },
      } as any);
    }
  };

  const buildReplyPayload = (text: string) => {
    if (!selected) return null;

    const attrs = selected.last?.attrs || {};
    const participants = Array.isArray(attrs?.participants)
      ? attrs.participants.map(String)
      : [];

    const sellerId = safeStr(selected.sellerId || attrs?.sellerId);
    const cajeroId = safeStr(selected.cajeroId || attrs?.cajeroId);
    const buyerId =
      safeStr(selected.buyerId) ||
      participants.find((p: string) => p !== sellerId && p !== cajeroId) ||
      String(buyerActor.id);

    const fromActorId =
      mode === "buyer"
        ? String(buyerActor.id)
        : mode === "cajero"
          ? String(activeCajero?.id || "")
          : mode === "seller"
            ? sellerId || "seller"
            : String(activeCajero?.id || buyerId);

    const targetCandidates = uniqueStrings(
      [buyerId, sellerId, cajeroId].filter(Boolean)
    );
    const unreadBy = targetCandidates.filter((x) => x !== fromActorId);
    const isOrder = selected.kind === "order";

    return {
      isOrder,
      fromActorId,
      buyerId: buyerId || null,
      sellerId: sellerId || null,
      cajeroId: cajeroId || null,
      participants: uniqueStrings(
        [buyerId, sellerId, cajeroId].filter(Boolean)
      ),
      unreadBy,
      text,
      attrs,
    };
  };

  const sendReplyLike = (text: string) => {
    if (!selected) return;
    const payloadText = String(text || "").trim();
    if (!payloadText) return;

    const payload = buildReplyPayload(payloadText);
    if (!payload) return;

    if (payload.isOrder) {
      mtLiveUpsert({
        id: newId("market.order.message:"),
        kind: "market.order.message",
        attrs: {
          threadId: selected.threadId,
          orderId: selected.orderId || payload.attrs?.orderId || null,
          fromActorId: payload.fromActorId,
          toActorId: payload.unreadBy[0] || null,
          buyerId: payload.buyerId,
          sellerId: payload.sellerId,
          cajeroId: payload.cajeroId,
          participants: payload.participants,
          text: payloadText,
          status: "sent",
          unreadBy: payload.unreadBy,
        },
        traits: ["mt:chat", "mt:order.thread"],
        meta: {
          ns: "mt:market",
          ts: nowIso(),
          ttl_ms: 1000 * 60 * 60 * 24 * 7,
          source: "ms:web:order:inbox",
        },
      } as any);
    } else {
      mtLiveUpsert({
        id: newId("trade.message:"),
        kind: "trade.message",
        attrs: {
          threadId: selected.threadId,
          offerId: selected.offerId || payload.attrs?.offerId || null,
          productoId: selected.productoId || payload.attrs?.productoId || null,
          offerType: payload.attrs?.offerType || null,
          fromActorId: payload.fromActorId,
          toActorId: payload.unreadBy[0] || null,
          sellerId: payload.sellerId,
          buyerId: payload.buyerId,
          cajeroId: payload.cajeroId,
          participants: payload.participants,
          text: payloadText,
          actionKind: "trade.intent.message",
          status: "sent",
          unreadBy: payload.unreadBy,
          author: payload.attrs?.author || null,
          contact: payload.attrs?.contact || null,
          vendor: payload.attrs?.vendor || null,
          source: payload.attrs?.source || null,
        },
        traits: ["mt:chat", "mt:thread", "mt:notify.cajero"],
        meta: {
          ns: "mt:market",
          ts: nowIso(),
          ttl_ms: 1000 * 60 * 60 * 24 * 7,
          source: "ms:web:trade:inbox",
        },
      } as any);
    }

    setDraft("");
  };
const publishOperationalEvent = async (dv: any) => {
  mtLiveUpsert(dv);

  try {
    await publishDatoVivo(dv);
  } catch (err) {
    console.warn("[TradeInbox] No se pudo publicar evento operativo:", err);
  }
};

const confirmAndCloseSale = async () => {
  if (!selected) return;

  const attrs = selected.last?.attrs || {};

  const participants = uniqueStrings(
    [
      selected.buyerId,
      selected.sellerId,
      selected.cajeroId,
      ...(Array.isArray(attrs?.participants) ? attrs.participants : []),
    ].filter(Boolean)
  );

  const fromActorId =
    mode === "buyer"
      ? String(buyerActor.id || "")
      : mode === "cajero"
        ? String(activeCajero?.id || selected.cajeroId || "")
        : mode === "seller"
          ? String(selected.sellerId || "")
          : String(activeCajero?.id || selected.sellerId || buyerActor.id || "");

  const unreadBy = participants.filter((x) => String(x) !== String(fromActorId));

  const qtyRaw =
    attrs?.qty ||
    attrs?.quantity ||
    attrs?.cantidad ||
    selected.last?.attrs?.qty ||
    selected.last?.attrs?.quantity ||
    selected.last?.attrs?.cantidad ||
    1;

  const qty = Math.max(1, Number(qtyRaw || 1));

  const event = {
    id: newId("market.order.event:"),
    kind: "market.order.event",
    attrs: {
      threadId: selected.threadId,

      orderId:
        selected.orderId ||
        attrs?.orderId ||
        selected.threadId,

      offerId:
        selected.offerId ||
        attrs?.offerId ||
        attrs?.fromOfferId ||
        null,

      productoId:
        selected.productoId ||
        attrs?.productoId ||
        attrs?.productId ||
        null,

      productId:
        selected.productoId ||
        attrs?.productId ||
        attrs?.productoId ||
        null,

      qty,
      quantity: qty,
      cantidad: qty,

      ok: true,
      eventType: "sale.confirmed",
      action: "confirm.close.sale",
      status: "confirmed",
      paymentStatus: "paid",

      fromActorId,
      toActorId: unreadBy[0] || null,

      buyerId: selected.buyerId || attrs?.buyerId || null,
      sellerId: selected.sellerId || attrs?.sellerId || null,
      cajeroId: selected.cajeroId || attrs?.cajeroId || activeCajero?.id || null,

      participants,
      unreadBy,

      text: "Venta confirmada ✅ Stock/oferta puede cerrarse.",
    },
    traits: [
      "mt:order.event",
      "mt:market",
      "mt:stock.confirmed",
      "mt:sale.confirmed",
    ],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      source: "ms:web:trade:confirm.close.sale",
      status: "confirmed",
    },
  };

  await publishOperationalEvent(event);
};
  return (
    <Box>
      <Header>
        <TitleWrap>
          <Title>
            <MessageCircle size={16} />
            {title}
          </Title>
          <Subtle>{filteredThreads.length} hilo(s) vivos</Subtle>
        </TitleWrap>
      </Header>

      <Grid>
      {!focusThreadOnly && (
  <PanelCard>
    <ThreadList>
      {filteredThreads.length === 0 ? (
        <Subtle>No hay conversaciones todavía.</Subtle>
      ) : (
        filteredThreads.map((t) => {
          const lastText = getLastPreviewText(t.last);

          return (
            <ThreadBtn
              key={t.threadId}
              active={threadId === t.threadId}
              onClick={() => {
                setThreadId(t.threadId);
                markThreadRead(t.threadId);
              }}
            >
              <Row>
                <div style={{ fontWeight: 950 }}>
                  {humanThreadTitle(t)}
                  {t.unread > 0 ? <Dot /> : null}
                </div>

                {t.unread > 0 ? <Badge tone="warn">{t.unread}</Badge> : null}
              </Row>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge
                  tone={
                    t.kind === "order"
                      ? "info"
                      : t.kind === "design"
                        ? "ok"
                        : "neutral"
                  }
                >
                  {t.kind === "order"
                    ? "Pedido"
                    : t.kind === "design"
                      ? "Diseño"
                      : "Oferta"}
                </Badge>

                <Badge tone={t.state.tone}>{t.state.label}</Badge>

                {t.hasReceipt ? <Badge tone="ok">Comprobante</Badge> : null}
                {t.hasInvoice ? <Badge tone="info">Factura</Badge> : null}
              </div>

              {t.authorName ? <Subtle>👤 {t.authorName}</Subtle> : null}
              <Subtle>{lastText || "Sin mensaje todavía"}</Subtle>
            </ThreadBtn>
          );
        })
      )}
    </ThreadList>
  </PanelCard>
)}

        <Conversation>
          {!selected ? (
            <PanelCard>
              <Subtle>
                <MessageCircleOff />
              </Subtle>
            </PanelCard>
          ) : (
            <>
              <SummaryCard>
                <Row>
                  <div style={{ fontWeight: 950 }}>
  {humanThreadTitle(selected)}
</div>
                  <Badge tone={selected.state.tone}>
                    {selected.state.label}
                  </Badge>
                </Row>

                <Chips>
                  {selected.kind === "order" ? (
                    <Badge tone="info">
                      <Package2 size={12} style={{ marginRight: 4 }} />
                      Pedido
                    </Badge>
                  ) : selected.kind === "design" ? (
                    <Badge tone="ok">
                      <Wand2 size={12} style={{ marginRight: 4 }} />
                      Diseño
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      <Megaphone size={12} style={{ marginRight: 4 }} />
                      Oferta
                    </Badge>
                  )}

                {selected.productoId && !simple ? (
  <Badge tone="neutral">
    Producto: {selected.productoId}
  </Badge>
) : null}

                  {selected.authorName ? (
                    <Badge tone="ok">
                      <UserRound size={12} style={{ marginRight: 4 }} />
                      Diseñado por: {selected.authorName}
                    </Badge>
                  ) : null}

                  {selected.total != null ? (
                    <Badge tone="ok">Total: {String(selected.total)}</Badge>
                  ) : null}

                  {selected.hasReceipt ? (
                    <Badge tone="ok">
                      <Receipt size={12} style={{ marginRight: 4 }} />
                      Comprobante
                    </Badge>
                  ) : null}

                  {selected.hasInvoice ? (
                    <Badge tone="info">
                      <FileText size={12} style={{ marginRight: 4 }} />
                      Factura
                    </Badge>
                  ) : null}

          {selected.buyerId && !simple ? (
  <Badge tone="neutral">Buyer: {selected.buyerId}</Badge>
) : null}

{selected.sellerId && !simple ? (
  <Badge tone="neutral">
    Seller: {selected.sellerName || selected.sellerId}
  </Badge>
) : null}

{selected.cajeroId && !simple ? (
  <Badge tone="neutral">Cajero: {selected.cajeroId}</Badge>
) : null}
                </Chips>
              </SummaryCard>

              <QuickActions>
                <QuickBtn onClick={() => sendReplyLike("Voy en camino 🚚")}>
                  <Truck size={14} />
                  Voy en camino
                </QuickBtn>
                <QuickBtn onClick={() => sendReplyLike("Reservado por ahora 🕒")}>
                  <Archive size={14} />
                  Reservado
                </QuickBtn>
                <QuickBtn onClick={() => sendReplyLike("Listo para retirar 📦")}>
                  <Package2 size={14} />
                  Listo para retirar
                </QuickBtn>
                <QuickBtn onClick={() => sendReplyLike("Entregado ✅")}>
                  <CheckCircle2 size={14} />
                  Entregado
                </QuickBtn>
               <QuickBtn onClick={() => sendReplyLike("La oferta quedó completada ✅")}>
  <CheckCircle2 size={14} />
  Mensaje: oferta completada
</QuickBtn>

<QuickBtn onClick={confirmAndCloseSale}>
  <CheckCircle2 size={14} />
  Confirmar y cerrar venta
</QuickBtn>
                <QuickBtn
                  onClick={() =>
                    sendReplyLike("El débito automático fue cancelado ⛔")
                  }
                >
                  <Archive size={14} />
                  Cancelar suscripción
                </QuickBtn>
              </QuickActions>

              <PanelCard>
                <Row style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      wordBreak: "break-all",
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {selected.threadId}
                  </div>
                  <Subtle>{selected.items.length} mensaje(s)</Subtle>
                </Row>

                <MsgList>
                  {selected.items.map((m: any) => {
                    const mine =
                      safeStr(m?.attrs?.fromActorId) === String(viewerId);

                  const rawActor =
  safeStr(m?.attrs?.actorName) ||
  safeStr(m?.attrs?.author?.name) ||
  safeStr(m?.attrs?.targetAuthor?.name) ||
  safeStr(m?.attrs?.fromActorId || "");

const label = rawActor
  ? humanActorName(rawActor, mine ? "Yo" : "Participante")
  : mine
    ? "Yo"
    : "Participante";

const body = getLastPreviewText(m);
const step = getStepLabel(m);

                    return (
                      <Msg key={m.id} mine={mine}>
                        <div style={{ marginBottom: 2 }}>
  <Badge tone={mine ? "ok" : "neutral"}>{step}</Badge>
</div>
                        <Row>
                          <div style={{ fontWeight: 900 }}>{label}</div>
                          <Subtle>{safeStr(m?.meta?.ts || "")}</Subtle>
                        </Row>

                        <div>{body}</div>

                        {m?.kind === "mt.demand" ? (
                          <div style={{ marginBottom: 6 }}>
                            <Badge tone="info">Pedido de variante</Badge>
                          </div>
                        ) : null}

                        {m?.kind === "mt.consult" ? (
                          <div style={{ marginBottom: 6 }}>
                            <Badge tone="info">Consulta</Badge>
                          </div>
                        ) : null}

                        {m?.kind === "mt.consult.answer" ? (
                          <div style={{ marginBottom: 6 }}>
                            <Badge tone="ok">Respuesta de consulta</Badge>
                          </div>
                        ) : null}

                        {m?.kind === "sale.receipt" ? (
                          <div style={{ marginBottom: 6 }}>
                            <Badge tone="ok">
                              <Receipt size={11} style={{ marginRight: 4 }} />
                              Comprobante
                            </Badge>
                          </div>
                        ) : null}

                        {m?.kind === "market.invoice.draft" ? (
                          <div style={{ marginBottom: 6 }}>
                            <Badge tone="info">
                              <FileText size={11} style={{ marginRight: 4 }} />
                              Factura
                            </Badge>
                          </div>
                        ) : null}

                        {(m?.kind === "market.order.event" ||
                          m?.attrs?.ok != null) && (
                          <div>
                            <Badge
                              tone={
                                m?.attrs?.ok === true
                                  ? "ok"
                                  : m?.attrs?.ok === false
                                    ? "warn"
                                    : "neutral"
                              }
                            >
                              {m?.attrs?.ok === true
                                ? "OK"
                                : m?.attrs?.ok === false
                                  ? "NOK"
                                  : "Evento"}
                            </Badge>
                          </div>
                        )}
                      </Msg>
                    );
                  })}
                </MsgList>
              </PanelCard>

              <ComposerCard>
                <TextArea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Responder en este hilo..."
                />

                <BtnRow>
                  <Btn kind="solid" onClick={() => sendReplyLike(draft)}>
                    <Send size={15} />
                    Enviar respuesta
                  </Btn>
                </BtnRow>
              </ComposerCard>
            </>
          )}
        </Conversation>
      </Grid>
    </Box>
  );
}