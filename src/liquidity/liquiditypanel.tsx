import React, { useMemo, useState } from "react";
import { useLiquidity, useLiquidityCounterparties } from "./useliquidity";
import { useLiquidityStore } from "./liquidity.store";
import type { DVLike } from "./mt.liquidity";
import { asCurrency, safeNum } from "./mt.liquidity";
import { projectLiquidityProximity } from "./projectLiquidityProximity";

type Props = {
  actorId?: string;
  actorName?: string;
  defaultCurrency?: string;
  className?: string;

  onUseInCheckout?: (payload: {
    actorId: string;
    currency: string;
    available: number;
    spendable: number;
    trustScore: number;
  }) => void;

  onOpenPayCenter?: () => void;

  /**
   * Opcional.
   * Permite llevar esta misma Red de Liquidez al Mapa Vivo
   * sin meter routing dentro de este componente.
   */
  onOpenMap?: () => void;
};

const UI = {
  text: "#102018",
  textSoft: "rgba(16,32,24,0.68)",
  textMuted: "rgba(16,32,24,0.48)",

  border: "rgba(16,32,24,0.09)",
  borderStrong: "rgba(16,32,24,0.14)",

  card: "#ffffff",
  soft: "#f5f8f6",

  green: "#22f23b",
  greenDark: "#087a32",
  greenSoft: "#ecfff0",

  dark: "#0c2017",
  dark2: "#102c20",

  amberSoft: "#fff8e8",
  amberText: "#9a5a00",

  shadow: "0 10px 30px rgba(15,23,42,0.055)",
};

const card: React.CSSProperties = {
  border: `1px solid ${UI.border}`,
  background: UI.card,
  borderRadius: 24,
  padding: 16,
  color: UI.text,
  boxShadow: UI.shadow,
  minWidth: 0,
  overflow: "hidden",
};

const btn: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: `1px solid ${UI.borderStrong}`,
  background: "#fff",
  color: UI.text,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 850,
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(34,242,59,.55)",
  background: UI.green,
  color: "#06250d",
};

function fmtAmount(n: number, currency = "PYG") {
  return `${Math.round(n).toLocaleString("es-PY")} ${currency}`;
}

