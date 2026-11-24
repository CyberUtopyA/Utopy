# MS Market: Living Space y Continuidad Viva

## Fuente real de Runtime

Se consume `utopy@2.0.0-beta.3` mediante `file:vendor/utopy-2.0.0-beta.3.tgz`.
El artefacto fue generado con `npm pack` desde el Runtime local existente,
sin publicar npm ni modificar sus fuentes. SHA-1 del paquete:
`98991d39d4f536fcd78b03e684a53ae9bee624a1` (integridad adicional en pnpm-lock).
El tarball debe acompañar el repositorio para instalaciones reproducibles.

Se verificaron y consumen los exports reales `utopy`, `utopy/continuity`,
`utopy/living-space` y `utopy/composition`. Discovery usa
`validateLivingComposition` y `requiredCapabilities`, no un esquema alternativo.
Los envelopes originales se conservan para verificar sus firmas, separados
de los campos sanitizados de presentación.

## Lo implementado y sus límites

- `MarketAuthorityTrust`: anclas públicas explícitas, AuthorityRegistry,
  snapshots firmados con audience, expiración, revisión y revocaciones.
  Actualizaciones serializadas; omitir una clave revocada no la rehabilita
  dentro de la sesión. Una firma autocontenida no establece confianza.
- `LivingSpaceContinuity.receive/request/acknowledge`: contratos reales de
  capacidades, composiciones, handoff y ACK; mismo mt.liveStore y transporte
  `utopy.emit`/Seed/Micelio. Scopes y acceso se verifican antes de proyectar.
  Los payloads firmados no se vuelven a ingerir como DVs legacy anidados.
- Solicitud UI: confirmación explícita, mandato activo para `context.handoff`,
  clave autorizada para el nodo y referencias públicas presentes en el store.
  La UI exige la sesión de Identidad Viva existente y rechaza el dispositivo
  local revocado por wallet o por la proyección de trust.
  TTL de cinco minutos, sin delegaciones ni contenido privado de búsqueda.
  ACK firmado se vincula al hash/revisión/nonce del handoff original y no
  concede permisos de compra, pago, ejecución física ni automatización.
- Replay: guard del Runtime y nonces por actor/nodo en sessionStorage,
  conservados durante recargas hasta su expiración. ACK duplicado rechazado.
  No reemplaza dedupe transaccional persistente del receptor.
- Feed: intención escrita o necesidad propia publicada; disponibilidad,
  relaciones y actividad solo cuando declara consentimiento de personalización.
  Necesidades/ofertas/materiales/trabajos públicos y capacidades verificadas
  se presentan sin inventar preferencias. «Explorar todo» elimina prioridades.
  Ranking textual y territorial ligero: no es comprensión semántica mediante IA.
- `useLivingSpaceNavigation`: estado de navegación en memoria, acotado a ocho
  contextos, sin nueva memoria DV. Mantiene búsqueda, selección canónica,
  proyección, filtros y scroll del Feed del espacio al volver. No guarda
  búsquedas privadas en URLs, almacenamiento persistente ni transporte.
- Feed del espacio, Órbita y Geográfico usan el mismo resultado derivado.
  Feed hasta 80 elementos; Órbita hasta seis; relaciones solo por referencias
  reales. Geográfico muestra el subconjunto ubicado, no inventa coordenadas
  para publicaciones sin ubicación. La página de inicio conserva sus rails
  existentes como resumen del catálogo y las señales públicas.
- Órbita: profundidad CSS y foco, sin WebGL nuevo ni animación permanente;
  reduced-motion y límites existentes. Leaflet sigue siendo un import lazy.
  El service worker existente excluye chunks opcionales pesados del precache.
- Voz: Web Speech solo al tocar, una intervención, cancelación y alternativa
  escrita. Se avisa que el reconocimiento usa el servicio del navegador:
  no se garantiza procesamiento offline; Market no publica la transcripción.
- Caché: mismo store, catálogo público separado de particiones privadas por
  actor/nodo. Al cambiar contexto se retiran datos privados de otros actores
  de memoria. El cache legacy se conserva recuperable y solo se migran tipos
  públicos conocidos; no se migra masivamente contenido privado a otro actor.

No hay ejecutor remoto, iframe con privilegios, código descargable ni motor
de workflows de Market. AR/3D son modalidades opcionales de manifests, no
experiencias implementadas. Simular/Activar permanecen bloqueados hasta contar
con ejecutores reales, mandatos y pruebas. La adaptación de Composition es
un borrador privado, no una revisión firmada activada.
El ACK se muestra como aceptación contextual; no abre por sí solo otra
aplicación ni afirma que un trabajo se realizó. Los resultados/evidencias
pueden ingresar por los envelopes/DV existentes, pero una experiencia remota
completa requiere que el nodo implemente recepción, ACK y resultados.

## Activación progresiva y responsables

