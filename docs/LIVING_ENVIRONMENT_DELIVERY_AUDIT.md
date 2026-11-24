# Entorno vivo y misiones — alcance comprobable

## Auditoría del código real

- Market: catálogo en `mt.liveStore` y `liveCatalog.sources`, fichas universales, `checkoutmodal`, `mt.checkoutPurchaseCycle`, `mt.orderAcknowledgement`, publicación y autoridad UTOPY existentes. No se crearon un catálogo, bus, login o checkout paralelos.
- `mt.delivery.ts` conserva declaraciones/votos de entrega. `deliveryconfirm.tsx` publica eventos históricos de pedido e incluye `deliverToken`. **No es un canal seguro para un PIN privado y no se reutilizó para eso.**
- `nodeCoordination.ts` y `NodeCoordinationPanel` están explícitamente limitados a simulación. No constituyen asignación atómica, recogida o entrega verificadas de producción. No se quitaron esas restricciones ni se cambió una etiqueta para presentarlos como reales.
- Se localizó el nodo en `C:/Users/derli/Desktop/LyV/lapiedra-menu-final-cotizaciones`: `public/api/market-order.php`, `admin.php`, `catalog-live.php`, `order-status.php`, y `includes/lib.php`. Tiene validación de catálogo y mecanismos locales de persistencia/bloqueo. Su administración existente utiliza sesión propia; no se identificó un puente de autenticación UTOPY para repartidores, un controlador de asignación atómica de misiones, QR de custodia o validación privada de PIN. No se modificaron los archivos de ese nodo ni se llamó a sus endpoints comerciales.
- PASS actual: entitlements y enlaces de Studio, políticas de Skylines y fidelidad. No se encontró una reserva/consumo transaccional de entregas con financiador y liquidación. No se dedujo cobertura a partir de tener un PASS activo.
- Notificaciones y transporte: se conservaron Seed/Micelio, ACK y los mecanismos actuales. Publicar una presencia no equivale a recibir ACK operativo del servidor comercial.

## Implementación de esta etapa

### Disponibilidad por capacidad

`capabilityPresence.ts` extiende `capability.offer`, no un almacén nuevo. El ID es estable por nodo/capacidad, con versión incremental, consentimiento, autoridad/origen y alcance público. `commerce.orders` y `delivery.offer` se anuncian separadamente y solo si están declaradas en el manifiesto existente.

El control aparece dentro de `BusinessWorkspace` y de la cola de producción. Vuelve a consultar el permiso real `capability.offer` antes de publicar y utiliza `publishAuthorizedDV`. No concede permisos, instala ejecutores ni modifica pedidos anteriores. Es un anuncio asesor, no un interruptor de aceptación del backend de un comercio externo. No se forzó la aparición del control en La Piedra sin un manifiesto/permiso compatible.

La proyección exige verificación sobre el objeto DV exacto, no un ID reutilizable; valida autoridad, alcance, reloj y versión. Rechaza conflictos. Una disponibilidad activa dura hasta 15 minutos; al vencer pasa a desconocida, no a disponible perpetua. Los estados manuales pausado/descansando no reabren automáticamente. No hay renovación automática ni aceptación de trabajos desde este control. La interfaz distingue disponibilidad desconocida de descanso voluntario.

La ficha y el checkout bloquean nuevas acciones cuando conocen una pausa verificada del nodo. No sustituyen el control de admisión del servidor, la revalidación de stock/precio o la asignación atómica. La ausencia de un anuncio no crea una capacidad ni demuestra que el nodo está abierto. Los identificadores deben coincidir exactamente; no se inventaron alias de autoridad.

### Feed explicable

`contextualFeed.ts` reutiliza la búsqueda/ranking de `livingSpaceRelevance`; no aprende atributos sensibles ni usa LLM. La intención explícita domina las señales de clima, que tienen peso acotado. La diversidad reduce repetición de un mismo nodo y el resultado del feed queda limitado a 80 elementos. El clima no cambia disponibilidad, precio o ejecución.

