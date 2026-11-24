  // Compatibilidad temporal con imports viejos.
  // Ya no existe un cargador especial para LaPiedra: todos los nodos usan el
  // mismo descubridor universal de fuentes.

  import { startLiveCatalogSources } from "./liveCatalog.sources";
  export const LAPIEDRA_IDENTITY = Object.freeze({
    storeId: "lapiedra-coffee",
    sellerId: "lapiedra-coffee",
    storeName: "LaPiedra Coffee",
    nodeId: "utopy.node.lapiedra.coffee",
    originNode: "utopy.node.lapiedra.coffee",
    authority: "lapiedra-coffee",
  });
  /** @deprecated Usar startLiveCatalogSources o bootLiveSymbiosis. */
  export function startLaPiedraLiveCatalog(): () => void {
    return startLiveCatalogSources();
  }
