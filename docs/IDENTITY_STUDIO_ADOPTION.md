# Identidad y presencia visual · adopción

## Implementado en Market

- `LivingProfileQuickView`: modal de identidad compartido por Market y Falcon. Reutiliza Perfil Vivo, Caja Viva, conversaciones, Bóveda Viva y el panel de nodos. Sin editor visual ni nuevos stores.
- Header compacto: búsqueda, carrito y avatar; filtros de namespace, voz y Frecuencia siguen accesibles en Más herramientas.
- `studioProfileBridge.studioProfileUrl`: abre Studio, pasando únicamente el nodo y un retorno HTTPS. No transfiere sesión, datos personales ni permisos. Studio sigue autenticando y autorizando.
- Configuración: usa los formularios de contenido/identidad existentes. No personaliza ropa, avatares 3D ni implementa un editor visual.
- Perfil público: enlace canónico, currículum conforme al consentimiento existente, acciones que envuelven en móvil, acceso al único diseñador.
- Checkout: total y confirmación persistentes; conserva el flujo firmado, los permisos, el acuerdo con el comercio y el proveedor existente. Confirmar pedido no equivale a confirmar cobro.

## Evidencias auditadas fuera de este repositorio (solo lectura)

- Fundación `src/studio/NodeStudio.tsx`: `initialNodeId`, `node.get`, `LivingCreationEditor`, `node.projection.set`.
- Fundación `src/studio/StudioPage.tsx`: `/studio?nodeId=…`; `safeReturn` acepta dominios productivos de Market/Falcon/Skylines. Los retornos localhost no se aceptan actualmente.
- Fundación `src/core/nodePresence.ts`: `utopy.node.presence/1`, contenido, apariencia, secciones, referencias de capacidades y `publishedSnapshot`.
- Fundación `src/studio/creationModel.ts`: plantillas reales: negocio, tienda, profesional, portafolio, comunidad, educación. No hay plantilla específica de currículum en esa lista.
- Market `src/pages/IdentitySessionSigner.tsx`: challenge/proof existente contra `https://studio.utopy.space`. El acceso visual no sustituye esa autenticación.

## Configuración y límites reales

`VITE_UTOPY_STUDIO_URL` puede apuntar a la ruta HTTPS del diseñador. Por defecto se reutiliza el origen Studio existente y `/studio`. Un enlace anunciado por un DV Studio verificado tiene prioridad. Ninguna URL concede autoridad.

No se encontró entrega firmada y adoptada de `NodePresence` publicado hacia el store de Market. No se agregó un transporte, un contrato ficticio ni un renderer de datos no verificados. Por lo tanto **guardar en Studio no sincroniza automáticamente el diseño en Market** con estos cambios. El perfil personal sin nodo tampoco tiene selección por actor en `NodeStudio` actual: abre el espacio autenticado de Studio, que conserva la decisión sobre sus nodos autorizados. No se anuncia un editor personal inexistente.

Para completar: Fundación debe exponer su presencia publicada (no el borrador) mediante el transporte y la autoridad existentes, con sujeto canónico, versión, consentimiento, revocación y referencias de contenido. Market podrá proyectar el mismo contrato sin cargar `LivingCreationEditor`. No clonar el diseñador ni asumir que una firma equivale a confianza.

Tarjetas guardadas/tokenización requieren un proveedor que anuncie y autorice esa capacidad. No se creó un formulario PAN/CVV, ni tarjetas, saldos o suscripciones de ejemplo. Mi Valor reutiliza sus derechos y relaciones verificadas; pagos/suscripciones enlazan con Mis pedidos y los contratos financieros existentes. No se promete un panel de cuentas bancarias ni una integración nueva.

Pruebas: `node tests/verify-premium-identity.mjs`, `node tests/verify-living-resume.mjs` y los cinco contratos de AGENTS. Las pruebas de sintaxis/contrato no sustituyen pruebas visuales ni una transacción con proveedor real.
