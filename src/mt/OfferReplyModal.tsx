// src/mt/OfferReplyModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import type { MtOffer, MtProduct, DatoVivo } from "./mt.traitAdapter";
import { publishDatoVivo } from "./seedbus";
import { mtLiveUpsert } from "./mt.liveStore";
import { spore } from "../utopy/spore.singleton";

// ---------------------------------------------------------
// UI mínimo (autónomo, no depende de tus estilos del market)
// ---------------------------------------------------------
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const ModalBox = styled.div`
  width: min(720px, 96vw);
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.25);
`;

const Title = styled.div`
  font-size: 1.05rem;
  font-weight: 800;
`;

const Subtle = styled.div`
  opacity: 0.75;
  font-size: 0.9rem;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 10px;

  & > label {
    width: 92px;
    opacity: 0.8;
    font-size: 0.9rem;
  }
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 8px 10px;
`;

const Select = styled.select`
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 8px 10px;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.12);

  background: ${({ kind }) => (kind === "solid" ? "#111" : "#fff")};
  color: ${({ kind }) => (kind === "solid" ? "#fff" : "#111")};

  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

// ---------------------------------------------------------
// Tipos
// ---------------------------------------------------------
export type ReplyModalProps = {
  open: boolean;

  /** Oferta recibida (si tipo=compra, se interpreta como demanda) */
  offer: MtOffer;

  /** Productos visibles en el market (para sugerir) */
  products: MtProduct[];

  onClose: () => void;

  /** opcional: callback cuando se envía con éxito */
  onSent?: (venta: MtOffer) => void;
};

const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function safeNumber(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/** texto “humano” de la demanda para mostrar arriba */
function describeDemand(offer: MtOffer): string {
  const anyOffer: any = offer as any;
  const meta: any = offer.meta || {};

  // prioridad: query/categoria si existieran (aunque NO estén tipadas)
  const q = anyOffer.query || meta.query || meta.q || "";
  const cat = anyOffer.categoria || meta.categoria || meta.cat || "";
  const pid = offer.productoId || "";

  const head = (q || cat || pid || "—").toString();
  return head;
}

export default function OfferReplyModal({
  open,
  offer,
  products,
  onClose,
  onSent,
}: ReplyModalProps) {
  const anyOffer: any = offer as any;
  const meta: any = offer.meta || {};

  const suggestedStartProductId = useMemo(() => {
    // si viene productoId, úsalo; si no, sugiere el primero del catálogo
    return offer.productoId || products?.[0]?.id || "";
  }, [offer.productoId, products]);

  const [productId, setProductId] = useState<string>(suggestedStartProductId);
  const [qty, setQty] = useState<number>(Math.max(1, safeNumber(offer.cantidad, 1)));

  // precio sugerido: offer.precio o meta.maxPrecio si existiera
  const [unitPrice, setUnitPrice] = useState<string>(() => {
    const p = safeNumber(offer.precio, 0);
    const mp = safeNumber(anyOffer.maxPrecio ?? meta.maxPrecio, 0);
    return String(p || mp || 0);
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!open) return;
    // resetea estado al abrir (sin romper lo que el usuario ya escribió si abre/cierra rápido)
    setMsg(null);

    if (!offer.productoId && products.length > 0) {
      setProductId((prev) => prev || products[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirmarRespuesta = async () => {
    setBusy(true);
    setMsg(null);

    try {
      const quantity = Math.max(1, Number(qty || 1));
      const priceNum = safeNumber(unitPrice, 0);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        throw new Error("Precio inválido.");
      }

      const demandId = String(offer.id);

      // ✅ oferta de VENTA linkeada a la demanda
      const venta: MtOffer = {
        id: createId("mt:offer:supply:"),
        productoId: String(productId || offer.productoId || ""),
        tipo: "venta",
        cantidad: quantity,
        precio: priceNum,
        productor: selected?.productor || offer.productor,
        meta: {
          ...(meta || {}),
          ns: meta?.ns || "mt:market",
          replyTo: demandId, // 👈 cierre del círculo
          demandId,
        },
      };

      // ✅ DV a seed
      const dv: DatoVivo = {
        id: venta.id,
        kind: "mt:offer",
        attrs: {
          productoId: venta.productoId,
          tipo: "venta",
          cantidad: venta.cantidad,
          precio: venta.precio,
          productor: venta.productor,
          replyTo: demandId,
        },
        traits: ["mt:offer", "mt:market", "mt:supply"],
        meta: venta.meta || {},
      };

      // eco local inmediato
      mtLiveUpsert(dv);

      // intent semántico (si MT escucha)
      try {
        await spore?.sayIntent({
          sym: "🛒",
          say: "mt.offer.create",
          with: { offer: venta },
        });
      } catch {}

      // publish al seed
      await publishDatoVivo(dv);

      setMsg("Respuesta enviada ✅");
      onSent?.(venta);
      onClose();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo responder.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const demandLabel = describeDemand(offer);
  const maxPrecio = safeNumber(anyOffer.maxPrecio ?? meta.maxPrecio, NaN);
  const wantsTrade = Boolean(anyOffer.trueque ?? meta.trueque ?? false);

  return (
    <Backdrop onClick={onClose}>
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <Title>Responder demanda</Title>

        <Subtle style={{ marginTop: 6 }}>
          Demanda: <b>{demandLabel}</b> · Cant: <b>{offer.cantidad}</b> · Precio objetivo:{" "}
          <b>{offer.precio}</b>{" "}
          {Number.isFinite(maxPrecio) && maxPrecio > 0 ? `(máx ${maxPrecio})` : ""}
          {wantsTrade ? " · (acepta trueque)" : ""}
        </Subtle>

        <div style={{ height: 10 }} />

        <Row>
          <label>Tu producto</label>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">(escribir manual)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {p.id.slice(0, 18)}
              </option>
            ))}
          </Select>
        </Row>

        {!productId && (
          <Row>
            <label>productoId</label>
            <Input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="mt:producto:... / tomate / muebles:mesa / etc."
            />
          </Row>
        )}

        <Row>
          <label>Cantidad</label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
          />
        </Row>

        <Row>
          <label>Precio /u</label>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="5.8" />
        </Row>

        {msg && <Subtle style={{ marginTop: 8 }}>{msg}</Subtle>}

        <Row style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <Btn kind="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn
            kind="solid"
            onClick={confirmarRespuesta}
            disabled={busy || !String(productId || "").trim()}
            style={{ marginLeft: 8 }}
          >
            {busy ? "Enviando..." : "Enviar respuesta"}
          </Btn>
        </Row>
      </ModalBox>
    </Backdrop>
  );
}
