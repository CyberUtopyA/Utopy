import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  MessageCircle,
  Package2,
  Megaphone,
  Send,
  CheckCircle2,
  MessageCircleOff,
  Wand2,
  UserRound,
  Receipt,
  FileText,
} from "lucide-react";
import { mtLiveSubscribe } from "./mt.liveStore";
import {
  buildThreadActionDV,
  dedupeThreadDVs,
  deriveThreadState,
  formatHumanThreadTime,
  humanThreadEventLabel,
  isThreadDV,
  resolveHumanActorName,
  resolveHumanThreadTitle,
  resolveDvThreadId,
} from "./mt.threadProtocol";
import {
  buildAutopayRevokeRequestDV,
  buildSubscriptionEventDV,
  publishSubscriptionDV,
} from "./mt.subscriptionIntent";
import SignalComposer from "./signalComposer";
import SubscriptionPanel from "./SubscriptionPanel";
import {
  resolveCurrentIdentityContext,
  type CurrentIdentityContext,
} from "../utopy/identityContext";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import ConversationReferences, { uploadConversationReferences } from "../components/ConversationReferences";
type TradeMode = "buyer" | "seller" | "cajero" | "all";

const Box = styled.div<{ $fullScreen?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  background: #fff;
  padding: 12px;
  display: grid;
  gap: 12px;
  ${({ $fullScreen }) => $fullScreen ? `height:100%;min-height:0;overflow:auto;border:0;border-radius:0;background:transparent;padding:8px;align-content:start;` : ""}
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

const MsgList = styled.div<{ $fullScreen?: boolean }>`
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  min-width: 0;
  ${({ $fullScreen }) => $fullScreen ? `max-height:calc(100dvh - 330px);min-height:160px;` : ""}
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

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }
`;

const Msg = styled.div<{
  $variant?: "mine" | "other" | "system" | "state" | "alert" | "success";
}>`
  width: fit-content;
  max-width: 84%;
  justify-self: ${({ $variant }) =>
    $variant === "mine"
      ? "end"
      : $variant === "system" || $variant === "state"
        ? "center"
        : "start"};
  border: 1px solid
    ${({ $variant }) =>
      $variant === "system" || $variant === "state"
        ? "transparent"
        : "rgba(0,0,0,0.08)"};
  background: ${({ $variant }) =>
    $variant === "mine"
      ? "rgba(59,130,246,0.10)"
      : $variant === "success"
        ? "rgba(34,197,94,0.10)"
        : $variant === "alert"
          ? "rgba(245,158,11,0.14)"
          : $variant === "system" || $variant === "state"
            ? "rgba(15,23,42,0.045)"
            : "#fff"};
  border-radius: ${({ $variant }) =>
    $variant === "system" || $variant === "state" ? "999px" : "16px"};
  padding: 10px;
  display: grid;
  gap: 6px;
  font-size: ${({ $variant }) =>
    $variant === "system" || $variant === "state" ? "0.86rem" : "inherit"};
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

const ComposerCard = styled.div<{ $fullScreen?: boolean }>`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 10px;
  background: #fff;
  ${({ $fullScreen }) => $fullScreen ? `position:sticky;bottom:0;border-radius:20px;background:rgba(255,255,255,.92);backdrop-filter:blur(18px);` : ""}
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

function looksLikeOrderThread(threadId: string) {
  return safeStr(threadId).startsWith("order:thread:");
}

function getThreadKind(
  d: any,
): "order" | "offer" | "design" | "work" | "subscription" {
  const tid = safeStr(d?.attrs?.threadId);
  if (looksLikeOrderThread(tid)) return "order";
  if (tid.startsWith("mt.thread.design:")) return "design";
  if (safeStr(d?.kind).startsWith("subscription.")) return "subscription";
  if (safeStr(d?.kind).startsWith("work.")) return "work";
  return "offer";
}

function threadKindLabel(kind: ReturnType<typeof getThreadKind>) {
  if (kind === "order") return "Pedido";
  if (kind === "design") return "Diseño";
  if (kind === "work") return "Trabajo";
  if (kind === "subscription") return "Recurrencia";
  return "Oferta";
}

function getReadableStatus(items: any[], viewerId?: string) {
  const state = deriveThreadState(items, viewerId);
  return { label: state.label, tone: state.tone };
}

function uniqueStrings(arr: any[]) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function getLastPreviewText(d: any) {
  const explicit =
    safeStr(d?.attrs?.text) ||
    safeStr(d?.attrs?.answer) ||
    safeStr(d?.attrs?.note) ||
    safeStr(d?.attrs?.message) ||
    safeStr(d?.attrs?.notes);
  const normalizedExplicit = explicit
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    ["trade.message", "market.order.message"].includes(safeStr(d?.kind)) &&
    normalizedExplicit.includes("debito automatico") &&
    normalizedExplicit.includes("cancel") &&
    !d?.attrs?.authorizationId
  ) {
    return "Solicitud antigua sin confirmación verificable";
  }
  if (explicit) return explicit;
  const humanEvent = humanThreadEventLabel(d);
  if (humanEvent !== "Actualización") return humanEvent;
  return (
    safeStr(d?.kind) === "sale.receipt"
      ? `Comprobante ${safeStr(d?.attrs?.receiptNumber)} · Total: ${safeStr(d?.attrs?.total)} ${safeStr(d?.attrs?.currency)}`
      : safeStr(d?.kind) === "market.invoice.draft"
        ? `Factura ${safeStr(d?.attrs?.invoiceNumber)} · Total: ${safeStr(d?.attrs?.total)} ${safeStr(d?.attrs?.currency)}`
        : "Nueva actualización"
  );
}
function humanThreadTitle(t: any, allLive: any[] = []) {
  return resolveHumanThreadTitle(t, allLive);
}

