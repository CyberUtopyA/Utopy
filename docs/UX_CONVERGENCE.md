# Convergencia UX · alcance implementado y deuda

## Inventario y decisiones

| Superficie existente | Duplicación/problema | Unión aplicada |
| --- | --- | --- |
| `LiveNetworkPanel` perfil | Un formulario mezclaba presentación pública, nombre legal, documento, alcance y caja; guardar escribía ambos perfiles | Secciones separadas y escrituras públicas/privadas independientes; un solo formulario de contenido reutilizado en Configuración del avatar y rutas legacy |
| `LivingProfileQuickView` | Editar salía al mapa, Cobrar heredaba el tema oscuro y mostraba dos cierres | Configuración inline con carga diferida; superficie clara de cobro y un solo control de regreso |
| `LivingCashierPanel` | Importe generaba inmediatamente; monedas incondicionales; sin bloqueo de doble clic | Ingreso → medio declarado → revisión → solicitud firmada. Moneda de la capacidad, validación, bloqueo inmediato, referencia estable e idempotencia por solicitud |
| `livingCashier` | Importe sin validación y solicitud nueva en cada llamada | Validación antes de publicar; capacidad verificada; reutilización de una solicitud firmada con los mismos datos, sin marcar pago confirmado |
| `MercadoLocal` Crear | Centro operativo y varios publicadores en primer plano | Crear abre el asistente existente; publicación técnica sigue disponible bajo opciones avanzadas, sin eliminar sus contratos |
| `CircularCenter` Crear | Asistente más dos publicadores adicionales | El flujo principal usa únicamente `LiveNetworkPanel`/`GuidedIntentComposer`; componentes legacy no se borran |
| Centro de producción y Mis pedidos | Dos centros con accesos solapados | Actividad reúne compras y operación. Conserva rutas `tab=producir&section=…` como alias. Muestra acceso operativo con contexto de caja/autoridad existente; cada módulo mantiene su autorización |
| Market y Falcon | Barras inferiores diferentes, Decir/Crear repetidos | Inicio, Explorar, Crear, Actividad, Perfil; voz sigue dentro de la intención, sin otro acceso principal equivalente |
| Perfil/actividad | Mismo DV repetido y etiquetas como voz/resultado vivo usadas como capacidades | Proyección deduplicada por ID/revisión y filtrado de etiquetas técnicas/genéricas. No se borran DVs ni se fusionan actores |
| `LivingResume` | Lenguaje ambiguo sobre videos | Enlaces HTTPS a proyectos/fotos/videos, sin subida, iframe ni reproducción directa |
| Mi Valor, nodos y formularios | Botones/colores/tamaños inconsistentes | Tokens compartidos en `utopyUI.css`; foco visible, acciones de 44px, campos de 16px, superficies perla, carbón, lavanda y lima |

## Conservación

Mismos DV, identidad, firmas, store, Micelio y servicios. No se creó una billetera, un editor visual, otro chat ni un publicador de dominio alternativo. Crear sigue interpretando con la integración simbólica disponible; no se incorporó una LLM ni un matcher nuevo. Cobrar genera una solicitud `open`, nunca un recibo ni un movimiento de dinero. Los destinos privados de otros métodos se conservan al configurar transferencia.

El nombre visible es público y editable. El nombre legal solo se pide en Datos privados cuando la operación lo necesita. No son dos copias del mismo dato ni se obliga a igualarlos. Guardar datos privados no vuelve a publicar la biografía; guardar el perfil no reescribe documento/fecha de nacimiento.

## Límites reales

- Alcance de escritura: este repositorio MS Market/Falcon. Fundación, MO y otros nodos no se modificaron. Unificar sus aplicaciones externas requiere adoptar los mismos tokens/componentes, no fusionar sus backends.
- Fundación Studio sigue siendo el único diseñador visual. Su contrato de publicación hacia Market continúa pendiente según `IDENTITY_STUDIO_ADOPTION.md`; no se renderiza una apariencia no verificada ni se copia el editor.
- No se conectaron pasarelas, tarjetas o ejecutores nuevos. PIX/Bancard solo aparecen si la caja ya los declara; declararlos no prueba la liquidación de un pago.
- El publicador técnico y módulos industriales conservan sus interfaces profundas. La convergencia aquí cambia el punto de entrada y la complejidad progresiva, no afirma haber reescrito todas sus pantallas internas.
- Las pruebas de código no acreditan revisión visual en dispositivos físicos, liquidación bancaria ni un ciclo completo de producción entre nodos.

## Pruebas

### Perfil, Pass y reserva (continuidad)

El perfil estándar y el currículum completo no requieren Pass. El enlace de personalización se muestra solo ante un entitlement Studio activo, verificado, del titular y sujeto correspondientes. Es elegibilidad de interfaz: Studio debe volver a autorizar en servidor; no reemplaza ese control ni completa la sincronización de diseños pendiente.

Las ofertas técnicas de capacidades, pagos, outcomes y títulos genéricos/identificadores no se muestran como ofertas comerciales. Se conservan en DV. Las novedades públicas se abren desde el aro del avatar usando el visor existente; sin novedades no se inventa un aro activo. El currículum se edita en el perfil propio y conserva sus reglas de privacidad.

En Skylines, el editor privado existente se reutiliza dentro de la reserva; el país del documento permanece separado de la jurisdicción de la operación. Tras guardar y verificar, se rellenan nombre, documento y domicilio desde la identidad privada firmada del actor actual. No se utiliza ni se sobreescribe `authUser` como segunda identidad del inquilino. No se inventan fechas ni se omite la revisión final del contrato. El caso completo requiere verificación interactiva con el titular; las pruebas automáticas no firman un contrato real.

`verify-profile-reservation-continuity.mjs` cubre los filtros públicos, aislamiento del Pass por titular/nodo, expiración y prueba de autoridad, acceso al currículum, aro de novedades, campos privados mínimos y la unión inline de reserva. `verify-living-identity-adult.mjs` conserva las reglas de edad y prueba la nueva entrada privada inline.

`verify-unified-experience.mjs`: importes inválidos, precisión, separación de escrituras, revisión/idempotencia, referencias de creación, rutas legacy, deduplicación y sintaxis. Los casos inválidos no publican DVs ni mueven dinero.

Además: contratos de AGENTS, perfil/actividad, currículum, identidad premium y caja territorial. La compilación verifica imports y empaquetado PWA; las advertencias de tamaño del visor 3D preexistente no equivalen a una validación de rendimiento en móviles modestos.
