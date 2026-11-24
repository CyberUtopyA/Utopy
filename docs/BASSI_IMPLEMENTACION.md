# Bassi Coiffure · integración de agenda

Actualización posterior: [corrección de contraste, encabezado y rendimiento](BASSI_CORRECCION_GESTION.md). El encabezado ahora muestra logo y «Bienvenido», sin repetir el nombre comercial.

## Implementado localmente

- Ajuste al segundo render: shell azul noche, cabecera con regreso a Market, nombre y logo superior, botones dorados, tarjetas marfil, categorías con íconos específicos y barra inferior Inicio/Servicios/Citas/Mi cuenta. Navegación y títulos definidos por plantilla, no por identidad. Se reutiliza el calendario funcional completo; no se copian las fechas, duraciones, personas ni slots ilustrativos del render. No se alteran automáticamente configuraciones ya guardadas de un nodo; los nuevos servicios separados sólo son valores iniciales para la creación.

- Rutas `/bassi` y `/bassi/gestionar`, con identidad y autorizaciones existentes. No se concede acceso por nombre comercial.
- Plantilla declarativa `bassi-editorial-salon` en [presentationTemplates.mjs](../src/booking/presentationTemplates.mjs), consumida por la UI y la validación del motor. Tokens y categorías separados de identidad, clientes y horarios. No se encontró otro registro de Plantillas Vivas en este checkout; no se afirma integración con un registro externo no disponible.
- [Preset Bassi](../src/booking/bassi.preset.ts): catálogo inicial editable, sin precios, duraciones, personal ni disponibilidad inventados. Servicios inactivos hasta configuración autorizada.
- Reutilización de BookingExperience, BookingManager, Formularios interactivos, fotos desde galería mediante el uploader existente, horarios, descansos, excepciones, cancelación y reagendamiento. Ningún backend paralelo.
- Cualquier salón puede usar el preset con su propio nombre y nodo; la plantilla visual no contiene datos comerciales de Bassi.
- Gestión conserva los accesos existentes a Studio, con Pass. Datos Vivos, identidad y permisos siguen por los contratos existentes. No se duplicó Currículum Vivo ni Soporte Vivo; no se inventaron integraciones adicionales no encontradas.
- LUA conserva su ruta, preset y assets. No se modificaron planes, cobros ni períodos de prueba. No se encontró un contrato de prueba comercial de 15 días en este checkout: no se implementó otro ni se garantiza su activación.

## Pendientes reales antes de operar en producción

1. Se encontraron en Descargas el logo original `5c0310af-c3f1-4530-9dd2-cf2870ffdce3.png` y un fondo de salón `e5dff276-7a58-4a62-b0db-dc78d10e57e7.png`. Se incorporaron sin redibujar. El fondo se comprimió a JPEG calidad 82, conservando su tamaño, sin alterar el original. Faltan los archivos locales de las cuatro fotos de servicios y del fondo exacto adicional que se ven en la conversación. No se generaron rostros ni sustituciones. La UI permite configurar sus URLs HTTPS y subir fotos con el adaptador existente del nodo.
2. Crear/seleccionar el nodo con una identidad persistente y consentimiento desde `/bassi/gestionar`. Esto crea un manifiesto firmado real mediante el mecanismo de cualquier nodo, no una cuenta ficticia. No se ejecutó en nombre del propietario ni se asignó un ID inventado.
3. Conectar el endpoint de living-booking autorizado e instalar el manifiesto firmado en el host existente. Añadir a la raíz pública `bassi-node.json` con `{ "nodeId": "ID_REAL_FIRMADO" }`. No sobrescribir la vinculación de LUA. El servidor admite múltiples nodos mediante sus permisos; conservar base, claves y configuración privadas fuera de public_html.
4. Completar profesionales reales, duración, precios opcionales y disponibilidad; guardar en el backend. Verificar el descubrimiento público y que las clientas ven slots del mismo nodo desde otro dispositivo.
5. El servidor debe incluir los contratos actualizados y `presentationTemplates.mjs`. El empaquetador Node ya incluye ambos.

Sin nodo conectado se muestra explícitamente «Agenda en preparación». No se simulan reservas, publicaciones ni disponibilidad.

## Verificación

Archivos modificados: [App.jsx](../src/App.jsx), [BassiPage.tsx](../src/pages/BassiPage.tsx), [bassi.preset.ts](../src/booking/bassi.preset.ts), [presentationTemplates.mjs](../src/booking/presentationTemplates.mjs), [bassiEditorial.css](../src/booking/bassiEditorial.css), [BookingExperience.tsx](../src/booking/BookingExperience.tsx), [BookingSetup.tsx](../src/booking/BookingSetup.tsx), [activate.ts](../src/booking/activate.ts), [contracts.mjs](../src/booking/contracts.mjs), [botonintruction.tsx](../src/components/botonintruction.tsx), [empaquetador web](../scripts/package-lua-cpanel.ps1), [empaquetador Node](../scripts/package-lua-node.ps1), [pruebas](../tests/verify-bassi-booking.mjs) y assets Bassi originales/optimizados.

Empaquetado web: `./scripts/package-lua-cpanel.ps1 -Name BASSI`. Extraer junto al índice actual, sin borrar assets, API, configuración ni bases. No es instalación limpia ni actualiza el backend. Node: `./scripts/package-lua-node.ps1 -Name BASSI`, instalar sólo en el directorio privado de la aplicación Node, nunca en public_html; conservar claves, manifiestos y base existentes. Se requiere el host autorizado para el nodo nuevo, no sólo subir el ZIP.

`node --experimental-sqlite tests/verify-bassi-booking.mjs`: configuración, catálogo sin datos inventados, aislamiento, doble reserva concurrente, descanso, reagendamiento, cancelación y persistencia SQLite tras reapertura. Datos de prueba separados, con simulation/nonTradable; autorización de fixture, no producción.

También ejecutar cinco contratos AGENTS, pruebas de LUA, premium-booking y `pnpm build`. No se verificó navegador móvil ni despliegue en market.utopy.live; no se afirma fidelidad visual final sin los archivos de imagen.

Para hosting Apache, conservar reglas existentes. Si aún no hay fallback SPA, integrar después de excepciones de API: `RewriteRule ^bassi(?:/gestionar)?/?$ /index.html [L]`. Nunca reemplazar todo `.htaccess`.
