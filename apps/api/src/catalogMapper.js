function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBooleanFromFlag(value) {
  return String(value) === "1";
}

function normalizeKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCustomerAvailability(stockReal) {
  if (stockReal <= 0) return "No disponible";
  if (stockReal <= 10) return "Pocas piezas";
  return "Disponible";
}

function getVisibility(categories) {
  const normalizedCategories = categories.map((category) => normalizeKey(category));

  if (
    normalizedCategories.includes("vis_no_mostrar_cliente") ||
    normalizedCategories.includes("vis_oculto_cliente") ||
    normalizedCategories.includes("oculto_al_cliente")
  ) {
    return "hidden_customer";
  }

  if (
    normalizedCategories.includes("vis_solo_vendedor") ||
    normalizedCategories.includes("solo_vendedor")
  ) {
    return "seller_only";
  }

  if (
    normalizedCategories.includes("vis_requiere_autorizacion") ||
    normalizedCategories.includes("requiere_autorizacion")
  ) {
    return "requires_authorization";
  }

  return "public";
}

function getCategories(product) {
  const rawCategories =
    product.categories ??
    product.categories_list ??
    product.categorie ??
    product.category ??
    [];

  if (Array.isArray(rawCategories)) {
    return rawCategories
      .map((category) => {
        if (typeof category === "string") return category;
        return category?.label ?? category?.ref ?? category?.code ?? category?.id;
      })
      .filter(Boolean)
      .map(String);
  }

  return [];
}

export function normalizeDolibarrProduct(product, syncedAt, assignedCategories = []) {
  const stockReal = toNumber(product.stock_reel);
  const categories = [...new Set([...getCategories(product), ...assignedCategories])];
  const name = product.label || product.ref || `Producto ${product.id}`;
  const description = product.description || name;

  return {
    dolibarrProductId: String(product.id),
    sku: String(product.ref ?? ""),
    name: String(name),
    description: String(description),
    priceBase: toNumber(product.price),
    priceWithTax: toNumber(product.price_ttc, toNumber(product.price)),
    priceShown: toNumber(product.price),
    stockReal,
    customerAvailability: getCustomerAvailability(stockReal),
    sellerAvailability: `${stockReal} piezas`,
    isActive: toBooleanFromFlag(product.status),
    isProduct: String(product.type) === "0",
    canBuy: toBooleanFromFlag(product.status_buy),
    isStockable: toBooleanFromFlag(product.stockable_product),
    barcode: product.barcode ? String(product.barcode) : null,
    categories,
    visibility: getVisibility(categories),
    lastSyncedAt: syncedAt,
  };
}

export function isCatalogProduct(product) {
  return product.isActive && product.isProduct;
}

export function toAudienceProduct(product, audience) {
  const base = {
    dolibarrProductId: product.dolibarrProductId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    priceShown: product.priceShown,
    categories: product.categories,
    availability:
      audience === "seller"
        ? product.sellerAvailability
        : product.customerAvailability,
    imageUrl: `/catalog/products/${product.dolibarrProductId}/image?v=${encodeURIComponent(product.lastSyncedAt)}`,
    lastSyncedAt: product.lastSyncedAt,
  };

  if (audience === "seller") {
    return {
      ...base,
      stockReal: product.stockReal,
      visibility: product.visibility,
    };
  }

  return base;
}
