# Fisherman Website

Website publica de Fisherman Distribucion y prototipo inicial del catalogo Visualet.

## Stack

- Astro.
- TypeScript.
- React.
- Tailwind CSS.
- GSAP.
- Motion.

## Requisitos

- Node.js `>=22.12.0`
- npm

## Comandos

```sh
npm install
npm run dev
npm run build
npm run preview
```

## Estructura

```text
.
|-- public/
|   |-- fisherman-logo-original.png
|   |-- favicon.ico
|   `-- favicon.svg
|-- src/
|   |-- components/
|   |-- data/
|   |   `-- products.ts
|   |-- layouts/
|   |-- pages/
|   |   |-- index.astro
|   |   `-- catalog.astro
|   |-- scripts/
|   |   `-- catalogPage.ts
|   |-- styles/
|   `-- types/
|       `-- visualet.ts
|-- astro.config.mjs
|-- package.json
`-- tsconfig.json
```

## Rutas

- `/`: landing publica.
- `/catalog`: catalogo basico con carrito y envio por WhatsApp.

## Estado actual

- El sitio compila como proyecto estatico.
- El catalogo intenta leer `PUBLIC_VISUALET_API_URL/catalog/products`.
- Si la API no responde, usa datos locales en `src/data/products.ts`.
- La logica del catalogo vive en `src/scripts/catalogPage.ts`.
- Los tipos base de Visualet viven en `src/types/visualet.ts`.
- Las solicitudes se envian por WhatsApp.
- La conexion a Dolibarr ocurre mediante Visualet API.

## Regla de producto

Visualet fase 1 es solo lectura frente a Dolibarr. No debe crear pedidos oficiales, modificar inventario, cambiar precios, crear facturas ni registrar pagos.

## Variables De Entorno

```text
PUBLIC_VISUALET_API_URL=http://localhost:8787
```

## Proximo paso tecnico

Crear el almacenamiento offline para prospectos y pre-pedidos:

```text
src/lib/offlineStore.ts
```

Despues se puede reemplazar `src/data/products.ts` por datos cacheados desde Visualet Backend y Dolibarr API.