1. Operador/Fundación (u otro emisor soberano): configurar
   `VITE_UTOPY_TRUST_ANCHORS` con JWK **públicas** verificadas y
   `VITE_UTOPY_MARKET_NODE_ID` con audience propia. Entregar snapshots
   `authority.trust` vigentes, claves y mandatos actor/nodo. Sin ello la
   integración falla cerrada. Nunca incluir claves privadas en VITE_*.
2. MO/GE/MT/FEDA: anunciar `living.capability.manifest` firmado; lifecycle,
   modalidades, permisos, efectos y refs de presentación reales. No basta
   con tener una URL o manifest legacy. Implementar verificación del receptor,
   consentimiento, ACK firmado y resultados antes de prometer ejecución.
3. Market: instalar el tarball/lockfile, configurar trust, verificar primero
   en pruebas con actores separados y nodos reales. Flags de Runtime previos
   siguen apagados por defecto; esta integración no los activa ni habilita
   autonomía. Recepción de contratos seguros y presentación no dependen de
   habilitar el motor de acciones. Comercio legacy no obtiene autoridad nueva.
4. Receptor/Runtime/operador: dedupe persistente y atómico compartido entre
   pestañas/dispositivos y protección durable contra rollback de trust.
   Actualmente los watermarks/tombstones de trust son de sesión. Un reinicio
   requiere snapshot actualizado; borrar sessionStorage elimina ese historial
   local. No presentar esto como garantía global de exactly-once.

Fundación no es servidor obligatorio: las anclas y emisores son configurables;
el transporte y los contratos no cambian al usar infraestructura compatible.
Esto no demuestra por sí solo una migración operativa completa entre servidores.

## Privacidad y riesgos pendientes

Particionar localStorage no lo cifra ni protege contra XSS/acceso físico.
No se deben introducir secretos o contenido especialmente sensible en ese
cache; se mantienen las políticas del vault existente. Scopes no son cifrado
del transporte: el despliegue de Seed/Micelio debe filtrar audiencia antes de
distribuir datos privados. Este cambio solo envía handoffs con refs públicas.
La protección geográfica reutiliza publicGeoPoint y presencia de nodos;
una operación que precise ubicación exacta debe pedir autorización aparte.
Los bridges y catálogos legacy continúan como contenido, no como fuente de
mandatos/capacidades verificadas. No se corrigieron todos los permisos legacy.
El contrato beta.3 no vincula cada clave de AuthorityRegistry con un deviceId:
el emisor debe revocar también las claves asociadas al dispositivo para que
los receptores remotos lo rechacen, no solo agregarlo a revokedDeviceIds.

## Verificaciones

- `pnpm test:living-space`: confianza, audience, firmas, aislamiento, scopes,
  consentimiento ausente, expiración, handoff/ACK/replay, revocación y rollback,
  carreras de snapshots, rechazo de payload anidado legacy, default-private,
  prioridades y comandos textuales.
  También comprueba caché por actor/nodo, logout, restauración de la partición
  propia y que el payload legacy no amplíe los scopes firmados exteriores.
- `pnpm test:runtime`: verificaciones existentes de Runtime/Frequency.
- `node tests/verify-living-composition-discovery.mjs`: fixture del contrato
  beta.3, matching de capacidades/materiales y restricciones de reutilización.
- Cinco verificaciones de contrato exigidas por AGENTS.md y `pnpm build`.

La compilación PWA y los límites de derivación no son un benchmark de RAM/GPU
en teléfonos. La revisión visual interactiva quedó pendiente: el navegador
integrado falló al conectar (`sandboxPolicy` ausente). Antes de producción,
probar tamaños móvil/tablet, permisos de micrófono, vuelta entre vistas,
sesiones de actores diferentes y handoff/ACK con receptores reales.

## Archivos de esta implementación

- Dependencia/configuración: `package.json`, `pnpm-lock.yaml`,
  `vendor/utopy-2.0.0-beta.3.tgz`, `.env.utopy.example`.
- Adaptadores y contratos: `src/utopy/MarketRuntimeAdapter.ts`,
  `runtimeTrust.ts`, `livingEnvelope.adapter.ts`, `runtimeProjection.security.ts`,
  `livingSpaceContinuity.ts`, `livingCompositionDiscovery.ts`, `boot.ts`.
- Contexto/presentación: `src/utopy/livingSpaceNavigation.ts`,
  `livingSpaceRelevance.ts`, `useLivingCapabilities.ts`, `useContextualVoice.ts`.
- Store/ingesta existentes: `src/mt/mt.liveStore.ts`, `src/mt/mt.ingest.ts`.
- UI existente: `src/components/UnifiedLivingMarket.tsx`,
  `unifiedLivingMarket.css`, `LivingAutomationPanel.tsx`,
  `LivingCapabilityDetails.tsx`, `src/pages/mercado.tsx`,
  `src/pages/circularpanel.jsx`.
- Pruebas: `tests/verify-living-space-continuity.mjs`,
  `tests/verify-runtime-frequency-contract.mjs`,
  `tests/verify-living-composition-discovery.mjs`, y este documento.

El repositorio ya tenía numerosos cambios previos; esta lista no atribuye
esos cambios a la implementación. No se modificaron repositorios externos.
