# Visualet Catalog API Contract

Version: 0.1
Estado: Contrato inicial
Sistema fuente: Dolibarr

## Objetivo

Definir el contrato tecnico para conectar el catalogo de Visualet con productos reales de Dolibarr.

Este contrato cubre:

- Request a Dolibarr.
- Filtros iniciales.
- Mapeo de producto Dolibarr a producto Visualet.
- Respuesta para cliente.
- Respuesta para vendedor.
- Disponibilidad por rango.
- Orden alfabetico inicial.
- Comportamiento con categorias parciales.

## Principio

```text
Dolibarr entrega datos crudos.
Visualet Backend normaliza, cachea y aplica reglas.
Visualet Frontend solo consume datos listos para mostrar.
```

## Arquitectura

```text
Visualet Frontend
-> GET /api/catalog/products
-> Visualet Backend
-> GET /api/index.php/products
-> Dolibarr
```

Regla de seguridad:

```text
El frontend nunca debe conocer DOLAPIKEY.
```

## Request Inicial A Dolibarr

Endpoint:

```text
GET /api/index.php/products
```

Parametros iniciales:

```text
sortfield=t.label
sortorder=ASC
limit=100
mode=1
includestockdata=1
```

Significado:

```text
sortfield=t.label     ordenar por nombre
sortorder=ASC         orden alfabetico ascendente
limit=100             lote inicial de 100 productos
mode=1                solo productos, no servicios
includestockdata=1    incluir informacion de stock
```

Para paginacion:

```text
page=0
page=1
page=2
```

Request ejemplo:

```text
/api/index.php/products?sortfield=t.label&sortorder=ASC&limit=100&page=0&mode=1&includestockdata=1
```

## Filtro Inicial

Mientras no haya categorias completas, Visualet debe mostrar productos activos.

Filtro logico:

```text
type == "0"
status == "1"
```

Regla:

```text
Producto sin categoria se muestra.
Producto inactivo no se muestra.
Servicio no se muestra en catalogo de productos.
```

## Producto Dolibarr Ejemplo

```json
{
  "id": "11134",
  "ref": "022IQF",
  "status": "1",
  "label": "IQFMACINA SUSP 250MG/100ML",
  "description": null,
  "type": "0",
  "price": "60.00000000",
  "price_ttc": "60.00000000",
  "stock_reel": "10",
  "status_buy": "1",
  "barcode": null,
  "stockable_product": "1"
}
```

## Mapeo Dolibarr -> Visualet

```text
id                 -> dolibarrProductId
ref                -> sku
label              -> name
description        -> description
price              -> priceBase
price_ttc          -> priceWithTax
stock_reel         -> stockReal
status             -> isActive
type               -> isProduct
status_buy         -> canBuy
stockable_product  -> isStockable
barcode            -> barcode
```

Reglas de transformacion:

```text
description:
  usar description si existe
  si no existe, usar label

priceBase:
  convertir string decimal a number

priceShown:
  mostrar precio final al cliente
  usar price_ttc cuando Dolibarr lo entregue
  si price_ttc no existe y price_base_type == "HT" con tva_tx > 0,
  calcular price * (1 + tva_tx / 100)
  si no hay datos fiscales suficientes, no inventar IVA y usar price

stockReal:
  convertir string a number

isActive:
  status == "1"

isProduct:
  type == "0"

canBuy:
  status_buy == "1"

isStockable:
  stockable_product == "1"
```

## Modelo Normalizado Visualet

```ts
type VisualetCatalogProduct = {
  dolibarrProductId: string;
  sku: string;
  name: string;
  description: string;
  priceBase: number;
  priceWithTax: number;
  priceShown: number;
  stockReal: number;
  customerAvailability: "No disponible" | "Pocas piezas" | "Disponible";
  sellerAvailability: string;
  isActive: boolean;
  isProduct: boolean;
  canBuy: boolean;
  isStockable: boolean;
  barcode: string | null;
  categories: string[];
  visibility: "public" | "seller_only" | "hidden_customer" | "requires_authorization";
  lastSyncedAt: string;
};
```

