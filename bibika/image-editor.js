(() => {
  const ALLOWED_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
  const ALLOWED_EXTENSIONS = /\.(webp|png|jpe?g)$/i;
  const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
  const WEBP_QUALITY = 0.85;
  const PRESETS = {
    cover: { width: 1200, height: 900, label: "Обложка продукта" },
    gallery: { width: 1600, height: 1200, label: "Изображение галереи" },
  };

  let target = "cover";
  let sourceFile = null;
  let sourceUrl = "";
  let image = null;
  let scale = 1;
  let coverScale = 1;
  let fitScale = 1;
  let centerX = 0;
  let centerY = 0;
  let dragging = false;
  let pointerId = null;
  let lastClientX = 0;
  let lastClientY = 0;
  let uploading = false;

  const q = (selector) => document.querySelector(selector);

  function toast(message, duration = 4200) {
    const node = q("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), duration);
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getProductId() {
    const id = slugify(q("#f-id")?.value);
    if (id) return id;
    return slugify(q("#f-title")?.value);
  }

  function openFilePicker(nextTarget) {
    if (uploading) return;
    const productId = getProductId();
    if (!productId) {
      toast("Сначала заполни название продукта или ID / slug.");
      q("#f-title")?.focus();
      return;
    }
    target = nextTarget;
    const input = q("#image-file-input");
    input.value = "";
    input.click();
  }

  function validateFile(file) {
    if (!file) return "Файл не выбран.";
    if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) {
      return "Разрешены только WEBP, PNG, JPG и JPEG. SVG не поддерживается.";
    }
    if (file.size > MAX_SOURCE_BYTES) {
      return "Исходное изображение слишком большое. Максимальный размер — 20 МБ.";
    }
    return "";
  }

  function preset() {
    return PRESETS[target] || PRESETS.cover;
  }

  function setupCanvas() {
    const canvas = q("#image-crop-canvas");
    const p = preset();
    canvas.width = p.width;
    canvas.height = p.height;
    q("#image-editor-title").textContent = `Подготовка изображения — ${p.label}`;
    q("#image-output-size").textContent = `${p.width} × ${p.height} px`;
    q("#image-output-format").textContent = "WEBP · качество 85%";
  }

  function resetTransform(mode = "fill") {
    if (!image) return;
    const canvas = q("#image-crop-canvas");
    coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    fitScale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    scale = mode === "fit" ? fitScale : coverScale;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    syncScaleSlider();
    draw();
  }

  function syncScaleSlider() {
    const slider = q("#image-scale");
    if (!slider || !coverScale) return;
    const ratio = Math.round((scale / coverScale) * 100);
    slider.value = String(Math.max(Number(slider.min), Math.min(Number(slider.max), ratio)));
    q("#image-scale-value").textContent = `${ratio}%`;
  }

  function clampCenter() {
    if (!image) return;
    const canvas = q("#image-crop-canvas");
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    if (drawWidth >= canvas.width) {
      centerX = Math.min(drawWidth / 2, Math.max(canvas.width - drawWidth / 2, centerX));
    } else {
      centerX = canvas.width / 2;
    }

    if (drawHeight >= canvas.height) {
      centerY = Math.min(drawHeight / 2, Math.max(canvas.height - drawHeight / 2, centerY));
    } else {
      centerY = canvas.height / 2;
    }
  }

  function draw() {
    const canvas = q("#image-crop-canvas");
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
  }

  function openEditor(file) {
    sourceFile = file;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    image = new Image();
    image.onload = () => {
      setupCanvas();
      q("#image-source-name").textContent = file.name;
      q("#image-source-size").textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${(file.size / 1024 / 1024).toFixed(2)} МБ`;
      resetTransform("fill");
      q("#image-modal").classList.add("open");
      q("#image-modal").setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };
    image.onerror = () => {
      cleanupSource();
      toast("Не удалось прочитать выбранное изображение.");
    };
    image.src = sourceUrl;
  }

  function cleanupSource() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = "";
    sourceFile = null;
    image = null;
  }

  function closeEditor() {
    if (uploading) return;
    const modal = q("#image-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!q("#editor-modal")?.classList.contains("open")) document.body.style.overflow = "";
    cleanupSource();
  }

  function setUploading(value) {
    uploading = value;
    const button = q("#image-upload-confirm");
    if (button) {
      button.disabled = value;
      button.textContent = value ? "Загрузка…" : "Использовать изображение";
    }
    ["#image-cancel", "#image-close", "#image-fit", "#image-fill", "#image-reset", "#image-scale"].forEach((selector) => {
      const node = q(selector);
      if (node) node.disabled = value;
    });
  }

  function canvasToWebp(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("Браузер не смог создать WEBP."));
          return;
        }
        resolve(blob);
      }, "image/webp", WEBP_QUALITY);
    });
  }

  async function uploadBlob(blob) {
    const productId = getProductId();
    const response = await fetch("/api/image", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "image/webp",
        "X-Bibika-Product": productId,
        "X-Bibika-Target": target,
      },
      body: blob,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    if (!payload.path) throw new Error("GitHub не вернул путь к изображению.");
    return payload;
  }

  function appendGalleryPath(path) {
    const list = q("#gallery-editor");
    const row = document.createElement("div");
    row.className = "repeat-item";
    const input = document.createElement("input");
    input.className = "repeat-value";
    input.placeholder = "assets/images/example.webp";
    input.value = path;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-row";
    remove.title = "Удалить пункт";
    remove.textContent = "×";
    row.append(input, remove);
    list.appendChild(row);
  }

  async function confirmImage() {
    if (!image || uploading) return;
    setUploading(true);
    try {
      const blob = await canvasToWebp(q("#image-crop-canvas"));
      const result = await uploadBlob(blob);
      if (target === "cover") {
        const cover = q("#f-cover");
        cover.value = result.path;
        cover.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        appendGalleryPath(result.path);
      }
      toast(`Изображение загружено: ${result.path}`, 5200);
      setUploading(false);
      closeEditor();
    } catch (error) {
      setUploading(false);
      toast(`Ошибка загрузки изображения: ${error.message}`, 6000);
    }
  }

  function beginDrag(event) {
    if (!image || uploading) return;
    dragging = true;
    pointerId = event.pointerId;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    q("#image-crop-canvas").setPointerCapture?.(pointerId);
    event.preventDefault();
  }

  function drag(event) {
    if (!dragging || event.pointerId !== pointerId || !image) return;
    const canvas = q("#image-crop-canvas");
    const rect = canvas.getBoundingClientRect();
    centerX += (event.clientX - lastClientX) * (canvas.width / rect.width);
    centerY += (event.clientY - lastClientY) * (canvas.height / rect.height);
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    clampCenter();
    draw();
    event.preventDefault();
  }

  function endDrag(event) {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  }

  function setScaleFromRatio(ratioPercent) {
    if (!image) return;
    scale = coverScale * (ratioPercent / 100);
    clampCenter();
    syncScaleSlider();
    draw();
  }

  function wheelZoom(event) {
    if (!image || uploading) return;
    event.preventDefault();
    const slider = q("#image-scale");
    const current = Number(slider.value);
    const next = Math.max(Number(slider.min), Math.min(Number(slider.max), current + (event.deltaY < 0 ? 5 : -5)));
    setScaleFromRatio(next);
  }

  function ensureUi() {
    if (!document.querySelector('link[data-bibika-image-editor]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/image-editor.css?v=1";
      link.dataset.bibikaImageEditor = "1";
      document.head.appendChild(link);
    }

    const coverInput = q("#f-cover");
    const coverField = coverInput?.closest(".field");
    if (coverField && !q("#upload-cover")) {
      const label = coverField.querySelector(":scope > span");
      const head = document.createElement("div");
      head.className = "image-field-head";
      if (label) {
        label.replaceWith(head);
        head.appendChild(label);
      } else {
        const fallback = document.createElement("span");
        fallback.textContent = "Обложка";
        head.appendChild(fallback);
        coverField.prepend(head);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-small btn-secondary";
      button.id = "upload-cover";
      button.textContent = "Загрузить / кадрировать";
      head.appendChild(button);
      const note = coverField.querySelector("small");
      if (note) note.textContent = "WEBP, PNG, JPG/JPEG → автоматически 1200 × 900 WEBP. SVG запрещён.";
    }

    const addGallery = q("#add-gallery");
    const galleryLine = addGallery?.closest(".section-line");
    if (addGallery && galleryLine && !q("#upload-gallery")) {
      const actions = document.createElement("div");
      actions.className = "section-actions";
      const upload = document.createElement("button");
      upload.type = "button";
      upload.className = "btn btn-small btn-secondary";
      upload.id = "upload-gallery";
      upload.textContent = "+ Загрузить изображение";
      addGallery.textContent = "+ Указать путь";
      addGallery.replaceWith(actions);
      actions.append(upload, addGallery);
    }

    if (!q("#image-file-input")) {
      const input = document.createElement("input");
      input.id = "image-file-input";
      input.type = "file";
      input.accept = "image/webp,image/png,image/jpeg,.webp,.png,.jpg,.jpeg";
      input.hidden = true;
      document.body.appendChild(input);
    }

    if (!q("#image-modal")) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div class="modal-backdrop" id="image-modal" aria-hidden="true">
          <section class="modal image-modal" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
            <div class="modal-head">
              <div>
                <p class="eyebrow">Редактор изображения</p>
                <h2 id="image-editor-title">Подготовка изображения</h2>
              </div>
              <button type="button" class="icon-btn" id="image-close" aria-label="Закрыть">×</button>
            </div>
            <div class="image-editor-body">
              <div class="crop-workspace">
                <div class="crop-stage">
                  <div class="crop-canvas-wrap"><canvas id="image-crop-canvas" width="1200" height="900"></canvas></div>
                  <p class="crop-help">Перетаскивай изображение мышью. Масштаб меняется ползунком или колесом мыши.</p>
                </div>
              </div>
              <aside class="image-controls">
                <div class="image-control-card">
                  <strong id="image-source-name">—</strong>
                  <span id="image-source-size">—</span>
                </div>
                <div class="image-scale-row">
                  <div class="image-scale-label"><span>Масштаб</span><strong id="image-scale-value">100%</strong></div>
                  <input id="image-scale" type="range" min="10" max="400" step="1" value="100">
                </div>
                <div class="image-control-buttons">
                  <button type="button" class="btn btn-secondary" id="image-fit">Вписать</button>
                  <button type="button" class="btn btn-secondary" id="image-fill">Заполнить</button>
                  <button type="button" class="btn btn-ghost" id="image-reset">Сбросить</button>
                </div>
                <div class="image-control-card image-output-grid">
                  <div><span>Размер</span><strong id="image-output-size">—</strong></div>
                  <div><span>Формат</span><strong id="image-output-format">WEBP</strong></div>
                </div>
                <div class="image-format-note">На GitHub отправляется только готовый WEBP. Исходный PNG/JPG/WEBP не сохраняется.</div>
              </aside>
            </div>
            <footer class="modal-actions">
              <span class="image-upload-note">После загрузки путь автоматически появится в поле продукта. Сам продукт публикуется кнопкой «Сохранить изменения».</span>
              <div>
                <button type="button" class="btn btn-ghost" id="image-cancel">Отмена</button>
                <button type="button" class="btn btn-primary" id="image-upload-confirm">Использовать изображение</button>
              </div>
            </footer>
          </section>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
    }
  }

  function bind() {
    ensureUi();
    q("#upload-cover")?.addEventListener("click", () => openFilePicker("cover"));
    q("#upload-gallery")?.addEventListener("click", () => openFilePicker("gallery"));
    q("#image-file-input")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      const error = validateFile(file);
      if (error) {
        toast(error, 5200);
        event.target.value = "";
        return;
      }
      openEditor(file);
    });

    q("#image-close")?.addEventListener("click", closeEditor);
    q("#image-cancel")?.addEventListener("click", closeEditor);
    q("#image-modal")?.addEventListener("click", (event) => {
      if (event.target === q("#image-modal")) closeEditor();
    });
    q("#image-fit")?.addEventListener("click", () => resetTransform("fit"));
    q("#image-fill")?.addEventListener("click", () => resetTransform("fill"));
    q("#image-reset")?.addEventListener("click", () => resetTransform("fill"));
    q("#image-upload-confirm")?.addEventListener("click", confirmImage);

    q("#image-scale")?.addEventListener("input", (event) => setScaleFromRatio(Number(event.target.value)));
    const canvas = q("#image-crop-canvas");
    canvas?.addEventListener("pointerdown", beginDrag);
    canvas?.addEventListener("pointermove", drag);
    canvas?.addEventListener("pointerup", endDrag);
    canvas?.addEventListener("pointercancel", endDrag);
    canvas?.addEventListener("wheel", wheelZoom, { passive: false });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !q("#image-modal")?.classList.contains("open")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEditor();
    }, true);
  }

  bind();
})();
