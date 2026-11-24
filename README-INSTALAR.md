# UTOPY Descubrimiento Vivo v2

Esta evolución elimina la necesidad de escribir DecoHogar, LaPiedra u otro negocio dentro de Falcon.

## Flujo final

```text
Nodo publica utopy.node.manifest
        ↓
Seed/Micelio propaga el latido
        ↓
Market/Falcon descubre endpoints y capacidades
        ↓
Consulta el catálogo del nodo
        ↓
mt.liveStore interpreta y conserva caché local
        ↓
Resonador conecta propósito → capacidad → reacción → resultado
```

## 1. MS Market / Falcon

Copiar dentro del proyecto:

```text
src/mt/liveCatalog.sources.ts
src/mt/mt.liveStore.ts
src/mt/utopy.networkPublish.ts
src/mt/utopy.nodeManifest.ts
src/utopy/bootLiveSymbiosis.ts
```

El arranque global debe ejecutar una sola vez:

```ts
import { bootLiveSymbiosis } from "./utopy/bootLiveSymbiosis";

useEffect(() => bootLiveSymbiosis(), []);
```

Crear `.env` desde `.env.utopy.example`:

```env
VITE_MICELIO_HTTP=https://seed.mterra.space/micelio
VITE_SEED_WS=wss://seed.mterra.space/utopy?ns=mt
VITE_FALCON_MT_NS=mt:market,utopy:nodes,utopy:resonance
VITE_BOOTSTRAP_NODE_SOURCES=[]
```

No se agregan URLs de negocios. Después:

```powershell
pnpm install
pnpm build
```

Subir el contenido de `dist/` al dominio de Falcon/MS Market.

## 2. DecoHogar en cPanel

Subir/reemplazar:

```text
api/catalog-live.php
utopy-node-heartbeat.js
```

Agregar antes de `</body>` en `index.html`:

```html
<script
  src="/utopy-node-heartbeat.js"
  data-manifest-url="/api/catalog-live.php"
  data-seed-ws="wss://seed.mterra.space/utopy?ns=mt"
  data-heartbeat-ms="30000"
></script>
```

Existe también un ZIP de DecoHogar cPanel ya actualizado.

## 3. LaPiedra

Reemplazar:

```text
public/api/catalog-live.php
```

Copiar:

```text
public/utopy-node-heartbeat.js
```

Agregar el mismo `<script>` al `index.html` que termina publicado.

## 4. Cómo entra un nodo nuevo

El nodo nuevo solo necesita:

1. Un endpoint público que devuelva `utopy.node.manifest`.
2. Endpoints HTTPS declarados por el propio nodo.
3. Capacidades, propósitos aceptados y resultados producidos.
4. El script de latido o `startNodeManifestHeartbeat()`.

Falcon no se modifica ni se recompila para ese nodo.

## Seguridad

El manifiesto solo contiene información pública:

- identidad del nodo;
- capacidades;
- endpoints públicos;
- superficies compatibles;
- tiempo de vida del latido.

Nunca incluir:

- contraseña bancaria;
- clave privada Bancard;
- token de administración;
- contraseña cPanel;
- credenciales de base de datos.

El descubridor acepta HTTPS, bloquea destinos privados/locales fuera del modo de desarrollo, omite credenciales al consultar y descarta manifiestos vencidos.
