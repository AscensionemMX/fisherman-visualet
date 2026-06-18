# Visualet Commercial Rules v1

Version: 1.0
Estado: Reglas comerciales iniciales
Sistema fuente: Dolibarr

## Objetivo

Definir las categorias definitivas v1 y las reglas comerciales iniciales para Visualet.

Estas reglas controlan:

- Segmentacion de clientes.
- Segmentacion de productos.
- Visibilidad de catalogo.
- Disponibilidad mostrada.
- Precio sugerido.
- Riesgo de cliente.
- Credito.
- Escalamiento a direccion.
- Uso de IA y WhatsApp Bot.

## Principio Central

```text
Dolibarr guarda la verdad.
Visualet interpreta para vender.
La IA recomienda.
Direccion autoriza excepciones.
```

## Convencion De Nombres

Las categorias deben crearse en Dolibarr con prefijos claros.

Clientes / terceros:

```text
seg_  = segmento comercial
pay_  = condicion de pago
risk_ = riesgo comercial
flag_ = bandera operativa
```

Productos:

```text
line_ = linea de producto
ch_   = canal o tipo de cliente recomendado
tag_  = etiqueta comercial
vis_  = regla de visibilidad
```

Ejemplo:

```text
seg_farmacia
pay_solo_contado
risk_mala_paga
flag_revision_direccion

line_medicamentos
ch_farmacia
tag_alta_rotacion
vis_no_mostrar_cliente
```

## Categorias Definitivas De Cliente

### Segmentos Comerciales

Estas categorias dicen que tipo de cliente es.

```text
seg_prospecto
seg_farmacia
seg_clinica_consultorio
seg_spa_cosmetica
seg_abarrotes_tienda
seg_super_mayoreo
seg_distribuidor
seg_institucional
```

Regla:

```text
Todo cliente debe tener al menos un segmento.
Si no esta definido, Visualet lo trata como seg_prospecto.
```

### Condicion De Pago

Estas categorias dicen como puede pagar.

```text
pay_contado
pay_credito_autorizado
pay_solo_contado
pay_anticipo_requerido
```

Regla:

```text
Cliente nuevo inicia como pay_contado o pay_solo_contado.
Credito solo con autorizacion de direccion.
```

### Riesgo Comercial

Estas categorias marcan comportamiento o riesgo.

```text
risk_sano
risk_pago_lento
risk_mala_paga
risk_credito_bloqueado
risk_alto_riesgo
```

Regla:

```text
El riesgo modifica precio, credito, plazo y escalamiento.
```

### Banderas Operativas

Estas categorias obligan acciones especiales.

```text
flag_revision_direccion
flag_cliente_prioritario
flag_cliente_en_observacion
flag_no_vender_credito
flag_precio_especial_manual
```

Regla:

```text
Las banderas operativas tienen prioridad sobre segmento y precio.
```

## Categorias Definitivas De Producto

### Lineas De Producto

Estas categorias describen que es el producto.

```text
line_medicamentos
line_vitaminas_suplementos
line_belleza_cuidado
line_higiene_personal
line_dermocosmetica
line_material_curacion
line_bebe_maternidad
line_sexualidad
line_consultorio_clinica
line_abarrotes_salud
line_temporada
line_otros
```

Regla:

```text
Todo producto debe tener al menos una line_.
```

### Canales Recomendados

Estas categorias dicen para que tipo de cliente conviene el producto.

```text
ch_farmacia
ch_clinica_consultorio
ch_spa_cosmetica
ch_abarrotes_tienda
ch_super_mayoreo
ch_distribuidor
ch_institucional
```

Regla:

```text
Un producto puede pertenecer a varios canales.
Visualet usa ch_ para ordenar y recomendar catalogo.
```

### Etiquetas Comerciales

Estas categorias ayudan a vender.

```text
tag_alta_rotacion
tag_margen_alto
tag_margen_bajo
tag_volumen
tag_promocion
tag_recompra
tag_producto_gancho
tag_nuevo
tag_temporada
tag_stock_lento
```

Regla:

```text
Las etiquetas ayudan a IA, vendedor y bot a recomendar.
```

### Visibilidad

Estas categorias controlan si se muestra o no.

```text
vis_publico_cliente
vis_solo_vendedor
vis_no_mostrar_cliente
vis_requiere_autorizacion
```

Regla:

```text
vis_no_mostrar_cliente oculta el producto para clientes y prospectos.
vis_solo_vendedor permite verlo solo a vendedor/direccion.
```

## Catalogo Por Segmento

### Farmacia

Segmento:

```text
seg_farmacia
```

Prioridad de productos:

```text
ch_farmacia
line_medicamentos
line_vitaminas_suplementos
line_higiene_personal
tag_alta_rotacion
tag_recompra
```

Regla:

```text
Farmacia ve primero medicamentos, alta rotacion, vitaminas e higiene.
```

### Clinica / Consultorio

Segmento:

```text
seg_clinica_consultorio
```

Prioridad:

```text
ch_clinica_consultorio
line_medicamentos
line_material_curacion
line_consultorio_clinica
tag_recompra
```

