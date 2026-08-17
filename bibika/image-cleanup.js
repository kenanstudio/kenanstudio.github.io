(() => {
  const pending = new Set();
  const nativeFetch = window.fetch.bind(window);

  function normalizePath(value) {
    return String(value || "").trim().replace(/^\/+/, "").split(/[?#]/, 1)[0];
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
      #gallery-editor .gallery-image-remove{width:auto;min-width:86px;padding:0 12px;white-space:nowrap}
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

  function upgradeGalleryRemoveButtons() {
    document.querySelectorAll("#gallery-editor .remove-row").forEach((button) => {
      button.classList.add("gallery-image-remove");
      button.textContent = "Удалить";
      button.title = "Удалить изображение из галереи";
      button.setAttribute("aria-label", "Удалить изображение из галереи");
    });
  }

  function ensureRemovalUi() {
    ensureRemovalStyles();
    syncCoverRemoveButton();
    upgradeGalleryRemoveButtons();
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
        upgradeGalleryRemoveButtons();
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
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const productEditor = document.querySelector("#editor-modal.open");
    const imageEditor = document.querySelector("#image-modal.open");
    if (productEditor && !imageEditor) cleanupPending();
  }, true);

  const observer = new MutationObserver(() => ensureRemovalUi());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureRemovalUi, { once: true });
  } else {
    ensureRemovalUi();
  }

  window.addEventListener("pagehide", () => cleanupPending({ keepalive: true }));
})();
