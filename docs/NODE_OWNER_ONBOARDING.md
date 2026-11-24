# Alta por el propietario · 2026-10-20

> Historial técnico, no flujo comercial vigente. Esta UI fue retirada porque reconstruía el nodo con otro identificador. No satisface la continuidad administrativa solicitada. Ver `REAL_NODE_PROVISIONING_AUDIT.md`; el helper permanece únicamente como evidencia/prueba, fuera del grafo de la aplicación.

## Separación de responsables

Los nodos de demostración son fixtures controlados por la identidad que los ensaya. No son la identidad real de los dueños. No se convierten a producción ni se transfieren mediante un rol `owner`: eso no quitaría acceso al controlador original. `identity.link` sirve a relaciones de cuenta y `node.authorization` a delegaciones; ninguno se presenta como transferencia de control de un negocio.

`nodeOwnerOnboarding.ts` añade una **preparación dirigida**, no otro sistema de cuentas, credenciales de sesión o autorización. El propietario abre su identidad UTOPY existente y comparte su identificador; el preparador firma un archivo privado dirigido exclusivamente a ese actor, con nombre y presentación propuestos. El paquete caduca a los siete días, no incluye claves privadas ni permisos y no permite reclamar un ID de nodo existente.

En `/mi-espacio`, «Preparar un nodo para su dueño» permite generar/importar ese archivo. El destinatario verifica la firma, confirma el identificador del remitente por un canal conocido y consiente la presentación pública. Se requiere custodia persistente y respaldo cifrado de su identidad. El respaldo y su contraseña nunca se comparten con el preparador. La UI se reinicia cuando cambia la wallet.

La aceptación crea un UUID de nodo nuevo, firmado por **la identidad del destinatario** usando el mismo bootstrap de manifiestos. Conserva endpoints/capacidades vacíos, `setupOnly:true`, `productionReady:false`: es un nodo propio en preparación local, no una operación desplegada. El preparador no recibe claves, delegaciones, clientes ni acceso administrativo. No se copian datos privados de demostraciones. Los negocios pueden compartir nombre de presentación, pero nunca heredan control por ese nombre.

Se reutilizan `resolveCurrentIdentityContext`, wallet/recuperación existentes, `verifyAuthorizedDV`, `publishAuthorizedDV`, `mtLiveStore` y las rutas ordinarias del nodo. No se añadió login con contraseña, store de cuentas o proveedor de identidad paralelo.

## Límites de seguridad explícitos

- Verificar una firma acredita qué identidad firmó, **no la propiedad legal** del negocio. Hace falta confirmación externa del responsable.
- La invitación es dirigida al actor: conocer/copiar su archivo no autentica a otro actor. Sigue siendo información privada que debe enviarse solo a su destinatario.
- La repetición local se detecta por `onboardingInvitationId`; se devuelve el nodo ya creado si pertenece al mismo dueño. No hay consumo atómico global entre dispositivos, revocación remota de paquetes ni unicidad global del nombre. Un replay sin estado compartido podría crear otro UUID, pero nunca reclamar ni acceder al nodo previo.
- No hay vinculación automática con cuentas/servidores de nodos ya productivos ni transferencia del nodo de demostración. Ese paso exige la administración real del host, prueba de cuenta, origen/audiencia, desafío de un solo uso, vinculación atómica persistente, protección de sesión/CSRF, autorización revocable y pruebas del servidor. No implementarlo solamente con un formulario frontend, un enlace secreto o una etiqueta de propietario.
- No se activan discovery remoto, comercio, dinero, disponibilidad o permisos de terceros. El alta no sustituye el despliegue de capacidades e identidad real del nodo.

## Verificación

`tests/verify-node-owner-onboarding.mjs` usa **dos identidades con claves independientes**: comprueba destinatario, vencimiento, alteración, remitente, claves separadas, manifiesto firmado por el dueño y acceso administrativo denegado al preparador. También comprueba que no se concedan roles/permisos ni se reusen IDs existentes. Node no ofrece custodia persistente en estas pruebas, por lo que la aceptación real se rechaza allí. Pendientes: interacción/persistencia en navegador y dispositivos, recuperación del dueño en otro dispositivo y aprovisionamiento seguro del servidor de cada negocio.
