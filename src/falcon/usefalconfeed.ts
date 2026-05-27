import { useEffect, useMemo, useState } from "react";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import {
  adaptDatosToMtProducts,
  adaptDatosToMtOffers,
  type DatoVivo,
} from "../mt/mt.traitAdapter";
import {
  DEFAULT_FALCON_MT_NAMESPACES,
  parseNsList,
  toCanonicalFalconItem,
  upsertById,
  type CanonicalFalconItem,
} from "./falconcurator";

function arr<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function safeText(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function num(x: any): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const cleaned = x.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function uniqStrings(values: any[]): string[] {
  return Array.from(
    new Set(
      values
        .map((x) => String(x || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function sortByScore<T extends { score?: number }>(items: T[]) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function mapMtProductToFalconItem(product: any): CanonicalFalconItem {
  const tags = uniqStrings([
    ...arr(product?.tags),
    ...arr(product?.traits),
    ...arr(product?.labels),
    safeText(product?.category, product?.categoria),
    product?.creditEligible ? "payment:credit.eligible" : "",
    product?.recurrente || product?.commerce?.recurrente ? "mt:recurrente" : "",
    "mt:producto",
  ]);

  const cover = safeText(
    product?.image,
    product?.imageUrl,
    product?.cover,
    product?.media?.image,
    product?.media?.image?.url
  );

  const price =
    num(product?.price) ??
    num(product?.amount) ??
    num(product?.priceAmount) ??
    num(product?.precio);

  const currency = safeText(product?.currency, "PYG") || "PYG";

  const title = safeText(
    product?.title,
    product?.name,
    product?.nombre,
    product?.label,
    product?.productName,
    "Producto"
  );

  const subtitle = safeText(
    product?.description,
    product?.summary,
    product?.subtitle,
    product?.details
  );

  const orgId = safeText(
    product?.sellerId,
    product?.vendor?.id,
    product?.author?.id,
    product?.orgId
  ) || undefined;

  const orgName = safeText(
    product?.sellerName,
    product?.vendor?.name,
    product?.author?.name,
    product?.orgName
  ) || undefined;

  const territoryId = safeText(
    product?.territoryId,
    product?.meta?.territoryId
  ) || undefined;

  const territoryName = safeText(
    product?.territoryName,
    product?.meta?.territoryName
  ) || undefined;

  const score =
    Number(product?.score || 60) +
    (cover ? 20 : 0) +
    (typeof price === "number" ? 15 : 0) +
    (orgName ? 10 : 0);

  return {
    id: String(product?.id || `mt-product:${title}`),
    rootKind: "producto",
    kind: String(product?.kind || "producto"),
    title,
    subtitle,
    cover,
    price,
    currency,
    category: safeText(product?.category, product?.categoria, "general"),
    tags,
    ns: safeText(product?.ns, product?.meta?.ns, "mt:market"),
    scopes: Array.isArray(product?.meta?.scopes) ? product.meta.scopes : [],
    score,
    available:
      product?.available ??
      product?.inStock ??
      (typeof product?.stock === "number" ? product.stock > 0 : true),
    featured: tags.includes("featured") || tags.includes("destacado"),
    creditEligible:
      !!product?.creditEligible ||
      !!product?.pay?.finance?.credit ||
      tags.includes("payment:credit.eligible"),
    recurrente:
      !!product?.recurrente ||
      !!product?.commerce?.recurrente ||
      tags.includes("mt:recurrente"),
    territoryId,
    territoryName,
    orgId,
    orgName,
    worldId: safeText(product?.worldId) || undefined,
    role: undefined,
    governanceMode: undefined,
    commons: [],
    productiveFocus: [],
    domain: undefined,
    marketCategory: safeText(product?.category, product?.categoria) || undefined,
    inputKind: undefined,
    publishAs: "unknown",
    pieceCount: 0,
    materialCount: 0,
    processCount: 0,
    providerCount: 0,
    raw: product?.raw || product?.dv || product,
  };
}

export function useFalconFeed() {
  const targetNamespaces = useMemo(() => parseNsList(DEFAULT_FALCON_MT_NAMESPACES.join(",")), []);
  const [items, setItems] = useState<CanonicalFalconItem[]>([]);
  const [marketOffers, setMarketOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function recompute(allDv: DatoVivo[]) {
      try {
        const all = Array.isArray(allDv) ? allDv : [];

        const mtProducts = adaptDatosToMtProducts(all);
        const mtOffers = adaptDatosToMtOffers(all);

        let productItems = mtProducts.map(mapMtProductToFalconItem);
        let territoryItems: CanonicalFalconItem[] = [];
        let orgItems: CanonicalFalconItem[] = [];

        for (const dv of all) {
          const item = toCanonicalFalconItem(dv, targetNamespaces);
          if (!item) continue;

          if (item.rootKind === "territorio") {
            territoryItems = upsertById(territoryItems, item);
            continue;
          }

          if (item.rootKind === "org") {
            orgItems = upsertById(orgItems, item);
          }
        }

        const merged = sortByScore([
          ...productItems,
          ...territoryItems,
          ...orgItems,
        ]);

        setItems(merged);
        setMarketOffers(mtOffers);
        setLoading(false);
        setError("");
      } catch (e: any) {
        setError(String(e?.message || e || "No se pudo adaptar Falcon feed"));
        setLoading(false);
      }
    }

    try {
      recompute(mtLiveSnapshot());
    } catch (e: any) {
      setError(String(e?.message || e || "No se pudo leer mt.liveStore"));
      setLoading(false);
    }

    const unsub = mtLiveSubscribe((all) => {
      recompute(all);
    });

    return () => {
      try {
        unsub();
      } catch {
        // noop
      }
    };
  }, [targetNamespaces]);

  const productos = useMemo(
    () => items.filter((x) => x.rootKind === "producto"),
    [items]
  );

  const territorios = useMemo(
    () => items.filter((x) => x.rootKind === "territorio"),
    [items]
  );

  const orgs = useMemo(
    () => items.filter((x) => x.rootKind === "org"),
    [items]
  );

  const summary = useMemo(
    () => ({
      items: items.length,
      productos: productos.length,
      territorios: territorios.length,
      orgs: orgs.length,
      offers: marketOffers.length,
      targetNamespaces,
    }),
    [
      items.length,
      productos.length,
      territorios.length,
      orgs.length,
      marketOffers.length,
      targetNamespaces,
    ]
  );

  return {
    loading,
    error,
    items,
    productos,
    territorios,
    orgs,
    marketOffers,
    summary,
    targetNamespaces,
  };
}