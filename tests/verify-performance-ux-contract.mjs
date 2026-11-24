import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const map = await read("src/pages/circularpanel.jsx");
assert.match(map, /projectMapEntities/);
assert.match(map, /MAX_RENDERED_MARKERS\s*=\s*160/);
assert.match(map, /getBounds\(\)\.pad\(0\.18\)/);
assert.match(map, /},\s*140\);/);
assert.match(map, /collectHumanLiveActivity\(visibleNetwork, actorId, 24\)/);
assert.match(map, /setDeferredQuery\(query\), 160/);
assert.match(map, /clusterMapPoints/);
assert.match(map, /Más filtros del mapa/);

const media = await read("src/mt/livePresentation.ts");
assert.match(media, /manifestIndexByLive\s*=\s*new WeakMap/);
assert.match(media, /sellerCacheByLive\s*=\s*new WeakMap/);
assert.match(media, /imageCacheByLive\s*=\s*new WeakMap/);

const search = await read("src/components/LiveSearchOverlay.tsx");
assert.match(search, /searchIndex/);
assert.match(search, /setDeferredQuery\(query\), 160/);

const valuePanel = await read("src/vault/BovedaVivaPanel.tsx");
assert.match(valuePanel, /projectLiquidityNetworkCached/);
assert.match(valuePanel, /Tu red empieza acá/);
assert.doesNotMatch(valuePanel, /Trust\s*50%|Issue|Transfer in|Transfer out|Credit line 0/);

const market = await read("src/pages/mercado.tsx");
assert.match(market, /lazy\(\(\) => import\("\.\/checkoutmodal"\)\)/);
assert.match(market, /lazy\(\(\) => import\("\.\/circularcenter"\)\)/);

const card = await read("src/components/LiveProductCard.tsx");
assert.match(card, /contentVisibility:\s*"auto"/);
assert.match(card, /loading=\{priority \? "eager" : "lazy"\}/);
assert.match(card, /previousPrice/);

const merchandisingSource = await read("src/mt/productMerchandising.ts");
const transformed = await transformWithEsbuild(merchandisingSource, "productMerchandising.ts", {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const merchandising = await import(
  `data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`
);
const discounted = merchandising.readPublishedMerchandising({
  price: 1_250_000,
  pricing: { basePrice: 1_500_000, discountAmount: 250_000 },
  finance: { publicMaxInstallments: 12, installmentValue: 130_000 },
});
assert.equal(discounted.basePrice, 1_500_000);
assert.equal(discounted.discountPct, 17);
assert.equal(discounted.installmentCount, 12);

const plain = merchandising.readPublishedMerchandising({ price: 1_250_000 });
assert.equal(plain.basePrice, null);
assert.equal(plain.discountPct, null);

const shell = await read("src/components/FalconShell.tsx");
assert.match(shell, /<FalconDock\s*\/>/);

console.log("✓ contrato performance + UX quirúrgica verificado");
