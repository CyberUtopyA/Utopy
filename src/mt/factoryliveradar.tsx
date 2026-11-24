import React, { useMemo } from "react";
import styled from "styled-components";
import PresenceRadar from "../utopy/presence/PresenceRadar";
import PresenceNowChip from "../utopy/presence/PresenceNowChip";
import usePresenceScanner from "../utopy/presence/usepresencescanner";

type AnyDV = any;

type Props = {
  ns?: string | null;
  liveItems: AnyDV[];
  selfActorId?: string | null;
  title?: string;
  subtitle?: string;
  onOpenThread?: (threadId: string, cluster: DemandCluster) => void;
  onOfferMaterial?: (cluster: DemandCluster) => void;
};

type RadarPresencePoint = {
  actorId?: string | null;
  strength?: number | null;
  threadId?: string | null;
  targetId?: string | null;
  targetKind?: string | null;
  materialKey?: string | null;
};

type DemandCluster = {
  key: string;
  materialKey: string;
  materialName: string;
  unit: string;
  totalQuantity: number;
  count: number;
  threadIds: string[];
  demandIds: string[];
  items: AnyDV[];
  maxUnitPrice?: number | null;
  latestTs: number;
  matchedOffers: AnyDV[];
  radarScore: number;
  presenceCount: number;
};

const Wrap = styled.div`
  display: grid;
  gap: 14px;
`;

const SectionCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
  min-width: 0;
  overflow: hidden;

  @media (min-width: 900px) {
    padding: 16px;
  }
`;

const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;

  & > * {
    min-width: 0;
  }
`;

const SectionTitleWrap = styled.div`
  display: grid;
  gap: 4px;
`;

const SectionTitle = styled.div`
  font-size: 0.98rem;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Subtle = styled.div`
  opacity: 0.74;
  font-size: 0.9rem;
  line-height: 1.4;
`;

const RadarTop = styled.div`
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  align-items: center;
`;

const StatsGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  flex: 1;
`;

const StatBox = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  padding: 10px;
  background: #fff;
`;

const StatLabel = styled.div`
  font-size: 12px;
  opacity: 0.7;
`;

const StatValue = styled.div`
  font-size: 22px;
  font-weight: 950;
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
`;

const DemandCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  padding: 12px;
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
`;

const DemandTitle = styled.div`
  font-size: 16px;
  font-weight: 950;
`;

const DemandSub = styled.div`
  font-size: 13px;
  opacity: 0.75;
`;

const DemandMeta = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const Chip = styled.span<{ tone?: "green" | "orange" | "gray" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.74rem;
  font-weight: 800;
  border: 1px solid
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,.18)"
        : tone === "orange"
          ? "rgba(249,115,22,.18)"
          : "rgba(0,0,0,.08)"};
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,.08)"
        : tone === "orange"
          ? "rgba(249,115,22,.08)"
          : "rgba(0,0,0,.03)"};
`;

const MatchBox = styled.div`
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 12px;
  padding: 8px 10px;
  background: rgba(0,0,0,.02);
  margin-top: 10px;
`;

const MatchTitle = styled.div`
  font-weight: 800;
`;

const MatchSub = styled.div`
  font-size: 13px;
  opacity: 0.75;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const Btn = styled.button<{ ghost?: boolean }>`
  border: 1px solid
    ${({ ghost }) => (ghost ? "rgba(0,0,0,0.10)" : "rgba(34,197,94,0.30)")};
  border-radius: 12px;
  padding: 10px 12px;
  background: ${({ ghost }) => (ghost ? "#fff" : "#15ff00ff")};
  color: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 900;
  transition: 0.16s ease;
  box-shadow: ${({ ghost }) =>
    ghost ? "none" : "0 10px 20px rgba(21,255,0,0.16)"};

  &:hover {
    transform: translateY(-1px);
  }
`;

