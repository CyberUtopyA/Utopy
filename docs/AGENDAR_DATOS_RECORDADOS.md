# Próximas citas · datos recordados

La tarjeta «Tus datos» permite guardar nombre y teléfono desde una acción explícita «Recordar mis datos». En el mismo navegador y con la misma identidad, el siguiente ingreso los recupera y muestra un resumen compacto con «Editar». Se puede desactivar el autocompletado sin borrar la identidad ni su perfil privado.

Guardar para uno mismo y compartir con el negocio son decisiones separadas. La casilla de compartir vuelve a estar desmarcada en cada visita/cambio de identidad. No se guardan horarios como disponibles, ni contraseñas, tarjetas o notas sensibles de la cita. Toda reserva se revalida y requiere confirmación del usuario.

## Reutilización y privacidad

- [rememberedContact.ts](../src/booking/rememberedContact.ts) actualiza el ID existente `identity.private.profile:<actor>` mediante firmas y publicación autorizada localOnly. Conserva documento, jurisdicción y demás campos existentes; no crea otro store, cuenta o servicio. Valida la firma y el actor antes de leer o actualizar. No eleva permisos de ningún nodo.
- Usa la partición personal del [store compartido](../src/mt/mt.liveStore.ts), incluyendo `actorId` para que el DV privado pertenezca a la partición correcta. El guardado explícito informa si no se pudo persistir en el almacenamiento del navegador.
- [BookingExperience.tsx](../src/booking/BookingExperience.tsx) limpia datos/autorización de compartir al cambiar de identidad, reutiliza los campos y mantiene intacto el comando de reserva/idempotencia. El gestor administrativo no carga este autocompletado de cliente.
- [bookingPremium.css](../src/booking/bookingPremium.css) presenta el resumen editable sin animaciones adicionales ni cargas de red.

Se usa el almacenamiento privado existente del navegador, no una nueva bóveda cifrada. Recordar no verifica por SMS el teléfono ni crea un login por número. No garantiza recuperación si se borran los datos del sitio, se usa incógnito, falta espacio o se cambia de dispositivo. El respaldo de identidad existente debe actualizarse si se quiere portar datos nuevos; no se genera automáticamente sin contraseña. Las imágenes públicas ya se conservan mediante la caché limitada implementada anteriormente.

## Pruebas

[verify-booking-memory.mjs](../tests/verify-booking-memory.mjs): consentimiento, longitudes, rechazo de otro actor, preservación de campos/versiones/autoridad, opt-out sin borrado, persistencia real del store en adaptador localStorage aislado y reapertura de módulo, exclusión de caché pública, separación de actores y error de cuota. La verificación criptográfica continúa en los contratos existentes; esta prueba no simula un inicio de sesión real en Chrome/iOS. Ejecutar además contratos AGENTS, pruebas de reservas/UI y build.

ZIP web acumulado: extraer junto al índice actual, sin borrar assets anteriores, API, configuraciones ni datos del navegador. No requiere reinstalar Node para esta función local; no habilita una agenda no conectada.