Las tarjetas conservan negocio y acción existentes y permiten consultar el motivo y ocultar una publicación. Las preferencias son de sesión, por identidad, mediante `livingSpaceNavigation`: no se creó una base de historial ni se replican públicamente. Desactivar recomendaciones deja operativa la búsqueda escrita; no se usan relaciones/historial autorizados para personalizar mientras esté desactivado. No hay seguimiento de navegación ni de compras nuevo.

El clima reutiliza el adaptador existente de Open-Meteo: solo se solicita después de una acción explícita y del permiso del navegador. La zona del feed se redondea a una décima de grado antes de usarla; no se conserva posición GPS exacta ni se rastrea movimiento. Se omiten credenciales y referrer. La consulta incluye fuente, hora de consulta y TTL de hasta 25 minutos; no se presenta esa hora como fecha de observación meteorológica. No se reutiliza una observación de otra zona o vencida. El caché meteorológico local queda limitado a ocho zonas y se podan entradas vencidas al guardar. No es una caché de operaciones.

El mapa ya no consulta clima automáticamente desde una ubicación publicada: el adaptador requiere autorización explícita. El feed ofrece el control opt-in; no se instaló un control equivalente nuevo en el mapa. Si no hay datos o permiso, el resto de la experiencia continúa. Se implementaron señales de frío/calor; no se afirman recomendaciones nuevas por lluvia, almuerzo o rutas.

## Lo que NO está implementado ni habilitado

- Ciclo de misión comercial real de La Piedra de extremo a extremo.
- Registro/autenticación verificable del repartidor ante el backend del nodo y permisos limitados a la misión.
- Aceptación atómica con restricción de unicidad por misión y capacidad del repartidor, más idempotencia persistente.
- QR opaco de custodia, confirmaciones de ambas partes, expiración y consumo de un solo uso en servidor.
- PIN criptográfico privado, protegido en servidor, recuperación solo por el cliente autorizado, límites de intentos y anti-replay.
- Resolución de ausencias/daños/disputas con evidencias privadas y reglas de conservación.
- Reserva/consumo/reversión PASS y liquidación con financiador autorizado, importes y comprobantes reales.
- Seguimiento privado de un viaje activo, notificaciones de misión o reconciliación offline de esas operaciones.

No se generaron PIN en JavaScript, endpoints ficticios, repartidores de muestra, ventas ni pagos para cubrir esos huecos. Las interfaces operativas de esas fases deben conectarse al servidor responsable, no activar estados locales aparentes.

## Frontera necesaria para continuar

Confirmar la integración de autenticación que el nodo aceptará para cliente y repartidor: identidad UTOPY, confianza verificable, sesión, consentimiento y CSRF. Después implementar allí las operaciones atómicas y la persistencia privada, con outbox/ACK compatibles, sin tocar createSale, caja, Bematech o fidelidad. Un `actorId` enviado por el navegador, CORS, una firma sin raíz de confianza o una cookie de administrador compartida no resuelven esa autorización.

El contrato debe mantener independientes pedido comercial, misión/custodia, pago y liquidación. Una entrega verificada no marca pago ni liquida compensación por sí sola. La integración PASS requiere una capacidad autorizada de reserva/consumo; ningún plan o importe fue inventado.

## Verificación

`tests/verify-contextual-presence.mjs` prueba TTL, pausa persistente, versión/conflicto, privacidad, cambio de objeto con ID igual, clima vencido, personalización desactivada, búsqueda y explicaciones. Usa proyecciones reales con verificación suministrada en fixtures; **no acredita firmas/persistencia/transporte E2E**. Además se ejecutan los cinco contratos generales, pruebas de producto/movimiento y el build Vite/PWA. El build no es un typecheck completo.

No hay navegador conectado ni pruebas de móvil/cámara/permiso geográfico/compra real en esta sesión. No se acreditan los 30 escenarios de aceptación de delivery. La discrepancia de campos de la prueba histórica de comprobantes documentada en `PRODUCT_MOTION_CHECKOUT.md` sigue pendiente; no se modificó el adaptador para hacerla pasar.