function fmtDate(ts?: number) {
  if (!ts) return "";

  try {
    return new Date(ts).toLocaleString("es-PY", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function getTs(dv: DVLike) {
  return (
    safeNum((dv as any)?.ts, 0) ||
    safeNum(Date.parse((dv as any)?.meta?.ts || ""), 0) ||
    safeNum(Date.parse((dv as any)?.attrs?.ts || ""), 0)
  );
}

/**
 * No mostramos kinds técnicos.
 * La tecnología queda debajo; el usuario ve significado.
 */
function humanEvent(dv: DVLike) {
  switch (dv.kind) {
    case "liq.issue":
      return {
        icon: "✨",
        title: "Nueva posibilidad",
        text: "La red habilitó una nueva capacidad para operar.",
      };

    case "liq.redeem":
      return {
        icon: "🎁",
        title: "Beneficio utilizado",
        text: "Se registró el uso de un beneficio.",
      };

    case "liq.transfer":
      return {
        icon: "💸",
        title: "Movimiento realizado",
        text: "Se registró un movimiento relacionado con una operación.",
      };

    case "liq.lock":
      return {
        icon: "🔒",
        title: "Condición reservada",
        text: "Una parte de la operación quedó reservada.",
      };

    case "liq.unlock":
      return {
        icon: "🔓",
        title: "Reserva liberada",
        text: "Una condición reservada volvió a quedar disponible.",
      };

    case "liq.credit.line":
      return {
        icon: "💰",
        title: "Financiación disponible",
        text: "Existe una posibilidad de financiación.",
      };

    case "liq.trust":
      return {
        icon: "🤝",
        title: "Relación actualizada",
        text: "La red registró nueva actividad entre participantes.",
      };

    default:
      return {
        icon: "⚡",
        title: "Actividad de la red",
        text: "Hubo una actualización relacionada con tu actividad.",
      };
  }
}

function humanReason(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  // Evitamos sacar al usuario del lenguaje humano.
  if (
    raw.includes(":") ||
    raw.includes("liq.") ||
    raw.includes("mt.") ||
    raw.includes("value.") ||
    raw.length > 90
  ) {
    return "";
  }

  return raw;
}

function friendlyCounterparty(
  counterpartyId: string,
  index: number,
) {
  const raw = String(counterpartyId || "").trim();

  // Si realmente viene un nombre usable, conservarlo.
  if (
    raw &&
    raw.length <= 34 &&
    !raw.includes(":") &&
    !raw.includes("did:") &&
    !raw.includes("actor") &&
    !raw.includes("node")
  ) {
    return raw;
  }

  return `Relación ${index + 1}`;
}

function relationText(samples = 0) {
  if (samples >= 5) return "Ya hicieron varias operaciones juntos";
  if (samples >= 2) return "Ya existe historial entre ustedes";
  if (samples >= 1) return "Ya tuvieron una operación juntos";
  return "Relación nueva";
}

function ActionTile({
  icon,
  title,
  description,
  primary,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        border: primary
          ? "1px solid rgba(34,242,59,.55)"
          : `1px solid ${UI.border}`,
        background: primary ? UI.greenSoft : "#fff",
        borderRadius: 18,
        padding: 13,
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        minWidth: 0,
        color: UI.text,
        opacity: onClick ? 1 : 0.72,
      }}
    >
      <div
        style={{
          fontSize: 23,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontWeight: 950,
          fontSize: 14,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: UI.textSoft,
          fontSize: 11,
          lineHeight: 1.35,
          marginTop: 4,
        }}
      >
        {description}
      </div>
    </button>
  );
}

export default function MtLiquidityPanel({
  actorId,
  actorName,
  defaultCurrency = "PYG",
  className,
  onUseInCheckout,
  onOpenPayCenter,
  onOpenMap,
}: Props) {
  const dvs = useLiquidityStore((s) => s.dvs);

  const [currency, setCurrency] = useState(
    asCurrency(defaultCurrency),
  );

  const [showActivity, setShowActivity] = useState(false);
  const [showRelations, setShowRelations] = useState(false);

  const {
    account,
    trust,
    currencies,
    available,
    spendable,
    reserved,
    trustScore,
  } = useLiquidity(actorId, currency);

  const counterparties = useLiquidityCounterparties(actorId);
  const proximity = useMemo(
    () => projectLiquidityProximity({ allLive: dvs, actorId, currency }),
    [dvs, actorId, currency],
  );

  const actorHistory = useMemo(() => {
    if (!actorId) return [];

    return dvs.filter((dv) => {
      const a = dv.attrs || {};

      return (
        a?.actor?.id === actorId ||
        a?.beneficiary?.id === actorId ||
        a?.from?.id === actorId ||
        a?.to?.id === actorId ||
        a?.actorId === actorId ||
        a?.buyerId === actorId ||
        a?.sellerId === actorId
      );
    });
  }, [actorId, dvs]);

  const latestHistory = useMemo(() => {
    return actorHistory
      .filter(
        (dv) =>
          dv.kind === "liq.trust" ||
          ((dv?.attrs?.currency || "PYG").toUpperCase() ===
            currency),
      )
      .sort((a, b) => getTs(b) - getTs(a))
      .slice(0, 8);
  }, [actorHistory, currency]);

  const creditLine = safeNum(account?.creditLine || 0, 0);

  const hasUsable = spendable > 0 || available > 0;
  const hasReserved = reserved > 0;
  const hasCredit = creditLine > 0;

  const activeRelations = counterparties.length;

  const usefulActivity = latestHistory.filter((dv) => {
    // Si es movimiento con 0 y no aporta significado,
    // no llenar la pantalla.
    if (dv.kind === "liq.trust") return true;

    const amount = safeNum(
      (dv as any)?.attrs?.amount ||
        (dv as any)?.attrs?.amountMax ||
        0,
      0,
    );

    return amount > 0;
  });

  const hasAnything =
    hasUsable ||
    hasReserved ||
    hasCredit ||
    activeRelations > 0 ||
    usefulActivity.length > 0;

  if (!actorId) {
    return (
      <div style={card} className={className}>
        <div
          style={{
            fontSize: 26,
            marginBottom: 10,
          }}
        >
          💧
        </div>

        <div
          style={{
            fontWeight: 950,
            fontSize: 18,
          }}
        >
          Red de Liquidez
        </div>

        <div
          style={{
            color: UI.textSoft,
            fontSize: 13,
            marginTop: 5,
            lineHeight: 1.45,
          }}
        >
          Abrí tu Perfil Vivo para ver las posibilidades de tu red.
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gap: 12,
        minWidth: 0,
      }}
    >
      {/* HERO */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 26,
          padding: 18,
          color: "#fff",
          background: `
            radial-gradient(circle at 10% 0%, rgba(34,242,59,.18), transparent 32%),
            radial-gradient(circle at 100% 20%, rgba(80,220,170,.16), transparent 36%),
            linear-gradient(145deg, ${UI.dark}, ${UI.dark2})
          `,
          boxShadow: "0 16px 36px rgba(9,30,20,.13)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 17,
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              background: UI.green,
              color: "#06250d",
              fontSize: 24,
              boxShadow: "0 10px 24px rgba(34,242,59,.16)",
            }}
          >
            💧
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: ".11em",
                color: "#8df59a",
              }}
            >
              MI VALOR · RED VIVA
            </div>

            <div
              style={{
                fontWeight: 1000,
                fontSize: 21,
                marginTop: 3,
              }}
            >
              Red de Liquidez
            </div>

            <div
              style={{
                color: "rgba(255,255,255,.74)",
                fontSize: 12,
                lineHeight: 1.4,
                marginTop: 3,
              }}
            >
              Formas reales de hacer posible una operación.
            </div>
          </div>
        </div>

        {actorName ? (
          <div
            style={{
              marginTop: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.82)",
              fontSize: 11,
              fontWeight: 800,
              maxWidth: "100%",
            }}
          >
            👤
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {actorName}
            </span>
          </div>
        ) : null}
      </section>

      {proximity.map.length ? (
        <section style={card}>
          <div style={{ fontWeight: 950, fontSize: 15 }}>🤝 Posibilidades cercanas</div>
          <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
            {proximity.map.slice(0, 4).map((possibility) => (
              <div key={possibility.id} style={{ padding: "10px 11px", borderRadius: 15, background: UI.greenSoft }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{possibility.name}</div>
                <div style={{ color: UI.textSoft, fontSize: 11, marginTop: 2 }}>{possibility.condition}</div>
              </div>
            ))}
          </div>
          {onOpenMap ? <button type="button" style={{ ...btn, marginTop: 10 }} onClick={onOpenMap}>Ver en el Mapa Circular</button> : null}
        </section>
      ) : null}

      {/* ACCIONES PRINCIPALES */}
      <section style={card}>
        <div
          style={{
            fontWeight: 950,
            fontSize: 16,
          }}
        >
          ¿Qué querés hacer?
        </div>

        <div
          style={{
            color: UI.textSoft,
            fontSize: 12,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          Elegí una acción. La red busca las posibilidades por debajo.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(135px,1fr))",
            gap: 9,
          }}
        >
          <ActionTile
            icon="💳"
            title="Pagar"
            description="Usar opciones compatibles en una compra."
            primary
            onClick={
              onUseInCheckout
                ? () =>
                    onUseInCheckout({
                      actorId,
                      currency,
                      available,
                      spendable,
                      trustScore,
                    })
                : undefined
            }
          />

          <ActionTile
            icon="🗺️"
            title="Mapa Vivo"
            description="Ver personas y nodos que pueden ayudar."
            onClick={onOpenMap}
          />

          <ActionTile
            icon="💰"
            title="Cobros"
            description="Abrir tus opciones de pago y liquidación."
            onClick={onOpenPayCenter}
          />
        </div>
      </section>

      {/* SOLO MOSTRAR CAPACIDAD SI EXISTE */}
      {(hasUsable || hasReserved || hasCredit) && (
        <section style={card}>
          <div
            style={{
              fontWeight: 950,
              fontSize: 16,
              marginBottom: 11,
            }}
          >
            Disponible ahora
          </div>

          <div
            style={{
              display: "grid",
              gap: 9,
            }}
          >
            {hasUsable && (
              <div
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background: UI.greenSoft,
                  border: "1px solid rgba(34,242,59,.18)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    💳 Podés usar
                  </div>

                  <div
                    style={{
                      color: UI.textSoft,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Capacidad disponible para una operación.
                  </div>
                </div>

                <strong
                  style={{
                    color: UI.greenDark,
                    whiteSpace: "nowrap",
                    fontSize: 16,
                  }}
                >
                  {fmtAmount(
                    spendable > 0 ? spendable : available,
                    currency,
                  )}
                </strong>
              </div>
            )}

            {hasCredit && (
              <div
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background: "#f2f5ff",
                  border: "1px solid rgba(65,105,225,.12)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    💰 Financiación disponible
                  </div>

                  <div
                    style={{
                      color: UI.textSoft,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Revisá las condiciones antes de usarla.
                  </div>
                </div>

                <strong
                  style={{
                    whiteSpace: "nowrap",
                    fontSize: 16,
                  }}
                >
                  {fmtAmount(creditLine, currency)}
                </strong>
              </div>
            )}

            {hasReserved && (
              <div
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background: UI.amberSoft,
                  border: "1px solid rgba(245,158,11,.14)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    🔒 En una operación
                  </div>

                  <div
                    style={{
                      color: UI.textSoft,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Hay una condición actualmente reservada.
                  </div>
                </div>

                <strong
                  style={{
                    color: UI.amberText,
                    whiteSpace: "nowrap",
                    fontSize: 16,
                  }}
                >
                  {fmtAmount(reserved, currency)}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {/* RELACIONES */}
      {activeRelations > 0 && (
        <section style={card}>
          <button
            type="button"
            onClick={() => setShowRelations((v) => !v)}
            style={{
              width: "100%",
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: UI.text,
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 16,
                }}
              >
                🤝 Tu red
              </div>

              <div
                style={{
                  color: UI.textSoft,
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                {activeRelations === 1
                  ? "1 relación puede ayudarte a operar."
                  : `${activeRelations} relaciones pueden ayudarte a operar.`}
              </div>
            </div>

            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: UI.soft,
                fontWeight: 950,
              }}
            >
              {showRelations ? "−" : "+"}
            </span>
          </button>

          {showRelations && (
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 12,
              }}
            >
              {counterparties.slice(0, 6).map((item, index) => (
                <div
                  key={item.counterpartyId}
                  style={{
                    border: `1px solid ${UI.border}`,
                    background: UI.soft,
                    borderRadius: 17,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                      }}
                    >
                      {friendlyCounterparty(
                        item.counterpartyId,
                        index,
                      )}
                    </div>

                    <div
                      style={{
                        color: UI.textSoft,
                        fontSize: 11,
                        marginTop: 3,
                      }}
                    >
                      {relationText(item.trust.samples)}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: "0 0 auto",
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: "#e9ffed",
                    }}
                  >
                    🤝
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ACTIVIDAD */}
      {usefulActivity.length > 0 && (
        <section style={card}>
          <button
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            style={{
              width: "100%",
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: UI.text,
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 16,
                }}
              >
                ⚡ Actividad reciente
              </div>

              <div
                style={{
                  color: UI.textSoft,
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Solo mostramos lo que puede ser útil para vos.
              </div>
            </div>

            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: UI.soft,
                fontWeight: 950,
              }}
            >
              {showActivity ? "−" : "+"}
            </span>
          </button>

          {showActivity && (
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 12,
              }}
            >
              {usefulActivity.slice(0, 6).map((dv) => {
                const event = humanEvent(dv);

                const amount = safeNum(
                  (dv as any)?.attrs?.amount ||
                    (dv as any)?.attrs?.amountMax ||
                    0,
                  0,
                );

                const reason =
                  humanReason((dv as any)?.attrs?.reason) ||
                  humanReason((dv as any)?.attrs?.status);

                return (
                  <div
                    key={dv.id}
                    style={{
                      border: `1px solid ${UI.border}`,
                      borderRadius: 17,
                      padding: 12,
                      background: UI.soft,
                      display: "grid",
                      gridTemplateColumns: "38px minmax(0,1fr)",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        display: "grid",
                        placeItems: "center",
                        background: "#fff",
                        fontSize: 18,
                        boxShadow:
                          "0 4px 14px rgba(15,23,42,.045)",
                      }}
                    >
                      {event.icon}
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 13,
                          }}
                        >
                          {event.title}
                        </strong>

                        {amount > 0 && dv.kind !== "liq.trust" ? (
                          <strong
                            style={{
                              flex: "0 0 auto",
                              fontSize: 12,
                            }}
                          >
                            {fmtAmount(
                              amount,
                              (dv as any)?.attrs?.currency ||
                                currency,
                            )}
                          </strong>
                        ) : null}
                      </div>

                      <div
                        style={{
                          color: UI.textSoft,
                          fontSize: 11,
                          lineHeight: 1.4,
                          marginTop: 3,
                        }}
                      >
                        {reason || event.text}
                      </div>

                      {getTs(dv) ? (
                        <div
                          style={{
                            color: UI.textMuted,
                            fontSize: 10,
                            marginTop: 5,
                          }}
                        >
                          {fmtDate(getTs(dv))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* EMPTY STATE REAL */}
      {!hasAnything && (
        <section
          style={{
            ...card,
            textAlign: "center",
            padding: "24px 18px",
          }}
        >
          <div
            style={{
              width: 66,
              height: 66,
              margin: "0 auto 12px",
              borderRadius: 22,
              display: "grid",
              placeItems: "center",
              fontSize: 29,
              background: UI.greenSoft,
              border: "1px solid rgba(34,242,59,.18)",
            }}
          >
            💧
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 1000,
            }}
          >
            Tu red empieza acá
          </div>

          <div
            style={{
              color: UI.textSoft,
              fontSize: 12,
              lineHeight: 1.5,
              maxWidth: 320,
              margin: "7px auto 0",
            }}
          >
            Cuando aparezcan relaciones, beneficios o formas de
            financiar una operación, las vas a encontrar acá.
          </div>

          {onOpenMap ? (
            <button
              type="button"
              onClick={onOpenMap}
              style={{
                ...primaryBtn,
                marginTop: 15,
              }}
            >
              🗺️ Explorar Mapa Vivo
            </button>
          ) : null}
        </section>
      )}

      {/* Moneda: solo si realmente hay varias */}
      {currencies.length > 1 && (
        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "4px 3px",
          }}
        >
          <span
            style={{
              color: UI.textMuted,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            Moneda
          </span>

          <select
            value={currency}
            onChange={(e) =>
              setCurrency(asCurrency(e.target.value))
            }
            style={{
              ...btn,
              minHeight: 38,
              padding: "7px 10px",
            }}
          >
            {currencies.map((cur) => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>
        </section>
      )}
    </div>
  );
}
