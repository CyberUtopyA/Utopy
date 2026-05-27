import React, { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { DatoVivo } from "./mt.traitAdapter";
import { MtCajero } from "./mt.cajeroAdapter";
import { setNamespaceTag } from "../pushtags";
import { mtLiveUpsert } from "./mt.liveStore";

type StyledTone = "ok" | "warn" | "neutral";
type ButtonTone = "primary" | "ghost";

type CommonProps = {
  allDv: DatoVivo[];
  nsFilter: string;
  activeCajero: MtCajero | null;
  setInboxThreadId: (threadId: string | null) => void;
  setTab: (
  tab:
    | "mercado"
    | "categorias"
    | "ofertas"
    | "mis_pedidos"
    | "producir"
    | "circular"
) => void;

  Section: ComponentType<{ children?: ReactNode }>;
  Grid: ComponentType<{ children?: ReactNode }>;
  Card: ComponentType<{ children?: ReactNode }>;
  Title: ComponentType<{ children?: ReactNode }>;
  Subtle: ComponentType<{ children?: ReactNode; style?: React.CSSProperties }>;
  Chips: ComponentType<{ children?: ReactNode }>;
  Chip: ComponentType<{ children?: ReactNode; tone?: StyledTone }>;
  Price: ComponentType<{ children?: ReactNode }>;
  Actions: ComponentType<{ children?: ReactNode }>;
  SmallBtn: ComponentType<{
    children?: ReactNode;
    tone?: ButtonTone;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }>;
};

function parseTs(d: any): number {
  const t = Date.parse(d?.meta?.ts || d?.attrs?.ts || "");
  return Number.isFinite(t) ? t : 0;
}

function getOfferNs(o: any): string {
  return (
    o?.meta?.ns || o?.attrs?.meta?.ns || o?.attrs?.ns || o?.ns || "__UNKNOWN__"
  );
}

function isMaterialDemandDV(d: any): boolean {
  const kind = String(d?.kind || "").trim();
  if (kind === "mt:demand.material") return true;
  const traits = Array.isArray(d?.traits) ? d.traits.map(String) : [];
  return traits.includes("mt:material") && traits.includes("mt:demand");
}

function isMaterialOfferDV(d: any): boolean {
  const kind = String(d?.kind || "").trim();
  if (kind === "mt:offer.material") return true;
  const traits = Array.isArray(d?.traits) ? d.traits.map(String) : [];
  return traits.includes("mt:material") && traits.includes("mt:offer");
}

function getDvThreadId(d: any): string | null {
  return (
    d?.meta?.threadId ||
    d?.attrs?.threadId ||
    d?.threadId ||
    d?.meta?.parentThreadId ||
    null
  );
}

function getMaterialDemandTitle(d: any): string {
  return (
    d?.attrs?.materialName ||
    d?.attrs?.title ||
    d?.title ||
    d?.attrs?.materialKey ||
    "Material requerido"
  );
}

function getMaterialDemandQty(d: any): number {
  const n = Number(d?.attrs?.quantity ?? d?.quantity ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getMaterialDemandUnit(d: any): string {
  return String(d?.attrs?.unit || d?.unit || "u");
}

function getMaterialDemandMaxPrice(d: any): number | null {
  const n = Number(d?.attrs?.maxUnitPrice);
  return Number.isFinite(n) ? n : null;
}

function getMaterialDemandParentId(d: any): string | null {
  return (
    d?.attrs?.parentDemandId ||
    d?.meta?.parentDemandId ||
    d?.parentDemandId ||
    null
  );
}

function getMaterialDemandChainId(d: any): string | null {
  return d?.meta?.chainId || d?.attrs?.chainId || null;
}

function getMaterialOfferUnitPrice(d: any): number {
  const n = Number(d?.attrs?.unitPrice ?? d?.unitPrice ?? d?.precio ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getMaterialOfferSupplier(d: any): string {
  return (
    d?.attrs?.supplierName ||
    d?.productor?.nombre ||
    d?.meta?.actorName ||
    "Proveedor"
  );
}

export default function FabricaVivaPanel(props: CommonProps) {
  const {
    allDv,
    nsFilter,
    activeCajero,
    setInboxThreadId,
    setTab,
    Section,
    Grid,
    Card,
    Title,
    Subtle,
    Chips,
    Chip,
    Price,
    Actions,
    SmallBtn,
  } = props;

  const [replyMaterialDemand, setReplyMaterialDemand] = useState<DatoVivo | null>(null);
  const [matOfferPrice, setMatOfferPrice] = useState("");
  const [matOfferQty, setMatOfferQty] = useState("");
  const [matOfferLeadDays, setMatOfferLeadDays] = useState("");
  const [matOfferNote, setMatOfferNote] = useState("");
  const [materialBusy, setMaterialBusy] = useState(false);

  const materialDemands = useMemo<DatoVivo[]>(() => {
    return (allDv || [])
      .filter((d: DatoVivo) => isMaterialDemandDV(d))
      .sort((a: DatoVivo, b: DatoVivo) => parseTs(b) - parseTs(a));
  }, [allDv]);

  const materialOffers = useMemo<DatoVivo[]>(() => {
    return (allDv || [])
      .filter((d: DatoVivo) => isMaterialOfferDV(d))
      .sort((a: DatoVivo, b: DatoVivo) => parseTs(b) - parseTs(a));
  }, [allDv]);

  const visibleMaterialDemands = useMemo<DatoVivo[]>(() => {
    return materialDemands.filter((d: DatoVivo) => {
      if (nsFilter === "__ALL__") return true;
      return getOfferNs(d) === nsFilter;
    });
  }, [materialDemands, nsFilter]);

  const visibleMaterialOffers = useMemo<DatoVivo[]>(() => {
    return materialOffers.filter((d: DatoVivo) => {
      if (nsFilter === "__ALL__") return true;
      return getOfferNs(d) === nsFilter;
    });
  }, [materialOffers, nsFilter]);

  function openMaterialReply(d: DatoVivo) {
    const threadId =
      getDvThreadId(d) ||
      `mt.thread.material:${getMaterialDemandChainId(d) || d?.id || Date.now()}`;

    setReplyMaterialDemand(d);
    setInboxThreadId(threadId);
    setMatOfferQty(String(getMaterialDemandQty(d) || 1));
    setMatOfferPrice(
      getMaterialDemandMaxPrice(d) ? String(getMaterialDemandMaxPrice(d)) : "",
    );
    setMatOfferLeadDays("");
    setMatOfferNote("");
  }

  async function submitMaterialOffer() {
    if (!replyMaterialDemand) return;

    try {
      setMaterialBusy(true);

      const unitPrice = Number(matOfferPrice || 0);
      const qty =
        Number(matOfferQty || 0) || getMaterialDemandQty(replyMaterialDemand);
      const leadDays = matOfferLeadDays ? Number(matOfferLeadDays) : null;

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error("Precio por unidad inválido.");
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("Cantidad inválida.");
      }

      const demandId = String(replyMaterialDemand.id);
      const parentDemandId = getMaterialDemandParentId(replyMaterialDemand);
      const threadId =
        getDvThreadId(replyMaterialDemand) ||
        `mt.thread.material:${getMaterialDemandChainId(replyMaterialDemand) || demandId}`;
      const chainId = getMaterialDemandChainId(replyMaterialDemand);

      const dv: DatoVivo = {
        id: `mt:offer.material:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        kind: "mt:offer.material",
        attrs: {
          demandMaterialId: demandId,
          parentDemandId,
          materialKey: (replyMaterialDemand as any)?.attrs?.materialKey || "",
          materialName: getMaterialDemandTitle(replyMaterialDemand),
          quantity: qty,
          unit: getMaterialDemandUnit(replyMaterialDemand),
          unitPrice,
          totalPrice: qty * unitPrice,
          supplierName: activeCajero?.nombre || "Proveedor local",
          leadTimeDays: leadDays,
          notes: matOfferNote.trim() || "",
        },
        traits: ["mt:offer", "mt:material", "mt:supply", "mt:market"],
        meta: {
          ns: getOfferNs(replyMaterialDemand) || "mt:market",
          ts: new Date().toISOString(),
          threadId,
          chainId,
          respondsTo: demandId,
          caja: activeCajero?.id || null,
        } as any,
      };

      mtLiveUpsert(dv);

      try {
        await setNamespaceTag(getOfferNs(replyMaterialDemand) || "mt:market");
      } catch {}

      setInboxThreadId(threadId);
      setReplyMaterialDemand(null);
      setMatOfferPrice("");
      setMatOfferQty("");
      setMatOfferLeadDays("");
      setMatOfferNote("");
      setTab("mis_pedidos");
    } catch (e: any) {
      alert(e?.message || "No se pudo publicar la oferta de material");
    } finally {
      setMaterialBusy(false);
    }
  }
  const hasMaterialDemands = visibleMaterialDemands.length > 0;
  const hasMaterialOffers = visibleMaterialOffers.length > 0;
  const hasAnything =
    hasMaterialDemands || hasMaterialOffers || !!replyMaterialDemand;

  if (!hasAnything) return null;

  return (
    <>
      {hasMaterialDemands && (
        <>
          <Section>
            <div
              style={{
                fontWeight: 950,
                fontSize: "1rem",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🏭 Fábrica viva
            </div>

            <Subtle style={{ marginBottom: 10 }}>
              Demandas de producción y materiales que realmente necesitan respuesta.
            </Subtle>

            <Grid>
              {visibleMaterialDemands.map((d: DatoVivo) => {
                const ns = getOfferNs(d);
                const title = getMaterialDemandTitle(d);
                const qty = getMaterialDemandQty(d);
                const unit = getMaterialDemandUnit(d);
                const maxPrice = getMaterialDemandMaxPrice(d);
                const parentId = getMaterialDemandParentId(d);

                return (
                  <Card key={d.id}>
                    <Title>{title}</Title>

                    <Subtle style={{ marginTop: 6 }}>
                      Requiere: {qty} {unit}
                    </Subtle>

                    {parentId ? <Subtle>Producción: {parentId}</Subtle> : null}

                    {(d as any)?.attrs?.notes ? (
                      <Subtle style={{ marginTop: 4 }}>
                        {String((d as any).attrs.notes)}
                      </Subtle>
                    ) : null}

                    <Chips>
                      <Chip tone="neutral">{ns}</Chip>
                      <Chip tone="ok">material</Chip>
                    </Chips>

                    <Price>
                      {maxPrice != null
                        ? `Hasta ${maxPrice} / ${unit}`
                        : "Precio abierto"}
                    </Price>

                    <Actions>
                      <SmallBtn
                        tone="ghost"
                        onClick={() => {
                          const threadId = getDvThreadId(d);
                          if (threadId) setInboxThreadId(threadId);
                        }}
                      >
                        Ver hilo
                      </SmallBtn>

                      <SmallBtn onClick={() => openMaterialReply(d)}>
                        Ofertar material
                      </SmallBtn>
                    </Actions>
                  </Card>
                );
              })}
            </Grid>
          </Section>

          {(hasMaterialOffers || replyMaterialDemand) && <div style={{ height: 14 }} />}
        </>
      )}

      {hasMaterialOffers && (
        <>
          <Section>
            <div
              style={{
                fontWeight: 950,
                fontSize: "1rem",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📦 Ofertas de materiales
            </div>

            <Subtle style={{ marginBottom: 10 }}>
              Respuestas reales de proveedores a demandas de materiales.
            </Subtle>

            <Grid>
              {visibleMaterialOffers.map((d: DatoVivo) => {
                const title = (d as any)?.attrs?.materialName || "Oferta de material";
                const unit = (d as any)?.attrs?.unit || "u";
                const qty = Number((d as any)?.attrs?.quantity || 0);
                const unitPrice = getMaterialOfferUnitPrice(d);
                const supplier = getMaterialOfferSupplier(d);
                const ns = getOfferNs(d);

                return (
                  <Card key={d.id}>
                    <Title>{String(title)}</Title>

                    <Subtle style={{ marginTop: 6 }}>
                      {supplier} · {qty} {unit}
                    </Subtle>

                    <Subtle>
                      {(d as any)?.attrs?.leadTimeDays
                        ? `Entrega aprox: ${(d as any).attrs.leadTimeDays} días`
                        : "Entrega a coordinar"}
                    </Subtle>

                    <Chips>
                      <Chip tone="neutral">{ns}</Chip>
                      <Chip tone="ok">proveedor</Chip>
                    </Chips>

                    <Price>{unitPrice} / {unit}</Price>

                    <Actions>
                      <SmallBtn
                        tone="ghost"
                        onClick={() => {
                          const threadId = getDvThreadId(d);
                          if (threadId) setInboxThreadId(threadId);
                        }}
                      >
                        Ver hilo
                      </SmallBtn>

                      <SmallBtn
                        onClick={() => {
                          const threadId = getDvThreadId(d);
                          if (threadId) {
                            setInboxThreadId(threadId);
                            setTab("mis_pedidos");
                          }
                        }}
                      >
                        Abrir inbox
                      </SmallBtn>
                    </Actions>
                  </Card>
                );
              })}
            </Grid>
          </Section>

          {replyMaterialDemand && <div style={{ height: 14 }} />}
        </>
      )}

      {replyMaterialDemand ? (
        <Section>
          <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 8 }}>
            Ofertar material
          </div>

          <Subtle style={{ marginBottom: 12 }}>
            {getMaterialDemandTitle(replyMaterialDemand)}
          </Subtle>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: "0.9rem", marginBottom: 6 }}>
                Cantidad
              </div>
              <input
                value={matOfferQty}
                onChange={(e) => setMatOfferQty(e.target.value)}
                placeholder="1"
                style={{
                  width: "100%",
                  border: "1px solid rgba(0, 0, 0, 0.12)",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: "0.9rem", marginBottom: 6 }}>
                Precio por unidad
              </div>
              <input
                value={matOfferPrice}
                onChange={(e) => setMatOfferPrice(e.target.value)}
                placeholder="120000"
                style={{
                  width: "100%",
                  border: "1px solid rgba(0, 0, 0, 0.12)",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: "0.9rem", marginBottom: 6 }}>
                Días estimados
              </div>
              <input
                value={matOfferLeadDays}
                onChange={(e) => setMatOfferLeadDays(e.target.value)}
                placeholder="3"
                style={{
                  width: "100%",
                  border: "1px solid rgba(0, 0, 0, 0.12)",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: "0.9rem", marginBottom: 6 }}>
                Nota
              </div>
              <input
                value={matOfferNote}
                onChange={(e) => setMatOfferNote(e.target.value)}
                placeholder="Seca, cepillada, lista para retiro..."
                style={{
                  width: "100%",
                  border: "1px solid rgba(0, 0, 0, 0.12)",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <SmallBtn tone="ghost" onClick={() => setReplyMaterialDemand(null)}>
              Cancelar
            </SmallBtn>
            <SmallBtn onClick={submitMaterialOffer} disabled={materialBusy}>
              {materialBusy ? "Publicando..." : "Publicar oferta"}
            </SmallBtn>
          </div>
        </Section>
      ) : null}
    </>
  );
}