### Spa / Cosmetica

Segmento:

```text
seg_spa_cosmetica
```

Prioridad:

```text
ch_spa_cosmetica
line_belleza_cuidado
line_dermocosmetica
line_higiene_personal
tag_margen_alto
```

### Abarrotes / Tienda

Segmento:

```text
seg_abarrotes_tienda
```

Prioridad:

```text
ch_abarrotes_tienda
line_higiene_personal
line_belleza_cuidado
line_abarrotes_salud
tag_alta_rotacion
tag_producto_gancho
```

### Super Mayoreo

Segmento:

```text
seg_super_mayoreo
```

Prioridad:

```text
ch_super_mayoreo
tag_volumen
tag_alta_rotacion
tag_margen_alto
```

### Distribuidor

Segmento:

```text
seg_distribuidor
```

Prioridad:

```text
ch_distribuidor
tag_volumen
tag_alta_rotacion
tag_recompra
```

## Visibilidad De Catalogo

## Modo De Arranque Sin Categorias

Visualet debe poder funcionar aunque Dolibarr todavia no tenga categorias completas.

Regla principal:

```text
Si no hay categorias, mostrar todos los productos activos por orden alfabetico.
```

Filtro minimo inicial:

```text
type == 0
status == 1
```

Orden inicial para clientes:

```text
label ASC
```

Orden inicial alternativo para operacion interna:

```text
ref ASC
```

Regla:

```text
La falta de categoria no debe ocultar productos.
```

## Modo Con Categorias Parciales

Mientras se van categorizando productos y clientes en Dolibarr, Visualet debe mejorar progresivamente sin romper el catalogo.

Reglas:

```text
Producto sin categoria:
  se muestra
  se ordena despues de productos relevantes

Cliente sin segmento:
  ve todos los productos activos permitidos
  ordenados alfabeticamente

Cliente con segmento:
  ve primero productos relacionados con su segmento
  despues ve el resto de productos permitidos

Producto con vis_no_mostrar_cliente:
  se oculta al cliente aunque no haya otras categorias
```

## Modo Con Categorias Completas

Cuando Dolibarr tenga clientes y productos bien categorizados, Visualet debe usar las categorias para:

- Priorizar catalogo por segmento.
- Recomendar productos.
- Aplicar reglas de precio.
- Aplicar reglas de riesgo.
- Ocultar productos no permitidos.
- Mejorar respuestas del bot.

### Cliente / Prospecto

Visualet cliente debe:

- Mostrar primero productos de su segmento.
- Permitir busqueda global solo sobre productos permitidos.
- No mostrar productos con `vis_no_mostrar_cliente`.
- No mostrar stock exacto.
- Mostrar precio calculado segun reglas si el cliente esta identificado.

### Vendedor

Visualet vendedor debe:

- Ver todo producto vendible.
- Ver stock numerico real.
- Ver precio final permitido para ese cliente.
- Ver alertas de riesgo.
- Ver productos ocultos al cliente si tiene permiso.

## Disponibilidad

Dolibarr entrega:

```text
stock_reel
```

Cliente/prospecto:

```text
stock_reel <= 0  -> No disponible
stock_reel 1-10  -> Pocas piezas
stock_reel >= 11 -> Disponible
```

Vendedor:

```text
Mostrar stock numerico real.
```

Regla:

```text
El cliente no ve inventario exacto.
El vendedor si ve inventario exacto.
```

## Precio Base

Dolibarr entrega:

```text
price
price_ttc
```

Regla:

```text
El precio base sale de Dolibarr.
Visualet calcula precio mostrado usando segmento, riesgo y producto.
```

## Precio Por Segmento

Estos ajustes son v1. Direccion puede cambiarlos despues de revisar datos reales.

```text
seg_farmacia:
  ajuste_segmento = 0%

seg_clinica_consultorio:
  ajuste_segmento = 0%

seg_spa_cosmetica:
  ajuste_segmento = 0% a 5% segun producto

seg_abarrotes_tienda:
  ajuste_segmento = 0% a 8% segun producto

seg_super_mayoreo:
  ajuste_segmento = -3% a -8% solo si hay volumen y margen

seg_distribuidor:
  ajuste_segmento = -2% a -6% solo si hay volumen y margen

seg_institucional:
  ajuste_segmento = manual / requiere direccion

seg_prospecto:
  ajuste_segmento = 0% o consultar precio segun configuracion
```

Regla:

```text
Los descuentos por volumen no aplican si el cliente tiene riesgo alto.
```

## Ajuste Por Riesgo

```text
risk_sano:
  ajuste_riesgo = 0%

risk_pago_lento:
  ajuste_riesgo = 2% a 5%
  plazo corto

risk_mala_paga:
  ajuste_riesgo = 5% a 15%
  credito limitado o anticipo

risk_credito_bloqueado:
  ajuste_riesgo = 8% a 18%
  solo contado o anticipo

risk_alto_riesgo:
  ajuste_riesgo = 10% a 25%
  requiere direccion
```

Regla:

