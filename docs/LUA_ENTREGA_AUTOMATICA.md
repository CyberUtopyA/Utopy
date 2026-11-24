# LUA · Invitación y gestión sin nuevas aprobaciones

La entrega concede **administración**, no propiedad, pagos ni facultad de delegar otra vez. El mismo nodo, agenda, catálogo e historial continúan. No se crean cuentas de propietarios ficticios.

## Recorrido implementado

En **Configuración → Compartir mi negocio → Entregar administración → Invitar y listo** el controlador autoriza una vez, crea la invitación y comparte el enlace privado. Vence en 48 horas. La destinataria abre `/invitacion#invitation=…`, prepara su identidad persistente o utiliza la existente, acepta explícitamente y entra en **Agenda**. Sin copiar identificadores ni intercambiar archivos de permisos. Su respaldo personal de identidad sigue siendo responsabilidad de ella.

La concesión dura un año como máximo. Cada operación la verifica el servidor. El controlador puede cancelarla antes desde el mismo panel. El enlace es una capacidad secreta: quien lo recibe puede aceptar; enviarlo solamente a la persona correcta. No prueba su teléfono, correo ni propiedad legal. Abrir o previsualizar no consume el enlace; aceptar firmado sí. Reintentar con la misma identidad y dispositivo es idempotente. Otra identidad o dispositivo no puede reclamarlo nuevamente.

El consentimiento vincula el dispositivo actual. Recuperar la identidad en otro dispositivo genera una clave nueva: su autorización debe renovarse mediante una nueva invitación. No hay login remoto por teléfono/correo ni OTP. Una revocación conocida del dispositivo bloquea sus operaciones; no se ignora porque tenga una invitación previa.

## Instalación única · fuera de public_html

El ZIP web **no instala el servidor**. El ZIP `LUA-SERVIDOR-NODE-…zip` debe extraerse en una aplicación Node privada del hosting, separada de public_html, dist, www y htdocs. PHP y sus endpoints existentes no se sustituyen. Probado con Node 23.1 y `--experimental-sqlite`; el entorno debe soportar `node:sqlite`.

1. Instalar dependencias con `npm install --omit=dev` dentro de la aplicación privada. El paquete incluye la misma versión de Runtime UTOPY del proyecto, no otro motor.
2. Obtener el identificador REAL y el manifiesto firmado del nodo ya creado en UTOPY. En **Compartir mi negocio → Entregar administración → Instalación inicial → Descargar manifiesto público** se exporta el mismo nodo, sin claves privadas. No inventar otro identificador ni reconstruir el negocio. Guardar ese manifiesto como archivo privado del host.
3. Configurar rutas absolutas privadas (los nombres siguientes son ejemplos, no valores instalados):

   ```text
   UTOPY_BOOKING_NODE_ID=identificador-real-del-nodo
   UTOPY_BOOKING_IDENTITY_FILE=/ruta/privada/identidad-servidor.json
   UTOPY_BOOKING_MANIFEST_FILE=/ruta/privada/nodo-manifiesto-firmado.json
   UTOPY_BOOKING_DB=/ruta/privada/agenda.sqlite
   UTOPY_BOOKING_HOST_MODULE=/ruta/app/server/booking/file-host.mjs
   UTOPY_BOOKING_PORT=8787
   ```

