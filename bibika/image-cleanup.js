(() => {
  const pending = new Set();
  const nativeFetch = window.fetch.bind(window);
  const LIVE_SITE_URL = "https://raw.githubusercontent.com/kiananstudio/kiananstudio.github.io/main";
  let observer = null;
  let observerScheduled = false;
  let uiRefreshRunning = false;

  function normalizePath(value) {
    return String(value || "").trim().replace(/^\/+/, "").split(/[?#]/, 1)[0];
  }

  function imageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${LIVE_SITE_URL}/${raw.replace(/^\//, "")}`;
  }

  function showToast(message, duration = 4200) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => node.classList.remove("show"), duration);
  }

  function collectCatalogImages(data) {
    const result = new Set();
    for (const product of data?.products || []) {
      const cover = normalizePath(product?.cover);
      if (cover) result.add(cover);
      for (const item of Array.isArray(product?.gallery) ? product.gallery : []) {
        const path = normalizePath(item);
        if (path) result.add(path);
      }
    }
    return result;
  }

  function requestInfo(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    return { url, method };
  }

  async function cleanup(paths, { keepalive = false } = {}) {
    const list = [...new Set((paths || []).map(normalizePath).filter(Boolean))];
    if (!list.length) return;
    try {
      await nativeFetch("/api/image/cleanup", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: list }),
      });
    } catch (error) {
      console.warn("Bibika image cleanup failed", error);
    }
  }

  function cleanupPending(options) {
    if (!pending.size) return;
    const paths = [...pending];
    pending.clear();
    cleanup(paths, options);
  }

  function ensureRemovalStyles() {
    if (document.querySelector("style[data-bibika-image-remove]")) return;
    const style = document.createElement("style");
    style.dataset.bibikaImageRemove = "1";
    style.textContent = `
      .image-field-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
      #remove-cover-image:disabled{opacity:.42;cursor:not-allowed;transform:none}
      #gallery-editor.gallery-cards{display:grid;gap:12px}
      #gallery-editor .gallery-card{position:relative;display:grid!important;grid-template-columns:136px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px;border:1px solid rgba(127,175,213,.18);border-radius:14px;background:rgba(255,255,255,.025)}
      #gallery-editor .gallery-card-preview{width:136px;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#081018;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center}
      #gallery-editor .gallery-card-preview img{width:100%;height:100%;object-fit:cover;display:block}
      #gallery-editor .gallery-card-preview span{display:none;color:#8293a3;font-size:.78rem;text-align:center;padding:8px}
      #gallery-editor .gallery-card-info{min-width:0;display:flex;flex-direction:column;gap:4px}
      #gallery-editor .gallery-card-info strong{font-size:.96rem;color:#eef5fb}
      #gallery-editor .gallery-card-info code{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8fa1b1;font:inherit;font-size:.78rem}
      #gallery-editor .gallery-path-input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;padding:0!important;border:0!important}
      #gallery-editor .gallery-card-controls{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
      #gallery-editor .gallery-order-btn{width:38px;height:38px;padding:0;display:inline-grid;place-items:center;font-size:1rem}
      #gallery-editor .gallery-order-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
      #gallery-editor .gallery-image-remove{width:auto;min-width:86px;padding:0 12px;white-space:nowrap}
      @media(max-width:720px){#gallery-editor .gallery-card{grid-template-columns:100px minmax(0,1fr)}#gallery-editor .gallery-card-preview{width:100px}.gallery-card-controls{grid-column:1/-1!important;justify-content:flex-start!important}}
      @media(max-width:560px){.image-field-head{align-items:flex-start;gap:10px}.image-field-actions{width:100%;justify-content:flex-start}.image-field-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function syncCoverRemoveButton() {
    const cover = document.querySelector("#f-cover");
    const upload = document.querySelector("#upload-cover");
    if (!cover || !upload) return;

    const head = upload.closest(".image-field-head");
    if (!head) return;

    let actions = head.querySelector(".image-field-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "image-field-actions";
      head.insertBefore(actions, upload);
      actions.appendChild(upload);
    } else if (upload.parentElement !== actions) {
      actions.appendChild(upload);
    }

    let remove = document.querySelector("#remove-cover-image");
    if (!remove) {
      remove = document.createElement("button");
      remove.type = "button";
      remove.id = "remove-cover-image";
      remove.className = "btn btn-small btn-danger";
      remove.textContent = "Удалить изображение";
      remove.title = "Убрать текущую обложку";
      actions.appendChild(remove);
    }

    remove.disabled = !normalizePath(cover.value);
  }

  function ensureGalleryCard(row, index, total) {
    const input = row.querySelector(".repeat-value");
    if (!input) return;
    const rawPath = String(input.value || "").trim();
    const path = normalizePath(rawPath);

    const remove = row.querySelector(".remove-row");
    if (remove) {
      remove.classList.add("gallery-image-remove");
      if (remove.textContent !== "Удалить") remove.textContent = "Удалить";
      remove.title = "Удалить изображение из галереи";
      remove.setAttribute("aria-label", "Удалить изображение из галереи");
    }

    if (!path) {
      row.classList.remove("gallery-card");
      input.classList.remove("gallery-path-input");
      row.querySelector(".gallery-card-preview")?.remove();
      row.querySelector(".gallery-card-info")?.remove();
      row.querySelector(".gallery-card-controls")?.remove();
      return;
    }

    row.classList.add("gallery-card");
    input.classList.add("gallery-path-input");

    let preview = row.querySelector(".gallery-card-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "gallery-card-preview";
      const img = document.createElement("img");
      img.alt = "";
      const fallback = document.createElement("span");
      fallback.textContent = "Нет предпросмотра";
      img.addEventListener("error", () => {
        img.style.display = "none";
        fallback.style.display = "block";
      });
      img.addEventListener("load", () => {
        img.style.display = "block";
        fallback.style.display = "none";
      });
      preview.append(img, fallback);
      row.insertBefore(preview, input);
    }
    const img = preview.querySelector("img");
    const wantedSrc = imageUrl(rawPath);
    if (img && img.getAttribute("src") !== wantedSrc) img.src = wantedSrc;

    let info = row.querySelector(".gallery-card-info");
    if (!info) {
      info = document.createElement("div");
      info.className = "gallery-card-info";
      const title = document.createElement("strong");
      const code = document.createElement("code");
      info.append(title, code);
      input.insertAdjacentElement("afterend", info);
    }
    const title = info.querySelector("strong");
    const code = info.querySelector("code");
    const nextTitle = `Изображение ${index + 1}`;
    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
    if (code && code.textContent !== rawPath) code.textContent = rawPath;
    if (code && code.title !== rawPath) code.title = rawPath;

    let controls = row.querySelector(".gallery-card-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "gallery-card-controls";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "btn btn-small btn-secondary gallery-order-btn gallery-move-up";
      up.textContent = "↑";
      up.title = "Переместить выше";
      up.setAttribute("aria-label", "Переместить изображение выше");

      const down = document.createElement("button");
      down.type = "button";
      down.className = "btn btn-small btn-secondary gallery-order-btn gallery-move-down";
      down.textContent = "↓";
      down.title = "Переместить ниже";
      down.setAttribute("aria-label", "Переместить изображение ниже");

      controls.append(up, down);
      if (remove) controls.appendChild(remove);
      row.appendChild(controls);
    } else if (remove && remove.parentElement !== controls) {
      controls.appendChild(remove);
    }

    const up = controls.querySelector(".gallery-move-up");
    const down = controls.querySelector(".gallery-move-down");
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === total - 1;
  }

  function refreshGalleryCards() {
    const list = document.querySelector("#gallery-editor");
    if (!list) return;
    const rows = [...list.querySelectorAll(":scope > .repeat-item")];
    const shouldUseCards = rows.some((row) => normalizePath(row.querySelector(".repeat-value")?.value));
    if (list.classList.contains("gallery-cards") !== shouldUseCards) {
      list.classList.toggle("gallery-cards", shouldUseCards);
    }
    rows.forEach((row, index) => ensureGalleryCard(row, index, rows.length));
  }

  function ensureRemovalUi() {
    ensureRemovalStyles();
    syncCoverRemoveButton();
    refreshGalleryCards();
  }

  function startObserver() {
    if (!observer) return;
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function runUiRefresh() {
    if (uiRefreshRunning) return;
    uiRefreshRunning = true;
    observer?.disconnect();
    try {
      ensureRemovalUi();
    } finally {
      uiRefreshRunning = false;
      startObserver();
    }
  }

  function scheduleUiRefresh() {
    if (observerScheduled || uiRefreshRunning) return;
    observerScheduled = true;
    requestAnimationFrame(() => {
      observerScheduled = false;
      runUiRefresh();
    });
  }

  window.fetch = async function bibikaFetch(input, init = {}) {
    const info = requestInfo(input, init);
    const response = await nativeFetch(input, init);

    if (response.ok && info.url.origin === location.origin && info.url.pathname === "/api/image" && info.method === "POST") {
      try {
        const payload = await response.clone().json();
        if (payload?.path) pending.add(normalizePath(payload.path));
      } catch (_) {}
    }

    if (response.ok && info.url.origin === location.origin && info.url.pathname === "/api/catalog" && (info.method === "POST" || info.method === "PUT")) {
      try {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        const referenced = collectCatalogImages(body?.data);
        const orphaned = [...pending].filter((path) => !referenced.has(path));
        pending.clear();
        if (orphaned.length) cleanup(orphaned);
      } catch (_) {
        pending.clear();
      }
    }

    return response;
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const moveUp = target.closest("#gallery-editor .gallery-move-up");
    if (moveUp) {
      const row = moveUp.closest(".repeat-item");
      const previous = row?.previousElementSibling;
      if (row && previous) {
        row.parentElement.insertBefore(row, previous);
        runUiRefresh();
        showToast("Порядок галереи изменён. Он применится после сохранения продукта.");
      }
      return;
    }

    const moveDown = target.closest("#gallery-editor .gallery-move-down");
    if (moveDown) {
      const row = moveDown.closest(".repeat-item");
      const next = row?.nextElementSibling;
      if (row && next) {
        row.parentElement.insertBefore(next, row);
        runUiRefresh();
        showToast("Порядок галереи изменён. Он применится после сохранения продукта.");
      }
      return;
    }

    const removeCover = target.closest("#remove-cover-image");
    if (removeCover) {
      const cover = document.querySelector("#f-cover");
      if (!cover || !normalizePath(cover.value)) return;
      cover.value = "";
      cover.dispatchEvent(new Event("input", { bubbles: true }));
      syncCoverRemoveButton();
      showToast("Обложка убрана. Чтобы удалить её с сайта и из GitHub, нажми «Сохранить изменения».", 5200);
      return;
    }

    const galleryRemove = target.closest("#gallery-editor .remove-row");
    if (galleryRemove) {
      setTimeout(() => {
        showToast("Изображение убрано из галереи. Изменение применится после сохранения продукта.", 4600);
        runUiRefresh();
      }, 0);
      return;
    }

    if (target.closest("#cancel-editor, #close-editor")) {
      cleanupPending();
      return;
    }

    const editorBackdrop = document.querySelector("#editor-modal");
    if (target === editorBackdrop) cleanupPending();
  }, true);

  document.addEventListener("input", (event) => {
    if (event.target?.id === "f-cover") syncCoverRemoveButton();
    if (event.target?.closest?.("#gallery-editor")) runUiRefresh();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const productEditor = document.querySelector("#editor-modal.open");
    const imageEditor = document.querySelector("#image-modal.open");
    if (productEditor && !imageEditor) cleanupPending();
  }, true);

  observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target?.closest?.("#gallery-editor")) return true;
      return [...mutation.addedNodes].some((node) =>
        node instanceof Element && (
          node.matches?.("#gallery-editor, #upload-cover, .repeat-item") ||
          node.querySelector?.("#gallery-editor, #upload-cover, .repeat-item")
        )
      );
    });
    if (relevant) scheduleUiRefresh();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      runUiRefresh();
    }, { once: true });
  } else {
    runUiRefresh();
  }

  window.addEventListener("pagehide", () => cleanupPending({ keepalive: true }));
})();