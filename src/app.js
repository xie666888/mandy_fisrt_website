(function () {
  const CART_KEY = "luxe-trade-cart";
  const ADMIN_PAGE_SIZE = 80;
  const SITE_NAME = "BeBeauty Wholesale Catalog";
  const HOME_TITLE = "Wholesale Cosmetics & Beauty Products Catalog | BeBeauty";
  const HOME_DESCRIPTION = "Browse wholesale cosmetics and beauty products by brand, category, SKU, shade and price. Create an order number for supplier confirmation.";

  function productIdFromPath() {
    const match = location.pathname.match(/^\/product\/(.+?)\/?$/);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return "";
    }
  }

  const initialProductId = productIdFromPath();
  const initialParams = new URLSearchParams(location.search);

  const state = {
    view: initialProductId ? "detail" : location.hash === "#admin" ? "admin" : location.hash === "#cart" ? "cart" : "catalog",
    detailId: initialProductId || null,
    search: initialParams.get("q") || "",
    brand: initialParams.get("brand") || "All",
    category: initialParams.get("category") || "All",
    sort: "featured",
    editingId: null,
    selectedColor: "",
    selectedImage: "",
    qty: 1,
    quickAddId: null,
    quickAddColor: "",
    quickAddQty: 1,
    cartFeedback: null,
    shippingCountry: "Europe",
    orderStatus: "",
    adminLoginError: "",
    adminStatus: "",
    adminSearch: "",
    adminPage: 1,
    loading: true,
  };

  const initialProducts = (window.CATALOG_PRODUCTS || []).map((p) => normalizeProduct({ ...p, published: p.published !== false }));
  let products = initialProducts;
  let cart = readJSON(CART_KEY, []);
  let whatsappNumber = "8613800000000";
  let isAdminAuthed = false;
  let apiOnline = false;

  const PRODUCT_QA = [
    ["Are these products authentic?", "No. These are replica products and are not sold as authentic branded goods."],
    ["Can every product be scanned in the Sephora app?", "No. Sephora app scanning is not guaranteed for these products."],
    ["How does the order process work?", "Add products, shades and quantities to the cart, create an order number, then confirm availability and the Alibaba payment link through WhatsApp."],
    ["How long does delivery take?", "Goods are normally sent to the forwarder within three working days after payment. Forwarder delivery is usually 12 to 15 days."],
    ["What happens if goods are damaged during transportation?", "A replacement can be sent with the next order or the damaged item cost can be refunded after confirmation."],
  ];

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok) {
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }
    return payload;
  }

  async function apiBlob(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let error = `Request failed: ${response.status}`;
      try {
        const data = await response.json();
        error = data.error || error;
      } catch {}
      throw new Error(error);
    }
    return response.blob();
  }

  async function uploadImageFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return [];
    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file, file.name);
    }
    const response = await fetch("/api/uploads/images", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: formData,
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }
    if (!response.ok) {
      throw new Error(result.error || `Upload failed: ${response.status}`);
    }
    return result.urls || [];
  }

  function localPreviewUrls(files) {
    return Array.from(files || []).map((file) => URL.createObjectURL(file));
  }

  function revokePreviewUrls(urls) {
    for (const url of urls || []) {
      if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    }
  }

  function preloadImages(urls) {
    return Promise.all(
      cleanImageList(urls).map(
        (url) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = resolve;
            image.onerror = resolve;
            image.src = url;
          })
      )
    );
  }

  function adminThumbSrc(image) {
    if (!image || String(image).startsWith("blob:") || String(image).startsWith("data:")) return image || "";
    return `/api/thumb?size=160&src=${encodeURIComponent(image)}`;
  }

  function setAdminLiveStatus(message) {
    const target = document.querySelector("[data-admin-live-status]");
    if (target) target.textContent = message;
    state.adminStatus = message;
  }

  async function loadServerState() {
    state.loading = true;
    try {
      const [productPayload, mePayload, settingsPayload] = await Promise.all([
        apiFetch("/api/products?include_drafts=1"),
        apiFetch("/api/me"),
        apiFetch("/api/settings"),
      ]);
      products = (productPayload.products || []).map(normalizeProduct);
      isAdminAuthed = Boolean(mePayload.authenticated);
      whatsappNumber = settingsPayload.settings?.whatsapp || whatsappNumber;
      apiOnline = true;
    } catch (error) {
      products = initialProducts;
      apiOnline = false;
      console.warn("API unavailable, using static catalog fallback.", error);
    } finally {
      state.loading = false;
    }
  }

  async function refreshProducts() {
    const payload = await apiFetch(`/api/products?include_drafts=${isAdminAuthed ? "1" : "0"}`);
    products = (payload.products || []).map(normalizeProduct);
  }

  function cleanColorList(items) {
    const cleaned = (items || [])
      .flatMap((item) => splitColorText(item))
      .map((item) => String(item || "").trim())
      .map((item) => item.replace(/^colou?rs?\s*[:：]/i, "").replace(/^[#/\-\s]+|[#/\-\s]+$/g, ""))
      .filter(Boolean)
      .filter((item) => !/(?:size|gross|net|weight|cm|\*)/i.test(item))
      .filter((item) => !/^\d+(?:\.\d+)?g$/i.test(item));
    return Array.from(new Set(cleaned)).slice(0, 18);
  }

  function splitColorText(value) {
    return String(value || "")
      .split("/")
      .filter(Boolean);
  }

  function extractColorOptions(info, fallback = []) {
    const text = String(info || "");
    const match = text.match(/colou?rs?\s*[:：]\s*(.*)/i);
    if (!match) return cleanColorList(fallback);
    const raw = match[1]
      .split(/\s+(?:size|gross\s*weight|gross|net\s*(?:weight|wet|wight)|weight)\s*[:：]?/i)[0];
    const parsed = cleanColorList(raw.split("/"));
    return parsed.length ? parsed : cleanColorList(fallback);
  }

  function normalizeAssetUrl(value) {
    const url = String(value || "").trim().replace(/\\/g, "/");
    if (!url || /^(?:https?:|data:|blob:)/i.test(url) || url.startsWith("/")) return url;
    return `/${url.replace(/^\.\//, "").replace(/^\/+/, "")}`;
  }

  function normalizeProduct(product) {
    const images = cleanImageList(product.images || []).map(normalizeAssetUrl);
    const image = normalizeAssetUrl(product.image || images[0] || "");
    if (image && !images.includes(image)) images.unshift(image);
    return {
      ...product,
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      weight: Number(product.weight || 0),
      colors: extractColorOptions(product.description, product.colors),
      image,
      images,
      published: product.published !== false,
    };
  }

  function cleanImageList(items) {
    return Array.from(new Set((Array.isArray(items) ? items : String(items || "").split(",")).map((item) => String(item || "").trim()).filter(Boolean)));
  }

  function mergeStoredProducts(stored) {
    if (!Array.isArray(stored) || !stored.length) return initialProducts;
    const byId = new Map(initialProducts.map((product) => [product.id, product]));
    return stored.map((product) => {
      const base = byId.get(product.id);
      if (!base) return normalizeProduct(product);
      return normalizeProduct({
        ...product,
        image: product.image || base.image || "",
        description: product.description || base.description,
        colors: product.colors && product.colors.length ? product.colors : base.colors || [],
      });
    });
  }

  function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function weight(value) {
    return `${Number(value || 0).toFixed(3)}kg`;
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  }

  function brands() {
    return ["All", ...Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort()];
  }

  function adminBrandOptions() {
    return brands().filter((brand) => brand !== "All");
  }

  function categories() {
    return ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()];
  }

  function filteredProducts() {
    const q = state.search.trim().toLowerCase();
    let list = products.filter((p) => p.published !== false);
    if (q) list = list.filter((p) => [p.sku, p.brand, p.name, p.description, p.category].join(" ").toLowerCase().includes(q));
    if (state.brand !== "All") list = list.filter((p) => p.brand === state.brand);
    if (state.category !== "All") list = list.filter((p) => p.category === state.category);
    if (state.sort === "price-low") list.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") list.sort((a, b) => b.price - a.price);
    if (state.sort === "brand") list.sort((a, b) => a.brand.localeCompare(b.brand));
    return list;
  }

  function cartCount() {
    return cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  }

  function cartLines() {
    return cart.map((item) => {
      const product = products.find((p) => p.id === item.id || p.sku === item.sku);
      const merged = product ? { ...item, ...product, color: item.color, qty: item.qty, key: item.key } : item;
      return {
        ...merged,
        price: Number(merged.price || 0),
        weight: Number(merged.weight || 0),
        qty: Math.max(1, Number(merged.qty || 1)),
        image: merged.image || "",
      };
    });
  }

  function billableShippingWeight(country, productWeight) {
    const kg = Math.max(0, Number(productWeight || 0));
    if (country !== "Europe" || kg <= 6) return kg;
    return Math.ceil((kg + 2 - Number.EPSILON) * 2) / 2;
  }

  function shippingCost(country, billableWeight) {
    const kg = Math.max(0, Number(billableWeight || 0));
    if (country === "United States") {
      if (kg <= 0.7) return 48.8;
      if (kg <= 1.2) return 65.4;
      if (kg <= 2) return 79.8;
      if (kg <= 3) return 84.2;
      if (kg <= 4) return 94.2;
      if (kg <= 5) return kg * 21.3;
      if (kg <= 15) return kg * 19.3;
      return kg * 17.3;
    }
    if (kg <= 0.7) return 31.2;
    if (kg <= 1.5) return 35.2;
    if (kg <= 2) return 43.8;
    if (kg <= 3) return 52.3;
    if (kg <= 4) return 61.8;
    if (kg <= 5) return 72.3;
    if (kg <= 6) return 81.4;
    return kg * 10.8;
  }

  function cartTotals() {
    const lines = cartLines();
    const productTotal = lines.reduce((sum, item) => sum + item.qty * item.price, 0);
    const totalWeight = lines.reduce((sum, item) => sum + item.qty * Number(item.weight || 0), 0);
    const shippingWeight = lines.length ? billableShippingWeight(state.shippingCountry, totalWeight) : 0;
    const shipping = lines.length ? shippingCost(state.shippingCountry, shippingWeight) : 0;
    return { lines, productTotal, totalWeight, shippingWeight, shipping, total: productTotal + shipping };
  }

  function shadeOptions(product) {
    const colors = extractColorOptions(product?.description, product?.colors);
    return colors.length ? colors : ["Default"];
  }

  function cartEntriesForProduct(id) {
    return cart.filter((item) => item.id === id);
  }

  function cartStatusForProduct(id) {
    const entries = cartEntriesForProduct(id);
    if (!entries.length) return "";
    const qty = entries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const shades = Array.from(new Set(entries.map((item) => item.color || "Default"))).slice(0, 4).join(", ");
    return `<div class="in-cart-badge">In cart: ${qty}${shades ? ` · ${escapeHTML(shades)}` : ""}</div>`;
  }

  function searchSuggestions() {
    const query = state.search.trim().toLowerCase();
    if (query.length < 2) return "";
    const matchingProducts = products
      .filter((p) => p.published !== false && [p.sku, p.brand, p.name, p.category].join(" ").toLowerCase().includes(query))
      .slice(0, 5);
    const matchingBrands = brands().filter((brand) => brand !== "All" && brand.toLowerCase().includes(query)).slice(0, 3);
    const matchingCategories = categories().filter((category) => category !== "All" && category.toLowerCase().includes(query)).slice(0, 3);
    if (!matchingProducts.length && !matchingBrands.length && !matchingCategories.length) return "";
    return `
      <div class="search-suggest">
        ${matchingProducts.map((p) => `
          <button type="button" data-detail="${escapeHTML(p.id)}">
            <span class="suggest-thumb">${p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async">` : escapeHTML(p.brand.slice(0, 2))}</span>
            <span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.sku)} · ${escapeHTML(p.brand)}</small></span>
          </button>`).join("")}
        ${matchingBrands.map((brand) => `<button type="button" data-filter-brand="${escapeHTML(brand)}"><span class="suggest-chip">Brand</span><span>${escapeHTML(brand)}</span></button>`).join("")}
        ${matchingCategories.map((category) => `<button type="button" data-filter-category="${escapeHTML(category)}"><span class="suggest-chip">Category</span><span>${escapeHTML(category)}</span></button>`).join("")}
      </div>`;
  }

  function activeFilterChips() {
    const chips = [];
    if (state.search.trim()) chips.push({ label: `Search: ${state.search.trim()}`, key: "search" });
    if (state.brand !== "All") chips.push({ label: `Brand: ${state.brand}`, key: "brand" });
    if (state.category !== "All") chips.push({ label: `Category: ${state.category}`, key: "category" });
    if (!chips.length) return "";
    return `
      <div class="filter-chips">
        ${chips.map((chip) => `<button type="button" data-clear-filter="${chip.key}">${escapeHTML(chip.label)} <span>X</span></button>`).join("")}
        <button type="button" data-clear-filter="all">Clear all</button>
      </div>`;
  }

  function quickAddModalHTML() {
    if (!state.quickAddId) return "";
    const product = products.find((item) => item.id === state.quickAddId);
    if (!product) return "";
    const options = shadeOptions(product);
    if (!options.includes(state.quickAddColor)) state.quickAddColor = options[0];
    return `
      <div class="quick-add-backdrop" data-quick-backdrop>
        <section class="quick-add-modal" role="dialog" aria-modal="true" aria-label="Quick add ${escapeHTML(product.name)}">
          <button class="quick-close" type="button" data-close-quick-add aria-label="Close">X</button>
          <div class="quick-product">
            <div class="thumb">${product.image ? `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="eager" decoding="async">` : escapeHTML(product.brand.slice(0, 2))}</div>
            <div>
              <h3>${escapeHTML(product.name)}</h3>
              <p class="small">${escapeHTML(product.sku)} · ${escapeHTML(product.brand)} · ${money(product.price)}</p>
            </div>
          </div>
          <label class="field">
            <span>Choose shade / type</span>
            <div class="swatches">${options.map((option) => `<button type="button" class="swatch ${option === state.quickAddColor ? "active" : ""}" data-quick-color="${escapeHTML(option)}">${escapeHTML(option)}</button>`).join("")}</div>
          </label>
          <label class="field"><span>Quantity</span><input type="number" min="1" value="${state.quickAddQty}" data-action="quick-qty"></label>
          <button class="primary" type="button" data-quick-add-submit="${escapeHTML(product.id)}">Add to cart</button>
        </section>
      </div>`;
  }

  function imagePerfAttrs(priority = "lazy") {
    return priority === "eager" ? 'loading="eager" decoding="async" fetchpriority="high"' : 'loading="lazy" decoding="async"';
  }

  function productImage(product, priority = "lazy") {
    if (product.image) return `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" ${imagePerfAttrs(priority)} style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`;
    return `<div class="bottle" data-brand="${escapeHTML(product.brand)}"></div>`;
  }

  function productImages(product) {
    const images = cleanImageList([product.image, ...(product.images || [])]);
    return images.length ? images : [""];
  }

  function productImageByUrl(product, imageUrl, priority = "lazy") {
    if (imageUrl) return `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(product.name)}" ${imagePerfAttrs(priority)} style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`;
    return `<div class="bottle" data-brand="${escapeHTML(product.brand)}"></div>`;
  }

  function productPath(id) {
    return `/product/${encodeURIComponent(id)}`;
  }

  function setMeta(selector, attribute, value) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      const propertyMatch = selector.match(/^meta\[property="([^"]+)"\]$/);
      const nameMatch = selector.match(/^meta\[name="([^"]+)"\]$/);
      if (propertyMatch) element.setAttribute("property", propertyMatch[1]);
      if (nameMatch) element.setAttribute("name", nameMatch[1]);
      document.head.appendChild(element);
    }
    element.setAttribute(attribute, value);
  }

  function setCanonical(url) {
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }

  function metadataDescription(product) {
    const identity = `${product.name} by ${product.brand}, SKU ${product.sku}.`;
    const description = String(product.description || "").replace(/\s+/g, " ").trim();
    return `${identity} ${description} Wholesale beauty catalog with shade selection and order-number confirmation.`
      .slice(0, 158)
      .replace(/[\s,.;]+$/, "") + ".";
  }

  function updatePageMetadata() {
    const product = state.view === "detail" ? products.find((item) => item.id === state.detailId) : null;
    const privateView = state.view === "admin" || state.view === "cart";
    const title = product ? `${product.name} Wholesale | ${product.brand} | BeBeauty` : HOME_TITLE;
    const description = product ? metadataDescription(product) : HOME_DESCRIPTION;
    const canonical = product ? new URL(productPath(product.id), location.origin).href : `${location.origin}/`;
    document.title = title;
    setCanonical(canonical);
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[name="robots"]', "content", privateView ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1");
    setMeta('meta[property="og:site_name"]', "content", SITE_NAME);
    setMeta('meta[property="og:type"]', "content", product ? "product" : "website");
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonical);
    if (product?.image) {
      setMeta('meta[property="og:image"]', "content", new URL(product.image.replace(/^\.\//, "/"), location.origin).href);
    }
  }

  function updateCatalogUrl() {
    const params = new URLSearchParams();
    if (state.brand !== "All") params.set("brand", state.brand);
    if (state.category !== "All") params.set("category", state.category);
    const query = params.toString();
    history.pushState({ view: "catalog" }, "", query ? `/?${query}` : "/");
  }

  function openDetail(id, pushHistory = true) {
    state.view = "detail";
    state.detailId = id;
    state.qty = 1;
    state.selectedColor = "";
    state.selectedImage = "";
    if (pushHistory && location.pathname !== productPath(id)) {
      history.pushState({ view: "detail", id }, "", productPath(id));
    }
    render();
    window.setTimeout(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 0);
  }

  function cartFeedbackHTML() {
    if (!state.cartFeedback) return "";
    return `
      <div class="cart-fly" aria-live="polite">
        <div class="cart-fly-image">${productImage(state.cartFeedback, "eager")}</div>
        <div><strong>Added to cart</strong><span>${escapeHTML(state.cartFeedback.name)}</span></div>
      </div>`;
  }

  function layout(content) {
    document.getElementById("app").innerHTML = `
      <div class="app">
        <header class="topbar">
          <div class="brand" role="button" data-view="catalog"><span class="brand-mark">L</span><span>Luxe Trade Catalog</span></div>
          <nav class="nav">
            <button class="${state.view === "catalog" ? "active" : ""}" data-view="catalog">Products</button>
            <button class="${state.view === "admin" ? "active" : ""}" data-view="admin">Admin</button>
            <button class="cart-pill ${state.view === "cart" ? "active" : ""} ${state.cartFeedback ? "cart-bump" : ""}" data-view="cart">Cart <span class="cart-count">${cartCount()}</span></button>
          </nav>
        </header>
        ${content}
        ${cartFeedbackHTML()}
        ${quickAddModalHTML()}
      </div>`;
  }

  function render() {
    if (state.loading) {
      layout(`<main class="content"><div class="empty">Loading catalog...</div></main>`);
      return;
    }
    updatePageMetadata();
    if (state.view === "detail") return renderDetail();
    if (state.view === "cart") return renderCart();
    if (state.view === "admin") return renderAdmin();
    renderCatalog();
  }

  function refocusControl(selector, start, end = start) {
    window.requestAnimationFrame(() => {
      const input = document.querySelector(selector);
      if (!input) return;
      input.focus({ preventScroll: true });
      if (typeof input.setSelectionRange === "function") {
        const valueLength = String(input.value || "").length;
        input.setSelectionRange(Math.min(start, valueLength), Math.min(end, valueLength));
      }
    });
  }

  function renderCatalog() {
    const list = filteredProducts();
    const visibleProducts = products.filter((p) => p.published !== false);
    layout(`
      ${brandRailHTML(visibleProducts)}
      <div class="catalog-sticky">
        <section class="toolbar" id="products">
          <label class="filter-field search-field"><span>Search</span><input class="search" data-action="search" placeholder="Search SKU, brand, product..." value="${escapeHTML(state.search)}">${searchSuggestions()}</label>
          <label class="filter-field"><span>Brand</span><select data-action="brand">${brands().map((b) => `<option ${b === state.brand ? "selected" : ""}>${escapeHTML(b)}</option>`).join("")}</select></label>
          <label class="filter-field"><span>Category</span><select data-action="category">${categories().map((c) => `<option ${c === state.category ? "selected" : ""}>${escapeHTML(c)}</option>`).join("")}</select></label>
          <label class="filter-field"><span>Sort</span><select data-action="sort">
            <option value="featured" ${state.sort === "featured" ? "selected" : ""}>Featured</option>
            <option value="price-low" ${state.sort === "price-low" ? "selected" : ""}>Price low to high</option>
            <option value="price-high" ${state.sort === "price-high" ? "selected" : ""}>Price high to low</option>
            <option value="brand" ${state.sort === "brand" ? "selected" : ""}>Brand A-Z</option>
          </select></label>
        </section>
        ${activeFilterChips()}
      </div>
      <main class="content">
        <div class="section-title compact-title"><div><h1>Wholesale Beauty Products</h1><p>${list.length} matching items</p></div></div>
        <div class="grid">
          ${list.map((product, index) => productCard(product, index)).join("")}
        </div>
      </main>`);
  }

  function brandRailHTML(visibleProducts) {
    const counts = visibleProducts.reduce((map, product) => {
      const brand = product.brand || "UNBRANDED";
      map.set(brand, (map.get(brand) || 0) + 1);
      return map;
    }, new Map());
    const brandItems = brands().filter((brand) => brand !== "All");
    return `
      <aside class="brand-rail" aria-label="Brand filter">
        <div class="brand-rail-title">Brands</div>
        <button class="${state.brand === "All" ? "active" : ""}" data-clear-filter="brand">
          <span>All</span><em>${visibleProducts.length}</em>
        </button>
        ${brandItems.map((brand) => `
          <button class="${state.brand === brand ? "active" : ""}" data-filter-brand="${escapeHTML(brand)}" title="Show ${escapeHTML(brand)} products">
            <span>${escapeHTML(brand)}</span><em>${counts.get(brand) || 0}</em>
          </button>`).join("")}
      </aside>`;
  }

  function productCard(p, index = 0) {
    const options = shadeOptions(p);
    return `
      <article class="card">
        <a class="product-image" href="${escapeHTML(productPath(p.id))}" data-detail="${escapeHTML(p.id)}" aria-label="View ${escapeHTML(p.name)}">${productImage(p, index < 5 ? "eager" : "lazy")}</a>
        <div class="card-body">
          <div class="meta">
            <button class="tag tag-button" data-filter-brand="${escapeHTML(p.brand)}" title="Show all ${escapeHTML(p.brand)} products">${escapeHTML(p.brand)}</button>
            <button class="tag tag-button" data-filter-category="${escapeHTML(p.category)}" title="Show all ${escapeHTML(p.category)} products">${escapeHTML(p.category)}</button>
          </div>
          <h3><a class="product-title-link" href="${escapeHTML(productPath(p.id))}" data-detail="${escapeHTML(p.id)}">${escapeHTML(p.name)}</a></h3>
          <p class="desc">${escapeHTML(p.description)}</p>
          <div class="card-signals"><span>${options.length} shade${options.length === 1 ? "" : "s"}</span><span>SKU ${escapeHTML(p.sku)}</span></div>
          ${cartStatusForProduct(p.id)}
          <div class="price-row"><span class="price">${money(p.price)}</span><button class="primary quick-button" data-quick-add="${escapeHTML(p.id)}">Quick add</button></div>
        </div>
      </article>`;
  }

  function renderDetail() {
    const p = products.find((item) => item.id === state.detailId) || products[0];
    if (!p) return renderCatalog();
    const options = shadeOptions(p);
    if (!options.includes(state.selectedColor)) state.selectedColor = options[0];
    const images = productImages(p);
    if (!images.includes(state.selectedImage)) state.selectedImage = images[0];
    const sameBrand = products.filter((item) => item.published !== false && item.id !== p.id && item.brand === p.brand).slice(0, 4);
    const used = new Set([p.id, ...sameBrand.map((item) => item.id)]);
    const sameCategory = products.filter((item) => item.published !== false && !used.has(item.id) && item.category === p.category).slice(0, 4);
    layout(`
      <main class="detail">
        <button class="ghost" data-view="catalog">Back to products</button>
        <div class="detail-layout" style="margin-top:18px;">
          <div class="gallery">
            <div class="product-image">${productImageByUrl(p, state.selectedImage, "eager")}</div>
            ${images.length > 1 ? `<div class="thumb-strip">${images.map((image, index) => `
              <button class="gallery-thumb ${image === state.selectedImage ? "active" : ""}" data-image-select="${escapeHTML(image)}" aria-label="Product image ${index + 1}">
                ${productImageByUrl(p, image)}
              </button>`).join("")}</div>` : ""}
          </div>
          <section>
            <div class="meta"><span class="tag">${escapeHTML(p.brand)}</span><span class="tag">${escapeHTML(p.category)}</span><span class="tag">SKU ${escapeHTML(p.sku)}</span></div>
            <h1>${escapeHTML(p.name)}</h1>
            <p class="price">${money(p.price)}</p>
            ${productInformation(p)}
            <div class="detail-panel">
              <h3>Choose shade / type</h3>
              <div class="swatches">${options.map((c) => `<button class="swatch ${c === state.selectedColor ? "active" : ""}" data-color="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("")}</div>
              <div class="form-row single-field">
                <label>Quantity<input type="number" min="1" value="${state.qty}" data-action="qty"></label>
              </div>
              <button class="primary" data-add="${escapeHTML(p.id)}">Add to cart</button>
            </div>
          </section>
        </div>
        ${qaSection()}
        ${recommendationSection(`More from ${p.brand}`, sameBrand)}
        ${recommendationSection(`More ${p.category} products`, sameCategory)}
      </main>`);
  }

  function qaSection() {
    return `
      <section class="qa-panel">
        <div class="section-title"><div><h2>Q/A</h2><p>Order and delivery notes</p></div></div>
        <div class="qa-list">
          ${PRODUCT_QA.map(([question, answer]) => `
            <details>
              <summary>${escapeHTML(question)}</summary>
              <p>${escapeHTML(answer)}</p>
            </details>`).join("")}
        </div>
      </section>`;
  }

  function productInformation(product) {
    const text = String(product.description || "").trim();
    if (!text) return "";
    return `
      <section class="product-info-text">
        <h3>Product information</h3>
        <p>${escapeHTML(text)}</p>
      </section>`;
  }

  function recommendationSection(title, items) {
    if (!items.length) return "";
    return `
      <section class="recommendations">
        <div class="section-title"><div><h2>${escapeHTML(title)}</h2><p>${items.length} recommended items</p></div></div>
        <div class="grid recommendation-grid">${items.map(productCard).join("")}</div>
      </section>`;
  }

  function renderCart() {
    const totals = cartTotals();
    const grouped = cartGroups(totals.lines);
    layout(`
      <main class="cart-page">
        <div class="section-title"><div><h2>Demand list</h2><p>${cart.length} selected item${cart.length === 1 ? "" : "s"}</p></div><button class="ghost" data-view="catalog">Continue shopping</button></div>
        ${cart.length ? `<div class="cart-list">${grouped.map(cartGroup).join("")}</div>
        <div class="cart-summary">
          <div class="panel">
            <h3>Total ${money(totals.total)}</h3>
            <label class="field">
              <span>Shipping country</span>
              <select data-action="shipping-country">
                <option value="Europe" ${state.shippingCountry === "Europe" ? "selected" : ""}>Europe</option>
                <option value="United States" ${state.shippingCountry === "United States" ? "selected" : ""}>United States</option>
              </select>
            </label>
            <div class="total-box">
              <div><span>Product total</span><strong>${money(totals.productTotal)}</strong></div>
              <div><span>Shipping weight</span><strong>${weight(totals.shippingWeight)}</strong></div>
              <div><span>SHIPPING COST</span><strong>${money(totals.shipping)}</strong></div>
              <div><span>TOTAL</span><strong>${money(totals.total)}</strong></div>
            </div>
            ${state.orderStatus ? `<div class="notice">${escapeHTML(state.orderStatus)}</div>` : ""}
            <button class="primary" style="width:100%;margin-bottom:10px;" data-create-order>Create order & Contact Supplier</button>
            <button class="ghost" style="width:100%;" data-clear-cart>Clear cart</button>
            <p class="small">The order will be saved on the server. WhatsApp will open with the order number only. Current receiving number: ${escapeHTML(whatsappNumber)}.</p>
          </div>
        </div>` : `<div class="empty">Your cart is empty. Add products from the catalog first.</div>`}
      </main>`);
  }

  function cartGroups(lines) {
    const groups = [];
    const byBrand = new Map();
    lines.forEach((line, index) => {
      const brand = line.brand || "UNBRANDED";
      if (!byBrand.has(brand)) {
        const group = { brand, lines: [], subtotal: 0, weight: 0 };
        byBrand.set(brand, group);
        groups.push(group);
      }
      const group = byBrand.get(brand);
      group.lines.push({ ...line, cartIndex: index });
      group.subtotal += line.qty * line.price;
      group.weight += line.qty * Number(line.weight || 0);
    });
    return groups;
  }

  function cartGroup(group) {
    return `
      <section class="cart-brand-group">
        <div class="cart-brand-head">
          <h3>${escapeHTML(group.brand)}</h3>
          <span>${group.lines.length} item${group.lines.length === 1 ? "" : "s"} · ${money(group.subtotal)} · ${weight(group.weight)}</span>
        </div>
        ${group.lines.map((item) => cartItem(item, item.cartIndex)).join("")}
      </section>`;
  }

  function cartItem(item, index) {
    return `
      <div class="cart-item">
        <div class="thumb">${item.image ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" decoding="async">` : escapeHTML(item.brand.slice(0, 2))}</div>
        <div><strong>${escapeHTML(item.name)}</strong><div class="small">${escapeHTML(item.sku)} · ${escapeHTML(item.color || "Default")} · ${weight(item.weight * item.qty)}</div></div>
        <input type="number" min="1" value="${item.qty}" data-cart-qty="${index}">
        <div><strong>${money(item.qty * item.price)}</strong><div class="small">${money(item.price)} each</div></div>
        <button class="ghost" data-remove-cart="${index}">Remove</button>
      </div>`;
  }

  function whatsappTarget() {
    return String(whatsappNumber || "").replace(/[^\d]/g, "");
  }

  function whatsappMessage(orderNo) {
    return `I have generated the order ,No: ${orderNo}. Please confirm availability and payment link.`;
  }

  async function createOrderAndContact() {
    if (!cart.length) return;
    state.orderStatus = "Creating order...";
    renderCart();
    try {
      const totals = cartTotals();
      const result = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          country: state.shippingCountry,
          items: totals.lines.map((item) => ({
            id: item.id,
            sku: item.sku,
            color: item.color || "Default",
            qty: item.qty,
          })),
        }),
      });
      state.orderStatus = `Order ${result.orderNo} created. WhatsApp is opening.`;
      renderCart();
      window.open(`https://wa.me/${whatsappTarget()}?text=${encodeURIComponent(whatsappMessage(result.orderNo))}`, "_blank");
    } catch (error) {
      state.orderStatus = error.message;
      renderCart();
    }
  }

  function renderAdmin() {
    if (!isAdminAuthed) return renderAdminLogin();
    const editing = products.find((p) => p.id === state.editingId) || null;
    const p = editing || { sku: "", brand: "", name: "", category: "Cosmetics", price: "", stock: "", weight: "", description: "", colors: [], image: "", images: [], published: true };
    const adminProducts = filteredAdminProducts();
    const adminTotalPages = Math.max(1, Math.ceil(adminProducts.length / ADMIN_PAGE_SIZE));
    state.adminPage = Math.max(1, Math.min(Number(state.adminPage || 1), adminTotalPages));
    const pageStart = (state.adminPage - 1) * ADMIN_PAGE_SIZE;
    const pageItems = adminProducts.slice(pageStart, pageStart + ADMIN_PAGE_SIZE);
    const brandOptionsHtml = adminBrandOptions().map((brand) => `<option value="${escapeHTML(brand)}"></option>`).join("");
    layout(`
      <main class="admin">
        <div class="section-title"><div><h2>Catalog admin</h2><p>Edit products, publish products, and manage product images.</p></div><button class="ghost" data-logout-admin>Logout</button></div>
        <div class="notice">${apiOnline ? "Admin changes are saved to the SQLite database on the server." : "Server API is unavailable; admin saving is disabled until the backend is running."}</div>
        ${state.adminStatus ? `<div class="notice">${escapeHTML(state.adminStatus)}</div>` : ""}
        <section class="panel order-download-panel">
          <h3>Download order Excel</h3>
          <form class="order-download-form" data-order-download-form>
            ${field("Order No.", `<input name="orderNo" placeholder="DL202606110930001A2B" required>`)}
            <button class="primary" type="submit">Download order Excel</button>
          </form>
        </section>
        <div class="admin-grid">
          <form class="panel form-stack" data-admin-form novalidate>
            <h3>${editing ? "Edit product" : "Create product"}</h3>
            ${field("WhatsApp receiving number", `<input name="whatsapp" placeholder="8613800000000" value="${escapeHTML(whatsappNumber)}">`)}
            <hr style="border:0;border-top:1px solid var(--line);width:100%;">
            ${field("SKU", `<input name="sku" placeholder="SKU" required value="${escapeHTML(p.sku)}">`)}
            ${field("Brand", `<input name="brand" list="admin-brand-options" placeholder="Type 1-2 letters or enter a new brand" autocomplete="off" required value="${escapeHTML(p.brand)}"><datalist id="admin-brand-options">${brandOptionsHtml}</datalist>`)}
            ${field("Item Name", `<input name="name" placeholder="Item Name" required value="${escapeHTML(p.name)}">`)}
            ${field("Category", `<input name="category" placeholder="Category" value="${escapeHTML(p.category)}">`)}
            <div class="form-row">
              ${field("Price (USD)", `<input name="price" type="number" inputmode="decimal" min="0.01" step="any" placeholder="Price" required value="${escapeHTML(p.price)}">`)}
              ${field("QTY", `<input name="stock" type="number" placeholder="QTY" value="${escapeHTML(p.stock)}">`)}
            </div>
            ${field("Weight (kg)", `<input name="weight" type="number" inputmode="decimal" min="0.001" step="any" placeholder="Weight" required value="${escapeHTML(p.weight)}">`)}
            ${field("Colors / shade options", `<input name="colors" placeholder="Use / only, example: 1/2/3" required value="${escapeHTML((p.colors || []).join("/"))}">`)}
            ${imageManagerBlock(p)}
            ${field("Product information", `<textarea name="description" placeholder="Product information">${escapeHTML(p.description)}</textarea>`)}
            <label class="check-field"><input type="checkbox" name="published" ${p.published !== false ? "checked" : ""}> Published</label>
            <button class="primary" type="submit">${editing ? "Save changes" : "Add product"}</button>
            <div class="save-feedback" data-save-feedback aria-live="polite">${state.adminStatus ? escapeHTML(state.adminStatus) : ""}</div>
            ${editing ? `<button class="ghost" type="button" data-cancel-edit>Cancel edit</button>` : ""}
            <div class="notice" data-admin-live-status>${escapeHTML(state.adminStatus || "Image uploads preview immediately. Click Save changes to publish the product update.")}</div>
          </form>
          <section class="panel">
            <h3>${adminProducts.length} / ${products.length} products</h3>
            ${field("Search products", `<input data-action="admin-search" placeholder="Search SKU, name, brand, category..." value="${escapeHTML(state.adminSearch)}">`)}
            ${adminPaginationHTML(adminProducts.length, pageStart, pageItems.length, adminTotalPages)}
            <div class="admin-list">${pageItems.map(adminRow).join("")}</div>
            ${adminPaginationHTML(adminProducts.length, pageStart, pageItems.length, adminTotalPages)}
          </section>
        </div>
      </main>`);
  }

  function filteredAdminProducts() {
    const query = state.adminSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.sku, product.brand, product.name, product.category, product.description]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  function adminPaginationHTML(total, pageStart, pageCount, totalPages) {
    if (!total) return `<div class="admin-pagination"><span>No matching products.</span></div>`;
    const from = pageStart + 1;
    const to = pageStart + pageCount;
    const page = state.adminPage;
    return `
      <div class="admin-pagination" aria-label="Admin product pagination">
        <span>Showing ${from}-${to} / ${total} · Page ${page} of ${totalPages}</span>
        <div class="admin-page-actions">
          <button type="button" class="ghost" data-admin-page="first" ${page <= 1 ? "disabled" : ""}>First</button>
          <button type="button" class="ghost" data-admin-page="prev" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <button type="button" class="ghost" data-admin-page="next" ${page >= totalPages ? "disabled" : ""}>Next</button>
          <button type="button" class="ghost" data-admin-page="last" ${page >= totalPages ? "disabled" : ""}>Last</button>
        </div>
      </div>`;
  }

  function field(label, control) {
    return `<label class="field"><span>${escapeHTML(label)}</span>${control}</label>`;
  }

  function detailImagesForProduct(product) {
    const image = String(product.image || "").trim();
    return cleanImageList(product.images || []).filter((item) => item !== image);
  }

  function adminPreviewItems(images, name, kind = "detail") {
    return images.map((image, index) => `
      <div class="admin-preview">
        <div class="admin-preview-image">
          <img src="${escapeHTML(adminThumbSrc(image))}" alt="${escapeHTML(name)} image ${index + 1}" loading="lazy" decoding="async">
          <button class="image-remove" type="button" ${kind === "picture" ? "data-remove-picture" : `data-remove-detail-image="${escapeHTML(image)}"`} aria-label="Remove image ${index + 1}">X</button>
        </div>
        <span>${kind === "picture" ? "Picture" : `Detail image ${index + 1}`}</span>
      </div>`).join("");
  }

  function imageManagerBlock(product) {
    const picture = String(product.image || "").trim();
    const details = detailImagesForProduct(product);
    return `
      <div class="image-manager" data-admin-image-manager>
        <input type="hidden" name="image" value="${escapeHTML(picture)}">
        <textarea name="images" hidden>${escapeHTML(details.join("\n"))}</textarea>
        <div class="image-manager-section">
          <div class="image-manager-head">
            <strong>Picture</strong>
            <label class="file-button">
              <span>Upload picture</span>
              <input class="file-input-hidden" type="file" accept="image/*" data-upload-picture>
            </label>
          </div>
          <div class="admin-image-previews picture-preview" data-picture-preview>
            ${picture ? adminPreviewItems([picture], product.name, "picture") : `<div class="image-empty">No picture selected</div>`}
          </div>
        </div>
        <div class="image-manager-section">
          <div class="image-manager-head">
            <strong>Detail images</strong>
            <label class="file-button">
              <span>Upload detail images</span>
              <input class="file-input-hidden" type="file" accept="image/*" multiple data-upload-details>
            </label>
          </div>
          <div class="admin-image-previews" data-detail-preview>
            ${details.length ? adminPreviewItems(details, product.name, "detail") : `<div class="image-empty">No detail images selected</div>`}
          </div>
        </div>
      </div>`;
  }

  function formDetailImageList(form) {
    return cleanImageList(String(form.elements.images?.value || "").split(/\n|,/));
  }

  function previewDetailImageList(form) {
    return cleanImageList(
      Array.from(form.querySelectorAll("[data-detail-preview] [data-remove-detail-image]")).map((button) => button.dataset.removeDetailImage)
    ).filter((image) => !String(image).startsWith("blob:"));
  }

  function currentDetailImageList(form) {
    const stored = formDetailImageList(form);
    return stored.length ? stored : previewDetailImageList(form);
  }

  function syncImageFieldsFromPreview(form) {
    if (!form || form.dataset.imageUploading === "1") return;
    const details = previewDetailImageList(form);
    if (details.length) form.elements.images.value = details.join("\n");
  }

  function syncAdminImagePreview(form, override = {}) {
    const name = form.elements.name?.value || "Product";
    const picture = override.picture !== undefined ? override.picture : String(form.elements.image?.value || "").trim();
    const details = override.details !== undefined ? cleanImageList(override.details) : formDetailImageList(form);
    const picturePreview = form.querySelector("[data-picture-preview]");
    const detailPreview = form.querySelector("[data-detail-preview]");
    if (picturePreview) {
      picturePreview.innerHTML = picture ? adminPreviewItems([picture], name, "picture") : `<div class="image-empty">No picture selected</div>`;
    }
    if (detailPreview) {
      detailPreview.innerHTML = details.length ? adminPreviewItems(details, name, "detail") : `<div class="image-empty">No detail images selected</div>`;
    }
    setAdminImageBusy(form, form.dataset.imageUploading === "1");
  }

  function setAdminImageBusy(form, busy) {
    if (!form) return;
    form.dataset.imageUploading = busy ? "1" : "0";
    form.querySelectorAll("[data-upload-picture], [data-upload-details], .image-remove").forEach((control) => {
      control.disabled = busy;
    });
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = busy;
  }

  function positiveDecimal(value) {
    const text = String(value || "").trim();
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function setSaveFeedback(form, message, kind = "error") {
    const feedback = form.querySelector("[data-save-feedback]");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `save-feedback ${kind}`;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function validateAdminProductForm(form, data) {
    const required = [
      ["sku", "SKU is required."],
      ["brand", "Brand is required."],
      ["name", "Item Name is required."],
      ["price", "Price (USD) is required."],
      ["weight", "Weight (kg) is required."],
      ["colors", "Colors / shade options is required."],
    ];
    for (const [key, message] of required) {
      if (!String(data[key] || "").trim()) {
        form.elements[key]?.focus();
        return message;
      }
    }
    if (positiveDecimal(data.price) === null) {
      form.elements.price?.focus();
      return "Price (USD) must be a positive integer or decimal.";
    }
    if (positiveDecimal(data.weight) === null) {
      form.elements.weight?.focus();
      return "Weight (kg) must be a positive integer or decimal.";
    }
    if (!cleanColorList(splitColorText(data.colors)).length) {
      form.elements.colors?.focus();
      return "Colors / shade options must contain at least one valid shade.";
    }
    return "";
  }

  function renderAdminLogin() {
    layout(`
      <main class="admin auth-page">
        <form class="panel auth-card form-stack" data-login-form>
          <h2>Admin login</h2>
          <p class="small">Login is required before opening catalog management.</p>
          ${state.adminLoginError ? `<div class="notice">${escapeHTML(state.adminLoginError)}</div>` : ""}
          ${field("Username", `<input name="username" autocomplete="username" placeholder="admin" required>`)}
          ${field("Password", `<input name="password" type="password" autocomplete="current-password" placeholder="admin123" required>`)}
          <button class="primary" type="submit">Login</button>
        </form>
      </main>`);
  }

  function adminRow(p) {
    return `
      <div class="admin-row">
        <div class="thumb">${p.image ? `<img src="${escapeHTML(adminThumbSrc(p.image))}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async">` : escapeHTML(p.brand.slice(0, 2))}</div>
        <div><strong>${escapeHTML(p.name)}</strong><div class="small">${escapeHTML(p.sku)} · ${escapeHTML(p.brand)} · ${p.published === false ? "Draft" : "Published"}</div></div>
        <div>${money(p.price)}</div>
        <button class="ghost" data-edit="${escapeHTML(p.id)}">Edit</button>
        <button class="ghost" data-delete="${escapeHTML(p.id)}">Archive</button>
      </div>`;
  }

  function addToCart(id, color = state.selectedColor || "Default", qty = state.qty || 1) {
    const p = products.find((item) => item.id === id);
    if (!p) return;
    const selected = color || "Default";
    const amount = Math.max(1, Number(qty || 1));
    const key = `${id}__${selected}`;
    const existing = cart.find((item) => item.key === key);
    if (existing) existing.qty += amount;
    else cart.push({ key, id, sku: p.sku, brand: p.brand, name: p.name, price: Number(p.price || 0), weight: Number(p.weight || 0), color: selected, qty: amount, image: p.image || "" });
    saveCart();
    state.cartFeedback = { ...p };
    render();
    window.clearTimeout(addToCart.timer);
    addToCart.timer = window.setTimeout(() => {
      state.cartFeedback = null;
      render();
    }, 1300);
  }

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, a[data-detail], .brand, [data-quick-backdrop]");
    if (!target) return;
    if (target.dataset.quickBackdrop !== undefined && event.target === target) {
      state.quickAddId = null;
      render();
      return;
    }
    if (target.dataset.clearFilter) {
      const key = target.dataset.clearFilter;
      if (key === "search" || key === "all") state.search = "";
      if (key === "brand" || key === "all") state.brand = "All";
      if (key === "category" || key === "all") state.category = "All";
      updateCatalogUrl();
      renderCatalog();
      return;
    }
    if (target.dataset.filterBrand) {
      state.view = "catalog";
      state.detailId = null;
      state.search = "";
      state.brand = target.dataset.filterBrand;
      state.category = "All";
      updateCatalogUrl();
      render();
      window.setTimeout(() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }), 0);
      return;
    }
    if (target.dataset.filterCategory) {
      state.view = "catalog";
      state.detailId = null;
      state.search = "";
      state.brand = "All";
      state.category = target.dataset.filterCategory;
      updateCatalogUrl();
      render();
      window.setTimeout(() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }), 0);
      return;
    }
    if (target.dataset.view) {
      state.view = target.dataset.view;
      state.detailId = null;
      history.pushState(
        { view: state.view },
        "",
        state.view === "catalog" ? "/" : `/#${state.view}`
      );
      render();
      return;
    }
    if (target.dataset.adminPage) {
      const totalPages = Math.max(1, Math.ceil(filteredAdminProducts().length / ADMIN_PAGE_SIZE));
      if (target.dataset.adminPage === "first") state.adminPage = 1;
      if (target.dataset.adminPage === "prev") state.adminPage = Math.max(1, state.adminPage - 1);
      if (target.dataset.adminPage === "next") state.adminPage = Math.min(totalPages, state.adminPage + 1);
      if (target.dataset.adminPage === "last") state.adminPage = totalPages;
      renderAdmin();
      return;
    }
    if (target.dataset.scroll) document.getElementById(target.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    if (target.dataset.detail) {
      event.preventDefault();
      openDetail(target.dataset.detail);
      return;
    }
    if (target.dataset.color) {
      state.selectedColor = target.dataset.color;
      render();
    }
    if (target.dataset.quickAdd) {
      const product = products.find((item) => item.id === target.dataset.quickAdd);
      if (!product) return;
      const options = shadeOptions(product);
      state.quickAddId = product.id;
      state.quickAddColor = options[0];
      state.quickAddQty = 1;
      render();
      return;
    }
    if (target.dataset.closeQuickAdd !== undefined) {
      state.quickAddId = null;
      render();
      return;
    }
    if (target.dataset.quickColor) {
      state.quickAddColor = target.dataset.quickColor;
      render();
      return;
    }
    if (target.dataset.quickAddSubmit) {
      addToCart(target.dataset.quickAddSubmit, state.quickAddColor || "Default", state.quickAddQty || 1);
      state.quickAddId = null;
      render();
      return;
    }
    if (target.dataset.imageSelect !== undefined) {
      state.selectedImage = target.dataset.imageSelect;
      renderDetail();
    }
    if (target.dataset.add) addToCart(target.dataset.add);
    if (target.dataset.removePicture !== undefined) {
      const form = target.closest("[data-admin-form]");
      if (!form) return;
      if (form.dataset.imageUploading === "1") return;
      form.elements.image.value = "";
      syncAdminImagePreview(form);
      return;
    }
    if (target.dataset.removeDetailImage !== undefined) {
      const form = target.closest("[data-admin-form]");
      if (!form) return;
      if (form.dataset.imageUploading === "1") return;
      const imageToRemove = target.dataset.removeDetailImage;
      const nextImages = currentDetailImageList(form).filter((image) => image !== imageToRemove);
      form.elements.images.value = nextImages.join("\n");
      syncAdminImagePreview(form);
      return;
    }
    if (target.dataset.removeCart) {
      cart.splice(Number(target.dataset.removeCart), 1);
      saveCart();
      render();
    }
    if (target.dataset.createOrder !== undefined) {
      await createOrderAndContact();
    }
    if (target.dataset.whatsapp !== undefined) {
      window.open(`https://wa.me/${whatsappTarget()}?text=${encodeURIComponent("Please confirm availability and payment link.")}`, "_blank");
    }
    if (target.dataset.clearCart !== undefined) {
      cart = [];
      saveCart();
      render();
    }
    if (target.dataset.logoutAdmin !== undefined) {
      try {
        await apiFetch("/api/logout", { method: "POST", body: "{}" });
      } catch {}
      isAdminAuthed = false;
      state.editingId = null;
      state.adminStatus = "";
      render();
    }
    if (target.dataset.edit) {
      state.editingId = target.dataset.edit;
      render();
    }
    if (target.dataset.delete) {
      if (!isAdminAuthed) return renderAdminLogin();
      const archivedId = target.dataset.delete;
      try {
        await apiFetch(`/api/products/${encodeURIComponent(archivedId)}`, { method: "DELETE" });
        products = products.filter((product) => product.id !== archivedId);
        if (state.editingId === archivedId) state.editingId = null;
        await refreshProducts();
        state.adminStatus = "Product archived.";
        renderAdmin();
      } catch (error) {
        state.adminStatus = error.message;
        renderAdmin();
      }
    }
    if (target.dataset.cancelEdit !== undefined) {
      state.editingId = null;
      render();
    }
  });

  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.action === "search") {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      state.search = el.value;
      renderCatalog();
      refocusControl('[data-action="search"]', start, end);
    }
    if (el.dataset.action === "admin-search") {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      state.adminSearch = el.value;
      state.adminPage = 1;
      renderAdmin();
      refocusControl('[data-action="admin-search"]', start, end);
    }
    if (el.dataset.action === "qty") state.qty = Math.max(1, Number(el.value || 1));
    if (el.dataset.action === "quick-qty") state.quickAddQty = Math.max(1, Number(el.value || 1));
    if (el.dataset.cartQty) {
      cart[Number(el.dataset.cartQty)].qty = Math.max(1, Number(el.value || 1));
      saveCart();
      renderCart();
    }
  });

  document.addEventListener("change", async (event) => {
    const el = event.target;
    if (el.dataset.action === "brand") {
      state.brand = el.value;
      updateCatalogUrl();
      renderCatalog();
    }
    if (el.dataset.action === "category") {
      state.category = el.value;
      updateCatalogUrl();
      renderCatalog();
    }
    if (el.dataset.action === "sort") {
      state.sort = el.value;
      renderCatalog();
    }
    if (el.dataset.action === "shipping-country") {
      state.shippingCountry = el.value;
      state.orderStatus = "";
      renderCart();
    }
    if (el.dataset.uploadPicture !== undefined && el.files[0]) {
      if (!isAdminAuthed) return renderAdminLogin();
      const form = el.closest("[data-admin-form]");
      const previewUrls = localPreviewUrls(el.files);
      const previousPicture = form ? String(form.elements.image?.value || "").trim() : "";
      const previousDetails = form ? formDetailImageList(form) : [];
      setAdminImageBusy(form, true);
      if (form) syncAdminImagePreview(form, { picture: previewUrls[0], details: previousDetails });
      setAdminLiveStatus("Uploading Picture...");
      try {
        const urls = await uploadImageFiles(el.files);
        if (urls[0] && form) {
          form.elements.image.value = urls[0];
          await preloadImages(urls.map(adminThumbSrc));
          syncAdminImagePreview(form);
        }
        setAdminLiveStatus("Picture uploaded. Click Save changes to publish this product update.");
      } catch (error) {
        if (form) syncAdminImagePreview(form, { picture: previousPicture, details: previousDetails });
        setAdminLiveStatus(error.message);
      } finally {
        revokePreviewUrls(previewUrls);
        setAdminImageBusy(form, false);
      }
      el.value = "";
    }
    if (el.dataset.uploadDetails !== undefined && el.files[0]) {
      if (!isAdminAuthed) return renderAdminLogin();
      const form = el.closest("[data-admin-form]");
      const previewUrls = localPreviewUrls(el.files);
      const previousPicture = form ? String(form.elements.image?.value || "").trim() : "";
      const previousDetails = form ? formDetailImageList(form) : [];
      setAdminImageBusy(form, true);
      if (form) syncAdminImagePreview(form, { picture: previousPicture, details: cleanImageList([...previousDetails, ...previewUrls]) });
      setAdminLiveStatus("Uploading Detail images...");
      try {
        const urls = await uploadImageFiles(el.files);
        if (urls.length && form) {
          const textarea = form.elements.images;
          const current = formDetailImageList(form);
          textarea.value = cleanImageList([...current, ...urls]).join("\n");
          await preloadImages(urls.map(adminThumbSrc));
          syncAdminImagePreview(form);
        }
        setAdminLiveStatus(`${urls.length} detail image${urls.length === 1 ? "" : "s"} uploaded. Click Save changes to publish this product update.`);
      } catch (error) {
        if (form) syncAdminImagePreview(form, { picture: previousPicture, details: previousDetails });
        setAdminLiveStatus(error.message);
      } finally {
        revokePreviewUrls(previewUrls);
        setAdminImageBusy(form, false);
      }
      el.value = "";
    }
  });

  document.addEventListener("submit", async (event) => {
    const loginForm = event.target.closest("[data-login-form]");
    if (loginForm) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(loginForm).entries());
      try {
        await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ username: data.username, password: data.password }) });
        isAdminAuthed = true;
        state.adminLoginError = "";
        await refreshProducts();
        renderAdmin();
      } catch (error) {
        state.adminLoginError = error.message;
        renderAdminLogin();
      }
      return;
    }

    const orderDownloadForm = event.target.closest("[data-order-download-form]");
    if (orderDownloadForm) {
      event.preventDefault();
      if (!isAdminAuthed) return renderAdminLogin();
      const data = Object.fromEntries(new FormData(orderDownloadForm).entries());
      const orderNo = String(data.orderNo || "").trim();
      if (!orderNo) return;
      window.location.href = `/api/orders/${encodeURIComponent(orderNo)}/excel`;
      return;
    }

    const form = event.target.closest("[data-admin-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.imageUploading === "1") {
      setSaveFeedback(form, "Images are still uploading. Please wait until upload finishes, then save.", "error");
      return;
    }
    syncImageFieldsFromPreview(form);
    const data = Object.fromEntries(new FormData(form).entries());
    const validationError = validateAdminProductForm(form, data);
    if (validationError) {
      setSaveFeedback(form, validationError, "error");
      return;
    }
    whatsappNumber = String(data.whatsapp || whatsappNumber).replace(/[^\d]/g, "") || whatsappNumber;
    const colorOptions = cleanColorList(splitColorText(data.colors));
    const product = normalizeProduct({
      id: data.sku.trim(),
      sku: data.sku.trim(),
      brand: data.brand.trim(),
      name: data.name.trim(),
      category: data.category.trim() || "Cosmetics",
      price: positiveDecimal(data.price),
      stock: Number(data.stock || 0),
      weight: positiveDecimal(data.weight),
      description: data.description.trim(),
      colors: colorOptions,
      image: data.image.trim(),
      images: cleanImageList(String(data.images || "").split(/\n|,/)),
      published: data.published === "on",
    });
    if (!product.sku || !product.name) return;
    const feedback = form.querySelector("[data-save-feedback]");
    const submitButton = form.querySelector('button[type="submit"]');
    if (feedback) {
      feedback.textContent = "Saving...";
      feedback.className = "save-feedback saving";
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    if (submitButton) submitButton.disabled = true;
    try {
      await apiFetch(state.editingId ? `/api/products/${encodeURIComponent(state.editingId)}` : "/api/products", {
        method: state.editingId ? "PUT" : "POST",
        body: JSON.stringify(product),
      });
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ whatsapp: whatsappNumber }),
      });
      await refreshProducts();
      state.editingId = null;
      state.adminStatus = "Product saved successfully.";
      renderAdmin();
      window.setTimeout(() => {
        const savedFeedback = document.querySelector("[data-save-feedback]");
        if (savedFeedback) {
          savedFeedback.className = "save-feedback success";
          savedFeedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 0);
    } catch (error) {
      state.adminStatus = error.message;
      renderAdmin();
      window.setTimeout(() => {
        const errorFeedback = document.querySelector("[data-save-feedback]");
        if (errorFeedback) {
          errorFeedback.className = "save-feedback error";
          errorFeedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 0);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  window.addEventListener("popstate", () => {
    const productId = productIdFromPath();
    const params = new URLSearchParams(location.search);
    state.view = productId ? "detail" : location.hash === "#admin" ? "admin" : location.hash === "#cart" ? "cart" : "catalog";
    state.detailId = productId || null;
    state.brand = params.get("brand") || "All";
    state.category = params.get("category") || "All";
    state.search = params.get("q") || "";
    render();
  });

  loadServerState().then(render);
})();
