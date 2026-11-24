# Alta real y continuidad · auditoría del 20-10-2026

## Corrección aplicada

Se quitaron de la experiencia comercial el bloque de siete ensayos, la instalación de fixtures, la coordinación simulada y el alta para otro dueño que reconstruía un nodo con otro UUID. Daily y el panel personal tampoco enlazan a las fichas piloto. «Mi espacio» y la cola administrativa excluyen manifiestos marcados como simulación, sin borrarlos ni quitar sus restricciones para presentarlos como negocios reales. Los helpers y evidencias de pruebas quedan fuera del grafo de la aplicación; no deben desplegarse como comercio.

Se rediseñó la jerarquía de «Mi espacio»: hero, nodos verificables, continuidad de administración, búsqueda en el ecosistema e identidad/recuperación. Se conservan rutas, cola, catálogo proyectado, identidad, permisos y consentimiento de las funciones existentes. Los estados de preparación siguen siendo visibles cuando corresponden a manifiestos reales; no se infiere disponibilidad. No hubo verificación visual de navegador/dispositivo en este incremento.

## Lo que la auditoría no permite afirmar

**No se han creado ni desplegado siete negocios operativos.** Quitar etiquetas no genera endpoints, ejecutores, catálogos, autenticación o almacenamiento remoto. La creación local anterior no es aprovisionamiento productivo y se retiró de esta superficie. La acción de alta se muestra explícitamente no habilitada, no como una integración ficticia.

- `public/utopy-bootstrap-nodes.json` contiene las fuentes alojadas de La Piedra, DecoHogar y LUVÉAU. No contiene servicios reales para los siete negocios pedidos. Sus fuentes y anclajes no se modificaron.
- Los proyectos locales inspeccionados de DecoHogar y LUVÉAU contienen backend/cPanel, fuentes de catálogo y administración propios. No equivalen a una API universal de aprovisionamiento disponible desde Market.
- `identityContext.controlsNode()` comprueba la clave personal firmante del manifiesto. `businessAccess()` también reconoce ese controlador. Añadir un `node.authorization` para otra persona **no revoca al controlador**. Cambiar una etiqueta `owner` tampoco lo hace.
- Runtime dispone de autoridad/confianza, mandatos y context-handoff/ACK. La revocación segura tiene que aplicarse en el nodo/servidor de autoridad, persistir y publicarse por los contratos existentes. No basta un filtro frontend o un DV firmado por una persona que sigue conservando el control anterior.
- El servicio de alta y continuidad de administración de Fundación no está identificado/configurado en este workspace. No se desplegó un reemplazo improvisado ni se eligieron claves, dominios o cuentas de dueños.

## Contrato de continuidad que debe completar el host real

La autoridad comercial y claves del nodo permanecen estables y separadas de sus operadores personales. El alta autentica al creador y crea sus permisos limitados explícitos. La incorporación verifica a la nueva identidad, obtiene aceptación y prueba de autorización del negocio y registra la nueva administración de forma atómica. Después aplica las revocaciones/sucesión correspondientes y conserva solo las delegaciones que autorice el responsable. Deben conservarse nodeId, catálogo, operaciones, historial y fuentes; no reconstruir ni migrar ocultamente por UUID.

Reutilizar las primitivas de Runtime y los mecanismos del host, verificando origen/audiencia, desafíos expiran/uso único, rechazo de replay, sesiones/CSRF, concurrencia, revocaciones, auditoría, respaldo y rollback operativo. Una proyección local sin el estado de autoridad vigente no puede habilitar acciones productivas.

## Bloqueo para completar la solicitud

Falta identificar el backend/repositorio y destino de despliegue que deben custodiar la autoridad de los nodos, persistir sus datos y aceptar altas/vinculaciones autenticadas. Se requiere esa decisión del operador antes de conectar y habilitar el alta real. No es necesario compartir contraseñas ni claves privadas por el chat. Hasta resolverlo, la entrega es una corrección de UI y de límites de seguridad, **no** el sistema de producción solicitado.
