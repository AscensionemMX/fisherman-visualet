# Categorias y tags definitivas en Dolibarr

Este documento fija las categorias que se usaran en Dolibarr para que Visualet pueda leer clientes, productos, segmentos, riesgo comercial, visibilidad y filtros del catalogo.

Dolibarr es la fuente principal. Visualet solo interpreta estas categorias para mostrar, filtrar, calcular o recomendar.

## Clientes / terceros

Estas categorias se asignan a terceros en Dolibarr.

### Canal del cliente

Sirven para identificar el tipo de negocio del cliente o prospecto.

| Codigo Dolibarr | Nombre visible |
| --- | --- |
| `ch_abarrotes` | Abarrotes |
| `ch_farmacias` | Farmacias |
| `ch_clinicas_consultorios` | Clinicas y consultorios |
| `ch_esteticas_spas` | Esteticas y spas |
| `ch_naturistas` | Naturistas |
| `ch_distribuidor` | Distribuidor |
| `ch_publico_general` | Publico general |

### Estado comercial

Sirven para saber en que etapa esta el tercero.

| Codigo Dolibarr | Uso |
| --- | --- |
| `status_prospecto` | Prospecto todavia no convertido en cliente activo |
| `status_cliente_activo` | Cliente activo |
| `status_cliente_inactivo` | Cliente inactivo |
| `status_requiere_revision` | Requiere revision antes de vender o dar condiciones |

### Forma de pago / riesgo

Sirven para controlar credito, contado y riesgo comercial.

| Codigo Dolibarr | Uso |
| --- | --- |
| `pay_contado` | Cliente solo contado |
| `pay_credito_autorizado` | Cliente con credito autorizado |
| `pay_credito_restringido` | Cliente con credito limitado o condicionado |
| `risk_normal` | Riesgo normal |
| `risk_observar` | Cliente a observar |
| `risk_mala_paga` | Cliente mala paga |

### Nivel comercial

Sirven para segmentar precios, reglas y prioridad comercial.

| Codigo Dolibarr | Uso |
| --- | --- |
| `seg_publico` | Precio o trato publico/general |
| `seg_mayoreo` | Cliente de mayoreo |
| `seg_super_mayoreo` | Cliente de super mayoreo |
| `seg_especial` | Condiciones especiales autorizadas |

## Productos

Estas categorias se asignan a productos en Dolibarr.

### Canal recomendado

Sirven para que Visualet sepa a que tipo de cliente conviene mostrar o priorizar un producto.

Un producto puede pertenecer a varias categorias.

| Codigo Dolibarr | Nombre visible |
| --- | --- |
| `ch_abarrotes` | Abarrotes |
| `ch_farmacias` | Farmacias |
| `ch_clinicas_consultorios` | Clinicas y consultorios |
| `ch_esteticas_spas` | Esteticas y spas |
| `ch_naturistas` | Naturistas |

### Linea de producto

Sirven para ordenar el catalogo.

| Codigo Dolibarr | Nombre visible |
| --- | --- |
| `line_medicamentos` | Medicamentos |
| `line_belleza_cuidado` | Belleza y cuidado |
| `line_vitaminas_suplementos` | Vitaminas y suplementos |
| `line_higiene_personal` | Higiene personal |
| `line_material_curacion` | Material de curacion |
| `line_naturista` | Naturista |
| `line_bebes` | Bebes |
| `line_temporada` | Temporada |

### Visibilidad

Sirven para controlar que productos ve cada tipo de usuario.

| Codigo Dolibarr | Uso |
| --- | --- |
| `vis_publico` | Visible para clientes y prospectos |
| `vis_oculto_cliente` | No visible para cliente publico |
| `vis_solo_vendedor` | Solo visible para vendedores |
| `vis_requiere_autorizacion` | Requiere autorizacion antes de vender o mostrar condiciones |

### Etiquetas comerciales

Sirven para destacar productos en Visualet.

| Codigo Dolibarr | Uso |
| --- | --- |
| `tag_alta_rotacion` | Producto de alta rotacion |
| `tag_nuevo` | Producto nuevo |
| `tag_promocion` | Producto en promocion |
| `tag_recomendado` | Producto recomendado |
| `tag_pocas_piezas` | Producto con pocas piezas |
| `tag_sobre_pedido` | Producto sobre pedido |

## Categorias obligatorias para iniciar

Para empezar sin complicar demasiado Dolibarr, estas son las primeras categorias que deben crearse y usarse.

### Clientes / terceros

```text
ch_abarrotes
ch_farmacias
ch_clinicas_consultorios
ch_esteticas_spas
ch_naturistas
risk_normal
risk_mala_paga
pay_contado
pay_credito_autorizado
```

### Productos

```text
ch_abarrotes
ch_farmacias
ch_clinicas_consultorios
ch_esteticas_spas
ch_naturistas
line_medicamentos
line_belleza_cuidado
line_vitaminas_suplementos
line_higiene_personal
vis_publico
vis_solo_vendedor
```

## Regla de interpretacion en Visualet

- Si un producto no tiene categoria todavia, aparece en `Todos`.
- Si un producto tiene una o varias categorias `ch_`, Visualet lo puede mostrar o priorizar segun el canal del cliente.
- Si un cliente no tiene categoria `ch_`, Visualet lo trata como publico general hasta que se clasifique.
- Si un producto tiene `vis_solo_vendedor`, no debe aparecer en el catalogo publico.
- Si un cliente tiene `risk_mala_paga`, Visualet debe aplicar reglas comerciales especiales antes de permitir credito o condiciones preferentes.
