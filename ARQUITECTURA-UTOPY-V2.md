# Arquitectura UTOPY v2

## Regla

> Falcon conoce la red. El nodo se presenta a sí mismo.

## Roles

- **Nodo propietario:** fuente de verdad, reglas, catálogo, pagos, fidelidad y ejecución.
- **Seed/Micelio:** propagación y descubrimiento; no se convierte en dueño de los datos.
- **mt.liveStore:** caché local y lectura offline; elimina DVs vencidos por TTL.
- **Resonador:** interpreta propósito y capacidades sin nombres codificados.
- **Falcon/Market:** superficie visual y de interacción.

## Manifiesto vivo

```json
{
  "kind": "utopy.node.manifest",
  "attrs": {
    "node": { "id": "utopy.node.ejemplo", "name": "Nodo Ejemplo" },
    "endpoints": {
      "manifest": "https://ejemplo.test/api/catalog-live.php",
      "catalog": "https://ejemplo.test/api/catalog-live.php"
    },
    "capabilities": [
      {
        "id": "catalog.offer",
        "accepts": ["product.requested"],
        "produces": ["catalog.offer"],
        "surfaces": ["market"]
      }
    ],
    "discovery": {
      "protocol": "utopy.node.manifest@2",
      "mode": "self-announced",
      "heartbeatMs": 30000,
      "expiresAt": "..."
    }
  },
  "meta": {
    "ns": "utopy:nodes",
    "ttl_ms": 90000,
    "scopes": ["public"]
  }
}
```

## Bootstrap

`VITE_BOOTSTRAP_NODE_SOURCES` existe únicamente para una red recién creada o una recuperación. Un manifiesto vivo reemplaza al bootstrap del mismo nodo. En operación normal puede permanecer como `[]`.