function getStepLabel(m: any) {
  const k = safeStr(m?.kind);
  const human = humanThreadEventLabel(m);
  if (human !== "Actualización") return human;

  if (k === "mt.consult") return "Consulta";
  if (k === "mt.consult.answer") return "Respuesta";
  if (k === "sale.receipt") return "Comprobante";
  if (k === "market.invoice.draft") return "Factura";
  if (k === "market.order.event") {
    if (m?.attrs?.ok === true) return "Pago confirmado";
    if (m?.attrs?.ok === false) return "Observación";
    return "Evento";
  }

  if (k.includes("message")) return "Mensaje";
  if (k.includes("fulfill")) return "Producción";

  return "Actualización";
}

function messageVariant(m: any, mine: boolean) {
  const kind = safeStr(m?.kind);
  const status = safeStr(
    m?.attrs?.transaction?.state || m?.attrs?.state || m?.attrs?.status,
  ).toLowerCase();
  if (["match.proposal", "resonance.response", "utopy.reaction.proposal"].includes(kind)) {
    return "system" as const;
  }
  if (
    /cancelled|disputed|refund/.test(status) ||
    ["subscription.cancelled"].includes(kind)
  ) {
    return "alert" as const;
  }
  if (
    (kind === "payment.outcome" &&
      Boolean(m?.meta?.ownership?.signature?.value) &&
      safeStr(m?.meta?.authority) === safeStr(m?.attrs?.actingAsNodeId)) ||
    ["value.proof", "trust.proof", "subscription.active"].includes(kind) ||
    (kind === "work.outcome" &&
      (/verified|confirmed|accepted/.test(
        safeStr(m?.attrs?.proof?.status).toLowerCase(),
      ) ||
        m?.attrs?.verified === true)) ||
    status === "completed"
  ) {
    return "success" as const;
  }
  if (
    /^(work\.(plan|execution|outcome)|delivery\.|subscription\.|payment\.autopay\.)/.test(
      kind,
    ) ||
    kind === "market.order.event"
  ) {
    return "state" as const;
  }
  return mine ? ("mine" as const) : ("other" as const);
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
  fullScreen?: boolean;
};

