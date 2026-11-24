# Imágenes · carga más ligera

Se conservan los originales. El [optimizador repetible](../scripts/optimize-booking-images.ps1) cambia sólo tamaño/codificación de copias: fotos JPEG calidad 82–86 y logos PNG RGBA, sin generar imágenes ni alterar su contenido.

| Recurso | Antes | Versión para pantalla |
|---|---:|---:|
| Portada LUA | 2.093.736 bytes | 45.962 bytes (720px), 112.946 bytes (1200px) |
| Logo LUA | 427.330 bytes | 80.575 bytes (600px) |
| Portada Bassi | 133.615 bytes JPEG ya optimizado | 81.059 bytes (640px), 133.555 bytes (941px) |
| Logo Bassi | 589.586 bytes | 144.251 bytes (640px) |

La portada LUA reduce el peso de descarga entre 94,6% y 97,8% según la variante elegida. Esto NO equivale a garantizar ese porcentaje de mejora de tiempo total: influyen red, caché, servidor y dispositivo. Se inspeccionaron visualmente la portada JPEG y el logo reducido como archivos, no como página en un teléfono.

## Entrega

- [LUA](../src/pages/LuaPage.tsx) y [Bassi](../src/pages/BassiPage.tsx) importan las variantes ligeras con srcSet. El navegador elige según pantalla y densidad; no se fuerza una imagen pequeña en todas las pantallas.
- [BookingExperience](../src/booking/BookingExperience.tsx) da prioridad alta a la portada, decodificación asíncrona, carga diferida de galería y servicios. Si el negocio configuró su propia portada, esa URL mantiene prioridad y NO recibe srcSet de las fotos locales.
- [Tarjetas](../src/components/LiveProductCard.tsx) y [feed](../src/components/UnifiedLivingMarket.tsx): prioridad a la primera tarjeta del rail principal, carga diferida de las demás y avatares con tamaño reservado/decodificación asíncrona.
- [Política de assets](../src/utils/publicAssetPolicy.js) y [Vite](../vite.config.js): caché de JPEG compilados con hash, igual que PNG/WebP. No se añade caché a pruebas privadas, API, URLs con tokens ni fotos arbitrarias de terceros.

Los archivos originales grandes siguen en el repositorio, pero no se importan en la portada y no forman parte del nuevo build si no tienen otros consumidores. No se borra ningún medio del hosting.

## Límites

Las fotos remotas de cada nodo conservan su origen y permisos. Lazy loading y prioridades no reducen sus bytes: para servirlas en tamaños menores, el propietario debe usar la compresión de subida ya existente o su proveedor debe ofrecer variantes. No se instaló un CDN, un proxy de imágenes ni una integración ficticia. No se cambiaron inventarios, precios, identidad, pagos o permisos.

Pruebas: [verify-image-delivery.mjs](../tests/verify-image-delivery.mjs), contratos AGENTS, regresión de LUA/Bassi, política de assets y build. Los ZIP web son acumulativos, sin servidor ni medios antiguos sin cambios; no requieren reinstalar Node ni borrar datos del navegador.
