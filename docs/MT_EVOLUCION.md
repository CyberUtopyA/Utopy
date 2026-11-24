# MT — evolución territorial sobre la aplicación existente

## Estado: implementación compatible parcial, no despliegue certificado

Se añade `/mt` dentro del router y runtime existentes; `/` y el inicio PWA apuntan a MT. `/market`, `/lua`, `/bassi`, Falcon, fichas públicas, checkout, contratos y administración permanecen. No se crea otro proyecto, backend, cuenta, inbox, motor de pedidos ni base de reservas. GE no se fabrica como una pantalla vacía: no se encontró aquí una aplicación operativa de energía.

## Auditoría previa (EXISTENTE / PARCIAL / DESCONECTADO)

| Área | Infraestructura encontrada y alcance |
| --- | --- |
| Router/layout/PWA | App.jsx, MercadoLocal, AppShell, FalconShell, VitePWA y SW público; se reutilizan. Había filas y accesos duplicados; se conserva el explorador reciente de Market y se compone otra presentación territorial, no otro sistema. |
| Catálogo y compra | universalProduct, liveCatalog.sources, nodos públicos, variaciones, checkoutmodal, CartSidebar, pedidos, pagos y producto compartido. MT invoca los mismos callbacks de selección y compra; no crea tablas de órdenes. |
| Agenda | BookingExperience/Manager/Calendar, publicBookingConfig, backend livingBookingHandler y LivingBookingStore SQLite; horarios, descansos, excepciones, idempotencia, ocupación, aceptación y cancelación reales. |
| Presencia/territorio | territorialCompatibility, publicGeoPoint, distanceKmBetween, publicLivingSignals, livingSpaceNavigation y mapa circular existentes. No se crea otro store territorial ni se publican coordenadas. |
| Identidad/autoridad | ownership, identityContext, businessRegistry, manifiestos firmados, autorizaciones por nodo y runtime trust. Persistencia local y respaldo cifrado existentes; autenticación global y sincronización privada multidispositivo pendientes según auditoría previa. |
| Cuenta/Mi Valor | LivingProfileQuickView y BovedaVivaPanel; acceso directo al espacio económico existente, sin nuevos saldos, retiros, custodios ni permisos. |
| Comunicación/notificaciones | GlobalConversationsModal, hilos vivos y Frecuencia/Notificacion existentes. MT usa el mismo inbox. No se configura envío nuevo a WhatsApp, SMS o Telegram. |
| MO | mo.capabilityBridge, proyecciones y acciones de nodos existentes. Se conservan; MT puede descubrir ofertas públicas de diseño/fabricación. No se inserta el editor 3D ni se certifica un ejecutor externo sin evidencia. |
| FEDA | No se encontró un backend educativo completo instalable aquí. Ofertas públicas reales de aprendizaje pueden descubrirse por contenido/capacidad. No se crea otro sistema de cursos ni se presenta FEDA como intermediario. |
| GE | No hay aplicación o host de dispositivos físicos operativo en este checkout. Se puede descubrir una capacidad de energía publicada, pero no se habilitan actuadores ni automatización física. |
| Preparación versus producción | Los presets son configuración, no disponibilidad. En este checkout lua-node.json está vacío y no se encontró bassi-node.json. No se conoce ni certifica la configuración actual del hosting. |

## Implementación

### Entrada y descubrimiento

`TerritoryHome` se monta en el mismo MercadoLocal con territoryMode. Encabezado MT, búsqueda por intención, categorías sólo cuando existen contenidos relacionados, subcategorías publicadas y nodos con opciones limitadas. Se distinguen catálogo comercial, servicios consultados al servidor y capacidades públicas. Los nombres comerciales no otorgan categorías ni autoridad.

La búsqueda «quiero almorzar» se interpreta localmente como comida; una consulta de servicio o nombre filtra el contenido publicado. No abre automáticamente radar o mapa. «Ver territorio» utiliza el mapa existente. La selección manual usa identificadores territoriales publicados, sin inventar ciudades/comunidades. La geolocalización es opcional: se redondea a dos decimales, sólo se mantiene en memoria y ordena por distancia aproximada cuando también existe ubicación pública válida. Sin ubicación no se muestra distancia. Cambiar de identidad limpia la ubicación.

Los estados MT se guardan en la navegación UI existente, separados por actor; no son identidades ni una segunda base de entidades. Las señales de comunidad reutilizan publicLivingSignals, excluyendo muestras, expirados y ámbitos privados. No se fabrican integrantes, actividad o disponibilidad.

### Puente de agenda

`useTerritorialBooking` verifica el registro de negocios existente y sólo consulta endpoints publicados en manifiestos verificados. `loadTerritorialBookingCatalog` usa bookingRequest/catalog, máximo dos peticiones concurrentes, sondeo visible cada minuto y refresco con versiones de manifiesto/catálogo. Es una proyección de lectura en React, no un store ni réplica de reservas. No solicita contactos privados, listas de citas ni horarios administrativos.

