# Diagnóstico del PDF después de firmar

La captura sólo mostraba un catch genérico. El flujo realiza varias operaciones antes del PDF: identidad y mayoría de edad, contrato privado en IndexedDB, acceso opaco para QR y eventual activación. No se determinó cuál falló en la sesión del usuario.

Se reemplazó el mensaje genérico por etapa y detalle, sin borrar la firma de React ni el contrato pendiente ante un fallo. Se impide generar concurrentemente desde el mismo componente y se libera el bloqueo en finally. No se desactivó ninguna comprobación de identidad, reserva o acceso.

La prueba `verify-signed-pdf.mjs` ejecuta el generador real, verifica bytes PDF, páginas y QR con/sin pagaré usando fixtures sin datos personales. No prueba firma gráfica subida, descarga en Chrome, almacenamiento privado ni autorización de una persona real. La firma permanece durante el reintento en la misma pantalla; no se promete conservarla al recargar.

Tras instalar el paquete, reintentar y comunicar el nuevo mensaje específico si falla. No declarar el incidente de producción resuelto hasta verificar ese recorrido. No se entrega un PDF del contrato del usuario ni se certifica una firma digital por la existencia de una imagen.
