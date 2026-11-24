# Identidad Viva universal: auditoría y corrección de raíz

## Estado de esta entrega

PARCIAL. No se implementó ni desplegó un registro central de personas, login remoto o sincronización privada. No se satisface todavía el recorrido Android → computadora → otro navegador pedido por el usuario. No se asigna un supuesto global_user_id a partir de nombre, correo o documento. No se fusionaron cuentas ni migraron operaciones.

## Causas encontradas en el código real

1. `ownership.ts` guardaba la identidad en IndexedDB por origen y navegador. Si no había registro, generaba claves raíz y DID nuevos. Repetir un correo no recupera esa clave. Localhost, Market y otros dominios tienen almacenes diferentes.
2. `getOrCreateOwnerIdentity` no tenía single-flight: llamadas concurrentes podían leer vacío y crear distintas raíces. Se corrigió con una promesa compartida y Web Locks por origen donde el navegador los admite, releyendo IndexedDB dentro del bloqueo.
3. `persist` asignaba la identidad en memoria antes de completar la transacción. Ahora sólo la cambia tras confirmar escritura. Una identidad efímera se mantiene explícitamente en memoria.
4. Un registro persistido no reconocido se trataba como vacío y podía sobrescribirse. Ahora no se sobrescribe: se informa la necesidad de recuperación y el fallback sigue siendo temporal.
5. `resolveCurrentIdentityContext` podía derivar otra persona con contextKey. Ahora la persona activa usa siempre el contexto personal. El helper histórico de derivación permanece compatible para verificar datos previos; no se reescriben sus IDs.
6. La sesión es un ID en sessionStorage, distinto del actor y del dispositivo. No equivale a una persona ni a una sesión autenticada remota. Se expone identityPersistence para distinguir device/ephemeral, sin afirmar registro backend.
7. `simpleIdentity` guarda contactos privados y recuperación cifrada local. Declara phoneVerified/emailVerified false y no consulta un proveedor de credenciales. No es un login remoto por correo o teléfono.
8. `IdentitySessionSigner` ya permite prueba firmada de sesión con origen fijo de Studio y consentimiento. `utopy/identity/server` ya valida raíces, dispositivos, revocaciones, mandatos y proyecciones de Runtime. Se reutilizan sin modificarlos; no constituyen un registro central ni almacenamiento de recuperación.

## EXISTENTE / PARCIAL / FALTANTE

| Capacidad | Estado |
| --- | --- |
| Wallet raíz DID, claves por dispositivo, firma, revocación y rotación | Existente |
| Recuperación cifrada con misma raíz y nueva clave de dispositivo | Existente; probada criptográficamente con fixtures independientes |
| Actor personal compartido entre consumidores locales | Existente; corregida inicialización y contexto |
| Autorizaciones separadas por nodo y partición privada mtLiveStore | Existente; no se amplían ni se mezclan |
| Comunicación, Mi Valor, Currículum, Agenda | Consumen identityContext/Runtime existentes; no se inventó otro ID |
| Datos privados, contratos y preferencias en otro dispositivo | Parcial/local; recuperar wallet no garantiza sincronizar todas las bases |
| Identidad efímera frente a persistencia por dispositivo | Ahora explícita en contexto; no equivale a cuenta central |
| global_user_id backend único y registro remoto durable | Faltante en este checkout |
| Login/recuperación central con credenciales verificadas | Faltante; no se configuró proveedor ni host de autenticación |
| Vinculación/fusión verificada de dos raíces personales existentes | Faltante; identityLink actual vincula persona-nodo, no fusiona personas |
| Reserva de invitado promovible sin duplicación de persona | No validada extremo a extremo; no se modifica el contrato actual de reservas |

## Integración pendiente y bloqueo real

No se encontró una implementación de Identity central de Fundación en este checkout. La dependencia Runtime describe sus verificadores como proyecciones sin servicio de autenticación ni base de usuarios. No corresponde construir una segunda base y llamarla consolidación.

Para continuar el requisito central se necesita el código/configuración del host de identidad existente (o establecer explícitamente que no existe), su persistencia y origen HTTPS, registro de aplicaciones/orígenes autorizados y mecanismo verificable de recuperación. Nunca enviar claves, contraseñas o datos de producción al repositorio/chat. La asignación backend debe conservar la asociación verificada al DID/actor actual; enlazar dos raíces requiere prueba de control de ambas o un proceso de recuperación autorizado. Coincidencia de nombre/correo/cédula sola no autoriza ninguna fusión.

No se publica un global_user_id local ficticio ni se habilita login remoto por configuración de frontend. Un ZIP estático no puede completar esa infraestructura. Ningún cambio de este trabajo borra compras, citas, pagos, comisiones o DVs.

## Pruebas y límites

`verify-universal-identity.mjs`: 25 llamadas concurrentes reciben un DID/dispositivo; módulos independientes parten con raíces distintas; recuperación cifrada conserva DID y actor y genera otro dispositivo; contraseña incorrecta mantiene la identidad anterior; cinco contextos de aplicación resuelven el mismo actor. Son fixtures con WebCrypto real, sin IndexedDB real en Node. No se usaron cuentas ni datos del usuario.

Se ejecutan además contratos del proyecto, identidad simple, invitaciones y build. Pendiente validar Web Locks/IndexedDB en navegador real y Android, SSO entre orígenes, almacenamiento backend, recuperación por credenciales y separación multidispositivo. No declarar identidad universal completa con estos resultados.
