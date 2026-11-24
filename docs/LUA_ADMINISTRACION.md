# Administración de LUA

En el panel del negocio, **Configuración → Compartir mi negocio → Entregar administración**.

La destinataria encuentra **Mi espacio → Mi negocio → Aceptar mi negocio**. Puede escribir su nombre y compartir un contacto firmado; quien prepara el negocio lo carga para elegirla sin transcribir identificadores. El nombre es una presentación declarada, no una prueba de propiedad del negocio. Los identificadores manuales quedan en opciones técnicas. Este cambio simplifica la entrada, pero no reemplaza el intercambio de archivos ni instala un servicio automático de entrega por enlace.

1. La destinataria prepara su propia identidad persistente con respaldo y copia su identificador desde **Mi espacio → Aceptar administración de un negocio**.
2. El controlador introduce ese identificador y el vencimiento, confirma los permisos y descarga la invitación privada.
3. La destinataria importa el archivo, confirma por otro canal la identidad del remitente, acepta y devuelve su aceptación firmada.
4. El controlador carga esa aceptación y descarga la autorización activada.
5. La destinataria importa la autorización con su misma identidad y abre el mismo negocio.

Los permisos cubren agenda, catálogo y fotos. No autorizan pagos, transferencias ni delegaciones adicionales. Los archivos no contienen claves privadas. No compartir contraseñas ni respaldos de identidad.

El intercambio verifica firmas y conserva el identificador del nodo. Es local-first: el servidor debe recibir y verificar el mandato vigente y sus revocaciones mediante su infraestructura de autoridad antes de aceptar operaciones remotas. Subir el ZIP web no configura ese servicio. No se publica una autorización como credencial pública.

Este flujo delega administración; **no transfiere la identidad controladora ni permite retirar al controlador original**. La transferencia definitiva necesita un procedimiento de cambio de autoridad que todavía no está implementado. Una revocación local debe sincronizarse con el nodo y los dispositivos para ser efectiva allí.
