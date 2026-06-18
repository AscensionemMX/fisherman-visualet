# Visualet API-First Design

Version: 0.1
Estado: Diseno inicial
Sistema fuente: Dolibarr

## Decision Principal

Visualet no debe depender de captura manual como flujo objetivo.

Visualet debe extraer informacion desde Dolibarr usando la API REST y debe sincronizar solicitudes, prospectos y pedidos hacia Dolibarr segun permisos y reglas de negocio.

Regla:

```text
Dolibarr es la fuente oficial.
Visualet es la interfaz comercial offline/online para vendedores y clientes.
```

## Principio Tecnico

Visualet no debe llamar directamente a Dolibarr desde el navegador usando la API key.

La API key de Dolibarr es secreta y debe vivir en un backend propio de Visualet.

Arquitectura recomendada:

```text
Tablet / navegador Visualet
-> Visualet Backend
-> Dolibarr REST API
```

No recomendado:

```text
Tablet / navegador Visualet
-> Dolibarr REST API con DOLAPIKEY expuesta
```

## Dolibarr REST API

Segun la documentacion oficial de Dolibarr:

- El modulo API REST debe estar activado.
- Las llamadas usan rutas como `/api/index.php/<accion>`.
- El API explorer esta en `/api/index.php/explorer`.
- La autenticacion usa header `DOLAPIKEY`.
- Las APIs disponibles dependen de los modulos activados en Dolibarr.

Fuente:

```text
https://wiki.dolibarr.org/index.php/Module_Web_Services_API_REST_(developer)
```

## Modulos Dolibarr Que Visualet Necesita

Visualet debe usar Dolibarr para leer:

- Productos.
- Terceros/clientes.
- Precios.
- Stock.
- Pedidos.
- Proformas/documentos internos.

Modulos probables:

- Productos/servicios.
- Terceros.
- Pedidos de cliente.
- Facturas/proformas.
- Stock/almacenes, si se usa inventario por almacen.

La lista exacta se debe validar en el API explorer de la instalacion real.

## Datos Que Visualet Debe Leer De Dolibarr

### Productos

Objetivo:

```text
Mostrar catalogo comercial.
```

Datos minimos:

- ID Dolibarr.
- Referencia.
- Nombre.
- Descripcion.
- Categoria.
- Presentacion.
- Precio.
- Impuesto si aplica.
- Estatus vendible.
- Stock disponible.
- Imagen si existe.
- Fecha de ultima actualizacion.

Uso:

```text
GET /api/index.php/products
```

La ruta final y filtros se validan en el explorer de Dolibarr.

### Clientes / Terceros

Objetivo:

```text
Seleccionar cliente existente y evitar duplicados.
```

Datos minimos:

- ID Dolibarr.
- Nombre.
- Telefono.
- Direccion o zona.
- Condicion comercial.
- Estado activo/inactivo.
- Notas internas relevantes.

Uso:

```text
GET /api/index.php/thirdparties
POST /api/index.php/thirdparties
```

Regla:

```text
La creacion de cliente desde Visualet debe estar protegida por aprobacion de direccion.
```

### Pedidos

Objetivo:

```text
Crear pedido oficial en Dolibarr cuando el pre-pedido ya fue autorizado.
```

Flujo tecnico recomendado:

```text
Crear pedido
-> agregar lineas
-> validar pedido cuando proceda
```

La documentacion oficial indica que crear un pedido con lineas en una sola llamada puede no estar soportado correctamente y recomienda crear el pedido primero y despues agregar lineas con `/orders/{id}/lines`.

Uso esperado:

```text
POST /api/index.php/orders
POST /api/index.php/orders/{id}/lines
POST /api/index.php/orders/{id}/validate
```

La validacion final debe respetar reglas de stock, precio, contado/credito y aprobacion.

## Flujo Visualet Online

```text
Vendedor abre Visualet
-> Visualet consulta cache local
-> si hay internet, refresca catalogo desde backend
-> backend consulta Dolibarr
-> vendedor selecciona cliente o prospecto
-> arma pedido
-> Visualet envia solicitud al backend
-> backend valida reglas
-> backend crea o prepara pedido en Dolibarr si esta autorizado
```

## Flujo Visualet Offline

```text
Vendedor abre Visualet sin internet
-> Visualet usa catalogo cacheado
-> vendedor selecciona cliente/prospecto cacheado o crea prospecto local
-> arma pre-pedido
-> Visualet guarda folio temporal
-> pre-pedido queda pendiente de sincronizar
-> al volver internet, Visualet envia cola pendiente al backend
-> backend valida y sincroniza con Dolibarr
```

## Cache Offline

Visualet debe guardar localmente:

- Catalogo.
- Clientes asignados o consultados.
- Categorias.
- Precios sugeridos.
- Fecha de ultima actualizacion.
- Prospectos pendientes.
- Pre-pedidos pendientes.
- Estado de sincronizacion.