export default function TradeInboxPanel({
  mode = "all",
  activeCajero = null,
  title = "Conversaciones vivas",
  initialThreadId = null,
  focusThreadOnly = false,
  simple = true,
  fullScreen = false,
}: Props) {
  const [all, setAll] = useState<any[]>([]);
  const [identity, setIdentity] = useState<CurrentIdentityContext | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [newNeedMode, setNewNeedMode] = useState<
    "choose" | "same" | "new" | null
  >(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showConversationDetails, setShowConversationDetails] = useState(false);
  const [autopayPanelOpen, setAutopayPanelOpen] = useState(false);
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const buyerActor = useMemo(
    () => ({
      id: identity?.actorId || "",
      name: identity?.displayName || activeCajero?.nombre || activeCajero?.name || "Vos",
      role: "buyer",
    }),
    [identity, activeCajero],
  );
  const viewerId = identity?.actorId || "";
  const cajeroSurfaceId =
    identity?.cajeroId ||
    (/^mt:cajero:/i.test(String(activeCajero?.id || ""))
      ? String(activeCajero.id)
      : "");

  useEffect(() => {
    return mtLiveSubscribe((items) => setAll(items || []));
  }, []);

  useEffect(() => {
    let mounted = true;
    void resolveCurrentIdentityContext({
      allLive: all,
      activeActor: activeCajero,
      actingAsNodeId:
        activeCajero?.nodeId || activeCajero?.attrs?.nodeId || null,
    })
      .then((next) => {
        if (mounted) setIdentity(next);
      })
      .catch(() => {
        if (mounted) setIdentity(null);
      });
    return () => {
      mounted = false;
    };
  }, [all, activeCajero]);

  useEffect(() => {
    if (initialThreadId) {
      setThreadId(initialThreadId);
    }
  }, [initialThreadId]);

  const tradeItems = useMemo(() => {
    const relevant = (all || []).flatMap((d: any) => {
      const tid = resolveDvThreadId(d, all || []);
      if (!tid) return [];
      const linked = {
        ...d,
        attrs: { ...(d?.attrs || {}), threadId: tid },
        meta: { ...(d?.meta || {}), threadId: d?.meta?.threadId || tid },
      };
      return isThreadDV(linked) ? [linked] : [];
    });
    return dedupeThreadDVs(relevant);
  }, [all]);

  const filteredThreads = useMemo(() => {
    const map = new Map<string, any[]>();

    for (const d of tradeItems) {
      const tid = resolveDvThreadId(d);
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
          Boolean(viewerId) &&
          (participants.includes(viewerId) ||
            safeStr(d?.attrs?.buyerId) === viewerId ||
            safeStr(d?.attrs?.fromActorId) === viewerId);
      } else if (mode === "cajero") {
        match =
          Boolean(viewerId) &&
          (participants.includes(viewerId) ||
            (Boolean(cajeroSurfaceId) &&
              (participants.includes(cajeroSurfaceId) ||
                cajeroId === cajeroSurfaceId)));
      } else if (mode === "seller") {
        match =
          Boolean(viewerId) &&
          (sellerId === viewerId || participants.includes(viewerId));
      } else {
        match =
          Boolean(viewerId) &&
          (participants.includes(viewerId) ||
            safeStr(d?.attrs?.buyerId) === viewerId ||
            sellerId === viewerId ||
            (Boolean(cajeroSurfaceId) &&
              (participants.includes(cajeroSurfaceId) || cajeroId === cajeroSurfaceId)));
      }

      if (!match) continue;

      const list = map.get(tid) || [];
      list.push(d);
      map.set(tid, list);
    }

    const threads = Array.from(map.entries()).map(([tid, items]) => {
      const sorted = [...items].sort((a, b) => parseTs(a) - parseTs(b));
      const last = sorted[sorted.length - 1];

      const unread = readThreadIds.has(tid) ? 0 : sorted.filter((x) => {
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

      const stateActorId =
        mode === "seller"
          ? identity?.actingAsNodeId || viewerId
          : viewerId;
      const operationState = deriveThreadState(sorted, stateActorId);
      const state = getReadableStatus(sorted, stateActorId);

      return {
        threadId: tid,
        items: sorted,
        last,
        unread,
        kind: getThreadKind(
          sorted.find((item) =>
            /^(subscription\.|work\.)/.test(safeStr(item?.kind)),
          ) || last,
        ),
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
        operationState,
        hasReceipt,
        hasInvoice,
      };
    });
threads.sort((a, b) => parseTs(b.last) - parseTs(a.last));

if (focusThreadOnly && initialThreadId) {
  return threads.filter((t) => String(t.threadId) === String(initialThreadId));
}

return threads;
  }, [tradeItems, mode, buyerActor, viewerId, cajeroSurfaceId, identity, readThreadIds]);

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

  useEffect(() => {
    setNewNeedMode(null);
    setDetailsOpen(false);
    setAutopayPanelOpen(false);
  }, [threadId]);

  useEffect(() => { setDraft(""); setReferenceFiles([]); setReplyError(""); }, [threadId]);

  const markThreadRead = (tid: string) => {
    if (!viewerId) return;
    setReadThreadIds((current) => {
      const next = new Set(current);
      next.add(tid);
      return next;
    });
  };

  const buildReplyPayload = (text: string) => {
    if (!selected || !viewerId) return null;

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

    const fromActorId = viewerId;

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

  const sendReplyLike = async (text: string) => {
    if (!selected || replySending) return;
    const payloadText = String(text || "").trim() || (referenceFiles.length ? "Te comparto estas referencias para el diseño." : "");
    if (!payloadText) return;

    const payload = buildReplyPayload(payloadText);
    if (!payload) return;
    setReplySending(true);
    setReplyError("");
    try {
    const attachments = await uploadConversationReferences(referenceFiles);

    const kind = payload.isOrder ? "market.order.message" : "trade.message";
    const actorName =
      mode === "buyer"
        ? buyerActor.name || "Comprador local"
        : mode === "cajero"
          ? activeCajero?.nombre || activeCajero?.name || "Cajero"
          : selected.sellerName || "Participante";
    const messageDV = buildThreadActionDV({
      kind,
      threadId: selected.threadId,
      text: payloadText,
      fromActorId: payload.fromActorId,
      fromActorName: actorName,
      toActorId: payload.unreadBy[0] || null,
      participants: payload.participants,
      responseToId: selected.last?.id || null,
      chainId:
        selected.last?.attrs?.chainId ||
        selected.last?.attrs?.relation?.chainId ||
        selected.last?.meta?.chainId ||
        selected.threadId,
      rootDvId:
        selected.last?.attrs?.rootDvId ||
        selected.last?.attrs?.relation?.rootDvId ||
        selected.last?.meta?.rootDvId ||
        selected.items?.[0]?.id ||
        null,
      parentDvId: selected.last?.id || null,
      attrs: {
        attachments,
        designId: payload.attrs?.designId || null,
        versionId: payload.attrs?.versionId || null,
        workId: payload.attrs?.workId || null,
        orderId: selected.orderId || payload.attrs?.orderId || null,
        offerId: selected.offerId || payload.attrs?.offerId || null,
        productoId: selected.productoId || payload.attrs?.productoId || null,
        offerType: payload.attrs?.offerType || null,
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        cajeroId: payload.cajeroId,
        author: payload.attrs?.author || null,
        contact: payload.attrs?.contact || null,
        vendor: payload.attrs?.vendor || null,
        source: payload.attrs?.source || null,
      },
      traits: payload.isOrder
        ? ["mt:chat", "mt:order.thread"]
        : ["mt:chat", "mt:notify.cajero"],
      meta: {
        source: payload.isOrder
          ? "ms:web:order:inbox"
          : "ms:web:trade:inbox",
      },
    });
    await publishOperationalEvent(messageDV);

    setDraft("");
    setReferenceFiles([]);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "No pudimos enviar tu mensaje. Probá otra vez.");
    } finally { setReplySending(false); }
  };
const publishOperationalEvent = async (dv: any) => {
  try {
    await publishAuthorizedDV({
      dv,
      allLive: all,
      activeActor: activeCajero,
      action: dv?.kind,
      actingAsNodeId: identity?.actingAsNodeId || null,
      targetNodeId: dv?.attrs?.targetNodeId || null,
    });
  } catch (err) {
    console.warn("[TradeInbox] No se pudo publicar evento operativo:", err);
    throw err;
  }
};

const confirmReceived = async () => {
  if (!selected) return;
  if (!["buyer", "requester"].includes(selected.operationState.role)) return;

  const attrs = selected.last?.attrs || {};

  const participants = uniqueStrings(
    [
      selected.buyerId,
      selected.sellerId,
      selected.cajeroId,
      ...(Array.isArray(attrs?.participants) ? attrs.participants : []),
    ].filter(Boolean)
  );

  const fromActorId = viewerId;
  if (!fromActorId) return;

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
    id: newId("delivery.received:"),
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
      eventType: "delivery.received.confirmed",
      action: "transaction.completed",
      status: "completed",
      state: "completed",

      fromActorId,
      toActorId: unreadBy[0] || null,

      buyerId: selected.buyerId || attrs?.buyerId || null,
      sellerId: selected.sellerId || attrs?.sellerId || null,
      cajeroId: selected.cajeroId || attrs?.cajeroId || cajeroSurfaceId || null,

      participants,
      unreadBy,

      text: "Recepción confirmada",
    },
    traits: [
      "mt:order.event",
      "mt:market",
      "delivery:received",
      "consent:confirmed",
    ],
    meta: {
      ns: "mt:market",
      ts: nowIso(),
      source: "ms:web:trade:confirm.received",
      status: "completed",
    },
  };

  await publishOperationalEvent(event);
};

