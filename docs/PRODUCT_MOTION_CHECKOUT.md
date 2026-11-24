# Navegación y Product Motion

## Integración real

La portada existente `UnifiedLivingMarket` conserva sus callbacks y destinos. Se reemplazaron los cinco banners por Tiendas, Ofertas, Alquileres, Para hoy y Oportunidades. Daily incluye farmacia/supermercado, no solo comida. Capital contiene activos/proyectos, no un proveedor universal de financiación. Las marcas internas y rutas no se renombraron.

`productMotion.ts` es una capa de experiencia: captura geometría efímera al inspeccionar una tarjeta, anima el diálogo durante 200 ms con Web Animations cuando existe, cancela animaciones al desmontar y respeta movimiento reducido. No usa WebGL, almacenes ni datos comerciales. Se integra en las tarjetas compartidas, las filas del feed, el diálogo universal y el checkout actual. No implementa una transformación física exacta del producto ni una transición de salida compartida. La vuelta y el contexto siguen usando las rutas y mecanismos de retorno existentes.

Los diálogos incluyen foco inicial, Tab acotado, Escape, restauración del foco cuando el elemento aún existe y bloqueo del scroll del documento. Las galerías tienen un diálogo anidado propio. No se obliga a usar gestos. La descripción completa es desplegable, sin truncado permanente.

El checkout conserva variantes, entrega/retiro, cuotas autorizadas, `payment.offer`, estados ACK y comprobantes. Añade total persistente a confirmar por el comercio, bloqueo de edición durante envío, barrera síncrona contra doble toque y mensaje sin conexión. No calcula precio final del servidor ni stock autoritativo nuevos, no marca pagos confirmados y no sustituye la idempotencia/validaciones del nodo. Los reintentos existentes conservan el pedido original. No se tocaron createSale, inbox/outbox, externalOrders, inventario, cuotas, CSRF ni servidores.

## Rendimiento y privacidad

El prefetch por foco/hover solo carga el módulo existente del checkout, una vez, con reintento si falla. No solicita datos privados ni pagos y respeta offline, save-data y 2G cuando el navegador informa esos estados. Fotografías del feed cargan progresivamente. 3D/AR continúa bajo solicitud explícita.

El service worker solo precachea shell y artefactos versionados admitidos, con límite de entradas. No añade caché pública de API, JSON de catálogos, archivos subidos, comprobantes ni datos transaccionales. El runtime existente mantiene la revalidación de catálogos y exclusión de credenciales; no se creó otro catálogo o caché de precios. No se agregó caché de imágenes externas ni cuotas offline. La política es conservadora: una foto pública no queda automáticamente habilitada para almacenamiento compartido por tener URL.

## Verificación y límites

- `tests/verify-product-motion.mjs`: política de caché, rutas/etiquetas, compilación TSX, acciones del motor y proyección real de ACK/rechazo/autoridad con fixtures `simulation:true`, `nonTradable:true`; no operaciones reales.
- Ejecutar además los cinco contratos generales y `verify-product-reality.mjs`, y `pnpm build` (Vite + PWA, no typecheck completo).
- `verify-first-real-purchase-contract.mjs` falla en una aserción textual anterior: espera `form.append("file", input.file)` y `buyerActorId`, mientras el adaptador actual, no modificado en esta tarea, envía `image`, `orderId` y `uploadToken`. No se alteró el adaptador ni se debilitó esa prueba para ocultar la discrepancia. Sus comprobaciones de estados anteriores a esa aserción se ejecutan, pero la suite completa no pasa.
- No hay navegador conectado ni ejecutor UI habilitado en esta sesión. No se verificaron E2E, teléfono/tablet reales, voz, AR, compra/pago real ni métricas LCP/INP/CLS antes/después. No se afirma preparación final para producción sin esas pruebas. El tamaño de bundles del build no equivale a medir métricas de usuario.

Para cerrar la aceptación: probar con un nodo autorizado de pruebas (sin dinero real) personalización → envío → ACK → oferta de pago → pendiente/rechazo/confirmación → comprobante privado; comprobar doble toque/reintento con el mismo ID, falta de stock, regreso a la posición anterior y teclado/reduced-motion en las tres clases de pantalla. El entorno transaccional, las credenciales y los importes de prueba deben estar autorizados; nunca usar una venta real como fixture.
