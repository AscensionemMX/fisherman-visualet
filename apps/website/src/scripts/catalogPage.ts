import { catalogProducts } from "../data/products";
import type {
  CartItem,
  CatalogAvailabilityFilter,
  CatalogCategory,
  CatalogProduct,
} from "../types/visualet";

type ApiCatalogProduct = {
  dolibarrProductId: string;
  sku: string;
  name: string;
  description: string;
  priceShown: number;
  availability: string;
  imageUrl?: string;
  categories?: string[];
  lastSyncedAt: string;
};

type ApiCatalogResponse = {
  items: ApiCatalogProduct[];
  source?: "dolibarr" | "cache";
  lastSyncedAt?: string;
};

const fallbackProducts = catalogProducts;
const MAX_RENDERED_PRODUCTS = 120;
const PRODUCTION_VISUALET_API_URL = "https://navajowhite-sardine-989084.hostingersite.com";

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

function getRequiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing catalog element: ${selector}`);
  }

  return element;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function getAvailabilityKey(value?: string): CatalogAvailabilityFilter {
  const normalized = normalizeText(value ?? "");

  if (normalized.includes("pocas")) return "pocas";
  if (normalized.includes("no disponible")) return "no-disponible";
  if (normalized.includes("disponible")) return "disponible";

  return "disponible";
}

function getAvailabilityClasses(value?: string) {
  const key = getAvailabilityKey(value);

  if (key === "no-disponible") {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }

  if (key === "pocas") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-100";
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

function initCatalogPage() {
  const searchInput = getRequiredElement<HTMLInputElement>("#catalog-search");
  const categorySelect = getRequiredElement<HTMLSelectElement>("#catalog-category");
  const availabilitySelect = getRequiredElement<HTMLSelectElement>("#catalog-availability");
  const categoryButtonsContainer = getRequiredElement<HTMLDivElement>("#catalog-category-buttons");
  const grid = getRequiredElement<HTMLDivElement>("#catalog-grid");
  const catalogSource = getRequiredElement<HTMLParagraphElement>("#catalog-source");
  const catalogCount = getRequiredElement<HTMLParagraphElement>("#catalog-count");
  const emptyState = getRequiredElement<HTMLDivElement>("#catalog-empty");
  const cartList = getRequiredElement<HTMLDivElement>("#cart-list");
  const cartEmpty = getRequiredElement<HTMLDivElement>("#cart-empty");
  const cartSummary = getRequiredElement<HTMLParagraphElement>("#cart-summary");
  const cartTotal = getRequiredElement<HTMLParagraphElement>("#cart-total");
  const cartProgressLabel = getRequiredElement<HTMLParagraphElement>("#cart-progress-label");
  const cartProgressPercent = getRequiredElement<HTMLParagraphElement>("#cart-progress-percent");
  const cartProgressBar = getRequiredElement<HTMLDivElement>("#cart-progress-bar");
  const cartProgressHint = getRequiredElement<HTMLParagraphElement>("#cart-progress-hint");
  const sendOrder = getRequiredElement<HTMLAnchorElement>("#send-order");
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

  let selectedCategory: CatalogCategory = "todos";
  let selectedAvailability: CatalogAvailabilityFilter = "todos";
  let products: CatalogProduct[] = fallbackProducts;
  let cart: CartItem[] = [];
  let imageZoom = 1;
  let toastTimeout: number | undefined;

  function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  }

  function mapApiProduct(product: ApiCatalogProduct): CatalogProduct {
    return {
      id: product.dolibarrProductId,
      dolibarrProductId: product.dolibarrProductId,
      name: product.name,
      category: product.categories?.find(isFilterCategory) ?? "sin_categoria",
      tag: product.sku || "Fisherman",
      description: product.description || product.name,
      priceText: formatPrice(product.priceShown),
      priceValue: product.priceShown,
      availability: product.availability,
      imageUrl: resolveApiUrl(product.imageUrl),
      categories: product.categories ?? [],
      lastSyncedAt: product.lastSyncedAt,
    };
  }

  function updateCatalogSource(status: string) {
    catalogSource.textContent = status;
  }

  async function loadProductsFromApi() {
    try {
      updateCatalogSource("Sincronizando catalogo...");

      const response = await fetch(
        `${visualetApiUrl}/catalog/products?audience=customer&limit=5000`,
      );

      if (!response.ok) {
        throw new Error(`Visualet API responded with ${response.status}`);
      }

      const data = (await response.json()) as ApiCatalogResponse;

      if (!Array.isArray(data.items)) {
        throw new Error("Visualet API response is missing items");
      }

      products = data.items.map(mapApiProduct);
      renderCategoryFilters();

      const syncedAt = data.lastSyncedAt
        ? new Date(data.lastSyncedAt).toLocaleString("es-MX")
        : "sin fecha";

      updateCatalogSource(
        `Datos Fisherman (${data.source ?? "api"}) - actualizado ${syncedAt}`,
      );

      renderProducts();
    } catch (error) {
      console.warn("Using local catalog fallback:", error);
      products = fallbackProducts;
      renderCategoryFilters();
      updateCatalogSource("Catalogo local de respaldo");
      renderProducts();
    }
  }

  function getFilterCategories() {
    return Array.from(
      new Set(
        products.flatMap((product) => product.categories ?? []).filter(isFilterCategory),
      ),
    ).sort((a, b) => a.localeCompare(b, "es"));
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
    const search = normalizeText(searchInput.value.trim());

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "todos" ||
        (product.categories ?? []).includes(selectedCategory);

      const productAvailability = getAvailabilityKey(product.availability);
      const matchesAvailability =
        selectedAvailability === "todos" ||
        productAvailability === selectedAvailability;

      const searchable = normalizeText(
        `${product.name} ${product.category} ${product.tag} ${product.description} ${(product.categories ?? []).join(" ")}`,
      );

      const matchesSearch = !search || searchable.includes(search);

      return matchesCategory && matchesAvailability && matchesSearch;
    });
  }

  function setCategory(category: CatalogCategory) {
    selectedCategory = category;
    categorySelect.value = category;

    updateCategoryButtonStyles();

    renderProducts();
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

  function getProductImageUrl(product: CatalogProduct) {
    if (product.imageUrl) return product.imageUrl;

    const productId = product.dolibarrProductId ?? product.id;
    return `${visualetApiUrl}/catalog/products/${encodeURIComponent(productId)}/image`;
  }

  function setImageZoom(nextZoom: number) {
    imageZoom = Math.min(2.6, Math.max(1, nextZoom));
    imagePreview.style.transform = `scale(${imageZoom})`;
  }

  function openImageModal(productId: string) {
    const product = products.find((item) => item.id === productId);

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

    grid.innerHTML = "";
    catalogCount.textContent =
      filteredProducts.length > MAX_RENDERED_PRODUCTS
        ? `${MAX_RENDERED_PRODUCTS} de ${filteredProducts.length}`
        : String(filteredProducts.length);
    emptyState.classList.toggle("hidden", filteredProducts.length > 0);

    renderedProducts.forEach((product) => {
      const quantity = getProductQuantity(product.id);
      const availability = product.availability ?? "Disponible";
      const availabilityKey = getAvailabilityKey(availability);
      const isUnavailable = availabilityKey === "no-disponible";
      const categoryBadges = (product.categories ?? []).slice(0, 3);
      const article = document.createElement("article");

      article.className =
        "grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:shadow-md lg:grid-cols-[6.5rem_minmax(0,1fr)_9rem_10rem]";

      article.innerHTML = `
        <button
          type="button"
          data-view-image="${escapeHtml(product.id)}"
          class="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          aria-label="Ver foto de ${escapeHtml(product.name)}"
        >
          <img
            src="${escapeHtml(getProductImageUrl(product))}"
            alt="Foto de ${escapeHtml(product.name)}"
            loading="lazy"
            class="h-full w-full object-contain p-2 transition group-hover:scale-105"
          />

          <span class="absolute inset-x-2 bottom-2 rounded-full bg-slate-950/78 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white opacity-0 transition group-hover:opacity-100">
            Zoom
          </span>
        </button>

        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border px-3 py-1 text-xs font-black ${getAvailabilityClasses(availability)}">
              ${escapeHtml(availability)}
            </span>

            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
              ${escapeHtml(getPrimaryTag(product))}
            </span>

            ${categoryBadges
              .slice(1)
              .map(
                (category) => `
                  <span class="hidden rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[#0F4C5C] md:inline-flex">
                    ${escapeHtml(category)}
                  </span>
                `,
              )
              .join("")}
          </div>

          <h3 class="mt-3 text-lg font-black leading-snug text-slate-950">
            ${escapeHtml(product.name)}
          </h3>

          <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            ${escapeHtml(product.description)}
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 lg:block lg:text-right">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Precio
          </p>

          <p class="text-lg font-black text-[#0F4C5C]">
            ${escapeHtml(product.priceText)}
          </p>
        </div>

        <div class="flex items-center gap-2 lg:justify-end">
          ${
            quantity > 0
              ? `
                <button
                  type="button"
                  data-decrease-product="${escapeHtml(product.id)}"
                  class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-black text-slate-600 transition hover:bg-slate-100"
                  aria-label="Reducir cantidad"
                >
                  -
                </button>

                <span class="flex h-10 min-w-10 items-center justify-center rounded-full bg-slate-100 px-3 text-sm font-black text-slate-950">
                  ${quantity}
                </span>
              `
              : ""
          }

          <button
            type="button"
            data-add-product="${escapeHtml(product.id)}"
            class="min-h-10 flex-1 rounded-full px-4 text-sm font-black transition lg:flex-none ${
              isUnavailable
                ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                : "bg-[#0F4C5C] text-white hover:bg-[#0B3D4A]"
            }"
          >
            ${isUnavailable ? "Preguntar" : quantity > 0 ? "Agregar" : "Agregar"}
          </button>
        </div>
      `;

      grid.appendChild(article);
    });
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);

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
          ${escapeHtml(product.priceText)} · ${escapeHtml(product.availability ?? "Disponible")}
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
      cartProgressHint.textContent = "Agrega 3 o mas productos para enviar una solicitud mas completa.";
      return;
    }

    if (totals.quantity < 4) {
      cartProgressLabel.textContent = "Buen surtido";
      cartProgressHint.textContent = "Tu solicitud ya tiene buena base. Puedes enviarla o agregar complementos.";
      return;
    }

    cartProgressLabel.textContent = "Lista para confirmar";
    cartProgressHint.textContent = "Tu solicitud se ve completa. Enviala por WhatsApp para confirmar.";
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
      return;
    }

    const lines = cart
      .map((item) => {
        const price = item.priceValue ? ` - ${item.priceText}` : "";
        const availability = item.availability ? ` - ${item.availability}` : "";

        return `- ${item.quantity} x ${item.name}${price}${availability}`;
      })
      .join("\n");

    const totals = getCartTotals();
    const totalLine = totals.hasOnlyPricedItems
      ? `\nTotal aproximado: ${formatPrice(totals.amount)}\n`
      : "\n";

    const message = [
      "Hola Fisherman, quiero hacer una solicitud de pedido:",
      "",
      lines,
      totalLine,
      "Me pueden ayudar a confirmar disponibilidad, precio final y seguimiento?",
    ].join("\n");

    sendOrder.href = `https://wa.me/529631788473?text=${encodeURIComponent(message)}`;
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
                ${escapeHtml(item.priceText)} · ${escapeHtml(item.availability ?? "Disponible")}
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

  searchInput.addEventListener("input", renderProducts);

  categorySelect.addEventListener("change", (event) => {
    setCategory((event.target as HTMLSelectElement).value as CatalogCategory);
  });

  availabilitySelect.addEventListener("change", (event) => {
    selectedAvailability = (event.target as HTMLSelectElement)
      .value as CatalogAvailabilityFilter;
    renderProducts();
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
  setCategory("todos");
  renderCart();
  void loadProductsFromApi();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCatalogPage, { once: true });
} else {
  initCatalogPage();
}

document.addEventListener("astro:page-load", initCatalogPage);
