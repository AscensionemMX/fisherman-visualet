import {
  listDolibarrCategories,
  listDolibarrCategoryProducts,
  listDolibarrProducts,
} from "./dolibarrClient.js";
import {
  isCatalogProduct,
  normalizeDolibarrProduct,
  toAudienceProduct,
} from "./catalogMapper.js";

const catalogCache = {
  products: [],
  syncedAt: null,
  expiresAt: 0,
  refreshPromise: null,
};

const DOLIBARR_PAGE_SIZE = 500;
const DOLIBARR_MAX_PAGES = 10;
const CATEGORY_LOAD_TIMEOUT_MS = 20000;
const CATEGORY_LOAD_CONCURRENCY = 4;

function buildCategoryPath(category, categoriesById) {
  const labels = [];
  let current = category;
  const seen = new Set();

  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    labels.unshift(String(current.label ?? current.ref ?? current.id));

    const parentId = String(current.fk_parent ?? "0");

    if (parentId === "0") break;

    current = categoriesById.get(parentId);
  }

  return labels.join(" > ");
}

async function getProductCategoryMap(config) {
  const categories = await listDolibarrCategories(config, {
    limit: 1000,
    type: "product",
  });
  const categoriesById = new Map(
    categories.map((category) => [String(category.id), category]),
  );
  const productCategories = new Map();

  for (let index = 0; index < categories.length; index += CATEGORY_LOAD_CONCURRENCY) {
    const batch = categories.slice(index, index + CATEGORY_LOAD_CONCURRENCY);

    await Promise.all(
      batch.map(async (category) => {
      const categoryId = String(category.id);
      const categoryPath = buildCategoryPath(category, categoriesById);
      const categoryProducts = await listDolibarrCategoryProducts(config, categoryId, {
        limit: 5000,
      });

      for (const product of categoryProducts) {
        const productId = String(product.id);
        const currentCategories = productCategories.get(productId) ?? [];

        currentCategories.push(categoryPath);
        productCategories.set(productId, currentCategories);
      }
      }),
    );
  }

  return productCategories;
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  let timeoutId;

  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function refreshCatalog(config) {
  const syncedAt = new Date().toISOString();
  const dolibarrProducts = [];

  for (let page = 0; page < DOLIBARR_MAX_PAGES; page += 1) {
    const pageProducts = await listDolibarrProducts(config, {
      page,
      limit: DOLIBARR_PAGE_SIZE,
    });

    dolibarrProducts.push(...pageProducts);

    if (pageProducts.length < DOLIBARR_PAGE_SIZE) {
      break;
    }
  }

  const productCategoryMap = await withTimeout(
    getProductCategoryMap(config).catch((error) => {
      console.warn(
        "Unable to load Dolibarr categories:",
        error instanceof Error ? error.message : error,
      );

      return new Map();
    }),
    CATEGORY_LOAD_TIMEOUT_MS,
    new Map(),
  );

  catalogCache.products = dolibarrProducts
    .map((product) =>
      normalizeDolibarrProduct(
        product,
        syncedAt,
        productCategoryMap.get(String(product.id)) ?? [],
      ),
    )
    .filter(isCatalogProduct)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  catalogCache.syncedAt = syncedAt;
  catalogCache.expiresAt = Date.now() + config.catalogCacheTtlMs;
}

async function getFastProductPage(config, page, limit) {
  const syncedAt = new Date().toISOString();
  const dolibarrProducts = await listDolibarrProducts(config, {
    page,
    limit,
  });

  return {
    products: dolibarrProducts
      .map((product) => normalizeDolibarrProduct(product, syncedAt, []))
      .filter(isCatalogProduct)
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    syncedAt,
    hasMore: dolibarrProducts.length >= limit,
  };
}

function refreshCatalogInBackground(config) {
  if (catalogCache.refreshPromise) {
    return catalogCache.refreshPromise;
  }

  catalogCache.refreshPromise = refreshCatalog(config)
    .catch((error) => {
      console.warn(
        "Unable to refresh catalog:",
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      catalogCache.refreshPromise = null;
    });

  return catalogCache.refreshPromise;
}

function shouldUseCache(now) {
  return catalogCache.products.length > 0 && catalogCache.expiresAt > now;
}

export async function getCatalogProducts(config, options = {}) {
  const now = Date.now();
  const audience = options.audience === "seller" ? "seller" : "customer";
  const page = Math.max(0, Number.parseInt(options.page ?? "0", 10) || 0);
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(options.limit ?? "100", 10) || 100),
  );
  let source = "dolibarr";

  if (!shouldUseCache(now)) {
    if (catalogCache.products.length > 0) {
      source = "cache";
      refreshCatalogInBackground(config);
    } else {
      try {
        const fastPage = await getFastProductPage(config, page, limit);

        refreshCatalogInBackground(config);

        return {
          items: fastPage.products.map((product) => toAudienceProduct(product, audience)),
          source: "dolibarr-fast",
          lastSyncedAt: fastPage.syncedAt,
          pagination: {
            page,
            limit,
            total: null,
            hasMore: fastPage.hasMore,
          },
        };
      } catch (error) {
        if (catalogCache.products.length === 0) {
          throw error;
        }

        source = "cache";
      }
    }
  } else {
    source = "cache";
  }

  const visibleProducts = catalogCache.products.filter((product) => {
    if (audience === "seller") return true;
    return product.visibility !== "hidden_customer" && product.visibility !== "seller_only";
  });
  const start = page * limit;
  const paginatedProducts = visibleProducts.slice(start, start + limit);

  return {
    items: paginatedProducts.map((product) => toAudienceProduct(product, audience)),
    source,
    lastSyncedAt: catalogCache.syncedAt,
    pagination: {
      page,
      limit,
      total: visibleProducts.length,
      hasMore: start + limit < visibleProducts.length,
    },
  };
}
