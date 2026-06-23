import { catalogProducts } from "../data/products";
import type {
  CartItem,
  CatalogCategory,
  CatalogProduct,
  CoverageResolveResponse,
  CustomerResolveResponse,
  RouteResolveResponse,
} from "../types/visualet";

type ApiCatalogProduct = {
  productId: string;
  sku: string;
  name: string;
  description: string;
  priceShown: number;
  priceIncludesTax?: boolean;
  availability: string;
  imageUrl?: string;
  categories?: string[];
  lastSyncedAt: string;
};

type ApiCatalogResponse = {
  items: ApiCatalogProduct[];
  source?:
    | "catalog"
    | "catalog-full"
    | "catalog-fast"
    | "cache"
    | "category"
    | "cache-category"
    | "category-unavailable";
  lastSyncedAt?: string;
  pagination?: {
    page: number;
    limit: number;
    total?: number | null;
    hasMore: boolean;
  };
};

type CachedCatalogResponse = ApiCatalogResponse & {
  cachedAt?: string;
};

type ApiCatalogFiltersResponse = {
  items: string[];
  lastSyncedAt?: string;
  warming?: boolean;
};

const fallbackProducts = catalogProducts;
const MAX_RENDERED_PRODUCTS = 50;
const CATALOG_PAGE_SIZE = 50;
const FULL_CATALOG_PAGE_SIZE = 500;
const PRODUCTION_VISUALET_API_URL = "https://navajowhite-sardine-989084.hostingersite.com";
const CATALOG_STORAGE_KEY = "fisherman.catalog.products.v2";
const LOCATION_STORAGE_KEY = "fisherman.customer.location.v1";
const CUSTOMER_KEY_STORAGE_KEY = "fisherman.customer.key.v1";
const ESSENTIAL_FILTER_CATEGORIES = ["Promociones"];
const PROMOTIONS_CATEGORY = "Promociones";

function getVisualetApiUrl() {
  if (import.meta.env.PUBLIC_VISUALET_API_URL) {
    return import.meta.env.PUBLIC_VISUALET_API_URL;
  }

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:8787";
  }

  return PRODUCTION_VISUALET_API_URL;
}

const visualetApiUrl = getVisualetApiUrl();
const localPriorityVisualetApiUrl = "http://localhost:8788";
const fallbackVisualetApiUrl =
  visualetApiUrl === "http://localhost:8787"
    ? localPriorityVisualetApiUrl
    : visualetApiUrl === localPriorityVisualetApiUrl
      ? PRODUCTION_VISUALET_API_URL
      : "";

function getRequiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing catalog element: ${selector}`);
  }

  return element;
}

function getOptionalElement<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactRepeatedLetters(value: string) {
  return value.replace(/([a-z])\1+/g, "$1");
}

function getMaxFuzzyDistance(length: number) {
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

function levenshteinDistance(a: string, b: string, maxDistance: number) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );

      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) return maxDistance + 1;

    previous = current;
  }

  return previous[b.length];
}

function tokenMatches(searchToken: string, candidateToken: string) {
  if (searchToken === candidateToken) return true;

  const minLength = Math.min(searchToken.length, candidateToken.length);

  if (
    minLength >= 3 &&
    (candidateToken.includes(searchToken) || searchToken.includes(candidateToken))
  ) {
    return true;
  }

  const compactSearch = compactRepeatedLetters(searchToken);
  const compactCandidate = compactRepeatedLetters(candidateToken);

  if (
    Math.min(compactSearch.length, compactCandidate.length) >= 3 &&
    (compactCandidate.includes(compactSearch) ||
      compactSearch.includes(compactCandidate))
  ) {
    return true;
  }

  const maxDistance = getMaxFuzzyDistance(Math.max(compactSearch.length, compactCandidate.length));

  return levenshteinDistance(compactSearch, compactCandidate, maxDistance) <= maxDistance;
}

function fuzzyIncludes(search: string, candidate: string) {
  const normalizedSearch = normalizeText(search);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedSearch) return true;
  if (!normalizedCandidate) return false;
  if (
    normalizedCandidate.includes(normalizedSearch) ||
    compactRepeatedLetters(normalizedCandidate).includes(
      compactRepeatedLetters(normalizedSearch),
    )
  ) {
    return true;
  }

  const searchTokens = normalizedSearch.split(" ").filter((token) => token.length >= 2);
  const candidateTokens = normalizedCandidate.split(" ").filter((token) => token.length >= 2);

  if (searchTokens.length === 0) return true;

  return searchTokens.every((searchToken) =>
    candidateTokens.some((candidateToken) => tokenMatches(searchToken, candidateToken)),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveApiUrl(path?: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${visualetApiUrl}${path}`;
  return `${visualetApiUrl}/${path}`;
}

function getPrimaryTag(product: Pick<CatalogProduct, "categories" | "tag">) {
  return product.categories?.[0] ?? product.tag;
}

function isFilterCategory(category: string) {
  const normalized = normalizeText(category);

  if (!category.trim()) return false;
  if (category.includes(">")) return false;
  if (normalized.includes("componente activo")) return false;
  if (normalized.includes("sustancia activa")) return false;
  if (normalized.includes("sal activa")) return false;

  return true;
}

function getCategoryBadgeClasses(category: string) {
  return normalizeText(category) === "promociones"
    ? "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"
    : "inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[#0F4C5C]";
}

