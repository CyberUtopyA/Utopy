import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");

const config = JSON.parse(await read("public/utopy-bootstrap-nodes.json"));
const deco = config.sources.find((source) => source.id === "decohogar");
const piedra = config.sources.find((source) => source.id === "lapiedra-coffee");
assert.deepEqual(deco?.falconSurfaces, ["falcon.store"]);
assert.deepEqual(piedra?.falconSurfaces, ["falcon.daily"]);

const payloadItems = (payload) =>
  Array.isArray(payload)
    ? payload
    : payload?.items || payload?.dvs || payload?.products || [];
const catalogs = {};
for (const source of [deco, piedra]) {
  const response = await fetch(source.catalogUrl);
  assert.equal(response.ok, true, `${source.id} debe responder`);
  catalogs[source.id] = payloadItems(await response.json()).filter(
    (dv) =>
      /product|producto/i.test(String(dv?.kind || "")) ||
      (dv?.traits || []).some((trait) =>
        ["mt:producto", "mt:product", "mt:market.product"].includes(String(trait)),
      ),
  );
  assert.ok(catalogs[source.id].length > 0, `${source.id} necesita productos`);
  assert.ok(
    catalogs[source.id].every((dv) => dv?.meta?.ns === "mt:market"),
    `${source.id} debe publicar productos de mercado`,
  );
}

const humanBlob = (dv) =>
  [
    dv?.attrs?.nombre,
    dv?.attrs?.name,
    dv?.attrs?.title,
    dv?.attrs?.descripcion,
    dv?.attrs?.description,
    dv?.attrs?.categoria,
    dv?.attrs?.category,
    ...(dv?.labels || []),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

assert.ok(catalogs.decohogar.some((dv) => humanBlob(dv).includes("mesa")));
assert.equal(catalogs["lapiedra-coffee"].some((dv) => humanBlob(dv).includes("mesa")), false);
assert.ok(catalogs["lapiedra-coffee"].some((dv) => humanBlob(dv).includes("frappe")));
assert.ok(catalogs["lapiedra-coffee"].some((dv) => humanBlob(dv).includes("leche")));

const mediaFields = (dv) => {
  const attrs = dv?.attrs || {};
  const raw =
    attrs.image ||
    attrs.imagen ||
    attrs.imageUrl ||
    attrs.image_url ||
    attrs.gallery?.[0] ||
    attrs.images?.[0] ||
    dv?.image ||
    dv?.imagen ||
    dv?.gallery?.[0] ||
    dv?.images?.[0] ||
    "";
  return typeof raw === "string" ? raw : raw?.url || raw?.src || "";
};
const products = [...catalogs.decohogar, ...catalogs["lapiedra-coffee"]];
const relativeImages = products.filter((dv) => {
  const image = mediaFields(dv);
  return image && !/^(https?:|data:|blob:)/i.test(image);
}).length;
const missingImages = products.filter((dv) => !mediaFields(dv)).length;

const app = await read("src/App.jsx");
const bootstrapSource = await read("src/utopy/bootstrapNodeSources.ts");
const daily = await read("src/pages/falcondaily.tsx");
const store = await read("src/falcon/falconstore.tsx");
const storefront = await read("src/falcon/usefalconstorefront.ts");
const media = await read("src/mt/livePresentation.ts");
const search = await read("src/components/LiveSearchOverlay.tsx");
const map = await read("src/pages/circularpanel.jsx");
assert.match(app, /pages\/falcondaily/);
assert.match(bootstrapSource, /entry\.storeId \|\| entry\.nodeId/);
assert.doesNotMatch(daily, /La capa viva de abastecimiento territorial/);
assert.match(daily, /FalconProductCard/);
assert.match(store, /FalconProductCard/);
assert.doesNotMatch(storefront, /isVerifiedLiveCatalogItem/);
assert.match(media, /sourceCatalogUrl/);
assert.match(search, /onSearchNetwork/);
assert.doesNotMatch(map, /className="score">\{match\.score\}%/);
assert.match(map, /catalog\\\.source\|manifest\|falcon\\\.selection/);

const protocolSource = await read("src/mt/mt.threadProtocol.ts");
const transformed = await transformWithEsbuild(protocolSource, "mt.threadProtocol.ts", {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const protocol = await import(
  `data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`
);
const threadId = "mt.thread.circular:test:leche";
const signal = protocol.buildLinkedWorkIntentDV({
  text: "Necesito leche cada semana",
  actorId: "buyer:test",
  actorName: "Vos",
  threadId,
  title: "Necesito leche cada semana",
});
const proposal = {
  id: "match.proposal:test:leche",
  kind: "match.proposal",
  attrs: { parentDvId: signal.id },
  meta: {},
};
const response = protocol.buildThreadActionDV({
  kind: "trade.message",
  threadId: protocol.resolveDvThreadId(proposal, [signal, proposal]),
  chainId: signal.attrs.chainId,
  rootDvId: signal.attrs.rootDvId,
  parentDvId: proposal.id,
  responseToId: proposal.id,
  text: "Puedo proveerte leche mañana",
  fromActorId: "node:provider",
  fromActorName: "Proveedor local",
  toActorId: "buyer:test",
  participants: ["buyer:test", "node:provider"],
});
assert.equal(protocol.resolveDvThreadId(signal), threadId);
assert.equal(protocol.resolveDvThreadId(proposal, [signal, proposal]), threadId);
assert.equal(protocol.resolveDvThreadId(response), threadId);
assert.equal(response.attrs.chainId, signal.attrs.chainId);
assert.equal(response.attrs.parentDvId, proposal.id);

console.log(
  JSON.stringify(
    {
      storeProducts: catalogs.decohogar.length,
      dailyProducts: catalogs["lapiedra-coffee"].length,
      relativeImages,
      missingImages,
      milkMatches: catalogs["lapiedra-coffee"].filter((dv) => humanBlob(dv).includes("leche")).length,
      threadIdPreserved: protocol.resolveDvThreadId(response) === threadId,
    },
    null,
    2,
  ),
);
