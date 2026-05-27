# AGENTS.md — UTOPY / MT / Liquidity / Presence / Micelio / Salud Viva

## Propósito del repo

Este repositorio implementa el ecosistema UTOPY como una red de Datos Vivos:

- **MT / MS Market**: mercado vivo, productos, ofertas, pedidos, checkout, caja, documentos, presencia.
- **Liquidity / UTOPY Pay Libre**: pagos como DV, trust, reintegro vivo, escrow, crédito, saldo vivo y Bolsa Viva.
- **Presence / Proximity**: señales de cercanía, disponibilidad, acciones contextuales y oportunidades cercanas.
- **Bolsa Viva**: capacidad real convertida en liquidez viva.
- **Micelio**: memoria semántica, interpretación universal/local de DVs y resonancia.
- **MO / GE / Falcon**: nodos de diseño, fabricación, energía, comercio curado y territorios vivos.
- **Salud Viva**: visión futura de puestos locales sostenidos por comunidad, membresía, fondo solidario y cobertura complementaria regulable.

## Principio central UTOPY

UTOPY no es una app cerrada. Es una red viva de DVs.

> El DV es universalmente legible, localmente interpretable y simbióticamente accionable.

Ningún DV debe quedar mudo:

- `sem.dv.read` = lo reconocí mínimamente.
- `sem.dv.answer` = lo interpreté con contexto.
- `sem.dv.outcome` = actué y hubo resultado.

Arquitectura mental:

```txt
DV = semilla universal portable
Micelio = suelo interpretativo / memoria local
Presence = señal de vida y cercanía
Liquidity = valor circulante
Bolsa Viva = capacidad real convertida en liquidez
Matcher / Resonador = une necesidad, capacidad, presencia, trust y liquidez
Outcome = memoria de lo que ocurrió
```

## Convención DV obligatoria

Los Datos Vivos deben mantener esta forma base:

```ts
export type DVLike = {
  id: string;
  kind: string;
  ts?: number;
  traits?: string[];
  meta?: {
    ns?: string;
    scopes?: string[];
    schema?: string;
    by?: string;
    ttl_ms?: number;
    pinned?: boolean;
    [key: string]: any;
  };
  attrs?: Record<string, any>;
  labels?: string[];
};
```

Reglas:

- No usar `title`, `description`, `icon` como verdad universal del protocolo.
- Usar `kind`, `traits`, `attrs`, `meta`, `labels[]` como núcleo.
- `labels[]` es capa humana opcional.
- La UI debe resolver visualización localmente o con resonancia semántica.
- No convertir DVs en tablas rígidas si se puede usar eventos vivos.
- No romper DVs existentes por cambiar nombres de campos sin compatibilidad.

## Namespaces y scopes

Preferencias actuales:

```txt
ns: "mt"
ns: "mt:market"
ns: "mt:liquidity"
ns: "mo:plan"
ns: "energy:diagram"
ns: "health"
```

Scopes usuales:

```txt
["public"]
["public", "world:<id>"]
["public", "territory:<id>"]
```

Usar `territory:<id>` para capas territoriales cuando se hable de Bolsa Viva, salud comunitaria, reciclaje, proximity local o comercios cercanos.

## Publicación DV

Usar el patrón real de MT:

```ts
emitUtopyDV(dv, "mt")
```

El publicador debe:

1. Hacer upsert local si existe `window.mtLiveUpsert`.
2. Emitir `window.dispatchEvent(new CustomEvent("utopy.emit", ...))`.
3. Opcionalmente emitir `window.dispatchEvent(new CustomEvent("mt:dv", ...))`.

Nunca inventar helpers como `withSpore` o `publishDatoVivo` dentro de componentes si el proyecto ya usa `emitUtopyDV`.

## Archivos esperados

Mantener o crear estos módulos:

```txt
src/mt/mt.liquidity.ts
src/mt/liquidity.publish.ts
src/mt/liquidity.actions.ts
src/mt/utopyPay.actions.ts
src/mt/UtopyCommercePay.tsx

src/mt/bolsaViva.ts
src/mt/bolsaViva.actions.ts
src/mt/BolsaVivaPanel.tsx
src/mt/ReintegroWallet.tsx

src/mt/proximityLiquidity.match.ts
src/mt/matchToPresence.ts
src/mt/utopy.resonance.ts
src/mt/useUtopyResonance.ts
src/mt/UtopyNeedComposer.tsx

src/utopy/micelio/universalDvResonator.ts

src/utopy/presence/presence.types.ts
src/mt/presence/*
```

No pasa nada si algunos no existen todavía; crearlos cuando la tarea lo pida.

## Liquidity / UTOPY Pay Libre

`src/mt/mt.liquidity.ts` es el núcleo de Liquidity.

Regla fundamental:

> El saldo no es una verdad central guardada en una tabla. El saldo se calcula reduciendo DVs.

Eventos principales:

```txt
liq.issue
liq.redeem
liq.transfer
liq.lock
liq.unlock
liq.credit.line
liq.trust
liq.escrow.open
liq.escrow.release
liq.escrow.refund
liq.credit.consume
liq.credit.repay
liq.settlement.batch
```

UTOPY Pay Libre debe permitir que cualquier comercio cobre por medios actuales:

```txt
cash
bank_transfer
qr
pos_card
wallet
crypto_external
other
```

Pero UTOPY debe convertir ese pago en DVs:

```txt
payment.session.open
payment.session.status
liq.issue
liq.trust
utopy.reintegro.vivo
```

Frase de producto:

> Cobrá como siempre. UTOPY convierte cada pago en confianza, reintegro vivo y liquidez para futuras relaciones.

Importante:

