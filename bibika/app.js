const LIVE_DATA_URL = "https://kiananstudio.com/data/products.json";
const STORAGE_KEY = "kianan-bibika-products-v1";

const FALLBACK_DATA = {
  categories: [
    { id: "unity-tools", title: "Unity Tools", description: "Tools and editor extensions for faster Unity workflows." },
    { id: "games", title: "Games", description: "Original games and interactive projects from Kianan Studio." },
    { id: "3d-assets", title: "3D Assets", description: "Reusable 3D assets and content for game development." }
  ],
  products: [
    {
      id: "3d-collider",
      category: "unity-tools",
      title: "3D Collider",
      status: "Unity Asset Store",
      version: "1.0.0",
      shortDescription: "Generate practical colliders for complex 3D meshes directly inside the Unity Editor.",
      description: "3D Collider is a Unity Editor tool for generating colliders from complex meshes.",
      cover: "assets/images/3d-collider-cover.webp",
      gallery: ["assets/images/3d-collider-unity.webp"],
      features: [
        "Surface-based MeshCollider generation for static geometry",
        "Preserves important openings, holes, tunnels and passages",
        "Closed convex MeshColliders generated from the model surface for Rigidbody workflows"
      ],
      specs: [
        ["Unity", "2022.3+"],
        ["Platforms tested", "macOS · Windows"],
        ["Render pipelines", "Built-in · URP · HDRP"]
      ],
      links: {
        primaryLabel: "View on Unity Asset Store",
        primaryUrl: "https://assetstore.unity.com/packages/slug/398482"
      }
    },
    {
      id: "3deditor",
      category: "unity-tools",
      title: "3DEditor",
      status: "In development",
      version: "",
      shortDescription: "Create and edit 3D geometry directly inside Unity.",
      description: "An in-Editor 3D modeling workflow being developed by Kianan Studio.",
      cover: "",
      gallery: [],
      features: [],
      specs: [],
      links: {}
    }
  ]
};

let state = structuredClone(FALLBACK_DATA);
let deleteIndex = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const categoryNames = {
  "unity-tools": "Unity Tools",
  "3d-assets": "3D Assets",
  games: "Games"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadData() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      state = JSON.parse(local);
      renderAll();
      return;
    } catch (_) {}
  }

  try {
    const response = await fetch(`${LIVE_DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json();
  } catch (error) {
    state = clone(FALLBACK_DATA);
    showToast("Не удалось загрузить каталог с сайта. Использованы резервные данные.");
  }
  renderAll();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setView(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  $("#page-title").textContent = view === "products" ? "Продукты" : "Панель управления";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function productImageUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://kiananstudio.com/${path.replace(/^\//, "")}`;
}

function rowTemplate(product, index) {
  const img = product.cover
    ? `<img src="${escapeHtml(productImageUrl(product.cover))}" alt="" onerror="this.remove()">`
    : "";
  const description = product.shortDescription || product.description || "Описание пока не заполнено.";
  return `
    <article class="product-row" data-index="${index}">
      <div class="product-thumb">${img || escapeHtml((product.title || "K").slice(0, 1).toUpperCase())}</div>
      <div class="product-copy">
        <h3>${escapeHtml(product.title || "Без названия")}</h3>
        <p>${escapeHtml(description)}</p>
        <div class="product-meta">
          <span class="chip">${escapeHtml(categoryNames[product.category] || product.category || "Без категории")}</span>
          ${product.version ? `<span class="chip">v${escapeHtml(product.version)}</span>` : ""}
          ${product.status ? `<span class="chip">${escapeHtml(product.status)}</span>` : ""}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-secondary" data-action="edit" data-index="${index}">Редактировать</button>
        <a class="btn btn-secondary" href="https://kiananstudio.com/product.html?id=${encodeURIComponent(product.id || "")}" target="_blank" rel="noreferrer">Предпросмотр ↗</a>
        <button class="btn btn-danger" data-action="delete" data-index="${index}">Удалить</button>
      </div>
    </article>`;
}

function renderDashboard() {
  const products = state.products || [];
  $("#stat-total").textContent = products.length;
  $("#stat-unity").textContent = products.filter((p) => p.category === "unity-tools").length;
  $("#stat-assets").textContent = products.filter((p) => p.category === "3d-assets").length;
  $("#stat-games").textContent = products.filter((p) => p.category === "games").length;
  const list = $("#dashboard-products");
  list.innerHTML = products.length
    ? products.slice(0, 4).map((product, index) => rowTemplate(product, index)).join("")
    : '<div class="empty">В каталоге пока нет продуктов.</div>';
}

function renderProducts() {
  const filter = $("#category-filter").value;
  const query = $("#product-search").value.trim().toLowerCase();
  const list = $("#products-list");
  const items = (state.products || [])
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => filter === "all" || product.category === filter)
    .filter(({ product }) => !query || `${product.title || ""} ${product.status || ""} ${product.version || ""}`.toLowerCase().includes(query));

  list.innerHTML = items.length
    ? items.map(({ product, index }) => rowTemplate(product, index)).join("")
    : '<div class="empty">По выбранным условиям ничего не найдено.</div>';
}

