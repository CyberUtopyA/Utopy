import { create } from "zustand";

type CartItem = {
  id: string;                 // SIEMPRE string
  nombre: string;
  token?: {
    address: `0x${string}`;
    decimals: number;
    symbol?: string;
  } | null;
  imagen?: string;
  unidad?: string;

  price: number;              // unit price
  qty: number;                // cantidad

  meta?: {
    ns?: string;
    token?: {
      address: `0x${string}`;
      decimals: number;
      symbol?: string;
    } | null;
    [k: string]: any;
  };
};

type CartState = {
  cart: CartItem[];

  addToCart: (item: Partial<CartItem> & { id: any; nombre: string }) => void;
  removeFromCart: (id: any, opts?: { ns?: string; tokenAddr?: string | null }) => void;
  setQty: (id: any, qty: number, opts?: { ns?: string; tokenAddr?: string | null }) => void;
  clearCart: () => void;
};

const keyOf = (it: { id: any; meta?: any }) => {
  const id = String(it.id);
  const ns = String(it?.meta?.ns || "");
  const tokenAddr = String(it?.meta?.token?.address || "");
  return `${id}::${ns}::${tokenAddr}`;
};

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],

  addToCart: (raw) => {
    const incoming: CartItem = {
      id: String(raw.id),
      nombre: String(raw.nombre ?? "Producto"),
      imagen: raw.imagen,
      unidad: raw.unidad ?? "u",
      price: Number(raw.price ?? 0) || 0,
      qty: Math.max(1, Number(raw.qty ?? 1) || 1),
      meta: raw.meta || {},
    };

    const k = keyOf(incoming);

    set((s) => {
      const idx = s.cart.findIndex((x) => keyOf(x) === k);

      // ✅ si ya existe → sumar qty
      if (idx >= 0) {
        const prev = s.cart[idx];
        const next = [...s.cart];
        next[idx] = { ...prev, qty: Math.max(1, (prev.qty || 1) + incoming.qty) };
        return { cart: next };
      }

      // ✅ si no existe → agregar
      return { cart: [...s.cart, incoming] };
    });
  },

  removeFromCart: (id, opts) => {
    const rid = String(id);
    const rns = String(opts?.ns || "");
    const rtoken = String(opts?.tokenAddr || "");

    set((s) => ({
      cart: s.cart.filter((x) => {
        const xid = String(x.id);
        const xns = String(x?.meta?.ns || "");
        const xtoken = String(x?.meta?.token?.address || "");
        // si pasan opts, hacemos match exacto; si no, borramos por id (todas las variantes)
        if (opts) return !(xid === rid && xns === rns && xtoken === rtoken);
        return xid !== rid;
      }),
    }));
  },

  setQty: (id, qty, opts) => {
    const rid = String(id);
    const rns = String(opts?.ns || "");
    const rtoken = String(opts?.tokenAddr || "");
    const q = Math.max(1, Number(qty) || 1);

    set((s) => ({
      cart: s.cart.map((x) => {
        const xid = String(x.id);
        const xns = String(x?.meta?.ns || "");
        const xtoken = String(x?.meta?.token?.address || "");
        const match = opts ? xid === rid && xns === rns && xtoken === rtoken : xid === rid;
        return match ? { ...x, qty: q } : x;
      }),
    }));
  },

  clearCart: () => set({ cart: [] }),
}));