```text
La IA puede recomendar el porcentaje exacto.
El motor de reglas valida que este dentro del rango.
Direccion autoriza fuera de rango.
```

## Ajuste Por Producto

Las etiquetas de producto modifican el precio permitido.

```text
tag_margen_bajo:
  no permitir descuento fuerte
  aplicar ajuste de riesgo completo

tag_margen_alto:
  permite promociones controladas
  puede absorber parte del riesgo

tag_volumen:
  permite descuento si cliente tiene bajo riesgo y compra cantidad

tag_producto_gancho:
  puede mantener precio agresivo para abrir venta

tag_stock_lento:
  puede permitir descuento para mover inventario

tag_alta_rotacion:
  proteger margen
  evitar descuento innecesario
```

## Formula Conceptual De Precio

```text
precio_base = Dolibarr.price
precio_segmento = precio_base + ajuste_segmento
precio_riesgo = precio_segmento + ajuste_riesgo
precio_producto = aplicar regla por tag_
precio_visualet = precio final permitido
```

Regla:

```text
El vendedor ve precio_visualet.
Cliente identificado ve precio_visualet si la politica lo permite.
Prospecto puede ver precio base o consultar precio.
```

## Credito

Reglas base:

```text
Cliente nuevo inicia contado.
Credito solo con autorizacion de direccion.
Todo credito debe tener limite y plazo.
```

Condiciones:

```text
pay_contado:
  pago antes de entrega o contra entrega

pay_credito_autorizado:
  respetar limite y plazo

pay_solo_contado:
  no credito

pay_anticipo_requerido:
  requiere anticipo antes de surtir
```

Riesgo:

```text
risk_sano:
  puede usar credito si esta autorizado

risk_pago_lento:
  credito corto y limitado

risk_mala_paga:
  credito solo con direccion

risk_credito_bloqueado:
  no credito

risk_alto_riesgo:
  no credito sin autorizacion especial
```

## Escalamiento A Direccion

Visualet debe escalar si:

- Cliente nuevo solicita credito.
- Cliente tiene `flag_revision_direccion`.
- Cliente tiene `risk_credito_bloqueado`.
- Cliente tiene `risk_alto_riesgo`.
- Pedido supera limite de credito.
- Precio calculado queda fuera de rango.
- Descuento solicitado no esta permitido.
- Pedido grande de prospecto.
- Producto tiene `vis_requiere_autorizacion`.
- Bot detecta duda medica, receta o diagnostico.
- Bot no entiende la solicitud.

## IA Comercial

La IA puede:

- Recomendar productos.
- Sugerir sustitutos.
- Priorizar catalogo.
- Sugerir precio dentro de rango.
- Sugerir condicion de pago.
- Resumir historial de cliente.
- Redactar mensajes de WhatsApp.
- Alertar riesgo.

La IA no puede:

- Inventar productos.
- Inventar stock.
- Inventar precio base.
- Autorizar credito.
- Crear pedido oficial sin reglas.
- Dar consejo medico.
- Recetar.

## WhatsApp Bot

El bot puede:

- Identificar cliente por telefono.
- Mostrar catalogo relevante.
- Responder disponibilidad por rango.
- Armar solicitud.
- Sugerir alternativas.
- Escalar a vendedor o direccion.

El bot no puede:

- Mostrar stock exacto al cliente.
- Autorizar credito.
- Dar consejo medico.
- Confirmar precio final si requiere validacion.
- Confirmar pedido oficial si no existe en Dolibarr.

## Ejemplos

### Farmacia Sana

```text
Categorias cliente:
seg_farmacia
pay_credito_autorizado
risk_sano

Resultado:
catalogo farmacia primero
precio base
credito segun limite
stock por rango para cliente
stock numerico para vendedor
```

### Abarrotes Mala Paga

```text
Categorias cliente:
seg_abarrotes_tienda
risk_mala_paga
pay_anticipo_requerido

Resultado:
catalogo abarrotes primero
precio base + ajuste riesgo
anticipo o contado
credito solo con direccion
```

### Super Mayoreo Sano

```text
Categorias cliente:
seg_super_mayoreo
pay_credito_autorizado
risk_sano

Resultado:
catalogo volumen primero
descuento por volumen si margen lo permite
credito segun limite
```

### Prospecto

```text
Categorias cliente:
seg_prospecto
pay_contado

Resultado:
catalogo segun giro declarado
contado por defecto
precio base o consultar precio
requiere aprobacion para cliente oficial
```

## Pendientes Para Configurar En Dolibarr

1. Crear categorias de tercero con prefijos `seg_`, `pay_`, `risk_`, `flag_`.
2. Crear categorias de producto con prefijos `line_`, `ch_`, `tag_`, `vis_`.
3. Arrancar mostrando todos los productos activos por orden alfabetico.
4. Clasificar productos prioritarios primero.
5. Clasificar clientes actuales poco a poco.
6. Definir montos exactos para escalamiento.
7. Definir si prospectos ven precio o solo "consultar precio".
8. Definir limites iniciales de credito por cliente.
9. Validar que API de Dolibarr devuelva categorias de producto y tercero.
