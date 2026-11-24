# Identidad sencilla desde LUA

`/lua/gestionar` muestra el formulario cuando la identidad actual no tiene acceso verificado. Si ya está autorizada, dirige al panel existente del mismo nodo.

Campos: nombre, teléfono opcional, correo opcional, contraseña de respaldo y confirmación. Consentimiento explícito para el nombre del perfil y contactos privados. Reutiliza las claves persistentes del dispositivo: no reemplaza una identidad ya existente ni crea credenciales compartidas.

Reutiliza `buildLiveProfileDV`, `identity.private.profile`, el publicador autorizado y `createEncryptedRecovery`. Los contactos quedan como datos declarados no verificados, locales y privados. No se derivan credenciales de edad, propiedad ni permisos administrativos. La contraseña no se escribe en DVs ni en una base de cuentas.

El usuario debe descargar y conservar el respaldo `.utopy-wallet`. En otro dispositivo utiliza ese archivo con su contraseña mediante el panel de recuperación existente. No hay login por correo/teléfono, OTP ni recuperación remota. El navegador autorizado conserva su clave: esto no añade un bloqueo de sesión por contraseña.

Pendiente de habilitación externa: vincular el identificador real de LUA, sincronizar y verificar mandatos en su servidor. El ZIP web no activa esos servicios ni entrega el nodo automáticamente. Pendiente de QA humano: persistencia del navegador, descarga y restauración completas en dos dispositivos.
