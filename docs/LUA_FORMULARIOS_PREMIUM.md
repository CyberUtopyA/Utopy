# Formularios y agenda · cambios entregados

## Archivos

- `src/components/InteractiveField.tsx`, `interactiveFields.css`: tarjeta accesible reutilizable, resumen, check y expansión; no descarta sus inputs al colapsar.
- `src/components/SimpleIdentitySignup.tsx`: identidad compartida MS Market/LUA, cinco pasos controlados, volver/editar, validación y respaldo existentes. Contactos siguen privados.
- `src/pages/LuaPage.tsx`: acceso de gestión simplificado, acciones pequeñas alineadas y ayuda secundaria.
- `src/booking/WeeklyScheduleEditor.tsx`, `scheduleBlocks.mjs`: primero horas, después días; descansos, edición, copia a otros días, eliminación, excepciones/vacaciones y recursos por profesional. Los bloques existentes se agrupan sin reconstruir el nodo.
- `src/booking/BookingCalendar.tsx`: calendario individual o rango administrativo.
- `src/booking/BookingExperience.tsx`, `BookingManager.tsx`, `bookingPremium.css`: tarjetas de cliente, servicio, profesional, fecha y preferencias; estética cálida; agenda por rangos y controles compactos; señales de catálogo mediante el store vivo existente y refresco de respaldo cada 15 segundos. Cada operación vuelve a comprobar disponibilidad en servidor.
- `src/booking/contracts.mjs`, `client.ts`, `server/booking/store.mjs`: validación de solapamientos y descansos recurrentes, exclusión real de slots y datos de contacto/preferencias privados por reserva con consentimiento. Contratos anteriores y horarios sin descansos siguen funcionando. Los nuevos descansos requieren que el servidor anuncie `features.scheduleBreaks`; la UI no los guarda contra un servidor antiguo que los ignoraría.
- `tests/verify-premium-booking.mjs`, `verify-lua-design.mjs`: escenarios nuevos de agenda y render React, conservando pruebas anteriores.

## Verificación

Creación, edición, copia, eliminación y aplicación multidía; pausas superpuestas/fuera de horario; exclusión de slots; dos reservas compitiendo; protección de citas existentes ante nuevos descansos; persistencia SQLite al reabrir; datos de contacto privados; render React de calendario, rango y tarjetas; compilación TSX. Pruebas HTTP con firmas reales se conservan. Las pruebas usan negocios aislados de simulación, sin mover dinero ni crear reservas reales.

Estilos móviles y movimiento reducido incluidos. **No se ha ejecutado QA visual en navegador móvil/tablet ni se ha desplegado esta actualización en cPanel.** No se afirma que todos los formularios legacy de MS Market hayan sido migrados: el componente compartido se aplicó a identidad, reserva y agenda, manteniendo módulos económicos y de seguridad existentes.

## Imágenes e identidad visual

La portada, logo y fotos se leen de la presentación y del catálogo real del nodo. No se redibujó el logo ni se añadieron fotos ficticias de servicios. Los archivos originales separados del logo y fotos de la referencia no están presentes en `public/`; el preset conserva sus campos vacíos hasta configurarlos. La captura de referencia no se usó como si fuera una foto real de LUA.

Instalar los dos paquetes actualizados (web y servidor) según la guía existente para usar descansos reales. No cambia la propiedad del nodo ni implementa su transferencia definitiva.
