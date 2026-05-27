// src/lib/marketBsc.ts
import { parseEther, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

// ✅ Importa TU ABI generado/verificado
//   Asegúrate de tener "resolveJsonModule": true en tsconfig.json
import MARKET_ABI from "./abi.json";
// ✅ ABI ERC20 mínimo (o importa el tuyo si ya lo tienes en otra ruta)
import { ERC20_ABI } from "./erc20";

// ✅ Dirección del contrato en BSC mainnet
export const MARKET_ADDRESS = "0x52f5249dcc20e38c4e3abd81059d0b641548515c" as const;
export const BSC_MAINNET_CHAIN_ID = 56;

// Tipos convenientes (ajusta si tu ABI difiere)
export type ProductOnChain = {
  seller: `0x${string}`;
  token: `0x${string}`;      // address(0) si es nativo
  pricePerUnit: bigint;      // smallest units (wei si nativo; 6 dec si USDC)
  stock: bigint;
  active: boolean;
  name: string;
};

export type Quote = {
  gross: bigint;
  fee: bigint;
  net: bigint;
  token: `0x${string}`;
};

/**
 * Hook de acciones/lecturas para tu Marketplace en BSC mainnet
 */
export function useMarketBsc() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // ---- VALIDACIÓN DE RED ----
  function assertBsc() {
    if (!isConnected) throw new Error("Conectá tu wallet.");
    if (chainId !== BSC_MAINNET_CHAIN_ID) {
      throw new Error("Cambia a BNB Smart Chain (BSC mainnet).");
    }
  }

  // ───────────── Lecturas ─────────────
  // products(productId) -> ProductOnChain
  function useProduct(productId: bigint) {
    return useReadContract({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "products",
      args: [productId],
    }) as unknown as { data?: ProductOnChain; isLoading: boolean; refetch: () => void };
  }

  // quote(productId, qty) -> { gross, fee, net, token }
  function useQuote(productId: bigint, qty: bigint) {
    return useReadContract({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "quote",
      args: [productId, qty],
    }) as unknown as { data?: Quote; isLoading: boolean; refetch: () => void };
  }

  // ───────────── Escrituras de admin/vendedor ─────────────
  async function createProduct(opts: {
    seller: `0x${string}`;
    token: `0x${string}`;               // 0x000...000 => nativo
    pricePerUnit: bigint;               // smallest units (wei si nativo; 6 dec si USDC)
    stock: bigint;
    name: string;
  }) {
    assertBsc();
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "createProduct",
      args: [opts.seller, opts.token, opts.pricePerUnit, opts.stock, opts.name],
    });
  }

  async function updateProduct(opts: {
    productId: bigint;
    token: `0x${string}`;
    pricePerUnit: bigint;
    stock: bigint;
    active: boolean;
    name: string;
  }) {
    assertBsc();
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "updateProduct",
      args: [opts.productId, opts.token, opts.pricePerUnit, opts.stock, opts.active, opts.name],
    });
  }

  async function setProductActive(productId: bigint, active: boolean) {
    assertBsc();
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "setProductActive",
      args: [productId, active],
    });
  }

  async function addStock(productId: bigint, delta: bigint) {
    assertBsc();
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "addStock",
      args: [productId, delta],
    });
  }

  async function reduceStock(productId: bigint, delta: bigint) {
    assertBsc();
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "reduceStock",
      args: [productId, delta],
    });
  }

  // ───────────── Compras ─────────────

  /** Compra en token nativo (BNB) – product.token == address(0) en tu contrato */
  async function buyNative(productId: bigint, qty: bigint, pricePerUnitWei: bigint) {
    assertBsc();
    const total = pricePerUnitWei * qty;
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "buy",
      args: [productId, qty],
      value: total,
    });
  }

  /**
   * Compra en ERC-20 (ej. USDT/USDC) – product.token != address(0)
   * - decimals: decimales del token (6 para USDC, 18 para la mayoría)
   * - unitPrice: string humano ("2.5") o bigint ya en smallest units
   *   (si ya tienes el unitPrice exacto on-chain, pásalo como bigint).
   */
  async function buyErc20(opts: {
    productId: bigint;
    qty: bigint;
    tokenAddress: `0x${string}`;
    decimals: number;
    unitPrice: string | bigint;
    spenderOverride?: `0x${string}`; // por si el market se envuelve por un proxy
  }) {
    assertBsc();

    const perUnit =
      typeof opts.unitPrice === "string"
        ? parseUnits(opts.unitPrice, opts.decimals)
        : opts.unitPrice;

    const total = perUnit * opts.qty;
    const spender = opts.spenderOverride ?? MARKET_ADDRESS;

    // 1) approve total al market
    await writeContractAsync({
      address: opts.tokenAddress,
      abi: ERC20_ABI as any,
      functionName: "approve",
      args: [spender, total],
    });

    // 2) buy(productId, qty)
    return writeContractAsync({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI as any,
      functionName: "buy",
      args: [opts.productId, opts.qty],
    });
  }

  // ───────────── Utils ─────────────
  function toWei(bnbAsString: string) {
    return parseEther(bnbAsString); // "0.01" -> 10000000000000000n
  }
  function toTokenUnits(amount: string, decimals: number) {
    return parseUnits(amount, decimals); // "2.5", 6 -> 2500000n
  }

  return {
    // estado de cuenta/red
    isConnected,
    address,
    chainId,

    // lecturas
    useProduct,
    useQuote,

    // admin/vendedor
    createProduct,
    updateProduct,
    setProductActive,
    addStock,
    reduceStock,

    // compras
    buyNative,
    buyErc20,

    // utils
    toWei,
    toTokenUnits,
  };
}
