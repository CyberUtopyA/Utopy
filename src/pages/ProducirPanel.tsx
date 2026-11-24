import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  PlusCircle,
  Coins,
  Boxes,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Package2,
  Megaphone,
  Landmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createCajero } from "../mt/crearcajero";
import { spore } from "../utopy/spore.singleton";
import {
  MtProduct,
  MtOffer,
  DatoVivo,
  normalizeCategoryToken,
} from "../mt/mt.traitAdapter";
import { MtCajero } from "../mt/mt.cajeroAdapter";
import { publishDatoVivo } from "../mt/seedbus";
import { mtLiveSubscribe, mtLiveUpsert } from "../mt/mt.liveStore";
import { emitPaymentOffer, PaymentMethod } from "../mt/mt.intentpayment";
import {
  emitCreditPlan,
  CreditGuaranteeMode,
  CreditInterval,
} from "../mt/mt.creditintent";
import FactoryLiveRadar, { DemandCluster } from "../mt/factoryliveradar";
import { buildWorkIntentDV } from "../mt/work.builder";

type Tab = "producto" | "oferta" | "produccion" | "catalogo";
type PayMode = "cajero" | "direct" | "hybrid";
type EscrowMode = "none" | "delivery" | "multisig";
type FinanceMode = "cash" | "credit" | "subscription" | "mixed";
type SplitRow = { to: string; bps: string };

type MaterialRow = {
  id: string;
  materialKey: string;
  materialName: string;
  quantity: string;
  unit: string;
  notes: string;
  maxUnitPrice: string;
};

type Props = {
  currentCajero: MtCajero | null;
};

function useMtLiveItems() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const unsub = mtLiveSubscribe((all: any[]) => {
      setItems(Array.isArray(all) ? all : []);
    });

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  return items;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}


async function filesToCompressedPreviews(
  files: File[],
  opt?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: "image/jpeg" | "image/webp";
  },
): Promise<
  Array<{
    original: File;
    compressed: File;
    preview: string;
    mime: string;
    width: number;
    height: number;
  }>
> {
  const out = [];
  for (const f of files) {
    const c = await compressImageFile(f, opt);
    out.push({
      original: f,
      compressed: c.file,
      preview: c.dataUrl,
      mime: c.mime,
      width: c.width,
      height: c.height,
    });
  }
  return out;
}

async function uploadImageToMarketNode(file: File): Promise<{
  url: string;
  mime?: string;
  name?: string;
}> {
  const dataUrl = await fileToDataUrl(file);

  const res = await fetch("https://market.utopy.live/media/upload.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dataUrl,
      mime: file.type || "image/jpeg",
      name: file.name || `upload-${Date.now()}.jpg`,
    }),
  });

  if (!res.ok) throw new Error("Error subiendo imagen al nodo Market");

  const json = await res.json().catch(() => null);
  if (!json?.url || typeof json.url !== "string") {
    throw new Error("El nodo Market no devolvió una URL válida");
  }

  return {
    url: json.url,
    mime: file.type || undefined,
    name: file.name || undefined,
  };
}

async function uploadManyImagesToMarketNode(files: File[]) {
  const out: Array<{ url: string; mime?: string; name?: string }> = [];
  for (const file of files) {
    const uploaded = await uploadImageToMarketNode(file);
    out.push(uploaded);
  }
  return out;
}

const createId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function parseSplitRows(raw: SplitRow[]) {
  const out = raw
    .map((r) => ({
      to: safeStr(r.to).trim(),
      bps: Number(r.bps || "0"),
    }))
    .filter((r) => r.to && Number.isFinite(r.bps) && r.bps > 0);

  const sum = out.reduce((a, b) => a + b.bps, 0);
  return { out, sum };
}

const productToDatoVivo = (p: MtProduct): DatoVivo => ({
  id: p.id,
  kind: "producto",
  attrs: {
    nombre: p.nombre,
    unidad: p.unidad,
    precio: p.precio,
    stock: p.stock,
    imagen: p.imagen,
    media: (p.meta as any)?.media,
    productor: p.productor,
    tags: p.tags,
    ar: (p.meta as any)?.ar,
    model: (p.meta as any)?.model,
  },
  traits: ["mt:producto", "mt:vendible", "mt:local"],
  meta: {
    ...(p.meta || {}),
    name: p.nombre,
  },
});

const offerToDatoVivo = (o: MtOffer): DatoVivo => {
  const meta = (o.meta || {}) as any;
  const isBuy = o.tipo === "compra";
  const imageUrl = meta?.media?.image?.url || "";

  return {
    id: o.id,
    kind: "mt:offer",
    attrs: {
      productoId: o.productoId,
      tipo: o.tipo,
      cantidad: o.cantidad,
      precio: o.precio,
      productor: o.productor,
      side: isBuy ? "buy" : "sell",
      intent: isBuy ? "pedido" : "oferta",
      pay: meta?.pay,
      media: meta?.media,
      imagen: imageUrl,
      ar: meta?.ar,
      model: meta?.model,
    },
    traits: [
      "mt:offer",
      "mt:market",
      ...(isBuy ? ["mt:demand"] : ["mt:supply"]),
      ...(meta?.cat ? [String(meta.cat)] : []),
    ],
    meta: {
      ...meta,
      name: `${o.tipo} ${o.productoId}`,
    },
  };
};

/* UI */

const Wrap = styled.div`
  display: grid;
  gap: 14px;
  min-width: 0;
`;

const Hero = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, rgba(21, 255, 0, 0.1), transparent 35%),
    linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%);
  padding: 16px;

  @media (min-width: 900px) {
    padding: 20px;
  }
`;

const FormGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: start;
`;

const HeroTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;

  & > * {
    min-width: 0;
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

const Field = styled.div<{ span?: number }>`
  grid-column: span ${({ span }) => span || 12};
  min-width: 0;

  @media (max-width: 900px) {
    grid-column: span 12;
  }
`;

const HeroTitleBox = styled.div`
  display: grid;
  gap: 6px;
`;

const HeroTitle = styled.div`
  font-size: 1.15rem;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const HeroSub = styled.div`
  color: rgba(0, 0, 0, 0.66);
  font-size: 0.92rem;
  line-height: 1.45;
  max-width: 760px;
`;

const StatusPill = styled.div<{ ok?: boolean }>`
  border: 1px solid
    ${({ ok }) => (ok ? "rgba(34,197,94,0.24)" : "rgba(0,0,0,0.08)")};
  background: ${({ ok }) =>
    ok ? "rgba(34,197,94,0.10)" : "rgba(0,0,0,0.03)"};
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 0.82rem;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Grid2 = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr;

  @media (min-width: 980px) {
    grid-template-columns: 1fr 1fr;
  }
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

const FullCard = styled(SectionCard)`
  grid-column: 1 / -1;
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

const SoftInfo = styled.div`
  border: 1px dashed rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.02);
  font-size: 0.88rem;
  color: rgba(0, 0, 0, 0.72);
`;

const Tabs = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const TabBtn = styled.button<{ active?: boolean }>`
  border: 1px solid ${({ active }) => (active ? "#111" : "rgba(0,0,0,0.10)")};
  background: ${({ active }) =>
    active ? "linear-gradient(180deg, #111 0%, #232323 100%)" : "#fff"};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  padding: 9px 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 900;
  box-shadow: ${({ active }) =>
    active ? "0 8px 20px rgba(0,0,0,0.12)" : "none"};
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 800;
  opacity: 0.74;
  margin-bottom: 6px;
  display: block;
`;

const Input = styled.input`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 11px 12px;
  width: 100%;
  background: #fff;
  color: #111;
  caret-color: #111;
  transition: 0.18s ease;
  min-width: 0;

  &::placeholder {
    color: rgba(0, 0, 0, 0.42);
  }

  &:focus {
    outline: none;
    background: #fff;
    color: #111;
    border-color: rgba(34, 197, 94, 0.45);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  }
`;

const Select = styled.select`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 11px 12px;
  width: 100%;
  background: #fff;
  color: #111;
  caret-color: #111;
  transition: 0.18s ease;
  min-width: 0;

  &:focus {
    outline: none;
    background: #fff;
    color: #111;
    border-color: rgba(34, 197, 94, 0.45);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  }