`projectTerritorialBooking` conserva nodeId/serviceId reales, precio y habilitación declarada. «Consultar horarios» no significa que haya cupos libres. El enlace público `/n/:slug?service=:id&from=mt` selecciona ese servicio en BookingExperience sólo tras obtener catálogo del servidor. El motor original vuelve a consultar slots y valida cada confirmación atómicamente. Servicios retirados/inactivos no se confirman. Las rutas directas de LUA/Bassi también aceptan la selección de servicio y permanecen activas. Mi Valor y conversación usan los componentes originales.

### Persistencia y despliegue

No hay cambios de esquema, migraciones ni reinicios de datos. No se modifican precios, horarios, inventario, planes, pagos, comisiones ni registros privados. El paquete web acumulado es para una instalación existente; no instala servidores ni vincula propietarios. El SW conserva su política de activos públicos; los catálogos/operaciones de agenda siguen no-store.

## Recorridos verificados

Archivos principales de esta entrega:

- [TerritoryHome.tsx](../src/components/TerritoryHome.tsx) y [territoryHome.css](../src/components/territoryHome.css): presentación MT, territorio y actividad.
- [territoryDiscovery.ts](../src/utopy/territoryDiscovery.ts) y [livingSpaceNavigation.ts](../src/utopy/livingSpaceNavigation.ts): intención y estado UI compartido.
- [territorialBooking.ts](../src/booking/territorialBooking.ts) y [useTerritorialBooking.ts](../src/booking/useTerritorialBooking.ts): lectura verificada del catálogo real.
- [BookingExperience.tsx](../src/booking/BookingExperience.tsx): servicio seleccionado desde MT y retorno contextual, sin otro motor.
- [App.jsx](../src/App.jsx), [mercado.tsx](../src/pages/mercado.tsx), [UnifiedLivingMarket.tsx](../src/components/UnifiedLivingMarket.tsx), [LivingProfileQuickView.tsx](../src/components/LivingProfileQuickView.tsx) y [vite.config.js](../vite.config.js): composición, rutas, cuenta y PWA.
- [verify-mt-booking.mjs](../tests/verify-mt-booking.mjs): integración HTTP/SQLite aislada.

`node --experimental-sqlite tests/verify-mt-booking.mjs` usa HTTP en loopback y el handler/store reales con dos nodos fixture, SQLite temporal y un autorizador estrictamente de prueba: configurar, catálogo → proyección MT → serviceId correcto → slots del servidor, descansos, crear → ver la misma reserva en el gestor original, conflicto de horario, aislamiento, reagendar, reabrir persistencia, cancelar y reconfirmar el estado. Endpoints ausentes o catálogos de otro nodo no producen disponibilidad. No se crearon negocios ni operaciones de producción.

Pasaron pruebas del explorador, renderizado de documentos, agenda Bassi, continuidad de identidad, contratos generales y build inicial. No se realizó una compra real con un proveedor de pago. No se ejecutó una prueba visual Android ni un flujo real de cliente desde producción.

La prueba adicional `verify-first-real-purchase-contract.mjs` falla en una aserción de código fuente: espera `form.append("file", input.file)` y `buyerActorId`, mientras la implementación actual usa `image` y `uploadToken`. Esos dos archivos ya estaban en el árbol de trabajo y no se modificaron en esta entrega. No se declara el checkout completamente certificado, ni se cambia el contrato de subida sin verificar el receptor real. Esta discrepancia debe conciliarse con el proveedor/nodo y cubrirse con una prueba funcional de comprobante; no basta con cambiar la expresión regular para que pase.

## Pendientes que impiden aceptación completa

1. Proporcionar y verificar los manifiestos reales, vinculaciones de LUA/Bassi y endpoints de agenda desplegados con Authority/Identity actuales. Probar una reserva autorizada con cada negocio real y su gestor, sin datos ficticios.
2. Completar el backend de identidad global/recuperación segura y sincronización privada que no está localizado aquí. Una misma clave recuperada conserva actor, pero no equivale a login ni sincronización automática entre aplicaciones/dispositivos.
3. Validar una compra real con el proveedor autorizado, stock/pedido/comprobante y conversación del negocio. No se acredita dinero por tests ni transferencias autodeclaradas.
4. Conectar ejecutores reales anunciados de MO/FEDA y el host de GE con permisos específicos. La presencia de una oferta no instala una capacidad ni autoriza acciones físicas.
5. Revisar visualmente en móvil y comprobar PWA/deep links, rendimiento y estados offline desde el hosting. No afirmar que las doce condiciones de aceptación están cumplidas.

No se desplegó producción. No se requieren migraciones destructivas; sí configuración verificable del hosting y de los nodos para los recorridos pendientes.
