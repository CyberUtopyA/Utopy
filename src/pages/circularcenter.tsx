import React from "react";
import CircularMapPanel from "./circularpanel";
import FactoryLiveRadar from "../mt/factoryliveradar";
import WorkInboxPanel from "../mt/workinboxpanel";
import ProducerQueuePanel from "../mt/ProducerQueuePanel";
import FabricaVivaPanel from "../mt/fabricaviva";
import CircularQuickPublishPanel from "./circularquickpanel";
import { sendCircularToMO } from "../mt/circular.mo";

type MarketTab =
  | "mercado"
  | "categorias"
  | "ofertas"
  | "mis_pedidos"
  | "producir"
  | "circular";

type Props = {
  allLive: any[];
  activeCajero?: any | null;
  setTab: (tab: MarketTab) => void;
  setInboxThreadId: (threadId: string | null) => void;
  onOpenThread?: (threadId: string, cluster?: any) => void;
  onOfferMaterial?: (cluster: any) => void;
  onOpenMO?: (cluster: any) => void;
};

const SectionBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: 18,
      background: "#fff",
      padding: 12,
    }}
  >
    {children}
  </div>
);

const GridBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      display: "grid",
      gap: 14,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    }}
  >
    {children}
  </div>
);

const CardBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: 16,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      textAlign: "left",
      minWidth: 0,
    }}
  >
    {children}
  </div>
);

const TitleBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      fontWeight: 900,
      marginTop: 10,
      lineHeight: 1.15,
      fontSize: "0.95rem",
    }}
  >
    {children}
  </div>
);

const SubtleBox = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      opacity: 0.7,
      fontSize: "0.88rem",
      ...(style || {}),
    }}
  >
    {children}
  </div>
);

const ChipsBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
    }}
  >
    {children}
  </div>
);

const ChipBox = ({
  children,
  tone = "neutral",
}: {
  children?: React.ReactNode;
  tone?: "ok" | "warn" | "neutral";
}) => (
  <span
    style={{
      fontSize: 11,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.08)",
      background:
        tone === "ok"
          ? "rgba(34,197,94,0.10)"
          : tone === "warn"
          ? "rgba(245,158,11,0.12)"
          : "rgba(0,0,0,0.04)",
    }}
  >
    {children}
  </span>
);

const PriceBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      fontWeight: 900,
      marginTop: 6,
      fontSize: "0.95rem",
    }}
  >
    {children}
  </div>
);

const ActionsBox = ({ children }: { children?: React.ReactNode }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 8,
      marginTop: 10,
    }}
  >
    {children}
  </div>
);

const SmallBtnBox = ({
  children,
  tone = "primary",
  onClick,
  disabled,
}: {
  children?: React.ReactNode;
  tone?: "primary" | "ghost";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: 12,
      padding: "10px 10px",
      background: tone === "ghost" ? "#fff" : "#15ff00ff",
      color: "#111",
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 900,
      width: "100%",
      opacity: disabled ? 0.65 : 1,
    }}
  >
    {children}
  </button>
);
export default function CircularCenter({
  allLive,
  activeCajero,
  setTab,
  setInboxThreadId,
  onOpenThread,
  onOfferMaterial,
  onOpenMO,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <CircularMapPanel
        allLive={allLive}
        title="Territorio circular"
        subtitle="Cada punto es una señal viva: material, residuo, trabajo, demanda, minería urbana o producción posible."
        onOpenThread={(threadId: string, point: any) =>
          onOpenThread?.(threadId, point)
        }
        onOfferMaterial={async (point: any) => {
          await sendCircularToMO({
            dv: point?.raw || point,
            actorId: activeCajero?.id || null,
            actorName: activeCajero?.nombre || null,
            orgId: activeCajero?.orgId || null,
            territoryId: activeCajero?.territorioId || null,
            note: `Circular → MO desde mapa · ${
              point?.materialName || point?.title || "material"
            }`,
            runAction: false,
            action: null,
          });

          if (point?.threadId) {
            setInboxThreadId(point.threadId);
            setTab("mis_pedidos");
          }
        }}
      />

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 26,
          background:
            "radial-gradient(circle at 15% 10%, rgba(21,255,0,0.16), transparent 28%), linear-gradient(180deg,#ffffff 0%,#f7fff9 100%)",
          padding: 16,
          boxShadow: "0 16px 46px rgba(0,0,0,0.05)",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: "-0.03em" }}>
          ♻️ Circular · centro de acción
        </div>

        <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
          Publicá señales, convertí materiales en trabajos, enviá oportunidades a MO
          y conectá recolección, reparación, reutilización y fabricación viva.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {[
            "materiales",
            "trabajo vivo",
            "minería urbana",
            "reutilización",
            "fábrica viva",
          ].map((x) => (
            <span
              key={x}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.16)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {x}
            </span>
          ))}
        </div>
      </div>

      <CircularQuickPublishPanel
        activeCajero={activeCajero}
        onPublished={({ threadId }) => {
          if (threadId) {
            setInboxThreadId(threadId);
          }
        }}
      />

      <FactoryLiveRadar
        ns="mt:market"
        liveItems={allLive}
        selfActorId={activeCajero?.id || null}
        title="🧲 Radar circular"
        subtitle="Demandas de materiales, matches automáticos y señales de presencia para responder rápido."
        onOpenThread={(threadId, cluster) => onOpenThread?.(threadId, cluster)}
        onOfferMaterial={async (cluster) => {
          const sourceDv = cluster?.items?.[0] || null;
          if (!sourceDv) return;

          const sent = await sendCircularToMO({
            dv: sourceDv,
            actorId: activeCajero?.id || null,
            actorName: activeCajero?.nombre || null,
            orgId: activeCajero?.orgId || null,
            territoryId: activeCajero?.territorioId || null,
            note: `Circular → MO desde radar · ${
              cluster?.materialName || "material"
            }`,
            runAction: false,
            action: null,
          });

          if (sent?.threadId) {
            setInboxThreadId(sent.threadId);
            setTab("mis_pedidos");
          }
        }}
      />

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >

      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 24,
          background: "#fff",
          padding: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>🏭 Fábrica viva</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Lo circular no termina en recolectar. También puede transformarse en
            trabajo productivo, reparación o nuevo producto.
          </div>
        </div>

        <FabricaVivaPanel
          allDv={allLive}
          nsFilter="__ALL__"
          activeCajero={activeCajero || null}
          setInboxThreadId={setInboxThreadId}
          setTab={setTab}
          Section={SectionBox}
          Grid={GridBox}
          Card={CardBox}
          Title={TitleBox}
          Subtle={SubtleBox}
          Chips={ChipsBox}
          Chip={ChipBox}
          Price={PriceBox}
          Actions={ActionsBox}
          SmallBtn={SmallBtnBox}
        />
      </div>
    </div>
  );
}