`;

const TextArea = styled.textarea`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 11px 12px;
  width: 100%;
  min-height: 92px;
  resize: vertical;
  background: #fff;
  color: #111;
  caret-color: #111;
  transition: 0.18s ease;
  min-width: 0;

  &::placeholder {
    color: rgba(0, 0, 0, 0.42);
  }

  &:focus {
    outline: none;
    background: #fff;
    color: #111;
    border-color: rgba(34, 197, 94, 0.45);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  }
`;

const MiniNote = styled.div`
  margin-top: 6px;
  font-size: 0.78rem;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.35;
`;

const SmallBtn = styled.button<{ ghost?: boolean }>`
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

  &:disabled {
    opacity: 0.55;
    pointer-events: none;
    transform: none;
    box-shadow: none;
  }
`;

const PublishBar = styled.div`
  position: sticky;
  bottom: 10px;
  z-index: 4;
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
`;

const PublishCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 18px;
  padding: 10px;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.08);
`;

const MsgBox = styled.div<{ ok?: boolean }>`
  border: 1px solid
    ${({ ok }) => (ok ? "rgba(34,197,94,0.22)" : "rgba(0,0,0,0.08)")};
  background: ${({ ok }) =>
    ok ? "rgba(34,197,94,0.08)" : "rgba(0,0,0,0.03)"};
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 0.9rem;
  line-height: 1.4;
`;

const MethodRow = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns:
    minmax(140px, 180px) minmax(180px, 1fr) minmax(220px, 1.4fr)
    auto;
  align-items: end;

  & > * {
    min-width: 0;
  }

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

