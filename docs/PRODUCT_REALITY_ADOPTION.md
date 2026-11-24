# Material visual y dimensiones auténticas · 2026-10-21

`productReality.ts` lee únicamente referencias publicadas del producto existente. No crea catálogo, store, modelo, foto, video ni medidas. `ProductRealityPanel` se incorpora a `UniversalProductDialog` conservando consulta/checkout originales, perfil, precio y fuente. La experiencia pública general y los nodos existentes no se rediseñan.

Las medidas necesitan unidad explícita y valor positivo. Se conservan sus declaraciones de procedencia, sin convertirlas en certificación. Se admiten dimensiones w/h/d solo si publican unidad m/cm/mm. La cámara no llena campos. Videos y GLB se muestran solo cuando están referenciados; el visor instalado `@google/model-viewer` se carga bajo demanda. La escala/soporte AR y el archivo dependen del vendedor y dispositivo. Hay estados de error sin contenido sustituto ficticio.

URLs: solo HTTP(S) de mismo origen o HTTPS externo, sin credenciales y sin destinos locales/privados externos conocidos; no se admiten data/javascript. Videos y GLB requieren extensión publicada compatible, no una inferida desde un query. No hay cargas anticipadas de modelo/cámara/micrófono.

El nuevo producto de valoración de MO usa el contrato comercial existente `mt.product`, para consulta (`quote_only`, `saleEnabled:false`, `available:false`), sin stock. La ficha bloquea Comprar cuando la disponibilidad no está declarada, es contradictoria o solo se ofrece consulta. No cambia createSale, inventario, cuotas, contratos ni pagos. El schema.org tampoco declara stock por defecto. Se retiró una marca de vendedor verificado que se mostraba sin evidencia.

La cotización/régimen de costo en MO permanece privada. No se importa su cálculo al frontend de Market: el comprador recibe precio y medidas públicas, no costos/ganancias ni una segunda copia de la regla del negocio. El código canónico de valoración vive en MO como capacidad local instalable en el sandbox del Runtime, sin cambio de Core ni LLM obligatoria.

`tests/verify-product-reality.mjs` verifica proyecciones, unidades ausentes, datos estimados, rutas seguras, cotización no comprable, ausencia de check incondicional y transformaciones TSX. No verifica archivos externos, recepción de publicación, escala/calibración ni un dispositivo AR real. QA visual móvil/escritorio no disponible: el inventario de control de navegador de la sesión está vacío.
