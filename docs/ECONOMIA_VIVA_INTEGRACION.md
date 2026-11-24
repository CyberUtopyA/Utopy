# Economía Viva — auditoría e integración

## EXISTENTE / PARCIAL / FALTANTE

| Capacidad | Estado observado | Fuente reutilizada |
|---|---|---|
| Identidad, firma, autoridad y revocación | Existente; la proyección exige comprobación previa | `identityContext`, `authorizedPublish`, Runtime Identity/Authority |
| Living Liquidity, Economic Routes y Margin Guard | Existente en Runtime `utopy@2.0.0-beta.3`; no equivale a proveedor conectado | `utopy/liquidity`: `acceptedEconomicRoutes`, `evaluateEconomicRoute`, `authorizeEconomicRoute` |
| Settlement y seguridad de entrega | Motor existente; integración financiera operativa parcial | `projectSellerSettlement`, `evaluateSellerDeliverySafety` |
| Intención, formulario y composición | Existente; se reutiliza interpretación local de sólo lectura | `projectLivingInterface`, `LivingCompositionEngine`, sandbox y SDK existentes |
| Pago directo, cuotas, pagarés, inventarios, fidelidad | Existentes; sus ejecutores no se modificaron | checkout, `src/pay`, `src/commercial`, `src/loyalty` |
| Mi Valor / tarjetas | Existente dentro del modal de identidad | `BovedaVivaPanel`, `LivingProfileQuickView` |
| Registro contable directo | Biblioteca servidor existente, no servicio financiero desplegado | `server/economy/journal.mjs`, doble entrada e idempotencia |
| Proveedor de cuenta, split, liquidación y retiro | Faltante en la integración auditada | No hay adaptador financiero autorizado conectado a Mi Valor |
| Flujo económico completo multiparte activado | Parcial: contratos disponibles, no ejecución integrada verificada | Requiere mandatos, proveedor, evidencia y conciliación en el límite de cada nodo |

Los caminos sugeridos por `CODEX_START.md` bajo `src/mt/mt.liquidity.ts` y
`utopyPay.actions.ts` no existen en esta revisión. No se crearon duplicados:
el código vigente está en `src/liquidity` y `src/pay`.

## Cambios de esta integración

- Proyección de pagos privados verificados: registrado por comercio, pendiente,
  fallido, cerrado o devolución declarada. No son cuentas bancarias ni una
  prueba del proveedor. La recepción/aceptación de una entrega no implica pago.
- Corrección del anticipo: se muestra el importe confirmado, no el precio total
  como si se hubiera pagado por completo. Las decisiones financieras verificadas
  se incluyen para respetar los anticipos admitidos por el checkout existente.
- Alerta de discrepancia si un pedido cerrado conserva un pago registrado;
  solicita revisar comprobantes sin crear una devolución automática.
- Exclusión de eventos públicos y simulaciones también en la evidencia asociada,
  no únicamente en la orden inicial. No se incorporó otro store ni otro bus.
- Consulta por texto y voz dentro de Mi Valor. Runtime interpreta únicamente
  capacidades de lectura propias: movimientos, pendientes y relaciones. La voz
  reutiliza el hook existente y puede usar el servicio del navegador; el texto
  se interpreta localmente sin LLM. No se publica la consulta, ni se ejecutan
  capacidades financieras, se cambian beneficiarios o se crean consentimientos.
- El adaptador de rutas expone las funciones canónicas de Runtime, sin volver
  a implementar cotización, firma de ruta, margen o settlement.
- Mis tarjetas y beneficios conserva su ubicación junto a Mi economía. Las
  tarjetas de fidelidad no se presentan como tarjetas bancarias.

## Límites reales, no finalización ficticia

Retirar y Enviar permanecen deshabilitados tanto en UI como en el contrato de
retiros. `available` y `pendingSettlement` siguen siendo `null`, no cero ni
ventas convertidas en saldo. Una firma del comercio no acredita fondos reales.

La lista actual es una proyección por pedido del comprador, no un libro de todos
los asientos ni el ingreso del negocio. Para mostrar ingresos/cuentas por cobrar
de un nodo hace falta su contexto de administración autorizado. No se leen datos
de otro titular para completar esta pantalla.

No se añadieron cobros de comisión, repartos, obligaciones nuevas, servicios de
custodia, credenciales, tokens financieros, retiros o transferencias de prueba.
Si hay varios participantes, los contratos de Runtime deben conservar cada
derecho y evidencia; sin split del proveedor no puede declararse una liquidación.
Las obligaciones reales deben proceder del contrato/mandato correspondiente, no
deducirse o inventarse desde los participantes de un pedido.

Para cerrar el flujo completo faltan un proveedor compatible y autorizado, sus
mandatos vinculados a importe/moneda/beneficiario, verificación auténtica de
webhooks/evidencia en servidor, aislamiento por titular/proveedor/moneda y
conciliación de reversas, devoluciones parciales y liquidaciones multiparte.
No es seguro habilitar esas operaciones sólo con configuración del frontend.

## Verificación reproducible

```powershell
node --experimental-sqlite tests/verify-economy.mjs
node tests/verify-contract.mjs
node tests/verify-utopy-pay-contract.mjs
node tests/verify-value-contribution-contract.mjs
node tests/verify-live-network-contract.mjs
node tests/verify-living-vault-contract.mjs
pnpm build
```

En Node 23.1 se necesita `--experimental-sqlite`; sin él el test del registro
servidor falla al importar `node:sqlite`. Los ensayos contables son aislados,
simulados, no negociables y no mueven dinero. Se prueban conflicto de duplicado,
autoridad incorrecta, auditoría corrupta, clasificación de fallido/devolución,
anticipo, aceptación sin pago y rechazo de retiro y ruta no autorizados.
Esto no certifica cobros, devoluciones ni liquidaciones reales de un proveedor.

### Resultado de esta ejecución

Pasaron economía (incluida asistencia local y rechazo de settlement sin evidencia),
contrato universal, UTOPY Pay, aportes, red viva, bóveda, descubrimiento de composición
y privacidad frontend. `pnpm build` completó la aplicación y PWA; el script es Vite,
no un chequeo completo de tipos. No se realizó validación visual en navegador.

Se ejecutó también `verify-first-real-purchase-contract.mjs`: falla en una
aserción de upload que espera `form.append("file", input.file)`, mientras
`mt.checkoutPurchaseCycle.ts` usa `form.append("image", input.file)`.
Ninguno de esos dos archivos se modificó en esta tarea. Debe cotejarse con el
contrato real del endpoint del nodo, sin cambiarlo para satisfacer una regex.
El chequeo general de whitespace detecta además problemas en `index.html` y
`circularpanel.jsx`, ajenos a los archivos de esta integración.

Archivos modificados: `src/economy/utopy.node-adapter.ts`, `utopy.economy.ts`,
`utopy.payment-router.ts`, `LivingEconomyPanel.tsx`, `livingEconomy.css`,
`src/vault/BovedaVivaPanel.tsx` y `tests/verify-economy.mjs`.
Añadidos: `src/economy/utopy.economy-interface.ts` y este documento.