const requestSubscriptionAction = async (
  kind: "subscription.pause.request" | "subscription.cancel.request",
) => {
  if (!selected) return;
  const recurrence = selected.operationState.subscription;
  const allowed =
    kind === "subscription.pause.request"
      ? recurrence.canPause
      : recurrence.canCancel;
  if (!allowed) return;
  const replyIdentity = buildReplyPayload("");
  if (!replyIdentity) return;
  await publishOperationalEvent(
    buildThreadActionDV({
      kind,
      threadId: selected.threadId,
      chainId:
        selected.last?.attrs?.chainId ||
        selected.last?.meta?.chainId ||
        selected.threadId,
      rootDvId:
        selected.last?.attrs?.rootDvId || selected.items?.[0]?.id || null,
      parentDvId: recurrence.evidence.subscription?.id || selected.last?.id || null,
      responseToId: recurrence.evidence.subscription?.id || null,
      text:
        kind === "subscription.pause.request"
          ? "Solicito pausar el abastecimiento recurrente"
          : "Solicito cancelar el abastecimiento recurrente",
      fromActorId: replyIdentity.fromActorId,
      fromActorName:
        mode === "buyer"
          ? buyerActor.name || "Comprador"
          : activeCajero?.nombre || selected.sellerName || "Participante",
      participants: replyIdentity.participants,
      attrs: {
        subscriptionId: recurrence.subscriptionId,
        status: "requested",
        security: {
          requiresConsent: true,
          automaticConfirmation: false,
        },
      },
      traits: ["mt:subscription", "utopy:action.request", "consent:required"],
    }),
  );
};

