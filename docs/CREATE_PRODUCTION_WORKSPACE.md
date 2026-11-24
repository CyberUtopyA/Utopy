# Crear + Centro de producción

## Corrección de navegación

`/market?tab=crear` es una superficie principal, no una ventana del mapa. El botón Crear, los accesos del feed y el mapa usan el mismo compositor. Los enlaces antiguos `/market/mapa?view=publicar` se adaptan a la ruta nueva, conservando la referencia pública de contexto. Abrir exploración actualiza la URL y lleva una ruta de regreso para no quedar en un overlay con la dirección de Mis pedidos.

`tab=producir&section=…` sigue siendo compatible con la gestión operativa de Actividad. El Centro de producción no se elimina: Crear ofrece un acceso directo a trabajos, cola productiva y seguimiento, además de pedidos, conversaciones y caja. Cada operación conserva sus permisos existentes.

## Componentes y datos reutilizados

- `LivingCreationWorkspace`: composición de interfaz, accesos a operaciones y publicaciones públicas recientes del actor. No añade store ni intérprete.
- `LiveNetworkPanel` + `GuidedIntentComposer`: mismo borrador de texto, interpretación simbólica, aclaraciones, revisión, consentimiento y publicación firmada. Cuatro puntos de partida: Vender, Ofrecer, Necesitar y Producir.
- `ProducirPanel`: conserva producto, precio, moneda, stock, operaciones e integraciones en el área avanzada, montada solo al desplegarla.
- La referencia de contexto solo se vincula si el DV original declara alcance público sin scopes privados. Reutiliza `threadId`, `respondsTo` y `contextRef`; no copia el registro seleccionado.
- Las respuestas abren el hilo existente; no se añade otro chat.
- El borrador de texto usa el contexto de navegación en memoria ya existente. No se afirma persistencia de borradores de archivo al cerrar/navegar ni se crean publicaciones falsas para simular borradores.

## Imagen y consentimiento

La foto se previsualiza mediante un Object URL local que se libera al desmontar. Se sube al confirmar Crear utilizando `uploadConversationReferences` y el endpoint multimedia existente; luego se guarda su referencia en el DV. No se hace reconocimiento visual, ni se finge interpretar una imagen sin texto. No se suben imágenes mientras se seleccionan o se escribe.

El servicio existente guarda medios públicos. Por eso una imagen no puede adjuntarse a una intención Solo yo: se solicita quitarla en lugar de prometer almacenamiento privado inexistente. Un error de upload no se presenta como publicación exitosa.

## Verificación y límites

`verify-creation-workspace.mjs` verifica imagen/hilo/privacidad en el constructor DV sin publicar, controles iniciales, navegación, delegación del mapa, acceso a producción y sintaxis. Se ejecutan además los contratos de AGENTS y la compilación PWA.

La validación visual interactiva, la subida al servidor con consentimiento de un titular y un recorrido comercial de producción completo no quedan acreditados por estas pruebas. No se ejecutan pagos, contratos ni producción real automáticamente. Fundación Studio y los contratos de diseño mantienen sus límites previamente documentados.