function safeStr(x: any, fb = ""): string {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x: any, fb = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function normKey(x: any): string {
  return safeStr(x).trim().toLowerCase();
}

function hasTrait(dv: any, trait: string): boolean {
  return Array.isArray(dv?.traits) && dv.traits.includes(trait);
}

function getDemandMaterialKey(dv: any): string {
  return normKey(
    dv?.attrs?.intent?.resources?.[0] ||
      dv?.attrs?.materialKey ||
      dv?.attrs?.productoId ||
      dv?.meta?.materialKey ||
      dv?.meta?.productKey
  );
}

function getDemandMaterialName(dv: any): string {
  return safeStr(
    dv?.labels?.[0] ||
      dv?.attrs?.intent?.resources?.[0] ||
      dv?.attrs?.materialName ||
      dv?.attrs?.title ||
      dv?.meta?.name ||
      dv?.attrs?.productoNombre ||
      "Material"
  );
}

function getDemandUnit(dv: any): string {
  return safeStr(
    dv?.attrs?.intent?.unit || dv?.attrs?.unit || dv?.attrs?.unidad || "u"
  );
}

function getDemandQuantity(dv: any): number {
  return toNum(
    dv?.attrs?.intent?.quantity || dv?.attrs?.quantity || dv?.attrs?.cantidad,
    0
  );
}

function getDemandMaxUnitPrice(dv: any): number | null {
  const v = dv?.attrs?.maxUnitPrice;
  return v == null ? null : toNum(v, 0);
}

function getDemandThreadId(dv: any): string {
  return safeStr(dv?.meta?.threadId || dv?.attrs?.threadId || dv?.id);
}

function getDemandTs(dv: any): number {
  const raw = dv?.ts ?? dv?.meta?.ts ?? dv?.attrs?.ts ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSupplyOffer(dv: any): boolean {
  if (dv?.kind === "capability.offer" && Array.isArray(dv?.attrs?.capabilities)) {
    return true;
  }
  if (dv?.kind !== "mt:offer") return false;
  const side = safeStr(dv?.attrs?.side || dv?.meta?.side).toLowerCase();
  const tipo = safeStr(dv?.attrs?.tipo || dv?.meta?.tipo).toLowerCase();
  return side === "sell" || tipo === "venta" || hasTrait(dv, "mt:supply");
}

function getOfferProductKey(dv: any): string {
  return normKey(
    dv?.attrs?.capabilities?.[0]?.resources?.[0] ||
      dv?.attrs?.productoId ||
      dv?.attrs?.materialKey ||
      dv?.meta?.materialKey ||
      dv?.meta?.productKey
  );
}

function getOfferPrice(dv: any): number {
  return toNum(dv?.attrs?.precio || dv?.attrs?.price, 0);
}

function getOfferStock(dv: any): number {
  const a = dv?.attrs || {};
  return toNum(
    a.capabilities?.[0]?.quantities?.[0]?.max ??
      a.stock ??
      a.cantidad ??
      a.quantity,
    0
  );
}

function getOfferSellerName(dv: any): string {
  return safeStr(
    dv?.labels?.[0] ||
      dv?.attrs?.node?.name ||
      dv?.attrs?.node?.id ||
      dv?.attrs?.productor?.nombre ||
      dv?.attrs?.sellerName ||
      dv?.meta?.sellerName ||
      "Proveedor"
  );
}

function mapScannerPresenceToRadar(items: any[]): RadarPresencePoint[] {
  return (items || []).map((p) => ({
    actorId: p.actorId || null,
    strength:
      typeof p.proximity === "number"
        ? Math.max(0.15, Math.min(1, p.proximity))
        : 0.65,
    threadId: p.threadId || null,
    targetId: p.targetId || null,
    targetKind: p.targetKind || null,
    materialKey:
      p.raw?.attrs?.intent?.resources?.[0] ||
      p.raw?.attrs?.capabilities?.[0]?.resources?.[0] ||
      p.raw?.attrs?.materialKey ||
      p.raw?.attrs?.target?.materialKey ||
      p.raw?.meta?.materialKey ||
      null,
  }));
}

function computePresenceBoostForCluster(
  cluster: DemandCluster,
  presences: RadarPresencePoint[]
): number {
  if (!presences?.length) return 0;

  let score = 0;

  for (const p of presences) {
    const strength = Math.max(0.15, Math.min(1, Number(p?.strength ?? 0.65)));

    const sameThread =
      !!p.threadId && cluster.threadIds.includes(String(p.threadId));

    const sameMaterial =
      !!p.materialKey &&
      normKey(p.materialKey) === normKey(cluster.materialKey);

    const sameTarget =
      !!p.targetId && cluster.demandIds.includes(String(p.targetId));

    if (sameThread) score += 1.8 * strength;
    else if (sameMaterial) score += 1.25 * strength;
    else if (sameTarget) score += 1.1 * strength;
  }

  return score;
}

function buildDemandClusters(
  demandMaterials: AnyDV[],
  supplyOffers: AnyDV[],
  presences: RadarPresencePoint[] = []
): DemandCluster[] {
  const map = new Map<string, DemandCluster>();

  for (const dv of demandMaterials) {
    const materialKey = getDemandMaterialKey(dv);
    if (!materialKey) continue;

    const unit = getDemandUnit(dv);
    const key = `${materialKey}__${unit.toLowerCase()}`;
    const quantity = getDemandQuantity(dv);
    const threadId = getDemandThreadId(dv);
    const ts = getDemandTs(dv);
    const maxUnitPrice = getDemandMaxUnitPrice(dv);

    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        materialKey,
        materialName: getDemandMaterialName(dv),
        unit,
        totalQuantity: quantity,
        count: 1,
        threadIds: threadId ? [threadId] : [],
        demandIds: dv.id ? [String(dv.id)] : [],
        items: [dv],
        maxUnitPrice,
        latestTs: ts,
        matchedOffers: [],
        radarScore: 0,
        presenceCount: 0,
      });
      continue;
    }

    prev.totalQuantity += quantity;
    prev.count += 1;
    prev.items.push(dv);
    if (threadId && !prev.threadIds.includes(threadId)) prev.threadIds.push(threadId);
    if (dv.id && !prev.demandIds.includes(String(dv.id))) prev.demandIds.push(String(dv.id));
    if (ts > prev.latestTs) prev.latestTs = ts;

    if (maxUnitPrice != null) {
      prev.maxUnitPrice =
        prev.maxUnitPrice == null
          ? maxUnitPrice
          : Math.max(prev.maxUnitPrice, maxUnitPrice);
    }
  }

  const clusters = Array.from(map.values());

  for (const cluster of clusters) {
    const matchedOffers = supplyOffers.filter((offer) => {
      const offerKey = getOfferProductKey(offer);
      if (!offerKey) return false;
      if (offerKey !== cluster.materialKey) return false;

      const stock = getOfferStock(offer);
      if (stock > 0 && stock < Math.max(1, cluster.totalQuantity * 0.25)) {
        return false;
      }

      const price = getOfferPrice(offer);
      if (
        cluster.maxUnitPrice != null &&
        price > 0 &&
        price > cluster.maxUnitPrice
      ) {
        return false;
      }

      return true;
    });

    cluster.matchedOffers = matchedOffers.sort((a, b) => {
      const pa = getOfferPrice(a);
      const pb = getOfferPrice(b);
      if (pa <= 0 && pb > 0) return 1;
      if (pb <= 0 && pa > 0) return -1;
      return pa - pb;
    });

    const ageMin = Math.max(1, (Date.now() - cluster.latestTs) / 60000);
    const freshness =
      ageMin <= 10 ? 3 : ageMin <= 60 ? 2 : ageMin <= 360 ? 1.25 : 0.6;

    const quantityBoost = Math.min(4, cluster.totalQuantity / 4);
    const countBoost = Math.min(3, cluster.count);
    const unmatchedBoost = cluster.matchedOffers.length === 0 ? 3 : 0.8;
    const presenceBoost = computePresenceBoostForCluster(cluster, presences);

    cluster.presenceCount = presences.filter((p) => {
      const sameThread =
        !!p.threadId && cluster.threadIds.includes(String(p.threadId));
      const sameMaterial =
        !!p.materialKey && normKey(p.materialKey) === normKey(cluster.materialKey);
      return sameThread || sameMaterial;
    }).length;

    cluster.radarScore =
      freshness + quantityBoost + countBoost + unmatchedBoost + presenceBoost;
  }

  return clusters.sort((a, b) => b.radarScore - a.radarScore);
}

