const API_URL = "/api/catalog";
const LIVE_SITE_URL = "https://kiananstudio.com";

const FALLBACK_DATA = {
  categories: [
    { id: "unity-tools", title: "Unity Tools", description: "Tools and editor extensions for faster Unity workflows." },
    { id: "games", title: "Games", description: "Original games and interactive projects from Kianan Studio." },
    { id: "3d-assets", title: "3D Assets", description: "Reusable 3D assets and content for game development." }
  ],
  products: []
};

let state = clone(FALLBACK_DATA);
let deleteIndex = null;
let busy = false;

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

function showToast(message, duration = 3200) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), duration);
}

function setBusy(value, label = "") {
  busy = value;
  const submit = $('#product-form button[type="submit"]');
  const confirmDelete = $("#confirm-delete");
  const reload = $("#reset-local");
  if (submit) {
    submit.disabled = value;
    submit.textContent = value ? (label || "Сохранение…") : "Сохранить изменения";
  }
  if (confirmDelete) confirmDelete.disabled = value;
  if (reload) reload.disabled = value;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function loadData({ announce = false } = {}) {
  try {
    const data = await requestJson(`${API_URL}?t=${Date.now()}`);
    state = data;
    renderAll();
    if (announce) showToast("Данные обновлены из GitHub.");
  } catch (error) {
    state = clone(FALLBACK_DATA);
    renderAll();
    showToast(`Не удалось загрузить каталог из GitHub: ${error.message}`, 5000);
  }
}

async function publishData(nextState, message) {
  return requestJson(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: nextState, message }),
  });
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
  return `${LIVE_SITE_URL}/${path.replace(/^\//, "")}`;
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
        <a class="btn btn-secondary" href="${LIVE_SITE_URL}/product.html?id=${encodeURIComponent(product.id || "")}" target="_blank" rel="noreferrer">Предпросмотр ↗</a>
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
  $("#f-id").dataset.touched = editing ? "1" : "";
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
  $("#delete-copy").textContent = `Удалить «${product?.title || "этот продукт"}» с публичного сайта? Изменение будет записано в GitHub.`;
  openModal("#delete-modal");
}

function handleListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === "edit") openEditor(index);
  if (button.dataset.action === "delete") requestDelete(index);
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$('[data-go-products]').forEach((button) => button.addEventListener("click", () => setView("products")));
  $("#add-product-top").addEventListener("click", () => !busy && openEditor());
  $("#dashboard-products").addEventListener("click", handleListAction);
  $("#products-list").addEventListener("click", handleListAction);
  $("#category-filter").addEventListener("change", renderProducts);
  $("#product-search").addEventListener("input", renderProducts);

  $("#close-editor").addEventListener("click", () => !busy && closeModal("#editor-modal"));
  $("#cancel-editor").addEventListener("click", () => !busy && closeModal("#editor-modal"));
  $("#cancel-delete").addEventListener("click", () => !busy && closeModal("#delete-modal"));

  $("#editor-modal").addEventListener("click", (event) => {
    if (!busy && event.target === $("#editor-modal")) closeModal("#editor-modal");
  });
  $("#delete-modal").addEventListener("click", (event) => {
    if (!busy && event.target === $("#delete-modal")) closeModal("#delete-modal");
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

  $("#product-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

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

    const nextState = clone(state);
    if (editingIndex === null) nextState.products.push(product);
    else nextState.products[editingIndex] = product;

    setBusy(true, "Публикация…");
    try {
      await publishData(nextState, editingIndex === null ? `Bibika: add ${product.title}` : `Bibika: update ${product.title}`);
      state = nextState;
      renderAll();
      closeModal("#editor-modal");
      $("#f-id").dataset.touched = "";
      showToast(editingIndex === null ? "Продукт добавлен и опубликован." : "Изменения опубликованы на сайте.");
    } catch (error) {
      showToast(`Ошибка публикации: ${error.message}`, 5200);
    } finally {
      setBusy(false);
    }
  });

  $("#confirm-delete").addEventListener("click", async () => {
    if (deleteIndex === null || busy) return;
    const product = state.products[deleteIndex];
    const nextState = clone(state);
    nextState.products.splice(deleteIndex, 1);

    setBusy(true, "Удаление…");
    try {
      await publishData(nextState, `Bibika: delete ${product?.title || "product"}`);
      state = nextState;
      deleteIndex = null;
      renderAll();
      closeModal("#delete-modal");
      showToast(`«${product?.title || "Продукт"}» удалён и изменение опубликовано.`);
    } catch (error) {
      showToast(`Ошибка удаления: ${error.message}`, 5200);
    } finally {
      setBusy(false);
    }
  });

  $("#reset-local").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true, "Обновление…");
    try {
      await loadData({ announce: true });
    } finally {
      setBusy(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || busy) return;
    if ($("#delete-modal").classList.contains("open")) closeModal("#delete-modal");
    else if ($("#editor-modal").classList.contains("open")) closeModal("#editor-modal");
  });
}

bindEvents();
loadData();