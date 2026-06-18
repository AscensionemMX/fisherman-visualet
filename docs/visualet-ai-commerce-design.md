# Visualet AI Commerce Design

Version: 0.1
Estado: Diseno inicial
Sistema fuente: Dolibarr

## Decision Principal

Visualet debe tener una capa de inteligencia comercial.

La IA debe ayudar a vender mejor, recomendar condiciones, resumir riesgos y atender conversaciones, pero no debe reemplazar las reglas de negocio ni la autorizacion de direccion.

Regla:

```text
La IA recomienda.
El motor de reglas limita.
Dolibarr registra.
Direccion autoriza excepciones.
```

## Arquitectura Conceptual

```text
Dolibarr API
-> Visualet Backend
   -> Catalog Service
   -> Customer Service
   -> Pricing Rules Service
   -> Risk Rules Service
   -> Recommendation Service
   -> AI Assistant Service
   -> WhatsApp Bot Service
-> Visualet Web
-> Visualet Seller Tablet
-> WhatsApp
```

## Responsabilidades

### Dolibarr

Dolibarr guarda la verdad operativa:

- Productos.
- Precio base.
- Stock.
- Clientes.
- Categorias.
- Pedidos.
- Proformas.
- Pagos.
- Cartera.
- Historial.

### Visualet Backend

Visualet Backend interpreta y presenta la informacion:

- Cachea catalogo.
- Calcula visibilidad por segmento.
- Calcula disponibilidad comercial.
- Aplica reglas de precio.
- Aplica reglas de riesgo.
- Conecta WhatsApp.
- Conecta IA.
- Sincroniza con Dolibarr.

### IA

La IA ayuda a:

- Recomendar productos.
- Sugerir sustitutos.
- Resumir historial de cliente.
- Detectar riesgo.
- Sugerir condiciones comerciales.
- Redactar mensajes para WhatsApp.
- Ayudar al vendedor a preparar visita.
- Contestar preguntas de catalogo.

La IA no debe:

- Autorizar credito fuera de reglas.
- Cambiar precio sin limite.
- Crear pedidos oficiales sin validacion.
- Confirmar stock final si no esta validado.
- Diagnosticar.
- Recetar.
- Dar instrucciones medicas.

## Problema Comercial: Cliente De Riesgo

En el mercado real puede convenir vender a clientes de pago riesgoso si el precio, plazo y limite compensan el riesgo.

Por eso Visualet no debe tratar "mala paga" solamente como bloqueo.

Debe tratarlo como riesgo comercial:

```text
Cliente riesgoso
-> precio ajustado
-> limite menor
-> plazo corto
-> anticipo
-> contado obligatorio en casos criticos
-> autorizacion de direccion si excede limites
```

## Motor De Riesgo

El motor de riesgo debe evaluar:

- Historial de pago.
- Dias promedio de atraso.
- Saldo actual.
- Cartera vencida.
- Monto del nuevo pedido.
- Margen esperado.
- Segmento del cliente.
- Zona.
- Frecuencia de compra.
- Incidencias.
- Categoria del cliente en Dolibarr.

Salida recomendada:

```text
riesgo_bajo
riesgo_medio
riesgo_alto
riesgo_critico
```

Ejemplo de reglas:

```text
riesgo_bajo:
  precio normal
  credito permitido segun limite

riesgo_medio:
  credito limitado
  plazo corto
  posible ajuste de precio

riesgo_alto:
  anticipo
  limite bajo
  precio ajustado por riesgo
  revision de direccion si excede monto

riesgo_critico:
  contado obligatorio
  sin credito
  requiere direccion para excepciones
```

## Motor De Precio

Dolibarr guarda el precio base.

Visualet puede calcular el precio mostrado segun:

- Segmento del cliente.
- Riesgo del cliente.
- Categoria del producto.
- Margen del producto.
- Cantidad.
- Historial.
- Promociones permitidas.
- Politica comercial.

Regla:

```text
El precio base sale de Dolibarr.
El precio mostrado por Visualet se calcula con reglas documentadas.
```

Ejemplo conceptual:

```text
precio_base = Dolibarr.price
ajuste_segmento = regla por tipo de cliente
ajuste_riesgo = regla por riesgo
ajuste_producto = regla por categoria/margen
precio_visualet = precio_base + ajustes
```

La IA puede sugerir un ajuste, pero el motor de reglas debe validar que este dentro de limites.

## Segmentos

Segmentos de cliente recomendados en Dolibarr como categorias de tercero:

```text
cliente_prospecto
cliente_farmacia
cliente_clinica
cliente_spa
cliente_cosmetica
cliente_abarrotes
cliente_super_mayoreo
cliente_contado
cliente_credito_autorizado
cliente_solo_contado
cliente_mala_paga
cliente_credito_bloqueado
cliente_revision_direccion
```

Categorias de producto recomendadas en Dolibarr:

```text
producto_farmacia
producto_clinica
producto_spa
producto_cosmetica
producto_abarrotes
producto_mayoreo
producto_alta_rotacion
producto_vitaminas
producto_belleza
producto_higiene
producto_temporada
producto_no_mostrar_cliente
```

## Catalogo Por Segmento

Visualet debe mostrar catalogo relevante segun el tipo de cliente.

Ejemplos:

```text
Farmacia:
  medicamentos
  alta rotacion
  vitaminas
  cuidado personal

Spa / cosmetica:
  belleza
  dermocosmetica
  higiene
  bienestar

Clinica:
  medicamentos
  material recurrente
  productos de consumo

Abarrotes:
  higiene
  cuidado personal
  alta rotacion

Super mayoreo:
  productos por volumen
  alta rotacion
  margen fuerte
```

Regla:

```text
El cliente ve primero lo relevante.
El vendedor puede buscar todo.
```

## Disponibilidad

### Vendedor

El vendedor ve stock numerico real:

```text
0 piezas
10 piezas
25 piezas
```

### Cliente / Prospecto

El cliente ve disponibilidad por rango:

```text
0 piezas      -> No disponible
1 a 10 piezas -> Pocas piezas
11+ piezas    -> Disponible
```

Regla:

```text
Visualet cliente no muestra inventario exacto.
Visualet vendedor si muestra inventario exacto.
```

## WhatsApp Bot

El bot de WhatsApp debe conectarse a Visualet Backend, no directamente a Dolibarr.

Flujo:

```text
Cliente escribe por WhatsApp
-> bot identifica telefono
-> consulta Visualet Backend
-> Visualet consulta cache/Dolibarr
-> bot muestra catalogo relevante
-> bot arma carrito conversacional
-> bot aplica reglas de precio, riesgo y disponibilidad
-> bot genera solicitud o escala a vendedor/direccion
```

El bot puede decir:

```text
Tengo disponible.
Hay pocas piezas.
No disponible.
Puedo sugerirte alternativa.
Tu solicitud queda sujeta a confirmacion.
Te paso con un vendedor.
```

El bot no debe decir:

```text
Te recomiendo tomar este medicamento para...
Ese producto cura...
Ya tienes credito aprobado.
Precio final garantizado si no esta validado.
Stock garantizado si no esta validado.
```

## IA Para Vendedores

La IA debe apoyar al vendedor con:

- Resumen del cliente antes de visita.
- Productos recomendados.
- Sustitutos.
- Riesgo de cobranza.
- Condicion sugerida.
- Mensaje de seguimiento.
- Oportunidades de recompra.

Ejemplo:

```text
Cliente: Farmacia San Jose
Segmento: farmacia
Riesgo: medio
Historial: paga 8 dias tarde promedio
Sugerencia: ofrecer contado con incentivo o credito corto
Productos sugeridos: alta rotacion y vitaminas
```

## IA Para Direccion

La IA puede ayudar a direccion con:

- Clientes en riesgo.
- Pedidos que conviene aprobar.
- Pedidos que conviene detener.
- Margen por cliente.
- Productos lentos.
- Productos con alta rotacion.
- Recomendaciones de precio por riesgo.
- Alertas de cartera.

## Limites De Autorizacion

La IA puede sugerir.

El sistema puede aplicar reglas dentro de limites aprobados.

Direccion debe aprobar:

- Credito alto.
- Excepciones de clientes de alto riesgo.
- Ajustes fuera de rango.
- Pedidos grandes de clientes nuevos.
- Clientes bloqueados.
- Cambios de politica comercial.

## Estados Comerciales

```text
cliente_sano
cliente_pago_lento
cliente_mala_paga
cliente_credito_bloqueado
cliente_solo_contado
cliente_revision_direccion
```

## Ejemplo De Decision Comercial

Entrada:

```text
Cliente: Abarrotes Lopez
Segmento: abarrotes
Historial: pagos tarde
Pedido: 1800
Stock: disponible
Margen: medio
```

Salida:

```text
Riesgo: alto
Condicion sugerida: anticipo 50% o contado
Precio sugerido: precio base + ajuste de riesgo
Requiere direccion: si excede limite definido
```

## Reglas No Negociables

```text
Dolibarr sigue siendo la fuente oficial.
La IA no inventa productos.
La IA no inventa stock.
La IA no inventa historial.
La IA no autoriza credito fuera de reglas.
La IA no da consejo medico.
La IA no receta.
El bot debe escalar a humano cuando haya duda, riesgo o excepcion.
```

## Siguiente Paso De Diseno

Definir el archivo de reglas comerciales inicial:

```text
Website/FDcore/docs/visualet-commercial-rules-v1.md
```

Ese documento debe incluir:

- Segmentos.
- Rangos de riesgo.
- Reglas de precio.
- Reglas de stock visible.
- Reglas de credito.
- Reglas de escalamiento a direccion.
