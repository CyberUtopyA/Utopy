# Cambios v2

- `.env` deja de contener DecoHogar y LaPiedra.
- `VITE_LIVE_CATALOG_SOURCES` queda solo como compatibilidad antigua.
- Nuevo `VITE_BOOTSTRAP_NODE_SOURCES`, opcional y vacío por defecto.
- Nuevo manifiesto `utopy.node.manifest@2` con latido, TTL y vencimiento.
- Nuevo publicador universal `utopy.networkPublish.ts`.
- Nuevo runtime `utopy.nodeManifest.ts` para autoanuncio del nodo.
- Nuevo `utopy-node-heartbeat.js` instalable sin recompilar React.
- Descubrimiento por manifiestos recibidos desde Seed/Micelio.
- Rechazo de URLs no HTTPS y destinos privados fuera de localhost de desarrollo.
- Fetch sin cookies, sin referrer y solo JSON.
- `mt.liveStore` elimina DVs vencidos.
- DecoHogar y LaPiedra publican `manifest`, `catalog`, capacidades y discovery.
- Un nodo nuevo entra sin modificar ni recompilar Falcon.
