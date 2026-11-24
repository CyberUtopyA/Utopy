# Encicar y Don Mencia: adopción piloto

## Auditoría y alcance operativo

- Runtime: se adoptó el artefacto local `utopy-2.0.0-beta.3-symbolic-f67d0aed.tgz`,
  producido con `npm pack --ignore-scripts`. Sin modificar Runtime ni publicar npm.
  `projectReasoningForm`, RuleReasoner, LivingCompositionEngine y firmas están presentes.
- Market: mt.liveStore, publishAuthorizedDV, Identidad Viva, Discovery,
  mt.transactionProtocol y mt.inventoryBridge continúan siendo las vías comerciales.
- Daily: catálogo existente en falcondaily.tsx. Se agregaron accesos lazy a los
  recorridos piloto; módulos listados son alcances previstos, no pantallas ERP activas.
- MO: work.lifecycle.ts y LivingComposition existentes permiten trazabilidad de
  trabajos y resultados. No se modificó MO ni se creó un conector directo paralelo.
- FEDA: Runtime acepta diccionario simbólico autorizado; aquí solo se usan propuestas
  de capabilities demo explícitamente declaradas. No hay diccionario firmado de los
  propietarios ni comprensión general de frases o correcciones por voz.

## Recorridos disponibles

Actualización de presentación: las fichas públicas se abren en
`/falcon/daily?node=encicar` y `/falcon/daily?node=don-mencia`.
Son perfiles en preparación, sin ownership ni capacidades verificadas inventadas.
Los accesos de ensayo se retiraron del catálogo público; `?pilot=` funciona solamente
en desarrollo. Se conservan los ensayos automatizados.

- `/falcon/daily?pilot=encicar`
- `/falcon/daily?pilot=don-mencia`

Cada sesión es efímera y privada, sin transportes ni persistencia comercial. Reutiliza
MemoryEnvelopeStore del Runtime; no crea un segundo store comercial. La firma de demo
es una clave efímera, nunca la identidad de Encicar, Don Mencia ni sus propietarios.
Los formularios, composiciones y cada evidencia conservan simulation/nonTradable.
Los handlers instalados solamente generan evidencia del ensayo local, no diagnostican,
reparan, reservan stock, transportan o cobran. La pantalla pide consentimiento del ensayo
y permite revocarlo. Cambiar texto, detalle o líneas invalida la autorización anterior.
Las líneas/cantidades/precios se incluyen en el detalle de la composición firmada.

El QR es escaneable y contiene una constancia mínima firmada en el fragmento del enlace.
El verificador confirma integridad de demo, no autoridad empresarial ni hechos físicos.
No contiene identidad de cliente, matrícula/VIN, precios, imágenes ni evidencia privada.
El archivo JSON exportado contiene evidencia privada, composición y pasaporte proyectado;
su contenido debe verificarse con el Runtime antes de importarlo a otro nodo.

El ejemplo de Don Mencia procede del pedido del usuario. Las líneas del taller se cargan
manualmente; la prueba de total usa el ejemplo ilustrativo de la referencia, sin publicarlo.

## Pendiente para operación real

1. Propietarios deben proporcionar/vincular su Identidad Viva y Nodo canónico, delegaciones
   y consentimientos verificables. No se registra ownership por el nombre de un negocio.
2. Cargar catálogo, horarios, zona aproximada, vehículos/clientes privados, diagnósticos,
   fotos, compatibilidades, garantías, lotes, ingredientes y disponibilidad verdaderos.
3. Verificar diccionario FEDA firmado y declarar schemas de las operaciones reales.
4. Instalar handlers autorizados que llamen a los módulos existentes, con acciones exactas
   y mandatos revocables. Ningún handler demo debe convertirse silenciosamente en real.
5. Publicar perfiles/capabilities/manifests mediante publishAuthorizedDV y Micelio;
   probar Discovery en Market y handoff con ACK hacia MO. No hay publicación automática.
6. Reservas/stock requieren aceptación firmada y control de concurrencia de su Nodo.
   mt.inventoryBridge hoy redondea cantidades a enteros: no está listo para venta fraccionaria
   en kg ni ofrece por sí solo exclusión distribuida. El piloto no declara esto resuelto.
7. Probar presupuesto/revisión/aprobación real, cambios de alcance, trabajos y entregas
   confirmadas por sus participantes, cobros confirmados por la ruta real, Caja Viva y QR
   con autorización de historial. Nunca usar un evento demo como comprobante económico.

## Validación

`node tests/verify-living-pilots.mjs` verifica ambos recorridos usando el paquete adoptado:
formularios incompletos, simulación, autorización obligatoria, pasos ordenados, revocación,
firmas, manipulación del QR, pasaporte, totales y extracción del ejemplo de oferta.
No prueba una reparación física, un pago real, reservas distribuidas ni propiedad del nodo.
No se ejecutó build ni despliegue.