export default function FactoryLiveRadar({
  ns = "mt:market",
  liveItems,
  selfActorId = null,
  title = "🏭 Fábrica viva",
  subtitle = "Demandas de producción y materiales que realmente necesitan respuesta.",
  onOpenThread,
  onOfferMaterial,
}: Props) {
  const {
    presences: scannedPresences,
    nearby,
    strongest,
    count: presenceCount,
  } = usePresenceScanner({
    enabled: true,
    ns,
    maxAgeMs: 1000 * 60 * 5,
    limit: 48,
  });

  const radarPresences = useMemo(() => {
    return mapScannerPresenceToRadar(nearby.length ? nearby : scannedPresences);
  }, [nearby, scannedPresences]);

  const demandMaterials = useMemo(() => {
    return (liveItems || []).filter(
      (dv) =>
        dv?.kind === "mt:demand.material" ||
        (dv?.attrs?.intent?.mode === "need" &&
          Array.isArray(dv?.attrs?.intent?.resources) &&
          dv.attrs.intent.resources.length > 0)
    );
  }, [liveItems]);

  const supplyOffers = useMemo(() => {
    return (liveItems || []).filter((dv) => isSupplyOffer(dv));
  }, [liveItems]);

  const demandClusters = useMemo(() => {
    return buildDemandClusters(demandMaterials, supplyOffers, radarPresences);
  }, [demandMaterials, supplyOffers, radarPresences]);

  const stats = useMemo(() => {
    return {
      totalClusters: demandClusters.length,
      totalDemands: demandClusters.reduce((a, b) => a + b.count, 0),
      totalQty: demandClusters.reduce((a, b) => a + b.totalQuantity, 0),
      unmatched: demandClusters.filter((x) => x.matchedOffers.length === 0).length,
    };
  }, [demandClusters]);

  const chipPresences = useMemo(() => {
    return scannedPresences.map((p) => ({
      actorId: p.actorId,
      productId: p.targetId,
      threadId: p.threadId,
      meta: p.raw?.meta || {},
    }));
  }, [scannedPresences]);

  return (
    <Wrap>
      <SectionCard>
        <SectionHead>
          <SectionTitleWrap>
            <SectionTitle>{title}</SectionTitle>
            <Subtle>{subtitle}</Subtle>
          </SectionTitleWrap>
        </SectionHead>

        <RadarTop>
          <PresenceRadar
            meId={selfActorId}
            presences={radarPresences}
            minCount={1}
          />

          <StatsGrid>
            <StatBox>
              <StatLabel>Clusters</StatLabel>
              <StatValue>{stats.totalClusters}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Demandas</StatLabel>
              <StatValue>{stats.totalDemands}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Cantidad total</StatLabel>
              <StatValue>{stats.totalQty}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Sin match</StatLabel>
              <StatValue>{stats.unmatched}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Presence</StatLabel>
              <StatValue>{presenceCount}</StatValue>
            </StatBox>

            <StatBox>
              <StatLabel>Más fuerte</StatLabel>
              <div style={{ fontWeight: 900, fontSize: 14 }}>
                {strongest?.actorName || (strongest ? "Persona" : "—")}
              </div>
            </StatBox>
          </StatsGrid>
        </RadarTop>
      </SectionCard>

      <SectionCard>
        <SectionHead>
          <SectionTitleWrap>
            <SectionTitle>Materiales agrupados</SectionTitle>
            <Subtle>
              Detecta necesidades repetidas, capacidades de cualquier nodo y
              frecuencias vivas compatibles.
            </Subtle>
          </SectionTitleWrap>
        </SectionHead>

        {demandClusters.length === 0 ? (
          <Subtle>No hay demandas de materiales vivas ahora.</Subtle>
        ) : (
          <Grid>
            {demandClusters.map((cluster) => {
              const best = cluster.matchedOffers[0];
              const firstThreadId = cluster.threadIds[0] || "";

              return (
                <DemandCard key={cluster.key}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <DemandTitle>{cluster.materialName}</DemandTitle>
                    <DemandSub>
                      Requiere: {cluster.totalQuantity} {cluster.unit}
                    </DemandSub>

                    <DemandMeta>
                      <Chip tone="gray">{cluster.count} demanda(s)</Chip>
                      <Chip tone={cluster.matchedOffers.length ? "green" : "orange"}>
                        {cluster.matchedOffers.length
                          ? `${cluster.matchedOffers.length} resonancia(s)`
                          : "sin oferta"}
                      </Chip>
                      {!!cluster.presenceCount && (
                        <Chip tone="green">señales {cluster.presenceCount}</Chip>
                      )}
                      <Chip tone="gray">score {cluster.radarScore.toFixed(1)}</Chip>
                    </DemandMeta>

                    <div style={{ marginTop: 6 }}>
                      <PresenceNowChip
                        presences={chipPresences}
                        selfActorId={selfActorId}
                        threadId={firstThreadId || null}
                        minCount={1}
                      />
                    </div>

                    {best ? (
                      <MatchBox>
                        <MatchTitle>Mejor capacidad: {getOfferSellerName(best)}</MatchTitle>
                        <MatchSub>
                          Precio: {getOfferPrice(best) || "s/d"} · Stock:{" "}
                          {getOfferStock(best) || "s/d"}
                        </MatchSub>
                      </MatchBox>
                    ) : (
                      <MatchBox>
                        <MatchTitle>Sin resonancia compatible</MatchTitle>
                        <MatchSub>
                          Todavía no hay oferta compatible para este material.
                        </MatchSub>
                      </MatchBox>
                    )}

                    <Row style={{ marginTop: 8 }}>
                      <Btn
                        ghost
                        onClick={() => {
                          if (firstThreadId && onOpenThread) {
                            onOpenThread(firstThreadId, cluster);
                          }
                        }}
                      >
                        Ver hilo
                      </Btn>

                      <Btn
                        onClick={() => {
                          if (onOfferMaterial) onOfferMaterial(cluster);
                        }}
                      >
                        Responder señal
                      </Btn>
                    </Row>
                  </div>
                </DemandCard>
              );
            })}
          </Grid>
        )}
      </SectionCard>
    </Wrap>
  );
}

export type { DemandCluster };