export default function ProducirPanel({ currentCajero }: Props) {
  const liveItems = useMtLiveItems();

  const [tab, setTab] = useState<Tab>("producto");
  const [ns, setNs] = useState("mt:market");
  const [showAdvancedPay, setShowAdvancedPay] = useState(false);

  const [payText, setPayText] = useState("Acepto transferencia, QR o efectivo.");
  const [payCurrency, setPayCurrency] = useState("PYG");
  const [methods, setMethods] = useState<PaymentMethod[]>([
    { channel: "transfer", label: "Ueno Alias", address: "" },
    { channel: "qr", label: "QR", qr: "" },
    { channel: "cash", label: "Efectivo", address: null },
  ]);

  const [pNombre, setPNombre] = useState("");
  const [pImagen, setPImagen] = useState("");
  const [pUnidad, setPUnidad] = useState("u");
  const [pPrecio, setPPrecio] = useState("");
  const [pStock, setPStock] = useState("");
  const [pCategoria, setPCategoria] = useState("");
  const [pTags, setPTags] = useState("");
  const [lastPublishedProduct, setLastPublishedProduct] = useState<MtProduct | null>(null);


  const [cajeroNombre, setCajeroNombre] = useState("");
  const [creating, setCreating] = useState(false);

  const [payMode, setPayMode] = useState<PayMode>("cajero");
  const [negotiate, setNegotiate] = useState(true);
  const [escrowMode, setEscrowMode] = useState<EscrowMode>("none");
  const [recipient, setRecipient] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([
    { to: "", bps: "9000" },
    { to: "", bps: "1000" },
  ]);

  const [financeMode, setFinanceMode] = useState<FinanceMode>("cash");
  const [creditDownPaymentMin, setCreditDownPaymentMin] = useState("");
  const [creditInstallmentCount, setCreditInstallmentCount] = useState("3");
  const [creditInterval, setCreditInterval] = useState<CreditInterval>("monthly");
  const [creditEvery, setCreditEvery] = useState("1");
  const [creditLateFeeFlat, setCreditLateFeeFlat] = useState("");
  const [creditLateFeePct, setCreditLateFeePct] = useState("");
  const [creditGuaranteeMode, setCreditGuaranteeMode] =
    useState<CreditGuaranteeMode>("downpayment");
  const [creditTrustRequired, setCreditTrustRequired] = useState("");
  const [creditNote, setCreditNote] = useState("");
const [catalogStoreId, setCatalogStoreId] = useState("decohogar");
const [catalogStoreName, setCatalogStoreName] = useState("DecoHogar");
const [catalogWhatsapp, setCatalogWhatsapp] = useState("595XXXXXXXXX");
const [catalogCategoria, setCatalogCategoria] = useState("hogar");
const [catalogPrecioDefault, setCatalogPrecioDefault] = useState("");
const [catalogStockDefault, setCatalogStockDefault] = useState("1");
const [catalogUnidadDefault, setCatalogUnidadDefault] = useState("u");
const [catalogJson, setCatalogJson] = useState("");
const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
const [catalogPreviews, setCatalogPreviews] = useState<string[]>([]);
const [catalogPublishing, setCatalogPublishing] = useState(false);
  const [arUrl, setArUrl] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [modelFormat, setModelFormat] = useState<"glb" | "usdz" | "obj" | "gltf">("glb");
  const [modelScale, setModelScale] = useState("1");
  const [modelPlacement, setModelPlacement] = useState<"floor" | "wall" | "auto">("floor");

  const [pImageFiles, setPImageFiles] = useState<File[]>([]);
  const [pImagePreviews, setPImagePreviews] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [oImagen, setOImagen] = useState("");
  const [oImageFiles, setOImageFiles] = useState<File[]>([]);
  const [oImagePreviews, setOImagePreviews] = useState<string[]>([]);
  const [uploadingOfferImage, setUploadingOfferImage] = useState(false);
  const [oTipo, setOTipo] = useState<"venta" | "compra">("venta");
  const [oProductoId, setOProductoId] = useState("");
  const [oCantidad, setOCantidad] = useState("");
  const [oPrecio, setOPrecio] = useState("");
  const [oCategoria, setOCategoria] = useState("");
  const [oMensaje, setOMensaje] = useState("");
  const [oTags, setOTags] = useState("");

  const [dTitle, setDTitle] = useState("");
  const [dDescription, setDDescription] = useState("");
  const [dQuantity, setDQuantity] = useState("1");
  const [dBudget, setDBudget] = useState("");
  const [dLocation, setDLocation] = useState("");

  const [materials, setMaterials] = useState<MaterialRow[]>([
    {
      id: createId("mat_"),
      materialKey: "madera-pino",
      materialName: "Madera pino",
      quantity: "8",
      unit: "tabla",
      notes: "",
      maxUnitPrice: "",
    },
  ]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canCreateProduct = !!pNombre.trim() && !!pPrecio.trim();
  const canCreateOffer = !!oProductoId.trim() && !!oCantidad.trim() && !!oPrecio.trim();
  const creditEnabled = financeMode === "credit" || financeMode === "mixed";

  const cajaTag = useMemo(() => {
    return currentCajero
      ? {
          id: currentCajero.id,
          nombre: currentCajero.nombre,
          wallet: (currentCajero as any).wallet || undefined,
        }
      : undefined;
  }, [currentCajero]);
const actualizarWhatsappCatalogo = async () => {
  const storeId = catalogStoreId.trim() || "decohogar";
  const nuevoWhatsapp = catalogWhatsapp.trim();

  if (!nuevoWhatsapp) {
    setMsg("Poné el nuevo número de WhatsApp.");
    return;
  }

  try {
    setBusy(true);
    setMsg("Actualizando número del catálogo...");

    const base = getMarketApiBase();

    const res = await fetch(`${base}/api/catalog-live.php?storeId=${encodeURIComponent(storeId)}`);
    const json = await res.json();

    const items = Array.isArray(json?.items) ? json.items : [];

    const updated = items.map((dv: any) => ({
      ...dv,
      attrs: {
        ...(dv.attrs || {}),
        whatsapp: nuevoWhatsapp,
      },
      meta: {
        ...(dv.meta || {}),
        ts: new Date().toISOString(),
        contact: {
          ...(dv.meta?.contact || {}),
          whatsapp: nuevoWhatsapp,
        },
        seller: {
          ...(dv.meta?.seller || {}),
          whatsapp: nuevoWhatsapp,
        },
      },
    }));

    await saveCatalogDvsToServer(updated);

    for (const dv of updated) {
      mtLiveUpsert(dv);

      try {
        await publishDatoVivo(dv);
      } catch (e) {
        console.warn("No se pudo republicar DV actualizado", e);
      }
    }

    setMsg(`WhatsApp actualizado ✅ ${updated.length} productos de ${storeId}`);
  } catch (e: any) {
    setMsg(e?.message || "No se pudo actualizar el WhatsApp");
  } finally {
    setBusy(false);
  }
};
  const withSpore = async (fn: (sp: any) => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      if (!spore) throw new Error("Spore no disponible");
      await fn(spore);
      setMsg("Emitido al nodo MT ✅");
    } catch (e: any) {
      setMsg(e?.message || "Error al emitir");
    } finally {
      setBusy(false);
    }
  };

  const setMethodField = (i: number, patch: Partial<PaymentMethod>) => {
    setMethods((prev) => {
      const copy = [...prev];
      copy[i] = { ...(copy[i] || { channel: "any" }), ...patch };
      return copy;
    });
  };

  const removeMethod = (i: number) => {
    setMethods((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addMethod = () => {
    setMethods((prev) => [...prev, { channel: "any", label: "Otro", address: "" }]);
  };

  const methodValue = (m: PaymentMethod) =>
    (m as any).link || (m as any).qr || (m as any).address || "";

  const applyMethodValue = (m: PaymentMethod, v: string): PaymentMethod => {
    const channel = String((m as any).channel || "any");
    const base: any = { ...m, address: null, link: null, qr: null };
    if (channel === "link") return { ...base, link: v };
    if (channel === "qr") return { ...base, qr: v };
    if (channel === "cash") return { ...base, address: null };
    return { ...base, address: v };
  };
function parseCatalogProducts() {
  if (!catalogJson.trim()) return [];

  try {
    const parsed = JSON.parse(catalogJson);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.products)) return parsed.products;
    if (Array.isArray(parsed.productos)) return parsed.productos;
    return [];
  } catch {
    return [];
  }
}

const onPickCatalogFiles = async (files: File[]) => {
  if (!files.length) {
    setCatalogFiles([]);
    setCatalogPreviews([]);
    return;
  }

  try {
    const compressed = await filesToCompressedPreviews(files, {
      maxWidth: 1400,
      maxHeight: 1400,
      quality: 0.78,
      mimeType: "image/jpeg",
    });

    setCatalogFiles(compressed.map((x) => x.compressed));
    setCatalogPreviews(compressed.map((x) => x.preview));
  } catch (e) {
    console.warn("No se pudo comprimir catálogo", e);
    setCatalogFiles(files);
    setCatalogPreviews([]);
  }
};

const submitCatalogoMasivo = async () => {
  if (!catalogFiles.length) {
    setMsg("Subí al menos una imagen del catálogo.");
    return;
  }

  const storeId = catalogStoreId.trim() || "tienda";
  const storeName = catalogStoreName.trim() || "Tienda";
  const whatsapp = catalogWhatsapp.trim();
  const iaProducts = parseCatalogProducts();

  try {
    setCatalogPublishing(true);
    setBusy(true);
    setMsg(`Subiendo catálogo: 0/${catalogFiles.length}`);

    const created: MtProduct[] = [];
    const dvsToSave: DatoVivo[] = [];

    for (let i = 0; i < catalogFiles.length; i++) {
      const file = catalogFiles[i];
      const ia = iaProducts[i] || {};

      setMsg(`Subiendo catálogo: ${i + 1}/${catalogFiles.length}`);

      const uploaded = await uploadImageToMarketNode(file);

      const nombre =
        safeStr(ia.nombre || ia.name || ia.title).trim() ||
        `Producto ${String(i + 1).padStart(3, "0")} - ${storeName}`;

      const descripcion =
        safeStr(ia.descripcion || ia.description || ia.detalle).trim() ||
        "Producto disponible en catálogo. Consultar precio, medidas y disponibilidad.";

      const categoriaProducto = normalizeCategoryToken(
        ia.categoria || ia.category || catalogCategoria || "hogar",
      );

      const precioRaw = ia.precio ?? ia.price ?? catalogPrecioDefault;
      const precioNum = Number(precioRaw || 0);
      const precioFinal =
        Number.isFinite(precioNum) && precioNum > 0 ? precioNum : 0;

      const stockRaw = ia.stock ?? catalogStockDefault;
      const stockNum = Number(stockRaw || 1);

      const unidad = safeStr(ia.unidad || ia.unit || catalogUnidadDefault).trim() || "u";

      const tags = Array.isArray(ia.tags)
        ? ia.tags.map((x: any) => safeStr(x)).filter(Boolean)
        : parseTags(
            safeStr(ia.tags || ia.etiquetas || `${storeName}, ${categoriaProducto}`),
          );

     let meta: MtProduct["meta"] = {
  ns: ns || "mt:market",
  origin: "catalog.upload",
  catalog: true,

  storeId,
  storeName,

  seller: {
    id: storeId,
    name: storeName,
    type: "store-node",
    whatsapp,
  },

  originNode: storeId,
  authority: storeId,
  replicatedBy: ["market.utopy.live"],
  portable: true,
  exportable: true,
  canMirror: true,

  description: descripcion,
  priceMode: precioFinal > 0 ? "fixed" : "consultar",
  contact: {
    whatsapp,
  },
  media: {
    image: uploaded,
    gallery: [uploaded],
  },
} as any;

      if (categoriaProducto) {
        (meta as any).cat = categoriaProducto;
        (meta as any).categorias = [categoriaProducto];
      }

      if (cajaTag) {
        (meta as any).caja = cajaTag;
      }

      meta = buildPayMeta(meta as any);

      const producto: MtProduct = {
        id: createId(`mt:producto:${storeId}:`),
        nombre,
        imagen: uploaded.url,
        precio: precioFinal,
        unidad,
        stock: Number.isFinite(stockNum) ? stockNum : 1,
        productor: currentCajero
          ? { id: currentCajero.id, nombre: currentCajero.nombre }
          : { id: storeId, nombre: storeName },
        tags,
        meta,
      };

      const baseDv = productToDatoVivo(producto);

      const dv: DatoVivo = {
        ...baseDv,
       attrs: {
  ...baseDv.attrs,
  descripcion,
  tienda: storeName,
  vendedor: storeName,
  sellerId: storeId,
  storeId,
  whatsapp,
  categoria: categoriaProducto,
},
        traits: [
          ...(baseDv.traits || []),
          "mt:catalog",
          "mt:catalog.upload",
          `store:${storeId}`,
          categoriaProducto ? `cat:${categoriaProducto}` : "cat:general",
        ],
        meta: {
          ...(baseDv.meta || {}),
          ...meta,
          name: nombre,
        },
      };

     mtLiveUpsert(dv);

try {
  await publishDatoVivo(dv);
} catch (e) {
  console.warn("No se pudo emitir vivo, pero se guardará en el nodo semilla", e);
}

dvsToSave.push(dv);
created.push(producto);
    }
    await saveCatalogDvsToServer(dvsToSave);

    try {
      if (spore) {
        await spore.sayIntent({
          sym: "📚",
          say: "mt.catalog.upload",
          with: {
            storeId,
            storeName,
            count: created.length,
            ns: ns || "mt:market",
          },
        });
      }
    } catch (e) {
      console.warn("[MT catalog] Spore intent falló", e);
    }

    setMsg(`Catálogo publicado ✅ ${created.length} productos vivos en ${storeName}`);

    setCatalogFiles([]);
    setCatalogPreviews([]);
    setCatalogJson("");
  } catch (e: any) {
    setMsg(e?.message || "Error subiendo catálogo");
  } finally {
    setCatalogPublishing(false);
    setBusy(false);
  }
};
  const buildPayMeta = (metaBase: any) => {
    const pay: any = {
      mode: payMode,
      text: payText?.trim() || null,
      currency: payCurrency || "PYG",
      accepted: methods,
      negotiate: !!negotiate,
      escrow: escrowMode,
      rails: ["evm:bsc"],
      finance: {
        mode: financeMode,
        creditEnabled,
      },
    };

    if (cajaTag) pay.recommendedCajeroId = cajaTag.id;

    if (payMode !== "cajero" && recipient.trim()) {
      pay.recipient = recipient.trim();
    }

    if (payMode !== "cajero" && splitEnabled) {
      const { out, sum } = parseSplitRows(splits);
      if (out.length) {
        pay.split = out;
        pay.splitSumBps = sum;
      }
    }

    if (creditEnabled) {
      pay.finance.credit = {
        downPaymentMin: Math.max(0, Number(creditDownPaymentMin || 0)),
        installmentCount: Math.max(1, Number(creditInstallmentCount || 1)),
        interval: creditInterval,
        every: Math.max(1, Number(creditEvery || 1)),
        lateFeeFlat: creditLateFeeFlat ? Number(creditLateFeeFlat) : null,
        lateFeePct: creditLateFeePct ? Number(creditLateFeePct) : null,
        guaranteeMode: creditGuaranteeMode,
        trustRequired: creditTrustRequired ? Number(creditTrustRequired) : null,
        note: creditNote?.trim() || null,
      };
    }

    return { ...metaBase, pay };
  };

  const buildArMeta = (metaBase: any) => {
    const ar = arUrl.trim()
      ? {
          url: arUrl.trim(),
          placement: modelPlacement,
        }
      : undefined;

    const model = modelUrl.trim()
      ? {
          url: modelUrl.trim(),
          format: modelFormat,
          scale: Number(modelScale || "1"),
          placement: modelPlacement,
        }
      : undefined;

    const out = { ...metaBase } as any;
    if (ar) out.ar = ar;
    if (model) out.model = model;
    return out;
  };

  const handleOpenFactoryThread = (threadId: string, cluster: DemandCluster) => {
    if (import.meta.env.DEV) console.debug("[FactoryLiveRadar] abrir hilo", threadId, cluster);
    setMsg(`Abrir hilo: ${threadId}`);
  };

  const handleOfferFactoryMaterial = (cluster: DemandCluster) => {
    const first = cluster.items?.[0];
    const suggestedProductId =
      first?.attrs?.materialKey ||
      first?.attrs?.productoId ||
      cluster.materialKey ||
      "";

    setTab("oferta");
    setOTipo("venta");
    setOProductoId(String(suggestedProductId));
    setOCantidad(String(cluster.totalQuantity || 1));
    setOCategoria("material");
    setOMensaje(
      `Oferta para ${cluster.materialName} · ${cluster.totalQuantity} ${cluster.unit}`
    );
    setMsg(`Oferta preparada para ${cluster.materialName} ✅`);
  };

  const publishCreditPlanFor = async (args: {
    productId: string | null;
    principal: number;
  }) => {
    if (!currentCajero) throw new Error("Elegí un cajero para publicar crédito.");
    if (!creditEnabled) throw new Error("Activá modo financiero crédito o mixto.");

    const principal = Number(args.principal || 0);
    if (!Number.isFinite(principal) || principal <= 0) {
      throw new Error("Necesitás un precio válido para generar plan de crédito.");
    }

    const down = Math.max(0, Number(creditDownPaymentMin || 0));
    const count = Math.max(1, Number(creditInstallmentCount || 1));
    const every = Math.max(1, Number(creditEvery || 1));
    const financed = Math.max(0, principal - down);
    const installmentValue = financed / count;

    if (financed <= 0) throw new Error("El saldo financiado debe ser mayor a 0.");

    await emitCreditPlan({
      sellerId: currentCajero.id,
      sellerName: currentCajero.nombre,
      orderId: null,
      productId: args.productId || null,
      principal,
      downPaymentMin: down,
      installmentCount: count,
      installmentValue,
      interval: creditInterval,
      every,
      currency: payCurrency || "PYG",
      lateFeeFlat: creditLateFeeFlat ? Number(creditLateFeeFlat) : null,
      lateFeePct: creditLateFeePct ? Number(creditLateFeePct) : null,
      trustRequired: creditTrustRequired ? Number(creditTrustRequired) : null,
      guaranteeMode: creditGuaranteeMode,
      note: creditNote?.trim() || null,
      ns: ns || "mt:market",
      source: "ms.web.producir.credit.plan",
    });
  };

  const addMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        id: createId("mat_"),
        materialKey: "",
        materialName: "",
        quantity: "1",
        unit: "u",
        notes: "",
        maxUnitPrice: "",
      },
    ]);
  };
