# UTOPY · nodos y coordinación local de demostración

> Historial de pruebas. La instalación y la pestaña descritas fueron retiradas de la experiencia comercial el 20-10-2026. No constituyen nodos productivos. Ver `REAL_NODE_PROVISIONING_AUDIT.md`; los fixtures conservan sus restricciones y no se promueven borrando indicadores.

## Alcance auditado (2026-10-19)

MS Market ya tiene manifiestos verificables, identidad con control/delegaciones, un store compartido, publicación firmada, `delivery.request`, ofertas, cotizaciones y aceptación, ejecución, estados y confirmaciones. `work.action.ts` y `circula.dv.ts` son los builders reutilizados. No se modificaron createSale, inventario, fidelidad, cuotas/pagarés, login/CSRF, checkout ni las fuentes públicas de DecoHogar/La Piedra/LUVÉAU.

Runtime ya implementa envelopes firmados, privacidad, authority trust, context-handoff/ACK, mandatos y composición. Se inspeccionaron sus fuentes; no se cambió Core ni se adoptaron cambios nuevos de su árbol sucio. MO consume Runtime y dispone de publicación firmada; no se modificó. No se identificó de manera inequívoca un repositorio de Fundación Studio para auditar su ejecución en este incremento: no afirmar integración o prueba de Studio. La documentación de Fundación disponible no es prueba de funcionamiento del editor.

El viejo `mt/settlement.handler.ts` contiene un stub de pago directo con una referencia simulada. **Esta implementación no lo invoca ni lo habilita**; no se reutilizó como proveedor financiero. Un ACK de transporte tampoco equivale a aceptación comercial o entrega. La coordinación añadida es local y no emite ACK remotos ficticios.

## Siete nodos, no siete categorías

`nodeDemonstrations.ts` contiene únicamente fixtures: Don Mencia, Encicar, René, celulares, peluquería, hamburguesería y Falcon Delivery. `/mi-espacio` → «Probar los siete nodos iniciales» requiere consentimiento y custodia persistente del dispositivo. Firma manifiestos mediante el bootstrap ya existente, y los muestra en la misma lista/rutas que cualquier nodo administrado. El instalador no se ejecuta al cargar y nunca sobrescribe un manifiesto existente; se puede reintentar una preparación parcial.

Los seis primeros usan un namespace `utopy.node.demo.*`. Falcon usa el identificador solicitado `utopy.node.falcon.delivery`, pero su manifiesto indica explícitamente `simulation`, `nonTradable`, `setupOnly`, `productionReady:false` y endpoints/capacidades vacíos. Esto **no prueba identidad ni propiedad real** de Falcon o de los negocios. Todos quedan firmados por la identidad local que consiente, no por propietarios supuestos. No son nodos desplegados, servidores autónomos ni anuncios comerciales activos; caducan a los 30 días.

La pestaña administrativa «Coordinación» se habilita por `workspaceModules`, no por nombre, rubro o privilegio de Falcon. Cualquier nodo de demostración compatible puede utilizarla, anunciar disponibilidad o retirarla voluntariamente. Los anuncios de prueba usan el `capability.offer` existente, caducan a los 15 minutos, son locales, no tienen ubicación exacta/precios inferidos y llevan `setupOnly` para no entrar al feed público. Los nodos productivos no pueden operar con estos handlers de simulación.

## Perfil mínimo de coordinación

`nodeCoordination.ts` define `utopy.coordination/1`, un perfil de validación sobre los DVs existentes; no otro bus, catálogo, store, identidad o motor de pagos. Sus funciones de construcción/proyección no publican. El adaptador de commit usa `businessAccess`, `verifyAuthorizedDV`, `publishAuthorizedDV` y `mtLiveStore`. No depende de FEDA, LLM, un dispatcher central ni del nombre de un negocio.

Recorrido local: `delivery.request` → `work.quote` → `work.quote.accepted` → `work.execution` → `delivery.status` (retirado/en camino/entrega declarada) → `delivery.confirm` (recepción por solicitante) → `settlement.record`.

