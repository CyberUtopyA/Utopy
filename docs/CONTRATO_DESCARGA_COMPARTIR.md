# Descargar, compartir y volver al contrato

Tras completar correctamente la firma y las validaciones existentes, el generador descarga el PDF y devuelve el mismo documento como Blob para compartirlo desde una acción explícita. El navegador decide la carpeta, el aviso de descarga y las aplicaciones disponibles; la web no puede imponer una ubicación silenciosamente.

«Compartir PDF» usa Web Share con archivos y requiere compatibilidad, contexto seguro y gesto del usuario. En localhost la compatibilidad depende del navegador. No selecciona ni verifica automáticamente el destinatario. «Abrir WhatsApp de Mateo» abre un chat al contacto configurado en `VITE_RENTAL_CONTACT_PHONE` (por defecto el contacto solicitado por el usuario); sólo prepara texto. El PDF debe adjuntarse si se usa ese enlace. No hay proveedor de envío automático de WhatsApp configurado ni credenciales de envío en frontend.

Los contratos privados existentes se almacenan en IndexedDB del navegador/origen donde se firma y quedan filtrados por la identidad participante. «Mis contratos y renovaciones» abre `/mis-contratos`; desde el documento se vuelve a generar el PDF completo tras verificar acceso e integridad. No se añadió almacenamiento remoto, respaldo o sincronización multidispositivo. Localhost y producción tienen almacenes distintos. No borrar datos del sitio ni prometer recuperación desde otro dispositivo.

El flujo de propuestas y consentimiento bilateral de renovación ya existía y se reutiliza sin autoaprobar. La renovación y el envío real a WhatsApp no fueron probados en dos dispositivos ni con personas reales. Tampoco este cambio resuelve por sí mismo el fallo de identidad/guardado/activación aún no identificado en la sesión del usuario.

Pruebas: PDF real con QR y pagaré opcional, Blob y nombre descargable, contratos privados, contratos generales y build. Pendiente validación visual, descarga y Web Share en el navegador del usuario.
