# Pruebas realizadas

Fecha: 2026-08-01

## Ejecutadas correctamente

- 20 archivos TypeScript/TSX transpilados con TypeScript 5.8.3 sin errores sintácticos.
- Type-check estricto de los módulos nuevos:
  - `utopy.networkPublish.ts`
  - `utopy.nodeManifest.ts`
  - `liveCatalog.sources.ts`
- 22 contratos automáticos de descubrimiento vivo verificados.
- Prueba funcional del descubridor:
  - descubre un manifiesto genérico;
  - rechaza un manifiesto vencido;
  - acepta HTTPS público;
  - bloquea una URL HTTP de red privada.
- `utopy-node-heartbeat.js` validado con `node --check`.
- PHP validado sin errores de sintaxis:
  - DecoHogar `api/catalog-live.php`;
  - LaPiedra `public/api/catalog-live.php`.
- Integridad de los ZIP comprobada después de generarlos.

## No ejecutado en este entorno

No se ejecutó el build completo de MS Market/Falcon porque el material recibido es un parche y no contiene el repositorio completo con su `package.json`, dependencias y todos los imports reales. Debe ejecutarse dentro del proyecto actual:

```powershell
pnpm install
pnpm build
```

La versión cPanel de DecoHogar sí se entrega ya armada, sin necesidad de compilar React para activar el latido del nodo.
