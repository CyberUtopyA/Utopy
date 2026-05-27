// src/mt/InvoiceCenter.tsx
import React, { useMemo } from "react";
import styled from "styled-components";
import { mtLiveSubscribe } from "./mt.liveStore";

type InvoiceCenterProps = {
  open: boolean;
  orderId?: string | null;
  threadId?: string | null;
  onClose: () => void;
  onOpenThread?: (threadId: string) => void;
};

type AnyDV = any;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 12px;
`;

const Box = styled.div`
  width: 100%;
  max-width: 760px;
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 1rem;
`;

const Body = styled.div`
  padding: 16px;
  display: grid;
  gap: 14px;
  max-height: 78vh;
  overflow: auto;
`;

const Card = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 14px;
  display: grid;
  gap: 8px;
`;

const Grid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Label = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  opacity: 0.7;
`;

const Value = styled.div`
  font-size: 0.95rem;
  font-weight: 900;
  word-break: break-word;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Btn = styled.button<{ kind?: "solid" | "ghost" }>`
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  ${({ kind }) =>
    kind === "solid"
      ? `background:#111;color:#fff;`
      : `background:#fff;color:#111;`}
`;

const Subtle = styled.div`
  font-size: 0.9rem;
  opacity: 0.72;
`;

function useAllLive() {
  const [all, setAll] = React.useState<AnyDV[]>([]);
  React.useEffect(() => {
    return mtLiveSubscribe((items) => setAll(items || []));
  }, []);
  return all;
}

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function fmtMoney(n: any, currency = "PYG") {
  const v = Number(n || 0);
  return `${Number.isFinite(v) ? v.toLocaleString("es-PY") : "0"} ${currency}`;
}

export default function InvoiceCenter({
  open,
  orderId,
  threadId,
  onClose,
  onOpenThread,
}: InvoiceCenterProps) {
  const all = useAllLive();

  const receipt = useMemo(() => {
    if (!orderId) return null;
    return (
      all.find(
        (d) =>
          safeStr(d?.kind) === "sale.receipt" &&
          safeStr(d?.attrs?.orderId) === safeStr(orderId)
      ) || null
    );
  }, [all, orderId]);

  const invoice = useMemo(() => {
    if (!orderId) return null;
    return (
      all.find(
        (d) =>
          safeStr(d?.kind) === "market.invoice.draft" &&
          safeStr(d?.attrs?.orderId) === safeStr(orderId)
      ) || null
    );
  }, [all, orderId]);

  if (!open) return null;

  return (
    <Backdrop onClick={onClose}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>Factura / comprobante</Title>
            <Subtle>Pedido: {orderId || "—"}</Subtle>
          </div>

          <Row>
            {threadId ? (
              <Btn
                kind="ghost"
                onClick={() => {
                  onOpenThread?.(threadId);
                  onClose();
                }}
              >
                Abrir hilo
              </Btn>
            ) : null}

            <Btn kind="ghost" onClick={onClose}>
              Cerrar
            </Btn>
          </Row>
        </Header>

        <Body>
          {!receipt && !invoice ? (
            <Card>
              <Title>Sin documentos todavía</Title>
              <Subtle>
                Aún no encontré el comprobante o la factura borrador en vivo.
              </Subtle>
            </Card>
          ) : null}

          {receipt ? (
            <Card>
              <Title>Comprobante</Title>

              <Grid>
                <div>
                  <Label>Número</Label>
                  <Value>{safeStr(receipt?.attrs?.receiptNumber || "—")}</Value>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Value>{safeStr(receipt?.attrs?.status || "issued")}</Value>
                </div>
                <div>
                  <Label>Comprador</Label>
                  <Value>{safeStr(receipt?.attrs?.buyerName || receipt?.attrs?.buyerId || "—")}</Value>
                </div>
                <div>
                  <Label>Vendedor</Label>
                  <Value>{safeStr(receipt?.attrs?.sellerName || receipt?.attrs?.sellerId || "—")}</Value>
                </div>
                <div>
                  <Label>Producto</Label>
                  <Value>{safeStr(receipt?.attrs?.productName || "—")}</Value>
                </div>
                <div>
                  <Label>Total</Label>
                  <Value>
                    {fmtMoney(receipt?.attrs?.total, receipt?.attrs?.currency || "PYG")}
                  </Value>
                </div>
              </Grid>
            </Card>
          ) : null}

          {invoice ? (
            <Card>
              <Title>Factura borrador</Title>

              <Grid>
                <div>
                  <Label>Número</Label>
                  <Value>{safeStr(invoice?.attrs?.invoiceNumber || "—")}</Value>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Value>{safeStr(invoice?.attrs?.status || "draft")}</Value>
                </div>
                <div>
                  <Label>Comprador</Label>
                  <Value>
                    {safeStr(invoice?.attrs?.buyer?.name || invoice?.attrs?.buyer?.id || "—")}
                  </Value>
                </div>
                <div>
                  <Label>Vendedor</Label>
                  <Value>
                    {safeStr(invoice?.attrs?.seller?.name || invoice?.attrs?.seller?.id || "—")}
                  </Value>
                </div>
                <div>
                  <Label>Método de pago</Label>
                  <Value>{safeStr(invoice?.attrs?.paymentMethod || "—")}</Value>
                </div>
                <div>
                  <Label>Total</Label>
                  <Value>
                    {fmtMoney(invoice?.attrs?.total, invoice?.attrs?.currency || "PYG")}
                  </Value>
                </div>
              </Grid>

              {Array.isArray(invoice?.attrs?.items) && invoice.attrs.items.length > 0 ? (
                <Card style={{ padding: 12 }}>
                  <Label>Ítems</Label>
                  {invoice.attrs.items.map((it: any, i: number) => (
                    <div key={i} style={{ display: "grid", gap: 2 }}>
                      <Value>{safeStr(it?.name || it?.productId || "Ítem")}</Value>
                      <Subtle>
                        {safeStr(it?.qty || 0)} × {fmtMoney(it?.unitPrice, invoice?.attrs?.currency || "PYG")} ={" "}
                        {fmtMoney(it?.total, invoice?.attrs?.currency || "PYG")}
                      </Subtle>
                    </div>
                  ))}
                </Card>
              ) : null}
            </Card>
          ) : null}
        </Body>
      </Box>
    </Backdrop>
  );
}