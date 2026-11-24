export type LoyaltySource = {
  id: string;
  nodeId: string;
  name: string;
  emoji: string;
  description: string;
  endpoint: string;
  memberPlaceholder: string;
  required: number;
  accent?: string;
};

export type LoyaltyPassport = {
  sourceId: string;
  memberId: string;
  stamps: number;
  totalStamps: number;
  required: number;
  rewardsAvailable: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  history: Array<{ id: string; at?: string | null; label?: string | null }>;
  updatedAt?: string | null;
  raw?: any;
};

type RuntimeWindow = Window & {
  __UTOPY_LOYALTY_SOURCES__?: LoyaltySource[];
};

const DEFAULT_SOURCES: LoyaltySource[] = [
  {
    id: "lapiedra-coffee",
    nodeId: "utopy.node.lapiedra.coffee",
    name: "LaPiedra Coffee",
    emoji: "☕",
    description: "Pasaporte del Viajero · el sello aparece al entregar el pedido.",
    endpoint: "https://lapiedracoffee.com/api/traveler.php?id={memberId}",
    memberPlaceholder: "LPV-XXXX-XXXX",
    required: 8,
    accent: "#194d2c",
  },
  {
    id: "decohogar",
    nodeId: "utopy.node.decohogar",
    name: "DecoHogar",
    emoji: "🛋️",
    description: "Tarjeta de fidelidad del cliente, leída desde el nodo DecoHogar.",
    endpoint: "https://decohogar.utopy.live/api/loyalty-passport.php?id={memberId}",
    memberPlaceholder: "Código o teléfono del cliente",
    required: 5,
    accent: "#5f4b8b",
  },
];

function safeJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function runtimeSources(): LoyaltySource[] {
  if (typeof window !== "undefined") {
    const configured = (window as RuntimeWindow).__UTOPY_LOYALTY_SOURCES__;
    if (Array.isArray(configured) && configured.length) return configured;
  }
  const envRaw = (import.meta as any)?.env?.VITE_UTOPY_LOYALTY_SOURCES;
  const envSources = safeJson<LoyaltySource[]>(envRaw, []);
  return envSources.length ? envSources : DEFAULT_SOURCES;
}

export const LOYALTY_SOURCES = runtimeSources();

function asNumber(value: any, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

export function normalizeLoyaltyPassport(
  source: LoyaltySource,
  memberId: string,
  payload: any,
): LoyaltyPassport {
  const body = payload?.passport || payload?.card || payload?.loyalty || payload?.data || payload || {};
  const required = Math.max(
    1,
    asNumber(
      body.required ?? body.stamps_required ?? body.goal ?? body.cycle_size,
      source.required,
    ),
  );
  const totalStamps = Math.max(
    0,
    asNumber(body.stamp_total ?? body.total_stamps ?? body.totalStamps ?? body.stamps, 0),
  );
  const displayStamps = Math.max(
    0,
    asNumber(
      body.display_stamps ?? body.current_stamps ?? body.progress ?? body.stamps,
      totalStamps % required,
    ),
  );
  const history = asArray(body.history ?? body.movements ?? body.events).map((entry: any, index: number) => ({
    id: String(entry?.order_id ?? entry?.id ?? entry?.sale_id ?? `${source.id}:${index}`),
    at: entry?.stamped_at ?? entry?.created_at ?? entry?.at ?? null,
    label: entry?.label ?? entry?.description ?? entry?.order_id ?? null,
  }));

  return {
    sourceId: source.id,
    memberId,
    stamps: Math.min(required, displayStamps),
    totalStamps,
    required,
    rewardsAvailable: Math.max(
      0,
      asNumber(body.rewards_available ?? body.available_rewards ?? body.coupons_available, 0),
    ),
    rewardsEarned: Math.max(
      0,
      asNumber(body.rewards_earned ?? body.earned_rewards ?? Math.floor(totalStamps / required), 0),
    ),
    rewardsRedeemed: Math.max(
      0,
      asNumber(body.rewards_redeemed ?? body.redeemed_rewards, 0),
    ),
    history,
    updatedAt: body.updated_at ?? body.updatedAt ?? null,
    raw: body,
  };
}

export function loyaltyStorageKey(sourceId: string) {
  return `utopy.loyalty.link.v1:${sourceId}`;
}

export async function fetchLoyaltyPassport(
  source: LoyaltySource,
  memberId: string,
  signal?: AbortSignal,
) {
  const cleanId = memberId.trim();
  if (!cleanId) throw new Error("Ingresá el código de tu tarjeta.");
  const url = source.endpoint.replace("{memberId}", encodeURIComponent(cleanId));
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `El nodo ${source.name} no respondió.`);
  }
  return normalizeLoyaltyPassport(source, cleanId, payload);
}
