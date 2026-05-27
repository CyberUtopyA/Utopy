import { PaymentMethod } from "./mt.intentpayment";
import { mtLiveSubscribe } from "./mt.liveStore";
import { emitPaymentSessionStatus } from "./paymentsession";

// src/mt/payments/paymentBotRuntime.ts
type AnyDV = any;

function safeStr(x: any, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}
function safeNum(x: any, fb = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fb;
}
function parseTs(x: any): number {
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : 0;
}
function safeBool(x: any, fb = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  const s = safeStr(x).trim().toLowerCase();
  if (!s) return fb;
  if (["true", "1", "yes", "si", "sí", "on", "online", "active", "activo"].includes(s)) return true;
  if (["false", "0", "no", "off", "offline", "inactive", "inactivo"].includes(s)) return false;
  return fb;
}
function safeArr<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function isKind(d: AnyDV, kind: string) {
  return safeStr(d?.kind) === kind;
}

function normalizeMethod(m: any): PaymentMethod | null {
  if (!m || typeof m !== "object") return null;
  const channel = safeStr(m.channel).trim();
  if (!channel) return null;
  return {
    channel,
    label: m.label ? safeStr(m.label) : undefined,
    address: m.address != null ? safeStr(m.address) : null,
    link: m.link != null ? safeStr(m.link) : null,
    qr: m.qr != null ? safeStr(m.qr) : null,
    meta: m.meta && typeof m.meta === "object" ? m.meta : undefined,
  };
}