function renderAll() {
  renderDashboard();
  renderProducts();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function openModal(id) {
  const modal = $(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = $(id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!$(".modal-backdrop.open")) document.body.style.overflow = "";
}

function addRepeatRow(container, type, values = []) {
  const row = document.createElement("div");
  row.className = `repeat-item${type === "spec" ? " spec" : ""}`;

  if (type === "spec") {
    row.innerHTML = `
      <input class="spec-key" placeholder="Название" value="${escapeHtml(values[0] || "")}">
      <input class="spec-value" placeholder="Значение" value="${escapeHtml(values[1] || "")}">
      <button type="button" class="remove-row" title="Удалить характеристику">×</button>`;
  } else {
    const placeholder = type === "gallery" ? "assets/images/example.webp" : "Введите пункт";
    row.innerHTML = `
      <input class="repeat-value" placeholder="${placeholder}" value="${escapeHtml(values[0] || "")}">
      <button type="button" class="remove-row" title="Удалить пункт">×</button>`;
  }
  container.appendChild(row);
}

function fillRepeatList(containerSelector, type, values) {
  const container = $(containerSelector);
  container.innerHTML = "";
  (values || []).forEach((value) => addRepeatRow(container, type, type === "spec" ? value : [value]));
  if (!(values || []).length && type === "feature") addRepeatRow(container, type, [""]);
}

function openEditor(index = null) {
  const editing = Number.isInteger(index);
  const product = editing ? clone(state.products[index]) : {
    id: "",
    category: "unity-tools",
    title: "",
    status: "",
    version: "",
    shortDescription: "",
    description: "",
    cover: "",
    gallery: [],
    features: [],
    specs: [],
    links: {}
  };

  $("#editing-index").value = editing ? String(index) : "";
  $("#editor-title").textContent = editing ? `Редактировать: ${product.title}` : "Добавить продукт";
  $("#f-title").value = product.title || "";
  $("#f-id").value = product.id || "";
  $("#f-category").value = product.category || "unity-tools";
  $("#f-status").value = product.status || "";
  $("#f-version").value = product.version || "";
  $("#f-short").value = product.shortDescription || "";
  $("#f-description").value = product.description || "";
  $("#f-cover").value = product.cover || "";
  $("#f-primary-label").value = product.links?.primaryLabel || "";
  $("#f-primary-url").value = product.links?.primaryUrl || "";

  fillRepeatList("#features-editor", "feature", product.features || []);
  fillRepeatList("#specs-editor", "spec", product.specs || []);
  fillRepeatList("#gallery-editor", "gallery", product.gallery || []);
  updatePreview();
  openModal("#editor-modal");
  setTimeout(() => $("#f-title").focus(), 50);
}

function collectRepeatValues(containerSelector) {
  return $$(".repeat-value", $(containerSelector)).map((input) => input.value.trim()).filter(Boolean);
}

function collectSpecs() {
  return $$(".repeat-item.spec", $("#specs-editor"))
    .map((row) => [$(".spec-key", row).value.trim(), $(".spec-value", row).value.trim()])
    .filter(([key, value]) => key || value);
}

function collectForm() {
  return {
    id: $("#f-id").value.trim(),
    category: $("#f-category").value,
    title: $("#f-title").value.trim(),
    status: $("#f-status").value.trim(),
    version: $("#f-version").value.trim(),
    shortDescription: $("#f-short").value.trim(),
    description: $("#f-description").value.trim(),
    cover: $("#f-cover").value.trim(),
    gallery: collectRepeatValues("#gallery-editor"),
    features: collectRepeatValues("#features-editor"),
    specs: collectSpecs(),
    links: {
      primaryLabel: $("#f-primary-label").value.trim(),
      primaryUrl: $("#f-primary-url").value.trim()
    }
  };
}

function updatePreview() {
  const title = $("#f-title").value.trim() || "Новый продукт";
  const version = $("#f-version").value.trim() || "—";
  const category = categoryNames[$("#f-category").value] || $("#f-category").value;
  const short = $("#f-short").value.trim() || "Заполните краткое описание, чтобы увидеть его здесь.";
  const status = $("#f-status").value.trim() || "Статус не указан";
  const cover = $("#f-cover").value.trim();

  $("#preview-title").textContent = title;
  $("#preview-version").textContent = version;
  $("#preview-category").textContent = category;
  $("#preview-short").textContent = short;
  $("#preview-status").textContent = status;

  const image = $("#preview-cover");
  const placeholder = $("#preview-placeholder");
  if (cover) {
    image.src = productImageUrl(cover);
    image.style.display = "block";
    placeholder.style.display = "none";
    image.onerror = () => {
      image.style.display = "none";
      placeholder.style.display = "block";
    };
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
    placeholder.style.display = "block";
  }
}

function requestDelete(index) {
  deleteIndex = index;
  const product = state.products[index];
  $("#delete-copy").textContent = `Удалить «${product?.title || "этот продукт"}»? Пока это удалит его только из тестового каталога Bibika в этом браузере.`;
  openModal("#delete-modal");
}

function handleListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === "edit") openEditor(index);
  if (button.dataset.action === "delete") requestDelete(index);
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$('[data-go-products]').forEach((button) => button.addEventListener("click", () => setView("products")));
  $("#add-product-top").addEventListener("click", () => openEditor());
  $("#dashboard-products").addEventListener("click", handleListAction);
  $("#products-list").addEventListener("click", handleListAction);
  $("#category-filter").addEventListener("change", renderProducts);
  $("#product-search").addEventListener("input", renderProducts);

  $("#close-editor").addEventListener("click", () => closeModal("#editor-modal"));
  $("#cancel-editor").addEventListener("click", () => closeModal("#editor-modal"));
  $("#cancel-delete").addEventListener("click", () => closeModal("#delete-modal"));

  $("#editor-modal").addEventListener("click", (event) => {
    if (event.target === $("#editor-modal")) closeModal("#editor-modal");
  });
  $("#delete-modal").addEventListener("click", (event) => {
    if (event.target === $("#delete-modal")) closeModal("#delete-modal");
  });

  $("#f-title").addEventListener("input", () => {
    if (!$("#editing-index").value && !$("#f-id").dataset.touched) $("#f-id").value = slugify($("#f-title").value);
    updatePreview();
  });
  $("#f-id").addEventListener("input", () => { $("#f-id").dataset.touched = "1"; });
  ["#f-category", "#f-status", "#f-version", "#f-short", "#f-cover"].forEach((selector) => $(selector).addEventListener("input", updatePreview));
  $("#f-category").addEventListener("change", updatePreview);

  $("#add-feature").addEventListener("click", () => addRepeatRow($("#features-editor"), "feature", [""]));
  $("#add-spec").addEventListener("click", () => addRepeatRow($("#specs-editor"), "spec", ["", ""]));
  $("#add-gallery").addEventListener("click", () => addRepeatRow($("#gallery-editor"), "gallery", [""]));
  $$(".repeat-list").forEach((list) => list.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-row");
    if (remove) remove.closest(".repeat-item").remove();
  }));

  $("#product-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const product = collectForm();
    if (!product.id || !product.title) {
      showToast("Заполни название продукта и ID / slug.");
      return;
    }
    const duplicate = state.products.findIndex((p) => p.id === product.id);
    const editingIndexRaw = $("#editing-index").value;
    const editingIndex = editingIndexRaw === "" ? null : Number(editingIndexRaw);
    if (duplicate !== -1 && duplicate !== editingIndex) {
      showToast("Такой ID / slug уже используется другим продуктом.");
      return;
    }

    if (editingIndex === null) state.products.push(product);
    else state.products[editingIndex] = product;
    persist();
    renderAll();
    closeModal("#editor-modal");
    $("#f-id").dataset.touched = "";
    showToast(editingIndex === null ? "Продукт добавлен в тестовый каталог." : "Изменения сохранены в тестовом каталоге.");
  });

  $("#confirm-delete").addEventListener("click", () => {
    if (deleteIndex === null) return;
    const title = state.products[deleteIndex]?.title || "Продукт";
    state.products.splice(deleteIndex, 1);
    deleteIndex = null;
    persist();
    renderAll();
    closeModal("#delete-modal");
    showToast(`«${title}» удалён из тестового каталога.`);
  });

  $("#reset-local").addEventListener("click", async () => {
    if (!confirm("Сбросить все тестовые изменения Bibika и снова загрузить данные с публичного сайта?")) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      const response = await fetch(`${LIVE_DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      state = await response.json();
    } catch (_) {
      state = clone(FALLBACK_DATA);
    }
    renderAll();
    showToast("Тестовые изменения сброшены.");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if ($("#delete-modal").classList.contains("open")) closeModal("#delete-modal");
    else if ($("#editor-modal").classList.contains("open")) closeModal("#editor-modal");
  });
}

bindEvents();
loadData();