const acceptSubscriptionProposal = async () => {
  if (!selected) return;
  const recurrence = selected.operationState.subscription;
  if (!recurrence.canAccept || !recurrence.evidence.subscription) return;
  const replyIdentity = buildReplyPayload("");
  if (!replyIdentity) return;
  const proposal = recurrence.evidence.subscription;
  await publishSubscriptionDV(
    buildSubscriptionEventDV("subscription.accepted", {
      threadId: selected.threadId,
      chainId:
        proposal?.attrs?.chainId || proposal?.meta?.chainId || selected.threadId,
      rootDvId:
        proposal?.attrs?.rootDvId || proposal?.meta?.rootDvId || selected.items?.[0]?.id,
      parentDvId: proposal.id || null,
      subscriptionId: recurrence.subscriptionId,
      orderId: proposal?.attrs?.orderId || selected.orderId,
      actorId: replyIdentity.fromActorId,
      actorName:
        mode === "buyer"
          ? buyerActor.name || "Comprador"
          : activeCajero?.nombre || selected.sellerName || "Participante",
      participants: replyIdentity.participants,
      title: proposal?.attrs?.title || humanThreadTitle(selected, all),
      frequency: proposal?.attrs?.frequency || null,
      every: proposal?.attrs?.every || 1,
      nextOccurrence: proposal?.attrs?.nextOccurrence || null,
      authority: replyIdentity.fromActorId,
    }),
    {
      allLive: all,
      activeActor: activeCajero,
      actingAsNodeId: identity?.actingAsNodeId || null,
    },
  );
};

