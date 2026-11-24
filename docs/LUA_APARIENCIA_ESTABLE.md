# LUA · apariencia estable

- [luaAppearance.css](../src/booking/luaAppearance.css): elimina visualmente la rayita del inicio, conserva fondo cálido, fija `color-scheme: only light` en LUA y define colores de texto, campos nativos, placeholders, calendario, pestañas, navegación y gestión. La paleta no depende de la preferencia de tema del teléfono. No altera el diseño de otros presets.
- [BookingExperience.tsx](../src/booking/BookingExperience.tsx) carga estos estilos también cuando el nodo se abre por su ruta general.
- [LuaPage.tsx](../src/pages/LuaPage.tsx) identifica con el mismo preset la pantalla de acceso a gestión.
- Se conservan el logo, la fotografía, el motor de reservas y las optimizaciones previas. No se añaden animaciones, filtros pesados ni dependencias.

[verify-lua-appearance.mjs](../tests/verify-lua-appearance.mjs) verifica alcance de estilos, paleta independiente del tema del sistema, controles, contraste de colores base >=4.5:1 y enlace del preset. No representa una prueba visual en iOS/Android ni garantiza el comportamiento de extensiones que fuerzan colores del sitio.

ZIP web acumulado: extraer junto al índice existente, reemplazar incluidos, no borrar assets/API/configuración/bases ni datos del navegador. Ctrl+F5. No requiere parches anteriores ni reinstalar Node para esta corrección visual. Si la agenda no estaba conectada, estos estilos no la habilitan por sí solos.
