# Visualet API

Backend separado para Visualet.

Su primera responsabilidad es leer productos desde Dolibarr, normalizarlos y entregarlos al frontend sin exponer la API key.

## Requisitos

- Node.js `>=22.12.0`

## Variables De Entorno

```text
DOLIBARR_API_URL=https://tu-dolibarr.com/api/index.php
DOLIBARR_API_KEY=secret
PORT=8787
CATALOG_CACHE_TTL_MS=300000
```

## Comandos

```sh
npm run dev
npm run start
npm run check
```

## Endpoints

```text
GET /health
GET /catalog/products
```

Ejemplo:

```text
GET /catalog/products?audience=customer&page=0&limit=100
GET /catalog/products?audience=seller&page=0&limit=100
```

## Reglas

- `DOLIBARR_API_KEY` nunca se expone al frontend.
- Cliente no recibe `stockReal`.
- Vendedor si recibe `stockReal`.
- Producto sin categoria se muestra.
- Producto inactivo no se muestra.
- Servicios no se muestran en catalogo de productos.
