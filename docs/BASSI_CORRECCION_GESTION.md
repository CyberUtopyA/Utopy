# Bassi · contraste, encabezado y trabajo repetido

## Correcciones

- [BookingManager.tsx](../src/booking/BookingManager.tsx): propaga `data-preset` desde la configuración del nodo. El tema editorial antes sólo alcanzaba a la vista pública.
- [bassiEditorial.css](../src/booking/bassiEditorial.css): gestión y acceso con superficie clara, texto oscuro, campos y pestañas legibles, leyendas consistentes. Colores base de texto/placeholder/pestaña activa verificados con contraste >=4.5:1. No es una auditoría visual completa de todos los estados.
- [BassiPage.tsx](../src/pages/BassiPage.tsx), [BookingExperience.tsx](../src/booking/BookingExperience.tsx), [presentationTemplates.mjs](../src/booking/presentationTemplates.mjs): logo y «Bienvenido», sin repetir el nombre comercial ni la rayita. Se conserva la identidad comercial firmada; no se modifican datos, catálogos ni IDs.
- El gestor y la preparación de nodo se cargan al abrirlos, no al visitar la portada pública.

## Rendimiento: mejoras acotadas, no una promesa de FPS

- [latestTask.mjs](../src/utils/latestTask.mjs) y [mt.resonator.ts](../src/mt/mt.resonator.ts): agrupan ráfagas en el último snapshot completo, con una sola reconciliación en curso y un turno de navegador entre pasadas. No cambian matching, firmas, permisos ni el store compartido.
- [frequency.engine.ts](../src/utopy/frequency.engine.ts): deja de ordenar/reescribir localStorage si no hay nuevas marcas de atención.
- [visiblePolling.mjs](../src/utils/visiblePolling.mjs) y BookingExperience: pausan polling oculto, revalidan al regresar, evitan consultas solapadas y no consultan catálogo público en la vista administrativa. Cada reserva sigue validándose en servidor.
- [mercado.tsx](../src/pages/mercado.tsx): actualizaciones de proyecciones públicas con prioridad no urgente y sin blur de fondo en dispositivos táctiles. No se difiere la autorización de operaciones sensibles.
- Bassi no añade filtros de blur, animaciones infinitas ni animación de dimensiones. Interacciones de presión limitadas a transform de 120ms; se respeta reduced-motion.

## Verificaciones

[verify-ui-performance.mjs](../tests/verify-ui-performance.mjs) prueba agrupación 100→1, última actualización mientras un trabajo sigue en curso, cancelación, errores, ocultar/volver y limpieza de timers/listeners. Ejecuta el código real de atención con un adaptador aislado de store/localStorage: 100 snapshots ajenos no escriben almacenamiento, una actualización relevante lo escribe una vez y 100 repeticiones no vuelven a escribirlo. También valida paleta, tema y TSX.

Además: cinco contratos AGENTS, pruebas de LUA, `verify-bassi-booking`, `verify-premium-booking`, `verify-living-booking-http`, alcance de Tailwind y build Vite/PWA. Las pruebas económicas/negocio son fixtures aislados, no operaciones de clientes.

No se midieron FPS, long tasks ni memoria en el dispositivo del usuario. Tampoco se validó visualmente el hosting. Las cuatro fotos de servicios siguen pendientes como archivos originales. El nodo y su agenda necesitan el mismo vínculo firmado/backend previamente documentado.

## Actualizar cPanel

El ZIP web acumulado incluye índice, CSS/JS/assets compilados, logo, fondo y service worker compatibles del mismo build. No depende de parches anteriores. No incluye medios públicos antiguos sin cambios, Node, bases, claves ni configuración de nodos. Para estos cambios de interfaz/rendimiento no se requiere reinstalar Node; si la agenda aún no estaba conectada, este ZIP no la conecta por sí solo.

Extraer junto al índice de MS Market, reemplazando sólo archivos incluidos y conservando assets antiguos, API, `.htaccess`, configuración y bases. Recargar con Ctrl+F5. No borrar IndexedDB ni datos del sitio: pueden contener la identidad.
