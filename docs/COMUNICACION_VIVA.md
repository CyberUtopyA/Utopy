# Comunicación Viva — entrega y límites

## Auditoría

Existente: identidad/autoridad firmada del nodo, Datos Vivos compartidos, conversaciones UTOPY, propuestas de procedimientos y servidor Agenda Viva con SQLite. Se reutilizan; no se creó otra aplicación, identidad ni bandeja.

Parcial: automatizaciones existentes producen propuestas, no disponen de un ejecutor omnicanal autorizado instalado. La activación permanece bloqueada. Las plantillas son borradores; no son suscripciones activas a eventos. Una reserva automática usa `booking.create` con estado `confirmed`; una confirmación manual usa `booking.confirm`. Ningún texto de confirmación debe despacharse sin comprobar el estado real de la operación.

## Implementado

- Panel administrativo: ocho canales en cuadrícula y un diálogo compacto; teléfono con formato internacional, consentimiento, llamar/copiar/compartir/desactivar; chat abre las conversaciones existentes.
- Contrato `utopy.communication/1`, normalización de Telegram sin crear personas y renderizado que rechaza datos desconocidos.
- Adaptador oficial Telegram: getMe, setWebhook, deleteWebhook, sendMessage, autenticación del webhook. Estado conectado únicamente tras respuestas satisfactorias del proveedor.
- Persistencia en la misma base privada del servidor: secretos y mensajes cifrados AES-256-GCM, aislamiento de nodo, autorización existente, revisión optimista, deduplicación, cola durable y auditoría sin contenido sensible.
- Consentimiento verificado y operación autorizada obligatorios. `/stop` revoca envíos. Aceptado por proveedor no significa entregado. Resultados inciertos se retienen para revisión, no se reenvían automáticamente.

## Pendiente — no presentar como operativo

WhatsApp Business, Instagram, Messenger, SMS y correo requieren adaptadores oficiales, credenciales, validación y aprobaciones correspondientes. No se implementó OAuth ni automatización de cuentas personales. No se realizó un envío real a Telegram: las pruebas usan un proveedor de fixture claramente separado.

El teléfono está configurado, no certificado por una operadora. El chat utiliza permisos existentes. Las plantillas de pedidos, recordatorios y entrega requieren vinculación verificada con los eventos reales; no hay scheduler nuevo ni campañas activas.

## Conexión del host real

El host privado ya cargado por `server/booking/run.mjs` puede exportar `communication` con:

- `encryptionKey`: Buffer de 32 bytes, estable, protegido fuera de public_html. No generar una clave nueva en cada arranque. Su pérdida impide recuperar secretos. La rotación requiere migración controlada, no está automatizada.
- `credentialsFor(nodeId, channel)`: credenciales del titular desde almacenamiento privado; nunca desde la petición del navegador.
- `webhookUrl(nodeId, channel)`: URL HTTPS pública que enrute al servidor existente `/api/communication/webhook/:nodeId/telegram`.
- `verifyConsent` y `verifyOperation`: validar evidencia real y autoridad vigente; nunca retornar true de forma incondicional.
- `projectInbound`: verificar la vinculación externa y proyectar en un hilo autorizado existente; retornar `{verified:true,threadId}`. Debe ser idempotente con `requestKey`. Sin puente, el evento queda cifrado como `awaiting_link`, no se inventa una identidad.

El manifiesto firmado del nodo debe publicar `attrs.endpoints.communication` apuntando al handler existente. Requiere mandato `communication.manage`/`communication.send`. No se conceden permisos al visitante por conocer una URL.

El host debe programar `processOne()` y `projectPending()` con su mecanismo de trabajo existente, bajo las mismas verificaciones. Este cambio no arranca procesos de fondo ni presupone cron en cPanel. Tras un fallo durante envío, revisar trabajos `sending`/`attention` antes de reintentar. No se garantiza exactly-once en un proveedor sin clave idempotente. Validar concurrencia multiproceso antes de escalar.

## Verificación

`node --experimental-sqlite tests/verify-communication-viva.mjs`: autoridad, aislamiento de cuenta externa, cifrado, revisiones, consentimiento, idempotencia, webhook rechazado, deduplicación, opt-out y desconexión. Son pruebas locales de infraestructura, no certificación de proveedor ni inspección visual.

Referencia oficial del adaptador: [Telegram Bot API](https://core.telegram.org/bots/api). Las otras integraciones quedan explícitamente sin instalar.

No incluir bases, tokens, claves maestras ni credenciales en ZIPs web o repositorio. El ZIP web no activa por sí solo las conexiones externas. Mantener copias privadas de base y clave antes de actualizar el servidor.
