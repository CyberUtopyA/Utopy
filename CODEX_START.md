# CODEX_START.md — Arranque rápido UTOPY

## Objetivo inmediato

Hacer funcional hoy la base de:

```txt
UTOPY Pay Libre
+ MT Liquidity
+ Presence / Proximity
+ Bolsa Viva
+ Resonador Universal de DV
```

El foco inicial no es crear una fintech ni reemplazar bancos.  
El foco es que cualquier comercio pueda cobrar como siempre y que UTOPY convierta ese pago en DV vivo.

## Qué debe funcionar primero

Crear o corregir:

```txt
src/mt/liquidity.publish.ts
src/mt/utopyPay.actions.ts
src/mt/UtopyCommercePay.tsx
```

Debe emitir:

```txt
payment.session.open
payment.session.status
liq.issue
liq.trust
utopy.reintegro.vivo
```

Debe usar como base:

```txt
src/mt/mt.liquidity.ts
```

No romper:

```txt
issueFromPaymentStatus()
trustFromPaymentStatus()
reduceAccountSummary()
reduceTrustForActor()
reduceTrustByCounterparty()
```

## Flujo UTOPY Pay Libre

```txt
1. Comercio crea pago.
2. Cliente paga por efectivo / transferencia / QR externo / POS / billetera.
3. Comercio confirma pagado.
4. UTOPY emite payment.session.status.
5. Liquidity genera liq.issue.
6. Trust genera liq.trust.
7. Sistema genera utopy.reintegro.vivo.
8. Todo queda como DV para Micelio, Presence, Bolsa Viva y futuros matches.
```

## Regla de producto

Usar esta frase:

> Cobrá como siempre. UTOPY convierte cada pago en confianza, reintegro vivo y liquidez para futuras relaciones.

No decir:

```txt
UTOPY reemplaza bancos
UTOPY es seguro financiero
UTOPY vende acciones
UTOPY promete ganancias
```

## Archivos a revisar primero

Leer:

```txt
AGENTS.md
src/mt/mt.liquidity.ts
src/mt/liquidity.store.ts
src/mt/liquidity.publish.ts
src/mt/utopyPay.actions.ts
src/mt/UtopyCommercePay.tsx
package.json
```

Si algún archivo no existe, crearlo.

## Prompt inicial para Codex

Copiar y pegar en Codex:

```txt
Leé AGENTS.md y CODEX_START.md.

Tarea:
Implementar UTOPY Pay Libre funcional.

Revisá si existen:
- src/mt/mt.liquidity.ts
- src/mt/liquidity.publish.ts
- src/mt/utopyPay.actions.ts
- src/mt/UtopyCommercePay.tsx
- src/mt/liquidity.store.ts

Objetivo:
Que cualquier comercio pueda crear un pago, confirmar que fue pagado por efectivo/transferencia/QR externo/POS, y que se emitan estos DVs:
- payment.session.open
- payment.session.status
- liq.issue
- liq.trust
- utopy.reintegro.vivo

Reglas:
- No reemplazar banco, QR o POS todavía.
- UTOPY es la capa viva de DV, liquidity, trust y reintegro.
- Usar mt.liquidity.ts como núcleo.
- Usar emitUtopyDV(dv, "mt").
- Si hay import viejo "./liquiditypublish", corregir a "./liquidity.publish".
- No romper imports existentes.
- Crear componente UI simple si no existe.
- El componente debe llamarse UtopyCommercePay.
- Debe ser usable desde CheckoutModal, CajerosPanel o cualquier pantalla de comercio.

Al final:
- Corré typecheck/build según package.json.
- Decime archivos modificados y errores encontrados.
```

## Segunda tarea después de Pay Libre

Cuando Pay Libre compile, pedir:

```txt
Crear BolsaVivaPanel y ReintegroWallet.

BolsaVivaPanel:
- permite a un comercio crear liq.origin
- permite crear liq.acceptance.rule
- muestra qué liquidez emite y acepta

ReintegroWallet:
- muestra utopy.reintegro.vivo del comprador
- muestra valor vivo usable
- muestra comercios o nodos que aceptan ese valor
```

## Tercera tarea

```txt
Integrar Presence / Proximity / Liquidity.

Crear o corregir:
- src/mt/proximityLiquidity.match.ts
- src/mt/matchToPresence.ts
- src/mt/utopy.resonance.ts
- src/mt/useUtopyResonance.ts
- src/mt/UtopyNeedComposer.tsx

Objetivo:
need.request + presence.signal + capability.offer + liquidity/trust + bolsa viva
= match.proposal + notification.signal + PresenceScanInput
```

## Cuarta tarea

```txt
Crear universalDvResonator.ts.

Debe implementar:
- buildUniversalDVRead(dv, ctx)
- buildOrientationAnswer(dv, ctx)
- resonateAnyDV(dv, ctx)

Regla:
Nunca devolver null completo.
Cualquier DV debe generar sem.dv.read.
Si hay contexto local, generar sem.dv.answer.
Si hay acción, generar sem.dv.outcome.
Si no puede actuar, orientar hacia nodos compatibles.
```

## Quinta tarea: Salud Viva MVP

Crear capa inicial:

```txt
src/mt/healthViva.ts
src/mt/healthViva.actions.ts
src/mt/HealthVivaPanel.tsx
```

DVs:

```txt
health.post.origin
health.membership
health.coverage.pool
health.service.credit
health.visit.intent
health.visit.outcome
```

Regla:
No vender acciones ni seguros formales. Usar lenguaje de membresía, fondo solidario, prepago de servicios y cobertura complementaria regulable.

## Estructura ideal

```txt
src/
  mt/
    mt.liquidity.ts
    liquidity.store.ts
    liquidity.publish.ts
    liquidity.actions.ts

    utopyPay.actions.ts
    UtopyCommercePay.tsx

    bolsaViva.ts
    bolsaViva.actions.ts
    BolsaVivaPanel.tsx
    ReintegroWallet.tsx

    proximityLiquidity.match.ts
    matchToPresence.ts
    utopy.resonance.ts
    useUtopyResonance.ts
    UtopyNeedComposer.tsx

    healthViva.ts
    healthViva.actions.ts
    HealthVivaPanel.tsx

  utopy/
    micelio/
      universalDvResonator.ts
    presence/
      presence.types.ts
```

## Checklist antes de cerrar una tarea

- [ ] No hay imports rotos.
- [ ] No se duplicó `liquidity.publish.ts`.
- [ ] No existe `liquiditypublish` viejo.
- [ ] `emitUtopyDV(dv, "mt")` publica correctamente.
- [ ] UI no muestra jerga excesiva.
- [ ] TypeScript compila o se reportan errores claros.
- [ ] El resumen final indica archivos modificados.
