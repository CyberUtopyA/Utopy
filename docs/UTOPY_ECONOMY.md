# Cuenta Viva — implementación y límites

## Integración existente

La entrada real es Perfil → Mi Valor → `BovedaVivaPanel`. Se añadió **Mi economía** como vista inicial dentro del mismo componente. Resumen, Relaciones, Derechos, Actividad, Cobrar y Pagos/suscripciones se conservan; no hay una ruta o aplicación financiera nueva.

La auditoría no encontró una pantalla bancaria llamada «Mis Tarjetas» ni un proveedor de billetera. Las tarjetas actuales de este flujo son las de fidelidad (`useLoyaltyPassports`), preservadas mediante el acceso **Mis tarjetas de fidelidad**. Los métodos bancarios siguen gestionándose mediante el proveedor del comercio y el checkout existente. No se introdujeron formularios de PAN/CVV ni destinos bancarios almacenados en el navegador.

## Código de presentación y contratos

- `src/economy/utopy.economy.ts`: proyección privada por identidad, sin saldo local, sin sumar ventas ni Liquidity en una billetera. Sin proveedor, disponible y liquidación pendiente son `null`, no un cero que aparente una cuenta operativa.
- `utopy.node-adapter.ts`: reutiliza `projectCheckoutPurchaseCycle` para pagos del comprador, orden exacta, importe/moneda, autoridad y evento del comercio. Exige orden firmada por la propia identidad, alcance privado/participantes y objetos DV verificados. Excluye simulaciones. La actividad es un registro de pago directo, no confirmación independiente del banco ni ingreso retirable.
- `LivingEconomyPanel.tsx` y CSS: carga, vacío/error, disponible no configurado, actividad, destinos no vinculados y conexiones derivadas de operaciones verificadas. Las comprobaciones se invalidan al cambiar identidad o conjunto de datos. No se muestran IDs internos ni se agregan monedas distintas. La primera adaptación cubre operaciones del comprador; no se afirma consolidación completa de ingresos de comerciantes/repartidores delegados.
- `utopy.payment-router.ts`: distingue pago directo (ejecutado por el checkout ya existente) de pago coordinado no disponible. No ejecuta transferencias.
- `utopy.payouts.ts`: retiro/envío deshabilitados por defecto; una solicitud produce un error explícito, sin cola sensible ni confirmación optimista.
- `utopy.settlement.ts` y `journalRules.mjs`: validación compartida de doble entrada por moneda, enteros menores con BigInt. Balancear un asiento no acredita dinero ni confirma liquidación.

No hay conexión real de proveedor, snapshot financiero confirmado, destino de retiro, cálculo de comisiones, payout, reembolso o liquidación nuevos. Tampoco se emiten eventos `payment.confirmed`, `payout.completed` o `economy.account.created` para fingir capacidades.

## Núcleo de servidor

`server/economy/journal.mjs` es una biblioteca Node.js, **no otro microservicio ni un endpoint público**. No se mezcló la economía con el servicio fiscal de `deploy/utopy-sifen` ni se reutilizaron sus claves/alcances fiscales para autorizar dinero.

El registro de pagos directos utiliza SQLite, `BEGIN IMMEDIATE`, claves únicas por nodo/referencia y nodo/idempotencia, moneda y unidades menores exactas, validación de autoridad y un asiento balanceado de cuentas **externas al Market**. Dos llamadas iguales no duplican el asiento; una referencia/key con contenido distinto falla. El asiento no es una segunda copia de movimientos Liquidity y no alimenta sus saldos.

Requiere un `verifyReceipt` instalado por el host que autentique el contrato del nodo completo. Sin ese adaptador falla cerrado. El callback no es un campo que deba aceptar un cliente HTTP. Las pruebas inyectan un verificador aislado; **no acreditan integración de autenticación desplegada**. Las simulaciones son rechazadas por defecto y solo se permiten mediante una opción explícita del host de pruebas.

La conciliación valida doble entrada y encadenamiento hash de los asientos. Detecta corrupción/inconsistencias; **no concilia contra extractos de un proveedor ni impide que un atacante con control total de la base reescriba toda la cadena**. No existe una raíz de auditoría externa instalada.

La base debe ubicarse fuera de `public`, `dist` y cualquier ruta web, con permisos de usuario de servicio y backups privados. No incluir claves, credenciales, tarjetas ni comprobantes binarios en sus asientos. El módulo no abre archivos hasta ser instanciado por el host; no se creó una base con operaciones del usuario durante esta tarea.

## cPanel y activación pendiente

La biblioteca requiere Node con `node:sqlite` (probada localmente en Node 23.1.0 con `--experimental-sqlite`, coherente con el requisito Node ≥22.13 del despliegue fiscal existente). **No se inspeccionó ni probó una instancia cPanel remota**, su versión de Node o sus permisos de disco. El build web Vite/PWA no empaqueta el módulo de servidor ni despliega un backend económico.

Para activarla en un proceso Node existente hacen falta un adaptador de recibos autenticados, autorización por identidad/nodo, transporte privado y política de idempotencia. No se agregó una API sin esos controles ni se usó autenticación fiscal para ello.

Los pagos coordinados/retiros requieren un proveedor autorizado con credenciales exclusivamente de servidor, verificación de webhooks, cuentas y destinos tokenizados, cotización de comisiones, consentimiento ligado a importe/destino/moneda, idempotencia, anti-replay, conciliación contra proveedor y confirmación final. Un evento firmado unilateralmente por un comercio nunca habilita esos fondos. No hay una bandera del frontend que los active.

Eventos de economía/cuenta, coordinación, liquidación, retiro y reembolso deben añadirse como contratos versionados **al conectar esas fuentes reales**, no emitirse ahora como transacciones ficticias. El libro actual registra solo pagos directos confirmados por el contrato del nodo; aún no tiene reversos/reembolsos, reservas ni saldos de proveedor.

## Verificación

`node --experimental-sqlite tests/verify-economy.mjs` prueba asientos económicos simulados/nonTradable en bases en memoria, aritmética exacta, balance por moneda, idempotencia/conflicto, autoridad, detección de corrupción y rechazo de retiros. Comprueba que eventos de nodo o de liquidación inventados no creen un saldo. No mueve dinero, usa cuentas reales, publica DVs ni persiste fixtures en datos del usuario.

Se ejecutan además los cinco contratos generales y `pnpm build` (Vite/PWA; no typecheck completo). No hay QA visual de navegador/teléfono, operación financiera real, proveedor bancario ni despliegue cPanel acreditados. La Cuenta Viva integrada no debe presentarse como billetera real habilitada.