function uniqMethods(xs: PaymentMethod[]) {
  const seen = new Set<string>();
  const out: PaymentMethod[] = [];
  for (const m of xs) {
    const key = `${safeStr(m?.channel).toLowerCase()}|${safeStr(m?.label).toLowerCase()}`;
    if (!safeStr(m?.channel)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function latestBy<T = AnyDV>(arr: T[], tsFn: (x: T) => number): T | null {
  return [...arr].sort((a, b) => tsFn(b) - tsFn(a))[0] || null;
}

export type RuntimeCajero = {
  id: string;
  nombre?: string | null;
  online?: boolean;
  guard?: boolean;
  negotiator?: boolean;
  creditEnabled?: boolean;
  trustScore?: number | null;
};

export type PaymentBotRuntime = {
  stop: () => void;
  tick: () => Promise<void>;
};

export function startPaymentBotRuntime(opts: {
  sellerId: string;
  sellerName?: string | null;
  ns?: string;
  tickMs?: number;
  assignAfterMs?: number;
  expireAfterMs?: number;
  cajeros?: RuntimeCajero[];
}) : PaymentBotRuntime {
  const ns = opts.ns ?? "mt:market";
  const tickMs = opts.tickMs ?? 15_000;
  const assignAfterMs = opts.assignAfterMs ?? 60_000;
  const expireAfterMs = opts.expireAfterMs ?? 1000 * 60 * 60 * 8;

  let latest: AnyDV[] = [];
  let stopped = false;
  let timer: any = null;

  const unsub = mtLiveSubscribe((xs: AnyDV[]) => {
    latest = Array.isArray(xs) ? xs : [];
  });

  function getOpenSessions() {
    const opens = latest
      .filter((d) => isKind(d, "payment.session.open"))
      .filter((d) => safeStr(d?.attrs?.sellerId) === safeStr(opts.sellerId));

    return opens.map((open) => {
      const sessionId = safeStr(open?.attrs?.sessionId);
      const orderId = safeStr(open?.attrs?.orderId || "") || null;
      const threadId = safeStr(open?.attrs?.threadId || "") || null;
      const buyerId = safeStr(open?.attrs?.buyerId || "") || null;

      const statuses = latest.filter(
        (d) =>
          isKind(d, "payment.session.status") &&
          safeStr(d?.attrs?.sessionId) === sessionId
      );
      const lastStatus = latestBy(statuses, (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts));

      const proof = latestBy(
        latest.filter(
          (d) =>
            isKind(d, "payment.proof") &&
            (
              (orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId)
            )
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const proposal = latestBy(
        latest.filter(
          (d) =>
            isKind(d, "payment.proposal") &&
            (
              (orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId)
            )
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const proximity = latestBy(
        latest.filter(
          (d) =>
            isKind(d, "payment.proximity") &&
            (
              (orderId && safeStr(d?.attrs?.orderId) === orderId) ||
              (threadId && safeStr(d?.attrs?.threadId) === threadId) ||
              (buyerId && safeStr(d?.attrs?.buyerId) === buyerId)
            )
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      const outcome = latestBy(
        latest.filter(
          (d) =>
            isKind(d, "payment.outcome") &&
            orderId &&
            safeStr(d?.attrs?.orderId) === orderId
        ),
        (d) => parseTs((d as any)?.meta?.ts || (d as any)?.attrs?.ts)
      );

      return { open, lastStatus, proof, proposal, proximity, outcome };
    });
  }

  function chooseAvailableCajero() {
    const cajeros = safeArr<RuntimeCajero>(opts.cajeros || []);
    const online = cajeros.filter((c) => !!c.online);
    const guards = online.filter((c) => !!c.guard);
    if (guards.length) return guards[0];
    if (online.length) return online[0];
    return cajeros[0] || null;
  }

  async function processSession(x: ReturnType<typeof getOpenSessions>[number]) {
    const now = Date.now();
    const open = x.open;
    const sessionId = safeStr(open?.attrs?.sessionId);
    const orderId = safeStr(open?.attrs?.orderId || "") || null;
    const threadId = safeStr(open?.attrs?.threadId || "") || null;
    const buyerId = safeStr(open?.attrs?.buyerId || "") || null;
    const buyerName = safeStr(open?.attrs?.buyerName || "") || null;
    const amount = safeNum(open?.attrs?.amount, 0);
    const currency = safeStr(open?.attrs?.currency || "PYG");
    const lastStatus = safeStr(x.lastStatus?.attrs?.status || "open").toLowerCase();
    const openTs = parseTs(open?.meta?.ts);
    const proofTs = parseTs(x.proof?.meta?.ts || x.proof?.attrs?.ts);
    const proposalTs = parseTs(x.proposal?.meta?.ts || x.proposal?.attrs?.ts);
    const outcomeStatus = safeStr(x.outcome?.attrs?.status || "").toLowerCase();

    if (["paid", "rejected", "cancelled"].includes(outcomeStatus)) return;

    if (openTs && now - openTs > expireAfterMs) {
      await emitPaymentSessionStatus({
        sessionId,
        orderId,
        threadId,
        sellerId: opts.sellerId,
        buyerId,
        status: "expired",
        amount,
        currency,
        reason: "session.timeout",
        note: "Sesión expirada por tiempo",
        ns,
        source: "ms.payment.bot.expire",
      });
      return;
    }

   if (x.proof) {
  const cajero = chooseAvailableCajero();

  await emitPaymentSessionStatus({
    sessionId,
    orderId,
    threadId,
    sellerId: opts.sellerId,
    buyerId,
    status: "pending_review",
    assignedCajeroId: cajero?.id ?? null,
    assignedCajeroName: cajero?.nombre ?? null,
    amount,
    currency,
    chosen: normalizeMethod(x.proposal?.attrs?.recommended),
    reason: "proof.received",
    note: cajero?.id
      ? "Comprobante recibido, pendiente de revisión por cajero activo"
      : "Comprobante recibido, pendiente de revisión",
    ns,
    actorId: cajero?.id || opts.sellerId,
    source: "ms.payment.bot.pendingReview",
  });

  return;
}

    if (!x.proposal) {
      await emitPaymentSessionStatus({
        sessionId,
        orderId,
        threadId,
        sellerId: opts.sellerId,
        buyerId,
        status: "open",
        amount,
        currency,
        reason: "awaiting.proposal",
        note: "Esperando propuesta automática",
        ns,
        source: "ms.payment.bot.open",
      });
      return;
    }

    const assignedAlready = lastStatus === "assigned";
const hasOnlineCajero = !!chooseAvailableCajero()?.id;

if (proposalTs && now - proposalTs < assignAfterMs) {
  if (hasOnlineCajero && !x.proof && !assignedAlready) {
    const cajero = chooseAvailableCajero();

    await emitPaymentSessionStatus({
      sessionId,
      orderId,
      threadId,
      sellerId: opts.sellerId,
      buyerId,
      status: "assigned",
      assignedCajeroId: cajero?.id ?? null,
      assignedCajeroName: cajero?.nombre ?? null,
      amount,
      currency,
      chosen: normalizeMethod(x.proposal?.attrs?.recommended),
      reason: "active.cajero.available",
      note: "Sesión tomada automáticamente por cajero activo",
      ns,
      actorId: cajero?.id || opts.sellerId,
      source: "ms.payment.bot.autoAssigned",
    });
    return;
  }

  if (!["waiting_proof", "assigned", "queued"].includes(lastStatus)) {
    await emitPaymentSessionStatus({
      sessionId,
      orderId,
      threadId,
      sellerId: opts.sellerId,
      buyerId,
      status: "waiting_proof",
      amount,
      currency,
      chosen: normalizeMethod(x.proposal?.attrs?.recommended),
      reason: safeStr(x.proposal?.attrs?.reason || "proposal.active"),
      note: "Propuesta enviada, esperando comprobante o confirmación",
      ns,
      source: "ms.payment.bot.waitingProof",
    });
  }
  return;
}

    const cajero = chooseAvailableCajero();

    if (cajero?.id) {
      await emitPaymentSessionStatus({
        sessionId,
        orderId,
        threadId,
        sellerId: opts.sellerId,
        buyerId,
        status: "assigned",
        assignedCajeroId: cajero.id,
        assignedCajeroName: cajero.nombre ?? null,
        amount,
        currency,
        chosen: normalizeMethod(x.proposal?.attrs?.recommended),
        reason: "assigned.after.timeout",
        note: "Sesión asignada a cajero disponible",
        ns,
        actorId: cajero.id,
        source: "ms.payment.bot.assigned",
      });

      return;
    }

    await emitPaymentSessionStatus({
      sessionId,
      orderId,
      threadId,
      sellerId: opts.sellerId,
      buyerId,
      status: "queued",
      amount,
      currency,
      chosen: normalizeMethod(x.proposal?.attrs?.recommended),
      reason: "no.cajero.available",
      note: "En cola, esperando cajero disponible",
      ns,
      source: "ms.payment.bot.queued",
    });
  }

  const tick = async () => {
    if (stopped) return;

    const sessions = getOpenSessions();
    for (const s of sessions) {
      await processSession(s);
    }
  };

  timer = setInterval(() => void tick(), tickMs);
  setTimeout(() => void tick(), 1200);

  return {
    stop: () => {
      stopped = true;
      try { clearInterval(timer); } catch {}
      try { unsub?.(); } catch {}
    },
    tick,
  };
}