4. Ejecutar `npm run provision` **una sola vez**. Crea exclusivamente la identidad del servidor; no copia claves de personas. Se niega a sobrescribir una clave existente. Nunca subir la clave o la base a la carpeta web. Mantener permisos privados y respaldos del host.
5. Arrancar con `npm start`. El proceso escucha en loopback. Configurar la aplicación/proxy del hosting para publicar **POST `/api/living-booking`** mediante HTTPS en el mismo dominio que la web, sin caché ni registros de cuerpos. No añadir CORS abierto. Esta ruta debe llegar al proceso Node antes del fallback SPA. La configuración concreta del proxy depende del proveedor de cPanel. Habilitar límites de peticiones y de cuerpo en el proxy.
6. Desde el controlador, conectar el endpoint en la capacidad de agenda existente. En **Invitar y listo → Conectar entrega automática**, revisar el servidor y consentir. Se descarga un manifiesto firmado con la clave pública del servidor y las tres acciones permitidas. Reemplazar el manifiesto privado del host por esa versión firmada y distribuir el mismo DV mediante el mecanismo de descubrimiento existente. No publicar claves privadas. Si el servidor tiene otra versión, rechaza emitir invitaciones.
7. Configurar `lua-node.json` con el identificador real y hacer disponible su manifiesto firmado mediante el descubrimiento existente. Este identificador no concede permisos. Publicar el ZIP web. El servidor puede entregar la presentación firmada mediante `admin.manifest`, sin datos de clientes.
8. Abrir el negocio con el controlador y completar agenda, servicios y horarios reales. No se precargan precios ni disponibilidad inventados. Opcionalmente conectar el proveedor de fotos existente con `UTOPY_BOOKING_MEDIA_ENDPOINT` y `UTOPY_BOOKING_MEDIA_HEADERS` (sólo en el entorno privado), o reutilizar el host de media propio ya configurado.
9. Ejecutar `npm run preflight` para verificar Runtime, manifiesto y clave autorizada. Después crear y enviar la invitación privada. Tras aceptar, la destinataria opera sola dentro de esos permisos. La instalación y la autorización inicial son pasos únicos; no nuevas aprobaciones por cada cita o edición.

El paquete incluye `app.cjs` como entrada opcional para proveedores que solicitan un archivo CommonJS. Usar el mecanismo de arranque admitido por el hosting; no ejecutarlo además de otro proceso ya iniciado ni levantar dos servidores en el mismo puerto.

Si ya existe un host UTOPY, conservarlo y exportar además `getManifest(nodeId)` con el manifiesto vigente. El mismo `run.mjs` mantiene sus adaptadores de Authority y media. El host de archivos es una opción para instalaciones sin ese módulo: su controlador y dispositivo proceden de un archivo firmado instalado explícitamente por el operador, no de datos enviados por un visitante. Una nueva clave de dispositivo controlador requiere sincronizar su manifiesto actualizado; no se acepta automáticamente una clave desconocida.

Las rutas `/invitacion`, `/lua`, `/lua/gestionar` y `/n/…/gestionar` necesitan el fallback SPA existente. No reemplazar todo el `.htaccess`. No cachear la API, sw.js, index.html o lua-node.json. No borrar IndexedDB.

## Seguridad y límites

SQLite conserva el hash del token, no el enlace secreto. Aceptación y consumo son transaccionales; el mandato se emite con firma del Runtime cuya clave está autorizada explícitamente en el manifiesto firmado por el controlador. Los comprobantes de interfaz duran cinco minutos y se renuevan mientras se usa el panel; no sustituyen el control de autoridad en cada operación del servidor. Si está offline, no se realizan cambios remotos. Una interfaz con un comprobante aún vigente puede mostrar el panel después de una revocación, pero el servidor deniega inmediatamente sus operaciones. No constituye transferencia definitiva de propiedad: el controlador original sigue teniendo autoridad.

La concesión se persiste en la misma base del nodo. Eventos de auditoría usan el outbox existente (`living_booking_events`); el host con transporte Runtime puede publicarlos con `publishBookingEvents`. El host mínimo sin transportes no afirma que se hayan sincronizado con otros nodos. No instala un bus paralelo ni permite ejecutar código generado.

## Verificación local

`node --experimental-sqlite tests/verify-node-admin-http.mjs` usa dos identidades y firmas ES256 reales en un negocio de simulación aislado: crear, aceptar, editar catálogo/configuración, leer agenda, persistencia al reabrir la base, carreras, reintentos, vencimiento, revocación de concesión y dispositivo, límites y firma de comprobantes. Pruebas HTTP de reservas previas se conservan. Se verifican contratos y build de la web.

**No se ha instalado ni probado en el hosting real.** Antes de prometer que una clienta puede gestionar: instalar Node/proxy, vincular el manifiesto REAL, comprobar fotos/proveedor y probar el recorrido en dos navegadores. El ZIP no contiene una invitación real ni una identidad de LUA: sólo se genera con la identidad controladora autorizada.
