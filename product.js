(() => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const shell = document.getElementById('product-page-shell');
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  fetch('data/products.json', { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error(`Catalog load failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      const product = data.products.find(p => p.id === id);
      if (!product) {
        shell.innerHTML = `<div class="product-not-found"><h1>Product not found</h1><p><a class="text-link" href="./#categories">Return to catalog →</a></p></div>`;
        return;
      }

      const category = data.categories.find(c => c.id === product.category);
      document.title = `${product.title} — Kianan Studio`;

      const gallery = (product.gallery || []).map(src => `
        <figure class="media-frame product-gallery-item"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.title)} screenshot" loading="lazy"></figure>
      `).join('');

      const features = (product.features || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
      const primary = product.links?.primaryUrl
        ? `<a class="button button-primary" href="${escapeHtml(product.links.primaryUrl)}" target="_blank" rel="noopener">${escapeHtml(product.links.primaryLabel || 'Open link')}</a>`
        : '';

      shell.innerHTML = `
        <a class="back-link" href="./#categories">← Back to ${escapeHtml(category?.title || 'catalog')}</a>
        <section class="product-detail-hero">
          <div class="product-detail-copy">
            <span class="eyebrow">${escapeHtml(category?.title || '')}</span>
            <h1>${escapeHtml(product.title)}</h1>
            <div class="product-labels">
              ${product.status ? `<span>${escapeHtml(product.status)}</span>` : ''}
              ${product.version ? `<span>Version ${escapeHtml(product.version)}</span>` : ''}
            </div>
            <p class="product-lead">${escapeHtml(product.description || product.shortDescription || '')}</p>
            <div class="hero-actions">${primary}</div>
          </div>
          <div class="product-cover-panel">
            ${product.cover ? `<img src="${escapeHtml(product.cover)}" alt="${escapeHtml(product.title)}">` : `<div class="item-placeholder large">${escapeHtml(product.title.slice(0,2).toUpperCase())}</div>`}
          </div>
        </section>
        ${features ? `<section class="product-content-section"><span class="eyebrow">Features</span><h2>What it includes.</h2><ul class="feature-list product-feature-list">${features}</ul></section>` : ''}
        ${gallery ? `<section class="product-content-section"><span class="eyebrow">Media</span><h2>Screenshots.</h2><div class="product-gallery">${gallery}</div></section>` : ''}
      `;
    })
    .catch(err => {
      console.error(err);
      shell.innerHTML = '<p class="load-error">Product information is temporarily unavailable.</p>';
    });
})();