function initCatalogPage() {
  const searchInput = getRequiredElement<HTMLInputElement>("#catalog-search");
  const categorySelect = getRequiredElement<HTMLSelectElement>("#catalog-category");
  const categoryButtonsContainer = getRequiredElement<HTMLDivElement>("#catalog-category-buttons");
  const grid = getRequiredElement<HTMLDivElement>("#catalog-grid");
  const loadMoreButton = getRequiredElement<HTMLButtonElement>("#catalog-load-more");
  const catalogSource = getRequiredElement<HTMLParagraphElement>("#catalog-source");
  const catalogCount = getRequiredElement<HTMLParagraphElement>("#catalog-count");
  const emptyState = getRequiredElement<HTMLDivElement>("#catalog-empty");
  const promotionsPanel = getRequiredElement<HTMLElement>("#promotions-panel");
  const promotionsStatus = getRequiredElement<HTMLParagraphElement>("#promotions-status");
  const promotionsList = getRequiredElement<HTMLDivElement>("#promotions-list");
  const viewPromotionsButton = getRequiredElement<HTMLButtonElement>("#view-promotions");
  const cartList = getRequiredElement<HTMLDivElement>("#cart-list");
  const cartEmpty = getRequiredElement<HTMLDivElement>("#cart-empty");
  const cartSummary = getRequiredElement<HTMLParagraphElement>("#cart-summary");
  const cartTotal = getRequiredElement<HTMLParagraphElement>("#cart-total");
  const mobileCartSummary = getOptionalElement<HTMLParagraphElement>("#mobile-cart-summary");
  const mobileCartTotal = getOptionalElement<HTMLParagraphElement>("#mobile-cart-total");
  const cartProgressLabel = getRequiredElement<HTMLParagraphElement>("#cart-progress-label");
  const cartProgressPercent = getRequiredElement<HTMLParagraphElement>("#cart-progress-percent");
  const cartProgressBar = getRequiredElement<HTMLDivElement>("#cart-progress-bar");
  const cartProgressHint = getRequiredElement<HTMLParagraphElement>("#cart-progress-hint");
  const sendOrder = getRequiredElement<HTMLAnchorElement>("#send-order");
  const mobileSendOrder = getOptionalElement<HTMLAnchorElement>("#mobile-send-order");
  const clearCart = getRequiredElement<HTMLButtonElement>("#clear-cart");
  const recommendationsPanel = getRequiredElement<HTMLDivElement>("#recommendations-panel");
  const recommendationsList = getRequiredElement<HTMLDivElement>("#recommendations-list");
  const toast = getRequiredElement<HTMLDivElement>("#catalog-toast");
  const toastTitle = getRequiredElement<HTMLParagraphElement>("#catalog-toast-title");
  const toastMessage = getRequiredElement<HTMLParagraphElement>("#catalog-toast-message");
  const imageModal = getRequiredElement<HTMLDivElement>("#product-image-modal");
  const imagePreview = getRequiredElement<HTMLImageElement>("#product-image-preview");
  const imageTitle = getRequiredElement<HTMLHeadingElement>("#product-image-title");
  const closeImageModalButton = getRequiredElement<HTMLButtonElement>("#product-image-close");
  const zoomInButton = getRequiredElement<HTMLButtonElement>("#product-image-zoom-in");
  const zoomOutButton = getRequiredElement<HTMLButtonElement>("#product-image-zoom-out");
  const bootScreen = getOptionalElement<HTMLDivElement>("#catalog-boot-screen");
  const bootStatus = getOptionalElement<HTMLParagraphElement>("#catalog-boot-status");
  const bootProgressBar = getOptionalElement<HTMLDivElement>("#catalog-boot-progress-bar");
  const bootProgressLabel = getOptionalElement<HTMLParagraphElement>("#catalog-boot-progress-label");
  const bootCheckpointPromotions = getOptionalElement<HTMLDivElement>("#boot-checkpoint-promotions");
  const bootCheckpointCategories = getOptionalElement<HTMLDivElement>("#boot-checkpoint-categories");
  const bootCheckpointProducts = getOptionalElement<HTMLDivElement>("#boot-checkpoint-products");
  const bootCheckpointCoverage = getOptionalElement<HTMLDivElement>("#boot-checkpoint-coverage");
  const bootGameTarget = getOptionalElement<HTMLButtonElement>("#catalog-boot-target");
  const bootGameScore = getOptionalElement<HTMLParagraphElement>("#catalog-boot-score");
  const bootWaitButton = getOptionalElement<HTMLButtonElement>("#catalog-boot-wait");
  const bootSkipButton = getOptionalElement<HTMLButtonElement>("#catalog-boot-skip");
  const customerLocationInput = getRequiredElement<HTMLInputElement>("#customer-location");
  const resolveCoverageButton = getRequiredElement<HTMLButtonElement>("#resolve-coverage");
  const customerKeyInput = getRequiredElement<HTMLInputElement>("#customer-key");
  const resolveCustomerButton = getRequiredElement<HTMLButtonElement>("#resolve-customer");
  const clearCustomerButton = getRequiredElement<HTMLButtonElement>("#clear-customer");
  const customerMessage = getRequiredElement<HTMLParagraphElement>("#customer-message");
  const routeStatusPill = getRequiredElement<HTMLSpanElement>("#route-status-pill");
  const routeMessageTitle = getRequiredElement<HTMLParagraphElement>("#route-message-title");
  const routeMessageSummary = getRequiredElement<HTMLParagraphElement>("#route-message-summary");
  const routeMessageDetail = getRequiredElement<HTMLParagraphElement>("#route-message-detail");

  let selectedCategory: CatalogCategory = "todos";
  let products: CatalogProduct[] = fallbackProducts;
  let cart: CartItem[] = [];
  let imageZoom = 1;
  let toastTimeout: number | undefined;
  let nextCatalogPage = 0;
  let hasMoreCatalogProducts = false;
  let isLoadingCatalogProducts = false;
  let catalogTotal: number | undefined;
  let fastCatalogRetryCount = 0;
  let searchDebounceTimeout: number | undefined;
  let activeServerSearch = "";
  let activeServerCategory = "todos";
  let globalFilterCategories: string[] = [];
  let filterRetryTimeout: number | undefined;
  let bootScreenTimer: number | undefined;
  let bootScreenDismissed = false;
  let routeInfo: RouteResolveResponse | null = null;
  let customerInfo: CustomerResolveResponse | null = null;
  let coverageInfo: CoverageResolveResponse | null = null;
  let catalogRequestId = 0;
  let promotionProducts: CatalogProduct[] = [];
  let initialFullCatalogLoaded = false;
  let bootGameScoreValue = 0;
  let bootGameTimer: number | undefined;

  function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  }

  function mapApiProduct(product: ApiCatalogProduct): CatalogProduct {
    return {
      id: product.productId,
      productId: product.productId,
      name: product.name,
      category: product.categories?.find(isFilterCategory) ?? "sin_categoria",
      tag: product.sku || "Fisherman",
      description: product.description || product.name,
      priceText: formatPrice(product.priceShown),
      priceValue: product.priceShown,
      priceIncludesTax: product.priceIncludesTax,
      availability: product.availability,
      imageUrl: resolveApiUrl(product.imageUrl),
      categories: product.categories ?? [],
      lastSyncedAt: product.lastSyncedAt,
    };
  }

  function updateCatalogSource(status: string) {
    catalogSource.textContent = status;
  }

  function updateBootStatus(status: string) {
    if (bootStatus) {
      bootStatus.textContent = status;
    }
  }

  function updateBootProgress(progress: number, label: string) {
    const safeProgress = Math.max(0, Math.min(100, progress));

    if (bootProgressBar) {
      bootProgressBar.style.width = `${safeProgress}%`;
    }

    if (bootProgressLabel) {
      bootProgressLabel.textContent = label;
    }
  }

  function markBootCheckpoint(
    checkpoint: HTMLDivElement | null,
    state: "idle" | "active" | "done",
  ) {
    if (!checkpoint) return;

    checkpoint.dataset.state = state;
  }

  function moveBootGameTarget() {
    if (!bootGameTarget) return;

    const x = 14 + Math.random() * 72;
    const y = 18 + Math.random() * 64;

    bootGameTarget.style.left = `${x}%`;
    bootGameTarget.style.top = `${y}%`;
  }

  function startBootGame() {
    if (!bootGameTarget || bootGameTimer) return;

    moveBootGameTarget();
    bootGameTimer = window.setInterval(moveBootGameTarget, 1150);
  }

  function stopBootGame() {
    if (!bootGameTimer) return;

    window.clearInterval(bootGameTimer);
    bootGameTimer = undefined;
  }

  function showBootScreen() {
    if (!bootScreen) return;

    bootScreenDismissed = false;
    bootScreen.classList.remove("hidden");
    bootScreen.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    bootGameScoreValue = 0;
    if (bootGameScore) {
      bootGameScore.textContent = "0 capturas";
    }
    startBootGame();
  }

  function hideBootScreen() {
    if (bootScreenTimer) {
      window.clearTimeout(bootScreenTimer);
      bootScreenTimer = undefined;
    }

    if (!bootScreen) return;

    bootScreenDismissed = true;
    bootScreen.classList.add("hidden");
    bootScreen.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    stopBootGame();
  }

  function scheduleBootScreen() {
    if (bootScreenTimer) return;

    bootScreenTimer = window.setTimeout(() => {
      bootScreenTimer = undefined;
      showBootScreen();
    }, 700);
  }

  async function fetchCatalogPage(
    apiUrl: string,
    page: number,
    search: string,
    category = activeServerCategory,
    options: { mode?: "full"; limit?: number } = {},
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      options.mode === "full" ? 45000 : category && category !== "todos" ? 18000 : 12000,
    );
    const params = new URLSearchParams({
      audience: "customer",
      page: String(page),
      limit: String(options.limit ?? CATALOG_PAGE_SIZE),
    });

    if (search) {
      params.set("q", search);
    }

    if (category && category !== "todos") {
      params.set("category", category);
    }

    if (options.mode) {
      params.set("mode", options.mode);
    }

    try {
      return await fetch(`${apiUrl}/catalog/products?${params.toString()}`, {
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchCatalogFilters(apiUrl: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${apiUrl}/catalog/filters`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Visualet filters responded with ${response.status}`);
      }

      return (await response.json()) as ApiCatalogFiltersResponse;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchCoverageResolution(apiUrl: string, location: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);
    const params = new URLSearchParams({ location });

    try {
      const response = await fetch(`${apiUrl}/coverage/resolve?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Visualet coverage responded with ${response.status}`);
      }

      return (await response.json()) as CoverageResolveResponse;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchCustomerResolution(apiUrl: string, key: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    const params = new URLSearchParams({ key });

    try {
      const response = await fetch(`${apiUrl}/customers/resolve?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Visualet customers responded with ${response.status}`);
      }

      return (await response.json()) as CustomerResolveResponse;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function getCoverageFallback(location: string): CoverageResolveResponse {
    const hasLocation = Boolean(location.trim());

    return {
      status: hasLocation ? "coverage_unknown" : "coverage_location_required",
      location,
      covered: false,
      route: null,
      calendar: null,
      messages: {
        title: hasLocation ? "Zona por validar" : "Ubicacion por confirmar",
        summary: hasLocation
          ? "Fisherman revisara si puede atender tu zona."
          : "Escribe tu municipio, colonia o localidad para revisar cobertura.",
        detail: "Puedes enviar tu solicitud; precio, stock, pago y entrega se confirman antes de cerrar.",
      },
    };
  }

  function renderRouteInfo(info: RouteResolveResponse) {
    routeInfo = info;
    routeMessageTitle.textContent = info.messages.title;
    routeMessageSummary.textContent = info.messages.summary;
    routeMessageDetail.textContent = info.messages.detail;

    if (info.status === "route_active_now") {
      routeStatusPill.textContent = "Activa";
      routeStatusPill.className =
        "rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-200";
    } else if (info.status === "route_upcoming") {
      routeStatusPill.textContent = "Próxima";
      routeStatusPill.className =
        "rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200";
    } else {
      routeStatusPill.textContent = "Por confirmar";
      routeStatusPill.className =
        "rounded-full bg-amber-300/15 px-3 py-1 text-xs font-black text-amber-200";
    }

    updateWhatsAppLink();
  }

  function renderCoverageInfo(info: CoverageResolveResponse) {
    coverageInfo = info;

    const routeStatus =
      info.status === "coverage_active_now"
        ? "route_active_now"
        : info.status === "coverage_upcoming"
          ? "route_upcoming"
          : "route_unassigned";

    renderRouteInfo({
      route: {
        id: info.route?.id ?? "zona_por_validar",
        name: info.covered ? "Zona con cobertura" : "Zona por validar",
      },
      status: routeStatus,
      calendar: info.calendar,
      messages: info.messages,
    });
  }

  function renderCustomerInfo(info: CustomerResolveResponse | null) {
    customerInfo = info;

    if (!info) {
      customerMessage.textContent =
        "Si ya eres cliente, Visualet puede revisar cobertura desde tu cuenta.";
      updateWhatsAppLink();
      return;
    }

    customerMessage.textContent = `${info.messages.summary} ${info.messages.detail}`;
    renderRouteInfo(info.route_resolution);
  }

  async function loadCoverageCalendar(location: string) {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, location);
    renderCoverageInfo({
      status: "coverage_location_required",
      location,
      covered: false,
      route: null,
      calendar: null,
      messages: {
        title: "Revisando cobertura",
        summary: "Estamos revisando si hay atencion proxima para tu zona.",
        detail: "Fisherman confirmara precio, stock, pago y entrega antes de programar.",
      },
    });

    try {
      let info: CoverageResolveResponse;

      try {
        info = await fetchCoverageResolution(visualetApiUrl, location);
      } catch (error) {
        if (!fallbackVisualetApiUrl) throw error;
        info = await fetchCoverageResolution(fallbackVisualetApiUrl, location);
      }

      renderCoverageInfo(info);
    } catch (error) {
      console.warn("Unable to resolve coverage:", error);
      renderCoverageInfo(getCoverageFallback(location));
    }
  }

  async function resolveCustomerIdentity(key: string) {
    const cleanKey = key.trim();

    window.localStorage.setItem(CUSTOMER_KEY_STORAGE_KEY, cleanKey);
    customerMessage.textContent = cleanKey
      ? "Buscando cliente en Fisherman..."
      : "Escribe tu clave, telefono o correo para revisar tu cobertura.";

    if (!cleanKey) {
      renderCustomerInfo(null);
      void loadCoverageCalendar(customerLocationInput.value);
      return;
    }

    try {
      let info: CustomerResolveResponse;

      try {
        info = await fetchCustomerResolution(visualetApiUrl, cleanKey);
      } catch (error) {
        if (!fallbackVisualetApiUrl) throw error;
        info = await fetchCustomerResolution(fallbackVisualetApiUrl, cleanKey);
      }

      renderCustomerInfo(info);

    } catch (error) {
      console.warn("Unable to resolve customer:", error);
      customerMessage.textContent =
        "No pudimos detectar tu cuenta ahora. Puedes enviar tu solicitud y Fisherman la revisara.";
      renderCustomerInfo(null);
      void loadCoverageCalendar(customerLocationInput.value);
    }
  }

  function readStoredCatalog(): CachedCatalogResponse | null {
    try {
      const rawCatalog = window.localStorage.getItem(CATALOG_STORAGE_KEY);

      if (!rawCatalog) return null;

      const parsed = JSON.parse(rawCatalog) as CachedCatalogResponse;

      if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  function storeCatalog(data: ApiCatalogResponse) {
    try {
      const currentCatalog = readStoredCatalog();
      const existingItems = currentCatalog?.items ?? [];
      const itemsById = new Map<string, ApiCatalogProduct>();

      [...existingItems, ...data.items].forEach((item) => {
        itemsById.set(item.productId, item);
      });

      window.localStorage.setItem(
        CATALOG_STORAGE_KEY,
        JSON.stringify({
          ...data,
          items: Array.from(itemsById.values()),
          cachedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // localStorage may be unavailable in private or restricted contexts.
    }
  }

  function useCatalogData(data: ApiCatalogResponse, sourceLabel: string, append = false) {
    const mappedProducts = data.items.map(mapApiProduct);

    if (append) {
      const productsById = new Map<string, CatalogProduct>();

      [...products, ...mappedProducts].forEach((product) => {
        productsById.set(product.id, product);
      });

      products = Array.from(productsById.values());
    } else {
      products = mappedProducts;
    }

    renderCategoryFilters();

    const syncedAt = data.lastSyncedAt
      ? new Date(data.lastSyncedAt).toLocaleString("es-MX")
      : "sin fecha";

    updateCatalogSource(`${sourceLabel} - actualizado ${syncedAt}`);
    catalogTotal = data.pagination?.total ?? catalogTotal;
    hasMoreCatalogProducts = Boolean(data.pagination?.hasMore);
    nextCatalogPage = (data.pagination?.page ?? nextCatalogPage) + 1;

    renderProducts();
  }

  function renderPromotions() {
    promotionsPanel.classList.toggle("hidden", promotionProducts.length === 0);

    if (promotionProducts.length === 0) {
      promotionsList.innerHTML = "";
      return;
    }

    promotionsStatus.textContent =
      promotionProducts.length === 1
        ? "1 producto en promoción listo para solicitar."
        : `${promotionProducts.length} productos en promoción listos para solicitar.`;

    promotionsList.innerHTML = promotionProducts
      .slice(0, 4)
      .map(
        (product) => `
          <article class="grid gap-3 rounded-2xl border border-amber-200 bg-white p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                Promociones
              </p>
              <h3 class="mt-1 text-sm font-black leading-snug text-slate-950 md:text-base">
                ${escapeHtml(product.name)}
              </h3>
              <p class="mt-1 text-xs font-bold text-slate-500">
                ${escapeHtml(product.priceText)}
              </p>
            </div>

            <button
              type="button"
              data-add-product="${escapeHtml(product.id)}"
              class="min-h-10 rounded-full bg-[#0F4C5C] px-4 text-sm font-black text-white transition hover:bg-[#0B3D4A]"
            >
              Agregar
            </button>
          </article>
        `,
      )
      .join("");
  }

  async function loadPriorityPromotions() {
    showBootScreen();
    markBootCheckpoint(bootCheckpointPromotions, "active");
    updateBootProgress(12, "Objetivo 1/4");
    updateBootStatus("Buscando Promociones en Fisherman...");
    promotionsStatus.textContent = "Cargando promociones...";

    try {
      let response: Response;

      try {
        response = await fetchCatalogPage(
          visualetApiUrl,
          0,
          "",
          PROMOTIONS_CATEGORY,
        );
      } catch (error) {
        if (!fallbackVisualetApiUrl) throw error;
        response = await fetchCatalogPage(
          fallbackVisualetApiUrl,
          0,
          "",
          PROMOTIONS_CATEGORY,
        );
      }

      if (!response.ok && fallbackVisualetApiUrl) {
        response = await fetchCatalogPage(
          fallbackVisualetApiUrl,
          0,
          "",
          PROMOTIONS_CATEGORY,
        );
      }

      if (!response.ok) {
        throw new Error(`Visualet promotions responded with ${response.status}`);
      }

      let data = (await response.json()) as ApiCatalogResponse;

      if (
        data.source === "category-unavailable" &&
        fallbackVisualetApiUrl &&
        fallbackVisualetApiUrl !== visualetApiUrl
      ) {
        const fallbackResponse = await fetchCatalogPage(
          fallbackVisualetApiUrl,
          0,
          "",
          PROMOTIONS_CATEGORY,
        );

        if (fallbackResponse.ok) {
          data = (await fallbackResponse.json()) as ApiCatalogResponse;
        }
      }

      promotionProducts = Array.isArray(data.items)
        ? data.items.map(mapApiProduct)
        : [];

      if (promotionProducts.length === 0) {
        promotionsStatus.textContent = "Sin promociones cargadas por ahora.";
      } else {
        updateBootStatus(`${promotionProducts.length} promocion(es) lista(s) para priorizar.`);
      }

      renderPromotions();
      if (selectedCategory === PROMOTIONS_CATEGORY) {
        products = promotionProducts;
        catalogTotal = promotionProducts.length;
        hasMoreCatalogProducts = false;
        nextCatalogPage = 1;
        renderCategoryFilters();
        renderProducts();
      }
      markBootCheckpoint(bootCheckpointPromotions, "done");
      updateBootProgress(30, "Promociones listas");
    } catch (error) {
      console.warn("Unable to load priority promotions:", error);
      promotionsStatus.textContent = "No pudimos cargar promociones ahora.";
      promotionProducts = [];
      renderPromotions();
      markBootCheckpoint(bootCheckpointPromotions, "done");
      updateBootProgress(24, "Promociones revisadas");
    }
  }

  function updateLoadMoreButton() {
    loadMoreButton.classList.toggle("hidden", !hasMoreCatalogProducts);
    loadMoreButton.disabled = isLoadingCatalogProducts;
    loadMoreButton.textContent = isLoadingCatalogProducts
      ? "Cargando..."
      : catalogTotal
        ? `Ver más productos (${products.length} de ${catalogTotal})`
        : "Ver más productos";
  }

  async function loadProductsFromApi(
    page = 0,
    append = false,
    search = activeServerSearch,
    options: { force?: boolean; mode?: "full" } = {},
  ) {
    if (isLoadingCatalogProducts && !options.force) return;

    const requestId = catalogRequestId + 1;
    catalogRequestId = requestId;
    isLoadingCatalogProducts = true;
    const requestLimit =
      options.mode === "full" ? FULL_CATALOG_PAGE_SIZE : CATALOG_PAGE_SIZE;
    updateLoadMoreButton();
    if (page === 0 && !append) {
      scheduleBootScreen();
      markBootCheckpoint(bootCheckpointProducts, "active");
      updateBootProgress(options.mode === "full" ? 56 : 42, "Cargando catálogo");
    }

    try {
      updateCatalogSource(
        page === 0 ? "Sincronizando catálogo..." : "Cargando más productos...",
      );
      updateBootStatus(
        options.mode === "full"
          ? "Cargando todos los productos desde Fisherman..."
          : "Conectando con Fisherman...",
      );

      let response: Response;

      try {
        response = await fetchCatalogPage(visualetApiUrl, page, search, activeServerCategory, {
          mode: options.mode,
          limit: requestLimit,
        });
      } catch (error) {
        updateBootStatus("Usando ruta de respaldo Fisherman...");
        if (!fallbackVisualetApiUrl) throw error;
        response = await fetchCatalogPage(fallbackVisualetApiUrl, page, search, activeServerCategory, {
          mode: options.mode,
          limit: requestLimit,
        });
      }

      if (!response.ok && fallbackVisualetApiUrl) {
        updateBootStatus("Reintentando conexión del catálogo...");
        response = await fetchCatalogPage(fallbackVisualetApiUrl, page, search, activeServerCategory, {
          mode: options.mode,
          limit: requestLimit,
        });
      }

      if (!response.ok) {
        throw new Error(`Visualet API responded with ${response.status}`);
      }

      let data = (await response.json()) as ApiCatalogResponse;

      if (
        data.source === "category-unavailable" &&
        activeServerCategory !== "todos" &&
        fallbackVisualetApiUrl &&
        fallbackVisualetApiUrl !== visualetApiUrl
      ) {
        updateCatalogSource(`Reintentando ${activeServerCategory}...`);
        const fallbackResponse = await fetchCatalogPage(
          fallbackVisualetApiUrl,
          page,
          search,
          activeServerCategory,
          { mode: options.mode, limit: requestLimit },
        );

        if (fallbackResponse.ok) {
          data = (await fallbackResponse.json()) as ApiCatalogResponse;
        }
      }

      if (
        options.mode === "full" &&
        page === 0 &&
        !append &&
        activeServerCategory === "todos"
      ) {
        const itemsById = new Map<string, ApiCatalogProduct>();
        data.items.forEach((item) => itemsById.set(item.productId, item));

        let nextPageToLoad = (data.pagination?.page ?? 0) + 1;
        const expectedTotal = data.pagination?.total ?? data.items.length;

        while (data.pagination?.hasMore && requestId === catalogRequestId) {
          const loadedCount = itemsById.size;
          const progress = expectedTotal
            ? 58 + Math.min(28, Math.round((loadedCount / expectedTotal) * 28))
            : 62;

          updateBootProgress(progress, `${loadedCount} de ${expectedTotal} productos`);
          updateBootStatus("Terminando de cargar productos, categorías y etiquetas...");

          let nextResponse: Response;

          try {
            nextResponse = await fetchCatalogPage(
              visualetApiUrl,
              nextPageToLoad,
              search,
              activeServerCategory,
              { mode: options.mode, limit: requestLimit },
            );
          } catch (error) {
            if (!fallbackVisualetApiUrl) throw error;
            nextResponse = await fetchCatalogPage(
              fallbackVisualetApiUrl,
              nextPageToLoad,
              search,
              activeServerCategory,
              { mode: options.mode, limit: requestLimit },
            );
          }

          if (!nextResponse.ok) {
            throw new Error(`Visualet API responded with ${nextResponse.status}`);
          }

          const nextData = (await nextResponse.json()) as ApiCatalogResponse;

          if (!Array.isArray(nextData.items)) {
            throw new Error("Visualet API response is missing items");
          }

          nextData.items.forEach((item) => itemsById.set(item.productId, item));

          data = {
            ...nextData,
            items: Array.from(itemsById.values()),
            source: nextData.source ?? data.source,
            lastSyncedAt: nextData.lastSyncedAt ?? data.lastSyncedAt,
            pagination: {
              page: 0,
              limit: itemsById.size,
              total: nextData.pagination?.total ?? expectedTotal,
              hasMore: Boolean(nextData.pagination?.hasMore),
            },
          };

          nextPageToLoad += 1;
        }
      }

      if (requestId !== catalogRequestId) return;

      if (!Array.isArray(data.items)) {
        throw new Error("Visualet API response is missing items");
      }

      storeCatalog(data);
      useCatalogData(data, "Datos Fisherman", append);
      if (page === 0 && !append) {
        markBootCheckpoint(bootCheckpointProducts, "done");
        updateBootProgress(88, `${data.items.length} productos cargados`);
        if (options.mode === "full") {
          updateBootStatus("Validando categorías finales...");
          await loadCatalogFilters();
          updateBootProgress(96, "Categorías finales listas");
        }
      }

      if (data.source !== "catalog-fast" || append || activeServerCategory !== "todos") {
        initialFullCatalogLoaded ||= options.mode === "full";
        updateBootProgress(100, "Catálogo listo");
        hideBootScreen();
      }

      if (data.source === "catalog-fast" && fastCatalogRetryCount < 2 && !append) {
        fastCatalogRetryCount += 1;
        updateCatalogSource("Datos Fisherman - cargando etiquetas y total...");
        updateBootStatus("Cargando etiquetas y total de productos...");

        window.setTimeout(() => {
          void loadProductsFromApi(0, false, activeServerSearch);
        }, fastCatalogRetryCount === 1 ? 8000 : 18000);
      }
    } catch (error) {
      if (requestId !== catalogRequestId) return;

      console.warn("Using local catalog fallback:", error);

      const storedCatalog = readStoredCatalog();

      if (storedCatalog) {
        useCatalogData(
          {
            ...storedCatalog,
            pagination: {
              page: 0,
              limit: storedCatalog.items.length,
              total: storedCatalog.items.length,
              hasMore: false,
            },
          },
          "Datos Fisherman guardados",
        );
        hideBootScreen();
        return;
      }

      products = fallbackProducts;
      renderCategoryFilters();
      updateCatalogSource("Catálogo local de respaldo");
      updateBootStatus("Entrando con catálogo de respaldo...");
      hasMoreCatalogProducts = false;
      renderProducts();
      hideBootScreen();
    } finally {
      if (requestId === catalogRequestId) {
        isLoadingCatalogProducts = false;
        updateLoadMoreButton();
      }
    }
  }

  function getFilterCategories() {
    const productCategories = Array.from(
      new Set(
        products.flatMap((product) => product.categories ?? []).filter(isFilterCategory),
      ),
    );

    return Array.from(
      new Set([
        ...ESSENTIAL_FILTER_CATEGORIES,
        ...globalFilterCategories,
        ...productCategories,
      ]),
    )
      .sort((a, b) => a.localeCompare(b, "es"));
  }

  async function loadCatalogFilters() {
    markBootCheckpoint(bootCheckpointCategories, "active");
    updateBootProgress(Math.max(32, bootProgressBar ? Number.parseFloat(bootProgressBar.style.width) || 32 : 32), "Leyendo categorías");
    updateBootStatus("Leyendo categorías de productos desde Fisherman...");

    try {
      let data: ApiCatalogFiltersResponse;

      try {
        data = await fetchCatalogFilters(visualetApiUrl);
      } catch (error) {
        if (!fallbackVisualetApiUrl) throw error;
        data = await fetchCatalogFilters(fallbackVisualetApiUrl);
      }

      globalFilterCategories = data.items.filter(isFilterCategory);
      renderCategoryFilters();
      markBootCheckpoint(bootCheckpointCategories, "done");
      updateBootProgress(46, "Categorías listas");

      if (data.warming && globalFilterCategories.length === 0 && !filterRetryTimeout) {
        filterRetryTimeout = window.setTimeout(() => {
          filterRetryTimeout = undefined;
          void loadCatalogFilters();
        }, 3500);
      }
    } catch (error) {
      console.warn("Unable to load catalog filters:", error);
      markBootCheckpoint(bootCheckpointCategories, "done");
    }
  }

  async function bootstrapCatalog() {
    showBootScreen();
    updateBootProgress(4, "Iniciando");
    updateBootStatus("Preparando sincronización Fisherman...");
    markBootCheckpoint(bootCheckpointCoverage, "active");

    await loadPriorityPromotions();
    await loadCatalogFilters();

    markBootCheckpoint(bootCheckpointCoverage, "done");
    updateBootProgress(52, "Cobertura lista");

    await loadProductsFromApi(0, false, "", {
      force: true,
      mode: "full",
    });
  }

  function renderCategoryFilters() {
    const categories = getFilterCategories();

    categorySelect.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "todos";
    allOption.textContent = "Todos";
    categorySelect.appendChild(allOption);

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });

    categoryButtonsContainer.innerHTML = "";
    categoryButtonsContainer.appendChild(createCategoryButton("todos", "Todos"));

    categories.forEach((category) => {
      categoryButtonsContainer.appendChild(createCategoryButton(category, category));
    });

    if (
      selectedCategory !== "todos" &&
      !categories.includes(selectedCategory)
    ) {
      selectedCategory = "todos";
    }

    categorySelect.value = selectedCategory;
    updateCategoryButtonStyles();
  }

  function createCategoryButton(category: CatalogCategory, label: string) {
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.categoryButton = category;
    button.textContent = label;
    button.addEventListener("click", () => setCategory(category));

    return button;
  }

  function getFilteredProducts() {
    const search = searchInput.value.trim();

    return products.filter((product) => {
      const normalizedSelectedCategory = normalizeText(String(selectedCategory));
      const matchesCategory =
        selectedCategory === "todos" ||
        (product.categories ?? []).some(
          (category) => normalizeText(category) === normalizedSelectedCategory,
        );

      const searchable = `${product.name} ${product.category} ${product.tag} ${product.description} ${(product.categories ?? []).join(" ")}`;

      const matchesSearch = !search || fuzzyIncludes(search, searchable);

      return matchesCategory && matchesSearch;
    });
  }

  function setCategory(category: CatalogCategory, options: { fetchProducts?: boolean } = {}) {
    const shouldFetchProducts = options.fetchProducts ?? true;

    selectedCategory = category;
    categorySelect.value = category;

    updateCategoryButtonStyles();

    if (!shouldFetchProducts) return;

    activeServerCategory = String(category);
    activeServerSearch = "";
    searchInput.value = "";
    nextCatalogPage = 0;
    catalogTotal = undefined;
    hasMoreCatalogProducts = false;
    fastCatalogRetryCount = 0;
    showBootScreen();
    updateBootProgress(category === PROMOTIONS_CATEGORY ? 14 : 36, "Cargando categoría");
    updateBootStatus(
      category === PROMOTIONS_CATEGORY
        ? "Cargando Promociones desde Fisherman..."
        : `Cargando ${String(category)} desde Fisherman...`,
    );
    markBootCheckpoint(
      category === PROMOTIONS_CATEGORY ? bootCheckpointPromotions : bootCheckpointProducts,
      "active",
    );

    const canShowPromotionCache =
      category === PROMOTIONS_CATEGORY && promotionProducts.length > 0;

    if (canShowPromotionCache) {
      products = promotionProducts;
      catalogTotal = promotionProducts.length;
      hasMoreCatalogProducts = false;
      nextCatalogPage = 1;
      renderProducts();
    } else {
      products = [];
      grid.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-black text-slate-500">
          Cargando ${escapeHtml(String(category === "todos" ? "productos" : category))}...
        </div>
      `;
      catalogCount.textContent = "Cargando...";
    }
    updateCatalogSource(
      category === "todos"
        ? "Cargando productos..."
        : `Cargando ${String(category)}...`,
    );
    void loadProductsFromApi(0, false, activeServerSearch, {
      force: true,
      mode:
        category === "todos" && !activeServerSearch && !initialFullCatalogLoaded
          ? "full"
          : undefined,
    });
  }

  function updateCategoryButtonStyles() {
    const categoryButtons = categoryButtonsContainer.querySelectorAll<HTMLButtonElement>("[data-category-button]");

    categoryButtons.forEach((button) => {
      const isActive = button.dataset.categoryButton === selectedCategory;

      button.className = isActive
        ? "catalog-filter-active rounded-full px-4 py-2 text-sm font-black"
        : "catalog-filter-button";
    });
  }

  function getProductQuantity(productId: string) {
    return cart.find((item) => item.id === productId)?.quantity ?? 0;
  }

  function findCatalogProduct(productId: string) {
    return (
      products.find((item) => item.id === productId) ??
      promotionProducts.find((item) => item.id === productId)
    );
  }

  function getProductDescriptionText(product: CatalogProduct) {
    const description = product.description.trim();
    const normalizedDescription = normalizeText(description);
    const normalizedName = normalizeText(product.name);

    if (!description) return "";
    if (
      normalizedDescription === normalizedName ||
      normalizedDescription.includes(normalizedName) ||
      normalizedName.includes(normalizedDescription)
    ) {
      return "";
    }

    return description;
  }

  function getProductImageUrl(product: CatalogProduct) {
    if (product.imageUrl) return product.imageUrl;

    const productId = product.productId ?? product.id;
    return `${visualetApiUrl}/catalog/products/${encodeURIComponent(productId)}/image`;
  }

  function setImageZoom(nextZoom: number) {
    imageZoom = Math.min(2.6, Math.max(1, nextZoom));
    imagePreview.style.transform = `scale(${imageZoom})`;
  }

  function openImageModal(productId: string) {
    const product = findCatalogProduct(productId);

    if (!product) return;

    imageTitle.textContent = product.name;
    imagePreview.src = getProductImageUrl(product);
    imagePreview.alt = `Foto de ${product.name}`;
    setImageZoom(1);
    imageModal.classList.remove("hidden");
    imageModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeImageModal() {
    imageModal.classList.add("hidden");
    imageModal.setAttribute("aria-hidden", "true");
    imagePreview.removeAttribute("src");
    document.body.style.overflow = "";
  }

  function renderProducts() {
    const filteredProducts = getFilteredProducts();
    const renderedProducts = filteredProducts.slice(0, MAX_RENDERED_PRODUCTS);
    const hasActiveFilter =
      Boolean(searchInput.value.trim()) ||
      selectedCategory !== "todos";

    grid.innerHTML = "";
    catalogCount.textContent = activeServerSearch && catalogTotal
      ? `${products.length} de ${catalogTotal}`
      : hasActiveFilter
      ? filteredProducts.length > MAX_RENDERED_PRODUCTS
        ? `${MAX_RENDERED_PRODUCTS} de ${filteredProducts.length}`
        : String(filteredProducts.length)
      : catalogTotal
        ? `${products.length} de ${catalogTotal}`
        : `${products.length} cargados`;
    emptyState.classList.toggle("hidden", filteredProducts.length > 0);

    renderedProducts.forEach((product) => {
      const quantity = getProductQuantity(product.id);
      const categoryBadges = (product.categories ?? []).slice(0, 3);
      const descriptionText = getProductDescriptionText(product);
      const taxLabel = product.priceIncludesTax ? "IVA incluido" : "Sin IVA";
      const taxLabelClasses = product.priceIncludesTax
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-100 text-slate-600 border-slate-200";
      const article = document.createElement("article");

      article.className =
        "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-cyan-200 hover:shadow-md md:grid-cols-[6.5rem_minmax(0,1fr)_9rem_10rem] md:gap-4 md:p-4";

      article.innerHTML = `
        <button
          type="button"
          data-view-image="${escapeHtml(product.id)}"
          class="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:rounded-2xl"
          aria-label="Ver foto de ${escapeHtml(product.name)}"
        >
          <img
            src="${escapeHtml(getProductImageUrl(product))}"
            alt=""
            loading="lazy"
            class="h-full w-full object-contain p-1.5 transition group-hover:scale-105 md:p-2"
          />

          <span class="absolute inset-x-1 bottom-1 rounded-full bg-slate-950/78 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-white opacity-0 transition group-hover:opacity-100 md:inset-x-2 md:bottom-2 md:py-1 md:text-[0.65rem] md:tracking-[0.14em]">
            Zoom
          </span>
        </button>

        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5 md:gap-2">

            <span class="${getCategoryBadgeClasses(getPrimaryTag(product))}">
              ${escapeHtml(getPrimaryTag(product))}
            </span>

            ${categoryBadges
              .slice(1)
              .map(
                (category) => `
                  <span class="${getCategoryBadgeClasses(category)}">
                    ${escapeHtml(category)}
                  </span>
                `,
              )
              .join("")}
          </div>

          <h3 class="mt-1.5 line-clamp-2 text-sm font-black leading-snug text-slate-950 md:mt-3 md:text-lg">
            ${escapeHtml(product.name)}
          </h3>

          ${
            descriptionText
              ? `
                <p class="mt-1 hidden line-clamp-1 text-xs leading-5 text-slate-500 sm:block md:mt-2 md:line-clamp-2 md:text-sm md:leading-6">
                  ${escapeHtml(descriptionText)}
                </p>
              `
              : ""
          }
        </div>

        <div class="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 md:col-span-1 md:block md:bg-transparent md:px-0 md:py-0 md:text-right">
          <p class="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400 md:text-xs md:tracking-[0.18em]">
            Precio
          </p>

          <p class="text-sm font-black text-[#0F4C5C] md:text-lg">
            ${escapeHtml(product.priceText)}
          </p>

          <p class="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.1em] md:text-[0.65rem] ${taxLabelClasses}">
            ${escapeHtml(taxLabel)}
          </p>
        </div>

        <div class="col-span-2 flex items-center gap-1.5 md:col-span-1 md:gap-2 md:justify-end">
          ${
            quantity > 0
              ? `
                <button
                  type="button"
                  data-decrease-product="${escapeHtml(product.id)}"
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-base font-black text-slate-600 transition hover:bg-slate-100 md:h-10 md:w-10 md:text-lg"
                  aria-label="Reducir cantidad"
                >
                  -
                </button>

                <span class="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2.5 text-xs font-black text-slate-950 md:h-10 md:min-w-10 md:px-3 md:text-sm">
                  ${quantity}
                </span>
              `
              : ""
          }

          <button
            type="button"
            data-add-product="${escapeHtml(product.id)}"
            class="min-h-9 flex-1 rounded-full bg-[#0F4C5C] px-3 text-xs font-black text-white transition hover:bg-[#0B3D4A] md:min-h-10 md:flex-none md:px-4 md:text-sm"
          >
            Agregar
          </button>
        </div>
      `;

      grid.appendChild(article);
    });
  }

  function addToCart(productId: string) {
    const product = findCatalogProduct(productId);

    if (!product) return;

    const existing = cart.find((item) => item.id === productId);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        ...product,
        quantity: 1,
      });
    }

    renderProducts();
    renderCart();
    showToast("Producto agregado", `${product.name} se agrego a tu solicitud.`);
  }

  function decreaseCartItem(productId: string) {
    const existing = cart.find((item) => item.id === productId);

    if (!existing) return;

    existing.quantity -= 1;

    if (existing.quantity <= 0) {
      cart = cart.filter((item) => item.id !== productId);
    }

    renderProducts();
    renderCart();
  }

  function getCartCategoryScore(product: CatalogProduct) {
    const cartCategories = new Set(
      cart.flatMap((item) => item.categories ?? []).filter(isFilterCategory),
    );

    return (product.categories ?? []).filter((category) =>
      cartCategories.has(category),
    ).length;
  }

  function getRecommendedProducts() {
    if (cart.length === 0) return [];

    const cartIds = new Set(cart.map((item) => item.id));

    return products
      .filter((product) => !cartIds.has(product.id))
      .map((product) => ({
        product,
        score: getCartCategoryScore(product),
        isPromotion: (product.categories ?? []).some(
          (category) => normalizeText(category) === "promociones",
        ),
      }))
      .filter((item) => item.score > 0 || item.isPromotion)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (Number(b.isPromotion) !== Number(a.isPromotion)) {
          return Number(b.isPromotion) - Number(a.isPromotion);
        }

        return a.product.name.localeCompare(b.product.name, "es");
      })
      .slice(0, 3)
      .map((item) => item.product);
  }

  function renderRecommendations() {
    const recommendations = getRecommendedProducts();

    recommendationsPanel.classList.toggle("hidden", recommendations.length === 0);
    recommendationsList.innerHTML = "";

    recommendations.forEach((product) => {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.addProduct = product.id;
      button.className =
        "rounded-2xl bg-white/[0.06] p-3 text-left transition hover:bg-white/[0.1]";
      button.innerHTML = `
        <p class="line-clamp-1 text-sm font-black text-white">
          ${escapeHtml(product.name)}
        </p>

        <p class="mt-1 text-xs font-semibold text-cyan-200">
          ${escapeHtml(product.priceText)}
        </p>
      `;

      recommendationsList.appendChild(button);
    });
  }

  function renderCartProgress() {
    const totals = getCartTotals();
    const progress = Math.min(100, totals.quantity * 25);

    cartProgressPercent.textContent = `${progress}%`;
    cartProgressBar.style.width = `${progress}%`;

    if (totals.quantity === 0) {
      cartProgressLabel.textContent = "Empieza tu solicitud";
      cartProgressHint.textContent = "Agrega productos para preparar una solicitud clara.";
      return;
    }

    if (totals.quantity < 3) {
      cartProgressLabel.textContent = "Solicitud en progreso";
      cartProgressHint.textContent = "Agrega 3 o más productos para enviar una solicitud más completa.";
      return;
    }

    if (totals.quantity < 4) {
      cartProgressLabel.textContent = "Buen surtido";
      cartProgressHint.textContent = "Tu solicitud ya tiene buena base. Puedes enviarla o agregar complementos.";
      return;
    }

    cartProgressLabel.textContent = "Lista para confirmar";
    cartProgressHint.textContent = "Tu solicitud se ve completa. Envíala por WhatsApp para confirmar.";
  }

  function showToast(title: string, message: string) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.classList.remove("hidden");

    if (toastTimeout) {
      window.clearTimeout(toastTimeout);
    }

    toastTimeout = window.setTimeout(() => {
      toast.classList.add("hidden");
    }, 2400);
  }

  function removeFromCart(productId: string) {
    cart = cart.filter((item) => item.id !== productId);
    renderProducts();
    renderCart();
  }

  function getCartTotals() {
    const quantity = cart.reduce((total, item) => total + item.quantity, 0);
    const pricedItems = cart.filter((item) => typeof item.priceValue === "number");
    const amount = pricedItems.reduce(
      (total, item) => total + (item.priceValue ?? 0) * item.quantity,
      0,
    );

    return {
      amount,
      quantity,
      hasOnlyPricedItems: pricedItems.length === cart.length,
    };
  }

  function updateWhatsAppLink() {
    if (cart.length === 0) {
      sendOrder.href =
        "https://wa.me/529631788473?text=Hola%20Fisherman%2C%20quiero%20hacer%20un%20pedido.";
      if (mobileSendOrder) {
        mobileSendOrder.href = sendOrder.href;
      }
      return;
    }

    const lines = cart
      .map((item) => {
        const price = item.priceValue ? ` - ${item.priceText}` : "";
        return `- ${item.quantity} x ${item.name}${price}`;
      })
      .join("\n");

    const totals = getCartTotals();
    const totalLine = totals.hasOnlyPricedItems
      ? `\nTotal aproximado: ${formatPrice(totals.amount)}\n`
      : "\n";
    const coverageLines = routeInfo
      ? [
          "",
          customerLocationInput.value.trim()
            ? `Ubicacion: ${customerLocationInput.value.trim()}`
            : "",
          `Cobertura: ${routeInfo.messages.summary}`,
        ]
          .filter(Boolean)
      : [];
    const customerLines = customerInfo?.customer
      ? [
          "",
          `Cliente: ${customerInfo.customer.name}`,
          customerInfo.customer.ref ? `Clave: ${customerInfo.customer.ref}` : "",
          `Identificacion: ${customerInfo.messages.summary}`,
        ].filter(Boolean)
      : customerKeyInput.value.trim()
        ? ["", `Dato de cliente: ${customerKeyInput.value.trim()}`]
        : [];

    const message = [
      "Hola Fisherman, quiero hacer una solicitud de pedido:",
      "",
      lines,
      totalLine,
      ...customerLines,
      ...coverageLines,
      "¿Me pueden ayudar a confirmar precio final, stock y seguimiento?",
    ].join("\n");

    sendOrder.href = `https://wa.me/529631788473?text=${encodeURIComponent(message)}`;
    if (mobileSendOrder) {
      mobileSendOrder.href = sendOrder.href;
    }
  }

  function renderCart() {
    const totals = getCartTotals();

    cartList.innerHTML = "";
    cartEmpty.classList.toggle("hidden", cart.length > 0);
    cartSummary.textContent =
      totals.quantity === 1
        ? "1 producto agregado"
        : `${totals.quantity} productos agregados`;
    cartTotal.textContent =
      cart.length > 0 && totals.hasOnlyPricedItems
        ? formatPrice(totals.amount)
        : cart.length > 0
          ? "Por confirmar"
          : "$0.00";
    if (mobileCartSummary) {
      mobileCartSummary.textContent =
        totals.quantity === 1
          ? "1 producto"
          : `${totals.quantity} productos`;
    }

    if (mobileCartTotal) {
      mobileCartTotal.textContent = cartTotal.textContent;
    }

    cart.forEach((item) => {
      const row = document.createElement("div");

      row.className =
        "rounded-2xl border border-white/10 bg-white/[0.06] p-4";

      row.innerHTML = `
        <div class="grid gap-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-black leading-snug text-white">
                ${escapeHtml(item.name)}
              </p>

              <p class="mt-1 text-sm text-slate-400">
                ${escapeHtml(item.priceText)}
              </p>
            </div>

            <button
              type="button"
              data-remove-product="${escapeHtml(item.id)}"
              class="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black text-slate-300 transition hover:bg-white/[0.14]"
            >
              Quitar
            </button>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                data-decrease-product="${escapeHtml(item.id)}"
                class="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-lg font-black text-slate-200 transition hover:bg-white/[0.14]"
                aria-label="Reducir cantidad"
              >
                -
              </button>

              <span class="flex h-9 min-w-10 items-center justify-center rounded-full bg-white/[0.08] px-3 text-sm font-black text-white">
                ${item.quantity}
              </span>

              <button
                type="button"
                data-add-product="${escapeHtml(item.id)}"
                class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300 text-lg font-black text-slate-950 transition hover:bg-cyan-200"
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>

            <p class="text-sm font-black text-cyan-200">
              ${
                item.priceValue
                  ? escapeHtml(formatPrice(item.priceValue * item.quantity))
                  : "Por confirmar"
              }
            </p>
          </div>
        </div>
      `;

      cartList.appendChild(row);
    });

    updateWhatsAppLink();
    renderCartProgress();
    renderRecommendations();
  }

  searchInput.addEventListener("input", () => {
    renderProducts();

    if (searchDebounceTimeout) {
      window.clearTimeout(searchDebounceTimeout);
    }

    searchDebounceTimeout = window.setTimeout(() => {
      activeServerSearch = searchInput.value.trim();
      nextCatalogPage = 0;
      catalogTotal = undefined;
      hasMoreCatalogProducts = false;
      void loadProductsFromApi(0, false, activeServerSearch, { force: true });
    }, 420);
  });

  categorySelect.addEventListener("change", (event) => {
    setCategory((event.target as HTMLSelectElement).value as CatalogCategory);
  });

  viewPromotionsButton.addEventListener("click", () => {
    setCategory(PROMOTIONS_CATEGORY);
  });

  loadMoreButton.addEventListener("click", () => {
    void loadProductsFromApi(nextCatalogPage, true, activeServerSearch);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const addButton = target.closest<HTMLButtonElement>("[data-add-product]");
    const decreaseButton = target.closest<HTMLButtonElement>("[data-decrease-product]");
    const removeButton = target.closest<HTMLButtonElement>("[data-remove-product]");
    const imageButton = target.closest<HTMLButtonElement>("[data-view-image]");

    if (imageButton?.dataset.viewImage) {
      openImageModal(imageButton.dataset.viewImage);
      return;
    }

    if (addButton?.dataset.addProduct) {
      addToCart(addButton.dataset.addProduct);
    }

    if (decreaseButton?.dataset.decreaseProduct) {
      decreaseCartItem(decreaseButton.dataset.decreaseProduct);
    }

    if (removeButton?.dataset.removeProduct) {
      removeFromCart(removeButton.dataset.removeProduct);
    }
  });

  clearCart.addEventListener("click", () => {
    cart = [];
    renderProducts();
    renderCart();
  });

  bootWaitButton?.addEventListener("click", () => {
    updateBootStatus("Seguimos sincronizando el catálogo...");
  });

  bootSkipButton?.addEventListener("click", () => {
    updateCatalogSource("Puedes explorar mientras Fisherman sincroniza datos.");
    hideBootScreen();
  });

  bootGameTarget?.addEventListener("click", () => {
    bootGameScoreValue += 1;

    if (bootGameScore) {
      bootGameScore.textContent =
        bootGameScoreValue === 1
          ? "1 captura"
          : `${bootGameScoreValue} capturas`;
    }

    moveBootGameTarget();
  });

  resolveCoverageButton.addEventListener("click", () => {
    renderCustomerInfo(null);
    void loadCoverageCalendar(customerLocationInput.value);
  });

  resolveCustomerButton.addEventListener("click", () => {
    void resolveCustomerIdentity(customerKeyInput.value);
  });

  customerKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void resolveCustomerIdentity(customerKeyInput.value);
    }
  });

  customerKeyInput.addEventListener("input", () => {
    updateWhatsAppLink();
  });

  customerLocationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renderCustomerInfo(null);
      void loadCoverageCalendar(customerLocationInput.value);
    }
  });

  customerLocationInput.addEventListener("input", () => {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, customerLocationInput.value);
    updateWhatsAppLink();
  });

  clearCustomerButton.addEventListener("click", () => {
    customerKeyInput.value = "";
    window.localStorage.removeItem(CUSTOMER_KEY_STORAGE_KEY);
    renderCustomerInfo(null);
    void loadCoverageCalendar(customerLocationInput.value);
  });

  closeImageModalButton.addEventListener("click", closeImageModal);
  zoomInButton.addEventListener("click", () => setImageZoom(imageZoom + 0.25));
  zoomOutButton.addEventListener("click", () => setImageZoom(imageZoom - 0.25));

  imageModal.addEventListener("click", (event) => {
    if (event.target === imageModal) {
      closeImageModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !imageModal.classList.contains("hidden")) {
      closeImageModal();
    }
  });

  renderCategoryFilters();
  setCategory("todos", { fetchProducts: false });
  renderCart();
  customerKeyInput.value = window.localStorage.getItem(CUSTOMER_KEY_STORAGE_KEY) ?? "";
  customerLocationInput.value =
    window.localStorage.getItem(LOCATION_STORAGE_KEY) ?? "";
  if (customerKeyInput.value.trim()) {
    void resolveCustomerIdentity(customerKeyInput.value);
  } else {
    void loadCoverageCalendar(customerLocationInput.value);
  }
  void bootstrapCatalog();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCatalogPage, { once: true });
} else {
  initCatalogPage();
}

document.addEventListener("astro:page-load", initCatalogPage);

