import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';
import { createTileRecoveryHandlers } from '../src/pages/mapTileRecovery.js';

let ready = 0, fallback = 0, unavailable = 0;
const make = backup => createTileRecoveryHandlers({ backup, onReady: () => ready++, onFallback: () => fallback++, onUnavailable: () => unavailable++ });
const main = make(false);
main.loading(); main.tileerror();
assert.equal(fallback, 0, 'one failed tile must not discard the map');
main.tileload(); main.load();
assert.equal(fallback, 0);
main.loading(); main.tileerror(); main.tileerror(); main.load();
assert.equal(fallback, 1, 'an entirely failed batch switches provider');
const backup = make(true);
backup.loading(); backup.tileerror(); backup.load();
assert.equal(unavailable, 1);
backup.loading(); backup.tileload(); backup.load();
assert.equal(ready, 2, 'a recovered tile clears the warning');
assert.equal(unavailable, 1);
for (const path of ['src/pages/circularGeographicMap.jsx', 'src/pages/circularpanel.jsx']) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  await transformWithEsbuild(source, path, { loader: 'jsx' });
  if (path.endsWith('circularpanel.jsx')) {
    assert.match(source, /projection === "feed" && onReturnToFeed \? <MapLoading/);
    assert.match(source, /if \(projection === "feed" && onReturnToFeed\) \{ onReturnToFeed\(\); return; \}/);
  }
}
console.log('OK: map batch fallback, recovery and external feed transition guard; JSX compiles.');
