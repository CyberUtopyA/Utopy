# LUA y agendamiento vivo

Implementado dentro del MS Market existente, sin modificar `server/economy/journal.mjs`.

## Cómo entrar

Acceso directo público: `/lua`. Acceso profesional: `/lua/gestionar`.
El alias no crea un nodo ni otorga permisos. Sin nodo conectado muestra la
presentación con agenda no habilitada. Para compartir el nodo real entre
dispositivos, configurá su ID exacto en `lua-node.json` del hosting y mantené
su manifiesto firmado disponible por el descubrimiento existente. No se cachea
esa vinculación en el precache PWA.

1. Abrí `/mi-espacio`, sección **Preparar un nodo con agenda**.
2. Elegí LUA, confirmá que administrás el negocio y creá su identidad comercial
   con tu Identidad UTOPY persistente y respaldo cifrado. No se crean cuentas de
   propietarios ficticios. El mismo mecanismo permite otro nombre y nodo.
3. El enlace **Abrir gestión del nodo** conserva su identificador: `/n/<id>/gestionar`.
4. En **Agenda**, conectá el endpoint HTTPS del servidor autorizado de ese nodo.
5. Completá Servicios, Disponibilidad, Información del nodo y guardá con consentimiento.
   La página pública es `/n/<id>`. Los servicios empiezan desactivados, sin precios,
   duración ni horarios inventados.

El preset `lua-editorial-spa` incluye únicamente los cinco servicios, nombre,
frase, profesional e Instagram proporcionados. No incluye ubicación ni imágenes
extraídas del render. El logo y las fotografías originales aún no están disponibles.

## Servidor del nodo

`LivingBookingStore` usa SQLite persistente y transacciones `BEGIN IMMEDIATE`.
Las solicitudes pendientes también ocupan profesional y recursos compartidos.
Incluye control de versiones, idempotencia por nodo/actor, cancelación,
reagendamiento, confirmación, completado, ausencia, bloqueos y eventos.
La zona es `America/Asuncion`, resuelta con IANA, sin offset fijo.

Montá `livingBookingHandler(store)` en el servidor existente del nodo. El adaptador
`runtimeBookingAuthorizer` reutiliza firmas ES256 y `AuthorityRegistry` de Runtime.
Requiere claves confiables ya verificadas y el verificador vigente de mandatos
del host. **No confía automáticamente en una clave enviada por el navegador.**
Permisos: `booking.self`, `booking.manage`, `booking.configure`.

También existe un runner de despliegue (sin identidad ni permisos por defecto):

```powershell
$env:UTOPY_BOOKING_HOST_MODULE = 'C:\servidor-del-nodo\host.mjs'
$env:UTOPY_BOOKING_DB = 'C:\datos-privados-del-nodo\agenda.sqlite'
node --experimental-sqlite server/booking/run.mjs
```

El módulo privado del host exporta `runtime` (su Runtime real, con su registro de
autoridades actualizado) y `authorizeNode({actorId,nodeId,action,proof,now})`, que
consulta autoridad/mandato vigente y devuelve booleano. No copiar tokens ni claves
al frontend. Puerto local predeterminado 8787; requiere proxy HTTPS del nodo.
El cliente envía solicitudes firmadas y vinculadas a todos sus datos, con vencimiento.

`publishBookingEvents` entrega los eventos persistentes al Runtime/bus existente;
el host guarda su cursor tras el éxito y reintenta con IDs estables. El catálogo
público es una proyección con campos permitidos (`booking.catalog`), no otra base
social. Agenda, bloqueos y clientes no forman parte del catálogo público.

## Gestión y reutilización

**Abrir hoy** permite fijar tramos especiales para una fecha, cerrar ese día o
volver al horario habitual. Se aplica por profesional y recurso, en horario de
Paraguay. Las citas y pausas ya ocupadas siguen descontándose en el servidor;
un cambio que afecte una cita futura se rechaza para revisarla primero.
Requiere actualizar también `server/booking` y `src/booking/contracts.mjs` en
el host de agenda: el ZIP web de cPanel por sí solo no actualiza ese servidor.

El catálogo simplificado permite añadir servicios, precio/foto/descripción
opcionales, ocultarlos y añadir datos públicos personalizados. Nombre, duración
y profesional siguen siendo necesarios para ofrecer reservas reales; el precio
puede quedar como «Consultar». Las fotografías se cambian por enlace HTTPS;
las fotos también pueden elegirse desde la galería del teléfono cuando está
conectado el adaptador de medios del nodo.

- Agenda por día, 7 días o mes; confirmación, cancelación y reagendamiento.
- Servicios, precios reales (PYG enteros; USD/BRL en centavos), duración,
  profesionales y salas/equipos compartidos, horarios y pausas/vacaciones.
- Galería con consentimiento explícito, favoritos locales y asociación a una cita
  cuando el tratamiento acepta referencias. La subida de fotos de catálogo es pública
  con consentimiento; no es un canal para documentos o fotos privadas de clientes.
- Calendario ICS, compartir sólo por acción del usuario y consulta de sus propias citas.
- Otro nodo activa **Agenda → Conectar capacidad** con el mismo servidor/contrato.
- La personalización avanzada sigue en Fundación Studio con Pass; no se duplicó el editor.

## Pruebas y límites reales

```powershell
node --experimental-sqlite tests/verify-living-booking.mjs
node --experimental-sqlite tests/verify-living-booking-http.mjs
pnpm build
```

Pasaron concurrencia, solapamiento, idempotencia, cancelación, reagendamiento,
persistencia al reabrir, aislamiento por nodo/cliente, revocación, firmas reales
por HTTP y rechazo de peticiones alteradas. Ensayos aislados, no citas comerciales.
También pasaron contratos UTOPY/Pay/aportes/red/bóveda y onboarding existente.
Build/PWA pasó. Falta validación visual humana en móvil/tablet.

Actualización visual: navegación y tarjetas con iconos, portada editorial,
servicios destacados, calendario mensual accesible, horarios en píldoras y
confirmación con detalles. `verify-lua-design.mjs` renderiza el calendario real
con React y verifica selección, fechas pasadas y controles accesibles. No sustituye
la revisión visual del navegador. El aviso de instalación no tapa la ruta `/lua`.

**No está desplegado ni habilitado para recibir clientes reales:** falta conectar
el host Runtime/Identity del nodo y su endpoint; crear la identidad con la clave
persistente del administrador; cargar logo/fotos, horarios, duraciones y precios
autorizados. No se dispone de acceso a esa identidad privada desde esta sesión.

Los eventos quedan preparados para el sistema existente; no se implementó un
scheduler de recordatorios ni envío WhatsApp. No se afirma ninguna notificación
entregada. Señas, fidelidad e ingresos no se simulan ni se deducen de una cita.
Studio conserva su enlace; no se verificó publicación/render de diseños desde
Studio. Esos puntos siguen pendientes de integración, no finalizados.

Archivos: `src/booking/*`, `server/booking/*`,
`src/pages/BusinessWorkspace.tsx`, `tests/verify-living-booking*.mjs` y este documento.
