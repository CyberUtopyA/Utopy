// ===============================
// src/mt/ProductCard.tsx
// Card de producto MT / MS Candy etc.
// ===============================
import React from "react";
import {
  DatoVivoBase,
  normalizeMtProducto,
  matchesScopes,
  ExtraAttrView,
} from "./normalizer";

type Props = {
  item: DatoVivoBase;
  /** scopes que esta UI quiere escuchar (ej: ["mt:market", "mt:ms-candy"]) */
  myScopes?: string[];
  /** click para abrir detalle, carrito, etc. (opcional) */
  onPress?: (normalized: ReturnType<typeof normalizeMtProducto>) => void;
};

export const ProductCard: React.FC<Props> = ({
  item,
  myScopes = [],
  onPress,
}) => {
  if (!matchesScopes(item, myScopes)) return null;

  const normalized = normalizeMtProducto(item);
  if (!normalized) return null;

  const {
    name,
    brand,
    unit,
    price,
    stock,
    imageUrl,
    model3dUrl,
    extra,
  } = normalized;

  const hasAR = !!model3dUrl;

  const handleClick = () => {
    if (onPress) onPress(normalized);
  };

  return (
    <div
      className="mt-product-card"
      onClick={handleClick}
      style={styles.card}
    >
      {/* Imagen */}
      <div style={styles.imageWrap as any}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            style={styles.image as any}
            loading="lazy"
          />
        ) : (
          <div style={styles.placeholder as any}>
            <span role="img" aria-label="producto">
              🧬
            </span>
          </div>
        )}

        {hasAR && (
          <div style={styles.arBadge as any}>
            <span role="img" aria-label="AR">
              ✨
            </span>{" "}
            AR listo
          </div>
        )}
      </div>

      {/* Info principal */}
      <div style={styles.body as any}>
        <div style={styles.titleRow as any}>
          <div style={styles.nameBlock as any}>
            <div style={styles.name as any}>{name}</div>
            {brand && <div style={styles.brand as any}>{brand}</div>}
          </div>
          {typeof price === "number" && (
            <div style={styles.price as any}>
              {price.toLocaleString("es-PY")} Gs
              {unit && <span style={styles.unit as any}> / {unit}</span>}
            </div>
          )}
        </div>

        {/* Stock */}
        <div style={styles.metaRow as any}>
          {typeof stock === "number" && (
            <span style={styles.pill as any}>
              Stock:{" "}
              <strong>
                {stock} {unit || ""}
              </strong>
            </span>
          )}
          {item.meta?.ns && (
            <span style={{ ...styles.pill, opacity: 0.7 } as any}>
              ns: {item.meta.ns}
            </span>
          )}
        </div>

        {/* Extra attrs (chips) */}
        {extra && extra.length > 0 && (
          <div style={styles.extraRow as any}>
            {extra.map((e: ExtraAttrView) => (
              <span key={e.key} style={styles.extraChip as any}>
                <strong>{e.label}:</strong> {e.value}
              </span>
            ))}
          </div>
        )}

        {/* Botones de acción simples */}
        <div style={styles.actions as any}>
          {hasAR && (
            <button
              type="button"
              style={styles.btnGhost as any}
              onClick={(ev) => {
                ev.stopPropagation();
                // acá luego integrás tu visor AR (nodo MS Candy / otro)
                console.log("Abrir AR:", model3dUrl);
              }}
            >
              Ver en AR
            </button>
          )}
          <button
            type="button"
            style={styles.btn as any}
            onClick={(ev) => {
              ev.stopPropagation();
              console.log("Agregar al carrito (o lo que quieras)", normalized);
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================
// Estilos inline simples
// =====================
const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    background: "rgba(15,23,42,0.92)",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.35)",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(15,23,42,0.65)",
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  },
  imageWrap: {
    position: "relative",
    paddingTop: "62%",
    background:
      "radial-gradient(circle at top, rgba(96,165,250,0.3), rgba(15,23,42,1))",
  },
  image: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  placeholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#e5e7eb",
    fontSize: 32,
  },
  arBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.95)",
    color: "#ecfdf5",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  body: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  nameBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  name: {
    color: "#e5e7eb",
    fontWeight: 800,
    fontSize: 15,
    lineHeight: 1.2,
  },
  brand: {
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 600,
  },
  price: {
    color: "#bbf7d0",
    fontWeight: 800,
    fontSize: 14,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  unit: {
    fontSize: 11,
    color: "#d1fae5",
    marginLeft: 4,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(148,163,184,0.55)",
    color: "#cbd5e1",
    fontSize: 11,
  },
  extraRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  extraChip: {
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(30,64,175,0.35)",
    color: "#dbeafe",
    fontSize: 11,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  btn: {
    borderRadius: 999,
    padding: "6px 12px",
    border: "none",
    background: "#8e949bff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  btnGhost: {
    borderRadius: 999,
    padding: "6px 12px",
    border: "1px solid rgba(148,163,184,0.7)",
    background: "transparent",
    color: "#01cc3eff",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
};
