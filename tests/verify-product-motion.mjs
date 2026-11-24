import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, transformWithEsbuild } from 'vite';
import { isPublicShellAsset, selectShellAssets } from '../src/utils/publicAssetPolicy.js';

for (const path of ['index.html', '/assets/mercado-AbCd1234.js', 'icons/icon-192.png']) assert.equal(isPublicShellAsset(path), true, path);
for (const path of ['media/proof.png', 'api/orders.json', 'cataloglive.php', 'assets/unversioned.js', 'icons/../private.png', 'icons/icon.png?token=secret', 'https://other.test/icons/logo.png', 'public/identity.json']) assert.equal(isPublicShellAsset(path), false, path);
const entries = [{url:'index.html'}, {url:'assets/checkoutmodal-AbCd1234.js'}, {url:'media/payment.png'}, {url:'assets/mercado-AbCd1234.js'}];
assert.deepEqual(selectShellAssets(entries, /checkoutmodal/).map(e=>e.url), ['index.html','assets/mercado-AbCd1234.js']);
assert.equal(selectShellAssets(entries, /checkoutmodal/, 1).length, 1);

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
for (const path of ['src/components/productMotion.ts', 'src/components/UnifiedLivingMarket.tsx', 'src/components/LiveProductCard.tsx', 'src/components/UniversalProductDialog.tsx', 'src/pages/checkoutmodal.tsx']) {
  await transformWithEsbuild(await read(path), path, {loader: path.endsWith('.tsx') ? 'tsx' : 'ts'});
}
const navigation = await read('src/components/UnifiedLivingMarket.tsx');
const nav = navigation.slice(navigation.indexOf('<nav className="ulm-quick-nav"'), navigation.indexOf('</nav>') + 6);
assert.doesNotMatch(nav, /<img|<small|<b>Store|<b>Daily|Selección viva|Condiciones vigentes/);
for (const context of ['store','daily','skylines','capital']) assert.ok(nav.includes(`openContext("${context}")`));
for (const label of ['Tiendas','Ofertas','Alquileres','Para hoy','Oportunidades']) assert.ok(nav.includes(label));
assert.ok(nav.includes('props.onOffers()'));
assert.match(navigation, /props.onContext\(context\)/);
const checkout = await read('src/pages/checkoutmodal.tsx');
assert.match(checkout, /if \(confirmingRef.current\) return/);
assert.match(checkout, /confirmingRef.current = true/);
assert.match(checkout, /finally \{\s*confirmingRef.current = false;\s*setBusy\(false\)/);
assert.match(checkout, /<ReviewFields disabled=\{busy\}>/);
assert.match(checkout, /!navigator.onLine/);
assert.match(checkout, /orderId: attrs.orderId \|\| submittedOrder.id/);

// Actual deterministic projection: no real business, inventory, money or network.
const vite = await createServer({configFile:false, server:{middlewareMode:true}, appType:'custom', logLevel:'silent'});
try {
  const motion = await vite.ssrLoadModule('/src/components/productMotion.ts');
  let inspected = 0;
  const source = {querySelector:()=>null, getBoundingClientRect:()=>({x:1,y:2,width:80,height:80})};
  motion.inspectWithMotion(source, () => inspected++);
  motion.inspectWithMotion(source, () => inspected++);
  assert.equal(inspected, 2, 'motion must not swallow or duplicate navigation actions');
  const {projectCheckoutPurchaseCycle: project} = await vite.ssrLoadModule('/src/mt/mt.checkoutPurchaseCycle.ts');
  const now = Date.now();
  const order = {id:'simulation:motion-order', kind:'market.order.create', attrs:{orderId:'simulation:motion-order',threadId:'simulation:thread',chainId:'simulation:chain',buyerActorId:'actor:simulation',sellerNodeId:'node:simulation',targetNodeId:'node:simulation',total:100,currency:'PYG',simulation:true,nonTradable:true},meta:{ts:new Date(now-1000).toISOString()}};
  const event = (kind, attrs={}) => ({id:`simulation:${kind}`,kind,authority:'node:simulation',sourceNodeId:'node:simulation',attrs:{...order.attrs,...attrs},meta:{authority:'node:simulation',ts:new Date(now).toISOString()}});
  assert.equal(project({order,allLive:[],verifiedIds:new Set(),now}).state,'sent');
  const received = event('market.order.received');
  assert.equal(project({order,allLive:[received],verifiedIds:new Set([received.id]),now}).state,'received');
  const rejected = event('market.order.reject');
  assert.equal(project({order,allLive:[rejected],verifiedIds:new Set([rejected.id]),now}).state,'rejected');
  const forged = {...received, authority:'node:other',sourceNodeId:'node:other',meta:{...received.meta,authority:'node:other'}};
  assert.equal(project({order,allLive:[forged],verifiedIds:new Set([forged.id]),now}).state,'sent');
} finally { await vite.close(); }
console.log('OK: public-only bounded shell cache; Spanish routes; TSX; motion preserves actions; confirmation guards; actual purchase projection rejects wrong node. Not browser E2E or a real purchase.');