## Disponibilidad

### Cliente / Prospecto

```text
stockReal <= 0  -> No disponible
stockReal 1-10  -> Pocas piezas
stockReal >= 11 -> Disponible
```

### Vendedor

```text
sellerAvailability = "[stockReal] piezas"
```

Ejemplos:

```text
0  -> vendedor ve "0 piezas"; cliente ve "No disponible"
10 -> vendedor ve "10 piezas"; cliente ve "Pocas piezas"
11 -> vendedor ve "11 piezas"; cliente ve "Disponible"
```

## Respuesta Para Cliente

Endpoint:

```text
GET /api/catalog/products?audience=customer
```

Respuesta:

```json
{
  "items": [
    {
      "dolibarrProductId": "11134",
      "sku": "022IQF",
      "name": "IQFMACINA SUSP 250MG/100ML",
      "description": "IQFMACINA SUSP 250MG/100ML",
      "priceShown": 60,
      "availability": "Pocas piezas",
      "lastSyncedAt": "2026-06-18T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 0,
    "limit": 100,
    "hasMore": true
  }
}
```

Regla:

```text
Cliente no recibe stockReal.
```

## Respuesta Para Vendedor

Endpoint:

```text
GET /api/catalog/products?audience=seller
```

Respuesta:

```json
{
  "items": [
    {
      "dolibarrProductId": "11134",
      "sku": "022IQF",
      "name": "IQFMACINA SUSP 250MG/100ML",
      "description": "IQFMACINA SUSP 250MG/100ML",
      "priceShown": 60,
      "stockReal": 10,
      "availability": "10 piezas",
      "lastSyncedAt": "2026-06-18T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 0,
    "limit": 100,
    "hasMore": true
  }
}
```

Regla:

```text
Vendedor si recibe stockReal.
```

## Categorias

Cuando Dolibarr entregue categorias, Visualet debe mapearlas a:

```text
categories: string[]
```

Ejemplo:

```text
line_medicamentos
ch_farmacia
tag_alta_rotacion
vis_publico_cliente
```

Si un producto no tiene categorias:

```text
categories = []
```

Regla:

```text
Producto sin categoria se muestra.
Producto con vis_no_mostrar_cliente se oculta a clientes.
```

## Orden

Sin categorias:

```text
Ordenar por name ASC.
```

Con categorias:

```text
1. Productos relacionados con segmento del cliente.
2. Productos permitidos no relacionados.
3. Productos sin categoria.
4. Orden alfabetico dentro de cada grupo.
```

## Cache

Visualet Backend debe cachear productos normalizados.

Motivo:

- Catalogo 24/7.
- Menos carga a Dolibarr.
- Respuesta rapida.
- Tolerancia si Dolibarr esta lento.

Regla:

```text
Si Dolibarr falla, Visualet puede mostrar ultima version sincronizada.
Debe mostrar lastSyncedAt.
```

## Errores

Si Dolibarr no responde:

```json
{
  "items": [],
  "source": "cache",
  "warning": "Dolibarr no disponible. Mostrando ultima version sincronizada."
}
```

Si no hay cache:

```json
{
  "items": [],
  "source": "none",
  "error": "Catalogo temporalmente no disponible."
}
```

## Reglas No Negociables

```text
No exponer DOLAPIKEY.
No mostrar stock real al cliente.
No ocultar productos por falta de categoria.
No mostrar productos inactivos.
No mostrar servicios como productos.
No depender de Dolibarr en tiempo real para cada visita del cliente.
Siempre guardar lastSyncedAt.
```

## Siguiente Paso Tecnico

Crear Visualet Backend minimo con:

```text
GET /api/catalog/products
```

Responsabilidades:

```text
leer Dolibarr /products
normalizar producto
aplicar filtro activo/producto
calcular disponibilidad cliente/vendedor
cachear respuesta
devolver contrato Visualet
```