- UTOPY Pay no debe prometer reemplazar bancos, QR, POS o regulación.
- UTOPY actúa como capa viva de registro, confianza, reintegro y coordinación.
- La liquidación real puede ser externa.
- `utopyFee` puede ser `0` para operaciones internas DV.

## Bolsa Viva

Definición:

> UTOPY Bolsa Viva es un protocolo libre de comercio recíproco donde cualquier nodo puede transformar su capacidad real en liquidez viva. Esa liquidez puede circular entre personas, comercios y territorios según confianza, presencia, utilidad y cumplimiento.

Regla central:

> Cualquiera puede crear liquidez, pero solo la confianza la hace circular.

DVs base:

```txt
liq.origin
liq.acceptance.rule
liq.exchange.offer
liq.exchange.accept
utopy.reintegro.vivo
utopy.value.accept
utopy.value.outcome
```

Bolsa Viva no debe presentarse como una moneda regulada, acción, valor mobiliario o promesa financiera sin estructura legal. En UI usar lenguaje de:

```txt
valor vivo
reintegro
crédito de comercio
membresía
precompra
saldo local
fondo solidario
beneficio
aceptación por confianza
```

## Presence / Proximity / Matcher

Flujo vivo:

```txt
need.request
+ presence.signal
+ capability.offer
+ liquidity/trust
+ bolsa viva
= match.proposal
+ notification.signal
+ PresenceScanInput
```

El usuario no busca proveedores. Emite una necesidad y la red encuentra nodos capaces de resolverla.

Reglas del matcher:

- Considerar presencia/cercanía.
- Considerar capacidad (`capability.offer`, `node.capability`, `work:skill`, traits).
- Considerar liquidez (`liq.issue`, `liq.credit.line`, `liq.trust`, spendable).
- Considerar Bolsa Viva (`liq.origin`, `liq.acceptance.rule`, `utopy.reintegro.vivo`).
- Convertir resultados a Presence UI con `matchToPresence.ts`.
- No mostrar jerga técnica al usuario final.

## Micelio / Resonador Universal

Próximo bloque técnico clave:

```txt
src/utopy/micelio/universalDvResonator.ts
```

Debe implementar:

```ts
buildUniversalDVRead(dv, ctx)
buildOrientationAnswer(dv, ctx)
resonateAnyDV(dv, ctx)
```

Regla:

> Nunca devolver null completo. Siempre devolver lectura mínima.

Niveles:

```txt
sem.dv.read     = lo reconocí mínimamente
sem.dv.answer   = lo interpreté con contexto
sem.dv.outcome  = actué y hubo resultado
```

Todo DV, incluso desconocido, debe poder producir al menos `sem.dv.read`.

## Salud Viva / Puesto Vivo

Visión futura:

> UTOPY Salud Viva permite que puestos locales de salud sean sostenidos por comunidad, membresías, fondos solidarios, servicios prepagos, trust y cobertura complementaria regulable.

Tratar con cuidado:

- No vender “acciones” de salud sin estructura legal.
- No prometer “seguro” formal sin regulación.
- Usar lenguaje inicial: membresía, fondo solidario, prepago de servicios, créditos de salud, cobertura complementaria, red de atención, historial DV.
- Aliarse con profesionales habilitados, farmacias, laboratorios o entidades reales cuando se implemente.
- Cualquier función médica debe evitar consejos clínicos automáticos de alto riesgo.

DVs posibles:

```txt
health.post.origin
health.membership
health.coverage.pool
health.service.credit
health.visit.intent
health.visit.outcome
health.referral
health.provider.trust
health.supply.need
liq.origin
liq.acceptance.rule
utopy.reintegro.vivo
```

Principio:

> La salud no debe tratarse como especulación. Debe tratarse como infraestructura viva comunitaria.

## Estilo de código

- TypeScript.
- React.
- Evitar dependencias nuevas si no son necesarias.
- Preferir builders puros + acciones de publicación separadas.
- Evitar componentes gigantes si se puede modularizar.
- No romper imports existentes.
- Si aparece un import viejo como `./liquiditypublish`, corregir a `./liquidity.publish`.
- Usar nombres claros y estables.
- Mantener compatibilidad hacia atrás con DVs anteriores.
- No tocar lógica masiva sin entenderla primero.

## UI

Estilo visual preferido:

- UTOPY minimalista.
- Glass / bordes redondeados.
- Mobile-first.
- Legible en celular/tablet.
- No mostrar demasiada jerga DV al usuario final.
- Textos humanos: “valor vivo”, “reintegro”, “confianza”, “oportunidad cercana”, “resonancia encontrada”.

## Testing / verificación

Antes de terminar una tarea, revisar `package.json`.

Intentar ejecutar comandos equivalentes:

```bash
pnpm install
pnpm typecheck
pnpm build
```

Si no existen scripts:

```bash
pnpm lint
pnpm test
npm run build
npm run typecheck
```

Al final reportar:

- Archivos creados/modificados.
- Errores encontrados.
- Comandos ejecutados.
- Lo que falta.

## Forma de trabajo esperada

Para cada tarea:

1. Leer archivos relevantes.
2. Identificar imports reales y rutas.
3. No duplicar módulos si ya existen.
4. Parchear lo mínimo funcional.
5. Mantener arquitectura DV-first.
6. Crear código usable, no solo conceptual.
7. Verificar TypeScript/build si es posible.
8. Explicar cambios al final.

## Prioridad actual

La prioridad inmediata es hacer funcional:

```txt
UTOPY Pay Libre
+ mt.liquidity.ts
+ liquidity.publish.ts
+ utopyPay.actions.ts
+ UtopyCommercePay.tsx
```

Luego seguir con:

```txt
BolsaVivaPanel
ReintegroWallet
UtopyNeedComposer
utopy.resonance
universalDvResonator
Salud Viva MVP
```
