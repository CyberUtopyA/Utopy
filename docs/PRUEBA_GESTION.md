# /prueba · explorar la gestión

- LUA: `/prueba` o `/prueba?marca=lua`.
- Bassi: `/prueba?marca=bassi`.

Vista independiente de los nodos reales, con rótulo permanente de prueba. Reutiliza los editores de horarios, catálogo, recursos y calendario existentes. Permite editar datos en memoria, probar su validación y ver disponibilidad de ejemplo. No tiene endpoint, store persistente, publicación de DVs, autenticación de propietarios, reservas, pagos ni subida de fotos. No registra nodos ni concede permisos. Al recargar, salir o cambiar de marca se pierden los cambios de ejemplo.

Se usa un único profesional ficticio, explícitamente «Profesional de ejemplo», y duraciones de 30 minutos como fixtures; no se presentan como condiciones reales de LUA o Bassi. Los precios permanecen vacíos. Los cambios se comprueban con el contrato compartido `validateBookingConfig` y los horarios con `candidateSlots`, no con un backend ficticio.

La opción `mediaEnabled` del editor de catálogo sólo controla la vista de prueba y no es una regla de autoridad: el gestor real conserva sus controles y su backend sigue verificando permisos. La ruta directa de prueba evita el bootstrap de red del App; si se llega desde una sesión de Market ya abierta, el runtime compartido previamente iniciado puede seguir activo, pero esta vista no lo consume ni publica cambios.

Archivos: [página](../src/pages/BookingPreviewPage.tsx), [fixtures](../src/booking/previewConfig.ts), [estilos](../src/booking/bookingPreview.css), [editor compartido](../src/booking/ServiceCatalogEditor.tsx), [ruta](../src/App.jsx), [pruebas](../tests/verify-booking-preview.mjs).

Tras subir el ZIP web acumulado, abrir la ruta. No instalar Node para esta vista. Si el hosting carece de fallback SPA y devuelve 404, integrar una regla para `^prueba/?$` hacia `/index.html` después de excepciones de API, sin reemplazar el `.htaccess` existente. No se despliega desde el repositorio automáticamente.