`settlement.record` es el único tipo añadido para registrar la referencia de liquidación simulada, separado de pago confirmado. Siempre lleva `recordOnly:true`, `realMoneyMoved:false`, `simulation:true`, `nonTradable:true`. No emite `payment.outcome`, saldo, transferencia, bloqueo, reparto de dinero ni comisión cobrada. No hay proveedor financiero conectado. La cotización expresa servicio, comisión fija y/o puntos básicos, destinatario coordinador, total, moneda, distancia/ETA informados, condiciones y vencimiento. No se inventan importes; un 0 debe ingresarse explícitamente. El solicitante acepta exactamente esos términos, no una versión futura. La aritmética monetaria usa enteros y redondeo half-up.

Cada evento privado conserva hilo/cadena, participantes, secuencia y referencia a la firma anterior. El solicitante solicita/acepta/confirma; el proveedor cotiza/ejecuta/declara entrega; el coordinador registra la liquidación simulada. Cada firma verifica permisos nuevamente y requiere consentimiento explícito. Un nodo puede reunir roles de proveedor/coordinador; nunca se asignan permisos por etiqueta o por estar en una lista.

Se rechazan firmas inválidas, identidades no autorizadas, cambios de partes o términos aceptados, cotizaciones vencidas, estados fuera de orden y referencias obsoletas. Los duplicados exactos no repiten resultados. Dos ramas válidas en una misma secuencia bloquean la proyección: no se elige ganador. Hay bloqueo en vuelo por solicitud dentro de la instancia y chequeo optimista local; **no es CAS entre pestañas/dispositivos**. La persistencia existente sigue sin ser cifrado ni ACL del servidor.

Antes del retiro, se admite rechazo/cancelación con motivo. Después del retiro, se registra incidencia sin presumir devolución/reembolso. La incidencia pausa el flujo; resolución, reanudación y compensaciones reales requieren un procedimiento y consentimiento adicionales, no implementados aquí.

## Cómo ensayar

1. Con identidad persistente, preparar los siete nodos y abrir Falcon Delivery desde «Mis nodos».
2. Abrir «Coordinación». Elegir un nodo proveedor y autorizar/anunciar disponibilidad de prueba.
3. Elegir otro nodo como solicitante, describir un paquete ficticio, revisar y crear la solicitud.
4. Ingresar todos los importes/condiciones/vencimiento y presentar cotización. Cada paso muestra qué nodo firmará; la identidad debe poder representarlo. No se simula que un tercero dio consentimiento.
5. Aceptar precio y comisión, iniciar, retirar, marcar en camino, declarar entrega y confirmar recepción, con consentimiento nuevo por acción.
6. Indicar una referencia ficticia de comprobante y registrar liquidación simulada. No ingresar comprobantes sensibles ni direcciones reales.

Los seis nodos comparten sus configuraciones administrativas previas; este incremento no instala seis recorridos comerciales completos ni inventa productos, precios o diagnósticos.

## Pruebas / pendientes

`tests/verify-node-coordination.mjs` verifica siete manifiestos firmados, aislamiento del feed, nueve etapas firmadas, consentimiento, roles, cálculo de comisión, inmutabilidad de términos, vencimiento, alteraciones, ramas en conflicto, duplicados, cancelación, incidencia, disponibilidad/retiro/caducidad y rechazo de instalación con wallet efímera. Las pruebas Node usan custodia efímera y no acreditan persistencia/micrófono/UX de dispositivo ni consentimiento de personas reales.

Pendientes de producción: dueños y claves reales por nodo; onboarding de negocios/repartidores externos; capacidades instaladas y revocables; identidad/mandatos de contraparte; entrega privada y ACK reales; sincronización autenticada/CAS y resolución de conflictos; proveedor de rutas/ETA y permisos de ubicación; comprobantes y proveedor financiero compatible; políticas/contratos de comisión/cancelación y revisión regulatoria correspondiente. No basta cambiar un booleano para operar: los ejecutores productivos no existen en este perfil.