Tecnologia recomendada:

```text
IndexedDB
```

Motivo:

- Mejor que localStorage para volumen de datos.
- Permite guardar objetos estructurados.
- Funciona bien para modo offline en navegador/tablet.

## Estados De Sincronizacion

```text
Local
Pendiente de sincronizar
Sincronizando
Sincronizado
Error de sincronizacion
Requiere revision
Convertido en Dolibarr
Cancelado
```

## Conflictos

Visualet debe manejar estos casos:

### Producto sin stock

```text
El pedido no se confirma.
Se ofrece ajuste, sustitucion, entrega parcial o espera.
```

### Precio cambio

```text
Se muestra diferencia.
Direccion o vendedor confirma con cliente antes de avanzar.
```

### Cliente no aprobado

```text
No se crea pedido oficial.
Prospecto queda pendiente, rechazado o en seguimiento.
```

### Credito no autorizado

```text
Pedido queda en contado o pendiente de autorizacion.
```

### Error API Dolibarr

```text
Visualet conserva el pre-pedido local.
No borra la informacion.
Marca error y permite reintentar.
```

## Backend Visualet

Responsabilidades:

- Guardar secretos de Dolibarr.
- Consultar API REST de Dolibarr.
- Normalizar productos para Visualet.
- Controlar cache.
- Recibir pre-pedidos sincronizados.
- Validar reglas antes de crear pedidos.
- Crear clientes solo cuando direccion apruebe.
- Crear pedidos en Dolibarr.
- Agregar lineas de pedido.
- Registrar folio temporal en nota interna.
- Manejar errores y reintentos.

## Variables De Entorno

Ejemplo:

```text
DOLIBARR_API_URL=https://tu-dolibarr.com/api/index.php
DOLIBARR_API_KEY=secret
VISUALET_SYNC_ENABLED=false
VISUALET_ALLOW_ORDER_CREATE=false
VISUALET_ALLOW_THIRDPARTY_CREATE=false
```

## Permisos Por Fase

### Fase 1 - Lectura API

Visualet lee:

- Productos.
- Clientes.
- Stock.
- Precios.

Visualet guarda offline:

- Prospectos.
- Pre-pedidos.

No crea pedidos automaticamente todavia.

### Fase 2 - Sincronizacion Controlada

Visualet envia:

- Prospectos.
- Pre-pedidos.

Backend deja todo en estado:

```text
Pendiente de aprobacion
```

Direccion aprueba.

### Fase 3 - Escritura En Dolibarr

Backend puede:

- Crear tercero/cliente aprobado.
- Crear pedido.
- Agregar lineas.
- Registrar folio Visualet.

Solo si:

- Cliente aprobado.
- Precio validado.
- Stock validado.
- Condicion de pago validada.

### Fase 4 - Validacion Y Proforma

Backend puede:

- Validar pedido si procede.
- Preparar proforma/documento interno si se decide automatizar.

## Pantallas Necesarias

### Vendedor

```text
/seller
/seller/catalog
/seller/prospect/new
/seller/order/new
/seller/sync
/seller/history
```

### Direccion

```text
/admin/prospects
/admin/preorders
/admin/sync-errors
/admin/settings
```

### Cliente

```text
/catalog
/cart
/request
```

## Modelo De Datos Visualet

### ProductCache

```text
id
dolibarrProductId
ref
label
description
category
priceSuggested
stockSuggested
imageUrl
lastSyncedAt
```

### ProspectDraft

```text
id
temporaryFolio
businessName
contactName
phone
zone
businessType
sellerId
notes
syncStatus
createdAt
updatedAt
```

### PreOrderDraft

```text
id
temporaryFolio
sellerId
prospectId
dolibarrThirdpartyId
lines
subtotalSuggested
paymentConditionRequested
deliveryDateRequested
notes
syncStatus
dolibarrOrderId
createdAt
updatedAt
```

## Reglas No Negociables

```text
No exponer DOLAPIKEY en frontend.
No borrar pre-pedidos locales si falla sincronizacion.
No crear cliente en Dolibarr sin aprobacion.
No crear pedido oficial sin validar cliente, precio y stock.
No prometer precio final desde datos cacheados.
No prometer stock final desde datos cacheados.
Todo pedido creado desde Visualet debe guardar folio temporal.
```

## Siguiente Paso Tecnico

1. Separar catalogo actual de `catalog.astro` hacia `src/data/products.ts`.
2. Crear tipos de dominio para productos, prospectos y pre-pedidos.
3. Crear prototipo de almacenamiento offline con IndexedDB.
4. Crear backend/proxy Visualet para conectar con Dolibarr sin exponer API key.
5. Probar lectura real con el API explorer de Dolibarr.
