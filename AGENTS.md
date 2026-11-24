# UTOPY · Reglas del proyecto para Codex

## Arquitectura

- UTOPY es una red de nodos y Datos Vivos; no es una tesorería central.
- `src/mt/mt.liveStore.ts` es el store vivo compartido de MS Market.
- Micelio/Seed transporta los mismos DVs; no crear un bus paralelo.
- Liquidity reconstruye liquidez desde eventos, nunca desde un saldo global
  tomado como verdad única.
- UTOPY Pay es la interfaz sencilla; Liquidity, Micelio y Escudo trabajan detrás.
- Aportes Vivos modela materiales, trabajo, equipos, conocimiento, logística y
  compromisos de clientes. No convertirlos automáticamente en acciones,
  inversiones o derechos negociables.
- Perfil Vivo y Feed Vivo son proyecciones del mismo conjunto de DVs. No crear
  una base, timeline o store social separado.
- El Mapa Vivo es contextual: prioriza identidad, señal activa, hilo,
  compatibilidad semántica, cercanía aproximada y vigencia. No mostrar un mapa
  global de personas como relleno.
- Bóveda Viva es una proyección privada de comprobantes, confianza, sellos y
  derechos. No crear otro store, una moneda o una tabla central de saldo.

## Convención DV

Todo DV conserva `id`, `kind`, `attrs`, `traits` y `meta`.

- Usar IDs estables cuando el DV representa estado actual.
- Incrementar `meta.version` y `meta.updatedAt` al actualizar.
- Conservar `authority`, `originNode`, `ns`, `scopes` y `threadId`.
- Publicar con el helper existente hacia `mtLiveStore` y Micelio.
- No renombrar campos existentes sin adaptador de compatibilidad.

## Reglas de diseño

- Nunca hardcodear LaPiedra, DecoHogar, MO, Madefer o Falcon dentro de un
  algoritmo. Esos nombres solo pueden existir en seeds, demos o configuración.
- Las interfaces leen identidad y capacidades desde DVs.
- Mostrar lenguaje humano y poco texto; colocar explicación secundaria bajo `?`.
- No hardcodear profesiones dentro del matcher. Las categorías humanas son una
  ayuda de interfaz; la capacidad real proviene del contenido del DV.
- No publicar ubicación exacta de una persona en el Feed o Mapa. Redondear la
  zona pública y requerir acuerdo para compartir una dirección precisa.
- Ningún aporte, pago, crédito o compensación se acepta sin consentimiento.
- Las pruebas económicas deben llevar `simulation:true`,
  `nonTradable:true` y no mover dinero real.
- No crear un segundo catálogo, un segundo store ni duplicar movimientos
  Liquidity.
- Un sello debe tener ID estable por programa + comprobante.
- Un derecho de beneficio siempre es `nonTradable:true`, personal y de un solo
  uso. No genera rendimiento por conservarlo.
- Un nodo solo puede aceptar un derecho si publicó una regla
  `benefit.acceptance` compatible; nunca inferir aceptación por el nombre del
  comercio.

## Verificación

Después de modificar TypeScript o React:

```bash
node tests/verify-contract.mjs
node tests/verify-utopy-pay-contract.mjs
node tests/verify-value-contribution-contract.mjs
node tests/verify-live-network-contract.mjs
node tests/verify-living-vault-contract.mjs
```

También ejecutar el build o typecheck real de MS Market cuando estén
disponibles todas sus dependencias.
