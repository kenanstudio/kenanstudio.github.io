(() => {
  const pending = new Set();
  const nativeFetch = window.fetch.bind(window);

  function normalizePath(value) {
    return String(value || "").trim().replace(/^\/+/, "").split(/[?#]/, 1)[0];
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

    if (target.closest("#cancel-editor, #close-editor")) {
      cleanupPending();
      return;
    }

    const editorBackdrop = document.querySelector("#editor-modal");
    if (target === editorBackdrop) cleanupPending();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const productEditor = document.querySelector("#editor-modal.open");
    const imageEditor = document.querySelector("#image-modal.open");
    if (productEditor && !imageEditor) cleanupPending();
  }, true);

  window.addEventListener("pagehide", () => cleanupPending({ keepalive: true }));
})();
