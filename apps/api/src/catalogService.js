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
};

const DOLIBARR_PAGE_SIZE = 500;
const DOLIBARR_MAX_PAGES = 10;

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

  await Promise.all(
    categories.map(async (category) => {
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

  return productCategories;
}

function shouldUseCache(now) {
  return catalogCache.products.length > 0 && catalogCache.expiresAt > now;
}

export async function getCatalogProducts(config, options = {}) {
  const now = Date.now();
  const audience = options.audience === "seller" ? "seller" : "customer";
  let source = "dolibarr";

  if (!shouldUseCache(now)) {
    try {
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

      const productCategoryMap = await getProductCategoryMap(config);

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
      catalogCache.expiresAt = now + config.catalogCacheTtlMs;
    } catch (error) {
      if (catalogCache.products.length === 0) {
        throw error;
      }

      source = "cache";
    }
  } else {
    source = "cache";
  }

  const visibleProducts = catalogCache.products.filter((product) => {
    if (audience === "seller") return true;
    return product.visibility !== "hidden_customer" && product.visibility !== "seller_only";
  });

  return {
    items: visibleProducts.map((product) => toAudienceProduct(product, audience)),
    source,
    lastSyncedAt: catalogCache.syncedAt,
    pagination: {
      page: Number.parseInt(options.page ?? "0", 10),
      limit: Number.parseInt(options.limit ?? "100", 10),
      hasMore: visibleProducts.length >= Number.parseInt(options.limit ?? "100", 10),
    },
  };
}