const requestAutopayRevoke = async () => {
  if (!selected) return;
  const recurrence = selected.operationState.subscription;
  if (!recurrence.autopay.canRevoke || recurrence.autopay.pendingRevoke) return;
  const replyIdentity = buildReplyPayload("");
  if (!replyIdentity) return;
  await publishSubscriptionDV(
    buildAutopayRevokeRequestDV({
      threadId: selected.threadId,
      chainId:
        selected.last?.attrs?.chainId ||
        selected.last?.meta?.chainId ||
        selected.threadId,
      rootDvId:
        selected.last?.attrs?.rootDvId || selected.items?.[0]?.id || null,
      parentDvId:
        recurrence.evidence.autopayAuthorization?.id || selected.last?.id || null,
      subscriptionId: recurrence.subscriptionId,
      authorizationId: recurrence.autopay.authorizationId,
      actorId: replyIdentity.fromActorId,
      actorName:
        mode === "buyer"
          ? buyerActor.name || "Comprador"
          : activeCajero?.nombre || selected.sellerName || "Participante",
      buyerId: selected.buyerId,
      sellerId: selected.sellerId,
      participants: replyIdentity.participants,
      reason: "Solicitado desde el Hilo Vivo",
    }),
    {
      allLive: all,
      activeActor: activeCajero,
      actingAsNodeId: identity?.actingAsNodeId || null,
    },
  );
};
  return (
    <Box $fullScreen={fullScreen}>
      {!fullScreen ? <Header>
        <TitleWrap>
          <Title>
            <MessageCircle size={16} />
            {title}
          </Title>
          <Subtle>{filteredThreads.length} hilo(s) vivos</Subtle>
        </TitleWrap>
      </Header> : null}

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
                  {humanThreadTitle(t, all)}
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
                  {threadKindLabel(t.kind)}
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
              {fullScreen ? <QuickBtn onClick={() => setShowConversationDetails((visible) => !visible)}>{showConversationDetails ? "Ocultar detalles" : "Ver operación"}</QuickBtn> : null}
              {(!fullScreen || showConversationDetails) ? <><SummaryCard>
                <Row>
                  <div style={{ fontWeight: 950 }}>
   {humanThreadTitle(selected, all)}
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
                  ) : selected.kind === "work" ? (
                    <Badge tone="info">🛠 Trabajo</Badge>
                  ) : selected.kind === "subscription" ? (
                    <Badge tone="info">🔁 Recurrencia</Badge>
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
                <QuickBtn
                  disabled={!selected.operationState.primaryEnabled}
                  onClick={() => {
                    const action = selected.operationState.primaryAction;
                    if (action === "confirm_received") void confirmReceived();
                    else if (action === "talk") composerRef.current?.focus();
                    else if (action === "manage_recurrence") setDetailsOpen(true);
                    else setDetailsOpen(true);
                  }}
                >
                  <CheckCircle2 size={14} />
                  {selected.operationState.primaryLabel}
                </QuickBtn>
                <details>
                  <summary style={{ cursor: "pointer", padding: "8px 10px", fontWeight: 950 }}>•••</summary>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <QuickBtn onClick={() => setNewNeedMode("choose")}>
                      <Megaphone size={14} />Necesito algo más
                    </QuickBtn>
                    <QuickBtn onClick={() => setDetailsOpen((value) => !value)}>
                      Ver detalles
                    </QuickBtn>
                    {selected.operationState.subscription.canPause ? (
                      <QuickBtn
                        onClick={() =>
                          void requestSubscriptionAction("subscription.pause.request")
                        }
                      >
                        Pausar recurrencia
                      </QuickBtn>
                    ) : null}
                    {selected.operationState.subscription.canCancel ? (
                      <QuickBtn
                        onClick={() =>
                          void requestSubscriptionAction("subscription.cancel.request")
                        }
                      >
                        Cancelar recurrencia
                      </QuickBtn>
                    ) : null}
                    {selected.operationState.subscription.autopay.canRevoke ? (
                      <QuickBtn
                        disabled={
                          selected.operationState.subscription.autopay.pendingRevoke
                        }
                        onClick={() => void requestAutopayRevoke()}
                      >
                        {selected.operationState.subscription.autopay.pendingRevoke
                          ? "Desactivación solicitada"
                          : "Desactivar débito automático"}
                      </QuickBtn>
                    ) : null}
                  </div>
                </details>
              </QuickActions></> : null}

              {detailsOpen ? (
                <PanelCard>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Detalles</div>
                  <Subtle>Estado: {selected.operationState.label}</Subtle>
                  <Subtle>Tu rol: {selected.operationState.role}</Subtle>
                  {selected.operationState.subscription.exists ? (
                    <Subtle>
                      Recurrencia: {selected.operationState.subscription.status}
                    </Subtle>
                  ) : null}
                  {selected.operationState.subscription.canAccept ? (
                    <QuickBtn
                      style={{ marginTop: 8 }}
                      onClick={() => void acceptSubscriptionProposal()}
                    >
                      Aceptar suministro recurrente
                    </QuickBtn>
                  ) : null}
                  {selected.operationState.subscription.autopay.status === "active" ? (
                    <Subtle>Pago automático: activo</Subtle>
                  ) : selected.operationState.subscription.autopay.status === "revoked" ? (
                    <Subtle>Pago automático: desactivado</Subtle>
                  ) : selected.operationState.subscription.status === "active" ? (
                    <>
                      <Subtle>Pago: manual, sin débito automático</Subtle>
                      {selected.sellerId ? (
                        <QuickBtn
                          style={{ marginTop: 8 }}
                          onClick={() => setAutopayPanelOpen(true)}
                        >
                          Solicitar pago automático
                        </QuickBtn>
                      ) : null}
                    </>
                  ) : null}
                  {import.meta.env.DEV && !simple ? (
                    <Subtle>
                      threadId: {selected.threadId} · chainId:{" "}
                      {selected.last?.attrs?.chainId || selected.last?.meta?.chainId || "—"}
                    </Subtle>
                  ) : null}
                </PanelCard>
              ) : null}

              {newNeedMode === "choose" ? (
                <PanelCard>
                  <div style={{ fontWeight: 900 }}>¿Qué necesitás ahora?</div>
                  <Subtle style={{ marginTop: 4 }}>
                    Elegí si pertenece a esta operación o si es una necesidad nueva.
                  </Subtle>
                  <QuickActions style={{ marginTop: 10 }}>
                    <QuickBtn onClick={() => setNewNeedMode("same")}>
                      Continuar con esta operación
                    </QuickBtn>
                    <QuickBtn onClick={() => setNewNeedMode("new")}>
                      Nueva necesidad
                    </QuickBtn>
                  </QuickActions>
                </PanelCard>
              ) : null}

              {newNeedMode === "same" || newNeedMode === "new" ? (
                <SignalComposer
                  actorId={
                    viewerId
                  }
                  actorName={
                    mode === "buyer"
                      ? buyerActor.name || "Vos"
                      : activeCajero?.nombre || selected.sellerName || "Participante"
                  }
                  nodeId={identity?.actingAsNodeId || null}
                  threadId={newNeedMode === "same" ? selected.threadId : null}
                  chainId={
                    newNeedMode === "same"
                      ? selected.last?.attrs?.chainId ||
                        selected.last?.meta?.chainId ||
                        selected.threadId
                      : null
                  }
                  sourceDV={newNeedMode === "same" ? selected.last : null}
                  allLive={all}
                  activeActor={activeCajero}
                  relatedToThreadId={
                    newNeedMode === "new" ? selected.threadId : null
                  }
                  previousChainId={
                    newNeedMode === "new"
                      ? selected.last?.attrs?.chainId ||
                        selected.last?.meta?.chainId ||
                        selected.threadId
                      : null
                  }
                  initialMode="need"
                  initialCategory="other"
                  compact
                  onPublished={() => setNewNeedMode(null)}
                  onClose={() => setNewNeedMode(null)}
                />
              ) : null}

              {selected.sellerId ? (
                <SubscriptionPanel
                  open={autopayPanelOpen}
                  onClose={() => setAutopayPanelOpen(false)}
                  sellerId={selected.sellerId}
                  sellerName={selected.sellerName}
                  threadId={selected.threadId}
                  chainId={
                    selected.last?.attrs?.chainId ||
                    selected.last?.meta?.chainId ||
                    selected.threadId
                  }
                  rootDvId={
                    selected.last?.attrs?.rootDvId || selected.items?.[0]?.id || null
                  }
                  subscriptionId={
                    selected.operationState.subscription.subscriptionId
                  }
                  suggestAmount={Number(selected.total || 0)}
                  allLive={all}
                />
              ) : null}

              <PanelCard>
                <Row style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>Historia</div>
                </Row>

                <MsgList $fullScreen={fullScreen}>
                  {selected.items.map((m: any) => {
                    const mine =
                      safeStr(m?.attrs?.fromActorId || m?.attrs?.actorId) ===
                      viewerId;
                    const label = resolveHumanActorName(
                      m,
                      viewerId,
                      all,
                    );
                    const body = getLastPreviewText(m);
                    const step = getStepLabel(m);
                    const variant = messageVariant(m, mine);
                    const compactEvent = variant === "system" || variant === "state";

                    return (
                      <Msg key={m.id} $variant={variant}>
                        {compactEvent ? (
                          <div style={{ fontWeight: 850 }}>
                            {variant === "system" ? "✨ " : ""}
                            {step}
                          </div>
                        ) : (
                          <Row>
                            <div style={{ fontWeight: 900 }}>{label}</div>
                            <Subtle>{formatHumanThreadTime(m)}</Subtle>
                          </Row>
                        )}

                        {body && body !== step ? <div>{body}</div> : null}
                        {Array.isArray(m?.attrs?.attachments) ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 8 }}>{m.attrs.attachments.filter((attachment: any) => typeof attachment.url === "string" && /^https?:\/\//i.test(attachment.url) && /^image\//i.test(attachment.mime || "")).map((attachment: any, index: number) => <a key={`${attachment.url}:${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" style={{ overflow: "hidden", borderRadius: 14, textDecoration: "none", color: "inherit", background: "rgba(255,255,255,.7)" }}><img src={attachment.url} alt={attachment.name || "Referencia del diseño"} loading="lazy" style={{ width: "100%", height: 160, objectFit: "cover" }}/><small style={{ display: "block", padding: 7 }}>Referencia del diseño · ver foto ↗</small></a>)}</div> : null}

                        {compactEvent ? (
                          <Subtle style={{ textAlign: "center" }}>
                            {formatHumanThreadTime(m)}
                          </Subtle>
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

                      </Msg>
                    );
                  })}
                </MsgList>
              </PanelCard>

              <ComposerCard $fullScreen={fullScreen}>
                <ConversationReferences files={referenceFiles} onChange={setReferenceFiles} disabled={replySending}/>
                <TextArea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Responder en este hilo..."
                />

                <BtnRow>
                  <Btn kind="solid" disabled={replySending || (!draft.trim() && !referenceFiles.length)} onClick={() => sendReplyLike(draft)}>
                    <Send size={15} />
                    {replySending ? "Enviando…" : "Enviar respuesta"}
                  </Btn>
                </BtnRow>
                {replyError ? <small role="alert">{replyError}</small> : null}
              </ComposerCard>
            </>
          )}
        </Conversation>
      </Grid>
    </Box>
  );
}
