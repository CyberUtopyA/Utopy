# Gestión por tarjetas

Servicios y equipo reutilizan los editores existentes dentro de un carrusel horizontal. La primera tarjeta permite añadir. «Ver todos» muestra una cuadrícula adaptable y «Carrusel» recupera el desplazamiento horizontal.

Cada tarjeta abre un diálogo nativo con foco contenido, cierre por Escape y restauración del foco. Los campos actualizan el mismo borrador del gestor; «Listo» no publica ni guarda en el servidor. El consentimiento y «Guardar configuración» existentes siguen siendo obligatorios. Los profesionales conservan identificadores, horarios, excepciones y asignaciones. La edición de moneda y categorías continúa en opciones avanzadas.

Disponible tanto en gestión autorizada de cualquier nodo que use estos componentes como en `/prueba` y `/prueba?marca=bassi`. La prueba no habilita cargas de fotos ni persistencia real.

Validación: `node tests/verify-booking-cards.mjs`, contratos del proyecto, prueba premium SQLite y build. Pendiente revisión visual humana de móvil/escritorio; no se afirma validación de navegador.
