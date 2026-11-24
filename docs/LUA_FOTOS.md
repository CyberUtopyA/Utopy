# Fotos desde la galería

En gestión → Servicios, al abrir un servicio aparece **Elegir de mi galería**.
También está disponible para Inspiración y foto de portada. La persona elige
una foto, revisa su vista previa local, autoriza publicación y toca **Subir foto**.
Tras recibir confirmación, guarda la configuración para asociarla al servicio.
JPG/PNG/WebP hasta 12 MB; se prepara una copia JPEG optimizada con el compresor
existente de publicaciones. El original no cambia y no se conservan sus metadatos
EXIF en la copia. No se recomprime ni se sustituye el logo original.

Reutiliza `uploadConversationReferences` mediante un transporte explícito;
los consumidores anteriores conservan su comportamiento. No se creó otro
almacén ni se convirtió el nodo Market en proveedor obligatorio de archivos.

## Conexión del servidor

Actualizar `server/booking` y exportar `uploadMedia` en el módulo privado del
host configurado en `UTOPY_BOOKING_HOST_MODULE`. El handler verifica identidad,
mandato `booking.configure`, consentimiento y firma de la petición completa.
Revisa tamaño, tipo y firma binaria antes de llamar al adaptador; el proveedor
debe decodificar/validar las imágenes y almacenarlas como contenido no ejecutable.
Debe devolver `{confirmed:true,url:'https://…'}` sólo tras guardarlas realmente.

`existingMediaUploader({endpoint,headers})` adapta el contrato JSON de
`media/upload.php` que ya usa Market. Puede apuntar al proveedor compatible del
nodo; su endpoint y credenciales se configuran únicamente en servidor. Recibe una
clave de idempotencia estable por nodo/contenido para proveedores compatibles.
No se configura un servicio remoto ni se realiza una subida comercial desde
estas pruebas. Sin adaptador aparece «almacenamiento no conectado».

Ejemplo en el módulo privado del host (junto a sus exports Runtime/Authority):

```js
import { existingMediaUploader } from './server/booking/existing-media-adapter.mjs';
export const uploadMedia = existingMediaUploader({
  endpoint: process.env.UTOPY_MEDIA_UPLOAD_URL,
});
```

La ruta del import depende de dónde viva ese módulo. La variable apunta al
servicio de medios compatible que el nodo ya tenga autorizado. No colocar
credenciales en URLs ni variables `VITE_*`.

El ZIP web no instala ese adaptador ni configura almacenamiento en cPanel.
El servidor y proveedor también deben actualizarse/conectarse.

Archivos: compresor extraído a `src/media/imageCompression.ts` y reutilizado
por `ProducirPanel`; transporte opcional en `ConversationReferences`; componente
`BookingPhotoPicker` en servicios/galería/portada; operación firmada
`media.upload` en el servidor. Las pruebas HTTP cubren denegación al cliente,
consentimiento ausente, SVG rechazado y proveedor sin confirmación, con un
proveedor simulado. Falta validación con el proveedor real y galería de móvil.