function getMarketApiBase() {
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "https://market.utopy.live";
  }

  return "";
}

async function saveCatalogDvsToServer(items: DatoVivo[]) {
  const base = getMarketApiBase();

  const res = await fetch(`${base}/api/catalog-live.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "No se pudo guardar catálogo en servidor");
  }

  return json;
}
  const updateMaterialRow = (id: string, patch: Partial<MaterialRow>) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMaterialRow = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const submitProducto = async () => {
    if (!canCreateProduct) {
      setMsg("Completa al menos nombre y precio.");
      return;
    }

    const precioNum = Number(pPrecio || "0");
    const stockNum = pStock ? Number(pStock) : undefined;

    if (Number.isNaN(precioNum) || precioNum <= 0) {
      setMsg("Precio inválido.");
      return;
    }
    if (pStock && (Number.isNaN(stockNum) || (stockNum ?? 0) < 0)) {
      setMsg("Stock inválido.");
      return;
    }

    try {
      setUploadingImage(true);

      let gallery: Array<{ url: string; mime?: string; name?: string }> = [];
      let finalImageUrl = pImagen.trim();

      if (pImageFiles.length) {
        gallery = await uploadManyImagesToMarketNode(pImageFiles);
        if (!finalImageUrl) finalImageUrl = gallery[0]?.url || "";
      }

      if (!finalImageUrl) throw new Error("Debes cargar al menos una imagen o URL.");

      let meta: MtProduct["meta"] = { ns: ns || "mt:market" } as any;

      if (cajaTag) (meta as any).caja = cajaTag;

      const catId = normalizeCategoryToken(pCategoria);
      if (catId) {
        (meta as any).cat = catId;
        (meta as any).categorias = [catId];
      }

      const tagsArr = parseTags(pTags);

      meta = buildPayMeta(meta as any);
      meta = buildArMeta(meta as any);

      (meta as any).media = {
        image: {
          url: finalImageUrl,
          mime: gallery[0]?.mime,
          name: gallery[0]?.name,
        },
        gallery,
      };

      const productor = currentCajero
        ? { id: currentCajero.id, nombre: currentCajero.nombre }
        : { id: "local-node", nombre: "Nodo Local" };

      const producto: MtProduct = {
        id: createId("mt:producto:"),
        nombre: pNombre.trim(),
        imagen: finalImageUrl,
        precio: precioNum,
        unidad: pUnidad.trim() || "u",
        stock: stockNum,
        productor,
        tags: tagsArr.length ? tagsArr : undefined,
        meta,
      };

      const dv = productToDatoVivo(producto);
      mtLiveUpsert(dv);

      await withSpore(async (sp) => {
        await sp.sayIntent({
          sym: "🛒",
          say: "mt.product.create",
          with: { product: producto, caja: cajaTag },
        });
      });

      try {
        await publishDatoVivo(dv);
      } catch (e) {
        console.warn("[MT web] No se pudo publicar DatoVivo en seed:", e);
      }

      setLastPublishedProduct(producto);

      if (creditEnabled) {
        try {
          await publishCreditPlanFor({
            productId: producto.id,
            principal: precioNum,
          });
          setMsg("Producto publicado ✅ + plan de crédito ligado al producto ✅");
        } catch (e: any) {
          setMsg(
            `Producto publicado ✅ pero no se pudo publicar el crédito: ${
              e?.message || "Error"
            }`,
          );
        }
      } else {
        setMsg("Producto publicado ✅");
      }
    } catch (e: any) {
      setMsg(e?.message || "Error al publicar producto");
    } finally {
      setUploadingImage(false);
    }
  };

  const submitOferta = async () => {
    if (!canCreateOffer) {
      setMsg("Completa producto, cantidad y precio.");
      return;
    }

    const cantNum = Number(oCantidad || "0");
    const precioNum = Number(oPrecio || "0");

    if (Number.isNaN(cantNum) || cantNum <= 0) {
      setMsg("Cantidad inválida.");
      return;
    }
    if (Number.isNaN(precioNum) || precioNum <= 0) {
      setMsg("Precio inválido.");
      return;
    }

    try {
      setUploadingOfferImage(true);

      let gallery: Array<{ url: string; mime?: string; name?: string }> = [];
      let finalImageUrl = oImagen.trim();

      if (oImageFiles.length) {
        gallery = await uploadManyImagesToMarketNode(oImageFiles);
        if (!finalImageUrl) finalImageUrl = gallery[0]?.url || "";
      }

      let meta: MtOffer["meta"] = { ns: ns || "mt:market" } as any;
      if (cajaTag) (meta as any).caja = cajaTag;

      const catId = normalizeCategoryToken(oCategoria);
      if (catId) {
        (meta as any).cat = catId;
        (meta as any).categorias = [catId];
      }

      if (oMensaje.trim()) {
        (meta as any).mensaje = oMensaje.trim();
        (meta as any).intentText = oMensaje.trim();
      }

      const tagsArr = parseTags(oTags);
      if (tagsArr.length) (meta as any).tags = tagsArr;

      meta = buildPayMeta(meta as any);
      meta = buildArMeta(meta as any);

      if (finalImageUrl) {
        (meta as any).media = {
          image: {
            url: finalImageUrl,
            mime: gallery[0]?.mime,
            name: gallery[0]?.name,
          },
          gallery,
        };
      }

      const actor = currentCajero
        ? { id: currentCajero.id, nombre: currentCajero.nombre }
        : { id: "local-node", nombre: "Nodo Local" };

      const oferta: MtOffer = {
        id: createId("mt:oferta:"),
        productoId: oProductoId.trim(),
        tipo: oTipo,
        cantidad: cantNum,
        precio: precioNum,
        productor: actor,
        meta,
      };

      const dv = offerToDatoVivo(oferta);
      mtLiveUpsert(dv);

      await withSpore(async (sp) => {
        await sp.sayIntent({
          sym: oTipo === "compra" ? "🧲" : "🛒",
          say: oTipo === "compra" ? "mt.demand.create" : "mt.offer.create",
          with: { offer: oferta, caja: cajaTag },
        });
      });

      try {
        await publishDatoVivo(dv);
      } catch (e) {
        console.warn("[MT web] No se pudo publicar oferta/demanda DatoVivo en seed:", e);
      }

      if (creditEnabled) {
        try {
          await publishCreditPlanFor({
            productId: oProductoId.trim() || null,
            principal: precioNum * cantNum,
          });
          setMsg("Oferta publicada ✅ + plan de crédito ligado al producto ✅");
        } catch (e: any) {
          setMsg(
            `Oferta publicada ✅ pero no se pudo publicar el crédito: ${
              e?.message || "Error"
            }`,
          );
        }
      } else {
        setMsg(`${oTipo === "compra" ? "Demanda" : "Oferta"} publicada ✅`);
      }

      setOImagen("");
      setOImageFiles([]);
      setOImagePreviews([]);
      setOMensaje("");
      setOTags("");
    } catch (e: any) {
      setMsg(e?.message || "Error al publicar oferta");
    } finally {
      setUploadingOfferImage(false);
    }
  };
  const submitProduccion = async () => {
    try {
      setBusy(true);
      setMsg(null);

      if (!dTitle.trim()) throw new Error("Poné un título.");

      const chainId = createId("chain_");
      const threadId = `mt.thread.production:${chainId}`;
      const parentId = createId("demand_");

      const dv: DatoVivo = {
        id: parentId,
        kind: "mt:demand",
        attrs: {
          title: dTitle.trim(),
          description: dDescription.trim(),
          quantity: Number(dQuantity || 1),
          budget: dBudget ? Number(dBudget) : null,
          location: dLocation.trim(),
        },
        traits: ["mt:demand", "mt:production", "mt:market"],
        meta: {
          ns: ns || "mt:market",
          ts: Date.now(),
          threadId,
          chainId,
          caja: cajaTag?.id || null,
          pay: {
            mode: payMode,
            text: payText?.trim() || null,
            currency: payCurrency || "PYG",
            accepted: methods,
          },
        },
      };

      await publishDatoVivo(dv);
      mtLiveUpsert(dv as any);

      const inferredDomain =
        materials.some((m) =>
          String(m.materialKey || "").toLowerCase().includes("madera")
        )
          ? "furniture"
          : materials.some((m) =>
              String(m.materialKey || "").toLowerCase().includes("metal")
            )
          ? "metal"
          : "general";

      const workIntentDV = buildWorkIntentDV({
        id: `work-intent:${Date.now()}`,
        title: dTitle.trim(),
        description: dDescription.trim(),
        domain: inferredDomain as any,
        requestedCapabilities: [
          "fabrication",
          "materials.plan",
          "quote.local",
        ],
        inputs: (materials || [])
          .filter((m) => m.materialKey.trim() || m.materialName.trim())
          .map((m, idx) => ({
            id: m.id || `mat:${idx}`,
            label: m.materialName || m.materialKey || "Material",
            qty: Number(m.quantity || 0),
            unit: m.unit || "u",
          })),
        expectedOutputs: [
          {
            id: "output:delivery",
            label: dTitle.trim() || "Trabajo producido",
            qty: Number(dQuantity || 1),
            unit: "u",
          },
        ],
        constraints: {
          budget: dBudget ? Number(dBudget) : undefined,
          currency: payCurrency || "PYG",
          location: dLocation.trim() || undefined,
        },
        status: "open",
        by: {
          actorId: currentCajero?.id || "local-node",
          actorName: currentCajero?.nombre || "Nodo Local",
        },
        context: {
          worldId: "main",
        },
      });

      const workIntentDVWithMeta = {
        ...workIntentDV,
        meta: {
          ...(workIntentDV.meta || {}),
          ns: ns || "mt:market",
          threadId,
          chainId,
          source: "ms.web.producir",
        },
      };

      await publishDatoVivo(workIntentDVWithMeta as any);
      mtLiveUpsert(workIntentDVWithMeta as any);

      for (const m of materials) {
        if (!m.materialKey.trim() || !m.materialName.trim()) continue;

        const dvMat: DatoVivo = {
          id: createId("dmat_"),
          kind: "mt:demand.material",
          attrs: {
            parentDemandId: parentId,
            materialKey: m.materialKey.trim(),
            materialName: m.materialName.trim(),
            quantity: Number(m.quantity || 1),
            unit: m.unit.trim() || "u",
            notes: m.notes.trim(),
            maxUnitPrice: m.maxUnitPrice ? Number(m.maxUnitPrice) : null,
          },
          traits: ["mt:material", "mt:demand", "mt:market"],
          meta: {
            ns: ns || "mt:market",
            ts: Date.now(),
            threadId: `${threadId}:${m.materialKey.trim()}`,
            chainId,
            parentThreadId: threadId,
          },
        };

        await publishDatoVivo(dvMat);
        mtLiveUpsert(dvMat as any);
      }

      if (currentCajero) {
        await emitPaymentOffer({
          sellerId: currentCajero.id,
          sellerName: currentCajero.nombre,
          currency: payCurrency || "PYG",
          text: `Caja activa para producción: ${dTitle.trim()}`,
          accepted: methods,
          scope: "order",
          orderId: parentId,
          threadId,
          ns: ns || "mt:market",
        });
      }

      await withSpore(async (sp) => {
        await sp.sayIntent({
          sym: "🏗️",
          say: "mt.production.create",
          with: {
            demandId: parentId,
            title: dTitle.trim(),
            chainId,
            threadId,
            caja: cajaTag,
          },
        });
      });

      setMsg("Producción publicada + work.intent + materiales 🔥");

      setDTitle("");
      setDDescription("");
      setDQuantity("1");
      setDBudget("");
      setDLocation("");
      setMaterials([
        {
          id: createId("mat_"),
          materialKey: "madera-pino",
          materialName: "Madera pino",
          quantity: "8",
          unit: "tabla",
          notes: "",
          maxUnitPrice: "",
        },
      ]);
    } catch (e: any) {
      setMsg(e?.message || "Error publicando producción");
    } finally {
      setBusy(false);
    }
  };

  const publishCreditPlan = async () => {
    try {
      if (!creditEnabled) throw new Error("Activá modo financiero crédito o mixto.");
      if (!currentCajero) throw new Error("Elegí un cajero para publicar crédito.");

      if (tab === "producto") {
        const productId = lastPublishedProduct?.id || null;
        const principal = Number(lastPublishedProduct?.precio || pPrecio || 0);

        if (!productId) {
          throw new Error("Primero publicá el producto para ligar el crédito al producto real.");
        }

        await publishCreditPlanFor({ productId, principal });
        setMsg("Plan de crédito del producto publicado ✅");
        return;
      }

      const principal = Number(oPrecio || 0) * Number(oCantidad || 0);
      await publishCreditPlanFor({
        productId: oProductoId.trim() || null,
        principal,
      });

      setMsg("Plan de crédito de la oferta publicado ✅");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo publicar plan de crédito");
    }
  };

  const submitCrearCajero = async () => {
    try {
      setCreating(true);
      setMsg(null);

      const nombre = cajeroNombre.trim();
      if (!nombre) throw new Error("Poné un nombre para el cajero.");

      const created = await createCajero({
        nombre,
        ns: ns || "mt:market",
      } as any);

      setMsg(`Cajero creado ✅ ${created?.nombre ? `(${created.nombre})` : ""}`);
      setCajeroNombre("");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo crear cajero");
    } finally {
      setCreating(false);
    }
  };

  const onPickProductFiles = async (files: File[]) => {
    setPImageFiles(files);
    if (!files.length) {
      setPImagePreviews([]);
      return;
    }
    try {
      const previews = await filesToCompressedPreviews(files);
      setPImagePreviews(previews.map((x) => x.preview));
    } catch (e) {
      console.warn("No se pudieron generar previews de producto", e);
      setPImagePreviews([]);
    }
  };

  const onPickOfferFiles = async (files: File[]) => {
    setOImageFiles(files);
    if (!files.length) {
      setOImagePreviews([]);
      return;
    }
    try {
      const previews = await filesToCompressedPreviews(files);
      setOImagePreviews(previews.map((x) => x.preview));
    } catch (e) {
      console.warn("No se pudieron generar previews de oferta", e);
      setOImagePreviews([]);
    }
  };

  const showPaymentBox = tab === "producto" || tab === "oferta";
  const showCreditBox = showAdvancedPay && (tab === "producto" || tab === "oferta");
  const showArBox = showAdvancedPay && tab === "producto";

  return (
    <Wrap>
      <Hero>
        <HeroTop>
          <HeroTitleBox>
            <HeroTitle>
              <Sparkles size={18} />
              Centro de producción viva
            </HeroTitle>
            <HeroSub>
              Publicá solo lo necesario según sea producto, oferta/demanda o producción.
            </HeroSub>
          </HeroTitleBox>

          <StatusPill ok={!!currentCajero}>
            <CheckCircle2 size={15} />
            {currentCajero
              ? `Cajero activo: ${currentCajero.nombre}`
              : "Listo para publicar"}
          </StatusPill>
        </HeroTop>
      </Hero>

      {msg ? <MsgBox ok={!/error|inválid|no se pudo/i.test(msg)}>{msg}</MsgBox> : null}

      <details style={{ border: "1px solid rgba(15,23,42,.08)", borderRadius: 20, padding: 14, background: "rgba(255,255,255,.72)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Operadores y configuración avanzada</summary>
        <button type="button" onClick={() => setTab("catalogo")} style={{ marginTop: 12, border: "1px solid rgba(15,23,42,.12)", borderRadius: 999, padding: "9px 14px", background: "white", fontWeight: 900 }}>Catálogo masivo</button>
      <Grid2 style={{ marginTop: 14 }}>
        <SectionCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <ShieldCheck size={17} />
                Administrar cajeros
              </SectionTitle>
              <Subtle>Solo si todavía no tenés uno activo.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={8}>
              <Label>Nombre del cajero</Label>
              <Input
                value={cajeroNombre}
                onChange={(e) => setCajeroNombre(e.target.value)}
                placeholder="Caja Barrio Norte / Caja Mueblería"
              />
            </Field>

            <Field span={4}>
              <Label>&nbsp;</Label>
              <SmallBtn onClick={submitCrearCajero} disabled={creating || !cajeroNombre.trim()}>
                <ShieldCheck size={15} />
                {creating ? "Creando..." : "Crear cajero"}
              </SmallBtn>
            </Field>
          </FormGrid>
        </SectionCard>

        <SectionCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Store size={17} />
                Destino técnico
              </SectionTitle>
              <Subtle>
                Define el mundo o contexto semántico en el que vivirá este
                contenido.
              </Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <Label>meta.ns</Label>
          <Input
            value={ns}
            onChange={(e) => setNs(e.target.value)}
            placeholder="mt:market, tienda, miapp:v1, etc."
          />
        </SectionCard>
      </Grid2>
      </details>

      <FullCard>
        <SectionHead>
          <SectionTitleWrap>
            <SectionTitle>
              {tab === "producto" ? (
                <Package2 size={17} />
              ) : tab === "oferta" ? (
                <Megaphone size={17} />
              ) : (
                <Boxes size={17} />
              )}
              Qué querés publicar
            </SectionTitle>
            <Subtle>
              Elegí el tipo. El formulario cambia para mostrar solo lo necesario.
            </Subtle>
          </SectionTitleWrap>
        </SectionHead>

        <Tabs>
          <TabBtn active={tab === "producto"} onClick={() => setTab("producto")}>
            <PlusCircle size={15} />
            Producto
          </TabBtn>
          <TabBtn active={tab === "oferta" && oTipo === "venta"} onClick={() => { setOTipo("venta"); setTab("oferta"); }}>
            <Coins size={15} />
            Oferta
          </TabBtn>
          <TabBtn active={tab === "oferta" && oTipo === "compra"} onClick={() => { setOTipo("compra"); setTab("oferta"); }}>
            <Megaphone size={15} />
            Necesidad
          </TabBtn>

          <TabBtn active={tab === "produccion"} onClick={() => setTab("produccion")}>
            <Boxes size={15} />
            Producción
          </TabBtn>
        </Tabs>
      </FullCard>
      {tab === "catalogo" && (
  <FullCard>
    <SectionHead>
      <SectionTitleWrap>
        <SectionTitle>
          <Store size={17} />
          Catálogo masivo vivo
        </SectionTitle>
        <Subtle>
          Subí muchas fotos de una tienda y se convierten en productos vivos dentro del mercado principal.
        </Subtle>
      </SectionTitleWrap>
    </SectionHead>

    <SoftInfo>
      Ideal para DecoHogar, Madefer u otra tienda. Primero subís las fotos.
      Si tenés un JSON generado por IA, lo pegás abajo para poner nombres,
      descripciones y categorías automáticamente. Si no, se crean como borradores
      vivos para completar después.
    </SoftInfo>

    <FormGrid style={{ marginTop: 14 }}>
      <Field span={3}>
        <Label>ID tienda</Label>
        <Input
          value={catalogStoreId}
          onChange={(e) => setCatalogStoreId(e.target.value)}
          placeholder="decohogar"
        />
      </Field>

      <Field span={3}>
        <Label>Nombre tienda</Label>
        <Input
          value={catalogStoreName}
          onChange={(e) => setCatalogStoreName(e.target.value)}
          placeholder="DecoHogar"
        />
      </Field>

      <Field span={3}>
        <Label>WhatsApp</Label>
        <Input
          value={catalogWhatsapp}
          onChange={(e) => setCatalogWhatsapp(e.target.value)}
          placeholder="595981000000"
        />
      </Field>
      <Field span={3}>
  <Label>&nbsp;</Label>
  <SmallBtn
    type="button"
    ghost
    onClick={actualizarWhatsappCatalogo}
    disabled={busy}
  >
    Actualizar número
  </SmallBtn>
</Field>

      <Field span={3}>
        <Label>Categoría base</Label>
        <Input
          value={catalogCategoria}
          onChange={(e) => setCatalogCategoria(e.target.value)}
          placeholder="hogar"
        />
      </Field>

      <Field span={4}>
        <Label>Precio por defecto</Label>
        <Input
          value={catalogPrecioDefault}
          onChange={(e) => setCatalogPrecioDefault(e.target.value)}
          placeholder="Dejar vacío para consultar"
        />
      </Field>

      <Field span={4}>
        <Label>Stock por defecto</Label>
        <Input
          value={catalogStockDefault}
          onChange={(e) => setCatalogStockDefault(e.target.value)}
          placeholder="1"
        />
      </Field>

      <Field span={4}>
        <Label>Unidad</Label>
        <Input
          value={catalogUnidadDefault}
          onChange={(e) => setCatalogUnidadDefault(e.target.value)}
          placeholder="u"
        />
      </Field>

      <Field span={12}>
        <Label>Subir fotos del catálogo</Label>
        <Input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onPickCatalogFiles(Array.from(e.target.files || []))}
        />
        <MiniNote>
          Podés subir muchas fotos. Se comprimen antes para que no sea pesado.
        </MiniNote>
      </Field>

      {catalogPreviews.length ? (
        <Field span={12}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit,minmax(86px,1fr))",
            }}
          >
            {catalogPreviews.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`catalogo-${i}`}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
            ))}
          </div>
        </Field>
      ) : null}

      <Field span={12}>
        <Label>JSON IA opcional</Label>
        <TextArea
          value={catalogJson}
          onChange={(e) => setCatalogJson(e.target.value)}
          placeholder={`[
  {
    "nombre": "Licuadora Speed 1.5L",
    "descripcion": "Licuadora práctica para jugos, batidos y cocina diaria.",
    "categoria": "electrodomesticos",
    "precio": "",
    "stock": 1,
    "unidad": "u",
    "tags": ["licuadora", "speed", "cocina"]
  }
]`}
          style={{ minHeight: 180 }}
        />
        <MiniNote>
          El producto 1 del JSON corresponde a la foto 1, el producto 2 a la foto 2, y así.
        </MiniNote>
      </Field>
    </FormGrid>

    <PublishBar>
      <PublishCard>
        <SmallBtn onClick={submitCatalogoMasivo} disabled={catalogPublishing || busy}>
          <Sparkles size={15} />
          {catalogPublishing ? "Publicando catálogo..." : "Publicar catálogo vivo"}
        </SmallBtn>
      </PublishCard>
    </PublishBar>
  </FullCard>
)}

      {tab === "produccion" && (
  <FactoryLiveRadar
    ns={ns}
    liveItems={liveItems}
    selfActorId={currentCajero?.id || null}
    onOpenThread={handleOpenFactoryThread}
    onOfferMaterial={handleOfferFactoryMaterial}
  />
)}

      {showPaymentBox && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Wallet size={17} />
                Pago
              </SectionTitle>
              <Subtle>Configuración compacta para cobro.</Subtle>
            </SectionTitleWrap>

            <SmallBtn ghost onClick={() => setShowAdvancedPay((v) => !v)}>
              {showAdvancedPay ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAdvancedPay ? "Ocultar avanzado" : "Mostrar avanzado"}
            </SmallBtn>
          </SectionHead>

          <FormGrid>
            <Field span={4}>
              <Label>Modo</Label>
              <Select value={payMode} onChange={(e) => setPayMode(e.target.value as PayMode)}>
                <option value="cajero">Cajero</option>
                <option value="hybrid">Híbrido</option>
                <option value="direct">Directo</option>
              </Select>
            </Field>

            <Field span={4}>
              <Label>Moneda</Label>
              <Input
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
                placeholder="PYG"
              />
            </Field>

            <Field span={4}>
              <Label>Texto</Label>
              <Input
                value={payText}
                onChange={(e) => setPayText(e.target.value)}
                placeholder="Acepto transferencia, QR o efectivo"
              />
            </Field>
          </FormGrid>

          {showAdvancedPay && (
            <>
              <Row style={{ marginTop: 12 }}>
                <SmallBtn ghost onClick={addMethod}>
                  <PlusCircle size={14} />
                  Agregar método
                </SmallBtn>
              </Row>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {methods.map((m, i) => (
                  <MethodRow key={i}>
                    <div>
                      <Label>Canal</Label>
                      <Select
                        value={String((m as any).channel || "any")}
                        onChange={(e) => setMethodField(i, { channel: e.target.value as any })}
                      >
                        <option value="transfer">Transferencia</option>
                        <option value="qr">QR</option>
                        <option value="cash">Efectivo</option>
                        <option value="link">Link</option>
                        <option value="crypto">Crypto</option>
                        <option value="any">Otro</option>
                      </Select>
                    </div>

                    <div>
                      <Label>Label</Label>
                      <Input
                        value={String((m as any).label || "")}
                        onChange={(e) => setMethodField(i, { label: e.target.value })}
                        placeholder="Ueno Alias / QR / Link"
                      />
                    </div>

                    <div>
                      <Label>Dato</Label>
                      <Input
                        value={methodValue(m)}
                        onChange={(e) =>
                          setMethodField(i, applyMethodValue(m, e.target.value))
                        }
                        placeholder="Alias, URL, QR, wallet"
                        disabled={String((m as any).channel) === "cash"}
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <SmallBtn ghost onClick={() => removeMethod(i)}>
                        Quitar
                      </SmallBtn>
                    </div>
                  </MethodRow>
                ))}
              </div>

              <FormGrid style={{ marginTop: 12 }}>
                <Field span={4}>
                  <Label>Negociación</Label>
                  <Select
                    value={String(negotiate)}
                    onChange={(e) => setNegotiate(e.target.value === "true")}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </Select>
                </Field>

                <Field span={4}>
                  <Label>Escrow</Label>
                  <Select
                    value={escrowMode}
                    onChange={(e) => setEscrowMode(e.target.value as EscrowMode)}
                  >
                    <option value="none">Ninguno</option>
                    <option value="delivery">Por entrega</option>
                    <option value="multisig">Multisig</option>
                  </Select>
                </Field>

                <Field span={4}>
                  <Label>Recipient</Label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="wallet / alias / cuenta"
                  />
                </Field>
              </FormGrid>
            </>
          )}
        </FullCard>
      )}

      {showCreditBox && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Landmark size={17} />
                Crédito / financiamiento
              </SectionTitle>
              <Subtle>Solo si realmente querés ofrecer crédito.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={3}>
              <Label>Modo financiero</Label>
              <Select
                value={financeMode}
                onChange={(e) => setFinanceMode(e.target.value as FinanceMode)}
              >
                <option value="cash">Contado</option>
                <option value="credit">Crédito</option>
                <option value="subscription">Suscripción</option>
                <option value="mixed">Mixto</option>
              </Select>
            </Field>

            <Field span={3}>
              <Label>Entrega mínima</Label>
              <Input
                value={creditDownPaymentMin}
                onChange={(e) => setCreditDownPaymentMin(e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field span={2}>
              <Label>Cuotas</Label>
              <Input
                value={creditInstallmentCount}
                onChange={(e) => setCreditInstallmentCount(e.target.value)}
                placeholder="3"
              />
            </Field>

            <Field span={2}>
              <Label>Intervalo</Label>
              <Select
                value={creditInterval}
                onChange={(e) => setCreditInterval(e.target.value as CreditInterval)}
              >
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </Select>
            </Field>

            <Field span={2}>
              <Label>Cada</Label>
              <Input
                value={creditEvery}
                onChange={(e) => setCreditEvery(e.target.value)}
                placeholder="1"
              />
            </Field>

            <Field span={12}>
              <Label>Nota</Label>
              <TextArea
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Condiciones, observaciones..."
              />
            </Field>
          </FormGrid>

          <Row style={{ marginTop: 10 }}>
            <SmallBtn onClick={publishCreditPlan} disabled={!creditEnabled}>
              <Landmark size={15} />
              Publicar plan de crédito
            </SmallBtn>
          </Row>
        </FullCard>
      )}

      {showArBox && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>AR / Modelo 3D</SectionTitle>
              <Subtle>Opcional para producto.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={4}>
              <Label>AR URL</Label>
              <Input
                value={arUrl}
                onChange={(e) => setArUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            <Field span={4}>
              <Label>Model URL</Label>
              <Input
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="https://.../model.glb"
              />
            </Field>

            <Field span={2}>
              <Label>Formato</Label>
              <Select
                value={modelFormat}
                onChange={(e) =>
                  setModelFormat(e.target.value as "glb" | "usdz" | "obj" | "gltf")
                }
              >
                <option value="glb">glb</option>
                <option value="usdz">usdz</option>
                <option value="obj">obj</option>
                <option value="gltf">gltf</option>
              </Select>
            </Field>

            <Field span={1}>
              <Label>Scale</Label>
              <Input
                value={modelScale}
                onChange={(e) => setModelScale(e.target.value)}
              />
            </Field>

            <Field span={1}>
              <Label>Place</Label>
              <Select
                value={modelPlacement}
                onChange={(e) => setModelPlacement(e.target.value as "floor" | "wall" | "auto")}
              >
                <option value="floor">floor</option>
                <option value="wall">wall</option>
                <option value="auto">auto</option>
              </Select>
            </Field>
          </FormGrid>
        </FullCard>
      )}

      {tab === "producto" && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Package2 size={17} />
                Producto vivo
              </SectionTitle>
              <Subtle>Solo los campos esenciales.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={6}>
              <Label>Nombre</Label>
              <Input
                value={pNombre}
                onChange={(e) => setPNombre(e.target.value)}
                placeholder="Mesa tropical viva"
              />
            </Field>

            <Field span={2}>
              <Label>Unidad</Label>
              <Input
                value={pUnidad}
                onChange={(e) => setPUnidad(e.target.value)}
                placeholder="u"
              />
            </Field>

            <Field span={2}>
              <Label>Precio</Label>
              <Input
                value={pPrecio}
                onChange={(e) => setPPrecio(e.target.value)}
                placeholder="2500000"
              />
            </Field>

            <Field span={2}>
              <Label>Stock</Label>
              <Input
                value={pStock}
                onChange={(e) => setPStock(e.target.value)}
                placeholder="3"
              />
            </Field>

            <Field span={6}>
              <Label>Categoría</Label>
              <Input
                value={pCategoria}
                onChange={(e) => setPCategoria(e.target.value)}
                placeholder="muebles"
              />
            </Field>

            <Field span={6}>
              <Label>Tags</Label>
              <Input
                value={pTags}
                onChange={(e) => setPTags(e.target.value)}
                placeholder="madera, tropical"
              />
            </Field>

            <Field span={6}>
              <Label>URL imagen</Label>
              <Input
                value={pImagen}
                onChange={(e) => setPImagen(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            <Field span={6}>
              <Label>Subir imágenes</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => onPickProductFiles(Array.from(e.target.files || []))}
              />
            </Field>

            {pImagePreviews.length ? (
              <Field span={12}>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))",
                  }}
                >
                  {pImagePreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`preview-producto-${i}`}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    />
                  ))}
                </div>
              </Field>
            ) : null}
          </FormGrid>

          <PublishBar>
            <PublishCard>
              <SmallBtn onClick={submitProducto} disabled={uploadingImage || busy}>
                <Sparkles size={15} />
                {uploadingImage ? "Subiendo..." : "Publicar producto"}
              </SmallBtn>
            </PublishCard>
          </PublishBar>
        </FullCard>
      )}

      {tab === "oferta" && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Megaphone size={17} />
                Oferta / Demanda
              </SectionTitle>
              <Subtle>Solo lo necesario para publicar rápido.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={3}>
              <Label>Tipo</Label>
              <Select
                value={oTipo}
                onChange={(e) => setOTipo(e.target.value as "venta" | "compra")}
              >
                <option value="venta">venta</option>
                <option value="compra">compra</option>
              </Select>
            </Field>

            <Field span={3}>
              <Label>Producto / material ID</Label>
              <Input
                value={oProductoId}
                onChange={(e) => setOProductoId(e.target.value)}
                placeholder={lastPublishedProduct?.id || "mt:producto:..."}
              />
              {lastPublishedProduct ? (
                <MiniNote>
                  Último producto: <code>{lastPublishedProduct.id}</code>
                </MiniNote>
              ) : null}
            </Field>

            <Field span={3}>
              <Label>Cantidad</Label>
              <Input
                value={oCantidad}
                onChange={(e) => setOCantidad(e.target.value)}
                placeholder="1"
              />
            </Field>

            <Field span={3}>
              <Label>Precio</Label>
              <Input
                value={oPrecio}
                onChange={(e) => setOPrecio(e.target.value)}
                placeholder="2500000"
              />
            </Field>

            <Field span={4}>
              <Label>Categoría</Label>
              <Input
                value={oCategoria}
                onChange={(e) => setOCategoria(e.target.value)}
                placeholder="material"
              />
            </Field>

            <Field span={8}>
              <Label>Mensaje</Label>
              <TextArea
                value={oMensaje}
                onChange={(e) => setOMensaje(e.target.value)}
                placeholder="Busco / ofrezco..."
              />
            </Field>

            <Field span={6}>
              <Label>URL imagen</Label>
              <Input
                value={oImagen}
                onChange={(e) => setOImagen(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            <Field span={6}>
              <Label>Subir imágenes</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => onPickOfferFiles(Array.from(e.target.files || []))}
              />
            </Field>

            {oImagePreviews.length ? (
              <Field span={12}>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))",
                  }}
                >
                  {oImagePreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`preview-oferta-${i}`}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    />
                  ))}
                </div>
              </Field>
            ) : null}
          </FormGrid>

          <PublishBar>
            <PublishCard>
              <SmallBtn onClick={submitOferta} disabled={uploadingOfferImage || busy}>
                <Sparkles size={15} />
                {uploadingOfferImage
                  ? "Subiendo..."
                  : oTipo === "compra"
                    ? "Publicar demanda"
                    : "Publicar oferta"}
              </SmallBtn>
            </PublishCard>
          </PublishBar>
        </FullCard>
      )}

      {tab === "produccion" && (
        <FullCard>
          <SectionHead>
            <SectionTitleWrap>
              <SectionTitle>
                <Boxes size={17} />
                Producción + materiales
              </SectionTitle>
              <Subtle>Solo los datos clave y la lista de materiales.</Subtle>
            </SectionTitleWrap>
          </SectionHead>

          <FormGrid>
            <Field span={6}>
              <Label>Título</Label>
              <Input
                value={dTitle}
                onChange={(e) => setDTitle(e.target.value)}
                placeholder="Mesa personalizada 2.40 x 1.10"
              />
            </Field>

            <Field span={2}>
              <Label>Cantidad</Label>
              <Input
                value={dQuantity}
                onChange={(e) => setDQuantity(e.target.value)}
                placeholder="1"
              />
            </Field>

            <Field span={2}>
              <Label>Presupuesto</Label>
              <Input
                value={dBudget}
                onChange={(e) => setDBudget(e.target.value)}
                placeholder="3500000"
              />
            </Field>

            <Field span={2}>
              <Label>Ubicación</Label>
              <Input
                value={dLocation}
                onChange={(e) => setDLocation(e.target.value)}
                placeholder="Salto del Guairá"
              />
            </Field>

            <Field span={12}>
              <Label>Descripción</Label>
              <TextArea
                value={dDescription}
                onChange={(e) => setDDescription(e.target.value)}
                placeholder="Qué querés producir..."
              />
            </Field>
          </FormGrid>

          <SectionHead style={{ marginTop: 16 }}>
            <SectionTitleWrap>
              <SectionTitle>Materiales</SectionTitle>
              <Subtle>Uno por fila.</Subtle>
            </SectionTitleWrap>
            <SmallBtn ghost onClick={addMaterialRow}>
              <PlusCircle size={14} />
              Agregar material
            </SmallBtn>
          </SectionHead>

          <div style={{ display: "grid", gap: 12 }}>
            {materials.map((m) => (
              <SectionCard key={m.id} style={{ padding: 12 }}>
                <FormGrid>
                  <Field span={3}>
                    <Label>materialKey</Label>
                    <Input
                      value={m.materialKey}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { materialKey: e.target.value })
                      }
                      placeholder="madera-pino"
                    />
                  </Field>

                  <Field span={3}>
                    <Label>Nombre</Label>
                    <Input
                      value={m.materialName}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { materialName: e.target.value })
                      }
                      placeholder="Madera pino"
                    />
                  </Field>

                  <Field span={2}>
                    <Label>Cantidad</Label>
                    <Input
                      value={m.quantity}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { quantity: e.target.value })
                      }
                      placeholder="8"
                    />
                  </Field>

                  <Field span={2}>
                    <Label>Unidad</Label>
                    <Input
                      value={m.unit}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { unit: e.target.value })
                      }
                      placeholder="tabla"
                    />
                  </Field>

                  <Field span={2}>
                    <Label>Max precio</Label>
                    <Input
                      value={m.maxUnitPrice}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { maxUnitPrice: e.target.value })
                      }
                      placeholder="0"
                    />
                  </Field>

                  <Field span={10}>
                    <Label>Notas</Label>
                    <Input
                      value={m.notes}
                      onChange={(e) =>
                        updateMaterialRow(m.id, { notes: e.target.value })
                      }
                      placeholder="Observaciones"
                    />
                  </Field>

                  <Field span={2}>
                    <Label>&nbsp;</Label>
                    <SmallBtn ghost onClick={() => removeMaterialRow(m.id)}>
                      Quitar
                    </SmallBtn>
                  </Field>
                </FormGrid>
              </SectionCard>
            ))}
          </div>

          <PublishBar>
            <PublishCard>
              <SmallBtn onClick={submitProduccion} disabled={busy}>
                <Sparkles size={15} />
                {busy ? "Publicando..." : "Publicar producción"}
              </SmallBtn>
            </PublishCard>
          </PublishBar>
        </FullCard>
      )}
    </Wrap>
  );
}
import { compressImageFile } from '../media/imageCompression';
